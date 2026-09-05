import type { DashboardOverview } from "./dashboard-overview.js";
import type { DashboardWealthHistory } from "./dashboard-wealth-history.js";

/** One dated valuation basis for chart, monthly delta and bridge. */
export function reconcileOverviewHistory(overview: DashboardOverview, history?: DashboardWealthHistory): DashboardOverview {
  const date = overview.comparison.effectiveDate;
  const point = history?.points.find(point => point.date === date && point.quality !== "partial");
  const complete = point && overview.totalMinor !== null;
  const previousTotalMinor = complete ? point.totalMinor : null;
  const changeTotalMinor = complete ? overview.totalMinor! - point.totalMinor : null;
  const parts = complete ? [
    { key: "cash" as const, label: "Liquidität", currentMinor: overview.cash.amountMinor,
      previousMinor: point.cashMinor, changeMinor: overview.cash.amountMinor === null ? null : overview.cash.amountMinor - point.cashMinor,
      source: "Actual · identische Basis wie Vermögensverlauf", capturedDates: [date], valuation: "estimated" as const },
    { key: "investments" as const, label: "Anlagen inklusive Vorsorge und Sachwerten", currentMinor: overview.investments.amountMinor,
      previousMinor: point.investmentsMinor, changeMinor: overview.investments.amountMinor === null ? null : overview.investments.amountMinor - point.investmentsMinor,
      source: "Ghostfolio-Historie und bestätigte Sachwerte", capturedDates: [date], valuation: "estimated" as const }
  ] : [];
  const currentFlow = overview.cashflow.months.find(month => month.partial);
  return {
    ...overview,
    comparison: { effectiveDate: date, state: complete ? "complete" : "partial", previousTotalMinor, changeTotalMinor, parts,
      warnings: complete ? ["Historische Bewertung rekonstruiert [SCHÄTZUNG]"] : ["Kein vergleichbarer vollständiger Monatsendstand verfügbar"] },
    wealthBridge: complete && currentFlow ? {
      month: currentFlow.key, previousTotalMinor: point.totalMinor,
      currentTotalMinor: overview.totalMinor!, cashflowNetMinor: currentFlow.incomeMinor - currentFlow.spentMinor,
      valuationAndOtherMinor: changeTotalMinor! - (currentFlow.incomeMinor - currentFlow.spentMinor)
    } : undefined
  };
}
