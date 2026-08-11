import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FinanceDatabase } from "./database.js";
import type { AppConfig } from "./types.js";
import {
  buildDashboardOverview,
  overviewMonthKeys,
  readActualOverview,
  readInvestmentOverview,
  type ActualOverviewSnapshot,
  type InvestmentOverviewSnapshot
} from "./dashboard-overview.js";

const config: AppConfig = {
  port: 8080,
  timezone: "Europe/Berlin",
  sources: [
    { id: "dkb-giro", kind: "enable-banking", enabled: true },
    { id: "comdirect-giro", kind: "enable-banking", enabled: true },
    { id: "dkb-depots", kind: "dkb-fints", enabled: true },
    { id: "solana", kind: "solana", enabled: true },
    {
      id: "sutor-riester",
      kind: "manual",
      enabled: true,
      settings: { displayName: "Sutor Riester" }
    }
  ],
  actual: {
    enabled: true,
    serverUrl: "http://actual:5006",
    budgetId: "budget",
    dataDir: "/tmp/unused",
    accountMap: {}
  },
  ghostfolio: {
    enabled: true,
    serverUrl: "http://ghostfolio:3333",
    accountMap: {
      "dkb-depot": "gf-depot",
      "solana-wallet": "gf-solana",
      "sutor-contract": "gf-sutor"
    }
  }
};

function database(): FinanceDatabase {
  const db = new FinanceDatabase(join(mkdtempSync(join(tmpdir(), "overview-db-")), "finance.sqlite"));
  for (const source of config.sources) {
    db.registerSource(source.id, source.kind, source.enabled);
    const run = db.beginRun(source.id);
    db.finishRun(run, source.id, source.kind === "manual" ? "WAITING_FOR_USER" : "SUCCESS", "ok");
  }
  db.importBalances([
    { sourceId: "dkb-giro", accountId: "dkb-one", capturedAt: "2026-08-10T08:00:00Z", amountMinor: 1_600_000n, currency: "EUR", rawHash: "cash-one" },
    { sourceId: "comdirect-giro", accountId: "comdirect-one", capturedAt: "2026-08-10T08:05:00Z", amountMinor: 225_900n, currency: "EUR", rawHash: "cash-two" },
    { sourceId: "dkb-depots", accountId: "dkb-depot", capturedAt: "2026-08-10T08:10:00Z", amountMinor: 3_400_000n, currency: "EUR", rawHash: "depot" },
    { sourceId: "solana", accountId: "solana-wallet", capturedAt: "2026-08-10T08:15:00Z", amountMinor: 100n, currency: "LAMPORT", rawHash: "solana" },
    { sourceId: "sutor-riester", accountId: "sutor-contract", capturedAt: "2026-07-17T22:00:00Z", amountMinor: 7_200_000n, currency: "EUR", rawHash: "sutor" }
  ]);
  return db;
}

const actual: ActualOverviewSnapshot = {
  months: [
    { key: "2026-05", label: "Mai", incomeMinor: 1_800_000, spentMinor: 900_000, partial: false },
    { key: "2026-06", label: "Jun", incomeMinor: 500_000, spentMinor: 800_000, partial: false },
    { key: "2026-07", label: "Jul", incomeMinor: 380_000, spentMinor: 1_480_000, partial: false },
    { key: "2026-08", label: "Aug", incomeMinor: 0, spentMinor: 220_000, partial: true }
  ],
  range: {
    months: 4,
    offset: 0,
    start: "2026-05",
    end: "2026-08",
    endPartial: true
  },
  categoryMonth: "2026-07",
  categoryMonthLabel: "Juli",
  categoryMonthOffset: 0,
  latestCategoryMonth: "2026-07",
  categoryTotalMinor: 1_480_000,
  categories: [{ label: "Lebensmittel", amountMinor: 150_000 }],
  remainingMinor: 1_330_000
};

const investments: InvestmentOverviewSnapshot = {
  amountMinor: 16_176_600,
  capturedAt: "2026-08-10T20:00:00Z",
  allocation: [
    { key: "pensions", label: "Vorsorge", amountMinor: 11_370_000 },
    { key: "depots", label: "Depots", amountMinor: 3_410_000 },
    { key: "solana", label: "Solana", amountMinor: 1_396_600 }
  ]
};

test("Übersicht summiert nur aktuelle Girostände und Ghostfolio-Anlagen", () => {
  const db = database();
  try {
    const result = buildDashboardOverview(
      db,
      config,
      { status: "fulfilled", value: actual },
      { status: "fulfilled", value: investments },
      new Date("2026-08-10T21:20:00Z")
    );
    assert.equal(result.cash.amountMinor, 1_825_900);
    assert.equal(result.investments.amountMinor, 16_176_600);
    assert.equal(result.totalMinor, 18_002_500);
    assert.equal(result.spending.totalMinor, 1_480_000);
    assert.equal(result.state, "current");
    assert.equal(result.freshness.find((item) => item.key === "pensions")?.status, "confirmed");
  } finally {
    db.close();
  }
});

test("Fehlende Spezialansicht wird nicht durch null Euro ersetzt", () => {
  const db = database();
  try {
    const result = buildDashboardOverview(
      db,
      config,
      { status: "fulfilled", value: actual },
      { status: "rejected", reason: new Error("offline") },
      new Date("2026-08-10T21:20:00Z")
    );
    assert.equal(result.totalMinor, null);
    assert.equal(result.investments.amountMinor, null);
    assert.equal(result.state, "partial");
    assert.match(result.warnings.join(" "), /Ghostfolio/);
  } finally {
    db.close();
  }
});

