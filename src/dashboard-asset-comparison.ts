import type { FinanceDatabase } from "./database.js";
import type { AppConfig, SourceConfig, SourceKind } from "./types.js";

export type AssetComparisonKey = "cash" | "depots" | "pensions" | "solana";
export type AssetComparisonValuation = "measured" | "confirmed" | "estimated" | "unavailable";

export interface CoinGeckoSolPrice {
  date: string;
  priceMinor: number;
  source: "CoinGecko";
}

export interface OverviewAssetComparison {
  effectiveDate: string;
  state: "complete" | "partial";
  previousTotalMinor: number | null;
  changeTotalMinor: number | null;
  parts: Array<{
    key: AssetComparisonKey;
    label: string;
    currentMinor: number | null;
    previousMinor: number | null;
    changeMinor: number | null;
    source: string;
    capturedDates: string[];
    valuation: AssetComparisonValuation;
    quantity?: number;
    stakingRewardsQuantity?: number;
    priceMinor?: number;
    priceDate?: string;
  }>;
  warnings: string[];
}

interface BalanceRow {
  source_id: string;
  account_id: string;
  captured_at: string;
  amount_minor: number;
  currency: string;
}

interface HoldingRow {
  source_id: string;
  account_id: string;
  captured_at: string;
  symbol: string;
  quantity_atomic: string;
  atomic_decimals: number;
}

function localParts(value: Date, timezone: string): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(value);
  const part = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((item) => item.type === type)?.value);
  return {
    year: part("year"),
    month: part("month"),
    day: part("day"),
    hour: part("hour"),
    minute: part("minute"),
    second: part("second")
  };
}

function localMidnightUtc(year: number, month: number, day: number, timezone: string): Date {
  const wanted = Date.UTC(year, month - 1, day, 0, 0, 0);
  let candidate = new Date(wanted);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = localParts(candidate, timezone);
    const represented = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hour,
      actual.minute,
      actual.second
    );
    candidate = new Date(candidate.getTime() + wanted - represented);
  }
  return candidate;
}

export function lastCompletedMonthEnd(
  now: Date,
  timezone: string
): { effectiveDate: string; endExclusive: string } {
  const current = localParts(now, timezone);
  const lastDay = new Date(Date.UTC(current.year, current.month - 1, 0));
  return {
    effectiveDate: `${lastDay.getUTCFullYear()}-${String(lastDay.getUTCMonth() + 1).padStart(2, "0")}-${String(lastDay.getUTCDate()).padStart(2, "0")}`,
    endExclusive: localMidnightUtc(current.year, current.month, 1, timezone).toISOString()
  };
}

export async function readCoinGeckoSolPrice(
  effectiveDate: string,
  options: { fetcher?: typeof fetch } = {}
): Promise<CoinGeckoSolPrice> {
  const [year, month, day] = effectiveDate.split("-");
  if (!year || !month || !day) throw new Error("Ungültiger SOL-Vergleichsstichtag");
  const url = new URL("https://api.coingecko.com/api/v3/coins/solana/history");
  url.searchParams.set("date", `${day}-${month}-${year}`);
  url.searchParams.set("localization", "false");
  const response = await (options.fetcher ?? fetch)(url, {
    headers: { accept: "application/json" },
    signal: AbortSignal.timeout(30_000)
  });
  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
  const payload = await response.json() as {
    market_data?: { current_price?: { eur?: number } };
  };
  const eur = payload.market_data?.current_price?.eur;
  if (!Number.isFinite(eur) || Number(eur) <= 0) {
    throw new Error("CoinGecko lieferte keinen SOL-EUR-Tageskurs");
  }
  return { date: effectiveDate, priceMinor: Math.round(Number(eur) * 100), source: "CoinGecko" };
}

function sourcesFor(config: AppConfig, kinds: SourceKind[]): SourceConfig[] {
  return config.sources.filter((source) => source.enabled && kinds.includes(source.kind));
}

function configuredAccountIds(source: SourceConfig): string[] {
  const accounts = source.settings?.accounts;
  if (!Array.isArray(accounts)) return [];
  return accounts
    .map((account) => account && typeof account === "object"
      ? String((account as { accountId?: unknown }).accountId ?? "")
      : "")
    .filter(Boolean);
}

