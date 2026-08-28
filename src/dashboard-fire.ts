import { createHash } from "node:crypto";
import type { DashboardAssets } from "./dashboard-assets.js";
import type { AnalysisTransaction, DashboardAnalyses } from "./dashboard-analyses.js";
import type { DashboardRecurringExpenseOptimizations } from "./dashboard-recurring-expenses.js";
import { DEFAULT_FIRE_ASSUMPTIONS, type FireAssumptions } from "./fire-assumptions.js";
import { fireGapClose, type FireGapClose } from "./fire-gap.js";
import {
  DEFAULT_MERCHANT_RULES,
  applyMerchantRules,
  type MerchantRule
} from "./merchant-rules.js";

export interface FireActionImpact {
  key: string;
  label: string;
  classification: "GESTALTBAR" | "VERMEIDBAR" | "UNKLAR";
  classificationLabel: string;
  status: "PRUEFEN" | "GEPLANT" | "GEKUENDIGT" | "BEIBEHALTEN";
  statusLabel: string;
  priority: "HOCH" | "MITTEL" | "NIEDRIG" | null;
  estimatedAnnualCostMinor: number;
  expectedAnnualSavingsMinor: number | null;
  countedByDefault: boolean;
  selectable: boolean;
  leverQuality: "umgesetzt" | "klar" | "pruefen" | "nicht-ansetzen";
  leverLabel: string;
  exitAgeIfApplied: number | null;
  yearsGained: number | null;
  estimate: true;
}

export interface DashboardFireTracking {
  modelVersion: "FIRE-Phasenmodell v3.1";
  estimate: true;
  targetAge: number;
  currentAge: number;
  trackedAnnualExpensesMinor: number | null;
  normalizedAnnualExpensesMinor: number | null;
  liveProjectedAnnualExpensesMinor: number | null;
  economicMeansAnnualMinor: number;
  bridgeCapitalMinor: number | null;
  lockedPensionMinor: number | null;
  selectedRecurringAnnualSavingsMinor: number;
  selectedVariableAnnualSavingsMinor: number;
  selectedAnnualSavingsMinor: number;
  selectedOneTimeSavingsMinor: number;
  scenarioAnnualExpensesMinor: number | null;
  scenarioBridgeCapitalMinor: number | null;
  central: {
    realReturnBps: 300;
    currentExitAge: number | null;
    scenarioExitAge: number | null;
    yearsGained: number | null;
    currentCapitalGoal: FireCapitalGoal | null;
    targetCapitalGoal: FireCapitalGoal;
    maximumExpensesAtTargetMinor: number | null;
    annualGapToTargetMinor: number | null;
    monthlyGapToTargetMinor: number | null;
  };
  returnBand: Array<{
    realReturnBps: 200 | 300 | 400;
    currentExitAge: number | null;
    scenarioExitAge: number | null;
  }>;
  actions: FireActionImpact[];
  selectedActionKeys: string[];
  variableCategories: FireVariableCategoryImpact[];
  selectedCategoryCuts: string[];
  oneTimeCandidates: FireOneTimeImpact[];
  selectedOneTimeKeys: string[];
  nextChecks: FireNextCheck[];
  gapClose: FireGapClose;
  basis: string[];
  warnings: string[];
}

export interface FireNextCheck {
  key: string;
  label: string;
  reason: string;
  estimatedAnnualCostMinor: number;
  classificationLabel: string;
}

export interface FireCapitalGoal {
  age: number;
  projectedCapitalMinor: number | null;
  requiredCapitalMinor: number | null;
  differenceMinor: number | null;
  estimate: true;
}

export interface FireVariableCategoryImpact {
  key: string;
  label: string;
  currentPeriodMinor: number;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  currentPeriodLabel: string;
  previousYearMinor: number;
  previousPeriodLabel: string;
  currentTransactions: AnalysisTransaction[];
  previousTransactions: AnalysisTransaction[];
  currentMerchantGroups: FireMerchantGroup[];
  previousMerchantGroups: FireMerchantGroup[];
  annualizedCurrentMinor: number;
  grossPlanningAnnualMinor: number;
  planningAnnualMinor: number;
  recurringSavingsExcludedMinor: number;
  selectedReductionPercent: 0 | 10 | 25 | 50;
  annualSavingsMinor: number;
  countsTowardScenario: false;
  exitAgeIfApplied: number | null;
  yearsGained: number | null;
  estimate: true;
}

