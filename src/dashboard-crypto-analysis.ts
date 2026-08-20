import type {
  AppConfig,
  CryptoEvidenceStatus,
  CryptoPositionAnalysisConfig
} from "./types.js";

const SOL_DECIMALS = 9;

function atomicToNumber(value: string): number {
  if (!/^\d+$/.test(value)) throw new Error("Ungültige SOL-Menge in der Kryptoanalyse");
  const atomic = Number(value);
  if (!Number.isSafeInteger(atomic)) throw new Error("SOL-Menge überschreitet den sicheren Zahlenbereich");
  return atomic / 10 ** SOL_DECIMALS;
}

function rounded(value: number, decimals = 6): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export interface DashboardCryptoAnalysis {
  generatedAt: string;
  capturedAt: string;
  state: "reconstructed";
  source: "FinanceSync-Rekonstruktion";
  selection: { view: "crypto-origin-tax"; scopeStartYear: number };
  holdings: {
    liquidSol: number;
    delegatedSol: number;
    undelegatedStakeSol: number;
    rentReserveSol: number;
    inactiveStakeSol: number;
    stakeTotalSol: number;
    rewardsSol: number;
    acquiredOrConvertedSol: number;
    totalSol: number;
    rewardsPercent: number;
  };
  transition: {
    occurredAt: string;
    inputEth: number;
    outputSol: number;
    valueEurMinor: number;
    valueUsdMinor: number;
    conversionBasisEurPerSol: number;
    conversionBasisUsdPerSol: number;
    confidence: CryptoEvidenceStatus;
  };
  investment: {
    method: "economic-average-cost";
    currentPositionBasisEurMinor: number;
    currentPositionBasisUsdMinor: number;
    effectiveBasisEurPerSol: number;
    effectiveBasisUsdPerSol: number;
    breakEvenEurPerSol: number;
    grossFiatContributionsEurMinor: number;
    grossFiatContributionsUsdMinor: number;
    fiatWithdrawalsEurMinor: number;
    fiatWithdrawalsUsdMinor: number;
    netFiatCapitalEurMinor: number;
    netFiatCapitalUsdMinor: number;
    netFiatPerCurrentSolEur: number;
    positiveOwnCapitalAtRiskEurMinor: number;
  };
  taxYears: CryptoPositionAnalysisConfig["taxYears"];
  evidence: CryptoPositionAnalysisConfig["evidence"];
  warnings: string[];
  basis: string[];
}