function previousBalancePart(
  db: FinanceDatabase,
  sources: SourceConfig[],
  endExclusive: string
): { amountMinor: number | null; capturedDates: string[] } {
  if (sources.length === 0) return { amountMinor: null, capturedDates: [] };
  const sourceIds = new Set(sources.map((source) => source.id));
  const allRows = db.db.prepare(`
    SELECT source_id, account_id, captured_at, amount_minor, currency
    FROM balances WHERE currency='EUR'
    ORDER BY captured_at DESC, id DESC
  `).all() as unknown as BalanceRow[];
  const expected = new Map<string, Set<string>>();
  for (const source of sources) {
    const fromConfig = configuredAccountIds(source);
    const fromArchive = allRows
      .filter((row) => row.source_id === source.id)
      .map((row) => row.account_id);
    expected.set(source.id, new Set([...fromConfig, ...fromArchive]));
  }
  if ([...expected.values()].some((accounts) => accounts.size === 0)) {
    return { amountMinor: null, capturedDates: [] };
  }
  const selected: BalanceRow[] = [];
  for (const [sourceId, accounts] of expected) {
    for (const accountId of accounts) {
      const row = allRows.find((candidate) =>
        sourceIds.has(candidate.source_id)
        && candidate.source_id === sourceId
        && candidate.account_id === accountId
        && candidate.captured_at < endExclusive
      );
      if (!row) return { amountMinor: null, capturedDates: [] };
      selected.push(row);
    }
  }
  return {
    amountMinor: selected.reduce((sum, row) => sum + Number(row.amount_minor), 0),
    capturedDates: [...new Set(selected.map((row) => row.captured_at))].sort()
  };
}

function atomicToNumber(quantity: string, decimals: number): number {
  const value = Number(quantity) / 10 ** decimals;
  return Number.isFinite(value) ? value : 0;
}

function previousSolanaQuantity(
  db: FinanceDatabase,
  sources: SourceConfig[],
  endExclusive: string
): { quantity: number | null; capturedDates: string[]; stakingRewardsQuantity: number } {
  if (sources.length === 0) return { quantity: null, capturedDates: [], stakingRewardsQuantity: 0 };
  const sourceIds = new Set(sources.map((source) => source.id));
  const rows = db.db.prepare(`
    SELECT source_id, account_id, captured_at, symbol, quantity_atomic, atomic_decimals
    FROM holdings
    WHERE symbol IN ('SOL', 'SOL-STAKED')
    ORDER BY captured_at DESC, id DESC
  `).all() as unknown as HoldingRow[];
  const accountsBySource = new Map<string, Set<string>>();
  for (const source of sources) {
    const accounts = rows
      .filter((row) => row.source_id === source.id)
      .map((row) => row.account_id);
    accountsBySource.set(source.id, new Set(accounts));
  }
  if ([...accountsBySource.values()].some((accounts) => accounts.size === 0)) {
    return { quantity: null, capturedDates: [], stakingRewardsQuantity: 0 };
  }
  let quantity = 0;
  const capturedDates: string[] = [];
  for (const [sourceId, accounts] of accountsBySource) {
    for (const accountId of accounts) {
      const latest = rows.find((row) =>
        sourceIds.has(row.source_id)
        && row.source_id === sourceId
        && row.account_id === accountId
        && row.captured_at < endExclusive
      );
      if (!latest) return { quantity: null, capturedDates: [], stakingRewardsQuantity: 0 };
      const snapshot = rows.filter((row) =>
        row.source_id === sourceId
        && row.account_id === accountId
        && row.captured_at === latest.captured_at
      );
      quantity += snapshot.reduce(
        (sum, row) => sum + atomicToNumber(row.quantity_atomic, row.atomic_decimals),
        0
      );
      capturedDates.push(latest.captured_at);
    }
  }
  const rewards = db.db.prepare(`
    SELECT quantity_atomic, atomic_decimals
    FROM investment_activities
    WHERE type='STAKING_REWARD' AND symbol='SOL' AND occurred_at < ?
  `).all(endExclusive) as Array<{ quantity_atomic: string; atomic_decimals: number }>;
  return {
    quantity,
    capturedDates: [...new Set(capturedDates)].sort(),
    stakingRewardsQuantity: rewards.reduce(
      (sum, reward) => sum + atomicToNumber(reward.quantity_atomic, reward.atomic_decimals),
      0
    )
  };
}

function currentInvestmentAmount(
  allocation: Array<{ key: "pensions" | "depots" | "solana"; amountMinor: number }>,
  key: "pensions" | "depots" | "solana"
): number | null {
  const row = allocation.find((item) => item.key === key);
  return row && Number.isFinite(row.amountMinor) ? row.amountMinor : null;
}