export interface FireMerchantGroup {
  key: string;
  label: string;
  amountMinor: number;
  bookings: number;
  estimate: boolean;
  transactions: AnalysisTransaction[];
}

export interface FireOneTimeImpact {
  key: string;
  label: string;
  category: string;
  month: string;
  observedMinor: number;
  selected: boolean;
  countedOneTimeMinor: number;
  countsTowardScenario: false;
  exitAgeIfApplied: number | null;
  yearsGained: number | null;
  estimate: true;
}

function freeCapitalMinor(assets: DashboardAssets): number | null {
  const included = assets.areas.filter((area) => area.key !== "pensions");
  if (included.some((area) => area.amountMinor === null)) return null;
  return included.reduce((sum, area) => sum + (area.amountMinor ?? 0), 0);
}

function pensionCapitalMinor(assets: DashboardAssets): number | null {
  return assets.areas.find((area) => area.key === "pensions")?.amountMinor ?? null;
}

interface FirePhaseContext {
  exitYear: number;
  wifeExitYear: number;
  erikPensionYear: number;
  wifePensionYear: number;
  erikPensionMinor: number;
  wifePensionMinor: number;
  bavPensionMinor: number;
  alPayoutMinor: number;
}

function phaseContext(exitAge: number, a: FireAssumptions = DEFAULT_FIRE_ASSUMPTIONS): FirePhaseContext | null {
  const exitYear = a.erikBirthYear + exitAge;
  const wifeExitYear = a.wifeBirthYear + a.wifeExitAge;
  const erikPensionYear = a.erikBirthYear + a.erikPensionAge;
  const wifePensionYear = 2051;
  if (exitYear <= a.modelYear) return null;
  const erikPoints = a.erikPointsBase + a.erikPointsPerYear * (exitYear - a.modelYear);
  const wifePoints = a.wifePointsBase + a.wifePointsPerYear * (wifeExitYear - a.modelYear);
  const erikPensionMinor = erikPoints * a.rentValueMinor * 12 * a.erikNetFactor;
  const wifePensionMinor = wifePoints * a.rentValueMinor * 12 * a.wifeNetFactor;
  const bavPensionMinor = a.bavAccruedMinor
    + a.bavPerYearMinor * Math.max(0, exitYear - a.bavBaseYear);
  const alPayoutMinor = Math.round(
    a.alNominalMinor / Math.pow(1 + a.inflation, a.alYear - a.modelYear)
  );
  return {
    exitYear,
    wifeExitYear,
    erikPensionYear,
    wifePensionYear,
    erikPensionMinor,
    wifePensionMinor,
    bavPensionMinor,
    alPayoutMinor
  };
}

function capitalAfterYear(
  capital: number,
  annualExpensesMinor: number,
  year: number,
  context: FirePhaseContext,
  realReturnBps: number,
  a: FireAssumptions = DEFAULT_FIRE_ASSUMPTIONS
): number {
    const erikWorks = year < context.exitYear;
    const wifeWorks = year < context.wifeExitYear;
    let income = 0;
    if (erikWorks && wifeWorks) income += a.householdEconomicMeansMinor;
    else if (erikWorks) income += a.householdEconomicMeansMinor - a.wifeEconomicMeansMinor;
    else if (wifeWorks) income += a.wifeEconomicMeansMinor;
    if (year > context.erikPensionYear) income += context.erikPensionMinor;
    else if (year === context.erikPensionYear) {
      const paidMonths = Math.max(0, Math.min(12, 13 - Math.round(a.erikPensionStartMonth)));
      income += context.erikPensionMinor * paidMonths / 12;
    }
    if (year >= context.wifePensionYear) income += context.wifePensionMinor;
    if (year >= Math.max(a.bavStartYear, context.exitYear)) income += context.bavPensionMinor;
    let need = annualExpensesMinor;
    if (!erikWorks) {
      need += a.pkvEmployerSubsidyMinor;
      need -= a.workCostsMinor;
      need -= a.companyCarErikMinor;
    }
    if (!wifeWorks) {
      need -= a.companyCarWifeMinor;
      if (year < context.wifePensionYear) need += a.wifeGkvMinor;
    }
    const lostCars = Number(!erikWorks) + Number(!wifeWorks);
    if (lostCars === 1) need += a.replacementCarOneMinor;
    else if (lostCars === 2) need += a.replacementCarTwoMinor;
    if (year >= a.childcareReliefYear) need -= a.childcareReliefMinor;
    if (year >= a.otherChildReliefYear) need -= a.otherChildReliefMinor;
    if (year < a.alYear) need += a.alContributionMinor;
    if (year < a.bavStartYear) need += a.riesterContributionMinor;
    return capital * (1 + realReturnBps / 10_000)
      + income + (year === a.alYear ? context.alPayoutMinor : 0) - need;
}

