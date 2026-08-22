import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardAssets } from "./dashboard-assets.js";
import type { DashboardRecurringExpenseOptimizations } from "./dashboard-recurring-expenses.js";
import { buildDashboardFireTracking } from "./dashboard-fire.js";

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

test("FIRE-Port reproduziert die freigegebenen v3.1-Alterswerte", () => {
  const at115 = buildDashboardFireTracking(assets, {
    liveProjectedAnnualExpensesMinor: 11_500_000,
    normalizedAnnualExpensesMinor: 11_500_000
  }, emptyOptimizations, 60);
  const at974 = buildDashboardFireTracking(assets, {
    liveProjectedAnnualExpensesMinor: 9_740_000,
    normalizedAnnualExpensesMinor: 9_740_000
  }, emptyOptimizations, 60);
  assert.equal(at115.bridgeCapitalMinor, 7_158_400);
  assert.equal(at115.lockedPensionMinor, 11_308_900);
  assert.equal(at115.central.currentExitAge, 67);
  assert.equal(at974.central.currentExitAge, 62);
  assert.ok((at115.central.maximumExpensesAtTargetMinor ?? 0) >= 9_200_000);
  assert.ok((at115.central.maximumExpensesAtTargetMinor ?? 0) <= 9_300_000);
});

test("nur bestätigte geplante oder umgesetzte Entlastungen zählen standardmäßig", () => {
  const optimizations = {
    ...emptyOptimizations,
    summary: { candidates: 2, actioned: 1, plannedOrCancelled: 1, expectedAnnualSavingsMinor: 47_880 },
    items: [{
      key: "recurring-aaaaaaaaaaaaaaaaaa",
      label: "Fitness",
      classification: { value: "VERMEIDBAR", label: "Vermeidbar", confidence: "nutzerbestaetigt" },
      rhythm: { kind: "monatlich", label: "Monatlich", confidence: "hoch", typicalDays: 30 },
      estimatedAnnualCostMinor: 47_880,
      estimate: true,
      evidenceHash: "evidence-aaaaaaaaaaaaaaaaaaaa",
      optimization: {
        candidateKey: "recurring-aaaaaaaaaaaaaaaaaa",
        evidenceHash: "evidence-aaaaaaaaaaaaaaaaaaaa",
        status: "GEPLANT",
        effectiveDate: null,
        expectedAnnualSavingsMinor: 47_880,
        priority: "HOCH",
        createdAt: "2026-08-22T12:00:00.000Z",
        updatedAt: "2026-08-22T12:00:00.000Z",
        stale: false
      }
    }, {
      key: "recurring-bbbbbbbbbbbbbbbbbb",
      label: "Versicherung",
      classification: { value: "UNKLAR", label: "Unklar", confidence: "nutzerbestaetigt" },
      rhythm: { kind: "jaehrlich", label: "Jährlich", confidence: "mittel", typicalDays: 365 },
      estimatedAnnualCostMinor: 205_000,
      estimate: true,
      evidenceHash: "evidence-bbbbbbbbbbbbbbbbbbbb",
      optimization: null
    }]
  } satisfies DashboardRecurringExpenseOptimizations;
  const result = buildDashboardFireTracking(assets, {
    liveProjectedAnnualExpensesMinor: 11_500_000,
    normalizedAnnualExpensesMinor: 11_500_000
  }, optimizations, 60);
  assert.deepEqual(result.selectedActionKeys, ["recurring-aaaaaaaaaaaaaaaaaa"]);
  assert.equal(result.selectedAnnualSavingsMinor, 47_880);
  assert.equal(result.actions[0].leverQuality, "klar");
  assert.equal(result.actions[1].selectable, false);
});
