import assert from "node:assert/strict";
import test from "node:test";
import { buildCouncilPortfolioSnapshot } from "./council-portfolio.js";
import type { DashboardAssets } from "./dashboard-assets.js";
import type { DashboardCryptoAnalysis } from "./dashboard-crypto-analysis.js";

test("Council-Portfolio enthält Depots, Krypto und Edelmetalle, aber weder Cash noch Vorsorge", () => {
  const assets = {
    generatedAt: "2026-08-25T20:00:00.000Z",
    state: "current",
    totalMinor: 15_000_00,
    basis: "latest-available",
    marketHistory: { status: "current", latestDate: "2026-08-25" },
    summary: { automaticCurrent: 2, automaticTotal: 2, confirmed: 0 },
    areas: [],
    warnings: [],
    positions: [
      { key: "private-account-key", label: "DKB Depot privat", area: "depots", areaLabel: "Depots", amountMinor: 10_000_00, basis: "Ghostfolio", status: "current", capturedAt: "2026-08-25T19:00:00.000Z", investmentMinor: 8_000_00, netPerformanceMinor: 2_000_00, netPerformancePercent: 25, grossPerformanceMinor: 2_100_00, dividendMinor: 100_00, holdings: [{ label: "SAP", symbol: "SAP.DE", quantity: 10, marketPriceMinor: 1000_00, valueMinor: 10_000_00, investmentMinor: 8_000_00, netPerformanceMinor: 2_000_00, netPerformancePercent: 25, grossPerformanceMinor: 2_100_00, dividendMinor: 100_00, currency: "EUR" }] },
      { key: "private-crypto-key", label: "Solana & Staking", area: "crypto", areaLabel: "Krypto", amountMinor: 3_000_00, basis: "Ghostfolio", status: "current", capturedAt: "2026-08-25T19:00:00.000Z" },
      { key: "private-gold-key", label: "Gold", area: "precious-metals", areaLabel: "Edelmetalle", amountMinor: 2_000_00, basis: "Ankaufwert [SCHÄTZUNG]", status: "confirmed", detail: "20 g · Feinheit 999,9", acquisitionCostMinor: 1_500_00, acquisitionCostEstimated: false, valuationSource: "Beleg" },
      { key: "private-cash-key", label: "DKB Giro privat", area: "cash", areaLabel: "Liquidität", amountMinor: 5_000_00, basis: "FinanceSync", status: "current" },
      { key: "private-pension-key", label: "Riester", area: "pensions", areaLabel: "Vorsorge", amountMinor: 4_000_00, basis: "Bestätigter Wert", status: "confirmed" }
    ]
  } as DashboardAssets;
  const cryptoAnalysis = {
    generatedAt: "2026-08-25T20:00:00.000Z",
    capturedAt: "2026-08-24T12:00:00.000Z",
    state: "reconstructed",
    source: "FinanceSync-Rekonstruktion",
    selection: { view: "crypto-origin-tax", scopeStartYear: 2023 },
    holdings: { liquidSol: 1, delegatedSol: 9, undelegatedStakeSol: 0, rentReserveSol: 0.01, inactiveStakeSol: 0, stakeTotalSol: 9.01, rewardsSol: 1, acquiredOrConvertedSol: 9.01, totalSol: 10.01, rewardsPercent: 9.99 },
    transition: { occurredAt: "2023-01-01", inputEth: 1, outputSol: 9.01, valueEurMinor: 1_000_00, valueUsdMinor: 1_100_00, conversionBasisEurPerSol: 111, conversionBasisUsdPerSol: 122, confidence: "Bestaetigt" },
    investment: { method: "economic-average-cost", currentPositionBasisEurMinor: 1_000_00, currentPositionBasisUsdMinor: 1_100_00, effectiveBasisEurPerSol: 99.9, effectiveBasisUsdPerSol: 109.9, breakEvenEurPerSol: 99.9, grossFiatContributionsEurMinor: 1_000_00, grossFiatContributionsUsdMinor: 1_100_00, fiatWithdrawalsEurMinor: 0, fiatWithdrawalsUsdMinor: 0, netFiatCapitalEurMinor: 1_000_00, netFiatCapitalUsdMinor: 1_100_00, netFiatPerCurrentSolEur: 99.9, positiveOwnCapitalAtRiskEurMinor: 1_000_00 },
    taxYears: [], evidence: [], warnings: [], basis: []
  } as DashboardCryptoAnalysis;
  const snapshot = buildCouncilPortfolioSnapshot(assets, cryptoAnalysis);
  assert.equal(snapshot.summary.depots, 1);
  assert.equal(snapshot.summary.holdings, 1);
  assert.equal(snapshot.summary.totalMinor, 15_000_00);
  assert.equal(snapshot.summary.netPerformancePercent, 25);
  assert.equal(snapshot.depots[0]?.holdings[0]?.symbol, "SAP.DE");
  assert.equal(snapshot.crypto[0]?.name, "Solana & Staking");
  assert.equal(snapshot.cryptoAnalysis.holdings.delegatedSol, 9);
  assert.equal(snapshot.preciousMetals[0]?.acquisitionCostMinor, 1_500_00);
  const serialized = JSON.stringify(snapshot);
  assert.doesNotMatch(serialized, /private-account-key|private-cash-key|private-pension-key|DKB Giro|Riester/);
});
