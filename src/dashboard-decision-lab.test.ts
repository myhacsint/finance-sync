import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardAssets } from "./dashboard-assets.js";
import type { DashboardSavingsBaseline } from "./dashboard-savings-baseline.js";
import type { DashboardRecurringExpenseOptimizations } from "./dashboard-recurring-expenses.js";
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
    committedOutflowMinor: 0,
    investmentOutflowMinor: 0
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
  window: { start: "2025-08", end: "2026-07", months: 12, currentMonthIncluded: false },
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

const optimizations = {
  generatedAt: "2026-08-22T12:00:00.000Z",
  state: "current",
  source: "Actual",
  freshness: {
    lastSuccessfulAt: "2026-08-22T12:00:00.000Z",
    windowStart: "2024-01-01",
    windowEnd: "2026-07-31",
    lastCompleteMonth: "2026-07"
  },
  summary: { candidates: 0, actioned: 0, plannedOrCancelled: 0, expectedAnnualSavingsMinor: null },
  items: [],
  warnings: [],
  basis: []
} satisfies DashboardRecurringExpenseOptimizations;

test("Entscheidungslabor begrenzt Annahmen und verwendet konservative Standardwerte", () => {
  assert.deepEqual(decisionLabInputs({
    trendBasis: "current-year",
    realReturnBps: 99_999,
    monthlyChangeMinor: 5_000_000,
    oneTimeMinor: -500_000_000
  }), {
    horizonYears: 20,
    trendBasis: "current-year",
    realReturnBps: 1_000,
    monthlyChangeMinor: 1_000_000,
    oneTimeMinor: -100_000_000,
    fireTargetAge: 60,
    fireActionKeys: []
  });
});

test("aktuelles Jahr verbindet YTD-Bilanz und typischen Monat als Standard", () => {
  const options = decisionTrendOptions(cashflow);
  assert.deepEqual(options.map((option) => [
    option.key,
    option.months,
    option.averageMonthlyNetMinor,
    option.annualizedNetMinor,
    option.excludedIncomeMinor
  ]), [
    ["current-year", 7, 150_000, 1_800_000, 0],
    ["ytd-plus-last-year", 19, 121_053, 1_452_636, 0]
  ]);
  assert.equal(decisionLabInputs().trendBasis, "current-year");
  assert.equal(options[0].monthlyIncomeMinor, 800_000);
  assert.equal(options[0].monthlyExpensesMinor, 650_000);
});

test("Jahresausblick vergleicht Ist mit Median-Pfad und schreibt nur Restmonate fort", () => {
  const result = buildDashboardDecisionLab(assets, cashflow, optimizations);
  assert.deepEqual(result.basis.annualOutlook, {
    available: true,
    year: 2026,
    throughMonth: "2026-07",
    completedMonths: 7,
    remainingMonths: 5,
    actualToDate: {
      incomeMinor: 5_700_000,
      expensesMinor: 4_600_000,
      netMinor: 1_100_000
    },
    expectedToDate: {
      incomeMinor: 5_600_000,
      expensesMinor: 4_550_000,
      netMinor: 1_050_000
    },
    varianceToExpected: {
      incomeMinor: 100_000,
      expensesMinor: 50_000,
      netMinor: 50_000
    },
    projectedYearEnd: {
      incomeMinor: 9_700_000,
      expensesMinor: 7_850_000,
      netMinor: 1_850_000
    },
    medianFullYear: {
      incomeMinor: 9_600_000,
      expensesMinor: 7_800_000,
      netMinor: 1_800_000
    },
    currentMonthExcluded: false,
    estimate: true
  });
});

