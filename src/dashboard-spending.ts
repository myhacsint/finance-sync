import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSecret } from "./config.js";
import type { AppConfig } from "./types.js";
import {
  DEFAULT_MERCHANT_RULES,
  applyMerchantRules,
  mergeMerchantRules,
  type MerchantRule
} from "./merchant-rules.js";

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
  direction?: "expense" | "income";
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
  period?: SpendingPeriodSelection;
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
  sort?: SpendingSort;
}

export type SpendingSort = "date-desc" | "date-asc" | "amount-desc" | "amount-asc" | "merchant-asc" | "merchant-desc";
export type SpendingPeriodKind = "month" | "quarter" | "ytd" | "year";

export interface SpendingPeriodRequest {
  period?: string;
  month?: string;
  quarter?: string;
  year?: string;
}

export interface SpendingPeriodSelection {
  kind: SpendingPeriodKind;
  key: string;
  label: string;
  startMonth: string;
  endMonth: string;
  startDate: string;
  endDate: string;
  complete: boolean;
  currentMonth: string;
  latestCompleteMonth: string;
  oldestMonth: string;
}

export interface SpendingMerchantGroup {
  key: string;
  label: string;
  amountMinor: number;
  bookings: number;
  transactions: Array<{
    date: string;
    merchant: string;
    account: string;
    category: string;
    amountMinor: number;
  }>;
}

export interface DashboardSpending {
  generatedAt: string;
  state: "current";
  source: "Actual";
  month: string;
  monthLabel: string;
  latestMonth: string;
  oldestMonth: string;
  period?: SpendingPeriodSelection;
  summary: {
    totalMinor: number;
    bookings: number;
    categorizedPercent: number;
  };
  selection: {
    category: string;
    account: string;
    search: string;
    sort: SpendingSort;
  };
  filtered: {
    totalMinor: number;
    bookings: number;
    groups: number;
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
  merchantGroups: SpendingMerchantGroup[];
  medical?: {
    categoryLabel: string;
    grossMinor: number;
    reimbursedMinor: number;
    netMinor: number;
    bills: number;
    reimbursements: number;
  };
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

function dayParts(now: Date, timezone: string): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now);
  return {
    year: Number(parts.find((part) => part.type === "year")?.value),
    month: Number(parts.find((part) => part.type === "month")?.value),
    day: Number(parts.find((part) => part.type === "day")?.value)
  };
}

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function clampMonth(key: string, oldest: string, newest: string): string {
  if (key < oldest) return oldest;
  if (key > newest) return newest;
  return key;
}

