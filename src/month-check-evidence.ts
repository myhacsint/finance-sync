import { createHash } from "node:crypto";
import { openSync, closeSync, fstatSync, readFileSync, realpathSync, constants } from "node:fs";
import { resolve, sep } from "node:path";
import type { FinanceDatabase } from "./database.js";
import type { AppConfig } from "./types.js";
import type { ActualSpendingRangeSnapshot } from "./dashboard-spending.js";
import { monthCheckPeriod, shiftMonth, result, type BalanceEvidence, type MonthAccountInput } from "./dashboard-month-check.js";

export function monthAccountKey(id: string) {
  return `account-${createHash("sha256").update(`finance-hub:account:${id}`).digest("hex").slice(0, 12)}`;
}
function purposeLabel(name: string, index: number) {
  if (/amazon/i.test(name)) return "Amazon · Anreicherung";
  if (/paypal/i.test(name)) return "PayPal";
  if (/miles|kredit|credit|mastercard|visa/i.test(name)) return "Kreditkarte";
  const bank = /comdirect/i.test(name) ? "comdirect" : /dkb/i.test(name) ? "DKB" : "";
  return `${bank ? bank + " " : ""}Giro ${/gemeinschaft/i.test(name) ? "Gemeinschaft" : String(index + 1)}`;
}
function minor(value: unknown): number | null {
  if (typeof value !== "string" || !/^-?\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const negative = value.startsWith("-");
  const [whole, cents = ""] = value.replace(/^-/, "").split(".");
  const n = Number(whole) * 100 + Number(cents.padEnd(2, "0"));
  return Number.isSafeInteger(n) ? (negative ? -n : n) : null;
}
// Read just the fields needed for validation. Full JSON is never returned to callers/UI.
export function bankBalanceEvidence(raw: unknown, accountId: string): BalanceEvidence[] {
  const rows = (raw as { balances?: Record<string, { balances?: unknown[] }> } | null)?.balances?.[accountId]?.balances;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap(value => {
    const row = value as { balance_type?: unknown; reference_date?: unknown; balance_amount?: { amount?: unknown; currency?: unknown } };
    const amountMinor = minor(row?.balance_amount?.amount);
    const date = String(row?.reference_date ?? "");
    const currency = String(row?.balance_amount?.currency ?? "");
    if (amountMinor === null || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^[A-Z]{3}$/.test(currency)) return [];
    return [{ date, amountMinor, currency, type: ["CLBD", "ITBD", "CLAV", "ITAV"].includes(String(row.balance_type)) ? String(row.balance_type) : "UNKNOWN", source: "Bank-Rohbeleg" }];
  });
}

export function readVerifiedMonthRaw(root: string, relativePath: string, hash: string): { raw: unknown; bytes: number } {
  const base = realpathSync(root);
  const target = realpathSync(resolve(base, relativePath));
  if (!target.startsWith(base + sep) || !/^[a-f0-9]{64}$/.test(hash)) throw new Error("EVIDENCE_INVALID");
  const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.size > 8 * 1024 * 1024) throw new Error("EVIDENCE_LIMIT");
    const bytes = readFileSync(fd);
    if (bytes.length > 8 * 1024 * 1024 || createHash("sha256").update(bytes).digest("hex") !== hash) throw new Error("EVIDENCE_INVALID");
    return { raw: JSON.parse(bytes.toString("utf8")), bytes: bytes.length };
  } finally { closeSync(fd); }
}

