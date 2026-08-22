import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardAssets } from "./dashboard-assets.js";
import type { DashboardSavingsBaseline } from "./dashboard-savings-baseline.js";
import { buildDashboardDecisionLab, decisionLabInputs } from "./dashboard-decision-lab.js";

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
  months: [],
  warnings: [],
  basis: []
} satisfies DashboardSavingsBaseline;

test("Entscheidungslabor begrenzt Annahmen und verwendet konservative Standardwerte", () => {
  assert.deepEqual(decisionLabInputs({
    realReturnBps: 99_999,
    variableIncomeShareBps: -50,
    monthlyChangeMinor: 5_000_000,
    oneTimeMinor: -500_000_000
  }), {
    horizonYears: 20,
    realReturnBps: 1_000,
    variableIncomeShareBps: 0,
    monthlyChangeMinor: 1_000_000,
    oneTimeMinor: -100_000_000
  });
});

test("Basis und Szenario bleiben getrennt und alle Werte sind Schätzungen", () => {
  const result = buildDashboardDecisionLab(assets, cashflow, {
    realReturnBps: 0,
    variableIncomeShareBps: 5_000,
    monthlyChangeMinor: 30_000,
    oneTimeMinor: -1_000_000
  }, new Date("2026-08-22T12:02:00.000Z"));
  assert.equal(result.state, "current");
  assert.equal(result.estimate, true);
  assert.equal(result.basis.variableAnnualIncomeMinor, 3_000_000);
  assert.equal(result.basis.assumedVariableMonthlyMinor, 125_000);
  assert.equal(result.basis.projectedMonthlyCapacityMinor, 105_000);
  assert.equal(result.series[0].baselineMinor, 20_000_000);
  assert.equal(result.series[0].scenarioMinor, 19_000_000);
  assert.deepEqual(result.milestones[0], {
    year: 1,
    baselineMinor: 21_260_000,
    scenarioMinor: 20_620_000,
    differenceMinor: -640_000
  });
  assert.match(result.basisNotes.join(" "), /\[SCHÄTZUNG\]/);
});

test("fehlende Vermögens- oder Sparratenbasis erzeugt keine erfundene Projektion", () => {
  const result = buildDashboardDecisionLab(
    { ...assets, state: "partial", totalMinor: null, warnings: ["Depotwert fehlt"] },
    { ...cashflow, state: "partial", savingsCapacityMonthlyMinor: null },
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
    { ...cashflow, savingsCapacityMonthlyMinor: -100_000 },
    { realReturnBps: 0 },
    new Date("2026-08-22T12:02:00.000Z")
  );
  assert.equal(result.depletion.baselineAfterMonths, 1);
  assert.equal(result.series[1].baselineMinor, 0);
  assert.equal(result.series[20].baselineMinor, 0);
});