test("Basis und Szenario bleiben getrennt und alle Werte sind Schätzungen", () => {
  const result = buildDashboardDecisionLab(assets, cashflow, optimizations, {
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
  assert.deepEqual(result.basis.lastMonthComparison, {
    month: "2026-07",
    incomeMinor: 900_000,
    expensesMinor: 700_000,
    netMinor: 200_000,
    incomeDifferenceMinor: 100_000,
    expensesDifferenceMinor: 50_000,
    netDifferenceMinor: 50_000
  });
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

test("Einnahmen und Vermögensbildung werden transparent getrennt", () => {
  const enriched = {
    ...cashflow,
    months: cashflow.months.map((month, index) => index === cashflow.months.length - 1
      ? {
          ...month,
          payrollRegularMinor: 450_000,
          payrollVariableMinor: 50_000,
          secondIncomeRegularMinor: 200_000,
          otherIncomeRegularMinor: 51_800,
          passThroughMinor: 10_000,
          investmentReturnMinor: 3_500,
          committedOutflowMinor: 40_000,
          investmentOutflowMinor: 75_000
        }
      : month)
  } satisfies DashboardSavingsBaseline;
  const result = buildDashboardDecisionLab(assets, enriched, optimizations, { trendBasis: "current-year" });
  assert.ok(result.basis.selectedTrend.incomeBreakdown);
  assert.ok(result.basis.selectedTrend.wealthBuilding);
  assert.equal(result.basis.selectedTrend.incomeBreakdown.investmentReturnsExcludedMinor, 0);
  assert.equal(result.basis.selectedTrend.wealthBuilding.employeeStockBenefitStatus, "unavailable");
  assert.equal(result.basis.selectedTrend.wealthBuilding.employeeStockBenefitMinor, null);
});

test("aktueller unvollständiger Monat bleibt sichtbar, aber außerhalb der Projektion", () => {
  const withCurrentMonth = {
    ...cashflow,
    window: {
      start: "2025-08",
      end: "2026-08",
      months: 13,
      currentMonthIncluded: true
    },
    months: [...cashflow.months, trendMonth("2026-08", 300_000, 250_000)]
  } satisfies DashboardSavingsBaseline;
  const result = buildDashboardDecisionLab(
    assets,
    withCurrentMonth,
    optimizations,
    {},
    new Date("2026-08-22T12:02:00.000Z")
  );
  assert.equal(result.basis.selectedTrend.months, 7);
  assert.equal(result.basis.projectedMonthlyCapacityMinor, 150_000);
  assert.deepEqual(result.basis.currentMonthProgress, {
    month: "2026-08",
    throughDate: "2026-08-22",
    incomeMinor: 300_000,
    expensesMinor: 250_000,
    netMinor: 50_000,
    incomeDifferenceMinor: -500_000,
    expensesDifferenceMinor: -400_000,
    netDifferenceMinor: -100_000,
    excludedIncomeMinor: 0,
    pendingCardExpensesMinor: 0,
    pendingCardCapturedAt: null,
    pendingCardLabel: null
  });
});

test("offener Kartenstand ergänzt nur den laufenden Monat und bleibt aus der Projektion", () => {
  const current = {
    ...trendMonth("2026-08", 300_000, 250_000),
    pendingCardExpenseMinor: 34_781
  };
  const withPendingCard = {
    ...cashflow,
    window: { start: "2025-08", end: "2026-08", months: 13, currentMonthIncluded: true },
    pendingCreditCardBalances: {
      totalMinor: 34_781,
      entries: [{
        id: "miles-more",
        label: "Miles & More Kreditkarte",
        amountMinor: 34_781,
        capturedAt: "2026-08-22",
        source: "Kreditkarten-Banking"
      }]
    },
    months: [...cashflow.months, current]
  } satisfies DashboardSavingsBaseline;
  const result = buildDashboardDecisionLab(assets, withPendingCard, optimizations);
  assert.equal(result.basis.projectedMonthlyCapacityMinor, 150_000);
  assert.equal(result.basis.currentMonthProgress.expensesMinor, 284_781);
  assert.equal(result.basis.currentMonthProgress.netMinor, 15_219);
  assert.equal(result.basis.currentMonthProgress.pendingCardExpensesMinor, 34_781);
  assert.equal(result.basis.currentMonthProgress.pendingCardLabel, "Miles & More Kreditkarte");
  assert.equal(result.basis.annualOutlook.currentMonthExcluded, true);
  assert.equal(result.basis.annualOutlook.actualToDate.netMinor, 1_100_000);
  assert.equal(result.basis.annualOutlook.projectedYearEnd.netMinor, 1_850_000);
});

test("fehlende Vermögens- oder Sparratenbasis erzeugt keine erfundene Projektion", () => {
  const result = buildDashboardDecisionLab(
    { ...assets, state: "partial", totalMinor: null, warnings: ["Depotwert fehlt"] },
    { ...cashflow, state: "partial", months: [] },
    optimizations,
    {},
    new Date("2026-08-22T12:02:00.000Z")
  );
  assert.equal(result.state, "partial");
  assert.equal(result.series.length, 0);
  assert.equal(result.milestones.length, 0);
  assert.equal(result.basis.annualOutlook.available, false);
  assert.match(result.warnings.join(" "), /nicht verfügbar/);
});

test("aufgebrauchtes Finanzvermögen wird bei null begrenzt statt als Schuld fortgeschrieben", () => {
  const result = buildDashboardDecisionLab(
    { ...assets, totalMinor: 100_000 },
    { ...cashflow, months: [trendMonth("2026-07", 0, 100_000)] },
    optimizations,
    { realReturnBps: 0 },
    new Date("2026-08-22T12:02:00.000Z")
  );
  assert.equal(result.depletion.baselineAfterMonths, 1);
  assert.equal(result.series[1].baselineMinor, 0);
  assert.equal(result.series[20].baselineMinor, 0);
});
