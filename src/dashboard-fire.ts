import type { DashboardAssets } from "./dashboard-assets.js";
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
  selectedAnnualSavingsMinor: number;
  scenarioAnnualExpensesMinor: number | null;
  central: {
    realReturnBps: 300;
    currentExitAge: number | null;
    scenarioExitAge: number | null;
    yearsGained: number | null;
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
  basis: string[];
  warnings: string[];
}

function freeCapitalMinor(assets: DashboardAssets): number | null {
  const included = assets.areas.filter((area) => area.key !== "pensions");
  if (included.some((area) => area.amountMinor === null)) return null;
  return included.reduce((sum, area) => sum + (area.amountMinor ?? 0), 0);
}

function pensionCapitalMinor(assets: DashboardAssets): number | null {
  return assets.areas.find((area) => area.key === "pensions")?.amountMinor ?? null;
}

function sustainable(
  annualExpensesMinor: number,
  exitAge: number,
  bridgeCapitalMinor: number,
  realReturnBps: number
): boolean {
  const exitYear = ERIK_BIRTH_YEAR + exitAge;
  const wifeExitYear = WIFE_BIRTH_YEAR + 60;
  const erikPensionYear = ERIK_BIRTH_YEAR + 67;
  const wifePensionYear = 2051;
  if (exitYear <= MODEL_YEAR) return false;
  const erikPoints = ERIK_POINTS_2026 + ERIK_POINTS_PER_YEAR * (exitYear - MODEL_YEAR);
  const wifePoints = WIFE_POINTS_2026 + WIFE_POINTS_PER_YEAR * (wifeExitYear - MODEL_YEAR);
  const erikPensionMinor = erikPoints * RENT_VALUE_MINOR * 12 * ERIK_NET_FACTOR;
  const wifePensionMinor = wifePoints * RENT_VALUE_MINOR * 12 * WIFE_NET_FACTOR;
  const bavPensionMinor = BAV_ACCRUED_MINOR
    + BAV_PER_YEAR_MINOR * Math.max(0, exitYear - BAV_BASE_YEAR);
  const alPayoutMinor = Math.round(
    AL_NOMINAL_MINOR / Math.pow(1 + INFLATION, AL_YEAR - MODEL_YEAR)
  );
  let capital = bridgeCapitalMinor;
  for (let year = MODEL_YEAR; year <= END_YEAR; year += 1) {
    const erikWorks = year < exitYear;
    const wifeWorks = year < wifeExitYear;
    let income = 0;
    if (erikWorks && wifeWorks) income += HOUSEHOLD_ECONOMIC_MEANS_MINOR;
    else if (erikWorks) income += HOUSEHOLD_ECONOMIC_MEANS_MINOR - WIFE_ECONOMIC_MEANS_MINOR;
    else if (wifeWorks) income += WIFE_ECONOMIC_MEANS_MINOR;
    if (year > erikPensionYear) income += erikPensionMinor;
    else if (year === erikPensionYear) income += erikPensionMinor * 3 / 12;
    if (year >= wifePensionYear) income += wifePensionMinor;
    if (year >= Math.max(BAV_START_YEAR, exitYear)) income += bavPensionMinor;
    let need = annualExpensesMinor;
    if (!erikWorks) {
      need += PKV_EMPLOYER_SUBSIDY_MINOR;
      need -= WORK_COSTS_MINOR;
      need -= COMPANY_CAR_ERIK_MINOR;
    }
    if (!wifeWorks) {
      need -= COMPANY_CAR_WIFE_MINOR;
      if (year < wifePensionYear) need += WIFE_GKV_MINOR;
    }
    const lostCars = Number(!erikWorks) + Number(!wifeWorks);
    if (lostCars === 1) need += REPLACEMENT_CAR_ONE_MINOR;
    else if (lostCars === 2) need += REPLACEMENT_CAR_TWO_MINOR;
    if (year >= CHILDCARE_RELIEF_YEAR) need -= CHILDCARE_RELIEF_MINOR;
    if (year >= OTHER_CHILD_RELIEF_YEAR) need -= OTHER_CHILD_RELIEF_MINOR;
    if (year < AL_YEAR) need += AL_CONTRIBUTION_MINOR;
    if (year < BAV_START_YEAR) need += RIESTER_CONTRIBUTION_MINOR;
    capital = capital * (1 + realReturnBps / 10_000)
      + income + (year === AL_YEAR ? alPayoutMinor : 0) - need;
    if (capital < 0) return false;
  }
  return true;
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

export function buildDashboardFireTracking(
  assets: DashboardAssets,
  annual: {
    liveProjectedAnnualExpensesMinor: number | null;
    normalizedAnnualExpensesMinor: number | null;
  },
  optimizations: DashboardRecurringExpenseOptimizations,
  targetAge = 60,
  requestedActionKeys: string[] = []
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
  const selectedAnnualSavingsMinor = actions
    .filter((action) => selectedActionKeys.includes(action.key))
    .reduce((sum, action) => sum + (action.expectedAnnualSavingsMinor ?? 0), 0);
  const scenarioAnnualExpensesMinor = trackedAnnualExpensesMinor === null ? null
    : Math.max(0, trackedAnnualExpensesMinor - selectedAnnualSavingsMinor);
  const maximumAtTarget = maximumExpensesAtTarget(safeTargetAge, bridgeCapital, 300);
  const gap = trackedAnnualExpensesMinor === null || maximumAtTarget === null ? null
    : Math.max(0, trackedAnnualExpensesMinor - maximumAtTarget);
  const returnBand = ([200, 300, 400] as const).map((realReturnBps) => ({
    realReturnBps,
    currentExitAge: trackedAnnualExpensesMinor === null ? null
      : earliestExitAge(trackedAnnualExpensesMinor, bridgeCapital, realReturnBps),
    scenarioExitAge: scenarioAnnualExpensesMinor === null ? null
      : earliestExitAge(scenarioAnnualExpensesMinor, bridgeCapital, realReturnBps)
  }));
  const centralCurrent = returnBand.find((row) => row.realReturnBps === 300)!.currentExitAge;
  const centralScenario = returnBand.find((row) => row.realReturnBps === 300)!.scenarioExitAge;
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
    selectedAnnualSavingsMinor,
    scenarioAnnualExpensesMinor,
    central: {
      realReturnBps: 300,
      currentExitAge: centralCurrent,
      scenarioExitAge: centralScenario,
      yearsGained: centralCurrent !== null && centralScenario !== null
        ? Math.max(0, centralCurrent - centralScenario) : null,
      maximumExpensesAtTargetMinor: maximumAtTarget,
      annualGapToTargetMinor: gap,
      monthlyGapToTargetMinor: gap === null ? null : Math.round(gap / 12)
    },
    returnBand,
    actions,
    selectedActionKeys,
    basis: [
      "FIRE-Phasenmodell v3.1; Basisjahr 2026, Modellende 2071",
      "3 % Realrendite als Mitte; 2 % und 4 % als Sensitivität [SCHÄTZUNG]",
      "Haushaltsmittel 157.000 € real pro Jahr aus der geprüften Modellannahme [SCHÄTZUNG]",
      "Kinderkosten sinken ab 2030 und 2048 und werden vollständig der Sparrate zugeführt [SCHÄTZUNG]",
      "Erbschaft und unbelegte Riester-Kapitalhöhe werden nicht angesetzt"
    ],
    warnings
  };
}
