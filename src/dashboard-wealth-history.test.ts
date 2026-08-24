import assert from "node:assert/strict";
import test from "node:test";
import { readDashboardWealthHistory } from "./dashboard-wealth-history.js";
import type { AppConfig } from "./types.js";

const config = {
  timezone: "Europe/Berlin",
  sources: [],
  actual: { enabled: true, serverUrl: "http://actual", budgetId: "budget" },
  ghostfolio: { enabled: true, serverUrl: "http://ghostfolio", accountMap: {} }
} as unknown as AppConfig;

test("Vermögenshistorie verbindet Kontosalden und Anlagen ohne alte Lücken zu verstecken", async () => {
  const actual = {
    async init() {}, async downloadBudget() {}, async shutdown() {},
    async getAccounts() { return [{ id: "giro" }]; },
    async getTransactions() {
      return [{ date: "2024-07-31", starting_balance_flag: true }];
    },
    async getAccountBalance(_id: string, cutoff?: Date) {
      return cutoff && cutoff < new Date("2024-07-31T00:00:00Z") ? 0 : 10_000;
    }
  };
  const fetcher = async (input: string | URL) => {
    const url = String(input);
    if (url.includes("/auth/anonymous")) {
      return new Response(JSON.stringify({ authToken: "session" }), { status: 201 });
    }
    return new Response(JSON.stringify({ chart: [
      { date: "2023-12-31", netWorth: 50_000 },
      { date: "2024-07-31", netWorth: 60_000 },
      { date: "2026-07-27", netWorth: 70_000 },
      { date: "2026-08-24", netWorth: 72_000 }
    ] }), { status: 200 });
  };
  const result = await readDashboardWealthHistory(config, new Date("2026-08-24T12:00:00Z"), {
    password: "secret",
    ghostfolioAccessToken: "secret",
    fetcher: fetcher as typeof fetch,
    loadActual: async () => actual
  });
  assert.equal(result.coverage.completeFrom, "2026-07-27");
  assert.equal(result.points[0].quality, "partial");
  assert.equal(result.points.at(-1)?.quality, "measured");
  assert.equal(result.points.at(-1)?.totalMinor, 7_210_000);
});
