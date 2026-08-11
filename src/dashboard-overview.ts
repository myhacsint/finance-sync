import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppConfig, SourceKind } from "./types.js";
import type { FinanceDatabase } from "./database.js";
import { readSecret } from "./config.js";

export interface OverviewMonth {
  key: string;
  label: string;
  incomeMinor: number;
  spentMinor: number;
  partial: boolean;
}

export interface OverviewCategory {
  label: string;
  amountMinor: number;
}

export interface ActualOverviewSnapshot {
  months: OverviewMonth[];
  range: {
    months: number;
    offset: number;
    start: string;
    end: string;
    endPartial: boolean;
  };
  categoryMonth: string;
  categoryMonthLabel: string;
  categoryMonthOffset: number;
  latestCategoryMonth: string;
  categoryTotalMinor: number;
  categories: OverviewCategory[];
  remainingMinor: number;
}

export interface InvestmentOverviewSnapshot {
  amountMinor: number;
  capturedAt?: string;
  allocation: Array<{
    key: "pensions" | "depots" | "solana";
    label: string;
    amountMinor: number;
  }>;
}

export interface OverviewFreshness {
  key: "cash" | "depots" | "solana" | "pensions";
  label: string;
  status: "current" | "confirmed" | "warning" | "error" | "unavailable";
  capturedAt?: string;
}

export interface DashboardOverview {
  generatedAt: string;
  state: "current" | "partial";
  totalMinor: number | null;
  cash: {
    amountMinor: number | null;
    capturedAt?: string;
    source: "FinanceSync";
  };
  investments: {
    amountMinor: number | null;
    capturedAt?: string;
    source: "Ghostfolio";
    allocation: InvestmentOverviewSnapshot["allocation"];
  };
  cashflow: {
    state: "current" | "unavailable";
    source: "Actual";
    months: OverviewMonth[];
    range?: ActualOverviewSnapshot["range"];
    error?: string;
  };
  spending: {
    state: "current" | "unavailable";
    source: "Actual";
    month?: string;
    monthLabel?: string;
    monthOffset?: number;
    latestMonth?: string;
    totalMinor: number | null;
    categories: OverviewCategory[];
    remainingMinor: number;
  };
  manualActions: Array<{
    id: string;
    label: string;
    capturedAt?: string;
  }>;
  freshness: OverviewFreshness[];
  automatic: {
    current: number;
    total: number;
  };
  warnings: string[];
}

interface SourceRow {
  id: string;
  kind: SourceKind;
  enabled: boolean | number;
  state: string;
  last_success_at?: string | null;
}

interface CashSnapshot {
  amountMinor: number | null;
  capturedAt?: string;
}

interface ActualApi {
  init(options: { dataDir: string; serverURL: string; password: string }): Promise<unknown>;
  downloadBudget(id: string): Promise<void>;
  getBudgetMonth(month: string): Promise<{
    totalIncome: number;
    totalSpent: number;
    categoryGroups: Array<Record<string, unknown> & {
      name?: string;
      categories?: Array<Record<string, unknown> & {
        name?: string;
        spent?: number;
      }>;
    }>;
  }>;
  shutdown(): Promise<void>;
}

export type ActualApiLoader = () => Promise<ActualApi>;

function monthParts(now: Date, timezone: string): { year: number; month: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value)
  };
}

function monthKey(year: number, month: number, offset: number): string {
  const date = new Date(Date.UTC(year, month - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string, timezone: string): string {
  const [year, month] = key.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: timezone,
    month: "short"
  }).format(new Date(Date.UTC(year, month - 1, 15))).replace(".", "");
}

export function overviewMonthKeys(
  now: Date,
  timezone: string,
  count = 4,
  rangeOffset = 0
): Array<{ key: string; label: string; partial: boolean }> {
  const current = monthParts(now, timezone);
  const safeCount = Math.max(1, Math.min(12, Math.trunc(count)));
  const safeOffset = Math.max(0, Math.min(120, Math.trunc(rangeOffset)));
  const start = -(safeCount - 1) - safeOffset;
  return Array.from({ length: safeCount }, (_, index) => start + index).map((offset) => {
    const key = monthKey(current.year, current.month, offset);
    return { key, label: monthLabel(key, timezone), partial: offset === 0 };
  });
}

