import type { DashboardAssets } from "./dashboard-assets.js";
import type { DashboardSavingsBaseline } from "./dashboard-savings-baseline.js";

export interface DecisionLabRequest {
  trendBasis?: DecisionTrendBasis;
  realReturnBps?: number;
  monthlyChangeMinor?: number;
  oneTimeMinor?: number;
}

export type DecisionTrendBasis = "current-year" | "ytd-plus-last-year";

export interface DecisionMonthlyIncomeBreakdown {
  workRegularMinor: number;
  workVariableMinor: number;
  otherRegularMinor: number;
  otherVariableMinor: number;
  earmarkedFundingMinor: number;
  investmentReturnsExcludedMinor: number;
  unreviewedExcludedMinor: number;
}

export interface DecisionMonthlyWealthBuilding {
  bookedInvestingMinor: number;
  committedInvestingMinor: number;
  earmarkedFundingMinor: number;
  householdContributionMinor: number;
  employeeStockBenefitMinor: null;
  employeeStockBenefitStatus: "unavailable";
}

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
  monthlyIncomeMinor: number | null;
  monthlyExpensesMinor: number | null;
  averageMonthlyNetMinor: number | null;
  annualizedNetMinor: number | null;
  excludedIncomeMinor: number;
  monthlyMetric: "median" | "average";
  incomeBreakdown: DecisionMonthlyIncomeBreakdown | null;
  wealthBuilding: DecisionMonthlyWealthBuilding | null;
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
    lastMonthComparison: {
      month: string | null;
      incomeMinor: number | null;
      expensesMinor: number | null;
      netMinor: number | null;
      incomeDifferenceMinor: number | null;
      expensesDifferenceMinor: number | null;
      netDifferenceMinor: number | null;
    };
    currentMonthProgress: {
      month: string | null;
      throughDate: string | null;
      incomeMinor: number | null;
      expensesMinor: number | null;
      netMinor: number | null;
      incomeDifferenceMinor: number | null;
      expensesDifferenceMinor: number | null;
      netDifferenceMinor: number | null;
    };
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
    trendBasis: request.trendBasis === "ytd-plus-last-year"
      ? request.trendBasis
      : "current-year",
    realReturnBps: clampInteger(request.realReturnBps, 200, -500, 1_000),
    monthlyChangeMinor: clampInteger(request.monthlyChangeMinor, 0, -1_000_000, 1_000_000),
    oneTimeMinor: clampInteger(request.oneTimeMinor, 0, -100_000_000, 100_000_000)
  };
}

function trendMonthValues(month: DashboardSavingsBaseline["months"][number]): {
  incomeMinor: number;
  expensesMinor: number;
  incomeBreakdown: DecisionMonthlyIncomeBreakdown;
  wealthBuilding: DecisionMonthlyWealthBuilding;
} {
  const incomeBreakdown = {
    workRegularMinor: month.payrollRegularMinor + month.secondIncomeRegularMinor,
    workVariableMinor: month.payrollVariableMinor + month.secondIncomeVariableMinor,
    otherRegularMinor: month.otherIncomeRegularMinor,
    otherVariableMinor: month.otherIncomeVariableMinor,
    earmarkedFundingMinor: month.passThroughMinor,
    investmentReturnsExcludedMinor: month.investmentReturnMinor,
    unreviewedExcludedMinor: month.manualForwardedUnassignedMinor
      + month.unreviewedIncomeMinor
      + month.unknownPositiveMinor
  };
  return {
    incomeMinor: incomeBreakdown.workRegularMinor
      + incomeBreakdown.workVariableMinor
      + incomeBreakdown.otherRegularMinor
      + incomeBreakdown.otherVariableMinor
      + incomeBreakdown.earmarkedFundingMinor,
    expensesMinor: month.consumptionMinor + month.committedOutflowMinor,
    incomeBreakdown,
    wealthBuilding: {
      bookedInvestingMinor: month.investmentOutflowMinor,
      committedInvestingMinor: month.committedOutflowMinor,
      earmarkedFundingMinor: Math.min(month.passThroughMinor, month.committedOutflowMinor),
      householdContributionMinor: Math.max(0, month.committedOutflowMinor - month.passThroughMinor),
      employeeStockBenefitMinor: null,
      employeeStockBenefitStatus: "unavailable"
    }
  };
}

