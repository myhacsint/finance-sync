import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { loadConfig, paths, readSecret } from "./config.js";
import { FinanceDatabase } from "./database.js";
import { FinanceService, FinanceServiceError } from "./service.js";
import type {
  RecurringExpenseDecision,
  RecurringExpenseOptimizationPriority,
  RecurringExpenseOptimizationStatus
} from "./types.js";
import { exportAll } from "./exporter.js";
import { manualSnapshotBundle } from "./connectors/manual.js";
import { importBundle } from "./importer.js";
import { snapshotSqlite } from "./backup.js";
import { renderUi } from "./ui.js";
import { buildHealth } from "./health.js";
import { buildCouncilInvestmentSnapshot } from "./council-investment.js";
import { buildCouncilPortfolioSnapshot } from "./council-portfolio.js";
import { ManualPreviewStore } from "./manual-workflow.js";
import { buildDashboardStatus, type SourceStatusRow } from "./dashboard-status.js";
import type { DecisionLabRequest } from "./dashboard-decision-lab.js";
import { receivePensionUpload } from "./pension-upload.js";
import { extractPensionDocument } from "./pension-extractor.js";
import { parseDrvPensionPages } from "./drv-pension-parser.js";
import { PensionPreviewStore } from "./pension-preview-store.js";
import type { PensionFieldKey } from "./pension-document-types.js";

mkdirSync(paths.data, { recursive: true });
mkdirSync(paths.archive, { recursive: true });
mkdirSync(paths.inbox, { recursive: true });
const config = loadConfig();
const db = new FinanceDatabase(join(paths.data, "finance.sqlite"));
const service = new FinanceService(db, config);
const scheduler = service.startScheduler();
const manualPreviews = new ManualPreviewStore();
const pensionPreviews = new PensionPreviewStore();
let pensionParserBusy = false;
const pensionUploadAttempts = new Map<string, number[]>();
const financeHubMark = readFileSync(new URL("../assets/finance-hub-mark.png", import.meta.url));
const financeHubClient = readFileSync(new URL("../assets/app.js", import.meta.url));
const financeHubStyles = readFileSync(new URL("../assets/app.css", import.meta.url));

const securityHeaders = {
  "cache-control": "no-store",
  "content-security-policy": "default-src 'self'; img-src 'self' data:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY"
};

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { ...securityHeaders, "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, (_, value) => typeof value === "bigint" ? value.toString() : value));
}

