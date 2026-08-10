import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { loadConfig, paths, readSecret } from "./config.js";
import { FinanceDatabase } from "./database.js";
import { FinanceService } from "./service.js";
import { exportAll } from "./exporter.js";
import { manualSnapshotBundle } from "./connectors/manual.js";
import { importBundle } from "./importer.js";
import { snapshotSqlite } from "./backup.js";
import { renderUi } from "./ui.js";
import { buildHealth } from "./health.js";
import { ManualPreviewStore } from "./manual-workflow.js";
import { buildDashboardStatus, type SourceStatusRow } from "./dashboard-status.js";

mkdirSync(paths.data, { recursive: true });
mkdirSync(paths.archive, { recursive: true });
mkdirSync(paths.inbox, { recursive: true });
const config = loadConfig();
const db = new FinanceDatabase(join(paths.data, "finance.sqlite"));
const service = new FinanceService(db, config);
const scheduler = service.startScheduler();
const manualPreviews = new ManualPreviewStore();
const financeHubMark = readFileSync(new URL("../assets/finance-hub-mark.png", import.meta.url));

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, (_, value) => typeof value === "bigint" ? value.toString() : value));
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
    if (req.method === "GET" && url.pathname === "/callbacks/enable-banking") {
      const code = url.searchParams.get("code") ?? "";
      const state = url.searchParams.get("state") ?? "";
      await service.completeEnableBanking(code, state);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end("<!doctype html><meta charset=utf-8><title>FinanceSync</title><p>Bankverbindung wurde bestätigt. Dieses Fenster kann geschlossen werden.</p>");
    }
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(renderUi());
    }
    if (req.method === "GET" && url.pathname === "/assets/finance-hub-mark.png") {
      res.writeHead(200, {
        "content-type": "image/png",
        "cache-control": "public, max-age=31536000, immutable"
      });
      return res.end(financeHubMark);
    }
    if (!authorized(req)) return json(res, 401, { error: "Nicht autorisiert" });
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
    return json(res, 500, {
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
