import { createHash } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readSecret } from "./config.js";
import type { AppConfig } from "./types.js";

interface ActualAccount {
  id: string;
  offbudget?: boolean;
}

interface ActualCategory {
  id: string;
  name: string;
  is_income?: boolean;
  categories?: ActualCategory[];
}

interface ActualPayee {
  id: string;
  transfer_acct?: string;
}

interface ActualTransaction {
  id: string;
  is_parent?: boolean;
  is_child?: boolean;
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

interface ActualCashflowApi {
  init(options: { dataDir: string; serverURL: string; password: string }): Promise<unknown>;
  downloadBudget(id: string): Promise<void>;
  getAccounts(): Promise<ActualAccount[]>;
  getCategories(options?: { hidden?: boolean }): Promise<ActualCategory[]>;
  getPayees(): Promise<ActualPayee[]>;
  getTransactions(accountId: string, startDate: string, endDate: string): Promise<ActualTransaction[]>;
  shutdown(): Promise<void>;
}

export interface SavingsCashflowLine {
  bookingKey: string;
  date: string;
  amountMinor: number;
  categoryLabel?: string;
  categoryIsIncome: boolean;
  merchantKey: string;
  purpose: string;
  transfer: boolean;
  startingBalance: boolean;
}

export interface SavingsCashflowSnapshot {
  startDate: string;
  endDate: string;
  generatedAt: string;
  lines: SavingsCashflowLine[];
}

export interface DashboardSavingsBaseline {
  generatedAt: string;
  state: "current" | "partial" | "empty";
  source: "Actual";
  window: { start: string; end: string; months: number };
  payroll: {
    months: number;
    regularMonthlyMinor: number | null;
    variableAnnualMinor: number;
    estimate: true;
  };
  manualForwardedIncome: {
    status: "none" | "needs-assignment" | "assigned";
    occurrences: number;
    assignedOccurrences: number;
    unassignedOccurrences: number;
    amountMinor: number;
    unassignedAmountMinor: number;
    regularMonthlyMinor: number | null;
    variableAnnualMinor: number;
    estimate: true;
  };
  otherIncome: {
    amountMinor: number;
    unknownPositiveMinor: number;
  };
  consumption: {
    typicalMonthlyMinor: number | null;
    estimate: true;
  };
  savingsCapacityMonthlyMinor: null;
  months: Array<{
    month: string;
    payrollRegularMinor: number;
    payrollVariableMinor: number;
    secondIncomeRegularMinor: number;
    secondIncomeVariableMinor: number;
    manualForwardedUnassignedMinor: number;
    otherIncomeMinor: number;
    unknownPositiveMinor: number;
    consumptionMinor: number;
  }>;
  warnings: string[];
  basis: string[];
}

export function savingsMerchantKey(stable: string): string {
  return `merchant-${createHash("sha256")
    .update(`finance-hub:merchant:${stable}`)
    .digest("hex").slice(0, 16)}`;
}

export function savingsBookingKey(accountId: string, parentId: string, transactionId: string): string {
  return `booking-${createHash("sha256")
    .update(`finance-hub:savings-booking:${accountId}:${parentId}:${transactionId}`)
    .digest("hex").slice(0, 20)}`;
}

export function payrollEconomicMonth(purpose: string): string | undefined {
  const match = /\bPAYROLL\b[\s\S]{0,160}?\/(20\d{2})(0[1-9]|1[0-2])\b/i.exec(purpose);
  return match ? `${match[1]}-${match[2]}` : undefined;
}

function shiftMonth(month: string, offset: number): string {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function currentMonth(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit"
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function monthEnd(month: string): string {
  const [year, value] = month.split("-").map(Number);
  const day = new Date(Date.UTC(year, value, 0)).getUTCDate();
  return `${month}-${String(day).padStart(2, "0")}`;
}

export function savingsBaselineRange(
  now: Date,
  timezone: string,
  months = 12
): { startDate: string; endDate: string; startMonth: string; endMonth: string; months: number } {
  const safeMonths = Math.max(3, Math.min(36, Math.trunc(months)));
  const endMonth = shiftMonth(currentMonth(now, timezone), -1);
  const startMonth = shiftMonth(endMonth, -(safeMonths - 1));
  return {
    startDate: `${startMonth}-01`,
    endDate: monthEnd(endMonth),
    startMonth,
    endMonth,
    months: safeMonths
  };
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

export function buildDashboardSavingsBaseline(
  snapshot: SavingsCashflowSnapshot,
  config: AppConfig,
  now = new Date()
): DashboardSavingsBaseline {
  const range = savingsBaselineRange(now, config.timezone);
  const configuredManual = new Set(
    config.analysis?.savingsBaseline?.manualForwardedIncomeMerchantKeys ?? []
  );
  const assignments = config.analysis?.savingsBaseline?.manualForwardedIncomeAssignments ?? {};
  const months = new Map<string, DashboardSavingsBaseline["months"][number]>();
  for (let month = range.startMonth; month <= range.endMonth; month = shiftMonth(month, 1)) {
    months.set(month, {
      month,
      payrollRegularMinor: 0,
      payrollVariableMinor: 0,
      secondIncomeRegularMinor: 0,
      secondIncomeVariableMinor: 0,
      manualForwardedUnassignedMinor: 0,
      otherIncomeMinor: 0,
      unknownPositiveMinor: 0,
      consumptionMinor: 0
    });
  }

  const payrollLines = snapshot.lines.flatMap((line) => {
    if (line.transfer || line.startingBalance || line.amountMinor <= 0) return [];
    const month = payrollEconomicMonth(line.purpose);
    return month && months.has(month) ? [{ ...line, month }] : [];
  });
  const regularPayrollMedian = median(payrollLines.map((line) => line.amountMinor));
  const variableThreshold = regularPayrollMedian === null
    ? Number.POSITIVE_INFINITY
    : regularPayrollMedian * 1.5;
  const manualLines = snapshot.lines.filter((line) =>
    line.amountMinor > 0
      && !line.transfer
      && !line.startingBalance
      && configuredManual.has(line.merchantKey)
      && months.has(line.date.slice(0, 7))
  );
  const assignedManualLines = manualLines.flatMap((line) => {
    const month = assignments[line.bookingKey];
    return month && months.has(month) ? [{ ...line, month }] : [];
  });
  const regularSecondIncomeMedian = median(assignedManualLines.map((line) => line.amountMinor));
  const secondIncomeVariableThreshold = regularSecondIncomeMedian === null
    ? Number.POSITIVE_INFINITY
    : regularSecondIncomeMedian * 1.5;

  for (const line of snapshot.lines) {
    if (line.transfer || line.startingBalance) continue;
    const payrollMonth = line.amountMinor > 0 ? payrollEconomicMonth(line.purpose) : undefined;
    if (payrollMonth && months.has(payrollMonth)) {
      const item = months.get(payrollMonth)!;
      if (regularPayrollMedian !== null && line.amountMinor > variableThreshold) {
        item.payrollRegularMinor += regularPayrollMedian;
        item.payrollVariableMinor += line.amountMinor - regularPayrollMedian;
      } else {
        item.payrollRegularMinor += line.amountMinor;
      }
      continue;
    }
    const bookingMonth = line.date.slice(0, 7);
    const item = months.get(bookingMonth);
    if (!item) continue;
    if (line.amountMinor > 0 && configuredManual.has(line.merchantKey)) {
      const assignedMonth = assignments[line.bookingKey];
      const assignedItem = assignedMonth ? months.get(assignedMonth) : undefined;
      if (!assignedItem || regularSecondIncomeMedian === null) {
        item.manualForwardedUnassignedMinor += line.amountMinor;
      } else if (line.amountMinor > secondIncomeVariableThreshold) {
        assignedItem.secondIncomeRegularMinor += regularSecondIncomeMedian;
        assignedItem.secondIncomeVariableMinor += line.amountMinor - regularSecondIncomeMedian;
      } else {
        assignedItem.secondIncomeRegularMinor += line.amountMinor;
      }
      continue;
    }
    if (line.categoryIsIncome && line.amountMinor > 0) {
      item.otherIncomeMinor += line.amountMinor;
      continue;
    }
    if (line.amountMinor > 0 && !line.categoryLabel) {
      item.unknownPositiveMinor += line.amountMinor;
      continue;
    }
    if (line.categoryLabel === "Sparen & Investieren") continue;
    if (!line.categoryIsIncome) item.consumptionMinor -= line.amountMinor;
  }

  const resultMonths = [...months.values()];
  const manualOccurrences = manualLines.length;
  const assignedOccurrences = assignedManualLines.length;
  const manualAmountMinor = manualLines.reduce((sum, line) => sum + line.amountMinor, 0);
  const unassignedAmountMinor = resultMonths.reduce(
    (sum, month) => sum + month.manualForwardedUnassignedMinor,
    0
  );
  const unknownPositiveMinor = resultMonths.reduce(
    (sum, month) => sum + month.unknownPositiveMinor,
    0
  );
  const warnings: string[] = [];
  if (assignedOccurrences < manualOccurrences) {
    warnings.push(
      "Manuell weitergeleitetes zweites Haushaltseinkommen wartet auf wirtschaftliche Monatszuordnung."
    );
  }
  if (unknownPositiveMinor > 0) {
    warnings.push("Nicht zugeordnete positive Buchungen sind nicht in der Sparratenbasis enthalten.");
  }
  return {
    generatedAt: snapshot.generatedAt,
    state: resultMonths.every((month) =>
      month.consumptionMinor === 0
      && month.payrollRegularMinor === 0
      && month.otherIncomeMinor === 0
      && month.secondIncomeRegularMinor === 0
      && month.manualForwardedUnassignedMinor === 0
    ) ? "empty" : warnings.length > 0 ? "partial" : "current",
    source: "Actual",
    window: { start: range.startMonth, end: range.endMonth, months: range.months },
    payroll: {
      months: resultMonths.filter((month) => month.payrollRegularMinor > 0).length,
      regularMonthlyMinor: regularPayrollMedian,
      variableAnnualMinor: resultMonths.reduce(
        (sum, month) => sum + month.payrollVariableMinor,
        0
      ),
      estimate: true
    },
    manualForwardedIncome: {
      status: manualOccurrences === 0
        ? "none"
        : assignedOccurrences === manualOccurrences ? "assigned" : "needs-assignment",
      occurrences: manualOccurrences,
      assignedOccurrences,
      unassignedOccurrences: manualOccurrences - assignedOccurrences,
      amountMinor: manualAmountMinor,
      unassignedAmountMinor,
      regularMonthlyMinor: regularSecondIncomeMedian,
      variableAnnualMinor: resultMonths.reduce(
        (sum, month) => sum + month.secondIncomeVariableMinor,
        0
      ),
      estimate: true
    },
    otherIncome: {
      amountMinor: resultMonths.reduce((sum, month) => sum + month.otherIncomeMinor, 0),
      unknownPositiveMinor
    },
    consumption: {
      typicalMonthlyMinor: median(resultMonths.map((month) => month.consumptionMinor)),
      estimate: true
    },
    savingsCapacityMonthlyMinor: null,
    months: resultMonths,
    warnings,
    basis: [
      "Payroll-Zahlungen nach dem im Verwendungszweck codierten Leistungsmonat",
      "Arbeitgeber-Einmalzahlungen getrennt vom regelmäßigen Gehalt [SCHÄTZUNG]",
      "Manuell weitergeleitetes zweites Gehalt nach bestätigtem Wirtschaftsmonat",
      "Interne Überträge sowie Sparen & Investieren nicht als Konsum gezählt",
      "Sparratenbasis bleibt bis zur vollständigen Einkommenszuordnung nicht verfügbar"
    ]
  };
}

function categoriesFromApi(rows: ActualCategory[]): ActualCategory[] {
  return rows.flatMap((row) => row.categories ?? [row]);
}

export async function readActualSavingsCashflow(
  config: NonNullable<AppConfig["actual"]>,
  timezone: string,
  now = new Date(),
  options: { loadApi?: () => Promise<ActualCashflowApi>; password?: string } = {}
): Promise<SavingsCashflowSnapshot> {
  const range = savingsBaselineRange(now, timezone);
  const password = options.password ?? readSecret("actual-password");
  if (!password) throw new Error("Actual-Zugang ist nicht verfügbar");
  const dataDir = mkdtempSync(join(tmpdir(), "finance-savings-actual-"));
  const api = await (options.loadApi ?? (async () =>
    await import("@actual-app/api") as unknown as ActualCashflowApi))();
  let initialized = false;
  try {
    await api.init({ dataDir, serverURL: config.serverUrl, password });
    initialized = true;
    await api.downloadBudget(config.budgetId);
    const [accounts, visibleCategories, hiddenCategories, payees] = await Promise.all([
      api.getAccounts(),
      api.getCategories(),
      api.getCategories({ hidden: true }),
      api.getPayees()
    ]);
    const categories = new Map(
      categoriesFromApi([...visibleCategories, ...hiddenCategories])
        .map((category) => [category.id, category])
    );
    const payeeMap = new Map(payees.map((payee) => [payee.id, payee]));
    const accountTransactions = await Promise.all(
      accounts.filter((account) => !account.offbudget).map(async (account) => ({
        account,
        transactions: await api.getTransactions(account.id, range.startDate, range.endDate)
      }))
    );
    const lines = accountTransactions.flatMap(({ account, transactions }) =>
      transactions.flatMap((transaction) => {
        if (transaction.is_child) return [];
        const parts = transaction.is_parent && transaction.subtransactions?.length
          ? transaction.subtransactions
          : [transaction];
        return parts.map((part) => {
          const category = part.category ? categories.get(part.category) : undefined;
          const payee = part.payee ? payeeMap.get(part.payee) : undefined;
          const parentPayee = transaction.payee ? payeeMap.get(transaction.payee) : undefined;
          const stable = payee?.id ?? parentPayee?.id
            ?? part.imported_payee ?? transaction.imported_payee ?? "unknown";
          return {
            bookingKey: savingsBookingKey(account.id, transaction.id, part.id),
            date: part.date || transaction.date,
            amountMinor: Math.round(part.amount),
            categoryLabel: category?.name,
            categoryIsIncome: Boolean(category?.is_income),
            merchantKey: savingsMerchantKey(stable),
            purpose: `${part.notes ?? transaction.notes ?? ""} ${part.imported_payee ?? transaction.imported_payee ?? ""}`,
            transfer: Boolean(
              part.transfer_id || transaction.transfer_id
                || payee?.transfer_acct || parentPayee?.transfer_acct
            ),
            startingBalance: Boolean(part.starting_balance_flag || transaction.starting_balance_flag)
          } satisfies SavingsCashflowLine;
        });
      })
    );
    return {
      startDate: range.startDate,
      endDate: range.endDate,
      generatedAt: now.toISOString(),
      lines
    };
  } finally {
    if (initialized) await api.shutdown().catch(() => undefined);
    rmSync(dataDir, { recursive: true, force: true });
  }
}
