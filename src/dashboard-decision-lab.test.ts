import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardAssets } from "./dashboard-assets.js";
import type { DashboardSavingsBaseline } from "./dashboard-savings-baseline.js";
import {
  buildDashboardDecisionLab,
  decisionLabInputs,
  decisionTrendOptions
} from "./dashboard-decision-lab.js";

const assets = {
  generatedAt: "2026-08-22T12:00:00.000Z",
  state: "current",
  totalMinor: 20_000_000,
  basis: "latest-available",
  marketHistory: { status: "current", latestDate: "2026-08-22" },
  summary: { automaticCurrent: 4, automaticTotal: 4, confirmed: 1 },
  areas: [
    { key: "cash", label: "Liquidität", amountMinor: 2_000_000, percent: 10, positions: 2, status: "current" },
    { key: "depots", label: "Depots", amountMinor: 18_000_000, percent: 90, positions: 3, status: "current" }
  ],
  positions: [],
  warnings: []
} satisfies DashboardAssets;

function trendMonth(month: string, incomeMinor: number, expensesMinor: number) {
  return {
    month,
    payrollRegularMinor: incomeMinor,
    payrollVariableMinor: 0,
    secondIncomeRegularMinor: 0,
    secondIncomeVariableMinor: 0,
    manualForwardedUnassignedMinor: 0,
    otherIncomeRegularMinor: 0,
    otherIncomeVariableMinor: 0,
    reimbursementMinor: 0,
    passThroughMinor: 0,
    investmentReturnMinor: 0,
    internalTransferMinor: 0,
    unreviewedIncomeMinor: 0,
    unknownPositiveMinor: 0,
    consumptionMinor: expensesMinor,
    committedOutflowMinor: 0
  };
}

const trendMonths = [
  ...Array.from({ length: 12 }, (_, index) =>
    trendMonth(`2025-${String(index + 1).padStart(2, "0")}`, 700_000, 600_000)),
  ...Array.from({ length: 6 }, (_, index) =>
    trendMonth(`2026-${String(index + 1).padStart(2, "0")}`, 800_000, 650_000)),
  trendMonth("2026-07", 900_000, 700_000)
];

const cashflow = {
  generatedAt: "2026-08-22T12:01:00.000Z",
  state: "current",
  source: "Actual",
  window: { start: "2025-08", end: "2026-07", months: 12 },
  payroll: { months: 12, regularMonthlyMinor: 450_000, variableAnnualMinor: 1_200_000, estimate: true },
  manualForwardedIncome: { status: "assigned", occurrences: 12, assignedOccurrences: 12, unassignedOccurrences: 0, amountMinor: 2_400_000, unassignedAmountMinor: 0, regularMonthlyMinor: 200_000, variableAnnualMinor: 240_000, estimate: true },
  otherIncome: { regularMonthlyMinor: 60_000, regularAnnualMinor: 720_000, variableAnnualMinor: 1_560_000, reimbursementsAnnualMinor: 0, passThroughAnnualMinor: 0, investmentReturnAnnualMinor: 0, internalTransferAnnualMinor: 0, unreviewedMinor: 0, unknownPositiveMinor: 0, estimate: true },
  consumption: { typicalMonthlyMinor: 700_000, estimate: true },
  committedOutflow: { grossMonthlyMinor: 40_000, earmarkedFundingMonthlyMinor: 10_000, householdContributionMonthlyMinor: 30_000, grossAnnualMinor: 480_000, earmarkedFundingAnnualMinor: 120_000, householdContributionAnnualMinor: 360_000, estimate: true },
  savingsCapacityMonthlyMinor: -20_000,
  months: trendMonths,
  warnings: [],
  basis: []
} satisfies DashboardSavingsBaseline;

test("Entscheidungslabor begrenzt Annahmen und verwendet konservative Standardwerte", () => {
  assert.deepEqual(decisionLabInputs({
    trendBasis: "last-month",
    realReturnBps: 99_999,
    monthlyChangeMinor: 5_000_000,
    oneTimeMinor: -500_000_000
  }), {
    horizonYears: 20,
    trendBasis: "last-month",
    realReturnBps: 1_000,
    monthlyChangeMinor: 1_000_000,
    oneTimeMinor: -100_000_000
  });
});

test("YTD ist Standard und alle drei historischen Ausgangsbasen bleiben nachvollziehbar", () => {
  const options = decisionTrendOptions(cashflow);
  assert.deepEqual(options.map((option) => [
    option.key,
    option.months,
    option.averageMonthlyNetMinor,
    option.annualizedNetMinor
  ]), [
    ["ytd", 7, 157_143, 1_885_716],
    ["last-month", 1, 200_000, 2_400_000],
    ["ytd-plus-last-year", 19, 121_053, 1_452_636]
  ]);
  assert.equal(decisionLabInputs().trendBasis, "ytd");
});

test("Basis und Szenario bleiben getrennt und alle Werte sind Schätzungen", () => {
  const result = buildDashboardDecisionLab(assets, cashflow, {
    trendBasis: "ytd-plus-last-year",
    realReturnBps: 0,
    monthlyChangeMinor: 30_000,
    oneTimeMinor: -1_000_000
  }, new Date("2026-08-22T12:02:00.000Z"));
  assert.equal(result.state, "current");
  assert.equal(result.estimate, true);
  assert.equal(result.basis.selectedTrend.key, "ytd-plus-last-year");
  assert.equal(result.basis.selectedTrend.incomeMinor, 14_100_000);
  assert.equal(result.basis.selectedTrend.expensesMinor, 11_800_000);
  assert.equal(result.basis.projectedMonthlyCapacityMinor, 121_053);
  assert.equal(result.series[0].baselineMinor, 20_000_000);
  assert.equal(result.series[0].scenarioMinor, 19_000_000);
  assert.deepEqual(result.milestones[0], {
    year: 1,
    baselineMinor: 21_452_636,
    scenarioMinor: 20_812_636,
    differenceMinor: -640_000
  });
  assert.match(result.basisNotes.join(" "), /\[SCHÄTZUNG\]/);
});

test("fehlende Vermögens- oder Sparratenbasis erzeugt keine erfundene Projektion", () => {
  const result = buildDashboardDecisionLab(
    { ...assets, state: "partial", totalMinor: null, warnings: ["Depotwert fehlt"] },
    { ...cashflow, state: "partial", months: [] },
    {},
    new Date("2026-08-22T12:02:00.000Z")
  );
  assert.equal(result.state, "partial");
  assert.equal(result.series.length, 0);
  assert.equal(result.milestones.length, 0);
  assert.match(result.warnings.join(" "), /nicht verfügbar/);
});

test("aufgebrauchtes Finanzvermögen wird bei null begrenzt statt als Schuld fortgeschrieben", () => {
  const result = buildDashboardDecisionLab(
    { ...assets, totalMinor: 100_000 },
    { ...cashflow, months: [trendMonth("2026-07", 0, 100_000)] },
    { realReturnBps: 0 },
    new Date("2026-08-22T12:02:00.000Z")
  );
  assert.equal(result.depletion.baselineAfterMonths, 1);
  assert.equal(result.series[1].baselineMinor, 0);
  assert.equal(result.series[20].baselineMinor, 0);
});
