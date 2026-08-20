import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardCryptoAnalysis } from "./dashboard-crypto-analysis.js";
import type { AppConfig } from "./types.js";

const config: AppConfig = {
  port: 8080,
  timezone: "Europe/Berlin",
  sources: [],
  analysis: {
    cryptoPosition: {
      capturedAt: "2026-01-15T12:00:00Z",
      scopeStartYear: 2023,
      holdings: {
        liquidSolAtomic: "1000000000",
        delegatedSolAtomic: "90000000000",
        undelegatedStakeSolAtomic: "3000000000",
        rentReserveSolAtomic: "1000000000",
        inactiveStakeSolAtomic: "5000000000",
        rewardsSolAtomic: "10000000000"
      },
      transition: {
        occurredAt: "2025-01-15T12:00:00Z",
        inputEth: 5,
        outputSolAtomic: "80000000000",
        valueEurMinor: 1_200_000,
        valueUsdMinor: 1_600_000,
        confidence: "Sehr wahrscheinlich"
      },
      capital: {
        currentPositionBasisEurMinor: 1_000_000,
        currentPositionBasisUsdMinor: 1_100_000,
        grossFiatContributionsEurMinor: 2_000_000,
        grossFiatContributionsUsdMinor: 2_200_000,
        fiatWithdrawalsEurMinor: 2_500_000,
        fiatWithdrawalsUsdMinor: 2_700_000,
        netFiatCapitalEurMinor: -500_000,
        netFiatCapitalUsdMinor: -500_000
      },
      taxYears: [{
        year: 2023,
        status: "review",
        title: "Prüfung nötig",
        detail: "SOL innerhalb eines Jahres gegen ETH getauscht.",
        confidence: "Sehr wahrscheinlich",
        referenceMinor: 50_000,
        referenceLabel: "möglicher Gewinn",
        estimate: true
      }],
      evidence: [{
        label: "Solana und Ethereum",
        detail: "Transfers on-chain geprüft",
        confidence: "Bestaetigt"
      }]
    }
  }
};

test("Kryptoanalyse trennt Bestand, Rewards, Investmentbasis und Steuerprüfung", () => {
  const result = buildDashboardCryptoAnalysis(config, new Date("2026-01-15T13:00:00Z"));
  assert.equal(result.holdings.totalSol, 100);
  assert.equal(result.holdings.stakeTotalSol, 99);
  assert.equal(result.holdings.rewardsSol, 10);
  assert.equal(result.transition.conversionBasisEurPerSol, 150);
  assert.equal(result.investment.effectiveBasisEurPerSol, 100);
  assert.equal(result.investment.netFiatCapitalEurMinor, -500_000);
  assert.equal(result.investment.positiveOwnCapitalAtRiskEurMinor, 0);
  assert.equal(result.taxYears[0].status, "review");
});

test("öffentliche Antwort enthält keine Wallet-Adressen", () => {
  const result = buildDashboardCryptoAnalysis(config);
  const payload = JSON.stringify(result);
  assert.doesNotMatch(payload, /walletAddress|stakeAccountAddress|sourceAddress/i);
});
