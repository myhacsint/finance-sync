import { join } from "node:path";
import { writeAtomic } from "./archive.js";
import type { FinanceDatabase } from "./database.js";

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  return [
    headers.map(csvCell).join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n") + "\n";
}

export function exportAll(db: FinanceDatabase, archiveRoot: string): void {
  const exportsDir = join(archiveRoot, "exports");
  const datasets: Array<[string, string]> = [
    ["transactions.csv", `
      SELECT source_id, source_transaction_id, account_id, booked_at, value_at,
        amount_minor, currency, payee, memo, category, owner,
        counterparty_iban, internal_transfer_id, raw_hash
      FROM transactions ORDER BY booked_at, id
    `],
    ["balances.csv", `
      SELECT source_id, account_id, captured_at, amount_minor, currency, owner, raw_hash
      FROM balances ORDER BY captured_at, id
    `],
    ["holdings.csv", `
      SELECT source_id, account_id, captured_at, symbol, name, quantity_atomic,
        atomic_decimals, price_minor, currency, price_atomic, price_decimals,
        price_currency, market_value_minor, market_value_currency, owner, raw_hash
      FROM holdings ORDER BY captured_at, account_id, symbol
    `],
    ["investment_activities.csv", `
      SELECT source_id, source_activity_id, account_id, occurred_at, type, symbol,
        quantity_atomic, atomic_decimals, amount_minor, currency, fee_minor, note, raw_hash
      FROM investment_activities ORDER BY occurred_at, id
    `],
    ["sync_status.csv", `
      SELECT id AS source_id, kind, enabled, state, message, last_attempt_at,
        last_success_at, next_due_at FROM sources ORDER BY id
    `]
  ];
  for (const [file, query] of datasets) {
    writeAtomic(join(exportsDir, file), toCsv(db.query(query)));
  }
}
