import type {
  AppConfig,
  ImportBundle,
  RecurringExpenseDecision,
  RecurringExpenseOptimizationPriority,
  RecurringExpenseOptimizationStatus,
  SourceConfig,
  SyncResult
} from "./types.js";
import type { FinanceDatabase } from "./database.js";
import { join } from "node:path";
import { paths } from "./config.js";
import { archiveRaw } from "./archive.js";
import { snapshotSqlite } from "./backup.js";
import { fetchSolana } from "./connectors/solana.js";
import { fetchEnableBanking } from "./connectors/enable-banking.js";
import { fetchDkbCsv } from "./connectors/dkb-csv.js";
import {
  completeAuthorization,
  startAuthorization
} from "./connectors/enable-banking.js";
import { preflightInteractiveSource } from "./connectors/status-only.js";
import {
  continueDkbFints,
  dkbAccountIds,
  fetchDkbFints,
  preflightDkbFints,
  type DkbFintsOutcome
} from "./connectors/dkb-fints.js";
import { importBundle } from "./importer.js";
import { exportAll } from "./exporter.js";
import { pushToActual } from "./sinks/actual.js";
import {
  pushToGhostfolio,
  reconcileGhostfolioHoldings
} from "./sinks/ghostfolio.js";
import { manualSnapshotBundle, type ManualSnapshot } from "./connectors/manual.js";
import {
  findInternalTransferPairs,
  markInternalTransfers
} from "./reconcile.js";
import { linkActualTransfers } from "./sinks/actual-transfers.js";
import {
  buildDashboardOverview,
  readActualOverview,
  readInvestmentOverview,
  type DashboardOverview
} from "./dashboard-overview.js";
import {
  buildDashboardSpending,
  readActualSpendingRange,
  readActualSpendingMonth,
  type ActualSpendingRangeSnapshot,
  type ActualSpendingMonthSnapshot,
  type DashboardSpending,
  type SpendingQuery
} from "./dashboard-spending.js";
import {
  analysesRange,
  analysesSelection,
  buildDashboardAnalyses,
  type DashboardAnalyses
} from "./dashboard-analyses.js";
import {
  buildDashboardRecurringExpenseDetail,
  buildDashboardRecurringExpenses,
  buildDashboardRecurringExpenseOptimizations,
  recurringExpenseRange,
  recurringFingerprintVersion,
  type DashboardRecurringExpenseDetail,
  type DashboardRecurringExpenses,
  type DashboardRecurringExpenseOptimizations,
  type RecurringExpenseQuery
} from "./dashboard-recurring-expenses.js";
import {
  buildDashboardAssets,
  readGhostfolioAssets,
  type DashboardAssets
} from "./dashboard-assets.js";
import {
  buildDashboardCryptoAnalysis,
  type DashboardCryptoAnalysis
} from "./dashboard-crypto-analysis.js";
import {
  lastCompletedMonthEnd,
  readCoinGeckoSolPrice
} from "./dashboard-asset-comparison.js";
import {
  archiveGhostfolioMarketSnapshot,
  marketSnapshotDate
} from "./market-snapshots.js";
import {
  buildDashboardSavingsBaseline,
  readActualSavingsCashflow,
  type DashboardSavingsBaseline
} from "./dashboard-savings-baseline.js";

export class FinanceServiceError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export class FinanceService {
  private running = new Set<string>();
  private actualTail: Promise<void> = Promise.resolve();
  private reconcileTail: Promise<void> = Promise.resolve();
  private overviewCache = new Map<string, { expiresAt: number; value: DashboardOverview }>();
  private overviewLoading = new Map<string, Promise<DashboardOverview>>();
  private spendingCache = new Map<string, { expiresAt: number; value: ActualSpendingMonthSnapshot }>();
  private spendingLoading = new Map<string, Promise<ActualSpendingMonthSnapshot>>();
  private analysesCache = new Map<string, { expiresAt: number; value: DashboardAnalyses }>();
  private analysesLoading = new Map<string, Promise<DashboardAnalyses>>();
  private savingsBaselineCache?: { expiresAt: number; value: DashboardSavingsBaseline };
  private savingsBaselineLoading?: Promise<DashboardSavingsBaseline>;
  private recurringCache?: { expiresAt: number; value: ActualSpendingRangeSnapshot };
  private recurringLoading?: Promise<ActualSpendingRangeSnapshot>;
  private assetsCache?: { expiresAt: number; value: DashboardAssets };
  private assetsLoading?: Promise<DashboardAssets>;
  private marketArchiveLoading?: Promise<void>;
  private marketArchiveLastFailureAt = 0;

