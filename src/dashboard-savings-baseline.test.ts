import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDashboardSavingsBaseline,
  payrollEconomicMonth,
  readActualSavingsCashflow,
  savingsMerchantKey,
  type SavingsCashflowLine,
  type SavingsCashflowSnapshot
} from "./dashboard-savings-baseline.js";
import type { AppConfig } from "./types.js";

const manualKey = "merchant-1234567890abcdef";
const config: AppConfig = {
  port: 8080,
  timezone: "Europe/Berlin",
  sources: [],
  analysis: {
    savingsBaseline: { manualForwardedIncomeMerchantKeys: [manualKey] }
  }
};

function line(overrides: Partial<SavingsCashflowLine>): SavingsCashflowLine {
  return {
    date: "2026-07-01",
    amountMinor: 0,
    categoryIsIncome: false,
    merchantKey: "merchant-aaaaaaaaaaaaaaaa",
    purpose: "",
    transfer: false,
    startingBalance: false,
    ...overrides
  };
}

function snapshot(lines: SavingsCashflowLine[]): SavingsCashflowSnapshot {
  return {
    startDate: "2025-08-01",
    endDate: "2026-07-31",
    generatedAt: "2026-08-22T10:00:00.000Z",
    lines
  };
}

test("Payroll-Zweck ordnet nach Leistungsmonat zu, ohne Personalnummer auszugeben", () => {
  assert.equal(
    payrollEconomicMonth("PAYROLL 123456 /202607"),
    "2026-07"
  );
  const result = buildDashboardSavingsBaseline(snapshot([
    line({
      date: "2026-07-30",
      amountMinor: 458_724,
      purpose: "PAYROLL 123456 /202607"
    })
  ]), config, new Date("2026-08-22T10:00:00.000Z"));
  assert.equal(result.months.find((month) => month.month === "2026-07")?.payrollRegularMinor, 458_724);
  assert.doesNotMatch(JSON.stringify(result), /123456/);
});

test("Arbeitgeber-Einmalzahlung bleibt vom regelmäßigen Gehalt getrennt", () => {
  const result = buildDashboardSavingsBaseline(snapshot([
    line({ date: "2026-01-29", amountMinor: 460_000, purpose: "PAYROLL x /202601" }),
    line({ date: "2026-02-26", amountMinor: 470_000, purpose: "PAYROLL x /202602" }),
    line({ date: "2026-03-30", amountMinor: 1_600_000, purpose: "PAYROLL x /202603" })
  ]), config, new Date("2026-08-22T10:00:00.000Z"));
  assert.equal(result.payroll.regularMonthlyMinor, 470_000);
  assert.equal(result.months.find((month) => month.month === "2026-03")?.payrollRegularMinor, 470_000);
  assert.equal(result.payroll.variableAnnualMinor, 1_130_000);
});

test("manuell weitergeleitetes Zweitgehalt bleibt bis zur Monatszuordnung ausgeschlossen", () => {
  const result = buildDashboardSavingsBaseline(snapshot([
    line({
      date: "2026-05-29",
      amountMinor: 210_000,
      categoryLabel: "Sonstige Einnahmen",
      categoryIsIncome: true,
      merchantKey: manualKey
    }),
    line({
      date: "2026-07-02",
      amountMinor: 210_000,
      categoryLabel: "Sonstige Einnahmen",
      categoryIsIncome: true,
      merchantKey: manualKey
    })
  ]), config, new Date("2026-08-22T10:00:00.000Z"));
  assert.equal(result.state, "partial");
  assert.deepEqual(result.manualForwardedIncome, {
    status: "needs-assignment",
    occurrences: 2,
    amountMinor: 420_000
  });
  assert.equal(result.otherIncome.amountMinor, 0);
  assert.equal(result.savingsCapacityMonthlyMinor, null);
});

test("interne Überträge und Sparen werden nicht als Konsum oder Einkommen gezählt", () => {
  const result = buildDashboardSavingsBaseline(snapshot([
    line({
      amountMinor: 500_000,
      categoryLabel: "Gehalt",
      categoryIsIncome: true,
      transfer: true
    }),
    line({ amountMinor: -100_000, categoryLabel: "Sparen & Investieren" }),
    line({ amountMinor: -80_000, categoryLabel: "Lebensmittel" })
  ]), config, new Date("2026-08-22T10:00:00.000Z"));
  assert.equal(result.otherIncome.amountMinor, 0);
  assert.equal(result.months.find((month) => month.month === "2026-07")?.consumptionMinor, 80_000);
});

test("Actual-Leser bildet nur pseudonyme Gegenparteischlüssel und erkennt Transfers", async () => {
  const result = await readActualSavingsCashflow(
    {
      enabled: true,
      serverUrl: "http://actual.invalid",
      budgetId: "budget",
      dataDir: "/tmp/unused",
      accountMap: {}
    },
    "Europe/Berlin",
    new Date("2026-08-22T10:00:00.000Z"),
    {
      password: "test",
      loadApi: async () => ({
        async init() {},
        async downloadBudget() {},
        async getAccounts() {
          return [{ id: "account-onbudget" }, { id: "account-offbudget", offbudget: true }];
        },
        async getCategories() {
          return [{ id: "income", name: "Gehalt", is_income: true }];
        },
        async getPayees() {
          return [
            { id: "private-payee" },
            { id: "transfer-payee", transfer_acct: "other-account" }
          ];
        },
        async getTransactions(accountId) {
          assert.equal(accountId, "account-onbudget");
          return [
            {
              id: "income-1",
              date: "2026-07-30",
              amount: 458_724,
              payee: "private-payee",
              category: "income",
              notes: "PAYROLL 123456 /202607"
            },
            {
              id: "transfer-1",
              date: "2026-07-30",
              amount: 210_000,
              payee: "transfer-payee"
            }
          ];
        },
        async shutdown() {}
      })
    }
  );
  assert.equal(result.lines.length, 2);
  assert.equal(result.lines[0].merchantKey, savingsMerchantKey("private-payee"));
  assert.equal(result.lines[1].transfer, true);
  assert.doesNotMatch(JSON.stringify(result.lines.map(({ purpose: _purpose, ...line }) => line)), /private-payee|123456/);
});