function sustainable(
  annualExpensesMinor: number,
  exitAge: number,
  bridgeCapitalMinor: number,
  realReturnBps: number,
  a: FireAssumptions = DEFAULT_FIRE_ASSUMPTIONS
): boolean {
  const context = phaseContext(exitAge, a);
  if (!context) return false;
  let capital = bridgeCapitalMinor;
  for (let year = a.modelYear; year <= a.endYear; year += 1) {
    capital = capitalAfterYear(capital, annualExpensesMinor, year, context, realReturnBps, a);
    if (capital < 0) return false;
  }
  return true;
}

function projectedCapitalAtExit(
  annualExpensesMinor: number,
  exitAge: number,
  bridgeCapitalMinor: number,
  realReturnBps: number,
  a: FireAssumptions = DEFAULT_FIRE_ASSUMPTIONS
): number | null {
  const context = phaseContext(exitAge, a);
  if (!context) return null;
  let capital = bridgeCapitalMinor;
  for (let year = a.modelYear; year < context.exitYear; year += 1) {
    capital = capitalAfterYear(capital, annualExpensesMinor, year, context, realReturnBps, a);
    if (capital < 0) return 0;
  }
  return Math.floor(capital / 10_000) * 10_000;
}

function requiredCapitalAtExit(
  annualExpensesMinor: number,
  exitAge: number,
  realReturnBps: number,
  a: FireAssumptions = DEFAULT_FIRE_ASSUMPTIONS
): number | null {
  const context = phaseContext(exitAge, a);
  if (!context) return null;
  const supports = (initialCapital: number): boolean => {
    let capital = initialCapital;
    for (let year = context.exitYear; year <= a.endYear; year += 1) {
      capital = capitalAfterYear(capital, annualExpensesMinor, year, context, realReturnBps, a);
      if (capital < 0) return false;
    }
    return true;
  };
  let high = Math.max(1_000_000, annualExpensesMinor);
  while (!supports(high) && high < 2_000_000_000) high *= 2;
  if (!supports(high)) return null;
  let low = 0;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (supports(middle)) high = middle;
    else low = middle + 1;
  }
  return Math.ceil(low / 10_000) * 10_000;
}

function capitalGoal(
  annualExpensesMinor: number | null,
  age: number,
  bridgeCapitalMinor: number | null,
  realReturnBps: number,
  a: FireAssumptions = DEFAULT_FIRE_ASSUMPTIONS
): FireCapitalGoal {
  const projected = annualExpensesMinor === null || bridgeCapitalMinor === null ? null
    : projectedCapitalAtExit(annualExpensesMinor, age, bridgeCapitalMinor, realReturnBps, a);
  const required = annualExpensesMinor === null ? null
    : requiredCapitalAtExit(annualExpensesMinor, age, realReturnBps, a);
  return {
    age,
    projectedCapitalMinor: projected,
    requiredCapitalMinor: required,
    differenceMinor: projected === null || required === null ? null : projected - required,
    estimate: true
  };
}

