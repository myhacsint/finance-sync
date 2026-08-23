import assert from "node:assert/strict";
import test from "node:test";
import type { DashboardAssets } from "./dashboard-assets.js";
import type { DashboardAnalyses } from "./dashboard-analyses.js";
import type { DashboardRecurringExpenseOptimizations } from "./dashboard-recurring-expenses.js";
import { buildDashboardFireTracking, groupFireTransactions } from "./dashboard-fire.js";

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
  categories: [{
    key: "category-aaaaaaaaaa",
    label: "Urlaub & Reisen",
    periodMinor: 700_000,
    comparisonMinor: 900_000,
    periodTransactions: [{
      key: "booking-aaaaaaaaaaaaaa",
      date: "2026-07-12",
      merchant: "Ferienhof",
      amountMinor: 300_000,
      estimate: false
    }],
    comparisonTransactions: []
  }],
  classes: [],
  positions: [{
    key: "position-bbbbbbbbbbbb",
    label: "Ferienhof",
    category: "Urlaub & Reisen",
    class: "DISPOSITIV",
    amountMinor: 300_000,
    estimate: false,
    months: [{ month: "2026-07", amountMinor: 300_000 }]
  }],
  warnings: [],
  basis: []
} satisfies DashboardAnalyses;

test("FIRE-Port reproduziert die freigegebenen v3.1-Alterswerte", () => {
  const at115 = buildDashboardFireTracking(assets, {
    liveProjectedAnnualExpensesMinor: 11_500_000,
    normalizedAnnualExpensesMinor: 11_500_000
  }, emptyOptimizations, analyses, 60);
  const at974 = buildDashboardFireTracking(assets, {
    liveProjectedAnnualExpensesMinor: 9_740_000,
    normalizedAnnualExpensesMinor: 9_740_000
  }, emptyOptimizations, analyses, 60);
  assert.equal(at115.bridgeCapitalMinor, 7_158_400);
  assert.equal(at115.lockedPensionMinor, 11_308_900);
  assert.equal(at115.central.currentExitAge, 67);
  assert.equal(at974.central.currentExitAge, 62);
  assert.equal(at115.central.currentCapitalGoal?.age, 67);
  assert.equal(at115.central.targetCapitalGoal.age, 60);
  assert.ok((at115.central.currentCapitalGoal?.projectedCapitalMinor ?? -1)
    >= (at115.central.currentCapitalGoal?.requiredCapitalMinor ?? 0));
  assert.ok((at115.central.targetCapitalGoal.projectedCapitalMinor ?? 0)
    < (at115.central.targetCapitalGoal.requiredCapitalMinor ?? 0));
  assert.ok((at115.central.currentCapitalGoal?.differenceMinor ?? -1) >= 0);
  assert.ok((at115.central.targetCapitalGoal.differenceMinor ?? 0) < 0);
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
  }, optimizations, analyses, 60);
  assert.deepEqual(result.selectedActionKeys, ["recurring-aaaaaaaaaaaaaaaaaa"]);
  assert.equal(result.selectedAnnualSavingsMinor, 47_880);
  assert.equal(result.actions[0].leverQuality, "klar");
  assert.equal(result.actions[1].selectable, false);
  const withSport = {
    ...analyses,
    categories: [...analyses.categories, {
      key: "category-cccccccccc",
      label: "Sport",
      periodMinor: 70_000,
      comparisonMinor: 100_000,
      periodTransactions: [],
      comparisonTransactions: []
    }],
    positions: [...analyses.positions, {
      key: "position-dddddddddddd",
      label: "Fitness",
      category: "Sport",
      class: "DISPOSITIV" as const,
      amountMinor: 47_880,
      estimate: false,
      months: [{ month: "2026-07", amountMinor: 47_880 }]
    }]
  } satisfies DashboardAnalyses;
  const withCategoryCut = buildDashboardFireTracking(assets, {
    liveProjectedAnnualExpensesMinor: 11_500_000,
    normalizedAnnualExpensesMinor: 11_500_000
  }, optimizations, withSport, 60, [], ["category-cccccccccc:25"]);
  const sport = withCategoryCut.variableCategories.find((category) => category.label === "Sport")!;
  assert.equal(sport.grossPlanningAnnualMinor, 110_000);
  assert.equal(sport.recurringSavingsExcludedMinor, 47_880);
  assert.equal(sport.planningAnnualMinor, 62_120);
  assert.equal(sport.annualSavingsMinor, 15_530);
  assert.equal(sport.countsTowardScenario, false);
  assert.equal(withCategoryCut.selectedAnnualSavingsMinor, 47_880);
  assert.equal(result.nextChecks[0].label, "Versicherung");
});

