import assert from "node:assert/strict";
import test from "node:test";
import type { AppConfig } from "./types.js";
import {
  buildDashboardSpending,
  readActualSpendingMonth,
  reviewWindowSelection,
  spendingMonthSelection,
  spendingPeriodSelection
} from "./dashboard-spending.js";

const actual: NonNullable<AppConfig["actual"]> = {
  enabled: true,
  serverUrl: "http://actual:5006",
  budgetId: "budget",
  dataDir: "/tmp/unused",
  accountMap: {}
};

test("letzter vollständiger Monat ist Standard und Zukunft wird abgewiesen", () => {
  assert.deepEqual(
    spendingMonthSelection(new Date("2026-08-11T08:00:00Z"), "Europe/Berlin"),
    { month: "2026-07", latestMonth: "2026-07", oldestMonth: "2016-07" }
  );
  assert.equal(
    spendingMonthSelection(new Date("2026-08-11T08:00:00Z"), "Europe/Berlin", "2026-08").month,
    "2026-07"
  );
  assert.equal(
    spendingMonthSelection(new Date("2026-08-11T08:00:00Z"), "Europe/Berlin", "2025-12").month,
    "2025-12"
  );
});

test("Prüffenster umfasst die letzten vollständigen Monate", () => {
  assert.deepEqual(
    reviewWindowSelection(new Date("2026-08-11T08:00:00Z"), "Europe/Berlin", 6),
    {
      months: 6,
      startDate: "2026-02-01",
      endDate: "2026-07-31",
      startMonth: "2026-02",
      endMonth: "2026-07"
    }
  );
});

test("Actual-Ausgaben schließen Transfers und Off-Budget aus und verrechnen Erstattungen", async () => {
  const calls: string[] = [];
  const snapshot = await readActualSpendingMonth(
    actual,
    "Europe/Berlin",
    "2026-07",
    new Date("2026-08-11T08:00:00Z"),
    {
      password: "secret",
      loadApi: async () => ({
        async init() { calls.push("init"); },
        async downloadBudget() { calls.push("download"); },
        async getAccounts() {
          return [
            { id: "giro", name: "Kreditkarte 5426…4008" },
            { id: "joint", name: "Giro Gemeinschaft" },
            { id: "portfolio", name: "Depot", offbudget: true }
          ];
        },
        async getCategories() {
          return [{
            id: "expenses",
            name: "Ausgaben",
            categories: [
              { id: "food", name: "Lebensmittel", group_id: "expenses" },
              { id: "leisure", name: "Freizeit", group_id: "expenses" },
              { id: "fees", name: "Gebühren", group_id: "expenses" },
              { id: "salary", name: "Gehalt", group_id: "income", is_income: true }
            ]
          }];
        },
        async getPayees() {
          return [
            { id: "market", name: "Supermarkt" },
            { id: "private", name: "Max Mustermann" },
            { id: "salary-company", name: "Beispiel GmbH" },
            { id: "transfer", name: "Transfer", transfer_acct: "joint" }
          ];
        },
        async getTransactions(accountId) {
          if (accountId === "joint") {
            return [{
              id: "split",
              is_parent: true,
              account: "joint",
              amount: -5000,
              payee: "market",
              date: "2026-07-20",
              subtransactions: [
                { id: "split-food", is_child: true, account: "joint", amount: -3500, category: "food", date: "2026-07-20" },
                { id: "split-leisure", is_child: true, account: "joint", amount: -1500, category: "leisure", date: "2026-07-20" }
              ]
            }];
          }
          return [
            { id: "food", account: "giro", amount: -10_000, category: "food", payee: "market", date: "2026-07-31" },
            { id: "refund", account: "giro", amount: 2_000, category: "food", payee: "market", date: "2026-07-30" },
            { id: "refund-only", account: "giro", amount: 500, category: "fees", payee: "market", date: "2026-07-30" },
            { id: "private-expense", account: "giro", amount: -4_000, category: "leisure", payee: "private", date: "2026-07-29" },
            { id: "income", account: "giro", amount: 300_000, category: "salary", payee: "salary-company", date: "2026-07-28" },
            { id: "transfer", account: "giro", amount: -50_000, payee: "transfer", transfer_id: "counterpart", date: "2026-07-27" },
            { id: "opening", account: "giro", amount: 1_000, starting_balance_flag: true, date: "2026-07-01" }
          ];
        },
        async shutdown() { calls.push("shutdown"); }
      })
    }
  );
  const result = buildDashboardSpending(snapshot);
  assert.equal(result.summary.totalMinor, 16_500);
  assert.equal(result.summary.bookings, 6);
  assert.equal(result.summary.categorizedPercent, 100);
  assert.equal(result.accounts[0]?.label, "Giro Gemeinschaft");
  assert.equal(result.accounts[1]?.label, "Kreditkarte");
  assert.deepEqual(result.categories.map((category) => [category.label, category.amountMinor]), [
    ["Alle Kategorien", 16_500],
    ["Lebensmittel", 11_500],
    ["Freizeit", 5_500],
    ["Gebühren", -500]
  ]);
  assert.equal(
    result.categories.slice(1).reduce((sum, category) => sum + category.amountMinor, 0),
    result.categories[0].amountMinor
  );
  assert.equal(snapshot.lines.find((row) => row.date === "2026-07-29")?.merchant, "Private Gegenpartei");
  assert.equal(snapshot.lines.find((row) => row.date === "2026-07-29")?.displayMerchant, "Max Mustermann");
  assert.equal(result.transactions.find((row) => row.date === "2026-07-29")?.merchant, "Max Mustermann");
  assert.equal(result.transactions.some((row) => row.merchant === "Transfer"), false);
  assert.deepEqual(calls, ["init", "download", "shutdown"]);
});