function earliestExitAge(
  annualExpensesMinor: number,
  bridgeCapitalMinor: number | null,
  realReturnBps: number,
  a: FireAssumptions = DEFAULT_FIRE_ASSUMPTIONS
): number | null {
  if (bridgeCapitalMinor === null) return null;
  for (let age = 50; age <= 67; age += 1) {
    if (sustainable(annualExpensesMinor, age, bridgeCapitalMinor, realReturnBps, a)) return age;
  }
  return null;
}

function maximumExpensesAtTarget(
  targetAge: number,
  bridgeCapitalMinor: number | null,
  realReturnBps: number,
  a: FireAssumptions = DEFAULT_FIRE_ASSUMPTIONS
): number | null {
  if (bridgeCapitalMinor === null) return null;
  let low = 0;
  let high = 20_000_000;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (sustainable(middle, targetAge, bridgeCapitalMinor, realReturnBps, a)) low = middle;
    else high = middle - 1;
  }
  return Math.floor(low / 10_000) * 10_000;
}

function statusLabel(status: FireActionImpact["status"]): string {
  if (status === "GEKUENDIGT") return "Gekündigt / umgesetzt";
  if (status === "GEPLANT") return "Geplant";
  if (status === "BEIBEHALTEN") return "Bewusst beibehalten";
  return "Prüfen";
}

function actionImpacts(
  optimizations: DashboardRecurringExpenseOptimizations,
  annualExpensesMinor: number | null,
  bridgeCapital: number | null,
  baselineExitAge: number | null
): FireActionImpact[] {
  return optimizations.items.flatMap((item) => {
    if (item.classification.value === "GRUNDBEDARF") return [];
    const saved = item.optimization && !item.optimization.stale ? item.optimization : null;
    const status = saved?.status ?? "PRUEFEN";
    const savings = saved?.expectedAnnualSavingsMinor ?? null;
    const countedByDefault = (status === "GEPLANT" || status === "GEKUENDIGT")
      && savings !== null && savings > 0;
    const selectable = status !== "BEIBEHALTEN" && savings !== null && savings > 0;
    const leverQuality: FireActionImpact["leverQuality"] = countedByDefault
      ? status === "GEKUENDIGT" ? "umgesetzt" : "klar"
      : item.classification.value === "VERMEIDBAR" && status !== "BEIBEHALTEN"
        ? "klar"
        : item.classification.value === "GESTALTBAR" && status !== "BEIBEHALTEN"
          ? "pruefen"
          : "nicht-ansetzen";
    const exitAgeIfApplied = annualExpensesMinor !== null && savings !== null
      ? earliestExitAge(Math.max(0, annualExpensesMinor - savings), bridgeCapital, 300)
      : null;
    return [{
      key: item.key,
      label: item.label,
      classification: item.classification.value,
      classificationLabel: item.classification.label,
      status,
      statusLabel: statusLabel(status),
      priority: saved?.priority ?? null,
      estimatedAnnualCostMinor: item.estimatedAnnualCostMinor,
      expectedAnnualSavingsMinor: savings,
      countedByDefault,
      selectable,
      leverQuality,
      leverLabel: leverQuality === "umgesetzt" ? "Bereits umgesetzt"
        : leverQuality === "klar" ? "Konkreter Hebel"
          : leverQuality === "pruefen" ? "Nur nach Prüfung" : "Nicht automatisch ansetzen",
      exitAgeIfApplied,
      yearsGained: baselineExitAge !== null && exitAgeIfApplied !== null
        ? Math.max(0, baselineExitAge - exitAgeIfApplied) : null,
      estimate: true as const
    }];
  }).sort((left, right) => {
    const quality = { umgesetzt: 0, klar: 1, pruefen: 2, "nicht-ansetzen": 3 };
    return quality[left.leverQuality] - quality[right.leverQuality]
      || (right.expectedAnnualSavingsMinor ?? right.estimatedAnnualCostMinor)
        - (left.expectedAnnualSavingsMinor ?? left.estimatedAnnualCostMinor);
  });
}

function normalizedLabel(value: string): string {
  return value.toLocaleLowerCase("de-DE").replace(/[^a-z0-9äöüß]+/g, " ").trim();
}

