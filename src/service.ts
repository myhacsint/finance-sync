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
import { paths, readSecret } from "./config.js";
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
  type DashboardOverview
} from "./dashboard-overview.js";
import {
  buildDashboardSpending,
  readActualSpendingRange,
  readActualSpendingMonth,
  reviewWindowSelection,
  spendingPeriodSelection,
  type ActualSpendingRangeSnapshot,
  type ActualSpendingMonthSnapshot,
  type DashboardSpending,
  type SpendingPeriodRequest,
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
import {
  buildDashboardDecisionLab,
  type DashboardDecisionLab,
  type DecisionLabRequest
} from "./dashboard-decision-lab.js";
import {
  applyMerchantAliases,
  buildDashboardReview,
  resolveReviewCategory,
  updateActualReviewTransaction,
  type DashboardReview
} from "./dashboard-review.js";
import { resolveFireAssumptions, type FireAssumptions } from "./fire-assumptions.js";
import type { PensionPreviewSummary } from "./pension-document-types.js";
import {
  createConfirmedPensionRevision,
  pensionAssumptionsFromFields,
  pensionImpact
} from "./pension-revisions.js";
import type { StoredSutorPreview } from "./sutor-document-types.js";
import { createConfirmedSutorRevision } from "./sutor-revisions.js";
import { createNamedScenario } from "./named-scenarios.js";
import { createLifeEvent } from "./life-events.js";
import { compareNamedScenarios } from "./scenario-compare.js";
import { previewMilesMoreWithActual, importMilesMoreStatement } from "./miles-more-import.js";
import { DEFAULT_MERCHANT_RULES, merchantRuleBook } from "./merchant-rules.js";
import {
  readDashboardWealthHistory,
  type DashboardWealthHistory
} from "./dashboard-wealth-history.js";
import type { NewsletterAnalysis } from "./types.js";

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
  private reviewCache = new Map<string, { expiresAt: number; value: ActualSpendingRangeSnapshot }>();
  private reviewLoading = new Map<string, Promise<ActualSpendingRangeSnapshot>>();
  private analysesCache = new Map<string, { expiresAt: number; value: DashboardAnalyses }>();
  private analysesLoading = new Map<string, Promise<DashboardAnalyses>>();
  private savingsBaselineCache?: { expiresAt: number; value: DashboardSavingsBaseline };
  private savingsBaselineLoading?: Promise<DashboardSavingsBaseline>;
  private savingsHistoryCache?: { expiresAt: number; value: DashboardSavingsBaseline };
  private savingsHistoryLoading?: Promise<DashboardSavingsBaseline>;
  private recurringCache?: { expiresAt: number; value: ActualSpendingRangeSnapshot };
  private recurringLoading?: Promise<ActualSpendingRangeSnapshot>;
  private assetsCache?: { expiresAt: number; value: DashboardAssets };
  private assetsLoading?: Promise<DashboardAssets>;
  private wealthHistoryCache?: { expiresAt: number; value: DashboardWealthHistory };
  private wealthHistoryLoading?: Promise<DashboardWealthHistory>;
  private marketArchiveLoading?: Promise<void>;
  private marketArchiveLastFailureAt = 0;
  private newsletterPriceCache?: { expiresAt: number; value: Array<{ symbol: string; name: string; priceMinor: number; currency: string; capturedAt?: string; source?: string }> };

  constructor(readonly db: FinanceDatabase, readonly config: AppConfig) {
    for (const source of config.sources) {
      db.registerSource(source.id, source.kind, source.enabled);
    }
    exportAll(db, paths.archive);
  }

  getSource(id: string): SourceConfig | undefined {
    return this.config.sources.find((source) => source.id === id);
  }

  async getNewsletterAnalyses(limit = 100): Promise<{
    generatedAt: string;
    state: "empty" | "ready";
    items: NewsletterAnalysis[];
    prices: Array<{ symbol: string; name: string; priceMinor: number; currency: string; capturedAt?: string }>;
  }> {
    const items = this.db.listNewsletterAnalyses(limit);
    let prices: Array<{ symbol: string; name: string; priceMinor: number; currency: string; capturedAt?: string; source?: string }> = [];
    if (this.config.ghostfolio) {
      try {
        const snapshot = await readGhostfolioAssets(this.config.ghostfolio, {
          holdingAccountIds: Object.keys(this.config.ghostfolio.accountMap)
        });
        prices = Object.values(snapshot.holdingsByAccount ?? {}).flat().map((holding) => ({
          symbol: holding.symbol,
          name: holding.label,
          priceMinor: holding.marketPriceMinor,
          currency: holding.currency,
          capturedAt: snapshot.capturedAt,
          source: "Ghostfolio"
        }));
        if (!this.newsletterPriceCache || this.newsletterPriceCache.expiresAt < Date.now()) {
          const { readGhostfolioNewsletterQuotes } = await import("./newsletter-quotes.js");
          const quotes = await readGhostfolioNewsletterQuotes(this.config.ghostfolio, items);
          this.newsletterPriceCache = { expiresAt: Date.now() + 15 * 60_000, value: quotes };
        }
        prices.push(...this.newsletterPriceCache.value);
      } catch {
        // The analysis remains usable when optional live quote context is unavailable.
      }
    }
    return {
      generatedAt: new Date().toISOString(),
      state: items.length === 0 ? "empty" : "ready",
      items,
      prices
    };
  }

  updateNewsletterAnalysisState(messageId: string, state: "UNREVIEWED" | "REVIEWED" | "DISMISSED"): NewsletterAnalysis {
    const updated = this.db.updateNewsletterAnalysisState(messageId, state);
    if (!updated) throw new FinanceServiceError("Newsletter-Auswertung nicht gefunden", 404);
    return updated;
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
      const [actual, wealth, solPrice] = await Promise.allSettled([
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
        this.getDashboardAssets(force),
        this.config.sources.some((source) => source.enabled && source.kind === "solana")
          ? readCoinGeckoSolPrice(comparisonDate)
          : Promise.reject(new Error("Solana ist deaktiviert"))
      ]);
      const generatedForOverview = wealth.status === "fulfilled"
        ? new Date(wealth.value.generatedAt)
        : generatedAt;
      const value = buildDashboardOverview(
        this.db,
        this.config,
        actual,
        { status: "rejected", reason: new Error("Vermögensansicht nicht verfügbar") },
        generatedForOverview,
        solPrice,
        wealth.status === "fulfilled" ? wealth.value : undefined
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

  async getDashboardWealthHistory(force = false): Promise<DashboardWealthHistory> {
    if (!force && this.wealthHistoryCache && this.wealthHistoryCache.expiresAt > Date.now()) {
      return this.wealthHistoryCache.value;
    }
    if (this.wealthHistoryLoading) return this.wealthHistoryLoading;
    const load = this.withActual(() => readDashboardWealthHistory(this.config));
    this.wealthHistoryLoading = load;
    try {
      const value = await load;
      this.wealthHistoryCache = { expiresAt: Date.now() + 15 * 60_000, value };
      return value;
    } finally {
      this.wealthHistoryLoading = undefined;
    }
  }

  async getDashboardSpending(
    force = false,
    request: SpendingQuery & SpendingPeriodRequest = {}
  ): Promise<DashboardSpending> {
    if (!this.config.actual?.enabled) throw new Error("Actual ist deaktiviert");
    const period = spendingPeriodSelection(new Date(), this.config.timezone, request);
    const cacheKey = period.key;
    const now = Date.now();
    let snapshot = this.spendingCache.get(cacheKey);
    if (force || !snapshot || snapshot.expiresAt <= now) {
      let loading = this.spendingLoading.get(cacheKey);
      if (!loading) {
        loading = this.withActual(() => readActualSpendingMonth(
          this.config.actual!,
          this.config.timezone,
          request.month,
          new Date(),
          { period: request }
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
    return buildDashboardSpending(snapshot.value, request, this.db.listMerchantRules());
  }

  async getDashboardAssets(force = false): Promise<DashboardAssets> {
    const now = Date.now();
    if (force) this.overviewCache.clear();
    if (!force && this.assetsCache && this.assetsCache.expiresAt > now) {
      return this.assetsCache.value;
    }
    if (this.assetsLoading) return this.assetsLoading;
    const load = async (): Promise<DashboardAssets> => {
      const generatedAt = new Date();
      const market = await Promise.allSettled([
        this.config.ghostfolio && Object.keys(this.config.ghostfolio.accountMap).length > 0
          ? readGhostfolioAssets(this.config.ghostfolio, {
              holdingAccountIds: this.config.sources
                .filter((source) => source.enabled && source.kind === "dkb-fints")
                .flatMap((source) => dkbAccountIds(source))
            })
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

  async getDashboardDecisionLab(
    force = false,
    request: DecisionLabRequest = {},
    fireAssumptionsOverride?: FireAssumptions
  ): Promise<DashboardDecisionLab> {
    if (!this.config.actual?.enabled) throw new Error("Actual ist deaktiviert");
    const loadHistory = async (): Promise<DashboardSavingsBaseline> => {
      if (!force && this.savingsHistoryCache
        && this.savingsHistoryCache.expiresAt > Date.now()) {
        return this.savingsHistoryCache.value;
      }
      if (this.savingsHistoryLoading) return this.savingsHistoryLoading;
      const loading = (async () => {
        const generatedAt = new Date();
        const snapshot = await this.withActual(() => readActualSavingsCashflow(
          this.config.actual!,
          this.config.timezone,
          generatedAt,
          { months: 25, includeCurrentMonth: true }
        ));
        const value = buildDashboardSavingsBaseline(snapshot, this.config, generatedAt, 25, true);
        this.savingsHistoryCache = { expiresAt: Date.now() + 5 * 60_000, value };
        return value;
      })();
      this.savingsHistoryLoading = loading;
      try {
        return await loading;
      } finally {
        this.savingsHistoryLoading = undefined;
      }
    };
    const currentYear = Number(new Intl.DateTimeFormat("en-CA", {
      timeZone: this.config.timezone,
      year: "numeric"
    }).format(new Date()));
    const [assets, cashflow, recurring, analyses] = await Promise.all([
      this.getDashboardAssets(force),
      loadHistory(),
      this.getRecurringSnapshot(force, true),
      this.getDashboardAnalyses(force, {
        periodYear: currentYear,
        comparisonYear: currentYear - 1
      })
    ]);
    const optimizations = buildDashboardRecurringExpenseOptimizations(
      recurring.snapshot,
      this.db.listRecurringExpenseDecisions(),
      this.db.listRecurringExpenseOptimizations(),
      { stale: recurring.stale }
    );
    return buildDashboardDecisionLab(
      assets,
      cashflow,
      optimizations,
      analyses,
      request,
      new Date(),
      fireAssumptionsOverride ?? this.effectiveFireAssumptions(),
      this.db.listMerchantRules(),
      this.config.analysis?.savingsBaseline?.employeeStockBenefitMonthlyMinor ?? 0,
      this.db.listLifeEvents()
    );
  }

  effectiveFireAssumptions(): FireAssumptions {
    return this.db.activePensionFireAssumptions()
      ?? resolveFireAssumptions(this.config.analysis?.fire);
  }

  listPensionRevisions() {
    return this.db.listPensionRevisions().map((revision) => ({
      revisionId: revision.revisionId,
      confirmedAt: revision.confirmedAt,
      extractionVersion: revision.extractionVersion,
      status: revision.status,
      fields: revision.fields,
      impact: revision.impact
    }));
  }

  async previewPensionFire(preview: PensionPreviewSummary) {
    if (!preview.canPreview) throw new FinanceServiceError("Bitte alle markierten Werte zuerst prüfen", 409);
    const currentAssumptions = this.effectiveFireAssumptions();
    const proposedAssumptions = pensionAssumptionsFromFields(preview.fields, currentAssumptions);
    const request: DecisionLabRequest = { fireTargetAge: 60 };
    const [previousModel, proposedModel] = await Promise.all([
      this.getDashboardDecisionLab(false, request, currentAssumptions),
      this.getDashboardDecisionLab(false, request, proposedAssumptions)
    ]);
    const impact = pensionImpact(
      previousModel.fire.targetAge,
      {
        exitAge: previousModel.fire.central.currentExitAge,
        requiredCapitalAtTargetMinor: previousModel.fire.central.targetCapitalGoal.requiredCapitalMinor,
        assumptions: currentAssumptions
      },
      {
        exitAge: proposedModel.fire.central.currentExitAge,
        requiredCapitalAtTargetMinor: proposedModel.fire.central.targetCapitalGoal.requiredCapitalMinor,
        assumptions: proposedAssumptions
      }
    );
    return { impact, assumptions: proposedAssumptions };
  }

  async confirmPensionPreview(preview: PensionPreviewSummary) {
    if (!preview.canConfirm) throw new FinanceServiceError("Explizite Prüfung fehlt", 409);
    const { impact, assumptions } = await this.previewPensionFire(preview);
    const revision = createConfirmedPensionRevision(preview, assumptions, impact);
    return this.db.confirmPensionRevision(preview, revision);
  }

  getSutorSource(): SourceConfig | null {
    return this.config.sources.find((source) => {
      const workflow = source.settings?.manualWorkflow as { provider?: string } | undefined;
      return source.enabled && source.kind === "manual" && workflow?.provider === "sutor";
    }) ?? null;
  }

  listSutorRevisions() {
    return this.db.listSutorRevisions().map((revision) => ({
      revisionId: revision.revisionId,
      confirmedAt: revision.confirmedAt,
      extractionVersion: revision.extractionVersion,
      statementDate: revision.statementDate,
      documentType: revision.documentType,
      positionCount: revision.positionCount,
      totalMarketValueMinor: revision.totalMarketValueMinor,
      cashMinor: revision.cashMinor,
      contractValueMinor: revision.contractValueMinor,
      previous: revision.previous,
      deltaMinor: revision.deltaMinor,
      reconciliation: revision.reconciliation,
      status: revision.status
    }));
  }

  async confirmSutorPreview(preview: StoredSutorPreview) {
    if (!preview.canConfirm) throw new FinanceServiceError("Bitte alle markierten Sutor-Werte zuerst prüfen", 409);
    const source = this.getSource(preview.source.id);
    if (!source || source.kind !== "manual") throw new FinanceServiceError("Sutor-Quelle nicht gefunden", 404);
    if (this.running.has(source.id)) throw new FinanceServiceError("Für Sutor läuft bereits ein Vorgang", 409);
    const existing = this.db.sutorRevisionByHash(preview.documentHash);
    if (existing) {
      return {
        revision: this.db.listSutorRevisions().find((item) => item.revisionId === existing.revisionId),
        created: false,
        snapshotState: "equivalent" as const,
        message: "Dieser Sutor-Auszug wurde bereits bestätigt"
      };
    }
    this.running.add(source.id);
    const runId = this.db.beginRun(source.id);
    try {
      const bundle = manualSnapshotBundle(source, preview.snapshot);
      const snapshotState = this.db.manualSnapshotState(source.id, bundle);
      if (snapshotState === "conflict") throw new Error("SUTOR_SAME_DATE_CONFLICT");
      if (snapshotState === "equivalent") {
        this.db.finishRun(runId, source.id, "SUCCESS", "Sutor-Stand bereits vorhanden", { balances: 0, holdings: 0 });
        return {
          revision: null,
          created: false,
          snapshotState,
          message: "Dieser Sutor-Stand ist bereits vollständig vorhanden"
        };
      }
      const mappingReady = Boolean(
        this.config.ghostfolio?.enabled
        && this.config.ghostfolio.accountMap[preview.snapshot.accountId]
        && (preview.snapshot.holdings ?? []).every((holding) => this.config.ghostfolio?.holdingMap?.[holding.symbol])
      );
      if (!mappingReady) throw new Error("SUTOR_MAPPING_REQUIRED");

      // Reconcile first: if Ghostfolio is unavailable, no Sutor source value or
      // confirmation audit is persisted. Retrying remains safe and idempotent.
      const ghostfolioHoldings = await reconcileGhostfolioHoldings(
        this.config.ghostfolio!,
        bundle.holdings ?? [],
        "Confirmed Sutor Riester position adjustment by FinanceSync; not tax cost basis"
      );
      const backupName = `finance-before-sutor-${new Date().toISOString().replace(/[:.]/g, "-")}.sqlite`;
      snapshotSqlite(this.db, join(paths.archive, "normalized", "snapshots", backupName));
      const counts = importBundle(this.db, paths.archive, source.id, bundle);
      counts.ghostfolioHoldings = ghostfolioHoldings;
      const revision = createConfirmedSutorRevision(preview, "SYNCED");
      const confirmed = this.db.confirmSutorRevision(preview, revision);
      exportAll(this.db, paths.archive);
      const message = `Bestätigter Sutor-Stand übernommen; ${counts.balances} Gesamtwert und ${counts.holdings} Positionen neu`;
      this.db.finishRun(runId, source.id, "SUCCESS", message, counts);
      return { ...confirmed, snapshotState, message, counts };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.db.finishRun(runId, source.id, "ERROR", message);
      if (message === "SUTOR_SAME_DATE_CONFLICT") {
        throw new FinanceServiceError("Zu diesem Sutor-Stichtag gibt es bereits einen abweichenden Stand", 409);
      }
      if (message === "SUTOR_MAPPING_REQUIRED") {
        throw new FinanceServiceError("Mindestens eine ISIN benötigt zuerst eine bestätigte Ghostfolio-Zuordnung", 409);
      }
      throw new FinanceServiceError("Der Sutor-Stand konnte nicht vollständig übernommen werden; es wurden keine Sutor-Werte bestätigt", 503);
    } finally {
      this.running.delete(source.id);
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

  private invalidateReviewCaches(): void {
    this.spendingCache.clear();
    this.reviewCache.clear();
    this.recurringCache = undefined;
    this.analysesCache.clear();
    this.savingsBaselineCache = undefined;
    this.savingsHistoryCache = undefined;
  }

  async getDashboardReview(force = false, months = 6): Promise<DashboardReview & {
    recurring: DashboardRecurringExpenses;
    optimizations: DashboardRecurringExpenseOptimizations;
    aliases: Array<{ fromKey: string; toLabel: string }>;
    merchantRules: Array<{ pattern: string; label: string; deletable: boolean }>;
    monthCloses: ReturnType<FinanceDatabase["listMonthCloses"]>;
  }> {
    if (!this.config.actual?.enabled) throw new FinanceServiceError("Actual ist deaktiviert", 400);
    const window = reviewWindowSelection(new Date(), this.config.timezone, months);
    const cacheKey = `${window.startDate}:${window.endDate}`;
    const now = Date.now();
    let snapshot = this.reviewCache.get(cacheKey);
    if (force || !snapshot || snapshot.expiresAt <= now) {
      let loading = this.reviewLoading.get(cacheKey);
      if (!loading) {
        loading = this.withActual(() => readActualSpendingRange(
          this.config.actual!,
          window.startDate,
          window.endDate,
          new Date(),
          { mode: "review" }
        ));
        this.reviewLoading.set(cacheKey, loading);
      }
      try {
        const value = await loading;
        snapshot = { expiresAt: Date.now() + 5 * 60_000, value };
        this.reviewCache.set(cacheKey, snapshot);
      } finally {
        this.reviewLoading.delete(cacheKey);
      }
    }
    const aliases = this.db.listMerchantAliases();
    const uncategorized = applyMerchantAliases(snapshot.value.lines, aliases);
    const recurring = await this.getDashboardRecurringExpenses(force, { review: "moeglich" });
    const optimizations = await this.getDashboardRecurringExpenseOptimizations(force);
    const optimizationsOpen = optimizations.items.filter((item) =>
      !item.optimization || item.optimization.status === "PRUEFEN" || item.optimization.stale
    ).length;
    return {
      ...buildDashboardReview({
        generatedAt: snapshot.value.generatedAt,
        uncategorized,
        recurringOpen: recurring.summary.possible,
        optimizationsOpen,
        window,
        categories: snapshot.value.catalog.map(({ key, name, group, isIncome }) => ({
          key, id: key, name, group, isIncome
        }))
      }),
      recurring,
      optimizations,
      aliases: aliases.map(({ fromKey, toLabel }) => ({ fromKey, toLabel })),
      merchantRules: this.listMerchantRuleBook(),
      monthCloses: this.db.listMonthCloses()
    };
  }

  async applyReviewTransaction(payload: {
    lineId: string;
    categoryKey?: string;
    payeeName?: string;
    aliasTo?: string;
  }): Promise<DashboardReview & {
    recurring: DashboardRecurringExpenses;
    optimizations: DashboardRecurringExpenseOptimizations;
    aliases: Array<{ fromKey: string; toLabel: string }>;
  }> {
    if (!this.config.actual?.enabled) throw new FinanceServiceError("Actual ist deaktiviert", 400);
    const review = await this.getDashboardReview(false);
    const line = review.uncategorized.find((item) => item.id === payload.lineId)
      ?? [...this.reviewCache.values()].flatMap((entry) => entry.value.lines)
        .find((item) => item.id === payload.lineId);
    if (!line) throw new FinanceServiceError("Buchung nicht gefunden. Bitte Prüfen neu laden.", 404);
    let category: { id: string } | undefined;
    try {
      category = resolveReviewCategory(
        [...this.reviewCache.values()].flatMap((entry) => entry.value.catalog),
        payload.categoryKey
      );
    } catch {
      throw new FinanceServiceError("Kategorie nicht gefunden", 400);
    }
    const password = readSecret("actual-password");
    if (!password) throw new FinanceServiceError("Actual-Zugang ist nicht verfügbar", 503);
    const payeeName = payload.payeeName?.trim() || payload.aliasTo?.trim() || "";
    await this.withActual(() => updateActualReviewTransaction({
      lineId: payload.lineId,
      categoryId: category?.id,
      payeeName,
      serverURL: this.config.actual!.serverUrl,
      budgetId: this.config.actual!.budgetId,
      password,
      loadApi: async () => await import("@actual-app/api") as never
    }));
    if (payload.aliasTo?.trim()) {
      const alias = payload.aliasTo.trim().slice(0, 80);
      this.db.setMerchantAlias(line.merchantKey, alias);
      this.db.setMerchantRule(line.displayMerchant || line.merchant, alias);
    }
    this.invalidateReviewCaches();
    return this.getDashboardReview(true);
  }

  async applyMerchantAlias(fromKey: string, toLabel: string): Promise<{ fromKey: string; toLabel: string }> {
    if (!/^merchant-[a-f0-9]{16}$/.test(fromKey)) {
      throw new FinanceServiceError("Ungültiger Händlerschlüssel", 400);
    }
    const label = toLabel.trim().slice(0, 80);
    if (!label) throw new FinanceServiceError("Händlername fehlt", 400);
    const saved = this.db.setMerchantAlias(fromKey, label);
    this.invalidateReviewCaches();
    return saved;
  }

  listNamedScenarios() {
    return this.db.listNamedScenarios();
  }

  saveNamedScenario(name: string, request: DecisionLabRequest) {
    try {
      return this.db.saveNamedScenario(createNamedScenario(name, request));
    } catch (error) {
      throw new FinanceServiceError(error instanceof Error ? error.message : "Szenario ungültig", 400);
    }
  }

  deleteNamedScenario(id: string) {
    if (!/^scenario-[a-f0-9]{16}$/.test(id)) throw new FinanceServiceError("Szenario nicht gefunden", 404);
    if (!this.db.deleteNamedScenario(id)) throw new FinanceServiceError("Szenario nicht gefunden", 404);
    return { id };
  }

  listMerchantRuleBook() {
    const persisted = this.db.listMerchantRules();
    return merchantRuleBook(DEFAULT_MERCHANT_RULES, persisted);
  }

  saveMerchantRule(pattern: string, label: string) {
    const saved = this.db.setMerchantRule(pattern.trim().slice(0, 80), label.trim().slice(0, 80));
    this.invalidateReviewCaches();
    return saved;
  }

  deleteMerchantRule(pattern: string) {
    if (!this.db.deleteMerchantRule(pattern)) throw new FinanceServiceError("Regel nicht gefunden", 404);
    this.invalidateReviewCaches();
    return { pattern };
  }

  listLifeEvents() {
    return this.db.listLifeEvents();
  }

  saveLifeEvent(name: string, startMonth: string, monthlyChangeMinor: number) {
    try {
      return this.db.saveLifeEvent(createLifeEvent(name, startMonth, monthlyChangeMinor));
    } catch (error) {
      throw new FinanceServiceError(error instanceof Error ? error.message : "Ereignis ungültig", 400);
    }
  }

  deleteLifeEvent(id: string) {
    if (!this.db.deleteLifeEvent(id)) throw new FinanceServiceError("Ereignis nicht gefunden", 404);
    return { id };
  }

  listMonthCloses() {
    return this.db.listMonthCloses();
  }

  async closeReviewMonth(
    month: string,
    note = "",
    checklist: { payrollReviewed?: boolean; cardReviewed?: boolean } = {}
  ) {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new FinanceServiceError("Monat ungültig", 400);
    if (!checklist.payrollReviewed || !checklist.cardReviewed) {
      throw new FinanceServiceError("Bitte Gehaltszuordnung und Kreditkartenstand vor dem Abschluss bestätigen", 400);
    }
    const baseline = await this.getDashboardSavingsBaseline(true);
    const actual = baseline.months.find((item) => item.month === month);
    if (!actual) throw new FinanceServiceError("Monat liegt außerhalb der verfügbaren Sparratenbasis", 400);
    const [year, monthNumber] = month.split("-").map(Number);
    const endDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const reviewSnapshot = await this.withActual(() => readActualSpendingRange(
      this.config.actual!,
      `${month}-01`,
      `${month}-${String(endDay).padStart(2, "0")}`,
      new Date(),
      { mode: "review" }
    ));
    const model = await this.getDashboardDecisionLab(false, { trendBasis: "current-year" });
    const expected = model.basis.selectedTrend;
    const actualIncomeMinor = actual.payrollRegularMinor + actual.payrollVariableMinor
      + actual.secondIncomeRegularMinor + actual.secondIncomeVariableMinor
      + actual.otherIncomeRegularMinor + actual.otherIncomeVariableMinor;
    const actualExpensesMinor = actual.consumptionMinor;
    const snapshot = {
      actualIncomeMinor,
      actualExpensesMinor,
      actualNetMinor: actualIncomeMinor - actualExpensesMinor,
      expectedIncomeMinor: expected.monthlyIncomeMinor ?? 0,
      expectedExpensesMinor: expected.monthlyExpensesMinor ?? 0,
      expectedNetMinor: expected.averageMonthlyNetMinor ?? 0,
      committedOutflowMinor: actual.committedOutflowMinor,
      investmentOutflowMinor: actual.investmentOutflowMinor,
      unreviewedIncomeMinor: actual.unreviewedIncomeMinor,
      uncategorizedBookings: reviewSnapshot.lines.length
    };
    return this.db.closeMonth(month, note, snapshot, {
      payrollReviewed: true,
      cardReviewed: true
    });
  }

  async compareScenarios(leftId: string, rightId: string) {
    const left = this.db.listNamedScenarios().find((item) => item.id === leftId);
    const right = this.db.listNamedScenarios().find((item) => item.id === rightId);
    if (!left || !right) throw new FinanceServiceError("Szenario nicht gefunden", 404);
    const basic = compareNamedScenarios(left, right);
    const [leftModel, rightModel] = await Promise.all([
      this.getDashboardDecisionLab(false, left.inputs),
      this.getDashboardDecisionLab(false, right.inputs)
    ]);
    const outcome = (model: Awaited<ReturnType<FinanceService["getDashboardDecisionLab"]>>) => ({
      exitAge: model.fire.central.scenarioExitAge,
      projectedCapitalAtTargetMinor: model.fire.central.targetCapitalGoal.projectedCapitalMinor,
      requiredCapitalAtTargetMinor: model.fire.central.targetCapitalGoal.requiredCapitalMinor,
      capitalGapAtTargetMinor: model.fire.central.targetCapitalGoal.differenceMinor,
      annualGapToTargetMinor: model.fire.central.annualGapToTargetMinor,
      trajectoryAfter20YearsMinor: model.series.at(-1)?.scenarioMinor ?? null
    });
    const leftOutcome = outcome(leftModel);
    const rightOutcome = outcome(rightModel);
    const delta = (rightValue: number | null, leftValue: number | null) =>
      rightValue === null || leftValue === null ? null : rightValue - leftValue;
    return {
      ...basic,
      outcomes: { left: leftOutcome, right: rightOutcome },
      outcomeDelta: {
        exitAge: delta(rightOutcome.exitAge, leftOutcome.exitAge),
        projectedCapitalAtTargetMinor: delta(rightOutcome.projectedCapitalAtTargetMinor, leftOutcome.projectedCapitalAtTargetMinor),
        requiredCapitalAtTargetMinor: delta(rightOutcome.requiredCapitalAtTargetMinor, leftOutcome.requiredCapitalAtTargetMinor),
        capitalGapAtTargetMinor: delta(rightOutcome.capitalGapAtTargetMinor, leftOutcome.capitalGapAtTargetMinor),
        annualGapToTargetMinor: delta(rightOutcome.annualGapToTargetMinor, leftOutcome.annualGapToTargetMinor),
        trajectoryAfter20YearsMinor: delta(rightOutcome.trajectoryAfter20YearsMinor, leftOutcome.trajectoryAfter20YearsMinor)
      }
    };
  }

  async previewMilesMoreStatement(text: string, statementDate: string) {
    if (!this.config.actual?.enabled) throw new FinanceServiceError("Actual ist deaktiviert", 400);
    const password = readSecret("actual-password");
    if (!password) throw new FinanceServiceError("Actual-Zugang ist nicht verfügbar", 503);
    try {
      return await this.withActual(() => previewMilesMoreWithActual({
        text,
        statementDate,
        serverURL: this.config.actual!.serverUrl,
        budgetId: this.config.actual!.budgetId,
        password,
        loadApi: async () => await import("@actual-app/api") as never
      }));
    } catch (error) {
      throw new FinanceServiceError(error instanceof Error ? error.message : "Abrechnung ungültig", 400);
    }
  }

  async importMilesMoreStatement(text: string, statementDate: string) {
    if (!this.config.actual?.enabled) throw new FinanceServiceError("Actual ist deaktiviert", 400);
    const password = readSecret("actual-password");
    if (!password) throw new FinanceServiceError("Actual-Zugang ist nicht verfügbar", 503);
    try {
      const result = await this.withActual(() => importMilesMoreStatement({
        text,
        statementDate,
        serverURL: this.config.actual!.serverUrl,
        budgetId: this.config.actual!.budgetId,
        password,
        loadApi: async () => await import("@actual-app/api") as never
      }));
      this.invalidateReviewCaches();
      return result;
    } catch (error) {
      throw new FinanceServiceError(error instanceof Error ? error.message : "Import fehlgeschlagen", 400);
    }
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
