import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSecret } from "./config.js";
import type { AppConfig } from "./types.js";

interface ActualAccount {
  id: string;
  name: string;
  offbudget?: boolean;
}

interface ActualCategory {
  id: string;
  name: string;
  is_income?: boolean;
  hidden?: boolean;
  group_id?: string;
}

interface ActualCategoryGroup {
  id: string;
  name: string;
  is_income?: boolean;
  hidden?: boolean;
  categories?: ActualCategory[];
}

interface ActualPayee {
  id: string;
  name: string;
  transfer_acct?: string;
}

interface ActualTransaction {
  id: string;
  is_parent?: boolean;
  is_child?: boolean;
  account: string;
  category?: string;
  amount: number;
  payee?: string | null;
  notes?: string;
  date: string;
  imported_payee?: string;
  starting_balance_flag?: boolean;
  transfer_id?: string;
  subtransactions?: ActualTransaction[];
}

interface ActualSpendingApi {
  init(options: { dataDir: string; serverURL: string; password: string }): Promise<unknown>;
  downloadBudget(id: string): Promise<void>;
  getAccounts(): Promise<ActualAccount[]>;
  getCategories(options?: { hidden?: boolean }): Promise<Array<ActualCategory | ActualCategoryGroup>>;
  getPayees(): Promise<ActualPayee[]>;
  getTransactions(accountId: string, startDate: string, endDate: string): Promise<ActualTransaction[]>;
  shutdown(): Promise<void>;
}

export type ActualSpendingApiLoader = () => Promise<ActualSpendingApi>;

export interface SpendingLine {
  id: string;
  date: string;
  merchantKey: string;
  merchant: string;
  displayMerchant?: string;
  notes: string;
  accountKey: string;
  accountLabel: string;
  categoryKey: string;
  categoryLabel: string;
  categorized: boolean;
  amountMinor: number;
}

export interface SpendingCatalogCategory {
  key: string;
  id: string;
  name: string;
  group: string;
  isIncome: boolean;
}

export interface ActualSpendingRangeSnapshot {
  startDate: string;
  endDate: string;
  generatedAt: string;
  lines: SpendingLine[];
  accounts: Array<{ key: string; label: string }>;
  catalog: SpendingCatalogCategory[];
}

export interface ActualSpendingMonthSnapshot {
  month: string;
  monthLabel: string;
  latestMonth: string;
  oldestMonth: string;
  generatedAt: string;
  lines: SpendingLine[];
  accounts: Array<{ key: string; label: string }>;
  catalog: SpendingCatalogCategory[];
}

