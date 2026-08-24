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
  getTransactions(accountId: string, startDate: string, endDate: string): Promise<Array<{
    id: string;
    amount: number;
    date: string;
    imported_id?: string;
    transfer_id?: string | null;
    notes?: string;
  }>>;
  getPayees(): Promise<Array<{ id: string; name: string; transfer_acct?: string }>>;
  updateTransaction(id: string, fields: {
    payee?: string;
    transfer_id?: string;
    category?: null;
    notes?: string;
  }): Promise<unknown>;
  sync(): Promise<unknown>;
  shutdown(): Promise<void>;
}

export interface MilesMoreSettlementPreview {
  status: "ready" | "not-found" | "ambiguous" | "already-linked";
  amountMinor: number;
  date: string | null;
  sourceAccountName: string | null;
  candidates: number;
}

interface SettlementCandidate {
  transactionId: string;
  sourceAccountId: string;
  sourceAccountName: string;
  date: string;
  amountMinor: number;
  transferId?: string | null;
}

function isoOffset(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function settlementCandidates(
  api: ActualMilesApi,
  accounts: Array<{ id: string; name: string }>,
  cardId: string,
  statement: MilesMoreStatement
): Promise<SettlementCandidate[]> {
  const startDate = isoOffset(statement.statementDate, -2);
  const endDate = isoOffset(statement.statementDate, 14);
  const cardTransactionIds = new Set(
    (await api.getTransactions(cardId, startDate, endDate)).map((item) => item.id)
  );
  const matches = await Promise.all(accounts.filter((account) => account.id !== cardId).map(async (account) =>
    (await api.getTransactions(account.id, startDate, endDate))
      .filter((item) => item.amount === statement.balanceMinor
        && (!item.transfer_id || cardTransactionIds.has(item.transfer_id)))
      .map((item) => ({
        transactionId: item.id,
        sourceAccountId: account.id,
        sourceAccountName: account.name,
        date: item.date,
        amountMinor: item.amount,
        transferId: item.transfer_id
      }))
  ));
  return matches.flat();
}

function settlementPreview(statement: MilesMoreStatement, candidates: SettlementCandidate[]): MilesMoreSettlementPreview {
  const linked = candidates.filter((item) => item.transferId);
  const open = candidates.filter((item) => !item.transferId);
  const selected = linked.length === 1 ? linked[0] : open.length === 1 ? open[0] : null;
  return {
    status: linked.length === 1 ? "already-linked" : open.length === 1 ? "ready" : open.length === 0 ? "not-found" : "ambiguous",
    amountMinor: Math.abs(statement.balanceMinor),
    date: selected?.date ?? null,
    sourceAccountName: selected?.sourceAccountName ?? null,
    candidates: open.length
  };
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

export async function previewMilesMoreWithActual(options: {
  text: string;
  statementDate: string;
  serverURL: string;
  budgetId: string;
  password: string;
  loadApi: () => Promise<ActualMilesApi>;
}): Promise<ReturnType<typeof previewMilesMore> & { settlement: MilesMoreSettlementPreview }> {
  const statement = parseMilesMoreStatement(options.text, options.statementDate);
  const dataDir = mkdtempSync(join(tmpdir(), "finance-miles-preview-"));
  const api = await options.loadApi();
  let initialized = false;
  try {
    await api.init({ dataDir, serverURL: options.serverURL, password: options.password });
    initialized = true;
    await api.downloadBudget(options.budgetId);
    const accounts = await api.getAccounts();
    const card = accounts.find((item) => /kreditkarte/i.test(item.name));
    if (!card) throw new Error("Kartenkonto 'Kreditkarte' nicht gefunden");
    const candidates = await settlementCandidates(api, accounts, card.id, statement);
    return { ...previewMilesMore(options.text, options.statementDate), settlement: settlementPreview(statement, candidates) };
  } finally {
    if (initialized) await api.shutdown().catch(() => undefined);
    rmSync(dataDir, { recursive: true, force: true });
  }
}

export async function importMilesMoreStatement(options: {
  text: string;
  statementDate: string;
  serverURL: string;
  budgetId: string;
  password: string;
  loadApi: () => Promise<ActualMilesApi>;
}): Promise<{ added: number; statement: MilesMoreStatement; settlement: MilesMoreSettlementPreview }> {
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
    const candidates = await settlementCandidates(api, accounts, card.id, statement);
    const settlement = settlementPreview(statement, candidates);
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
    const openCandidate = candidates.filter((item) => !item.transferId);
    const paymentImportedId = `miles-more-payment:${statement.statementDate}:${Math.abs(statement.balanceMinor)}`;
    const paymentRow = settlement.status === "ready" ? [{
      account: card.id,
      date: openCandidate[0].date,
      amount: Math.abs(statement.balanceMinor),
      payee_name: openCandidate[0].sourceAccountName,
      notes: `Kreditkartenabrechnung ${statement.statementDate}`,
      imported_id: paymentImportedId,
      cleared: true
    }] : [];
    const imported = await api.importTransactions(card.id, [...rows, ...paymentRow], { defaultCleared: true });
    if (imported.errors?.length) throw new Error(imported.errors.map((item) => item.message).join("; "));
    if (settlement.status === "ready") {
      const cardSide = (await api.getTransactions(card.id, openCandidate[0].date, openCandidate[0].date))
        .filter((item) => item.imported_id === paymentImportedId);
      if (cardSide.length !== 1) throw new Error("Karten-Ausgleichsgegenbuchung ist nicht eindeutig");
      const payees = await api.getPayees();
      const toCard = payees.filter((item) => item.transfer_acct === card.id);
      const toSource = payees.filter((item) => item.transfer_acct === openCandidate[0].sourceAccountId);
      if (toCard.length !== 1 || toSource.length !== 1) throw new Error("Transferkonten sind nicht eindeutig");
      await api.updateTransaction(openCandidate[0].transactionId, {
        payee: toCard[0].id,
        transfer_id: cardSide[0].id,
        category: null,
        notes: `Kreditkartenabrechnung ${statement.statementDate}`
      });
      await api.updateTransaction(cardSide[0].id, {
        payee: toSource[0].id,
        transfer_id: openCandidate[0].transactionId,
        category: null,
        notes: `Kreditkartenabrechnung ${statement.statementDate}`
      });
    }
    await api.sync();
    return { added: imported.added?.length ?? rows.length + paymentRow.length, statement, settlement };
  } finally {
    if (initialized) await api.shutdown().catch(() => undefined);
    rmSync(dataDir, { recursive: true, force: true });
  }
}
