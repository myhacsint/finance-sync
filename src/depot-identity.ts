import { sha256 } from "./archive.js";

/** Economic fields of a depot turnover that carries no bank reference. */
export interface DepotEconomics {
  accountId: string;
  symbol: string;
  type: string;
  occurredAt: string;
  quantityAtomic: string;
  atomicDecimals: number;
  amountMinor?: bigint | number | null;
  currency?: string | null;
}

function canonicalQuantity(atomic: string, decimals: number): string {
  const negative = atomic.startsWith("-");
  const digits = atomic.replace(/^-/, "").padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals).replace(/^0+(?=\d)/, "");
  const fraction = digits.slice(digits.length - decimals).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function depotEconomicKey(item: DepotEconomics): string {
  return [
    item.accountId, item.symbol, item.type, item.occurredAt,
    canonicalQuantity(item.quantityAtomic, item.atomicDecimals),
    item.amountMinor === undefined || item.amountMinor === null ? "" : String(item.amountMinor),
    item.currency ?? ""
  ].join(":");
}

/**
 * Identity for a turnover the bank reports as `RELA//NONREF`. Identical
 * turnovers in one report are distinguished by their occurrence index, so two
 * equal partial executions on the same day stay two records.
 */
export function depotEconomicActivityId(item: DepotEconomics, occurrence: number): string {
  return sha256(`nonref:v1:${depotEconomicKey(item)}:${occurrence}`);
}

/** Activity id that releases up to 0.55.1 derived from the `NONREF` placeholder. */
export function legacyNonrefActivityId(accountId: string, symbol: string): string {
  return sha256(`${accountId}:${sha256(`${symbol}:NONREF`)}`);
}