function median(values: number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

function monthlyValue(values: number[], metric: "median" | "average"): number {
  return metric === "median"
    ? median(values)
    : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function monthlyBreakdown(
  values: ReturnType<typeof trendMonthValues>[],
  metric: "median" | "average"
): { income: DecisionMonthlyIncomeBreakdown; wealth: DecisionMonthlyWealthBuilding } {
  const income = (key: keyof DecisionMonthlyIncomeBreakdown) => monthlyValue(
    values.map((value) => value.incomeBreakdown[key]), metric
  );
  const wealth = (key: Exclude<keyof DecisionMonthlyWealthBuilding,
    "employeeStockBenefitMinor" | "employeeStockBenefitStatus">) => monthlyValue(
    values.map((value) => value.wealthBuilding[key] as number), metric
  );
  return {
    income: {
      workRegularMinor: income("workRegularMinor"),
      workVariableMinor: income("workVariableMinor"),
      otherRegularMinor: income("otherRegularMinor"),
      otherVariableMinor: income("otherVariableMinor"),
      earmarkedFundingMinor: income("earmarkedFundingMinor"),
      investmentReturnsExcludedMinor: income("investmentReturnsExcludedMinor"),
      unreviewedExcludedMinor: income("unreviewedExcludedMinor")
    },
    wealth: {
      bookedInvestingMinor: wealth("bookedInvestingMinor"),
      committedInvestingMinor: wealth("committedInvestingMinor"),
      earmarkedFundingMinor: wealth("earmarkedFundingMinor"),
      householdContributionMinor: wealth("householdContributionMinor"),
      employeeStockBenefitMinor: null,
      employeeStockBenefitStatus: "unavailable"
    }
  };
}

function trendOption(
  key: DecisionTrendBasis,
  label: string,
  description: string,
  months: DashboardSavingsBaseline["months"],
  monthlyMetric: "median" | "average" = "average"
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
      monthlyIncomeMinor: null,
      monthlyExpensesMinor: null,
      averageMonthlyNetMinor: null,
      annualizedNetMinor: null,
      excludedIncomeMinor: 0,
      monthlyMetric,
      incomeBreakdown: null,
      wealthBuilding: null
    };
  }
  const monthValues = months.map(trendMonthValues);
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
  const monthlyIncomeMinor = monthlyValue(monthValues.map((value) => value.incomeMinor), monthlyMetric);
  const monthlyExpensesMinor = monthlyValue(monthValues.map((value) => value.expensesMinor), monthlyMetric);
  const averageMonthlyNetMinor = monthlyValue(
    monthValues.map((value) => value.incomeMinor - value.expensesMinor), monthlyMetric
  );
  const breakdown = monthlyBreakdown(monthValues, monthlyMetric);
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
    monthlyIncomeMinor,
    monthlyExpensesMinor,
    averageMonthlyNetMinor,
    annualizedNetMinor: averageMonthlyNetMinor * 12,
    excludedIncomeMinor: totals.excludedIncomeMinor,
    monthlyMetric,
    incomeBreakdown: breakdown.income,
    wealthBuilding: breakdown.wealth
  };
}