test("Actual liefert vier Monate und die vier größten Kategorien des letzten vollständigen Monats", async () => {
  const calls: string[] = [];
  const budgetData: Record<string, { totalIncome: number; totalSpent: number; categoryGroups: Array<Record<string, unknown>> }> = {
    "2026-05": { totalIncome: 100, totalSpent: -200, categoryGroups: [] },
    "2026-06": { totalIncome: 300, totalSpent: -400, categoryGroups: [] },
    "2026-07": {
      totalIncome: 500,
      totalSpent: -1500,
      categoryGroups: [{
        name: "Alltag",
        categories: [
          { name: "A", spent: -500 },
          { name: "B", spent: -400 },
          { name: "C", spent: -300 },
          { name: "D", spent: -200 },
          { name: "E", spent: -100 }
        ]
      }]
    },
    "2026-08": { totalIncome: 0, totalSpent: -50, categoryGroups: [] }
  };
  const result = await readActualOverview(
    config.actual!,
    config.timezone,
    new Date("2026-08-10T12:00:00Z"),
    {
      password: "secret",
      loadApi: async () => ({
        async init() { calls.push("init"); },
        async downloadBudget() { calls.push("download"); },
        async getBudgetMonth(month) { return budgetData[month] as never; },
        async shutdown() { calls.push("shutdown"); }
      })
    }
  );
  assert.deepEqual(overviewMonthKeys(new Date("2026-08-10T12:00:00Z"), config.timezone).map((month) => month.key), [
    "2026-05", "2026-06", "2026-07", "2026-08"
  ]);
  assert.deepEqual(result.categories.map((category) => category.label), ["A", "B", "C", "D"]);
  assert.equal(result.remainingMinor, 100);
  assert.deepEqual(result.range, {
    months: 4,
    offset: 0,
    start: "2026-05",
    end: "2026-08",
    endPartial: true
  });
  assert.equal(result.categoryMonthOffset, 0);
  assert.equal(result.latestCategoryMonth, "2026-07");
  assert.deepEqual(calls, ["init", "download", "shutdown"]);
});

test("Ausgabenkategorien können unabhängig auf einen älteren Monat gesetzt werden", async () => {
  const budgetData = {
    "2026-05": { totalIncome: 100, totalSpent: -200, categoryGroups: [] },
    "2026-06": {
      totalIncome: 300,
      totalSpent: -400,
      categoryGroups: [{ categories: [{ name: "Reisen", spent: -250 }, { name: "Alltag", spent: -150 }] }]
    },
    "2026-07": { totalIncome: 500, totalSpent: -1500, categoryGroups: [] },
    "2026-08": { totalIncome: 0, totalSpent: -50, categoryGroups: [] }
  } as const;
  const result = await readActualOverview(
    config.actual!,
    config.timezone,
    new Date("2026-08-10T12:00:00Z"),
    {
      password: "secret",
      spendingOffset: 1,
      loadApi: async () => ({
        async init() {},
        async downloadBudget() {},
        async getBudgetMonth(month) { return budgetData[month as keyof typeof budgetData] as never; },
        async shutdown() {}
      })
    }
  );
  assert.equal(result.categoryMonth, "2026-06");
  assert.equal(result.categoryMonthLabel, "Juni");
  assert.equal(result.categoryMonthOffset, 1);
  assert.equal(result.latestCategoryMonth, "2026-07");
  assert.equal(result.categoryTotalMinor, 400);
  assert.deepEqual(result.categories.map((category) => category.label), ["Reisen", "Alltag"]);
});

test("Geldfluss-Zeitraum kann erweitert und monatsweise zurückgesetzt werden", () => {
  const keys = overviewMonthKeys(
    new Date("2026-08-10T12:00:00Z"),
    config.timezone,
    6,
    2
  );
  assert.deepEqual(keys.map((month) => month.key), [
    "2026-01", "2026-02", "2026-03", "2026-04", "2026-05", "2026-06"
  ]);
  assert.equal(keys.some((month) => month.partial), false);
});

test("Ghostfolio-Werte werden anhand der FinanceSync-Quellen gruppiert", async () => {
  const db = database();
  const requests: string[] = [];
  try {
    const result = await readInvestmentOverview(config, db, {
      securityToken: "permanent",
      fetcher: async (input) => {
        requests.push(String(input));
        if (String(input).endsWith("/api/v1/auth/anonymous")) {
          return Response.json({ authToken: "temporary" });
        }
        return Response.json({
          createdAt: "2026-08-10T20:00:00Z",
          accounts: {
            "gf-depot": { valueInBaseCurrency: 34_000 },
            "gf-solana": { valueInBaseCurrency: 14_000 },
            "gf-sutor": { valueInBaseCurrency: 72_000 }
          },
          summary: { totalValueInBaseCurrency: 120_000 }
        });
      }
    });
    assert.equal(result.amountMinor, 12_000_000);
    assert.deepEqual(result.allocation.map((item) => item.amountMinor), [7_200_000, 3_400_000, 1_400_000]);
    assert.equal(requests.length, 2);
  } finally {
    db.close();
  }
});
