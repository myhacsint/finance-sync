import type { DashboardAssets } from "./dashboard-assets.js";
import type { DashboardSavingsBaseline } from "./dashboard-savings-baseline.js";

export interface DecisionLabRequest {
  realReturnBps?: number;
  variableIncomeShareBps?: number;
  monthlyChangeMinor?: number;
  oneTimeMinor?: number;
}

export interface DashboardDecisionLab {
  generatedAt: string;
  state: "current" | "partial";
  source: "FinanceSync + Actual";
  estimate: true;
  scope: {
    label: "Finanzvermögen ohne Immobilien";
    includes: string[];
  };
  freshness: {
    assetsGeneratedAt: string;
    cashflowGeneratedAt: string;
  };
  inputs: {
    horizonYears: 20;
    realReturnBps: number;
    variableIncomeShareBps: number;
    monthlyChangeMinor: number;
    oneTimeMinor: number;
  };
  basis: {
    startingAssetsMinor: number | null;
    regularMonthlyCapacityMinor: number | null;
    variableAnnualIncomeMinor: number;
    assumedVariableMonthlyMinor: number;
    projectedMonthlyCapacityMinor: number | null;
  };
  series: Array<{
    year: number;
    baselineMinor: number;
    scenarioMinor: number;
  }>;
  milestones: Array<{
    year: 1 | 5 | 10 | 20;
    baselineMinor: number;
    scenarioMinor: number;
    differenceMinor: number;
  }>;
  depletion: {
    baselineAfterMonths: number | null;
    scenarioAfterMonths: number | null;
  };
  warnings: string[];
  basisNotes: string[];
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(Number(value))));
}

export function decisionLabInputs(request: DecisionLabRequest = {}): DashboardDecisionLab["inputs"] {
  return {
    horizonYears: 20,
    realReturnBps: clampInteger(request.realReturnBps, 200, -500, 1_000),
    variableIncomeShareBps: clampInteger(request.variableIncomeShareBps, 0, 0, 10_000),
    monthlyChangeMinor: clampInteger(request.monthlyChangeMinor, 0, -1_000_000, 1_000_000),
    oneTimeMinor: clampInteger(request.oneTimeMinor, 0, -100_000_000, 100_000_000)
  };
}

function project(
  startingAssetsMinor: number,
  monthlyCapacityMinor: number,
  realReturnBps: number,
  horizonYears: number,
  oneTimeMinor = 0
): { values: number[]; depletedAfterMonths: number | null } {
  const monthlyRate = Math.pow(1 + realReturnBps / 10_000, 1 / 12) - 1;
  let value = Math.max(0, startingAssetsMinor + oneTimeMinor);
  let depletedAfterMonths: number | null = value === 0 && startingAssetsMinor + oneTimeMinor < 0
    ? 0
    : null;
  const values = [Math.round(value)];
  for (let month = 1; month <= horizonYears * 12; month += 1) {
    value = Math.max(0, value * (1 + monthlyRate) + monthlyCapacityMinor);
    if (depletedAfterMonths === null && value === 0 && monthlyCapacityMinor < 0) {
      depletedAfterMonths = month;
    }
    if (month % 12 === 0) values.push(Math.round(value));
  }
  return { values, depletedAfterMonths };
}

export function buildDashboardDecisionLab(
  assets: DashboardAssets,
  cashflow: DashboardSavingsBaseline,
  request: DecisionLabRequest = {},
  now = new Date()
): DashboardDecisionLab {
  const inputs = decisionLabInputs(request);
  const variableAnnualIncomeMinor = cashflow.payroll.variableAnnualMinor
    + cashflow.manualForwardedIncome.variableAnnualMinor
    + cashflow.otherIncome.variableAnnualMinor;
  const assumedVariableMonthlyMinor = Math.round(
    variableAnnualIncomeMinor * inputs.variableIncomeShareBps / 10_000 / 12
  );
  const startingAssetsMinor = assets.totalMinor;
  const regularMonthlyCapacityMinor = cashflow.savingsCapacityMonthlyMinor;
  const projectedMonthlyCapacityMinor = regularMonthlyCapacityMinor === null
    ? null
    : regularMonthlyCapacityMinor + assumedVariableMonthlyMinor;
  const warnings = [...assets.warnings, ...cashflow.warnings];
  if (startingAssetsMinor === null) {
    warnings.push("Das aktuelle Finanzvermögen ist unvollständig; die Projektion ist nicht verfügbar.");
  }
  if (regularMonthlyCapacityMinor === null) {
    warnings.push("Die regelmäßige Sparratenbasis ist unvollständig; die Projektion ist nicht verfügbar.");
  }
  let series: DashboardDecisionLab["series"] = [];
  let milestones: DashboardDecisionLab["milestones"] = [];
  let baselineAfterMonths: number | null = null;
  let scenarioAfterMonths: number | null = null;
  if (startingAssetsMinor !== null && projectedMonthlyCapacityMinor !== null) {
    const baseline = project(
      startingAssetsMinor,
      projectedMonthlyCapacityMinor,
      inputs.realReturnBps,
      inputs.horizonYears
    );
    const scenario = project(
      startingAssetsMinor,
      projectedMonthlyCapacityMinor + inputs.monthlyChangeMinor,
      inputs.realReturnBps,
      inputs.horizonYears,
      inputs.oneTimeMinor
    );
    series = baseline.values.map((baselineMinor, year) => ({
      year,
      baselineMinor,
      scenarioMinor: scenario.values[year]
    }));
    milestones = ([1, 5, 10, 20] as const).map((year) => ({
      year,
      baselineMinor: baseline.values[year],
      scenarioMinor: scenario.values[year],
      differenceMinor: scenario.values[year] - baseline.values[year]
    }));
    baselineAfterMonths = baseline.depletedAfterMonths;
    scenarioAfterMonths = scenario.depletedAfterMonths;
  }
  return {
    generatedAt: now.toISOString(),
    state: startingAssetsMinor !== null
      && projectedMonthlyCapacityMinor !== null
      && assets.state === "current"
      && cashflow.state === "current"
      ? "current"
      : "partial",
    source: "FinanceSync + Actual",
    estimate: true,
    scope: {
      label: "Finanzvermögen ohne Immobilien",
      includes: assets.areas
        .filter((area) => area.amountMinor !== null)
        .map((area) => area.label)
    },
    freshness: {
      assetsGeneratedAt: assets.generatedAt,
      cashflowGeneratedAt: cashflow.generatedAt
    },
    inputs,
    basis: {
      startingAssetsMinor,
      regularMonthlyCapacityMinor,
      variableAnnualIncomeMinor,
      assumedVariableMonthlyMinor,
      projectedMonthlyCapacityMinor
    },
    series,
    milestones,
    depletion: { baselineAfterMonths, scenarioAfterMonths },
    warnings: [...new Set(warnings)],
    basisNotes: [
      "Finanzvermögen ohne Immobilien; Liquidität, Depots, Vorsorge, Krypto und Edelmetalle einbezogen",
      "Rendite als Realrendite nach Inflation und monatliche Verzinsung gerechnet [SCHÄTZUNG]",
      "Variable Jahreseinnahmen nur im gewählten Anteil berücksichtigt [SCHÄTZUNG]",
      "Bei aufgebrauchtem Finanzvermögen wird nicht automatisch eine Verschuldung unterstellt"
    ]
  };
}
