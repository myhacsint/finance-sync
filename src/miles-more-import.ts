import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseMilesMoreStatement, type MilesMoreStatement } from "./miles-more-statement.js";

interface ActualMilesApi {
  init(options: { dataDir: string; serverURL: string; password: string }): Promise<unknown>;
  downloadBudget(id: string): Promise<void>;
  getAccounts(): Promise<Array<{ id: string; name: string }>>;
  getCategories(): Promise<Array<{ id?: string; name?: string; categories?: Array<{ id: string; name: string }> }>>;
  importTransactions(accountId: string, transactions: unknown[], options?: { defaultCleared?: boolean }): Promise<{ errors: Array<{ message: string }>; added?: unknown[] }>;
  sync(): Promise<unknown>;
  shutdown(): Promise<void>;
}

export function previewMilesMore(text: string, statementDate: string): {
  statementDate: string;
  balanceMinor: number;
  bookings: number;
  categorized: number;
  payees: string[];
} {
  const parsed = parseMilesMoreStatement(text, statementDate);
  return {
    statementDate: parsed.statementDate,
    balanceMinor: parsed.balanceMinor,
    bookings: parsed.transactions.length,
    categorized: parsed.transactions.filter((item) => item.categoryName).length,
    payees: parsed.transactions.map((item) => item.payee)
  };
}

export async function importMilesMoreStatement(options: {
  text: string;
  statementDate: string;
  serverURL: string;
  budgetId: string;
  password: string;
  loadApi: () => Promise<ActualMilesApi>;
}): Promise<{ added: number; statement: MilesMoreStatement }> {
  const statement = parseMilesMoreStatement(options.text, options.statementDate);
  const dataDir = mkdtempSync(join(tmpdir(), "finance-miles-more-"));
  const api = await options.loadApi();
  let initialized = false;
  try {
    await api.init({ dataDir, serverURL: options.serverURL, password: options.password });
    initialized = true;
    await api.downloadBudget(options.budgetId);
    const accounts = await api.getAccounts();
    const card = accounts.find((item) => /kreditkarte/i.test(item.name));
    if (!card) throw new Error("Kartenkonto 'Kreditkarte' nicht gefunden");
    const rawCategories = await api.getCategories();
    const categories = rawCategories.flatMap((row) => row.categories ?? (row.id && row.name ? [{ id: row.id, name: row.name }] : []));
    const categoryIds = new Map(categories.map((item) => [item.name, item.id]));
    const rows = statement.transactions.map((item) => ({
      account: card.id,
      date: item.purchaseDate,
      amount: item.amountMinor,
      payee_name: item.payee,
      imported_payee: item.rawPayee,
      category: item.categoryName ? categoryIds.get(item.categoryName) : undefined,
      notes: item.notes,
      imported_id: item.importedId,
      cleared: true
    }));
    const imported = await api.importTransactions(card.id, rows, { defaultCleared: true });
    if (imported.errors?.length) throw new Error(imported.errors.map((item) => item.message).join("; "));
    await api.sync();
    return { added: imported.added?.length ?? rows.length, statement };
  } finally {
    if (initialized) await api.shutdown().catch(() => undefined);
    rmSync(dataDir, { recursive: true, force: true });
  }
}