test("Kategorie, Konto, Suche und Pagination greifen gemeinsam", () => {
  const snapshot = {
    month: "2026-07",
    monthLabel: "Juli 2026",
    latestMonth: "2026-07",
    oldestMonth: "2016-07",
    generatedAt: "2026-08-11T08:00:00.000Z",
    catalog: [],
    accounts: [
      { key: "account-one", label: "Giro Erik" },
      { key: "account-two", label: "Giro Gemeinschaft" }
    ],
    lines: Array.from({ length: 23 }, (_, index) => ({
      id: `row-${index}`,
      date: `2026-07-${String(31 - index).padStart(2, "0")}`,
      merchantKey: index % 2 ? "merchant-market" : "merchant-books",
      merchant: index % 2 ? "Supermarkt" : "Buchhandlung",
      notes: "",
      accountKey: index % 2 ? "account-one" : "account-two",
      accountLabel: index % 2 ? "Giro Erik" : "Giro Gemeinschaft",
      categoryKey: index % 2 ? "category-food" : "category-books",
      categoryLabel: index % 2 ? "Lebensmittel" : "Freizeit",
      categorized: true,
      amountMinor: 100
    }))
  };
  const first = buildDashboardSpending(snapshot, {
    account: "account-one",
    search: "Supermarkt",
    page: 1,
    pageSize: 20
  });
  assert.equal(first.filtered.bookings, 11);
  assert.equal(first.categories[0].amountMinor, 1100);
  assert.deepEqual(first.categories.slice(1).map((category) => category.label), ["Lebensmittel"]);
  const category = first.categories[1].key;
  const selected = buildDashboardSpending(snapshot, {
    account: "account-one",
    search: "Supermarkt",
    category,
    page: 2,
    pageSize: 20
  });
  assert.equal(selected.selection.category, "category-food");
  assert.equal(selected.pagination.page, 1);
  assert.equal(selected.transactions.length, 11);
});

