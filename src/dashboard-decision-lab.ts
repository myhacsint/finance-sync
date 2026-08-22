import type { DashboardAssets } from "./dashboard-assets.js";
import type { DashboardSavingsBaseline } from "./dashboard-savings-baseline.js";

export interface DecisionLabRequest {
  trendBasis?: DecisionTrendBasis;
  realReturnBps?: number;
  monthlyChangeMinor?: number;
  oneTimeMinor?: number;
}

export type DecisionTrendBasis = "ytd" | "last-month" | "ytd-plus-last-year";

export interface DecisionTrendOption {
  key: DecisionTrendBasis;
  label: string;
  description: string;
  available: boolean;
  periodStart: string | null;
  periodEnd: string | null;
  months: number;
  incomeMinor: number | null;
  expensesMinor: number | null;
  netMinor: number | null;
  averageMonthlyNetMinor: number | null;
  annualizedNetMinor: number | null;
  excludedIncomeMinor: number;
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
    trendBasis: DecisionTrendBasis;
    realReturnBps: number;
    monthlyChangeMinor: number;
    oneTimeMinor: number;
  };
  basis: {
    startingAssetsMinor: number | null;
    selectedTrend: DecisionTrendOption;
    trendOptions: DecisionTrendOption[];
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
    trendBasis: request.trendBasis === "last-month"
      || request.trendBasis === "ytd-plus-last-year"
      ? request.trendBasis
      : "ytd",
    realReturnBps: clampInteger(request.realReturnBps, 200, -500, 1_000),
    monthlyChangeMinor: clampInteger(request.monthlyChangeMinor, 0, -1_000_000, 1_000_000),
    oneTimeMinor: clampInteger(request.oneTimeMinor, 0, -100_000_000, 100_000_000)
  };
}

function trendMonthValues(month: DashboardSavingsBaseline["months"][number]): {
  incomeMinor: number;
  expensesMinor: number;
} {
  return {
    incomeMinor: month.payrollRegularMinor
      + month.payrollVariableMinor
      + month.secondIncomeRegularMinor
      + month.secondIncomeVariableMinor
      + month.otherIncomeRegularMinor
      + month.otherIncomeVariableMinor
      + month.passThroughMinor,
    expensesMinor: month.consumptionMinor + month.committedOutflowMinor
  };
}

function trendOption(
  key: DecisionTrendBasis,
  label: string,
  description: string,
  months: DashboardSavingsBaseline["months"]
): DecisionTrendOption {
  if (months.length === 0) {
    return {
      key,
      label,
      description,
      available: false,
      periodStart: null,
      periodEnd: null,
      months: 0,
      incomeMinor: null,
      expensesMinor: null,
      netMinor: null,
      averageMonthlyNetMinor: null,
      annualizedNetMinor: null,
      excludedIncomeMinor: 0
    };
  }
  const totals = months.reduce((sum, month) => {
    const values = trendMonthValues(month);
    return {
      incomeMinor: sum.incomeMinor + values.incomeMinor,
      expensesMinor: sum.expensesMinor + values.expensesMinor,
      excludedIncomeMinor: sum.excludedIncomeMinor
        + month.manualForwardedUnassignedMinor
        + month.unreviewedIncomeMinor
        + month.unknownPositiveMinor
    };
  }, { incomeMinor: 0, expensesMinor: 0, excludedIncomeMinor: 0 });
  const netMinor = totals.incomeMinor - totals.expensesMinor;
  const averageMonthlyNetMinor = Math.round(netMinor / months.length);
  return {
    key,
    label,
    description,
    available: true,
    periodStart: months[0].month,
    periodEnd: months.at(-1)!.month,
    months: months.length,
    incomeMinor: totals.incomeMinor,
    expensesMinor: totals.expensesMinor,
    netMinor,
    averageMonthlyNetMinor,
    annualizedNetMinor: averageMonthlyNetMinor * 12,
    excludedIncomeMinor: totals.excludedIncomeMinor
  };
}

export function decisionTrendOptions(
  cashflow: DashboardSavingsBaseline
): DecisionTrendOption[] {
  const lastMonth = cashflow.months.at(-1);
  const endYear = lastMonth?.month.slice(0, 4);
  const previousYear = endYear ? String(Number(endYear) - 1) : "";
  const ytd = endYear
    ? cashflow.months.filter((month) => month.month.startsWith(`${endYear}-`))
    : [];
  const priorFullYear = previousYear
    ? cashflow.months.filter((month) => month.month.startsWith(`${previousYear}-`))
    : [];
  return [
    trendOption(
      "ytd",
      "Aktuelles Jahr (YTD)",
      "Durchschnitt aller vollständigen Monate des laufenden Jahres",
      ytd
    ),
    trendOption(
      "last-month",
      "Letzter vollständiger Monat",
      "Fortschreibung des zuletzt vollständig gebuchten Monats",
      lastMonth ? [lastMonth] : []
    ),
    trendOption(
      "ytd-plus-last-year",
      "YTD + letztes Jahr",
      "Geglätteter Durchschnitt aus dem vollständigen Vorjahr und dem aktuellen YTD",
      priorFullYear.length === 12 ? [...priorFullYear, ...ytd] : []
    )
  ];
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
  const trendOptions = decisionTrendOptions(cashflow);
  const selectedTrend = trendOptions.find((option) => option.key === inputs.trendBasis)!;
  const startingAssetsMinor = assets.totalMinor;
  const projectedMonthlyCapacityMinor = selectedTrend.averageMonthlyNetMinor;
  const warnings = [...assets.warnings];
  if (startingAssetsMinor === null) {
    warnings.push("Das aktuelle Finanzvermögen ist unvollständig; die Projektion ist nicht verfügbar.");
  }
  if (!selectedTrend.available || projectedMonthlyCapacityMinor === null) {
    warnings.push("Die gewählte Einnahmen- und Ausgabenbasis ist unvollständig; die Projektion ist nicht verfügbar.");
  }
  if (selectedTrend.excludedIncomeMinor > 0) {
    warnings.push(
      "Im gewählten Zeitraum sind noch nicht eindeutig zugeordnete Einnahmen nicht in der Projektion enthalten."
    );
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
      && selectedTrend.excludedIncomeMinor === 0
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
      selectedTrend,
      trendOptions,
      projectedMonthlyCapacityMinor
    },
    series,
    milestones,
    depletion: { baselineAfterMonths, scenarioAfterMonths },
    warnings: [...new Set(warnings)],
    basisNotes: [
      "Finanzvermögen ohne Immobilien; Liquidität, Depots, Vorsorge, Krypto und Edelmetalle einbezogen",
      "Rendite als Realrendite nach Inflation und monatliche Verzinsung gerechnet [SCHÄTZUNG]",
      "Einnahmen und Ausgaben nach der gewählten historischen Basis fortgeschrieben [SCHÄTZUNG]",
      "Kostenerstattungen mit Ausgaben verrechnet; interne Überträge und Kapitalerträge ausgeschlossen",
      "Bei aufgebrauchtem Finanzvermögen wird nicht automatisch eine Verschuldung unterstellt"
    ]
  };
}