export async function readActualOverview(
  config: NonNullable<AppConfig["actual"]>,
  timezone: string,
  now = new Date(),
  options: {
    loadApi?: ActualApiLoader;
    password?: string;
    months?: number;
    offset?: number;
    spendingOffset?: number;
  } = {}
): Promise<ActualOverviewSnapshot> {
  if (!config.enabled) throw new Error("Actual ist deaktiviert");
  const password = options.password ?? readSecret("actual-password");
  if (!password) throw new Error("Actual-Zugang ist nicht verfügbar");
  const dataDir = mkdtempSync(join(tmpdir(), "finance-overview-actual-"));
  const api = await (options.loadApi ?? (async () =>
    await import("@actual-app/api") as unknown as ActualApi))();
  let initialized = false;
  try {
    await api.init({ dataDir, serverURL: config.serverUrl, password });
    initialized = true;
    await api.downloadBudget(config.budgetId);
    const keys = overviewMonthKeys(now, timezone, options.months, options.offset);
    const current = monthParts(now, timezone);
    const categoryMonthOffset = Math.max(0, Math.min(120, Math.trunc(options.spendingOffset ?? 0)));
    const latestCategoryMonth = monthKey(current.year, current.month, -1);
    const categoryKey = monthKey(current.year, current.month, -1 - categoryMonthOffset);
    const requestedKeys = [...new Set([...keys.map((month) => month.key), categoryKey])];
    const budgetData = new Map(await Promise.all(requestedKeys.map(async (key) => [
      key,
      await api.getBudgetMonth(key)
    ] as const)));
    const budgetMonths = keys.map((month) => ({
      ...month,
      data: budgetData.get(month.key)!
    }));
    const months = budgetMonths.map(({ key, label, partial, data }) => ({
      key,
      label,
      partial,
      incomeMinor: Math.max(0, Math.round(data.totalIncome)),
      spentMinor: Math.max(0, Math.round(-data.totalSpent))
    }));
    const completedData = budgetData.get(categoryKey);
    if (!completedData) throw new Error("Actual lieferte keinen abgeschlossenen Monat");
    const completed = { key: categoryKey, data: completedData };
    const categories = completed.data.categoryGroups
      .flatMap((group) => (group.categories ?? []).map((category) => ({
        label: String(category.name ?? "Ohne Kategorie"),
        amountMinor: Math.max(0, Math.round(-(category.spent ?? 0)))
      })))
      .filter((category) => category.amountMinor > 0)
      .sort((left, right) => right.amountMinor - left.amountMinor);
    const top = categories.slice(0, 4);
    const categoryTotalMinor = Math.max(0, Math.round(-completed.data.totalSpent));
    return {
      months,
      range: {
        months: keys.length,
        offset: Math.max(0, Math.min(120, Math.trunc(options.offset ?? 0))),
        start: keys[0].key,
        end: keys.at(-1)!.key,
        endPartial: Boolean(keys.at(-1)?.partial)
      },
      categoryMonth: completed.key,
      categoryMonthLabel: new Intl.DateTimeFormat("de-DE", {
        timeZone: timezone,
        month: "long"
      }).format(new Date(`${completed.key}-15T12:00:00Z`)),
      categoryMonthOffset,
      latestCategoryMonth,
      categoryTotalMinor,
      categories: top,
      remainingMinor: Math.max(
        0,
        categoryTotalMinor - top.reduce((sum, category) => sum + category.amountMinor, 0)
      )
    };
  } finally {
    if (initialized) await api.shutdown().catch(() => undefined);
    rmSync(dataDir, { recursive: true, force: true });
  }
}

function sourceKindById(config: AppConfig): Map<string, SourceKind> {
  return new Map(config.sources.map((source) => [source.id, source.kind]));
}