function periodLabel(kind: SpendingPeriodKind, startMonth: string, timezone: string): string {
  const format = (key: string, options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat("de-DE", { timeZone: timezone, ...options })
      .format(new Date(`${key}-15T12:00:00Z`));
  if (kind === "month") return format(startMonth, { month: "long", year: "numeric" });
  if (kind === "year") return startMonth.slice(0, 4);
  if (kind === "ytd") return `Jahr bis heute ${startMonth.slice(0, 4)}`;
  const quarter = Math.ceil(Number(startMonth.slice(5)) / 3);
  return `Q${quarter} ${startMonth.slice(0, 4)}`;
}

export function spendingPeriodSelection(
  now: Date,
  timezone: string,
  request: SpendingPeriodRequest = {}
): SpendingPeriodSelection {
  const today = dayParts(now, timezone);
  const currentMonth = monthKey(today.year, today.month);
  const latestCompleteMonth = shiftSpendingMonth(currentMonth, -1);
  const oldestMonth = shiftSpendingMonth(latestCompleteMonth, -120);
  const todayDate = `${currentMonth}-${String(today.day).padStart(2, "0")}`;
  const kind: SpendingPeriodKind = request.period === "quarter" || request.period === "ytd" || request.period === "year"
    ? request.period
    : "month";

  let startMonth = latestCompleteMonth;
  let endMonth = latestCompleteMonth;
  let key = latestCompleteMonth;

  if (kind === "month") {
    const requested = request.month && /^\d{4}-(0[1-9]|1[0-2])$/.test(request.month)
      ? request.month
      : latestCompleteMonth;
    startMonth = clampMonth(requested, oldestMonth, currentMonth);
    endMonth = startMonth;
    key = startMonth;
  } else if (kind === "quarter") {
    const match = /^(\d{4})-Q([1-4])$/.exec(request.quarter ?? "");
    const year = match ? Number(match[1]) : today.year;
    const quarter = match ? Number(match[2]) : Math.ceil(today.month / 3);
    startMonth = clampMonth(monthKey(year, (quarter - 1) * 3 + 1), oldestMonth, currentMonth);
    endMonth = clampMonth(monthKey(year, quarter * 3), oldestMonth, currentMonth);
    if (endMonth < startMonth) startMonth = endMonth;
    key = `${startMonth.slice(0, 4)}-Q${Math.ceil(Number(startMonth.slice(5)) / 3)}`;
  } else if (kind === "ytd") {
    const year = /^\d{4}$/.test(request.year ?? "") ? Number(request.year) : today.year;
    startMonth = clampMonth(monthKey(year, 1), oldestMonth, currentMonth);
    endMonth = year === today.year ? currentMonth : clampMonth(monthKey(year, 12), oldestMonth, currentMonth);
    key = `ytd-${year}`;
  } else {
    const year = /^\d{4}$/.test(request.year ?? "") ? Number(request.year) : today.year;
    startMonth = clampMonth(monthKey(year, 1), oldestMonth, currentMonth);
    endMonth = year === today.year ? currentMonth : clampMonth(monthKey(year, 12), oldestMonth, currentMonth);
    key = String(year);
  }

  const complete = endMonth < currentMonth;
  const endDate = endMonth === currentMonth ? todayDate : monthEnd(endMonth);
  return {
    kind,
    key,
    label: periodLabel(kind, startMonth, timezone),
    startMonth,
    endMonth,
    startDate: `${startMonth}-01`,
    endDate,
    complete,
    currentMonth,
    latestCompleteMonth,
    oldestMonth
  };
}

function monthEnd(key: string): string {
  const [year, month] = key.split("-").map(Number);
  const day = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return `${key}-${String(day).padStart(2, "0")}`;
}

export function reviewWindowSelection(
  now: Date,
  timezone: string,
  months = 6
): { months: number; startDate: string; endDate: string; startMonth: string; endMonth: string } {
  const allowed = [3, 6, 12, 24].includes(months) ? months : 6;
  const { latestMonth } = spendingMonthSelection(now, timezone);
  const startMonth = shiftSpendingMonth(latestMonth, -(allowed - 1));
  return {
    months: allowed,
    startDate: `${startMonth}-01`,
    endDate: monthEnd(latestMonth),
    startMonth,
    endMonth: latestMonth
  };
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
  payees: Map<string, ActualPayee>,
  mode: "expenses" | "review" = "expenses"
): SpendingLine | null {
  const category = transaction.category ? categories.get(transaction.category) : undefined;
  const payee = transaction.payee ? payees.get(transaction.payee) : undefined;
  const parentPayee = parent.payee ? payees.get(parent.payee) : undefined;
  const transfer = Boolean(parent.transfer_id || transaction.transfer_id
    || parentPayee?.transfer_acct || payee?.transfer_acct);
  if (transfer || parent.starting_balance_flag || transaction.starting_balance_flag) return null;
  if (mode === "review") {
    if (category) return null;
    const signed = Math.round(transaction.amount);
    if (signed === 0) return null;
    const direction = signed > 0 ? "income" : "expense";
    const amountMinor = Math.abs(signed);
    const displayMerchant = safeLabel(
      payee?.name ?? parentPayee?.name ?? transaction.imported_payee
        ?? parent.imported_payee ?? transaction.notes ?? parent.notes,
      direction === "income" ? "Unbekannte Einnahme" : "Unbekannter Händler"
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
      categoryKey: "uncategorized",
      categoryLabel: "Ohne Kategorie",
      categorized: false,
      amountMinor,
      direction
    };
  }
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
    amountMinor,
    direction: "expense"
  };
}