function merchantIdentity(value: string, rules: MerchantRule[] = DEFAULT_MERCHANT_RULES): { key: string; label: string } {
  return applyMerchantRules(value, rules);
}

export function groupFireTransactions(
  transactions: AnalysisTransaction[],
  rules: MerchantRule[] = DEFAULT_MERCHANT_RULES
): FireMerchantGroup[] {
  const groups = new Map<string, FireMerchantGroup>();
  for (const transaction of transactions) {
    const identity = merchantIdentity(transaction.merchant, rules);
    const existing = groups.get(identity.key) ?? {
      key: `merchant-${createHash("sha256")
        .update(`finance-hub:fire-merchant:${identity.key}`)
        .digest("hex").slice(0, 12)}`,
      label: identity.label,
      amountMinor: 0,
      bookings: 0,
      estimate: false,
      transactions: []
    };
    existing.amountMinor += transaction.amountMinor;
    existing.bookings += 1;
    existing.estimate ||= transaction.estimate;
    existing.transactions.push(transaction);
    groups.set(identity.key, existing);
  }
  return [...groups.values()]
    .map((group) => ({
      ...group,
      transactions: group.transactions.sort((left, right) => right.date.localeCompare(left.date)
        || right.amountMinor - left.amountMinor
        || left.merchant.localeCompare(right.merchant, "de"))
    }))
    .sort((left, right) => right.amountMinor - left.amountMinor
      || left.label.localeCompare(right.label, "de"));
}

function monthsInclusive(start: string, end: string): number {
  const [startYear, startMonth] = start.slice(0, 7).split("-").map(Number);
  const [endYear, endMonth] = end.slice(0, 7).split("-").map(Number);
  return Math.max(1, (endYear - startYear) * 12 + endMonth - startMonth + 1);
}

function variableCategoryImpacts(
  analyses: DashboardAnalyses,
  requestedCuts: string[],
  recurringSavingsByCategory: Map<string, number>,
  annualExpensesMinor: number | null,
  bridgeCapital: number | null,
  baselineExitAge: number | null,
  rules: MerchantRule[] = DEFAULT_MERCHANT_RULES
): FireVariableCategoryImpact[] {
  const cuts = new Map<string, 10 | 25 | 50>();
  for (const value of requestedCuts) {
    const match = /^(category-[a-f0-9]{10}):(10|25|50)$/.exec(value);
    if (match) cuts.set(match[1], Number(match[2]) as 10 | 25 | 50);
  }
  const discretionary = new Set(
    analyses.positions.filter((position) => position.class === "DISPOSITIV")
      .map((position) => position.category)
  );
  const periodMonths = monthsInclusive(analyses.period.startDate, analyses.period.endDate);
  return analyses.categories
    .filter((category) => discretionary.has(category.label) && category.periodMinor > 0)
    .map((category) => {
      const annualizedCurrentMinor = Math.round(category.periodMinor / periodMonths * 12);
      const grossPlanningAnnualMinor = category.comparisonMinor > 0
        ? Math.round((annualizedCurrentMinor + category.comparisonMinor) / 2)
        : annualizedCurrentMinor;
      const recurringSavingsExcludedMinor = Math.min(
        grossPlanningAnnualMinor,
        recurringSavingsByCategory.get(category.label) ?? 0
      );
      const planningAnnualMinor = grossPlanningAnnualMinor - recurringSavingsExcludedMinor;
      const selectedReductionPercent: 0 | 10 | 25 | 50 = cuts.get(category.key) ?? 0;
      const annualSavingsMinor = Math.round(planningAnnualMinor * selectedReductionPercent / 100);
      const exitAgeIfApplied = annualExpensesMinor === null ? null
        : earliestExitAge(Math.max(0, annualExpensesMinor - annualSavingsMinor), bridgeCapital, 300);
      return {
        key: category.key,
        label: category.label,
        currentPeriodMinor: category.periodMinor,
        currentPeriodStart: analyses.period.startDate,
        currentPeriodEnd: analyses.period.endDate,
        currentPeriodLabel: analyses.period.label,
        previousYearMinor: category.comparisonMinor,
        previousPeriodLabel: analyses.comparison.label,
        currentTransactions: category.periodTransactions,
        previousTransactions: category.comparisonTransactions,
        currentMerchantGroups: groupFireTransactions(category.periodTransactions, rules),
        previousMerchantGroups: groupFireTransactions(category.comparisonTransactions, rules),
        annualizedCurrentMinor,
        grossPlanningAnnualMinor,
        planningAnnualMinor,
        recurringSavingsExcludedMinor,
        selectedReductionPercent,
        annualSavingsMinor,
        countsTowardScenario: false as const,
        exitAgeIfApplied,
        yearsGained: baselineExitAge !== null && exitAgeIfApplied !== null
          ? Math.max(0, baselineExitAge - exitAgeIfApplied) : null,
        estimate: true as const
      };
    })
    .sort((left, right) => right.planningAnnualMinor - left.planningAnnualMinor
      || left.label.localeCompare(right.label, "de"));
}

