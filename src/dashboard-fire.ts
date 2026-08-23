import { createHash } from "node:crypto";
import type { DashboardAssets } from "./dashboard-assets.js";
import type { AnalysisTransaction, DashboardAnalyses } from "./dashboard-analyses.js";
import type { DashboardRecurringExpenseOptimizations } from "./dashboard-recurring-expenses.js";

const MODEL_YEAR = 2026;
const END_YEAR = 2071;
const ERIK_BIRTH_YEAR = 1978;
const WIFE_BIRTH_YEAR = 1983;
const HOUSEHOLD_ECONOMIC_MEANS_MINOR = 15_700_000;
const WIFE_ECONOMIC_MEANS_MINOR = 3_880_000;
const CHILDCARE_RELIEF_MINOR = 629_100;
const CHILDCARE_RELIEF_YEAR = 2030;
const OTHER_CHILD_RELIEF_MINOR = 660_000;
const OTHER_CHILD_RELIEF_YEAR = 2048;
const PKV_EMPLOYER_SUBSIDY_MINOR = 608_600;
const WORK_COSTS_MINOR = 400_000;
const COMPANY_CAR_ERIK_MINOR = 610_000;
const COMPANY_CAR_WIFE_MINOR = 342_000;
const REPLACEMENT_CAR_ONE_MINOR = 600_000;
const REPLACEMENT_CAR_TWO_MINOR = 1_100_000;
const WIFE_GKV_MINOR = 850_000;
const RIESTER_CONTRIBUTION_MINOR = 137_500;
const AL_CONTRIBUTION_MINOR = 177_000;
const AL_NOMINAL_MINOR = 17_900_000;
const AL_YEAR = 2045;
const INFLATION = 0.02;
const RENT_VALUE_MINOR = 4_079;
const ERIK_POINTS_2026 = 42.6;
const WIFE_POINTS_2026 = 10.3234;
const ERIK_POINTS_PER_YEAR = 1.9;
const WIFE_POINTS_PER_YEAR = 1.05;
const ERIK_NET_FACTOR = 0.85;
const WIFE_NET_FACTOR = 0.80;
const BAV_ACCRUED_MINOR = 162_200;
const BAV_PER_YEAR_MINOR = 16_600;
const BAV_BASE_YEAR = 2025;
const BAV_START_YEAR = 2041;

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
  basis: string[];
  warnings: string[];
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