export async function readInvestmentOverview(
  appConfig: AppConfig,
  db: FinanceDatabase,
  options: { fetcher?: typeof fetch; securityToken?: string } = {}
): Promise<InvestmentOverviewSnapshot> {
  const config = appConfig.ghostfolio;
  if (!config) throw new Error("Ghostfolio ist nicht konfiguriert");
  if (!config.enabled) throw new Error("Ghostfolio ist deaktiviert");
  const securityToken = options.securityToken ?? readSecret("ghostfolio-security-token");
  if (!securityToken) throw new Error("Ghostfolio-Zugang ist nicht verfügbar");
  const fetcher = options.fetcher ?? fetch;
  const authResponse = await fetcher(new URL("/api/v1/auth/anonymous", config.serverUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ accessToken: securityToken }),
    signal: AbortSignal.timeout(30_000)
  });
  if (!authResponse.ok) throw new Error(`Ghostfolio Anmeldung HTTP ${authResponse.status}`);
  const auth = await authResponse.json() as { authToken?: string };
  if (!auth.authToken) throw new Error("Ghostfolio lieferte keinen Bearer-Token");
  const response = await fetcher(new URL("/api/v1/portfolio/details", config.serverUrl), {
    headers: { authorization: `Bearer ${auth.authToken}` },
    signal: AbortSignal.timeout(60_000)
  });
  if (!response.ok) throw new Error(`Ghostfolio Übersicht HTTP ${response.status}`);
  const payload = await response.json() as {
    createdAt?: string;
    accounts?: Record<string, { valueInBaseCurrency?: number }>;
    summary?: { totalValueInBaseCurrency?: number };
  };
  const accounts = payload.accounts ?? {};
  const configuredKinds = sourceKindById(appConfig);
  const rows = db.db.prepare(`
    SELECT account_id AS id, source_id FROM balances
    UNION
    SELECT account_id AS id, source_id FROM holdings
  `).all() as Array<{
    id: string;
    source_id: string;
  }>;
  const sourceKinds = configuredKinds.size ? configuredKinds : new Map<string, SourceKind>();
  const totals = { pensions: 0, depots: 0, solana: 0 };
  const counted = new Set<string>();
  for (const row of rows) {
    const ghostfolioId = config.accountMap[row.id];
    if (!ghostfolioId || counted.has(ghostfolioId)) continue;
    const value = accounts[ghostfolioId]?.valueInBaseCurrency;
    if (!Number.isFinite(value)) continue;
    counted.add(ghostfolioId);
    const kind = sourceKinds.get(row.source_id);
    if (kind === "manual") totals.pensions += Number(value);
    else if (kind === "dkb-fints" || kind === "comdirect") totals.depots += Number(value);
    else if (kind === "solana") totals.solana += Number(value);
  }
  const fallbackTotal = Object.values(accounts).reduce(
    (sum, account) => sum + (Number.isFinite(account.valueInBaseCurrency)
      ? Number(account.valueInBaseCurrency)
      : 0),
    0
  );
  const total = payload.summary?.totalValueInBaseCurrency;
  if (!Number.isFinite(total) && fallbackTotal === 0) {
    throw new Error("Ghostfolio lieferte keinen Anlagenwert");
  }
  return {
    amountMinor: Math.round(Number.isFinite(total) ? Number(total) * 100 : fallbackTotal * 100),
    capturedAt: payload.createdAt,
    allocation: [
      { key: "pensions", label: "Vorsorge", amountMinor: Math.round(totals.pensions * 100) },
      { key: "depots", label: "Depots", amountMinor: Math.round(totals.depots * 100) },
      { key: "solana", label: "Solana", amountMinor: Math.round(totals.solana * 100) }
    ]
  };
}

function cashSnapshot(db: FinanceDatabase, config: AppConfig): CashSnapshot {
  const enabled = new Set(config.sources
    .filter((source) => source.enabled && source.kind === "enable-banking")
    .map((source) => source.id));
  if (enabled.size === 0) return { amountMinor: null };
  const rows = db.db.prepare(`
    WITH ranked AS (
      SELECT source_id, account_id, captured_at, amount_minor, currency,
        row_number() OVER (
          PARTITION BY source_id, account_id ORDER BY captured_at DESC, id DESC
        ) AS rank
      FROM balances
    )
    SELECT source_id, captured_at, amount_minor, currency
    FROM ranked WHERE rank=1
  `).all() as Array<{
    source_id: string;
    captured_at: string;
    amount_minor: number;
    currency: string;
  }>;
  const current = rows.filter((row) => enabled.has(row.source_id) && row.currency === "EUR");
  if (current.length === 0) return { amountMinor: null };
  return {
    amountMinor: current.reduce((sum, row) => sum + Number(row.amount_minor), 0),
    capturedAt: current.map((row) => row.captured_at).sort().at(0)
  };
}