  constructor(readonly db: FinanceDatabase, readonly config: AppConfig) {
    for (const source of config.sources) {
      db.registerSource(source.id, source.kind, source.enabled);
    }
    exportAll(db, paths.archive);
  }

  getSource(id: string): SourceConfig | undefined {
    return this.config.sources.find((source) => source.id === id);
  }

  private async withActual<T>(operation: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.actualTail;
    this.actualTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  private async withReconcile<T>(operation: () => Promise<T>): Promise<T> {
    let release!: () => void;
    const previous = this.reconcileTail;
    this.reconcileTail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  }

  async getDashboardOverview(
    force = false,
    range: { months: number; offset: number; spendingOffset: number } = {
      months: 4,
      offset: 0,
      spendingOffset: 0
    }
  ): Promise<DashboardOverview> {
    const now = Date.now();
    const cacheKey = `${range.months}:${range.offset}:${range.spendingOffset}`;
    const cached = this.overviewCache.get(cacheKey);
    if (!force && cached && cached.expiresAt > now) {
      return cached.value;
    }
    const pending = this.overviewLoading.get(cacheKey);
    if (pending) return pending;
    const load = async (): Promise<DashboardOverview> => {
      const generatedAt = new Date();
      const comparisonDate = lastCompletedMonthEnd(generatedAt, this.config.timezone).effectiveDate;
      const [actual, investments, solPrice] = await Promise.allSettled([
        this.config.actual?.enabled
          ? this.withActual(() => readActualOverview(
              this.config.actual!,
              this.config.timezone,
              generatedAt,
              {
                months: range.months,
                offset: range.offset,
                spendingOffset: range.spendingOffset
              }
            ))
          : Promise.reject(new Error("Actual ist deaktiviert")),
        this.config.ghostfolio?.enabled
          ? readInvestmentOverview(this.config, this.db)
          : Promise.reject(new Error("Ghostfolio ist deaktiviert")),
        this.config.sources.some((source) => source.enabled && source.kind === "solana")
          ? readCoinGeckoSolPrice(comparisonDate)
          : Promise.reject(new Error("Solana ist deaktiviert"))
      ]);
      const value = buildDashboardOverview(
        this.db,
        this.config,
        actual,
        investments,
        generatedAt,
        solPrice
      );
      this.overviewCache.set(cacheKey, {
        expiresAt: Date.now() + 5 * 60_000,
        value
      });
      return value;
    };
    const loading = load();
    this.overviewLoading.set(cacheKey, loading);
    try {
      return await loading;
    } finally {
      this.overviewLoading.delete(cacheKey);
    }
  }

  async getDashboardSpending(
    force = false,
    request: SpendingQuery & { month?: string } = {}
  ): Promise<DashboardSpending> {
    if (!this.config.actual?.enabled) throw new Error("Actual ist deaktiviert");
    const cacheKey = request.month ?? "latest";
    const now = Date.now();
    let snapshot = this.spendingCache.get(cacheKey);
    if (force || !snapshot || snapshot.expiresAt <= now) {
      let loading = this.spendingLoading.get(cacheKey);
      if (!loading) {
        loading = this.withActual(() => readActualSpendingMonth(
          this.config.actual!,
          this.config.timezone,
          request.month
        ));
        this.spendingLoading.set(cacheKey, loading);
      }
      try {
        const value = await loading;
        snapshot = { expiresAt: Date.now() + 5 * 60_000, value };
        this.spendingCache.set(cacheKey, snapshot);
      } finally {
        this.spendingLoading.delete(cacheKey);
      }
    }
    return buildDashboardSpending(snapshot.value, request);
  }

  async getDashboardAssets(force = false): Promise<DashboardAssets> {
    const now = Date.now();
    if (!force && this.assetsCache && this.assetsCache.expiresAt > now) {
      return this.assetsCache.value;
    }
    if (this.assetsLoading) return this.assetsLoading;
    const load = async (): Promise<DashboardAssets> => {
      const generatedAt = new Date();
      const market = await Promise.allSettled([
        this.config.ghostfolio && Object.keys(this.config.ghostfolio.accountMap).length > 0
          ? readGhostfolioAssets(this.config.ghostfolio)
          : Promise.reject(new Error("Ghostfolio ist deaktiviert"))
      ]);
      const value = buildDashboardAssets(this.db, this.config, market[0], generatedAt);
      this.assetsCache = { expiresAt: Date.now() + 5 * 60_000, value };
      return value;
    };
    this.assetsLoading = load();
    try {
      return await this.assetsLoading;
    } finally {
      this.assetsLoading = undefined;
    }
  }

  async getDashboardAnalyses(
    force = false,
    request: { periodYear?: number; comparisonYear?: number } = {}
  ): Promise<DashboardAnalyses> {
    if (!this.config.actual?.enabled) throw new Error("Actual ist deaktiviert");
    const selected = analysesSelection(
      this.config,
      new Date(),
      request.periodYear,
      request.comparisonYear
    );
    const cacheKey = `${selected.periodYear}:${selected.comparisonYear}`;
    const cached = this.analysesCache.get(cacheKey);
    if (!force && cached && cached.expiresAt > Date.now()) return cached.value;
    const pending = this.analysesLoading.get(cacheKey);
    if (pending) return pending;
    const load = async (): Promise<DashboardAnalyses> => {
      const generatedAt = new Date();
      const currentYear = Number(new Intl.DateTimeFormat("en-CA", {
        timeZone: this.config.timezone,
        year: "numeric"
      }).format(generatedAt));
      const range = analysesRange(selected, currentYear);
      const snapshot = await this.withActual(() => readActualSpendingRange(
        this.config.actual!,
        range.startDate,
        range.endDate,
        generatedAt
      ));
      const value = buildDashboardAnalyses(
        snapshot,
        this.config,
        selected.periodYear,
        selected.comparisonYear,
        generatedAt
      );
      this.analysesCache.set(cacheKey, { expiresAt: Date.now() + 5 * 60_000, value });
      return value;
    };
    const loading = load();
    this.analysesLoading.set(cacheKey, loading);
    try {
      return await loading;
    } finally {
      this.analysesLoading.delete(cacheKey);
    }
  }

  async getDashboardSavingsBaseline(force = false): Promise<DashboardSavingsBaseline> {
    if (!this.config.actual?.enabled) throw new Error("Actual ist deaktiviert");
    if (!force && this.savingsBaselineCache
      && this.savingsBaselineCache.expiresAt > Date.now()) {
      return this.savingsBaselineCache.value;
    }
    if (this.savingsBaselineLoading) return this.savingsBaselineLoading;
    const load = async (): Promise<DashboardSavingsBaseline> => {
      const generatedAt = new Date();
      const snapshot = await this.withActual(() => readActualSavingsCashflow(
        this.config.actual!,
        this.config.timezone,
        generatedAt
      ));
      const value = buildDashboardSavingsBaseline(snapshot, this.config, generatedAt);
      this.savingsBaselineCache = { expiresAt: Date.now() + 5 * 60_000, value };
      return value;
    };
    this.savingsBaselineLoading = load();
    try {
      return await this.savingsBaselineLoading;
    } finally {
      this.savingsBaselineLoading = undefined;
    }
  }

  getDashboardCryptoAnalysis(): DashboardCryptoAnalysis {
    try {
      return buildDashboardCryptoAnalysis(this.config);
    } catch (error) {
      throw new FinanceServiceError(
        error instanceof Error ? error.message : "Kryptoanalyse ist nicht verfügbar",
        503
      );
    }
  }

  private async getRecurringSnapshot(
    force = false,
    allowStale = true
  ): Promise<{ snapshot: ActualSpendingRangeSnapshot; stale: boolean }> {
    if (!this.config.actual?.enabled) throw new FinanceServiceError("Actual ist deaktiviert", 503);
    const now = new Date();
    if (!force && this.recurringCache && this.recurringCache.expiresAt > now.getTime()) {
      return { snapshot: this.recurringCache.value, stale: false };
    }
    let loading = this.recurringLoading;
    if (!loading) {
      const range = recurringExpenseRange(now, this.config.timezone);
      loading = this.withActual(() => readActualSpendingRange(
        this.config.actual!,
        range.startDate,
        range.endDate,
        now
      ));
      this.recurringLoading = loading;
    }
    try {
      const snapshot = await loading;
      this.recurringCache = { expiresAt: Date.now() + 5 * 60_000, value: snapshot };
      return { snapshot, stale: false };
    } catch (error) {
      if (allowStale && this.recurringCache) {
        return { snapshot: this.recurringCache.value, stale: true };
      }
      throw error;
    } finally {
      if (this.recurringLoading === loading) this.recurringLoading = undefined;
    }
  }

  async getDashboardRecurringExpenses(
    force = false,
    query: RecurringExpenseQuery = {}
  ): Promise<DashboardRecurringExpenses> {
    const { snapshot, stale } = await this.getRecurringSnapshot(force, true);
    return buildDashboardRecurringExpenses(
      snapshot,
      this.db.listRecurringExpenseDecisions(),
      query,
      { stale }
    );
  }

  async getDashboardRecurringExpenseDetail(
    candidateKey: string,
    force = false
  ): Promise<DashboardRecurringExpenseDetail> {
    const { snapshot, stale } = await this.getRecurringSnapshot(force, true);
    const detail = buildDashboardRecurringExpenseDetail(
      snapshot,
      this.db.listRecurringExpenseDecisions(),
      candidateKey,
      { stale }
    );
    if (!detail) throw new FinanceServiceError("Kandidat nicht gefunden", 404);
    return detail;
  }

  async getDashboardRecurringExpenseOptimizations(
    force = false
  ): Promise<DashboardRecurringExpenseOptimizations> {
    const { snapshot, stale } = await this.getRecurringSnapshot(force, true);
    return buildDashboardRecurringExpenseOptimizations(
      snapshot,
      this.db.listRecurringExpenseDecisions(),
      this.db.listRecurringExpenseOptimizations(),
      { stale }
    );
  }

  async setRecurringExpenseDecision(
    candidateKey: string,
    decision: RecurringExpenseDecision,
    expectedEvidenceHash: string
  ): Promise<DashboardRecurringExpenseDetail> {
    const allowed = new Set<RecurringExpenseDecision>([
      "GRUNDBEDARF", "GESTALTBAR", "VERMEIDBAR", "UNKLAR", "KEIN_KANDIDAT"
    ]);
    if (!allowed.has(decision)) throw new FinanceServiceError("Ungültige Entscheidung", 400);
    if (!/^evidence-[a-f0-9]{20}$/.test(expectedEvidenceHash)) {
      throw new FinanceServiceError("Ungültiger Beleg-Fingerprint", 400);
    }
    const { snapshot, stale } = await this.getRecurringSnapshot(false, false);
    if (stale) throw new FinanceServiceError("Entscheidungen benötigen aktuelle Actual-Daten", 503);
    const current = buildDashboardRecurringExpenseDetail(
      snapshot,
      this.db.listRecurringExpenseDecisions(),
      candidateKey
    );
    if (!current) throw new FinanceServiceError("Kandidat nicht gefunden", 404);
    if (current.candidate.evidence.evidenceHash !== expectedEvidenceHash) {
      throw new FinanceServiceError(
        "Die Beleglage hat sich geändert. Bitte Kandidat erneut laden.",
        409
      );
    }
    this.db.setRecurringExpenseDecision(
      candidateKey,
      decision,
      expectedEvidenceHash,
      recurringFingerprintVersion()
    );
    return buildDashboardRecurringExpenseDetail(
      snapshot,
      this.db.listRecurringExpenseDecisions(),
      candidateKey
    )!;
  }

  async setRecurringExpenseOptimization(
    candidateKey: string,
    payload: {
      status: RecurringExpenseOptimizationStatus;
      effectiveDate: string | null;
      expectedAnnualSavingsMinor: number | null;
      priority: RecurringExpenseOptimizationPriority | null;
      expectedEvidenceHash: string;
    }
  ): Promise<DashboardRecurringExpenseOptimizations> {
    const statuses = new Set<RecurringExpenseOptimizationStatus>([
      "PRUEFEN", "GEPLANT", "GEKUENDIGT", "BEIBEHALTEN"
    ]);
    const priorities = new Set<RecurringExpenseOptimizationPriority>([
      "HOCH", "MITTEL", "NIEDRIG"
    ]);
    if (!statuses.has(payload.status)) throw new FinanceServiceError("Ungültiger Maßnahmenstatus", 400);
    if (payload.priority !== null && !priorities.has(payload.priority)) {
      throw new FinanceServiceError("Ungültige Priorität", 400);
    }
    if (payload.effectiveDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(payload.effectiveDate)) {
      throw new FinanceServiceError("Ungültiges Enddatum", 400);
    }
    if (payload.expectedAnnualSavingsMinor !== null && (
      !Number.isSafeInteger(payload.expectedAnnualSavingsMinor)
      || payload.expectedAnnualSavingsMinor < 0
      || payload.expectedAnnualSavingsMinor > 100_000_000
    )) {
      throw new FinanceServiceError("Ungültige jährliche Entlastung", 400);
    }
    if (!/^evidence-[a-f0-9]{20}$/.test(payload.expectedEvidenceHash)) {
      throw new FinanceServiceError("Ungültiger Beleg-Fingerprint", 400);
    }
    const { snapshot, stale } = await this.getRecurringSnapshot(false, false);
    if (stale) throw new FinanceServiceError("Maßnahmen benötigen aktuelle Actual-Daten", 503);
    const current = buildDashboardRecurringExpenseDetail(
      snapshot,
      this.db.listRecurringExpenseDecisions(),
      candidateKey
    );
    if (!current) throw new FinanceServiceError("Kandidat nicht gefunden", 404);
    if (current.candidate.evidence.evidenceHash !== payload.expectedEvidenceHash) {
      throw new FinanceServiceError("Die Beleglage hat sich geändert. Bitte Liste neu laden.", 409);
    }
    if (current.candidate.classification.confidence !== "nutzerbestaetigt"
      || current.candidate.classification.value === "GRUNDBEDARF") {
      throw new FinanceServiceError("Nur bestätigte optimierbare Ausgaben können geplant werden", 409);
    }
    this.db.setRecurringExpenseOptimization(
      candidateKey,
      payload.expectedEvidenceHash,
      payload.status,
      payload.effectiveDate,
      payload.expectedAnnualSavingsMinor,
      payload.priority
    );
    return buildDashboardRecurringExpenseOptimizations(
      snapshot,
      this.db.listRecurringExpenseDecisions(),
      this.db.listRecurringExpenseOptimizations()
    );
  }

  private async importSourceBundle(
    source: SourceConfig,
    bundle: ImportBundle
  ): Promise<Record<string, number>> {
    const counts = importBundle(this.db, paths.archive, source.id, bundle);
    if (this.config.actual?.enabled) {
      counts.actual = await this.withActual(() =>
        pushToActual(this.config.actual!, bundle.transactions ?? [])
      );
    }
    const publishDkbHoldings = source.kind !== "dkb-fints"
      || source.settings?.publishToGhostfolio === true;
    if (this.config.ghostfolio?.enabled && publishDkbHoldings) {
      counts.ghostfolio = await pushToGhostfolio(
        this.config.ghostfolio,
        bundle.activities ?? []
      );
      const capturedAtByAccount = new Map<string, string>();
      for (const item of [...(bundle.holdings ?? []), ...(bundle.balances ?? [])]) {
        const current = capturedAtByAccount.get(item.accountId);
        if (!current || item.capturedAt > current) {
          capturedAtByAccount.set(item.accountId, item.capturedAt);
        }
      }
      const dkbFallbackCapturedAt = [...capturedAtByAccount.values()]
        .sort()
        .at(-1) ?? new Date().toISOString();
      counts.ghostfolioHoldings = await reconcileGhostfolioHoldings(
        this.config.ghostfolio,
        bundle.holdings ?? [],
        source.kind === "dkb-fints"
          ? "Reconstructed DKB position adjustment by FinanceSync; not tax cost basis"
          : "Reconstructed wallet position adjustment by FinanceSync; not tax cost basis",
        source.kind === "dkb-fints"
          ? dkbAccountIds(source).map((accountId) => ({
              accountId,
              capturedAt: capturedAtByAccount.get(accountId) ?? dkbFallbackCapturedAt
            }))
          : []
      );
    }
    if ((bundle.transactions?.length ?? 0) > 0) {
      const reconciled = await this.reconcileInternalTransfers();
      counts.transfers = reconciled.counts?.transfers ?? 0;
    }
    exportAll(this.db, paths.archive);
    return counts;
  }

  private storeDkbOutcome(id: string, outcome: DkbFintsOutcome): void {
    if (outcome.state === "WAITING_FOR_USER") {
      this.db.setSetting(`dkb-fints:${id}:continuation`, JSON.stringify(outcome.continuation));
    } else if (outcome.clientData) {
      this.db.setSetting(`dkb-fints:${id}:client`, outcome.clientData);
      this.db.setSetting(`dkb-fints:${id}:continuation`, "");
    }
  }

  async reconcileInternalTransfers(): Promise<SyncResult> {
    return this.withReconcile<SyncResult>(async () => {
      const owners = Array.from(new Set(
        this.config.sources.flatMap((source) => source.owners ?? [])
      ));
      const pairs = findInternalTransferPairs(this.db, owners);
      if (pairs.length === 0) {
        return {
          state: "SUCCESS",
          message: "Keine neuen eindeutigen internen Überträge",
          counts: { transfers: 0, actualTransfers: 0 }
        };
      }
      let actual = 0;
      if (this.config.actual?.enabled) {
        const actualPairs = pairs.filter((pair) =>
          this.config.actual!.accountMap[pair.left.accountId]
          && this.config.actual!.accountMap[pair.right.accountId]
        );
        actual = await this.withActual(() =>
          linkActualTransfers(this.config.actual!, actualPairs)
        );
      }
      const transfers = markInternalTransfers(this.db, pairs);
      exportAll(this.db, paths.archive);
      return {
        state: "SUCCESS",
        message: `${transfers} eindeutige interne Überträge verknüpft`,
        counts: { transfers, actualTransfers: actual }
      };
    });
  }

  async sync(id: string): Promise<SyncResult> {
    const source = this.getSource(id);
    if (!source) return { state: "ERROR", message: "Unbekannte Quelle" };
    if (!source.enabled) return { state: "DISABLED", message: "Quelle ist deaktiviert" };
    if (this.running.has(id)) return { state: "RUNNING", message: "Abruf läuft bereits" };
    this.running.add(id);
    const runId = this.db.beginRun(id);
    try {
      let bundle: ImportBundle;
      if (source.kind === "solana") {
        bundle = await fetchSolana(source);
      } else if (source.kind === "dkb-csv") {
        bundle = fetchDkbCsv(source, paths.inbox);
      } else if (source.kind === "enable-banking") {
        bundle = await fetchEnableBanking(
          source,
          this.db.getSetting(`enable-banking:${source.id}:session`)
        );
      } else if (source.kind === "dkb-fints") {
        const outcome = await fetchDkbFints(
          source,
          this.db.getSetting(`dkb-fints:${source.id}:client`)
        );
        this.storeDkbOutcome(source.id, outcome);
        if (outcome.state === "WAITING_FOR_USER") {
          this.db.finishRun(runId, id, outcome.state, outcome.message);
          return {
            state: outcome.state,
            message: outcome.message,
            challenge: outcome.challenge,
            decoupled: outcome.decoupled
          };
        }
        bundle = outcome.bundle;
      } else if (source.kind === "comdirect") {
        const result = preflightInteractiveSource(source);
        this.db.finishRun(runId, id, result.state, result.message);
        return result;
      } else {
        const result: SyncResult = {
          state: "WAITING_FOR_USER",
          message: "Werteingabe oder neues Dokument erforderlich"
        };
        this.db.finishRun(runId, id, result.state, result.message);
        return result;
      }
      const counts = await this.importSourceBundle(source, bundle);
      const message = `Abruf erfolgreich; ${Object.values(counts).reduce((a, b) => a + b, 0)} neue Datensätze`;
      this.db.finishRun(runId, id, "SUCCESS", message, counts);
      return { state: "SUCCESS", message, counts };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const waiting = requiresUserAction(message);
      const state = waiting ? "WAITING_FOR_USER" : "ERROR";
      this.db.finishRun(runId, id, state, message);
      return { state, message };
    } finally {
      this.running.delete(id);
    }
  }

  async preflightDkbFints(id: string): Promise<SyncResult> {
    const source = this.getSource(id);
    if (!source || source.kind !== "dkb-fints") {
      return { state: "ERROR", message: "DKB-FinTS-Quelle nicht gefunden" };
    }
    return preflightDkbFints(source);
  }

  async continueDkbFints(id: string, tan?: string): Promise<SyncResult> {
    const source = this.getSource(id);
    if (!source || source.kind !== "dkb-fints") {
      return { state: "ERROR", message: "DKB-FinTS-Quelle nicht gefunden" };
    }
    if (!source.enabled) return { state: "DISABLED", message: "Quelle ist deaktiviert" };
    if (this.running.has(id)) return { state: "RUNNING", message: "Abruf läuft bereits" };
    const stored = this.db.getSetting(`dkb-fints:${id}:continuation`);
    if (!stored) return { state: "ERROR", message: "Keine offene DKB-Freigabe vorhanden" };
    this.running.add(id);
    const runId = this.db.beginRun(id);
    try {
      const outcome = await continueDkbFints(
        source,
        JSON.parse(stored) as Record<string, unknown>,
        tan
      );
      this.storeDkbOutcome(id, outcome);
      if (outcome.state === "WAITING_FOR_USER") {
        this.db.finishRun(runId, id, outcome.state, outcome.message);
        return {
          state: outcome.state,
          message: outcome.message,
          challenge: outcome.challenge,
          decoupled: outcome.decoupled
        };
      }
      const counts = await this.importSourceBundle(source, outcome.bundle);
      const message = `DKB-FinTS-Abruf erfolgreich; ${counts.holdings ?? 0} neue Positionen`;
      this.db.finishRun(runId, id, "SUCCESS", message, counts);
      return { state: "SUCCESS", message, counts };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const waiting = requiresUserAction(message);
      const state = waiting ? "WAITING_FOR_USER" : "ERROR";
      this.db.finishRun(runId, id, state, message);
      return { state, message };
    } finally {
      this.running.delete(id);
    }
  }

  async importConfirmedManualSnapshot(
    id: string,
    snapshot: ManualSnapshot
  ): Promise<SyncResult & { snapshotState?: "new" | "equivalent" }> {
    const source = this.getSource(id);
    if (!source || source.kind !== "manual") {
      return { state: "ERROR", message: "Manuelle Quelle nicht gefunden" };
    }
    if (this.running.has(id)) {
      return { state: "RUNNING", message: "Für diese Quelle läuft bereits ein Vorgang" };
    }
    this.running.add(id);
    const runId = this.db.beginRun(id);
    try {
      const bundle = manualSnapshotBundle(source, snapshot);
      const snapshotState = this.db.manualSnapshotState(id, bundle);
      if (snapshotState === "conflict") {
        throw new Error(
          "Für dieses Stichtagsdatum existiert bereits ein abweichender Stand"
        );
      }
      const backupName = `finance-before-manual-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`;
      snapshotSqlite(this.db, join(paths.archive, "normalized", "snapshots", backupName));
      let counts: Record<string, number>;
      if (snapshotState === "equivalent") {
        archiveRaw(this.db, paths.archive, id, bundle.raw, bundle.rawMediaType);
        counts = { transactions: 0, balances: 0, holdings: 0, activities: 0 };
      } else {
        counts = importBundle(this.db, paths.archive, id, bundle);
      }
      if (this.config.ghostfolio?.enabled) {
        counts.ghostfolioHoldings = await reconcileGhostfolioHoldings(
          this.config.ghostfolio,
          bundle.holdings ?? [],
          "Reconstructed confirmed pension position adjustment by FinanceSync; not tax cost basis"
        );
      }
      exportAll(this.db, paths.archive);
      const message = snapshotState === "equivalent"
        ? `Stand war bereits vorhanden; Ghostfolio-Abgleich abgeschlossen`
        : `Bestätigter Stand übernommen; ${counts.balances} Gesamtwert und ${counts.holdings} Positionen neu`;
      this.db.finishRun(runId, id, "SUCCESS", message, counts);
      return { state: "SUCCESS", message, counts, snapshotState };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.db.finishRun(runId, id, "ERROR", message);
      return { state: "ERROR", message };
    } finally {
      this.running.delete(id);
    }
  }

  startScheduler(): NodeJS.Timeout {
    const tick = async () => {
      const statusById = new Map(
        this.db.listSources().map((row) => [String(row.id), row])
      );
      for (const source of this.config.sources) {
        if (!source.enabled || this.running.has(source.id)) continue;
        const last = statusById.get(source.id)?.last_attempt_at;
        const hours = source.scheduleHours ?? (source.kind === "solana" ? 6 : 24);
        if (!last || Date.now() - new Date(String(last)).getTime() >= hours * 3_600_000) {
          void this.sync(source.id);
        }
      }
      void this.archiveDailyMarketValues();
    };
    void tick();
    return setInterval(() => void tick(), 60_000);
  }

  private async archiveDailyMarketValues(): Promise<void> {
    if (!this.config.ghostfolio?.enabled
      || Object.keys(this.config.ghostfolio.accountMap).length === 0) return;
    const today = marketSnapshotDate(new Date(), this.config.timezone);
    if (this.db.latestAssetMarketSnapshotDate() === today) return;
    if (this.marketArchiveLoading) return this.marketArchiveLoading;
    if (Date.now() - this.marketArchiveLastFailureAt < 15 * 60_000) return;
    const load = async (): Promise<void> => {
      try {
        const snapshot = await readGhostfolioAssets(this.config.ghostfolio!);
        const result = archiveGhostfolioMarketSnapshot(
          this.db,
          snapshot,
          this.config.timezone,
          new Date(),
          Object.keys(this.config.ghostfolio!.accountMap)
        );
        this.db.setSetting("ghostfolio-market-archive:last-success", result.valuationDate);
        this.db.setSetting("ghostfolio-market-archive:last-error", "");
      } catch (error) {
        this.marketArchiveLastFailureAt = Date.now();
        this.db.setSetting(
          "ghostfolio-market-archive:last-error",
          error instanceof Error ? error.message.slice(0, 240) : "Unbekannter Fehler"
        );
      }
    };
    this.marketArchiveLoading = load();
    try {
      await this.marketArchiveLoading;
    } finally {
      this.marketArchiveLoading = undefined;
    }
  }

  async startEnableBanking(id: string): Promise<{ url: string }> {
    const source = this.getSource(id);
    if (!source || source.kind !== "enable-banking") {
      throw new Error("Enable-Banking-Quelle nicht gefunden");
    }
    if (!this.config.publicBaseUrl) throw new Error("publicBaseUrl fehlt");
    const redirectUrl = new URL("/callbacks/enable-banking", this.config.publicBaseUrl);
    const auth = await startAuthorization(source, redirectUrl.toString());
    this.db.setSetting(`enable-banking:${id}:state`, auth.state);
    this.db.setSetting(`enable-banking:${id}:consent-expires`, auth.validUntil);
    return { url: auth.url };
  }

  async completeEnableBanking(code: string, state: string): Promise<string> {
    const matched = this.config.sources.find(
      (item) => item.kind === "enable-banking"
        && this.db.getSetting(`enable-banking:${item.id}:state`) === state
    );
    const id = matched?.id ?? "";
    const source = this.getSource(id);
    if (!source || source.kind !== "enable-banking") {
      throw new Error("Ungültiger OAuth-State");
    }
    const expected = this.db.getSetting(`enable-banking:${id}:state`);
    if (!expected || expected !== state) throw new Error("Ungültiger OAuth-State");
    const completed = await completeAuthorization(source, code);
    this.db.setSetting(`enable-banking:${id}:session`, completed.sessionId);
    this.db.setSetting(`enable-banking:${id}:state`, "");
    return id;
  }
}

export function requiresUserAction(message: string): boolean {
  return /Secret|Zustimmung|Freigabe|fehlt|(?:^|\W)(?:TAN|SCA)(?:\W|$)/i.test(message);
}
