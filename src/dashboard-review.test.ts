import assert from "node:assert/strict";
import test from "node:test";
import type { SpendingLine } from "./dashboard-spending.js";
import {
  applyMerchantAliases,
  buildDashboardReview,
  parseSpendingLineId,
  resolveReviewCategory,
  updateActualReviewTransaction
} from "./dashboard-review.js";

function line(partial: Partial<SpendingLine> & Pick<SpendingLine, "id">): SpendingLine {
  return {
    date: "2026-08-10",
    merchantKey: "merchant-aaaa",
    merchant: "Amazon EU SARL",
    notes: "",
    accountKey: "account-giro",
    accountLabel: "Giro",
    categoryKey: "uncategorized",
    categoryLabel: "Ohne Kategorie",
    categorized: false,
    amountMinor: 1299,
    ...partial
  };
}

test("Review-Queue zählt offene Buchungen, Kandidaten und Maßnahmen in einer Taxonomie", () => {
  const review = buildDashboardReview({
    generatedAt: "2026-08-23T18:00:00.000Z",
    uncategorized: [
      line({ id: "tx1:tx1", merchant: "Amazon EU SARL" }),
      line({ id: "tx2:tx2", merchantKey: "merchant-bbbb", merchant: "OpenAI Ireland", amountMinor: 2200 })
    ],
    recurringOpen: 3,
    optimizationsOpen: 1,
    categories: [
      { key: "category-food", id: "food", name: "Lebensmittel", group: "Ausgaben", isIncome: false },
      { key: "category-salary", id: "salary", name: "Gehalt", group: "Einnahmen", isIncome: true }
    ],
    taxonomy: ["GRUNDBEDARF", "GESTALTBAR", "VERMEIDBAR", "UNKLAR", "KEIN_KANDIDAT"]
  });
  assert.equal(review.counts.uncategorized, 2);
  assert.equal(review.counts.recurringOpen, 3);
  assert.equal(review.counts.optimizationsOpen, 1);
  assert.equal(review.counts.open, 6);
  assert.equal(review.taxonomy[0], "GRUNDBEDARF");
  assert.equal(review.categories[0].key, "category-food");
  assert.equal(review.uncategorized[1].merchant, "OpenAI Ireland");
});

test("Review trennt unkategorisierte Einnahmen und Ausgaben", () => {
  const review = buildDashboardReview({
    generatedAt: "2026-08-23T18:00:00.000Z",
    uncategorized: [
      line({ id: "e:e", merchant: "Amazon", direction: "expense" }),
      line({ id: "i:i", merchant: "Gehalt", direction: "income", amountMinor: 350000 })
    ],
    recurringOpen: 0,
    optimizationsOpen: 0,
    categories: [],
    window: { months: 6, startDate: "2026-02-01", endDate: "2026-07-31" }
  });
  assert.equal(review.counts.uncategorizedExpenses, 1);
  assert.equal(review.counts.uncategorizedIncome, 1);
  assert.equal(review.uncategorizedIncome[0].merchant, "Gehalt");
  assert.equal(review.window.months, 6);
});

test("Händleraliase bündeln sichtbare Namen ohne Originalbuchung zu verlieren", () => {
  const grouped = applyMerchantAliases([
    line({ id: "a:a", merchantKey: "merchant-amz1", merchant: "Amazon EU SARL" }),
    line({ id: "b:b", merchantKey: "merchant-amz2", merchant: "Amazon Payments" }),
    line({ id: "c:c", merchantKey: "merchant-other", merchant: "Lidl" })
  ], [
    { fromKey: "merchant-amz1", toLabel: "Amazon" },
    { fromKey: "merchant-amz2", toLabel: "Amazon" }
  ]);
  assert.equal(grouped[0].merchant, "Amazon");
  assert.equal(grouped[1].merchant, "Amazon");
  assert.equal(grouped[2].merchant, "Lidl");
  assert.equal(grouped[0].merchantKey, "merchant-amz1");
});

test("Buchungs-ID zerlegt Actual-Eltern- und Kindkennung", () => {
  assert.deepEqual(parseSpendingLineId("parent-1:child-2"), {
    parentId: "parent-1",
    transactionId: "child-2"
  });
  assert.deepEqual(parseSpendingLineId("solo"), {
    parentId: "solo",
    transactionId: "solo"
  });
});

test("Review löst die echte Actual-Kategorie über den öffentlichen Schlüssel", () => {
  const catalog = [
    { key: "category-food", id: "food-uuid", name: "Lebensmittel", group: "Ausgaben", isIncome: false },
    { key: "category-salary", id: "salary-uuid", name: "Gehalt", group: "Einnahmen", isIncome: true }
  ];
  assert.equal(resolveReviewCategory(catalog, "category-salary")?.id, "salary-uuid");
  assert.equal(resolveReviewCategory(catalog)?.id, undefined);
  assert.throws(
    () => resolveReviewCategory(catalog, "category-missing"),
    /Kategorie nicht gefunden/
  );
});

test("Actual-Writeback setzt Kategorie und legt Payee bei Bedarf an", async () => {
  const calls: string[] = [];
  const result = await updateActualReviewTransaction({
    lineId: "parent:child",
    categoryId: "food",
    payeeName: "Amazon",
    serverURL: "http://actual",
    budgetId: "budget",
    password: "secret",
    dataDir: "/tmp/unused",
    loadApi: async () => ({
      async init() { calls.push("init"); },
      async downloadBudget(id: string) { calls.push(`download:${id}`); },
      async getPayees() {
        return [{ id: "old", name: "Amazon EU SARL" }];
      },
      async createPayee(payee: { name: string }) {
        calls.push(`create:${payee.name}`);
        return "payee-amazon";
      },
      async updateTransaction(id: string, fields: { category?: string; payee?: string }) {
        calls.push(`update:${id}:${fields.category}:${fields.payee}`);
        return [];
      },
      async sync() { calls.push("sync"); },
      async shutdown() { calls.push("shutdown"); }
    })
  });
  assert.equal(result.transactionId, "child");
  assert.equal(result.payeeId, "payee-amazon");
  assert.deepEqual(calls, [
    "init",
    "download:budget",
    "create:Amazon",
    "update:child:food:payee-amazon",
    "sync",
    "shutdown"
  ]);
});