test("Kategorieprozente und Einmalposten zählen nicht als FIRE-Hebel", () => {
  const result = buildDashboardFireTracking(assets, {
    liveProjectedAnnualExpensesMinor: 11_500_000,
    normalizedAnnualExpensesMinor: 11_500_000
  }, emptyOptimizations, analyses, 60, [], ["category-aaaaaaaaaa:25"], ["position-bbbbbbbbbbbb"]);
  assert.equal(result.variableCategories[0].annualizedCurrentMinor, 1_200_000);
  assert.deepEqual(result.variableCategories[0].currentTransactions, analyses.categories[0].periodTransactions);
  assert.equal(
    result.variableCategories[0].currentMerchantGroups
      .reduce((sum, group) => sum + group.amountMinor, 0),
    analyses.categories[0].periodTransactions
      .reduce((sum, transaction) => sum + transaction.amountMinor, 0)
  );
  assert.equal(result.variableCategories[0].planningAnnualMinor, 1_050_000);
  assert.equal(result.selectedVariableAnnualSavingsMinor, 0);
  assert.equal(result.oneTimeCandidates[0].observedMinor, 300_000);
  assert.equal(result.oneTimeCandidates[0].countsTowardScenario, false);
  assert.equal(result.selectedOneTimeSavingsMinor, 0);
  assert.equal(result.scenarioAnnualExpensesMinor, 11_500_000);
  assert.equal(result.scenarioBridgeCapitalMinor, 7_158_400);
});

test("Buchungen werden je Händler gebündelt und innerhalb neueste zuerst sortiert", () => {
  const groups = groupFireTransactions([
    { key: "booking-a", date: "2026-04-01", merchant: "Anthropic", amountMinor: 2_380, estimate: false },
    { key: "booking-b", date: "2026-06-01", merchant: "Anthropic Claude Subscription", amountMinor: 2_380, estimate: false },
    { key: "booking-c", date: "2026-07-01", merchant: "Claude.Ai Subscription", amountMinor: 2_380, estimate: false },
    { key: "booking-d", date: "2026-05-01", merchant: "Openai Ireland Limited", amountMinor: 2_300, estimate: false },
    { key: "booking-e", date: "2026-07-01", merchant: "Ginge Technology", amountMinor: 10_000, estimate: false },
    { key: "booking-f", date: "2026-02-01", merchant: "Amazon Payments Europe S.C.A.", amountMinor: 1_500, estimate: false },
    { key: "booking-g", date: "2026-03-01", merchant: "Amazon Media Eu S.A R.L.", amountMinor: 2_000, estimate: false },
    { key: "booking-h", date: "2026-01-01", merchant: "Paypal Europe S.A.R.L. Et Cie S.C.A", amountMinor: 500, estimate: false },
    { key: "booking-i", date: "2026-02-01", merchant: "Paypal Etsy Ireland", amountMinor: 700, estimate: false }
  ]);
  assert.deepEqual(groups.map((group) => [group.label, group.bookings, group.amountMinor]), [
    ["Ginge Technology", 1, 10_000],
    ["Anthropic Claude Subscription", 3, 7_140],
    ["Amazon", 2, 3_500],
    ["OpenAI / ChatGPT", 1, 2_300],
    ["PayPal", 2, 1_200]
  ]);
  assert.deepEqual(groups[1].transactions.map((transaction) => transaction.date), [
    "2026-07-01",
    "2026-06-01",
    "2026-04-01"
  ]);
});