function oneTimeImpacts(
  analyses: DashboardAnalyses,
  optimizations: DashboardRecurringExpenseOptimizations,
  selectedKeys: string[],
  selectedCuts: Map<string, number>,
  annualExpensesMinor: number | null,
  bridgeCapital: number | null,
  baselineExitAge: number | null
): FireOneTimeImpact[] {
  const recurringLabels = new Set(optimizations.items.map((item) => normalizedLabel(item.label)));
  const categoryKeys = new Map(analyses.categories.map((category) => [category.label, category.key]));
  const allowedKeys = new Set(selectedKeys.filter((key) => /^position-[a-f0-9]{12}$/.test(key)));
  return analyses.positions
    .filter((position) => position.class === "DISPOSITIV"
      && position.amountMinor > 0
      && position.months.length === 1
      && !recurringLabels.has(normalizedLabel(position.label)))
    .sort((left, right) => right.amountMinor - left.amountMinor)
    .slice(0, 10)
    .map((position) => {
      const selected = allowedKeys.has(position.key);
      const categoryCut = selectedCuts.get(categoryKeys.get(position.category) ?? "") ?? 0;
      const potentialOneTimeMinor = Math.round(position.amountMinor * (100 - categoryCut) / 100);
      const countedOneTimeMinor = selected
        ? potentialOneTimeMinor
        : 0;
      const exitAgeIfApplied = annualExpensesMinor === null || bridgeCapital === null ? null
        : earliestExitAge(annualExpensesMinor, bridgeCapital + potentialOneTimeMinor, 300);
      return {
        key: position.key,
        label: position.label,
        category: position.category,
        month: position.months[0].month,
        observedMinor: position.amountMinor,
        selected,
        countedOneTimeMinor: 0,
        countsTowardScenario: false as const,
        exitAgeIfApplied,
        yearsGained: baselineExitAge !== null && exitAgeIfApplied !== null
          ? Math.max(0, baselineExitAge - exitAgeIfApplied) : null,
        estimate: true as const
      };
    });
}

