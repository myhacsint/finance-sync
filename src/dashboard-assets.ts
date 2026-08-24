import { createHash } from "node:crypto";
import { readSecret } from "./config.js";
import type { FinanceDatabase } from "./database.js";
import type { AppConfig, SourceConfig, SourceKind } from "./types.js";
import {
  configuredPhysicalAssets,
  latestPhysicalAssetValuation
} from "./physical-assets.js";
import { marketSnapshotDate } from "./market-snapshots.js";

export type AssetAreaKey = "cash" | "depots" | "pensions" | "crypto" | "precious-metals";
export type AssetPositionState = "current" | "confirmed" | "stale" | "error" | "unavailable";

export interface GhostfolioAssetSnapshot {
  capturedAt?: string;
  valuesByAccount: Record<string, number>;
  holdingsByAccount?: Record<string, Array<{
    label: string;
    symbol: string;
    quantity: number;
    marketPriceMinor: number;
    valueMinor: number;
    currency: string;
  }>>;
}

export interface DashboardAssets {
  generatedAt: string;
  state: "current" | "stale" | "partial";
  totalMinor: number | null;
  basis: "latest-available";
  marketHistory: {
    status: "current" | "pending";
    latestDate?: string;
  };
  summary: {
    automaticCurrent: number;
    automaticTotal: number;
    confirmed: number;
  };
  areas: Array<{
    key: AssetAreaKey;
    label: string;
    amountMinor: number | null;
    percent: number | null;
    positions: number;
    status: AssetPositionState;
  }>;
  positions: Array<{
    key: string;
    label: string;
    area: AssetAreaKey;
    areaLabel: string;
    amountMinor: number | null;
    capturedAt?: string;
    basis: "FinanceSync" | "Ghostfolio" | "Ghostfolio-Marktwert" | "Bestätigter Wert" | "Ankaufwert [SCHÄTZUNG]";
    status: AssetPositionState;
    confirmedAmountMinor?: number;
    confirmedAt?: string;
    detail?: string;
    acquisitionCostMinor?: number;
    acquisitionCostEstimated?: boolean;
    valuationSource?: string;
    holdings?: Array<{
      label: string;
      symbol: string;
      quantity: number;
      marketPriceMinor: number;
      valueMinor: number;
      currency: string;
    }>;
  }>;
  warnings: string[];
}

interface BalanceRow {
  source_id: string;
  account_id: string;
  captured_at: string;
  amount_minor: number;
  currency: string;
  owner?: string | null;
}

interface SourceRow {
  id: string;
  kind: SourceKind;
  enabled: boolean | number;
  state: string;
  last_success_at?: string | null;
}

const areaDefinitions: Array<{ key: AssetAreaKey; label: string }> = [
  { key: "cash", label: "Liquidität" },
  { key: "depots", label: "Depots" },
  { key: "pensions", label: "Vorsorge" },
  { key: "crypto", label: "Krypto" },
  { key: "precious-metals", label: "Edelmetalle" }
];

function areaFor(kind: SourceKind): AssetAreaKey | undefined {
  if (kind === "enable-banking") return "cash";
  if (kind === "dkb-fints" || kind === "comdirect") return "depots";
  if (kind === "manual") return "pensions";
  if (kind === "solana") return "crypto";
  return undefined;
}

function publicKey(sourceId: string, accountId: string): string {
  return `asset-${createHash("sha256")
    .update(`finance-hub:asset:${sourceId}:${accountId}`)
    .digest("hex")
    .slice(0, 12)}`;
}

function ownersAreShared(owner: string | null | undefined): boolean {
  return Boolean(owner && /(?:,|\+|&|\bund\b)/i.test(owner));
}

function provider(source: SourceConfig): "DKB" | "comdirect" | "Vorsorge" | "Solana" {
  if (/comdirect/i.test(source.id)) return "comdirect";
  if (/dkb/i.test(source.id)) return "DKB";
  if (source.kind === "solana") return "Solana";
  return "Vorsorge";
}