export function decisionTrendOptions(
  cashflow: DashboardSavingsBaseline
): DecisionTrendOption[] {
  const completeMonths = cashflow.window.currentMonthIncluded
    ? cashflow.months.slice(0, -1)
    : cashflow.months;
  const lastMonth = completeMonths.at(-1);
  const endYear = lastMonth?.month.slice(0, 4);
  const previousYear = endYear ? String(Number(endYear) - 1) : "";
  const ytd = endYear
    ? completeMonths.filter((month) => month.month.startsWith(`${endYear}-`))
    : [];
  const priorFullYear = previousYear
    ? completeMonths.filter((month) => month.month.startsWith(`${previousYear}-`))
    : [];
  return [
    trendOption(
      "current-year",
      "Aktuelles Jahr",
      "YTD-Bilanz und typischer Monat als Median der realen Monatsüberschüsse",
      ytd,
      "median"
    ),
    trendOption(
      "ytd-plus-last-year",
      "YTD + letztes Jahr",
      "Geglätteter Durchschnitt aus dem vollständigen Vorjahr und dem aktuellen YTD",
      priorFullYear.length === 12 ? [...priorFullYear, ...ytd] : [],
      "average"
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
  const typicalTrend = trendOptions.find((option) => option.key === "current-year")!;
  const completeMonths = cashflow.window.currentMonthIncluded
    ? cashflow.months.slice(0, -1)
    : cashflow.months;
  const lastMonth = completeMonths.at(-1);
  const lastMonthValues = lastMonth ? trendMonthValues(lastMonth) : null;
  const lastMonthNetMinor = lastMonthValues
    ? lastMonthValues.incomeMinor - lastMonthValues.expensesMinor
    : null;
  const currentMonth = cashflow.window.currentMonthIncluded ? cashflow.months.at(-1) : undefined;
  const currentMonthValues = currentMonth ? trendMonthValues(currentMonth) : null;
  const currentMonthNetMinor = currentMonthValues
    ? currentMonthValues.incomeMinor - currentMonthValues.expensesMinor
    : null;
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
      projectedMonthlyCapacityMinor,
      lastMonthComparison: {
        month: lastMonth?.month ?? null,
        incomeMinor: lastMonthValues?.incomeMinor ?? null,
        expensesMinor: lastMonthValues?.expensesMinor ?? null,
        netMinor: lastMonthNetMinor,
        incomeDifferenceMinor: lastMonthValues && typicalTrend.monthlyIncomeMinor !== null
          ? lastMonthValues.incomeMinor - typicalTrend.monthlyIncomeMinor
          : null,
        expensesDifferenceMinor: lastMonthValues && typicalTrend.monthlyExpensesMinor !== null
          ? lastMonthValues.expensesMinor - typicalTrend.monthlyExpensesMinor
          : null,
        netDifferenceMinor: lastMonthNetMinor !== null && typicalTrend.averageMonthlyNetMinor !== null
          ? lastMonthNetMinor - typicalTrend.averageMonthlyNetMinor
          : null
      },
      currentMonthProgress: {
        month: currentMonth?.month ?? null,
        throughDate: currentMonth ? cashflow.generatedAt.slice(0, 10) : null,
        incomeMinor: currentMonthValues?.incomeMinor ?? null,
        expensesMinor: currentMonthValues?.expensesMinor ?? null,
        netMinor: currentMonthNetMinor,
        incomeDifferenceMinor: currentMonthValues && typicalTrend.monthlyIncomeMinor !== null
          ? currentMonthValues.incomeMinor - typicalTrend.monthlyIncomeMinor
          : null,
        expensesDifferenceMinor: currentMonthValues && typicalTrend.monthlyExpensesMinor !== null
          ? currentMonthValues.expensesMinor - typicalTrend.monthlyExpensesMinor
          : null,
        netDifferenceMinor: currentMonthNetMinor !== null && typicalTrend.averageMonthlyNetMinor !== null
          ? currentMonthNetMinor - typicalTrend.averageMonthlyNetMinor
          : null
      }
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
      "Der typische Monat verwendet den Median der realen monatlichen Überschüsse; der letzte Monat dient nur als Vergleich [SCHÄTZUNG]",
      "Mitarbeiteraktienvorteile sind nur enthalten, wenn sie als eigener Arbeitgeberzufluss gebucht wurden",
      "Bei aufgebrauchtem Finanzvermögen wird nicht automatisch eine Verschuldung unterstellt"
    ]
  };
}
