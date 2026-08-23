import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FIRE_ASSUMPTIONS, resolveFireAssumptions } from "./fire-assumptions.js";
import { buildDashboardFireTracking } from "./dashboard-fire.js";
import type { DashboardAssets } from "./dashboard-assets.js";
import type { DashboardAnalyses } from "./dashboard-analyses.js";
import type { DashboardRecurringExpenseOptimizations } from "./dashboard-recurring-expenses.js";

test("FIRE-Annahmen bleiben ohne Config die v3.1-Defaults", () => {
  const resolved = resolveFireAssumptions(undefined);
  assert.equal(resolved.erikBirthYear, 1978);
  assert.equal(resolved.modelYear, 2026);
  assert.equal(resolved.householdEconomicMeansMinor, DEFAULT_FIRE_ASSUMPTIONS.householdEconomicMeansMinor);
});

test("FIRE-Annahmen übernehmen nur gültige Config-Werte", () => {
  const resolved = resolveFireAssumptions({
    erikBirthYear: 1970,
    inflation: 0.03,
    householdEconomicMeansMinor: Number.NaN
  });
  assert.equal(resolved.erikBirthYear, 1970);
  assert.equal(resolved.inflation, 0.03);
  assert.equal(resolved.householdEconomicMeansMinor, DEFAULT_FIRE_ASSUMPTIONS.householdEconomicMeansMinor);
});

const assets = {
  generatedAt: "2026-08-22T12:00:00.000Z",
  state: "current",
  totalMinor: 18_467_300,
  basis: "latest-available",
  marketHistory: { status: "current", latestDate: "2026-08-22" },
  summary: { automaticCurrent: 4, automaticTotal: 4, confirmed: 1 },
  areas: [
    { key: "cash", label: "Liquidität", amountMinor: 2_000_000, percent: 11, positions: 2, status: "current" },
    { key: "depots", label: "Depots", amountMinor: 3_400_000, percent: 18, positions: 3, status: "current" },
    { key: "crypto", label: "Krypto", amountMinor: 1_758_400, percent: 10, positions: 1, status: "current" },
    { key: "pensions", label: "Vorsorge", amountMinor: 11_308_900, percent: 61, positions: 3, status: "current" }
  ],
  positions: [],
  warnings: []
} satisfies DashboardAssets;

const emptyOptimizations = {
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

const analyses = {
  generatedAt: "2026-08-22T12:00:00.000Z",
  state: "current",
  source: "Actual + FinanceSync-Konfiguration",
  selection: { view: "expense-structure", periodYear: 2026, comparisonYear: 2025 },
  availableYears: [2026, 2025],
  period: { year: 2026, label: "2026 (Jan–07)", startDate: "2026-01-01", endDate: "2026-07-31", totalMinor: 4_200_000, estimate: false },
  comparison: { year: 2025, label: "2025", startDate: "2025-01-01", endDate: "2025-12-31", totalMinor: 7_200_000, estimate: false },
  changePercent: null,
  unknownMinor: 0,
  unknownPercent: 0,
  categories: [],
  classes: [],
  positions: [],
  warnings: [],
  basis: []
} satisfies DashboardAnalyses;

test("Config-Annahmen ändern das Modelljahr im FIRE-Kurs", () => {
  const result = buildDashboardFireTracking(assets, {
    liveProjectedAnnualExpensesMinor: 11_500_000,
    normalizedAnnualExpensesMinor: 11_500_000
  }, emptyOptimizations, analyses, 60, [], [], [], {
    ...DEFAULT_FIRE_ASSUMPTIONS,
    modelYear: 2027
  });
  assert.equal(result.currentAge, 49);
});
