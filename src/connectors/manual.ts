import type { SourceConfig, ImportBundle } from "../types.js";
import { sha256 } from "../archive.js";

interface ManualSnapshot {
  accountId: string;
  capturedAt?: string;
  amount: string | number;
  currency: string;
  owner?: string;
  document?: {
    relativePath: string;
    sha256: string;
    mediaType?: string;
    createdAt?: string;
  };
  holdings?: Array<{
    symbol: string;
    name?: string;
    quantityAtomic: string;
    atomicDecimals: number;
    priceMinor?: string | number;
    currency?: string;
    priceAtomic?: string;
    priceDecimals?: number;
    priceCurrency?: string;
    marketValueMinor?: string | number;
    marketValueCurrency?: string;
  }>;
}

function decimalToMinor(value: string | number): bigint {
  const normalized = String(value).replace(",", ".");
  if (!/^-?\d+(\.\d{1,2})?$/.test(normalized)) {
    throw new Error("Betrag muss höchstens zwei Nachkommastellen haben");
  }
  const [whole, fraction = ""] = normalized.split(".");
  const negative = whole.startsWith("-");
  const absoluteWhole = negative ? whole.slice(1) : whole;
  const minor = BigInt(absoluteWhole) * 100n + BigInt(fraction.padEnd(2, "0"));
  return negative ? -minor : minor;
}

export function manualSnapshotBundle(
  source: SourceConfig,
  snapshot: ManualSnapshot
): ImportBundle {
  const capturedAt = snapshot.capturedAt ?? new Date().toISOString();
  const raw = { ...snapshot, capturedAt };
  const rawHash = sha256(JSON.stringify(raw));
  return {
    raw,
    balances: [{
      sourceId: source.id,
      accountId: snapshot.accountId,
      capturedAt,
      amountMinor: decimalToMinor(snapshot.amount),
      currency: snapshot.currency.toUpperCase(),
      owner: snapshot.owner,
      rawHash
    }],
    holdings: snapshot.holdings?.map((holding) => ({
      sourceId: source.id,
      accountId: snapshot.accountId,
      capturedAt,
      symbol: holding.symbol,
      name: holding.name,
      quantityAtomic: holding.quantityAtomic,
      atomicDecimals: holding.atomicDecimals,
      priceMinor: holding.priceMinor === undefined ? undefined : BigInt(holding.priceMinor),
      currency: (holding.currency ?? snapshot.currency).toUpperCase(),
      priceAtomic: holding.priceAtomic,
      priceDecimals: holding.priceDecimals,
      priceCurrency: holding.priceCurrency?.toUpperCase(),
      marketValueMinor: holding.marketValueMinor === undefined
        ? undefined
        : BigInt(holding.marketValueMinor),
      marketValueCurrency: holding.marketValueCurrency?.toUpperCase(),
      owner: snapshot.owner,
      rawHash
    }))
  };
}