test("Ausgabenzeitraum kennt Monat, Quartal, YTD und Jahr", () => {
  const now = new Date("2026-08-23T18:00:00.000Z");
  const month = spendingPeriodSelection(now, "Europe/Berlin", { period: "month", month: "2026-03" });
  assert.equal(month.kind, "month");
  assert.equal(month.startMonth, "2026-03");
  assert.equal(month.endMonth, "2026-03");
  assert.equal(month.startDate, "2026-03-01");
  assert.equal(month.endDate, "2026-03-31");
  assert.equal(month.complete, true);

  const currentMonth = spendingPeriodSelection(now, "Europe/Berlin", { period: "month", month: "2026-08" });
  assert.equal(currentMonth.endMonth, "2026-08");
  assert.equal(currentMonth.complete, false);

  const future = spendingPeriodSelection(now, "Europe/Berlin", { period: "month", month: "2026-09" });
  assert.equal(future.endMonth, "2026-08");

  const quarter = spendingPeriodSelection(now, "Europe/Berlin", { period: "quarter", quarter: "2026-Q2" });
  assert.equal(quarter.startMonth, "2026-04");
  assert.equal(quarter.endMonth, "2026-06");
  assert.equal(quarter.complete, true);

  const openQuarter = spendingPeriodSelection(now, "Europe/Berlin", { period: "quarter", quarter: "2026-Q3" });
  assert.equal(openQuarter.startMonth, "2026-07");
  assert.equal(openQuarter.endMonth, "2026-08");
  assert.equal(openQuarter.complete, false);

  const ytd = spendingPeriodSelection(now, "Europe/Berlin", { period: "ytd" });
  assert.equal(ytd.startMonth, "2026-01");
  assert.equal(ytd.endMonth, "2026-08");
  assert.equal(ytd.startDate, "2026-01-01");
  assert.equal(ytd.complete, false);

  const year = spendingPeriodSelection(now, "Europe/Berlin", { period: "year", year: "2025" });
  assert.equal(year.startMonth, "2025-01");
  assert.equal(year.endMonth, "2025-12");
  assert.equal(year.endDate, "2025-12-31");
  assert.equal(year.complete, true);
});

test("Buchungsliste sortiert nach Datum oder Betrag", () => {
  const snapshot = {
    month: "2026-07",
    monthLabel: "Juli 2026",
    latestMonth: "2026-07",
    oldestMonth: "2016-07",
    generatedAt: "2026-08-23T18:00:00.000Z",
    accounts: [{ key: "account-one", label: "Giro" }],
    catalog: [],
    lines: [
      {
        id: "late",
        date: "2026-07-20",
        merchantKey: "merchant-a",
        merchant: "Zoo",
        notes: "",
        accountKey: "account-one",
        accountLabel: "Giro",
        categoryKey: "category-food",
        categoryLabel: "Lebensmittel",
        categorized: true,
        amountMinor: 300
      },
      {
        id: "early",
        date: "2026-07-01",
        merchantKey: "merchant-b",
        merchant: "Alpha",
        notes: "",
        accountKey: "account-one",
        accountLabel: "Giro",
        categoryKey: "category-food",
        categoryLabel: "Lebensmittel",
        categorized: true,
        amountMinor: 900
      }
    ]
  };
  const newest = buildDashboardSpending(snapshot);
  assert.deepEqual(newest.transactions.map((row) => row.date), ["2026-07-20", "2026-07-01"]);
  const oldest = buildDashboardSpending(snapshot, { sort: "date-asc" });
  assert.deepEqual(oldest.transactions.map((row) => row.date), ["2026-07-01", "2026-07-20"]);
  const amountDesc = buildDashboardSpending(snapshot, { sort: "amount-desc" });
  assert.deepEqual(amountDesc.transactions.map((row) => row.amountMinor), [900, 300]);
  const amountAsc = buildDashboardSpending(snapshot, { sort: "amount-asc" });
  assert.deepEqual(amountAsc.transactions.map((row) => row.amountMinor), [300, 900]);
  assert.equal(amountDesc.selection.sort, "amount-desc");
});