function normalizeTransactions(
  transactions: ActualTransaction[],
  account: { key: string; label: string },
  categories: Map<string, ActualCategory>,
  payees: Map<string, ActualPayee>,
  mode: "expenses" | "review" = "expenses"
): SpendingLine[] {
  return transactions.flatMap((transaction) => {
    if (transaction.is_child) return [];
    const parts = transaction.is_parent && transaction.subtransactions?.length
      ? transaction.subtransactions
      : [transaction];
    return parts
      .map((part) => normalizeLine(part, transaction, account, categories, payees, mode))
      .filter((line): line is SpendingLine => Boolean(line));
  });
}

export async function readActualSpendingMonth(
  config: NonNullable<AppConfig["actual"]>,
  timezone: string,
  requestedMonth?: string,
  now = new Date(),
  options: { loadApi?: ActualSpendingApiLoader; password?: string; period?: SpendingPeriodRequest } = {}
): Promise<ActualSpendingMonthSnapshot> {
  const period = spendingPeriodSelection(now, timezone, {
    ...options.period,
    month: options.period?.month ?? requestedMonth
  });
  const snapshot = await readActualSpendingRange(
    config,
    period.startDate,
    period.endDate,
    now,
    options
  );
  return {
    month: period.endMonth,
    monthLabel: period.label,
    latestMonth: period.latestCompleteMonth,
    oldestMonth: period.oldestMonth,
    period,
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
  options: { loadApi?: ActualSpendingApiLoader; password?: string; mode?: "expenses" | "review" } = {}
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
      .flatMap(({ account, transactions }) => normalizeTransactions(transactions, account, categories, payees, options.mode ?? "expenses"))
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

function parseSpendingSort(value: string | undefined): SpendingSort {
  return value === "date-asc" || value === "amount-desc" || value === "amount-asc"
    || value === "merchant-asc" || value === "merchant-desc"
    ? value
    : "date-desc";
}

function compareSpendingLines(left: SpendingLine, right: SpendingLine, sort: SpendingSort): number {
  if (sort === "amount-desc") return right.amountMinor - left.amountMinor || right.date.localeCompare(left.date);
  if (sort === "amount-asc") return left.amountMinor - right.amountMinor || left.date.localeCompare(right.date);
  if (sort === "merchant-asc") return left.merchant.localeCompare(right.merchant, "de") || right.date.localeCompare(left.date);
  if (sort === "merchant-desc") return right.merchant.localeCompare(left.merchant, "de") || right.date.localeCompare(left.date);
  if (sort === "date-asc") return left.date.localeCompare(right.date) || left.id.localeCompare(right.id);
  return right.date.localeCompare(left.date) || right.id.localeCompare(left.id);
}

export function groupSpendingMerchants(
  lines: SpendingLine[],
  rules: MerchantRule[] = DEFAULT_MERCHANT_RULES
): SpendingMerchantGroup[] {
  const groups = new Map<string, SpendingMerchantGroup & { newest: string }>();
  for (const line of lines) {
    const identity = applyMerchantRules(line.displayMerchant ?? line.merchant, rules);
    const existing = groups.get(identity.key) ?? {
      key: `merchant-${createHash("sha256")
        .update(`finance-hub:spend-merchant:${identity.key}`)
        .digest("hex")
        .slice(0, 12)}`,
      label: identity.label,
      amountMinor: 0,
      bookings: 0,
      newest: line.date,
      transactions: []
    };
    existing.amountMinor += line.amountMinor;
    existing.bookings += 1;
    if (line.date > existing.newest) existing.newest = line.date;
    existing.transactions.push({
      date: line.date,
      merchant: line.displayMerchant ?? line.merchant,
      account: line.accountLabel,
      category: line.categoryLabel,
      amountMinor: line.amountMinor
    });
    groups.set(identity.key, existing);
  }
  return [...groups.values()]
    .map((group) => ({
      key: group.key,
      label: group.label,
      amountMinor: group.amountMinor,
      bookings: group.bookings,
      transactions: group.transactions.sort((left, right) => right.date.localeCompare(left.date)
        || right.amountMinor - left.amountMinor)
    }))
    .sort((left, right) => right.amountMinor - left.amountMinor
      || left.label.localeCompare(right.label, "de"));
}

export function medicalBreakdown(
  lines: Array<{ categoryLabel: string; amountMinor: number }>
): DashboardSpending["medical"] {
  const medical = lines.filter((line) => line.categoryLabel === "Arzt & Apotheke");
  if (!medical.length) return undefined;
  const bills = medical.filter((line) => line.amountMinor > 0);
  const reimbursements = medical.filter((line) => line.amountMinor < 0);
  const grossMinor = bills.reduce((sum, line) => sum + line.amountMinor, 0);
  const reimbursedMinor = reimbursements.reduce((sum, line) => sum + Math.abs(line.amountMinor), 0);
  return {
    categoryLabel: "Arzt & Apotheke",
    grossMinor,
    reimbursedMinor,
    netMinor: grossMinor - reimbursedMinor,
    bills: bills.length,
    reimbursements: reimbursements.length
  };
}

function sortMerchantGroups(
  groups: SpendingMerchantGroup[],
  sort: SpendingSort
): SpendingMerchantGroup[] {
  const copy = [...groups];
  if (sort === "merchant-asc") return copy.sort((left, right) => left.label.localeCompare(right.label, "de"));
  if (sort === "merchant-desc") return copy.sort((left, right) => right.label.localeCompare(left.label, "de"));
  if (sort === "amount-asc") return copy.sort((left, right) => left.amountMinor - right.amountMinor);
  if (sort === "date-asc") {
    return copy.sort((left, right) => (left.transactions.at(-1)?.date ?? "").localeCompare(right.transactions[0]?.date ?? "")
      || left.label.localeCompare(right.label, "de"));
  }
  if (sort === "date-desc") {
    return copy.sort((left, right) => (right.transactions[0]?.date ?? "").localeCompare(left.transactions[0]?.date ?? "")
      || right.amountMinor - left.amountMinor);
  }
  return copy.sort((left, right) => right.amountMinor - left.amountMinor || left.label.localeCompare(right.label, "de"));
}

export function buildDashboardSpending(
  snapshot: ActualSpendingMonthSnapshot,
  query: SpendingQuery = {},
  rules: MerchantRule[] = DEFAULT_MERCHANT_RULES
): DashboardSpending {
  const merchantRules = mergeMerchantRules(DEFAULT_MERCHANT_RULES, rules);
  const search = String(query.search ?? "").trim().slice(0, 80);
  const searchKey = search.toLocaleLowerCase("de-DE");
  const selectedAccount = snapshot.accounts.some((account) => account.key === query.account)
    ? String(query.account)
    : "all";
  const labeled = snapshot.lines.map((line) => ({
    ...line,
    groupedMerchant: applyMerchantRules(line.displayMerchant ?? line.merchant, merchantRules).label
  }));
  const basis = labeled.filter((line) => {
    if (selectedAccount !== "all" && line.accountKey !== selectedAccount) return false;
    if (!searchKey) return true;
    return `${line.groupedMerchant} ${line.merchant} ${line.displayMerchant ?? ""} ${line.notes} ${line.categoryLabel}`
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
    ? [...basis]
    : basis.filter((line) => line.categoryKey === availableCategory);
  const sort = parseSpendingSort(query.sort);
  filteredLines.sort((left, right) => compareSpendingLines(left, right, sort));
  const allGroups = sortMerchantGroups(groupSpendingMerchants(filteredLines, merchantRules), sort);
  const pageSize = safePageSize(query.pageSize);
  const pages = Math.max(1, Math.ceil(allGroups.length / pageSize));
  const requestedPage = Math.max(1, Math.trunc(query.page ?? 1));
  const page = Math.min(requestedPage, pages);
  const start = (page - 1) * pageSize;
  const merchantGroups = allGroups.slice(start, start + pageSize);
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
    period: snapshot.period,
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
      search,
      sort
    },
    filtered: {
      totalMinor: filteredTotal,
      bookings: filteredLines.length,
      groups: allGroups.length
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
      merchant: line.groupedMerchant ?? applyMerchantRules(line.displayMerchant ?? line.merchant, merchantRules).label,
      account: line.accountLabel,
      category: line.categoryLabel,
      amountMinor: line.amountMinor
    })),
    merchantGroups,
    medical: medicalBreakdown(snapshot.lines),
    pagination: {
      page,
      pageSize,
      pages,
      total: allGroups.length,
      from: allGroups.length ? start + 1 : 0,
      to: Math.min(start + pageSize, allGroups.length)
    }
  };
}