export function buildDashboardFireTracking(
  assets: DashboardAssets,
  annual: {
    liveProjectedAnnualExpensesMinor: number | null;
    normalizedAnnualExpensesMinor: number | null;
  },
  optimizations: DashboardRecurringExpenseOptimizations,
  analyses: DashboardAnalyses,
  targetAge = 60,
  requestedActionKeys: string[] = [],
  requestedCategoryCuts: string[] = [],
  requestedOneTimeKeys: string[] = [],
  assumptions: FireAssumptions = DEFAULT_FIRE_ASSUMPTIONS,
  merchantRules: MerchantRule[] = DEFAULT_MERCHANT_RULES
): DashboardFireTracking {
  const a = assumptions;
  const safeTargetAge = Math.max(50, Math.min(67, Math.round(targetAge)));
  const bridgeCapital = freeCapitalMinor(assets);
  const trackedAnnualExpensesMinor = annual.liveProjectedAnnualExpensesMinor
    ?? annual.normalizedAnnualExpensesMinor;
  const baselineExitAge = trackedAnnualExpensesMinor === null ? null
    : earliestExitAge(trackedAnnualExpensesMinor, bridgeCapital, 300, a);
  const actions = actionImpacts(optimizations, trackedAnnualExpensesMinor, bridgeCapital, baselineExitAge);
  const allowedKeys = new Set(actions.filter((action) => action.selectable).map((action) => action.key));
  const defaultKeys = actions.filter((action) => action.countedByDefault).map((action) => action.key);
  const selectedActionKeys = (requestedActionKeys.length ? requestedActionKeys : defaultKeys)
    .filter((key, index, keys) => allowedKeys.has(key) && keys.indexOf(key) === index);
  const selectedRecurringAnnualSavingsMinor = actions
    .filter((action) => selectedActionKeys.includes(action.key))
    .reduce((sum, action) => sum + (action.expectedAnnualSavingsMinor ?? 0), 0);
  const selectedRecurringLabels = new Map(actions
    .filter((action) => selectedActionKeys.includes(action.key))
    .map((action) => [normalizedLabel(action.label), action.expectedAnnualSavingsMinor ?? 0]));
  const recurringSavingsByCategory = new Map<string, number>();
  for (const position of analyses.positions) {
    const saving = selectedRecurringLabels.get(normalizedLabel(position.label));
    if (!saving) continue;
    recurringSavingsByCategory.set(
      position.category,
      (recurringSavingsByCategory.get(position.category) ?? 0) + saving
    );
  }
  const variableCategories = variableCategoryImpacts(
    analyses,
    requestedCategoryCuts,
    recurringSavingsByCategory,
    trackedAnnualExpensesMinor,
    bridgeCapital,
    baselineExitAge,
    merchantRules
  );
  const selectedCategoryCuts = variableCategories
    .filter((category) => category.selectedReductionPercent > 0)
    .map((category) => `${category.key}:${category.selectedReductionPercent}`);
  const selectedCuts = new Map(variableCategories.map((category) => [
    category.key,
    category.selectedReductionPercent
  ]));
  const selectedVariableAnnualSavingsMinor = 0;
  const oneTimeCandidates = oneTimeImpacts(
    analyses,
    optimizations,
    requestedOneTimeKeys,
    selectedCuts,
    trackedAnnualExpensesMinor,
    bridgeCapital,
    baselineExitAge
  );
  const selectedOneTimeKeys = oneTimeCandidates.filter((item) => item.selected).map((item) => item.key);
  const selectedOneTimeSavingsMinor = 0;
  const nextChecks = actions
    .filter((action) => action.status === "PRUEFEN" || action.leverQuality === "pruefen")
    .slice(0, 5)
    .map((action) => ({
      key: action.key,
      label: action.label,
      reason: action.leverLabel,
      estimatedAnnualCostMinor: action.estimatedAnnualCostMinor,
      classificationLabel: action.classificationLabel
    }));
  const selectedAnnualSavingsMinor = selectedRecurringAnnualSavingsMinor
    + selectedVariableAnnualSavingsMinor;
  const scenarioAnnualExpensesMinor = trackedAnnualExpensesMinor === null ? null
    : Math.max(0, trackedAnnualExpensesMinor - selectedAnnualSavingsMinor);
  const scenarioBridgeCapitalMinor = bridgeCapital === null ? null
    : bridgeCapital + selectedOneTimeSavingsMinor;
  const maximumAtTarget = maximumExpensesAtTarget(safeTargetAge, bridgeCapital, 300, a);
  const gap = trackedAnnualExpensesMinor === null || maximumAtTarget === null ? null
    : Math.max(0, trackedAnnualExpensesMinor - maximumAtTarget);
  const returnBand = ([200, 300, 400] as const).map((realReturnBps) => ({
    realReturnBps,
    currentExitAge: trackedAnnualExpensesMinor === null ? null
      : earliestExitAge(trackedAnnualExpensesMinor, bridgeCapital, realReturnBps, a),
    scenarioExitAge: scenarioAnnualExpensesMinor === null ? null
      : earliestExitAge(scenarioAnnualExpensesMinor, scenarioBridgeCapitalMinor, realReturnBps, a)
  }));
  const centralCurrent = returnBand.find((row) => row.realReturnBps === 300)!.currentExitAge;
  const centralScenario = returnBand.find((row) => row.realReturnBps === 300)!.scenarioExitAge;
  const currentCapitalGoal = centralCurrent === null ? null
    : capitalGoal(trackedAnnualExpensesMinor, centralCurrent, bridgeCapital, 300, a);
  const targetCapitalGoal = capitalGoal(
    trackedAnnualExpensesMinor,
    safeTargetAge,
    bridgeCapital,
    300,
    a
  );
  const warnings: string[] = [];
  if (bridgeCapital === null) warnings.push("Das frei verfügbare Überbrückungskapital ist unvollständig.");
  if (trackedAnnualExpensesMinor === null) warnings.push("Das aktuelle Ausgabenniveau ist nicht verfügbar.");
  if (optimizations.state !== "current") warnings.push(
    "Die Maßnahmenliste ist nicht vollständig aktuell; nur bestätigte Werte werden angesetzt."
  );
  return {
    modelVersion: "FIRE-Phasenmodell v3.1",
    estimate: true,
    targetAge: safeTargetAge,
    currentAge: a.modelYear - a.erikBirthYear,
    trackedAnnualExpensesMinor,
    normalizedAnnualExpensesMinor: annual.normalizedAnnualExpensesMinor,
    liveProjectedAnnualExpensesMinor: annual.liveProjectedAnnualExpensesMinor,
    economicMeansAnnualMinor: a.householdEconomicMeansMinor,
    bridgeCapitalMinor: bridgeCapital,
    lockedPensionMinor: pensionCapitalMinor(assets),
    selectedRecurringAnnualSavingsMinor,
    selectedVariableAnnualSavingsMinor,
    selectedAnnualSavingsMinor,
    selectedOneTimeSavingsMinor,
    scenarioAnnualExpensesMinor,
    scenarioBridgeCapitalMinor,
    central: {
      realReturnBps: 300,
      currentExitAge: centralCurrent,
      scenarioExitAge: centralScenario,
      yearsGained: centralCurrent !== null && centralScenario !== null
        ? Math.max(0, centralCurrent - centralScenario) : null,
      currentCapitalGoal,
      targetCapitalGoal,
      maximumExpensesAtTargetMinor: maximumAtTarget,
      annualGapToTargetMinor: gap,
      monthlyGapToTargetMinor: gap === null ? null : Math.round(gap / 12)
    },
    returnBand,
    actions,
    selectedActionKeys,
    variableCategories,
    selectedCategoryCuts,
    oneTimeCandidates,
    selectedOneTimeKeys,
    nextChecks,
    gapClose: fireGapClose({
      targetAge,
      selectedRecurringAnnualSavingsMinor,
      currentExitAge: centralCurrent,
      annualGapToTargetMinor: gap
    }),
    basis: [
      "FIRE-Phasenmodell v3.1; Basisjahr 2026, Modellende 2071",
      "3 % Realrendite als Mitte; 2 % und 4 % als Sensitivität [SCHÄTZUNG]",
      "Haushaltsmittel 157.000 € real pro Jahr aus der geprüften Modellannahme [SCHÄTZUNG]",
      "Kapitalziele vergleichen das bis zum Ausstiegsalter erwartete freie Finanzvermögen mit dem ab diesem Zeitpunkt benötigten FIRE-Kapital; alle Beträge sind reale Euro in heutiger Kaufkraft mit Basisjahr 2026, gebundene Vorsorge bleibt separat [SCHÄTZUNG]",
      "Kinderkosten sinken ab 2030 und 2048 und werden vollständig der Sparrate zugeführt [SCHÄTZUNG]",
      "Erbschaft und unbelegte Riester-Kapitalhöhe werden nicht angesetzt",
      "Nur bestätigte laufende Maßnahmen zählen als Szenario-Hebel; Kategorieprozente und vergangene Einmalposten nicht [SCHÄTZUNG]"
    ],
    warnings
  };
}