function sameOriginMutation(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  const fetchSite = req.headers["sec-fetch-site"];
  if (!origin || (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site")) return false;
  const forwarded = String(req.headers["x-forwarded-proto"] ?? "").split(",")[0].trim();
  const scheme = forwarded || (origin.startsWith("https://") ? "https" : "http");
  const requestOrigin = `${scheme}://${req.headers.host ?? ""}`;
  const allowed = new Set([requestOrigin]);
  if (config.publicBaseUrl) allowed.add(new URL(config.publicBaseUrl).origin);
  return allowed.has(origin);
}

function consumePensionRate(req: IncomingMessage): boolean {
  const key = req.socket.remoteAddress ?? "unknown";
  const cutoff = Date.now() - 10 * 60_000;
  const recent = (pensionUploadAttempts.get(key) ?? []).filter((value) => value >= cutoff);
  if (recent.length >= 3) return false;
  recent.push(Date.now());
  pensionUploadAttempts.set(key, recent);
  return true;
}

function pensionFailure(error: unknown): FinanceServiceError {
  const code = error instanceof Error ? error.message : String(error);
  const messages: Record<string, [string, number]> = {
    UPLOAD_MULTIPART_REQUIRED: ["Bitte eine PDF-, JPEG- oder PNG-Datei auswählen", 400],
    UPLOAD_TOO_LARGE: ["Die Datei ist größer als 12 MB", 413],
    UPLOAD_MIME_MISMATCH: ["Dateiformat und Dateiinhalt stimmen nicht überein", 400],
    UPLOAD_FILE_EMPTY: ["Die Datei ist leer", 400],
    UPLOAD_FILE_MISSING: ["Es wurde keine Datei übertragen", 400],
    PDF_TOO_MANY_PAGES: ["Die PDF hat mehr als 6 Seiten", 400],
    PDF_ENCRYPTED: ["Verschlüsselte PDFs werden nicht verarbeitet", 400],
    PDF_ACTIVE_CONTENT: ["Die PDF enthält nicht zulässige aktive Inhalte", 400],
    SECURITY_MALWARE_DETECTED: ["Die Sicherheitsprüfung hat die Datei abgelehnt", 400],
    SECURITY_SIGNATURES_STALE: ["Die Sicherheitsprüfung ist nicht aktuell; Upload wurde sicher abgebrochen", 503],
    SECURITY_SCANNER_UNAVAILABLE: ["Die Sicherheitsprüfung ist nicht verfügbar; Upload wurde sicher abgebrochen", 503],
    SECURITY_SCAN_FAILED: ["Die Sicherheitsprüfung konnte nicht abgeschlossen werden", 503],
    IMAGE_DIMENSIONS_INVALID: ["Das Bild ist zu klein oder technisch nicht sicher verarbeitbar", 400],
    PREVIEW_EXPIRED: ["Die Vorschau ist abgelaufen; bitte Datei erneut prüfen", 410],
    FIELD_VALUE_INVALID: ["Der korrigierte Wert hat ein ungültiges Format", 400],
    FIELD_UNKNOWN: ["Das Feld ist unbekannt", 404],
    PREVIEW_NOT_CONFIRMABLE: ["Bitte alle markierten Werte zuerst prüfen", 409]
  };
  const match = messages[code];
  return new FinanceServiceError(match?.[0] ?? "Die Datei konnte sicher nicht verarbeitet werden", match?.[1] ?? 400);
}

function authorized(req: IncomingMessage): boolean {
  const configured = readSecret("admin-token");
  if (!configured) return false;
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function body(req: IncomingMessage, max = 1_048_576): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > max) throw new Error("Anfrage ist zu groß");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (req.method === "GET" && url.pathname === "/health") {
      const report = buildHealth(db, config);
      return json(res, report.status === "critical" ? 503 : 200, report);
    }
    if (req.method === "GET" && url.pathname === "/api/v1/council/investment-cockpit") {
      res.setHeader("cache-control", "no-store");
      return json(res, 200, buildCouncilInvestmentSnapshot(await service.getNewsletterAnalyses(500)));
    }
    if (req.method === "GET" && url.pathname === "/api/v1/council/portfolio") {
      res.setHeader("cache-control", "no-store");
      return json(res, 200, buildCouncilPortfolioSnapshot(
        await service.getDashboardAssets(false),
        service.getDashboardCryptoAnalysis()
      ));
    }
    if (req.method === "GET" && url.pathname === "/callbacks/enable-banking") {
      const code = url.searchParams.get("code") ?? "";
      const state = url.searchParams.get("state") ?? "";
      await service.completeEnableBanking(code, state);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end("<!doctype html><meta charset=utf-8><title>FinanceSync</title><p>Bankverbindung wurde bestätigt. Dieses Fenster kann geschlossen werden.</p>");
    }
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", ...securityHeaders });
      return res.end(renderUi(config.publicBaseUrl));
    }
    if (req.method === "GET" && url.pathname === "/assets/app.js") {
      res.writeHead(200, {
        "content-type": "text/javascript; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff"
      });
      return res.end(financeHubClient);
    }
    if (req.method === "GET" && url.pathname === "/assets/app.css") {
      res.writeHead(200, {
        "content-type": "text/css; charset=utf-8",
        "cache-control": "public, max-age=31536000, immutable",
        "x-content-type-options": "nosniff"
      });
      return res.end(financeHubStyles);
    }
    if (req.method === "GET" && url.pathname === "/assets/finance-hub-mark.png") {
      res.writeHead(200, {
        "content-type": "image/png",
        "cache-control": "public, max-age=31536000, immutable"
      });
      return res.end(financeHubMark);
    }
    if (!authorized(req)) return json(res, 401, { error: "Nicht autorisiert" });
    if (req.method === "GET" && url.pathname === "/api/pension-documents/revisions") {
      return json(res, 200, { revisions: service.listPensionRevisions() });
    }
    if (req.method === "POST" && url.pathname === "/api/pension-documents/previews") {
      if (!sameOriginMutation(req)) return json(res, 403, { error: "Ungültiger Anfrageursprung" });
      if (!consumePensionRate(req)) return json(res, 429, { error: "Zu viele Uploadversuche; bitte später erneut versuchen" });
      if (pensionParserBusy) return json(res, 429, { error: "Eine Dokumentprüfung läuft bereits" });
      pensionParserBusy = true;
      let uploaded: Awaited<ReturnType<typeof receivePensionUpload>> | undefined;
      try {
        uploaded = await receivePensionUpload(req);
        const extracted = await extractPensionDocument(uploaded.path, uploaded.mediaType, uploaded.workDir);
        const fields = parseDrvPensionPages(extracted.pages);
        const duplicate = db.pensionRevisionByHash(uploaded.hash);
        return json(res, 200, pensionPreviews.create({
          documentHash: uploaded.hash,
          mediaType: uploaded.mediaType,
          pageCount: extracted.pageCount,
          sizeBytes: uploaded.sizeBytes,
          fields,
          duplicate
        }));
      } catch (error) {
        throw pensionFailure(error);
      } finally {
        uploaded?.cleanup();
        pensionParserBusy = false;
      }
    }
    const pensionPreview = /^\/api\/pension-documents\/previews\/([0-9a-f-]{36})$/.exec(url.pathname);
    if (req.method === "GET" && pensionPreview) {
      try { return json(res, 200, pensionPreviews.get(pensionPreview[1])); }
      catch (error) { throw pensionFailure(error); }
    }
    const pensionField = /^\/api\/pension-documents\/previews\/([0-9a-f-]{36})\/fields\/([A-Za-z]+)$/.exec(url.pathname);
    if (req.method === "PATCH" && pensionField) {
      if (!sameOriginMutation(req)) return json(res, 403, { error: "Ungültiger Anfrageursprung" });
      const payload = await body(req, 4096).catch(() => { throw new FinanceServiceError("Ungültiger Feldwert", 400); }) as { value?: string };
      try { return json(res, 200, pensionPreviews.updateField(pensionField[1], pensionField[2] as PensionFieldKey, String(payload.value ?? ""))); }
      catch (error) { throw pensionFailure(error); }
    }
    const pensionFirePreview = /^\/api\/pension-documents\/previews\/([0-9a-f-]{36})\/fire-preview$/.exec(url.pathname);
    if (req.method === "POST" && pensionFirePreview) {
      if (!sameOriginMutation(req)) return json(res, 403, { error: "Ungültiger Anfrageursprung" });
      try {
        const preview = pensionPreviews.markReviewed(pensionFirePreview[1]);
        return json(res, 200, { preview, ...(await service.previewPensionFire(preview)) });
      } catch (error) { throw error instanceof FinanceServiceError ? error : pensionFailure(error); }
    }
    const pensionConfirm = /^\/api\/pension-documents\/previews\/([0-9a-f-]{36})\/confirm$/.exec(url.pathname);
    if (req.method === "POST" && pensionConfirm) {
      if (!sameOriginMutation(req)) return json(res, 403, { error: "Ungültiger Anfrageursprung" });
      const payload = await body(req, 1024).catch(() => ({})) as { confirmed?: boolean };
      if (payload.confirmed !== true) return json(res, 409, { error: "Explizite Bestätigung fehlt" });
      try {
        const preview = pensionPreviews.get(pensionConfirm[1]);
        const result = await service.confirmPensionPreview(preview);
        pensionPreviews.consume(pensionConfirm[1]);
        return json(res, result.created ? 201 : 200, result);
      } catch (error) { throw error instanceof FinanceServiceError ? error : pensionFailure(error); }
    }
    if (req.method === "DELETE" && pensionPreview) {
      if (!sameOriginMutation(req)) return json(res, 403, { error: "Ungültiger Anfrageursprung" });
      pensionPreviews.consume(pensionPreview[1]);
      return json(res, 200, { ok: true });
    }
    if (req.method === "GET" && url.pathname === "/api/dashboard/review") {
      return json(res, 200, await service.getDashboardReview(
        url.searchParams.get("refresh") === "1",
        Number(url.searchParams.get("months") ?? 6)
      ));
    }
    if (req.method === "PUT" && url.pathname === "/api/dashboard/review/transaction") {
      const payload = await body(req, 8192).catch(() => {
        throw new FinanceServiceError("Ungültige Prüfanfrage", 400);
      }) as { lineId?: string; categoryKey?: string; payeeName?: string; aliasTo?: string };
      return json(res, 200, await service.applyReviewTransaction({
        lineId: String(payload.lineId ?? ""),
        categoryKey: payload.categoryKey,
        payeeName: payload.payeeName,
        aliasTo: payload.aliasTo
      }));
    }
    if (req.method === "PUT" && url.pathname === "/api/dashboard/review/merchant-alias") {
      const payload = await body(req, 4096).catch(() => {
        throw new FinanceServiceError("Ungültiger Händleralias", 400);
      }) as { fromKey?: string; toLabel?: string };
      return json(res, 200, await service.applyMerchantAlias(
        String(payload.fromKey ?? ""),
        String(payload.toLabel ?? "")
      ));
    }
    if (req.method === "GET" && url.pathname === "/api/dashboard/merchant-rules") {
      return json(res, 200, { rules: service.listMerchantRuleBook() });
    }
    if (req.method === "PUT" && url.pathname === "/api/dashboard/merchant-rules") {
      const payload = await body(req, 4096).catch(() => {
        throw new FinanceServiceError("Ungültige Händlerregel", 400);
      }) as { pattern?: string; label?: string };
      return json(res, 200, service.saveMerchantRule(String(payload.pattern ?? ""), String(payload.label ?? "")));
    }
    const ruleDelete = /^\/api\/dashboard\/merchant-rules\/(.+)$/.exec(url.pathname);
    if (req.method === "DELETE" && ruleDelete) {
      return json(res, 200, service.deleteMerchantRule(decodeURIComponent(ruleDelete[1])));
    }
    if (req.method === "GET" && url.pathname === "/api/dashboard/events") {
      return json(res, 200, { events: service.listLifeEvents() });
    }
    if (req.method === "PUT" && url.pathname === "/api/dashboard/events") {
      const payload = await body(req, 4096).catch(() => {
        throw new FinanceServiceError("Ungültiges Ereignis", 400);
      }) as { name?: string; startMonth?: string; monthlyChangeMinor?: number };
      return json(res, 200, service.saveLifeEvent(
        String(payload.name ?? ""),
        String(payload.startMonth ?? ""),
        Number(payload.monthlyChangeMinor ?? 0)
      ));
    }
    const eventDelete = /^\/api\/dashboard\/events\/(event-[a-f0-9]{16})$/.exec(url.pathname);
    if (req.method === "DELETE" && eventDelete) {
      return json(res, 200, service.deleteLifeEvent(eventDelete[1]));
    }
    if (req.method === "PUT" && url.pathname === "/api/dashboard/review/close") {
      const payload = await body(req, 4096).catch(() => {
        throw new FinanceServiceError("Ungültiger Monatsabschluss", 400);
      }) as { month?: string; note?: string; payrollReviewed?: boolean; cardReviewed?: boolean };
      return json(res, 200, await service.closeReviewMonth(
        String(payload.month ?? ""),
        String(payload.note ?? ""),
        { payrollReviewed: payload.payrollReviewed, cardReviewed: payload.cardReviewed }
      ));
    }
    if (req.method === "GET" && url.pathname === "/api/dashboard/scenarios/compare") {
      return json(res, 200, await service.compareScenarios(
        String(url.searchParams.get("left") ?? ""),
        String(url.searchParams.get("right") ?? "")
      ));
    }
    if (req.method === "POST" && url.pathname === "/api/miles-more/preview") {
      const payload = await body(req, 200_000).catch(() => {
        throw new FinanceServiceError("Ungültige Abrechnung", 400);
      }) as { text?: string; statementDate?: string };
      return json(res, 200, await service.previewMilesMoreStatement(String(payload.text ?? ""), String(payload.statementDate ?? "")));
    }
    if (req.method === "POST" && url.pathname === "/api/miles-more/import") {
      const payload = await body(req, 200_000).catch(() => {
        throw new FinanceServiceError("Ungültige Abrechnung", 400);
      }) as { text?: string; statementDate?: string };
      return json(res, 200, await service.importMilesMoreStatement(String(payload.text ?? ""), String(payload.statementDate ?? "")));
    }
    if (req.method === "GET" && url.pathname === "/api/dashboard/scenarios") {
      return json(res, 200, { scenarios: service.listNamedScenarios() });
    }
    if (req.method === "PUT" && url.pathname === "/api/dashboard/scenarios") {
      const payload = await body(req, 8192).catch(() => {
        throw new FinanceServiceError("Ungültiges Szenario", 400);
      }) as { name?: string } & Record<string, unknown>;
      return json(res, 200, service.saveNamedScenario(String(payload.name ?? ""), payload as DecisionLabRequest));
    }
    const scenarioDelete = /^\/api\/dashboard\/scenarios\/(scenario-[a-f0-9]{16})$/.exec(url.pathname);
    if (req.method === "DELETE" && scenarioDelete) {
      return json(res, 200, service.deleteNamedScenario(scenarioDelete[1]));
    }
    if (req.method === "GET" && url.pathname === "/api/dashboard/overview") {
      const requestedMonths = Number(url.searchParams.get("months") ?? 4);
      const months = [4, 6, 12].includes(requestedMonths) ? requestedMonths : 4;
      const requestedOffset = Number(url.searchParams.get("offset") ?? 0);
      const offset = Number.isInteger(requestedOffset)
        ? Math.max(0, Math.min(120, requestedOffset))
        : 0;
      const requestedSpendingOffset = Number(url.searchParams.get("spendingOffset") ?? 0);
      const spendingOffset = Number.isInteger(requestedSpendingOffset)
        ? Math.max(0, Math.min(120, requestedSpendingOffset))
        : 0;
      return json(
        res,
        200,
        await service.getDashboardOverview(
          url.searchParams.get("refresh") === "1",
          { months, offset, spendingOffset }
        )
      );
    }
    if (req.method === "GET" && url.pathname === "/api/dashboard/wealth-history") {
      return json(
        res,
        200,
        await service.getDashboardWealthHistory(url.searchParams.get("refresh") === "1")
      );
    }
    if (req.method === "GET" && url.pathname === "/api/dashboard/investment-newsletters") {
      const requested = Number(url.searchParams.get("limit") ?? 100);
      const limit = Number.isSafeInteger(requested) ? Math.max(1, Math.min(500, requested)) : 100;
      return json(res, 200, await service.getNewsletterAnalyses(limit));
    }
    const newsletterState = /^\/api\/dashboard\/investment-newsletters\/([^/]+)\/state$/.exec(url.pathname);
    if (req.method === "PATCH" && newsletterState) {
      const payload = await body(req) as { state?: string };
      if (!new Set(["UNREVIEWED", "REVIEWED", "DISMISSED"]).has(String(payload.state))) {
        throw new FinanceServiceError("Ungültiger Prüfstatus", 400);
      }
      return json(res, 200, service.updateNewsletterAnalysisState(
        decodeURIComponent(newsletterState[1]),
        payload.state as "UNREVIEWED" | "REVIEWED" | "DISMISSED"
      ));
    }
    if (req.method === "GET" && url.pathname === "/api/dashboard/spending") {
      const requestedMonth = url.searchParams.get("month") ?? undefined;
      const month = requestedMonth && /^\d{4}-(0[1-9]|1[0-2])$/.test(requestedMonth)
        ? requestedMonth
        : undefined;
      const period = url.searchParams.get("period") ?? undefined;
      const quarter = url.searchParams.get("quarter") ?? undefined;
      const year = url.searchParams.get("year") ?? undefined;
      const sort = url.searchParams.get("sort") ?? undefined;
      const requestedPage = Number(url.searchParams.get("page") ?? 1);
      const page = Number.isInteger(requestedPage)
        ? Math.max(1, Math.min(100_000, requestedPage))
        : 1;
      const requestedPageSize = Number(url.searchParams.get("pageSize") ?? 20);
      const pageSize = [20, 50, 100].includes(requestedPageSize) ? requestedPageSize : 20;
      return json(
        res,
        200,
        await service.getDashboardSpending(url.searchParams.get("refresh") === "1", {
          month,
          period,
          quarter,
          year,
          sort: sort as import("./dashboard-spending.js").SpendingSort,
          category: (url.searchParams.get("category") ?? "").slice(0, 80),
          account: (url.searchParams.get("account") ?? "").slice(0, 80),
          search: (url.searchParams.get("search") ?? "").slice(0, 80),
          page,
          pageSize
        })
      );
    }
    if (req.method === "GET" && url.pathname === "/api/dashboard/assets") {
      return json(
        res,
        200,
        await service.getDashboardAssets(url.searchParams.get("refresh") === "1")
      );
    }
    if (req.method === "GET" && url.pathname === "/api/dashboard/analyses") {
      const periodYear = Number(url.searchParams.get("period") ?? "");
      const comparisonYear = Number(url.searchParams.get("comparison") ?? "");
      return json(
        res,
        200,
        await service.getDashboardAnalyses(url.searchParams.get("refresh") === "1", {
          periodYear: Number.isInteger(periodYear) ? periodYear : undefined,
          comparisonYear: Number.isInteger(comparisonYear) ? comparisonYear : undefined
        })
      );
    }
    if (req.method === "GET"
      && url.pathname === "/api/dashboard/analyses/savings-baseline") {
      return json(
        res,
        200,
        await service.getDashboardSavingsBaseline(url.searchParams.get("refresh") === "1")
      );
    }
    if (req.method === "GET"
      && url.pathname === "/api/dashboard/analyses/decision-lab") {
      const numberParam = (name: string): number | undefined => {
        const value = url.searchParams.get(name);
        if (value === null || value.trim() === "") return undefined;
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : undefined;
      };
      return json(
        res,
        200,
        await service.getDashboardDecisionLab(url.searchParams.get("refresh") === "1", {
          trendBasis: ["current-year", "ytd-plus-last-year"].includes(
            url.searchParams.get("trendBasis") ?? ""
          ) ? url.searchParams.get("trendBasis") as "current-year" | "ytd-plus-last-year" : undefined,
          realReturnBps: numberParam("realReturnBps"),
          monthlyChangeMinor: numberParam("monthlyChangeMinor"),
          oneTimeMinor: numberParam("oneTimeMinor"),
          fireTargetAge: numberParam("fireTargetAge"),
          fireActionKeys: (url.searchParams.get("fireActionKeys") ?? "")
            .split(",")
            .filter(Boolean),
          fireCategoryCuts: (url.searchParams.get("fireCategoryCuts") ?? "")
            .split(",")
            .filter(Boolean),
          fireOneTimeKeys: (url.searchParams.get("fireOneTimeKeys") ?? "")
            .split(",")
            .filter(Boolean)
        })
      );
    }
    if (req.method === "GET"
      && url.pathname === "/api/dashboard/analyses/crypto-position") {
      return json(res, 200, service.getDashboardCryptoAnalysis());
    }
    if (req.method === "GET"
      && url.pathname === "/api/dashboard/analyses/recurring-expenses") {
      return json(
        res,
        200,
        await service.getDashboardRecurringExpenses(
          url.searchParams.get("refresh") === "1",
          {
            rhythm: (url.searchParams.get("rhythm") ?? undefined) as never,
            review: (url.searchParams.get("review") ?? undefined) as never,
            classification: (url.searchParams.get("classification") ?? undefined) as never,
            confidence: (url.searchParams.get("confidence") ?? undefined) as never
          }
        )
      );
    }
    if (req.method === "GET"
      && url.pathname === "/api/dashboard/analyses/recurring-expenses/optimizations") {
      return json(
        res,
        200,
        await service.getDashboardRecurringExpenseOptimizations(
          url.searchParams.get("refresh") === "1"
        )
      );
    }
    const recurringDetailMatch = /^\/api\/dashboard\/analyses\/recurring-expenses\/(recurring-[a-f0-9]{18})$/
      .exec(url.pathname);
    if (req.method === "GET" && recurringDetailMatch) {
      return json(
        res,
        200,
        await service.getDashboardRecurringExpenseDetail(
          recurringDetailMatch[1],
          url.searchParams.get("refresh") === "1"
        )
      );
    }
    const recurringDecisionMatch = /^\/api\/decisions\/recurring-expenses\/(recurring-[a-f0-9]{18})$/
      .exec(url.pathname);
    if (req.method === "PUT" && recurringDecisionMatch) {
      const payload = await body(req, 4096).catch(() => {
        throw new FinanceServiceError("Ungültige Entscheidungsanfrage", 400);
      }) as {
        decision?: RecurringExpenseDecision;
        expectedEvidenceHash?: string;
      };
      return json(
        res,
        200,
        await service.setRecurringExpenseDecision(
          recurringDecisionMatch[1],
          String(payload.decision ?? "") as RecurringExpenseDecision,
          String(payload.expectedEvidenceHash ?? "")
        )
      );
    }
    const recurringOptimizationMatch = /^\/api\/decisions\/recurring-expenses\/(recurring-[a-f0-9]{18})\/optimization$/
      .exec(url.pathname);
    if (req.method === "PUT" && recurringOptimizationMatch) {
      const payload = await body(req, 4096).catch(() => {
        throw new FinanceServiceError("Ungültige Maßnahmenanfrage", 400);
      }) as {
        status?: RecurringExpenseOptimizationStatus;
        effectiveDate?: string | null;
        expectedAnnualSavingsMinor?: number | null;
        priority?: RecurringExpenseOptimizationPriority | null;
        expectedEvidenceHash?: string;
      };
      return json(
        res,
        200,
        await service.setRecurringExpenseOptimization(recurringOptimizationMatch[1], {
          status: String(payload.status ?? "") as RecurringExpenseOptimizationStatus,
          effectiveDate: payload.effectiveDate === null || typeof payload.effectiveDate === "string"
            ? payload.effectiveDate
            : null,
          expectedAnnualSavingsMinor: payload.expectedAnnualSavingsMinor === null
            || typeof payload.expectedAnnualSavingsMinor === "number"
            ? payload.expectedAnnualSavingsMinor
            : null,
          priority: payload.priority === null || typeof payload.priority === "string"
            ? payload.priority as RecurringExpenseOptimizationPriority | null
            : null,
          expectedEvidenceHash: String(payload.expectedEvidenceHash ?? "")
        })
      );
    }
    if (req.method === "GET" && url.pathname === "/api/dashboard/status") {
      const rows = db.listSources() as unknown as SourceStatusRow[];
      const manualValueDates = Object.fromEntries(
        config.sources
          .filter((source) => source.kind === "manual")
          .map((source) => [source.id, db.latestBalanceCapturedAt(source.id)])
      );
      return json(res, 200, buildDashboardStatus(
        rows,
        config,
        buildHealth(db, config),
        manualValueDates
      ));
    }
    if (req.method === "GET" && url.pathname === "/api/status") {
      return json(res, 200, { sources: db.listSources() });
    }
    if (req.method === "GET" && url.pathname === "/api/manual-workflow/sources") {
      return json(res, 200, { sources: manualPreviews.listSources(config) });
    }
    if (req.method === "POST" && url.pathname === "/api/manual-workflow/preview") {
      const payload = await body(req);
      const sourceId = String((payload as { sourceId?: string }).sourceId ?? "");
      const text = String((payload as { text?: string }).text ?? "");
      const source = service.getSource(sourceId);
      if (!source || source.kind !== "manual") {
        return json(res, 400, { error: "Manuelle Quelle nicht gefunden" });
      }
      const preview = manualPreviews.create(source, text, config);
      const stored = manualPreviews.take(preview.id);
      const bundle = manualSnapshotBundle(source, stored.snapshot);
      const snapshotState = db.manualSnapshotState(source.id, bundle);
      return json(res, 200, {
        ...preview,
        snapshotState,
        canConfirm: preview.ghostfolioReady && snapshotState !== "conflict"
      });
    }
    if (req.method === "POST" && url.pathname === "/api/manual-workflow/confirm") {
      const payload = await body(req);
      const previewId = String((payload as { previewId?: string }).previewId ?? "");
      const preview = manualPreviews.take(previewId);
      if (!preview.ghostfolioReady) {
        return json(res, 409, {
          error: "Ghostfolio-Ziel oder Wertpapierzuordnung ist unvollständig"
        });
      }
      const result = await service.importConfirmedManualSnapshot(
        preview.sourceId,
        preview.snapshot
      );
      if (result.state === "SUCCESS") manualPreviews.consume(previewId);
      return json(res, result.state === "SUCCESS" ? 200 : 409, result);
    }
    const syncMatch = /^\/api\/sync\/([^/]+)$/.exec(url.pathname);
    if (req.method === "POST" && syncMatch) {
      const result = await service.sync(decodeURIComponent(syncMatch[1]));
      return json(res, result.state === "ERROR" ? 500 : 200, result);
    }
    const authMatch = /^\/api\/enable-banking\/start\/([^/]+)$/.exec(url.pathname);
    if (req.method === "POST" && authMatch) {
      const result = await service.startEnableBanking(decodeURIComponent(authMatch[1]));
      return json(res, 200, result);
    }
    const dkbPreflightMatch = /^\/api\/dkb-fints\/preflight\/([^/]+)$/.exec(url.pathname);
    if (req.method === "POST" && dkbPreflightMatch) {
      const result = await service.preflightDkbFints(
        decodeURIComponent(dkbPreflightMatch[1])
      );
      return json(res, result.state === "ERROR" ? 400 : 200, result);
    }
    const dkbContinueMatch = /^\/api\/dkb-fints\/continue\/([^/]+)$/.exec(url.pathname);
    if (req.method === "POST" && dkbContinueMatch) {
      const payload = await body(req).catch(() => ({})) as { tan?: string };
      const result = await service.continueDkbFints(
        decodeURIComponent(dkbContinueMatch[1]),
        payload.tan ? String(payload.tan) : undefined
      );
      return json(res, result.state === "ERROR" ? 400 : 200, result);
    }
    if (req.method === "POST" && url.pathname === "/api/export") {
      exportAll(db, paths.archive);
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/api/reconcile") {
      const result = await service.reconcileInternalTransfers();
      return json(res, 200, { ok: true, ...result });
    }
    if (req.method === "POST" && url.pathname === "/api/manual-snapshot") {
      const payload = await body(req);
      const sourceId = String((payload as { sourceId?: string }).sourceId ?? "");
      const source = service.getSource(sourceId);
      if (!source || source.kind !== "manual") {
        return json(res, 400, { error: "Manuelle Quelle nicht gefunden" });
      }
      const bundle = manualSnapshotBundle(source, payload as never);
      const counts = importBundle(db, paths.archive, source.id, bundle);
      exportAll(db, paths.archive);
      return json(res, 200, { ok: true, counts });
    }
    if (req.method === "POST" && url.pathname === "/api/backup") {
      const target = join(paths.archive, "normalized", "finance-snapshot.sqlite");
      snapshotSqlite(db, target);
      return json(res, 200, { ok: true, target });
    }
    return json(res, 404, { error: "Nicht gefunden" });
  } catch (error) {
    return json(res, error instanceof FinanceServiceError ? error.status : 500, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(config.port, "0.0.0.0", () => {
  process.stdout.write(`FinanceSync lauscht auf Port ${config.port}\n`);
});

function shutdown(): void {
  clearInterval(scheduler);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