function positionLabel(source: SourceConfig, owner?: string | null): string {
  const institution = provider(source);
  if (source.kind === "enable-banking") {
    return `${institution} Giro ${ownersAreShared(owner) ? "gemeinschaftlich" : "privat"}`;
  }
  if (source.kind === "dkb-fints" || source.kind === "comdirect") {
    return `${institution} Depot ${ownersAreShared(owner) ? "gemeinschaftlich" : "privat"}`;
  }
  if (source.kind === "solana") return "Solana & Staking";
  if (/sutor|riester/i.test(source.id)) return "Riester";
  if (/alte|leipziger|fondsrente/i.test(source.id)) return "Fondsrente";
  return "Vorsorgevertrag";
}

function maximumAgeMs(kind: SourceKind): number {
  if (kind === "solana") return 12 * 60 * 60_000;
  if (kind === "dkb-fints" || kind === "comdirect") return 7 * 24 * 60 * 60_000;
  return 36 * 60 * 60_000;
}

function positionState(
  source: SourceConfig,
  sourceRow: SourceRow | undefined,
  capturedAt: string | undefined,
  hasValue: boolean,
  now: Date
): AssetPositionState {
  if (!hasValue) return sourceRow?.state === "ERROR" ? "error" : "unavailable";
  if (source.kind === "manual") return "confirmed";
  if (sourceRow?.state === "ERROR") return "error";
  if (!capturedAt) return "stale";
  const age = now.getTime() - new Date(capturedAt).getTime();
  const sourceReady = sourceRow?.state === "SUCCESS" || sourceRow?.state === "READY";
  return sourceReady && Number.isFinite(age) && age <= maximumAgeMs(source.kind)
    ? "current"
    : "stale";
}

function weakestState(states: AssetPositionState[]): AssetPositionState {
  if (states.some((state) => state === "error")) return "error";
  if (states.some((state) => state === "unavailable")) return "unavailable";
  if (states.some((state) => state === "stale")) return "stale";
  if (states.length > 0 && states.every((state) => state === "confirmed")) return "confirmed";
  return "current";
}

export async function readGhostfolioAssets(
  config: NonNullable<AppConfig["ghostfolio"]>,
  options: { fetcher?: typeof fetch; securityToken?: string; holdingAccountIds?: string[] } = {}
): Promise<GhostfolioAssetSnapshot> {
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
  };
  const valuesByAccount: Record<string, number> = {};
  for (const [financeAccountId, ghostfolioAccountId] of Object.entries(config.accountMap)) {
    const value = payload.accounts?.[ghostfolioAccountId]?.valueInBaseCurrency;
    if (Number.isFinite(value)) valuesByAccount[financeAccountId] = Math.round(Number(value) * 100);
  }
  const holdingsByAccount: NonNullable<GhostfolioAssetSnapshot["holdingsByAccount"]> = {};
  await Promise.all((options.holdingAccountIds ?? []).map(async (financeAccountId) => {
    const ghostfolioAccountId = config.accountMap[financeAccountId];
    if (!ghostfolioAccountId) return;
    try {
      const url = new URL("/api/v1/portfolio/details", config.serverUrl);
      url.searchParams.set("accounts", ghostfolioAccountId);
      const holdingResponse = await fetcher(url, {
        headers: { authorization: `Bearer ${auth.authToken}` },
        signal: AbortSignal.timeout(60_000)
      });
      if (!holdingResponse.ok) return;
      const holdingPayload = await holdingResponse.json() as {
        holdings?: Record<string, {
          quantity?: number;
          marketPrice?: number;
          valueInBaseCurrency?: number;
          assetProfile?: { name?: string; symbol?: string; currency?: string };
        }>;
      };
      holdingsByAccount[financeAccountId] = Object.values(holdingPayload.holdings ?? {})
        .map((holding) => ({
          label: String(holding.assetProfile?.name || holding.assetProfile?.symbol || "Position"),
          symbol: String(holding.assetProfile?.symbol || ""),
          quantity: Number(holding.quantity),
          marketPriceMinor: Math.round(Number(holding.marketPrice) * 100),
          valueMinor: Math.round(Number(holding.valueInBaseCurrency) * 100),
          currency: String(holding.assetProfile?.currency || "EUR")
        }))
        .filter((holding) => holding.symbol
          && Number.isFinite(holding.quantity)
          && Number.isFinite(holding.marketPriceMinor)
          && Number.isFinite(holding.valueMinor))
        .sort((left, right) => right.valueMinor - left.valueMinor);
    } catch {
      // The depot total remains useful when only the optional drill-down is unavailable.
    }
  }));
  return { capturedAt: payload.createdAt, valuesByAccount, holdingsByAccount };
}

