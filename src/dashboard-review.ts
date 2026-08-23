import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { RecurringExpenseDecision } from "./types.js";
import type { SpendingLine } from "./dashboard-spending.js";

export const REVIEW_TAXONOMY: RecurringExpenseDecision[] = [
  "GRUNDBEDARF",
  "GESTALTBAR",
  "VERMEIDBAR",
  "UNKLAR",
  "KEIN_KANDIDAT"
];

export interface ReviewCategory {
  key: string;
  id: string;
  name: string;
  group: string;
  isIncome: boolean;
}

export interface MerchantAlias {
  fromKey: string;
  toLabel: string;
}

export interface DashboardReview {
  generatedAt: string;
  taxonomy: RecurringExpenseDecision[];
  window: {
    months: number;
    startDate: string;
    endDate: string;
  };
  counts: {
    uncategorized: number;
    uncategorizedExpenses: number;
    uncategorizedIncome: number;
    recurringOpen: number;
    optimizationsOpen: number;
    open: number;
  };
  uncategorized: SpendingLine[];
  uncategorizedExpenses: SpendingLine[];
  uncategorizedIncome: SpendingLine[];
  categories: ReviewCategory[];
}

export interface DashboardReviewInput {
  generatedAt: string;
  uncategorized: SpendingLine[];
  recurringOpen: number;
  optimizationsOpen: number;
  categories: ReviewCategory[];
  taxonomy?: RecurringExpenseDecision[];
  window?: { months: number; startDate: string; endDate: string };
}

export function parseSpendingLineId(lineId: string): { parentId: string; transactionId: string } {
  const trimmed = String(lineId ?? "").trim();
  if (!trimmed) throw new Error("Buchung fehlt");
  const separator = trimmed.indexOf(":");
  if (separator <= 0 || separator === trimmed.length - 1) {
    return { parentId: trimmed, transactionId: trimmed };
  }
  return {
    parentId: trimmed.slice(0, separator),
    transactionId: trimmed.slice(separator + 1)
  };
}

export function applyMerchantAliases(
  lines: SpendingLine[],
  aliases: MerchantAlias[]
): SpendingLine[] {
  const map = new Map(aliases.map((alias) => [alias.fromKey, alias.toLabel]));
  return lines.map((item) => {
    const toLabel = map.get(item.merchantKey);
    return toLabel ? { ...item, merchant: toLabel } : item;
  });
}

export function buildDashboardReview(input: DashboardReviewInput): DashboardReview {
  const taxonomy = input.taxonomy ?? REVIEW_TAXONOMY;
  const uncategorized = input.uncategorized.filter((item) => !item.categorized);
  const uncategorizedExpenses = uncategorized.filter((item) => item.direction !== "income");
  const uncategorizedIncome = uncategorized.filter((item) => item.direction === "income");
  return {
    generatedAt: input.generatedAt,
    taxonomy,
    window: input.window ?? { months: 1, startDate: "", endDate: "" },
    counts: {
      uncategorized: uncategorized.length,
      uncategorizedExpenses: uncategorizedExpenses.length,
      uncategorizedIncome: uncategorizedIncome.length,
      recurringOpen: input.recurringOpen,
      optimizationsOpen: input.optimizationsOpen,
      open: uncategorized.length + input.recurringOpen + input.optimizationsOpen
    },
    uncategorized,
    uncategorizedExpenses,
    uncategorizedIncome,
    categories: input.categories
  };
}

export interface ActualReviewApi {
  init(options: { dataDir: string; serverURL: string; password: string }): Promise<unknown>;
  downloadBudget(id: string): Promise<void>;
  getPayees(): Promise<Array<{ id: string; name: string }>>;
  createPayee(payee: { name: string }): Promise<string>;
  updateTransaction(id: string, fields: { category?: string | null; payee?: string }): Promise<unknown>;
  sync(): Promise<unknown>;
  shutdown(): Promise<void>;
}

export async function updateActualReviewTransaction(options: {
  lineId: string;
  categoryId?: string | null;
  payeeName?: string;
  serverURL: string;
  budgetId: string;
  password: string;
  dataDir?: string;
  loadApi: () => Promise<ActualReviewApi>;
}): Promise<{ transactionId: string; payeeId: string | null }> {
  const { transactionId } = parseSpendingLineId(options.lineId);
  const payeeName = options.payeeName?.trim().slice(0, 80) || "";
  const dataDir = options.dataDir ?? mkdtempSync(join(tmpdir(), "finance-review-actual-"));
  const ownedDir = !options.dataDir;
  const api = await options.loadApi();
  let initialized = false;
  try {
    await api.init({
      dataDir,
      serverURL: options.serverURL,
      password: options.password
    });
    initialized = true;
    await api.downloadBudget(options.budgetId);
    let payeeId: string | null = null;
    if (payeeName) {
      const existing = (await api.getPayees())
        .find((payee) => payee.name.localeCompare(payeeName, "de", { sensitivity: "accent" }) === 0);
      payeeId = existing?.id ?? await api.createPayee({ name: payeeName });
    }
    await api.updateTransaction(transactionId, {
      ...(options.categoryId !== undefined ? { category: options.categoryId } : {}),
      ...(payeeId ? { payee: payeeId } : {})
    });
    await api.sync();
    return { transactionId, payeeId };
  } finally {
    if (initialized) await api.shutdown().catch(() => undefined);
    if (ownedDir) rmSync(dataDir, { recursive: true, force: true });
  }
}