function latestForKinds(
  rows: SourceRow[],
  kinds: SourceKind[]
): { status: OverviewFreshness["status"]; capturedAt?: string } {
  const relevant = rows.filter((row) => Boolean(row.enabled) && kinds.includes(row.kind));
  if (relevant.length === 0) return { status: "unavailable" };
  if (relevant.some((row) => row.state === "ERROR")) return { status: "error" };
  const dates = relevant
    .map((row) => row.last_success_at)
    .filter((value): value is string => Boolean(value))
    .sort();
  if (dates.length !== relevant.length) return { status: "warning", capturedAt: dates.at(0) };
  const current = relevant.every((row) => row.state === "SUCCESS" || row.state === "READY");
  return { status: current ? "current" : "warning", capturedAt: dates.at(0) };
}

export function buildDashboardOverview(
  db: FinanceDatabase,
  config: AppConfig,
  actual: PromiseSettledResult<ActualOverviewSnapshot>,
  investments: PromiseSettledResult<InvestmentOverviewSnapshot>,
  now = new Date()
): DashboardOverview {
  const rows = db.listSources() as unknown as SourceRow[];
  const cash = cashSnapshot(db, config);
  const investment = investments.status === "fulfilled" ? investments.value : undefined;
  const actualData = actual.status === "fulfilled" ? actual.value : undefined;
  const manualActions = config.sources
    .filter((source) => source.enabled && source.kind === "manual")
    .map((source) => ({
      id: source.id,
      label: typeof source.settings?.displayName === "string"
        ? source.settings.displayName
        : typeof (source.settings?.manualWorkflow as { label?: unknown } | undefined)?.label === "string"
          ? String((source.settings?.manualWorkflow as { label: string }).label)
          : "Vorsorge",
      capturedAt: db.latestBalanceCapturedAt(source.id)
    }));
  const automaticRows = rows.filter((row) => Boolean(row.enabled) && row.kind !== "manual");
  const automaticCurrent = automaticRows.filter(
    (row) => row.state === "SUCCESS" || row.state === "READY"
  ).length;
  const giroFreshness = latestForKinds(rows, ["enable-banking"]);
  const depotFreshness = latestForKinds(rows, ["dkb-fints", "comdirect"]);
  const solanaFreshness = latestForKinds(rows, ["solana"]);
  const pensionDates = manualActions
    .map((action) => action.capturedAt)
    .filter((value): value is string => Boolean(value))
    .sort();
  const warnings: string[] = [];
  if (!actualData) warnings.push("Actual-Daten sind vorübergehend nicht verfügbar");
  if (!investment) warnings.push("Ghostfolio-Daten sind vorübergehend nicht verfügbar");
  if (cash.amountMinor === null) warnings.push("Aktuelle Bankstände sind nicht verfügbar");
  const totalMinor = cash.amountMinor !== null && investment
    ? cash.amountMinor + investment.amountMinor
    : null;
  return {
    generatedAt: now.toISOString(),
    state: warnings.length ? "partial" : "current",
    totalMinor,
    cash: { ...cash, source: "FinanceSync" },
    investments: {
      amountMinor: investment?.amountMinor ?? null,
      capturedAt: investment?.capturedAt,
      source: "Ghostfolio",
      allocation: investment?.allocation ?? []
    },
    cashflow: {
      state: actualData ? "current" : "unavailable",
      source: "Actual",
      months: actualData?.months ?? [],
      range: actualData?.range,
      error: actual.status === "rejected" ? "Datenabruf fehlgeschlagen" : undefined
    },
    spending: {
      state: actualData ? "current" : "unavailable",
      source: "Actual",
      month: actualData?.categoryMonth,
      monthLabel: actualData?.categoryMonthLabel,
      monthOffset: actualData?.categoryMonthOffset,
      latestMonth: actualData?.latestCategoryMonth,
      totalMinor: actualData?.categoryTotalMinor ?? null,
      categories: actualData?.categories ?? [],
      remainingMinor: actualData?.remainingMinor ?? 0
    },
    manualActions,
    freshness: [
      { key: "cash", label: "Girokonten", ...giroFreshness },
      { key: "depots", label: "Depots", ...depotFreshness },
      { key: "solana", label: "Solana", ...solanaFreshness },
      {
        key: "pensions",
        label: "Vorsorge",
        status: pensionDates.length === manualActions.length ? "confirmed" : "warning",
        capturedAt: pensionDates.at(0)
      }
    ],
    automatic: { current: automaticCurrent, total: automaticRows.length },
    warnings
  };
}
