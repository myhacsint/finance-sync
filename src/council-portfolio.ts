import { createHash } from "node:crypto";
import type { DashboardAssets } from "./dashboard-assets.js";
import type { DashboardCryptoAnalysis } from "./dashboard-crypto-analysis.js";

export function buildCouncilPortfolioSnapshot(input: DashboardAssets, cryptoAnalysis: DashboardCryptoAnalysis) {
  const depots = input.positions
    .filter((position) => position.area === "depots")
    .map((position) => ({
      name: position.label,
      valueMinor: position.amountMinor,
      capturedAt: position.capturedAt ?? null,
      valuationBasis: position.basis,
      status: position.status,
      investmentMinor: position.investmentMinor ?? null,
      netPerformanceMinor: position.netPerformanceMinor ?? null,
      netPerformancePercent: position.netPerformancePercent ?? null,
      grossPerformanceMinor: position.grossPerformanceMinor ?? null,
      dividendMinor: position.dividendMinor ?? null,
      holdings: (position.holdings ?? []).map((holding) => ({
        name: holding.label,
        symbol: holding.symbol,
        quantity: holding.quantity,
        marketPriceMinor: holding.marketPriceMinor,
        valueMinor: holding.valueMinor,
        investmentMinor: holding.investmentMinor,
        netPerformanceMinor: holding.netPerformanceMinor,
        netPerformancePercent: holding.netPerformancePercent,
        grossPerformanceMinor: holding.grossPerformanceMinor,
        dividendMinor: holding.dividendMinor,
        currency: holding.currency
      }))
    }));
  const crypto = input.positions
    .filter((position) => position.area === "crypto")
    .map((position) => ({
      name: position.label,
      valueMinor: position.amountMinor,
      capturedAt: position.capturedAt ?? null,
      valuationBasis: position.basis,
      status: position.status,
      detail: position.detail ?? null
    }));
  const preciousMetals = input.positions
    .filter((position) => position.area === "precious-metals")
    .map((position) => ({
      name: position.label,
      valueMinor: position.amountMinor,
      capturedAt: position.capturedAt ?? null,
      valuationBasis: position.basis,
      valuationSource: position.valuationSource ?? null,
      status: position.status,
      detail: position.detail ?? null,
      acquisitionCostMinor: position.acquisitionCostMinor ?? null,
      acquisitionCostEstimated: position.acquisitionCostEstimated ?? null
    }));
  const investments = [...depots, ...crypto, ...preciousMetals];
  const totalMinor = investments.every((position) => position.valueMinor !== null)
    ? investments.reduce((sum, position) => sum + Number(position.valueMinor), 0)
    : null;
  const investmentMinor = depots.every((depot) => depot.investmentMinor !== null)
    ? depots.reduce((sum, depot) => sum + Number(depot.investmentMinor), 0)
    : null;
  const netPerformanceMinor = depots.every((depot) => depot.netPerformanceMinor !== null)
    ? depots.reduce((sum, depot) => sum + Number(depot.netPerformanceMinor), 0)
    : null;
  const content = { totalMinor, investmentMinor, netPerformanceMinor, depots, crypto, cryptoAnalysis, preciousMetals };
  return {
    schemaVersion: "1.0",
    snapshotId: createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 24),
    generatedAt: input.generatedAt,
    state: investments.some((position) => position.status === "error" || position.status === "unavailable")
      ? "partial"
      : investments.some((position) => position.status === "stale") ? "stale" : "current",
    scope: "investment-portfolio",
    currency: "EUR",
    summary: {
      depots: depots.length,
      holdings: depots.reduce((sum, depot) => sum + depot.holdings.length, 0),
      cryptoPositions: crypto.length,
      preciousMetalPositions: preciousMetals.length,
      totalMinor,
      investmentMinor,
      netPerformanceMinor,
      netPerformancePercent: investmentMinor !== null && investmentMinor !== 0 && netPerformanceMinor !== null
        ? netPerformanceMinor / investmentMinor * 100
        : null
    },
    depots,
    crypto,
    cryptoAnalysis,
    preciousMetals
  };
}
