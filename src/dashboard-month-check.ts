import { createHash } from "node:crypto";

export type CheckState = "ok" | "difference" | "unknown" | "open" | "na" | "error";
export interface CheckResult { state: CheckState; label: string; reason: string; code: string }
export interface BalanceEvidence {
  date: string; amountMinor: number; currency: string; type: string; source: string;
  dayClosed?: boolean; observedAt?: string;
}
export interface MonthAccountInput {
  key: string; label: string; kind: "bank" | "card" | "paypal" | "enrichment" | "other";
  currency: string; sourceLabel: string; lastSuccessAt: string | null;
  balances: BalanceEvidence[];
  movementMinor: number | null; transactionCount: number;
  actualMovementMinor: number | null; uncategorized: number | null;
  transferLinks: number | null; hasUnverifiedTransfer: boolean;
  coverage: CheckResult; issues: string[]; mappingAmbiguous?: boolean;
}
export interface MonthCheckAccount {
  key: string; label: string; kind: MonthAccountInput["kind"]; currency: string;
  balance: CheckResult; coverage: CheckResult; assignment: CheckResult;
  sourceLabel: string; lastSuccessAt: string | null;
  evidence: { opening: BalanceEvidence | null; closing: BalanceEvidence | null;
    movementMinor: number | null; differenceMinor: number | null; actualDifferenceMinor: number | null;
    transactionCount: number; uncategorized: number | null; transferLinks: number | null; notes: string[] };
}
export const result = (state: CheckState, label: string, code: string, reason: string): CheckResult => ({ state, label, code, reason });
export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}
export function monthCheckPeriod(value?: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).formatToParts(now);
  const current = `${parts.find(p => p.type === "year")!.value}-${parts.find(p => p.type === "month")!.value}`;
  const latestMonth = shiftMonth(current, -1);
  const month = value ?? latestMonth;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < "2000-01" || month > latestMonth) {
    throw new Error("Bitte einen abgeschlossenen Monat ab Januar 2000 auswählen.");
  }
  const end = (m: string) => new Date(Date.parse(`${shiftMonth(m, 1)}-01T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
  return { month, latestMonth, startDate: `${month}-01`, endDate: end(month), openingDate: end(shiftMonth(month, -1)) };
}

function boundary(rows: BalanceEvidence[], date: string, currency: string) {
  // A CLBD fetched during its reference day cannot prove that day's final balance.
  const values = rows.filter(b => b.date === date && b.type === "CLBD" && b.dayClosed === true && b.currency === currency && Number.isSafeInteger(b.amountMinor));
  const unique = new Set(values.map(b => b.amountMinor));
  return { value: unique.size === 1 ? values[0] : null, conflict: unique.size > 1 };
}

export function checkMonthAccount(input: MonthAccountInput, period: ReturnType<typeof monthCheckPeriod>): MonthCheckAccount {
  const opening = boundary(input.balances, period.openingDate, input.currency);
  const closing = boundary(input.balances, period.endDate, input.currency);
  let differenceMinor: number | null = null;
  let balance = result("unknown", "Nicht prüfbar", "BOUNDARY_MISSING", "Kein belegter Tagesabschlusssaldo zum Monatsanfang oder Monatsende. Ein am Stichtag morgens abgerufener CLBD-Saldo ist noch kein Tagesabschluss; Intraday- und verfügbare Salden reichen ebenfalls nicht aus.");
  if (input.kind === "enrichment") balance = result("na", "Nicht anwendbar", "ENRICHMENT", "Detailanreicherung, kein zusätzlich zu summierendes Zahlungskonto.");
  else if (input.mappingAmbiguous) balance = result("unknown", "Nicht prüfbar", "MAPPING_AMBIGUOUS", "Die Kontenzuordnung ist nicht eindeutig; Quellen werden nicht zusammengezählt.");
  else if (opening.conflict || closing.conflict) balance = result("unknown", "Nicht prüfbar", "BOUNDARY_CONFLICT", "Widersprüchliche belegte Salden am selben Stichtag. Eine Revision muss geklärt werden.");
  else if (opening.value && closing.value && input.movementMinor !== null && Number.isSafeInteger(input.movementMinor)) {
    const delta = opening.value.amountMinor + input.movementMinor - closing.value.amountMinor;
    if (Number.isSafeInteger(delta)) {
      differenceMinor = delta;
      balance = delta === 0
        ? result("ok", "Abgestimmt", "BALANCE_MATCH", "Anfangssaldo plus gebuchte Bewegungen entspricht dem Endsaldo. Das allein beweist keine Vollständigkeit.")
        : result("difference", "Abweichung", "BALANCE_DIFFERENCE", "Anfangssaldo plus gebuchte Bewegungen weicht vom belegten Endsaldo ab.");
    }
  }
  const actualDifferenceMinor = input.actualMovementMinor !== null && input.movementMinor !== null && !input.mappingAmbiguous
    && Number.isSafeInteger(input.actualMovementMinor - input.movementMinor)
    ? input.actualMovementMinor - input.movementMinor : null;
  const assignment = input.uncategorized === null
    ? result("unknown", "Nicht prüfbar", "ACTUAL_UNAVAILABLE", "Die Actual-Zuordnung konnte für diesen Monat nicht gelesen werden.")
    : input.uncategorized > 0 || input.hasUnverifiedTransfer || (actualDifferenceMinor !== null && actualDifferenceMinor !== 0)
      ? result("open", "Offen", "ASSIGNMENT_OPEN", `${input.uncategorized} Buchungen ohne Kategorie.${input.hasUnverifiedTransfer ? " Zahlungswegverknüpfungen sind nicht vollständig belegt." : ""}${actualDifferenceMinor ? " Actual- und Quellenbewegungen unterscheiden sich." : ""}`)
      : result("ok", "Kategorisiert", "CATEGORIES_PRESENT", "Keine offenen Kategorien im gelesenen Actual-Stand. Kein Nachweis der Belegvollständigkeit.");
  return {
    key: input.key, label: input.label, kind: input.kind, currency: input.currency,
    balance, coverage: input.coverage, assignment, sourceLabel: input.sourceLabel, lastSuccessAt: input.lastSuccessAt,
    evidence: { opening: opening.value, closing: closing.value, movementMinor: input.movementMinor,
      differenceMinor, actualDifferenceMinor, transactionCount: input.transactionCount, uncategorized: input.uncategorized,
      transferLinks: input.transferLinks, notes: input.issues }
  };
}

export function buildMonthCheck(inputs: MonthAccountInput[], period: ReturnType<typeof monthCheckPeriod>, now = new Date()) {
  const accounts = inputs.map(input => checkMonthAccount(input, period));
  const relevant = accounts.filter(a => a.kind !== "enrichment");
  const state = !relevant.length ? "empty" : relevant.some(a => a.balance.state === "difference") ? "difference"
    : relevant.every(a => a.balance.state === "ok" && a.coverage.state === "ok" && a.assignment.state === "ok") ? "ok" : "partial";
  return { ...period, generatedAt: now.toISOString(), state,
    fingerprint: createHash("sha256").update(JSON.stringify({period, accounts})).digest("hex"),
    accounts,
    note: "Dieser Check verändert keine Buchungen. Ein ausgeglichener Saldo allein beweist keine Vollständigkeit. Historische Monatsabschlüsse werden nicht verändert." };
}