function phaseContext(exitAge: number): FirePhaseContext | null {
  const exitYear = ERIK_BIRTH_YEAR + exitAge;
  const wifeExitYear = WIFE_BIRTH_YEAR + 60;
  const erikPensionYear = ERIK_BIRTH_YEAR + 67;
  const wifePensionYear = 2051;
  if (exitYear <= MODEL_YEAR) return null;
  const erikPoints = ERIK_POINTS_2026 + ERIK_POINTS_PER_YEAR * (exitYear - MODEL_YEAR);
  const wifePoints = WIFE_POINTS_2026 + WIFE_POINTS_PER_YEAR * (wifeExitYear - MODEL_YEAR);
  const erikPensionMinor = erikPoints * RENT_VALUE_MINOR * 12 * ERIK_NET_FACTOR;
  const wifePensionMinor = wifePoints * RENT_VALUE_MINOR * 12 * WIFE_NET_FACTOR;
  const bavPensionMinor = BAV_ACCRUED_MINOR
    + BAV_PER_YEAR_MINOR * Math.max(0, exitYear - BAV_BASE_YEAR);
  const alPayoutMinor = Math.round(
    AL_NOMINAL_MINOR / Math.pow(1 + INFLATION, AL_YEAR - MODEL_YEAR)
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
  realReturnBps: number
): number {
    const erikWorks = year < context.exitYear;
    const wifeWorks = year < context.wifeExitYear;
    let income = 0;
    if (erikWorks && wifeWorks) income += HOUSEHOLD_ECONOMIC_MEANS_MINOR;
    else if (erikWorks) income += HOUSEHOLD_ECONOMIC_MEANS_MINOR - WIFE_ECONOMIC_MEANS_MINOR;
    else if (wifeWorks) income += WIFE_ECONOMIC_MEANS_MINOR;
    if (year > context.erikPensionYear) income += context.erikPensionMinor;
    else if (year === context.erikPensionYear) income += context.erikPensionMinor * 3 / 12;
    if (year >= context.wifePensionYear) income += context.wifePensionMinor;
    if (year >= Math.max(BAV_START_YEAR, context.exitYear)) income += context.bavPensionMinor;
    let need = annualExpensesMinor;
    if (!erikWorks) {
      need += PKV_EMPLOYER_SUBSIDY_MINOR;
      need -= WORK_COSTS_MINOR;
      need -= COMPANY_CAR_ERIK_MINOR;
    }
    if (!wifeWorks) {
      need -= COMPANY_CAR_WIFE_MINOR;
      if (year < context.wifePensionYear) need += WIFE_GKV_MINOR;
    }
    const lostCars = Number(!erikWorks) + Number(!wifeWorks);
    if (lostCars === 1) need += REPLACEMENT_CAR_ONE_MINOR;
    else if (lostCars === 2) need += REPLACEMENT_CAR_TWO_MINOR;
    if (year >= CHILDCARE_RELIEF_YEAR) need -= CHILDCARE_RELIEF_MINOR;
    if (year >= OTHER_CHILD_RELIEF_YEAR) need -= OTHER_CHILD_RELIEF_MINOR;
    if (year < AL_YEAR) need += AL_CONTRIBUTION_MINOR;
    if (year < BAV_START_YEAR) need += RIESTER_CONTRIBUTION_MINOR;
    return capital * (1 + realReturnBps / 10_000)
      + income + (year === AL_YEAR ? context.alPayoutMinor : 0) - need;
}

function sustainable(
  annualExpensesMinor: number,
  exitAge: number,
  bridgeCapitalMinor: number,
  realReturnBps: number
): boolean {
  const context = phaseContext(exitAge);
  if (!context) return false;
  let capital = bridgeCapitalMinor;
  for (let year = MODEL_YEAR; year <= END_YEAR; year += 1) {
    capital = capitalAfterYear(capital, annualExpensesMinor, year, context, realReturnBps);
    if (capital < 0) return false;
  }
  return true;
}

function projectedCapitalAtExit(
  annualExpensesMinor: number,
  exitAge: number,
  bridgeCapitalMinor: number,
  realReturnBps: number
): number | null {
  const context = phaseContext(exitAge);
  if (!context) return null;
  let capital = bridgeCapitalMinor;
  for (let year = MODEL_YEAR; year < context.exitYear; year += 1) {
    capital = capitalAfterYear(capital, annualExpensesMinor, year, context, realReturnBps);
    if (capital < 0) return 0;
  }
  return Math.floor(capital / 10_000) * 10_000;
}

function requiredCapitalAtExit(
  annualExpensesMinor: number,
  exitAge: number,
  realReturnBps: number
): number | null {
  const context = phaseContext(exitAge);
  if (!context) return null;
  const supports = (initialCapital: number): boolean => {
    let capital = initialCapital;
    for (let year = context.exitYear; year <= END_YEAR; year += 1) {
      capital = capitalAfterYear(capital, annualExpensesMinor, year, context, realReturnBps);
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
  realReturnBps: number
): FireCapitalGoal {
  const projected = annualExpensesMinor === null || bridgeCapitalMinor === null ? null
    : projectedCapitalAtExit(annualExpensesMinor, age, bridgeCapitalMinor, realReturnBps);
  const required = annualExpensesMinor === null ? null
    : requiredCapitalAtExit(annualExpensesMinor, age, realReturnBps);
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
  realReturnBps: number
): number | null {
  if (bridgeCapitalMinor === null) return null;
  for (let age = 50; age <= 67; age += 1) {
    if (sustainable(annualExpensesMinor, age, bridgeCapitalMinor, realReturnBps)) return age;
  }
  return null;
}

function maximumExpensesAtTarget(
  targetAge: number,
  bridgeCapitalMinor: number | null,
  realReturnBps: number
): number | null {
  if (bridgeCapitalMinor === null) return null;
  let low = 0;
  let high = 20_000_000;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (sustainable(middle, targetAge, bridgeCapitalMinor, realReturnBps)) low = middle;
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

function merchantIdentity(value: string): { key: string; label: string } {
  const normalized = normalizedLabel(value);
  if (normalized.includes("amazon")) {
    return { key: "amazon", label: "Amazon" };
  }
  if (normalized.includes("anthropic") || /\bclaude ai subscription\b/.test(normalized)) {
    return { key: "anthropic-claude", label: "Anthropic Claude Subscription" };
  }
  if (normalized.includes("openai") || normalized.includes("chatgpt")) {
    return { key: "openai-chatgpt", label: "OpenAI / ChatGPT" };
  }
  if (normalized.includes("paypal")) {
    return { key: "paypal", label: "PayPal" };
  }
  if (normalized.includes("hetzner online")) {
    return { key: "hetzner-online", label: "Hetzner Online" };
  }
  if (normalized.includes("tipp24")) {
    return { key: "tipp24", label: "Tipp24" };
  }
  if (normalized.includes("eschacher") && normalized.includes("liftbetriebe")) {
    return { key: "eschacher-liftbetriebe", label: "Eschacher Liftbetriebe" };
  }
  if (normalized.includes("fraport") && normalized.includes("parken")) {
    return { key: "fraport-parken", label: "Fraport Parken" };
  }
  if (normalized.includes("jufa") && normalized.includes("hotel")) {
    return { key: "jufa-hotels", label: "JUFA Hotels" };
  }
  if (normalized.includes("rhoen") && normalized.includes("park")
    && normalized.includes("hotel")) {
    return { key: "rhoen-park-hotel", label: "Rhön Park Hotel" };
  }
  if (/^bauhaus(?:\b|\s)/.test(normalized)) {
    return { key: "bauhaus", label: "BAUHAUS" };
  }
  return { key: normalized || "unbekannt", label: value.trim() || "Unbekannter Händler" };
}

export function groupFireTransactions(transactions: AnalysisTransaction[]): FireMerchantGroup[] {
  const groups = new Map<string, FireMerchantGroup>();
  for (const transaction of transactions) {
    const identity = merchantIdentity(transaction.merchant);
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
  baselineExitAge: number | null
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
        currentMerchantGroups: groupFireTransactions(category.periodTransactions),
        previousMerchantGroups: groupFireTransactions(category.comparisonTransactions),
        annualizedCurrentMinor,
        grossPlanningAnnualMinor,
        planningAnnualMinor,
        recurringSavingsExcludedMinor,
        selectedReductionPercent,
        annualSavingsMinor,
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
        countedOneTimeMinor,
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
  requestedOneTimeKeys: string[] = []
): DashboardFireTracking {
  const safeTargetAge = Math.max(50, Math.min(67, Math.round(targetAge)));
  const bridgeCapital = freeCapitalMinor(assets);
  const trackedAnnualExpensesMinor = annual.liveProjectedAnnualExpensesMinor
    ?? annual.normalizedAnnualExpensesMinor;
  const baselineExitAge = trackedAnnualExpensesMinor === null ? null
    : earliestExitAge(trackedAnnualExpensesMinor, bridgeCapital, 300);
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
    baselineExitAge
  );
  const selectedCategoryCuts = variableCategories
    .filter((category) => category.selectedReductionPercent > 0)
    .map((category) => `${category.key}:${category.selectedReductionPercent}`);
  const selectedCuts = new Map(variableCategories.map((category) => [
    category.key,
    category.selectedReductionPercent
  ]));
  const selectedVariableAnnualSavingsMinor = variableCategories
    .reduce((sum, category) => sum + category.annualSavingsMinor, 0);
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
  const selectedOneTimeSavingsMinor = oneTimeCandidates
    .reduce((sum, item) => sum + item.countedOneTimeMinor, 0);
  const selectedAnnualSavingsMinor = selectedRecurringAnnualSavingsMinor
    + selectedVariableAnnualSavingsMinor;
  const scenarioAnnualExpensesMinor = trackedAnnualExpensesMinor === null ? null
    : Math.max(0, trackedAnnualExpensesMinor - selectedAnnualSavingsMinor);
  const scenarioBridgeCapitalMinor = bridgeCapital === null ? null
    : bridgeCapital + selectedOneTimeSavingsMinor;
  const maximumAtTarget = maximumExpensesAtTarget(safeTargetAge, bridgeCapital, 300);
  const gap = trackedAnnualExpensesMinor === null || maximumAtTarget === null ? null
    : Math.max(0, trackedAnnualExpensesMinor - maximumAtTarget);
  const returnBand = ([200, 300, 400] as const).map((realReturnBps) => ({
    realReturnBps,
    currentExitAge: trackedAnnualExpensesMinor === null ? null
      : earliestExitAge(trackedAnnualExpensesMinor, bridgeCapital, realReturnBps),
    scenarioExitAge: scenarioAnnualExpensesMinor === null ? null
      : earliestExitAge(scenarioAnnualExpensesMinor, scenarioBridgeCapitalMinor, realReturnBps)
  }));
  const centralCurrent = returnBand.find((row) => row.realReturnBps === 300)!.currentExitAge;
  const centralScenario = returnBand.find((row) => row.realReturnBps === 300)!.scenarioExitAge;
  const currentCapitalGoal = centralCurrent === null ? null
    : capitalGoal(trackedAnnualExpensesMinor, centralCurrent, bridgeCapital, 300);
  const targetCapitalGoal = capitalGoal(
    trackedAnnualExpensesMinor,
    safeTargetAge,
    bridgeCapital,
    300
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
    currentAge: MODEL_YEAR - ERIK_BIRTH_YEAR,
    trackedAnnualExpensesMinor,
    normalizedAnnualExpensesMinor: annual.normalizedAnnualExpensesMinor,
    liveProjectedAnnualExpensesMinor: annual.liveProjectedAnnualExpensesMinor,
    economicMeansAnnualMinor: HOUSEHOLD_ECONOMIC_MEANS_MINOR,
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
    basis: [
      "FIRE-Phasenmodell v3.1; Basisjahr 2026, Modellende 2071",
      "3 % Realrendite als Mitte; 2 % und 4 % als Sensitivität [SCHÄTZUNG]",
      "Haushaltsmittel 157.000 € real pro Jahr aus der geprüften Modellannahme [SCHÄTZUNG]",
      "Kapitalziele vergleichen das bis zum Ausstiegsalter erwartete freie Finanzvermögen mit dem ab diesem Zeitpunkt benötigten FIRE-Kapital; alle Beträge sind reale Euro in heutiger Kaufkraft mit Basisjahr 2026, gebundene Vorsorge bleibt separat [SCHÄTZUNG]",
      "Kinderkosten sinken ab 2030 und 2048 und werden vollständig der Sparrate zugeführt [SCHÄTZUNG]",
      "Erbschaft und unbelegte Riester-Kapitalhöhe werden nicht angesetzt",
      "Variable Kategorien verwenden den Mittelwert aus laufender Jahreshochrechnung und Vorjahr [SCHÄTZUNG]",
      "Einzelposten wirken nur einmal auf das Überbrückungskapital; vergangene Ausgaben werden nicht rückwirkend als Ersparnis gezählt [SCHÄTZUNG]"
    ],
    warnings
  };
}