export function readMonthEvidence(db: FinanceDatabase, config: AppConfig, root: string,
  period: ReturnType<typeof monthCheckPeriod>, actual: ActualSpendingRangeSnapshot | null): MonthAccountInput[] {
  const sourceIds = config.sources.filter(s => s.kind === "enable-banking" && s.enabled).map(s => s.id);
  const banks = db.query("SELECT DISTINCT source_id,account_id,currency FROM balances ORDER BY source_id,account_id,currency")
    .filter(r => sourceIds.includes(String(r.source_id)));
  const counts = new Map<string, number>();
  for (const bank of banks) {
    const target = config.actual?.accountMap[String(bank.account_id)];
    if (target) counts.set(target, (counts.get(target) ?? 0) + 1);
  }
  // Entire normalized read occurs synchronously, so a source run cannot interleave writes.
  const sourceRows = db.query("SELECT id,last_success_at FROM sources");
  const rawRows = db.db.prepare(`SELECT hash,source_id,relative_path FROM raw_objects
    WHERE source_id IN (${sourceIds.map(() => "?").join(",") || "NULL"}) AND media_type='application/json' AND (substr(fetched_at,1,10) BETWEEN ? AND ? OR substr(fetched_at,1,10) BETWEEN ? AND ?)
    ORDER BY fetched_at DESC LIMIT 256`).all(
      ...sourceIds,
      period.openingDate, `${period.month}-04`, period.endDate,
      new Date(Date.parse(`${period.endDate}T00:00:00Z`) + 4 * 86400000).toISOString().slice(0, 10)
    ) as Array<{ hash: string; source_id: string; relative_path: string }>;
  const verified: Array<{ source: string; raw: unknown }> = [];
  let bytes = 0;
  const unavailable = new Set<string>();
  for (const row of rawRows.filter(r => sourceIds.includes(r.source_id))) {
    if (bytes >= 64 * 1024 * 1024) { unavailable.add(row.source_id); continue; }
    try { const file = readVerifiedMonthRaw(root, row.relative_path, row.hash); bytes += file.bytes; verified.push({source: row.source_id, raw: file.raw}); }
    catch { unavailable.add(row.source_id); }
  }
  const inputs: MonthAccountInput[] = banks.map((bank, index) => {
    const id = String(bank.account_id), source = String(bank.source_id), currency = String(bank.currency);
    const target = config.actual?.accountMap[id];
    const key = target ? monthAccountKey(target) : `unmapped-${index}`;
    const ledger = actual?.monthCheckAccounts?.find(a => a.key === key);
    const lines = actual?.lines.filter(l => l.accountKey === key) ?? [];
    const ambiguous = !target || counts.get(target)! > 1;
    const tx = db.db.prepare("SELECT amount_minor,currency FROM transactions WHERE source_id=? AND account_id=? AND booked_at>=? AND booked_at<? ORDER BY id")
      .all(source, id, period.startDate, `${shiftMonth(period.month, 1)}-01`) as Array<{ amount_minor: number; currency: string }>;
    const sum = tx.reduce((n, t) => n + t.amount_minor, 0);
    const valid = tx.every(t => t.currency === currency && Number.isSafeInteger(t.amount_minor)) && Number.isSafeInteger(sum);
    const evidence = verified.filter(v => v.source === source).flatMap(v => bankBalanceEvidence(v.raw, id));
    const label = purposeLabel(actual?.accounts.find(a => a.key === key)?.label ?? source, index);
    return {
      key: `bank-${index}`, label, kind: "bank", currency, sourceLabel: "Enable Banking · Bank-Rohbelege",
      lastSuccessAt: String(sourceRows.find(s => s.id === source)?.last_success_at ?? "") || null,
      balances: unavailable.has(source) || rawRows.length === 256 ? [] : evidence, movementMinor: valid && !ambiguous ? sum : null, transactionCount: tx.length,
      actualMovementMinor: currency === "EUR" ? ledger?.movementMinor ?? null : null, uncategorized: ledger ? lines.length : null,
      transferLinks: ledger?.transferLinks ?? null, hasUnverifiedTransfer: ledger?.unverifiedTransfers !== 0,
      mappingAmbiguous: ambiguous,
      coverage: result("unknown", "Unklar", "REQUEST_COVERAGE_UNRECORDED", "Die archivierten Antworten dokumentieren nicht durchgehend den angefragten Zeitraum und die vollständige Pagination. Ein erfolgreicher Abruf ist kein Vollständigkeitsnachweis."),
      issues: ["Saldenbelege werden in den vier Tagen nach jeder Monatsgrenze gesucht. Fehlende Belege bedeuten nicht automatisch fehlende Buchungen.",
        ...(ambiguous ? ["Konten-Mapping fehlt oder mehrere Quellen/Währungen sind demselben Actual-Konto zugeordnet."] : []),
        ...(!valid ? ["Währung oder Betragsgenauigkeit der Quellenbewegungen ist uneindeutig."] : []),
        ...(currency !== "EUR" ? ["Fremdwährungsbewegungen werden nicht mit dem EUR-Actual-Budget verglichen."] : []),
        ...(unavailable.has(source) || rawRows.length === 256 ? ["Ein Teil der Belege ist nicht lesbar oder liegt außerhalb der begrenzten Belegprüfung."] : [])]
    };
  });
  const mapped = new Set(banks.map(b => config.actual?.accountMap[String(b.account_id)]).filter(Boolean).map(id => monthAccountKey(id!)));
  for (const [index, account] of (actual?.accounts ?? []).entries()) {
    if (mapped.has(account.key)) continue;
    const kind = /amazon/i.test(account.label) ? "enrichment" : /paypal/i.test(account.label) ? "paypal" : /kredit|miles|credit|visa|mastercard/i.test(account.label) ? "card" : "other";
    const ledger = actual?.monthCheckAccounts?.find(a => a.key === account.key);
    inputs.push({ key: `ledger-${index}`, label: kind === "other" ? `Weiteres Konto ${index + 1}` : purposeLabel(account.label, index), kind,
      currency: "EUR", sourceLabel: "Actual · importierte Buchungen", lastSuccessAt: null,
      balances: [], movementMinor: null, actualMovementMinor: ledger?.movementMinor ?? null, transactionCount: ledger?.transactions ?? 0,
      uncategorized: actual!.lines.filter(l => l.accountKey === account.key).length,
      transferLinks: ledger?.transferLinks ?? null, hasUnverifiedTransfer: kind !== "enrichment",
      coverage: kind === "enrichment" ? result("na", "Anreicherung", "ENRICHMENT", "Amazon-Bestelldaten ergänzen den Zahlungsweg. Sie werden hier nicht als zusätzliche Ausgaben addiert.")
        : result("unknown", "Unklar", "STATEMENT_COVERAGE_UNRECORDED", "Importierte Buchungen werden geprüft, aber es fehlt ein verifizierter Abdeckungsnachweis für den ganzen Monat. Abrechnungszyklen können Monatsgrenzen überschreiten."),
      issues: ["Der aktuelle Actual-Abruf belegt nicht, wann die ursprünglichen Abrechnungen zuletzt vollständig importiert wurden.",
        kind === "enrichment" ? "Kein zusätzlicher Salden- oder Ausgabenbeitrag." : "Bestehende Transfers werden nur gelesen. Betragsgleiche Buchungen werden nicht automatisch verbunden.",
        ...(kind === "card" ? ["Vor März 2026 liegen keine Kreditkarten-Einzelabrechnungen vor. Keine historische Hochrechnung in diesem Check."] : []),
        ...(kind === "paypal" ? ["Guthaben, Giro- und Kartenfinanzierung sowie Erstattungen können unterschiedliche Zahlungswege bilden."] : [])]
    });
  }
  return inputs;
}