export function buildDashboardCryptoAnalysis(
  config: AppConfig,
  now = new Date()
): DashboardCryptoAnalysis {
  const source = config.analysis?.cryptoPosition;
  if (!source) throw new Error("Kryptoanalyse ist nicht konfiguriert");
  if (!Number.isFinite(new Date(source.capturedAt).getTime())) {
    throw new Error("Ungültiger Datenstand der Kryptoanalyse");
  }
  const liquidSol = atomicToNumber(source.holdings.liquidSolAtomic);
  const delegatedSol = atomicToNumber(source.holdings.delegatedSolAtomic);
  const undelegatedStakeSol = atomicToNumber(source.holdings.undelegatedStakeSolAtomic);
  const rentReserveSol = atomicToNumber(source.holdings.rentReserveSolAtomic);
  const inactiveStakeSol = atomicToNumber(source.holdings.inactiveStakeSolAtomic);
  const rewardsSol = atomicToNumber(source.holdings.rewardsSolAtomic);
  const stakeTotalSol = delegatedSol + undelegatedStakeSol + rentReserveSol + inactiveStakeSol;
  const totalSol = liquidSol + stakeTotalSol;
  const acquiredOrConvertedSol = totalSol - rewardsSol;
  if (totalSol <= 0 || acquiredOrConvertedSol < 0) {
    throw new Error("Kryptoanalyse enthält widersprüchliche Bestandsmengen");
  }
  const outputSol = atomicToNumber(source.transition.outputSolAtomic);
  if (outputSol <= 0) throw new Error("Kryptoanalyse enthält keinen SOL-Output");
  const transitionEur = source.transition.valueEurMinor / 100;
  const transitionUsd = source.transition.valueUsdMinor / 100;
  const positionBasisEur = source.capital.currentPositionBasisEurMinor / 100;
  const positionBasisUsd = source.capital.currentPositionBasisUsdMinor / 100;
  return {
    generatedAt: now.toISOString(),
    capturedAt: source.capturedAt,
    state: "reconstructed",
    source: "FinanceSync-Rekonstruktion",
    selection: { view: "crypto-origin-tax", scopeStartYear: source.scopeStartYear },
    holdings: {
      liquidSol: rounded(liquidSol, 9),
      delegatedSol: rounded(delegatedSol, 9),
      undelegatedStakeSol: rounded(undelegatedStakeSol, 9),
      rentReserveSol: rounded(rentReserveSol, 9),
      inactiveStakeSol: rounded(inactiveStakeSol, 9),
      stakeTotalSol: rounded(stakeTotalSol, 9),
      rewardsSol: rounded(rewardsSol, 9),
      acquiredOrConvertedSol: rounded(acquiredOrConvertedSol, 9),
      totalSol: rounded(totalSol, 9),
      rewardsPercent: rounded(rewardsSol / totalSol * 100, 4)
    },
    transition: {
      occurredAt: source.transition.occurredAt,
      inputEth: source.transition.inputEth,
      outputSol: rounded(outputSol, 9),
      valueEurMinor: source.transition.valueEurMinor,
      valueUsdMinor: source.transition.valueUsdMinor,
      conversionBasisEurPerSol: rounded(transitionEur / outputSol),
      conversionBasisUsdPerSol: rounded(transitionUsd / outputSol),
      confidence: source.transition.confidence
    },
    investment: {
      method: "economic-average-cost",
      currentPositionBasisEurMinor: source.capital.currentPositionBasisEurMinor,
      currentPositionBasisUsdMinor: source.capital.currentPositionBasisUsdMinor,
      effectiveBasisEurPerSol: rounded(positionBasisEur / totalSol),
      effectiveBasisUsdPerSol: rounded(positionBasisUsd / totalSol),
      breakEvenEurPerSol: rounded(positionBasisEur / totalSol),
      grossFiatContributionsEurMinor: source.capital.grossFiatContributionsEurMinor,
      grossFiatContributionsUsdMinor: source.capital.grossFiatContributionsUsdMinor,
      fiatWithdrawalsEurMinor: source.capital.fiatWithdrawalsEurMinor,
      fiatWithdrawalsUsdMinor: source.capital.fiatWithdrawalsUsdMinor,
      netFiatCapitalEurMinor: source.capital.netFiatCapitalEurMinor,
      netFiatCapitalUsdMinor: source.capital.netFiatCapitalUsdMinor,
      netFiatPerCurrentSolEur: rounded(source.capital.netFiatCapitalEurMinor / 100 / totalSol),
      positiveOwnCapitalAtRiskEurMinor: Math.max(0, source.capital.netFiatCapitalEurMinor)
    },
    taxYears: [...source.taxYears].sort((left, right) => left.year - right.year),
    evidence: source.evidence,
    warnings: [
      "Investmentbasis und steuerliche Anschaffungskosten sind getrennte Rechenwerke.",
      "Die Steuerzeitleiste ist eine Prüfspur und keine Berechnung der Steuerschuld."
    ],
    basis: [
      "Bestand und Rewards: Solana-Rekonstruktion einschließlich Stake-Accounts",
      "Fiat-Cashflows und Handelshistorie: lokale Exporte",
      "Kurswerte zum Transaktionszeitpunkt sind mit [SCHÄTZUNG] gekennzeichnet"
    ]
  };
}