export interface SpendingQuery {
  category?: string;
  account?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface DashboardSpending {
  generatedAt: string;
  state: "current";
  source: "Actual";
  month: string;
  monthLabel: string;
  latestMonth: string;
  oldestMonth: string;
  summary: {
    totalMinor: number;
    bookings: number;
    categorizedPercent: number;
  };
  selection: {
    category: string;
    account: string;
    search: string;
  };
  filtered: {
    totalMinor: number;
    bookings: number;
  };
  categories: Array<{
    key: string;
    label: string;
    amountMinor: number;
    selected: boolean;
  }>;
  accounts: Array<{
    key: string;
    label: string;
  }>;
  transactions: Array<{
    date: string;
    merchant: string;
    account: string;
    category: string;
    amountMinor: number;
  }>;
  pagination: {
    page: number;
    pageSize: number;
    pages: number;
    total: number;
    from: number;
    to: number;
  };
}

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

export function shiftSpendingMonth(key: string, offset: number): string {
  const match = /^(\d{4})-(\d{2})$/.exec(key);
  if (!match) throw new Error("Ungültiger Ausgabenmonat");
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthDistance(left: string, right: string): number {
  const [leftYear, leftMonth] = left.split("-").map(Number);
  const [rightYear, rightMonth] = right.split("-").map(Number);
  return (leftYear - rightYear) * 12 + leftMonth - rightMonth;
}

export function spendingMonthSelection(
  now: Date,
  timezone: string,
  requested?: string
): { month: string; latestMonth: string; oldestMonth: string } {
  const current = monthParts(now, timezone);
  const currentMonth = `${current.year}-${String(current.month).padStart(2, "0")}`;
  const latestMonth = shiftSpendingMonth(currentMonth, -1);
  const oldestMonth = shiftSpendingMonth(latestMonth, -120);
  const valid = requested && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested)
    && monthDistance(requested, latestMonth) <= 0
    && monthDistance(requested, oldestMonth) >= 0;
  return { month: valid ? requested : latestMonth, latestMonth, oldestMonth };
}

function monthEnd(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${key}-${String(day).padStart(2, "0")}`;
}

function publicKey(kind: "account" | "category", id: string): string {
  return `${kind}-${createHash("sha256").update(`finance-hub:${kind}:${id}`).digest("hex").slice(0, 12)}`;
}

function safeLabel(value: unknown, fallback: string): string {
  const sanitized = String(value ?? "")
    .replace(/\b[A-Z]{2}\d{2}(?:\s?\d){11,30}\b/gi, "••••")
    .replace(/\b\d{6,}\b/g, "••••")
    .replace(/\s+/g, " ")
    .trim();
  return (sanitized || fallback).slice(0, 80);
}

function safeAccountLabel(value: unknown): string {
  const sanitized = safeLabel(value, "Konto")
    .replace(/\b\d{3,4}\s*(?:[.…•*xX-]\s*)+\d{3,4}\b/g, "")
    .replace(/\b\d{4,}\b/g, "")
    .replace(/\s*[-–—|/:]+\s*$/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return (sanitized || "Konto").slice(0, 80);
}

function likelyPrivatePerson(value: string): boolean {
  const business = /(?:gmbh|\bag\b|kg\b|e\.?v\.?|bank|kasse|markt|shop|store|restaurant|café|cafe|apotheke|versicherung|stadtwerke|telekom|amazon|paypal|lidl|bahn|hotel|reisen|verlag|buch|schule|praxis|arzt|klinik|service|energie|media|digital|software)/i;
  if (business.test(value)) return false;
  const parts = value.trim().split(/\s+/);
  return parts.length >= 2 && parts.length <= 4
    && parts.every((part) => /^[A-ZÄÖÜ][a-zäöüß'-]+$/.test(part));
}

function safeMerchant(value: unknown): string {
  const label = safeLabel(value, "Unbekannter Händler");
  return likelyPrivatePerson(label) ? "Private Gegenpartei" : label;
}

function merchantKey(
  transaction: ActualTransaction,
  parent: ActualTransaction,
  payee: ActualPayee | undefined,
  parentPayee: ActualPayee | undefined,
  merchant: string
): string {
  const stable = payee?.id ?? parentPayee?.id
    ?? transaction.imported_payee ?? parent.imported_payee ?? merchant;
  return `merchant-${createHash("sha256")
    .update(`finance-hub:merchant:${stable}`)
    .digest("hex").slice(0, 16)}`;
}

function categoriesFromApi(rows: Array<ActualCategory | ActualCategoryGroup>): ActualCategory[] {
  return rows.flatMap((row) => "categories" in row ? row.categories ?? [] : [row]);
}

function normalizeLine(
  transaction: ActualTransaction,
  parent: ActualTransaction,
  account: { key: string; label: string },
  categories: Map<string, ActualCategory>,
  payees: Map<string, ActualPayee>
): SpendingLine | null {
  const category = transaction.category ? categories.get(transaction.category) : undefined;
  const payee = transaction.payee ? payees.get(transaction.payee) : undefined;
  const parentPayee = parent.payee ? payees.get(parent.payee) : undefined;
  const transfer = Boolean(parent.transfer_id || transaction.transfer_id
    || parentPayee?.transfer_acct || payee?.transfer_acct);
  if (transfer || parent.starting_balance_flag || transaction.starting_balance_flag) return null;
  if (category?.is_income) return null;
  if (transaction.amount >= 0 && !category) return null;
  const amountMinor = -Math.round(transaction.amount);
  if (amountMinor === 0) return null;
  const categoryId = category?.id ?? "uncategorized";
  const displayMerchant = safeLabel(
    payee?.name ?? parentPayee?.name ?? transaction.imported_payee
      ?? parent.imported_payee ?? transaction.notes ?? parent.notes,
    "Unbekannter Händler"
  );
  const merchant = safeMerchant(displayMerchant);
  return {
    id: `${parent.id}:${transaction.id}`,
    date: transaction.date || parent.date,
    merchantKey: merchantKey(transaction, parent, payee, parentPayee, merchant),
    merchant,
    displayMerchant,
    notes: safeLabel(transaction.notes ?? parent.notes, ""),
    accountKey: account.key,
    accountLabel: account.label,
    categoryKey: category ? publicKey("category", categoryId) : "uncategorized",
    categoryLabel: safeLabel(category?.name, "Ohne Kategorie"),
    categorized: Boolean(category),
    amountMinor
  };
}

function normalizeTransactions(
  transactions: ActualTransaction[],
  account: { key: string; label: string },
  categories: Map<string, ActualCategory>,
  payees: Map<string, ActualPayee>
): SpendingLine[] {
  return transactions.flatMap((transaction) => {
    if (transaction.is_child) return [];
    const parts = transaction.is_parent && transaction.subtransactions?.length
      ? transaction.subtransactions
      : [transaction];
    return parts
      .map((part) => normalizeLine(part, transaction, account, categories, payees))
      .filter((line): line is SpendingLine => Boolean(line));
  });
}

export async function readActualSpendingMonth(
  config: NonNullable<AppConfig["actual"]>,
  timezone: string,
  requestedMonth?: string,
  now = new Date(),
  options: { loadApi?: ActualSpendingApiLoader; password?: string } = {}
): Promise<ActualSpendingMonthSnapshot> {
  const selected = spendingMonthSelection(now, timezone, requestedMonth);
  const snapshot = await readActualSpendingRange(
    config,
    `${selected.month}-01`,
    monthEnd(selected.month),
    now,
    options
  );
  return {
    ...selected,
    monthLabel: new Intl.DateTimeFormat("de-DE", {
      timeZone: timezone,
      month: "long",
      year: "numeric"
    }).format(new Date(`${selected.month}-15T12:00:00Z`)),
    generatedAt: snapshot.generatedAt,
    lines: snapshot.lines,
    accounts: snapshot.accounts,
    catalog: snapshot.catalog
  };
}

export async function readActualSpendingRange(
  config: NonNullable<AppConfig["actual"]>,
  startDate: string,
  endDate: string,
  now = new Date(),
  options: { loadApi?: ActualSpendingApiLoader; password?: string } = {}
): Promise<ActualSpendingRangeSnapshot> {
  if (!config.enabled) throw new Error("Actual ist deaktiviert");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)
    || startDate > endDate) {
    throw new Error("Ungültiger Ausgabenzeitraum");
  }
  const password = options.password ?? readSecret("actual-password");
  if (!password) throw new Error("Actual-Zugang ist nicht verfügbar");
  const dataDir = mkdtempSync(join(tmpdir(), "finance-spending-actual-"));
  const api = await (options.loadApi ?? (async () =>
    await import("@actual-app/api") as unknown as ActualSpendingApi))();
  let initialized = false;
  try {
    await api.init({ dataDir, serverURL: config.serverUrl, password });
    initialized = true;
    await api.downloadBudget(config.budgetId);
    const [actualAccounts, actualCategories, hiddenCategories, actualPayees] = await Promise.all([
      api.getAccounts(),
      api.getCategories(),
      api.getCategories({ hidden: true }),
      api.getPayees()
    ]);
    const categoryRows = [...actualCategories, ...hiddenCategories];
    const groupNames = new Map(
      categoryRows
        .filter((row): row is ActualCategoryGroup => "categories" in row)
        .map((group) => [group.id, safeLabel(group.name, "Gruppe")])
    );
    const categories = new Map(
      categoriesFromApi(categoryRows).map((category) => [category.id, category])
    );
    const payees = new Map(actualPayees.map((payee) => [payee.id, payee]));
    const catalog: SpendingCatalogCategory[] = [...categories.values()]
      .map((category) => ({
        key: publicKey("category", category.id),
        id: category.id,
        name: safeLabel(category.name, "Kategorie"),
        group: groupNames.get(category.group_id ?? "") ?? (category.is_income ? "Einnahmen" : "Ausgaben"),
        isIncome: Boolean(category.is_income)
      }))
      .sort((left, right) => left.group.localeCompare(right.group, "de")
        || left.name.localeCompare(right.name, "de"));
    const accounts = actualAccounts
      .filter((account) => !account.offbudget)
      .sort((left, right) => left.name.localeCompare(right.name, "de"))
      .map((account) => ({
        id: account.id,
        key: publicKey("account", account.id),
        label: safeAccountLabel(account.name)
      }));
    const accountTransactions = await Promise.all(accounts.map(async (account) => ({
      account,
      transactions: await api.getTransactions(account.id, startDate, endDate)
    })));
    const lines = accountTransactions
      .flatMap(({ account, transactions }) => normalizeTransactions(transactions, account, categories, payees))
      .sort((left, right) => right.date.localeCompare(left.date) || right.id.localeCompare(left.id));
    return {
      startDate,
      endDate,
      generatedAt: now.toISOString(),
      lines,
      accounts: accounts.map(({ key, label }) => ({ key, label })),
      catalog
    };
  } finally {
    if (initialized) await api.shutdown().catch(() => undefined);
    rmSync(dataDir, { recursive: true, force: true });
  }
}

function safePageSize(value: number | undefined): number {
  const size = Math.trunc(value ?? 20);
  return [20, 50, 100].includes(size) ? size : 20;
}

export function buildDashboardSpending(
  snapshot: ActualSpendingMonthSnapshot,
  query: SpendingQuery = {}
): DashboardSpending {
  const search = String(query.search ?? "").trim().slice(0, 80);
  const searchKey = search.toLocaleLowerCase("de-DE");
  const selectedAccount = snapshot.accounts.some((account) => account.key === query.account)
    ? String(query.account)
    : "all";
  const basis = snapshot.lines.filter((line) => {
    if (selectedAccount !== "all" && line.accountKey !== selectedAccount) return false;
    if (!searchKey) return true;
    return `${line.merchant} ${line.notes} ${line.categoryLabel}`
      .toLocaleLowerCase("de-DE")
      .includes(searchKey);
  });
  const categoryAmounts = new Map<string, { label: string; amountMinor: number }>();
  for (const line of basis) {
    const current = categoryAmounts.get(line.categoryKey) ?? {
      label: line.categoryLabel,
      amountMinor: 0
    };
    current.amountMinor += line.amountMinor;
    categoryAmounts.set(line.categoryKey, current);
  }
  const availableCategory = query.category && categoryAmounts.has(query.category)
    ? String(query.category)
    : "all";
  const filteredLines = availableCategory === "all"
    ? basis
    : basis.filter((line) => line.categoryKey === availableCategory);
  const pageSize = safePageSize(query.pageSize);
  const pages = Math.max(1, Math.ceil(filteredLines.length / pageSize));
  const requestedPage = Math.max(1, Math.trunc(query.page ?? 1));
  const page = Math.min(requestedPage, pages);
  const start = (page - 1) * pageSize;
  const totalMinor = snapshot.lines.reduce((sum, line) => sum + line.amountMinor, 0);
  const grossExpenseMinor = snapshot.lines.reduce(
    (sum, line) => sum + Math.max(0, line.amountMinor),
    0
  );
  const categorizedExpenseMinor = snapshot.lines.reduce(
    (sum, line) => sum + (line.categorized ? Math.max(0, line.amountMinor) : 0),
    0
  );
  const categoryRows = [...categoryAmounts.entries()]
    .sort((left, right) => right[1].amountMinor - left[1].amountMinor
      || left[1].label.localeCompare(right[1].label, "de"))
    .map(([key, category]) => ({
      key,
      label: category.label,
      amountMinor: category.amountMinor,
      selected: key === availableCategory
    }));
  const basisTotal = basis.reduce((sum, line) => sum + line.amountMinor, 0);
  const filteredTotal = filteredLines.reduce((sum, line) => sum + line.amountMinor, 0);
  return {
    generatedAt: snapshot.generatedAt,
    state: "current",
    source: "Actual",
    month: snapshot.month,
    monthLabel: snapshot.monthLabel,
    latestMonth: snapshot.latestMonth,
    oldestMonth: snapshot.oldestMonth,
    summary: {
      totalMinor,
      bookings: snapshot.lines.length,
      categorizedPercent: grossExpenseMinor > 0
        ? Math.round(categorizedExpenseMinor / grossExpenseMinor * 100)
        : 0
    },
    selection: {
      category: availableCategory,
      account: selectedAccount,
      search
    },
    filtered: {
      totalMinor: filteredTotal,
      bookings: filteredLines.length
    },
    categories: [
      {
        key: "all",
        label: "Alle Kategorien",
        amountMinor: basisTotal,
        selected: availableCategory === "all"
      },
      ...categoryRows
    ],
    accounts: snapshot.accounts,
    transactions: filteredLines.slice(start, start + pageSize).map((line) => ({
      date: line.date,
      merchant: line.displayMerchant ?? line.merchant,
      account: line.accountLabel,
      category: line.categoryLabel,
      amountMinor: line.amountMinor
    })),
    pagination: {
      page,
      pageSize,
      pages,
      total: filteredLines.length,
      from: filteredLines.length ? start + 1 : 0,
      to: Math.min(start + pageSize, filteredLines.length)
    }
  };
}