export function buildOverviewAssetComparison(
  db: FinanceDatabase,
  config: AppConfig,
  current: {
    totalMinor: number | null;
    cashMinor: number | null;
    investmentMinor: number | null;
    allocation: Array<{ key: "pensions" | "depots" | "solana"; amountMinor: number }>;
  },
  solPrice: PromiseSettledResult<CoinGeckoSolPrice>,
  now = new Date()
): OverviewAssetComparison {
  const boundary = lastCompletedMonthEnd(now, config.timezone);
  const definitions: Array<{
    key: AssetComparisonKey;
    label: string;
    kinds: SourceKind[];
    currentMinor: number | null;
    source: string;
    valuation: Exclude<AssetComparisonValuation, "estimated" | "unavailable">;
  }> = [
    { key: "cash", label: "Liquidität", kinds: ["enable-banking"], currentMinor: current.cashMinor, source: "FinanceSync-Archiv", valuation: "measured" },
    { key: "depots", label: "Depots", kinds: ["dkb-fints", "comdirect"], currentMinor: currentInvestmentAmount(current.allocation, "depots"), source: "Archivierte Depot-Stichtage", valuation: "measured" },
    { key: "pensions", label: "Vorsorge", kinds: ["manual"], currentMinor: currentInvestmentAmount(current.allocation, "pensions"), source: "Bestätigte Vorsorgebelege", valuation: "confirmed" }
  ];
  const parts: OverviewAssetComparison["parts"] = [];
  for (const definition of definitions) {
    const sources = sourcesFor(config, definition.kinds);
    if (sources.length === 0) continue;
    const previous = previousBalancePart(db, sources, boundary.endExclusive);
    const available = previous.amountMinor !== null;
    parts.push({
      key: definition.key,
      label: definition.label,
      currentMinor: definition.currentMinor,
      previousMinor: previous.amountMinor,
      changeMinor: available && definition.currentMinor !== null
        ? definition.currentMinor - previous.amountMinor!
        : null,
      source: definition.source,
      capturedDates: previous.capturedDates,
      valuation: available ? definition.valuation : "unavailable"
    });
  }

  const solanaSources = sourcesFor(config, ["solana"]);
  if (solanaSources.length > 0) {
    const solana = previousSolanaQuantity(db, solanaSources, boundary.endExclusive);
    const price = solPrice.status === "fulfilled" && solPrice.value.date === boundary.effectiveDate
      ? solPrice.value
      : undefined;
    const previousMinor = solana.quantity !== null && price
      ? Math.round(solana.quantity * price.priceMinor)
      : null;
    const currentMinor = currentInvestmentAmount(current.allocation, "solana");
    parts.push({
      key: "solana",
      label: "Solana & Staking",
      currentMinor,
      previousMinor,
      changeMinor: previousMinor !== null && currentMinor !== null
        ? currentMinor - previousMinor
        : null,
      source: "Historische SOL-Menge · CoinGecko-Tageskurs",
      capturedDates: solana.capturedDates,
      valuation: previousMinor === null ? "unavailable" : "estimated",
      quantity: solana.quantity ?? undefined,
      stakingRewardsQuantity: solana.stakingRewardsQuantity,
      priceMinor: price?.priceMinor,
      priceDate: price?.date
    });
  }

  const currentPartsComplete = parts.every((part) => part.currentMinor !== null);
  const previousPartsComplete = parts.every((part) => part.previousMinor !== null);
  const currentPartsTotal = currentPartsComplete
    ? parts.reduce((sum, part) => sum + Number(part.currentMinor), 0)
    : null;
  const currentReconciles = current.totalMinor !== null
    && currentPartsTotal !== null
    && currentPartsTotal === current.totalMinor;
  const previousTotalMinor = previousPartsComplete && currentReconciles
    ? parts.reduce((sum, part) => sum + Number(part.previousMinor), 0)
    : null;
  const changeTotalMinor = previousTotalMinor !== null && current.totalMinor !== null
    ? current.totalMinor - previousTotalMinor
    : null;
  const warnings: string[] = [];
  if (!previousPartsComplete) warnings.push("Mindestens ein Vergleichsanteil ist nicht verfügbar");
  if (!currentReconciles) warnings.push("Die aktuellen Anteile lassen sich nicht vollständig zum Gesamtvermögen abstimmen");
  return {
    effectiveDate: boundary.effectiveDate,
    state: previousTotalMinor === null ? "partial" : "complete",
    previousTotalMinor,
    changeTotalMinor,
    parts,
    warnings
  };
}