export function buildDashboardAssets(
  db: FinanceDatabase,
  config: AppConfig,
  market: PromiseSettledResult<GhostfolioAssetSnapshot>,
  now = new Date()
): DashboardAssets {
  const databaseSources = db.listSources() as unknown as SourceRow[];
  const sourceRows = new Map(databaseSources.map((source) => [source.id, source]));
  const configuredSources = config.sources.filter((source) => source.enabled && areaFor(source.kind));
  const enabledSources = configuredSources.length
    ? configuredSources
    : databaseSources
      .filter((source) => Boolean(source.enabled) && areaFor(source.kind))
      .map((source) => ({ id: source.id, kind: source.kind, enabled: true }));
  const sourceById = new Map(enabledSources.map((source) => [source.id, source]));
  const balances = db.db.prepare(`
    WITH ranked AS (
      SELECT source_id, account_id, captured_at, amount_minor, currency, owner,
        row_number() OVER (
          PARTITION BY source_id, account_id ORDER BY captured_at DESC, id DESC
        ) AS rank
      FROM balances
    )
    SELECT source_id, account_id, captured_at, amount_minor, currency, owner
    FROM ranked WHERE rank=1
  `).all() as unknown as BalanceRow[];
  const relevant = balances.filter((row) => sourceById.has(row.source_id));
  const marketData = market.status === "fulfilled" ? market.value : undefined;
  const positions: DashboardAssets["positions"] = [];
  for (const source of enabledSources) {
    const area = areaFor(source.kind)!;
    const rows = relevant.filter((row) => row.source_id === source.id);
    const expectedRows: Array<BalanceRow | undefined> = rows.length ? rows : [undefined];
    for (const row of expectedRows) {
      const cashValue = row?.currency === "EUR" ? Number(row.amount_minor) : undefined;
      const investmentValue = row ? marketData?.valuesByAccount[row.account_id] : undefined;
      const pensionMarketValue = area === "pensions" && Number.isFinite(investmentValue);
      const amountMinor = area === "cash"
        ? cashValue
        : area === "pensions"
          ? pensionMarketValue ? investmentValue : cashValue
          : investmentValue;
      const capturedAt = pensionMarketValue ? marketData?.capturedAt : row?.captured_at;
      const marketAge = capturedAt ? now.getTime() - new Date(capturedAt).getTime() : Number.NaN;
      const status = pensionMarketValue
        ? Number.isFinite(marketAge) && marketAge <= maximumAgeMs("manual") ? "current" : "stale"
        : positionState(
            source,
            sourceRows.get(source.id),
            capturedAt,
            Number.isFinite(amountMinor),
            now
          );
      positions.push({
        key: publicKey(source.id, row?.account_id ?? "missing"),
        label: positionLabel(source, row?.owner),
        area,
        areaLabel: areaDefinitions.find((item) => item.key === area)!.label,
        amountMinor: Number.isFinite(amountMinor) ? Number(amountMinor) : null,
        capturedAt,
        basis: area === "cash"
          ? "FinanceSync"
          : area === "pensions"
            ? pensionMarketValue ? "Ghostfolio-Marktwert" : "Bestätigter Wert"
            : "Ghostfolio",
        status,
        holdings: area === "depots" && row
          ? marketData?.holdingsByAccount?.[row.account_id]
          : undefined,
        confirmedAmountMinor: area === "pensions" && Number.isFinite(cashValue)
          ? Number(cashValue)
          : undefined,
        confirmedAt: area === "pensions" ? row?.captured_at : undefined
      });
    }
  }
  for (const asset of configuredPhysicalAssets(config)) {
    const valuation = latestPhysicalAssetValuation(asset);
    if (!valuation) continue;
    positions.push({
      key: publicKey("physical-asset", asset.id),
      label: asset.label,
      area: "precious-metals",
      areaLabel: "Edelmetalle",
      amountMinor: valuation.amountMinor,
      capturedAt: `${valuation.date}T12:00:00.000Z`,
      basis: "Ankaufwert [SCHÄTZUNG]",
      status: "confirmed",
      detail: `${asset.weightGrams} g · Feinheit ${new Intl.NumberFormat("de-DE", {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
      }).format(asset.fineness)}`,
      acquisitionCostMinor: asset.acquisitionCostMinor,
      acquisitionCostEstimated: asset.acquisitionCostEstimated,
      valuationSource: valuation.source
    });
  }
  const sortedPositions = positions.sort((left, right) => {
    const areaDelta = areaDefinitions.findIndex((item) => item.key === left.area)
      - areaDefinitions.findIndex((item) => item.key === right.area);
    if (areaDelta) return areaDelta;
    if (left.label !== right.label) return left.label.localeCompare(right.label, "de");
    return left.key.localeCompare(right.key);
  });
  const complete = sortedPositions.length > 0
    && sortedPositions.every((position) => position.amountMinor !== null);
  const totalMinor = complete
    ? sortedPositions.reduce((sum, position) => sum + Number(position.amountMinor), 0)
    : null;
  const areas = areaDefinitions.map((definition) => {
    const areaPositions = sortedPositions.filter((position) => position.area === definition.key);
    const areaComplete = areaPositions.length > 0
      && areaPositions.every((position) => position.amountMinor !== null);
    const amountMinor = areaComplete
      ? areaPositions.reduce((sum, position) => sum + Number(position.amountMinor), 0)
      : null;
    return {
      ...definition,
      amountMinor,
      percent: amountMinor !== null && totalMinor && totalMinor > 0
        ? Math.round(amountMinor / totalMinor * 10_000) / 100
        : null,
      positions: areaPositions.length,
      status: weakestState(areaPositions.map((position) => position.status))
    };
  }).filter((area) => area.positions > 0);
  const automaticSources = enabledSources.filter((source) => source.kind !== "manual");
  const automaticCurrent = automaticSources.filter((source) => {
    const sourcePositions = sortedPositions.filter((position) => {
      const expectedArea = areaFor(source.kind);
      return position.area === expectedArea && position.label.startsWith(positionLabel(source).split(" ")[0]);
    });
    return sourcePositions.length > 0
      && sourcePositions.every((position) => position.status === "current");
  }).length;
  const confirmed = sortedPositions.filter((position) =>
    position.status === "confirmed" || Boolean(position.confirmedAt)
  ).length;
  const warnings: string[] = [];
  if (!marketData) warnings.push("Anlagenwerte konnten nicht geladen werden");
  if (!complete) warnings.push("Der Gesamtwert ist wegen fehlender Teilwerte nicht verfügbar");
  if (sortedPositions.some((position) => position.status === "stale")) {
    warnings.push("Mindestens ein automatischer Wert ist nicht aktuell");
  }
  const hasMissing = sortedPositions.some((position) =>
    position.status === "error" || position.status === "unavailable"
  );
  const latestMarketDate = db.latestAssetMarketSnapshotDate();
  return {
    generatedAt: now.toISOString(),
    state: hasMissing ? "partial"
      : sortedPositions.some((position) => position.status === "stale") ? "stale" : "current",
    totalMinor,
    basis: "latest-available",
    marketHistory: {
      status: latestMarketDate === marketSnapshotDate(now, config.timezone) ? "current" : "pending",
      latestDate: latestMarketDate
    },
    summary: {
      automaticCurrent,
      automaticTotal: automaticSources.length,
      confirmed
    },
    areas,
    positions: sortedPositions,
    warnings
  };
}
