export interface FireAssumptions {
  modelYear: number;
  endYear: number;
  erikBirthYear: number;
  wifeBirthYear: number;
  householdEconomicMeansMinor: number;
  wifeEconomicMeansMinor: number;
  childcareReliefMinor: number;
  childcareReliefYear: number;
  otherChildReliefMinor: number;
  otherChildReliefYear: number;
  pkvEmployerSubsidyMinor: number;
  workCostsMinor: number;
  companyCarErikMinor: number;
  companyCarWifeMinor: number;
  replacementCarOneMinor: number;
  replacementCarTwoMinor: number;
  wifeGkvMinor: number;
  riesterContributionMinor: number;
  alContributionMinor: number;
  alNominalMinor: number;
  alYear: number;
  inflation: number;
  rentValueMinor: number;
  erikPointsBase: number;
  wifePointsBase: number;
  erikPointsPerYear: number;
  wifePointsPerYear: number;
  erikNetFactor: number;
  wifeNetFactor: number;
  bavAccruedMinor: number;
  bavPerYearMinor: number;
  bavBaseYear: number;
  bavStartYear: number;
  wifeExitAge: number;
  erikPensionAge: number;
  erikPensionStartMonth: number;
}

export const DEFAULT_FIRE_ASSUMPTIONS: FireAssumptions = {
  modelYear: 2026,
  endYear: 2071,
  erikBirthYear: 1978,
  wifeBirthYear: 1983,
  householdEconomicMeansMinor: 15_700_000,
  wifeEconomicMeansMinor: 3_880_000,
  childcareReliefMinor: 629_100,
  childcareReliefYear: 2030,
  otherChildReliefMinor: 660_000,
  otherChildReliefYear: 2048,
  pkvEmployerSubsidyMinor: 608_600,
  workCostsMinor: 400_000,
  companyCarErikMinor: 610_000,
  companyCarWifeMinor: 342_000,
  replacementCarOneMinor: 600_000,
  replacementCarTwoMinor: 1_100_000,
  wifeGkvMinor: 850_000,
  riesterContributionMinor: 137_500,
  alContributionMinor: 177_000,
  alNominalMinor: 17_900_000,
  alYear: 2045,
  inflation: 0.02,
  rentValueMinor: 4_079,
  erikPointsBase: 42.6,
  wifePointsBase: 10.3234,
  erikPointsPerYear: 1.9,
  wifePointsPerYear: 1.05,
  erikNetFactor: 0.85,
  wifeNetFactor: 0.80,
  bavAccruedMinor: 162_200,
  bavPerYearMinor: 16_600,
  bavBaseYear: 2025,
  bavStartYear: 2041,
  wifeExitAge: 60,
  erikPensionAge: 67,
  erikPensionStartMonth: 10
};

export function resolveFireAssumptions(raw?: Partial<FireAssumptions> | null): FireAssumptions {
  const resolved = { ...DEFAULT_FIRE_ASSUMPTIONS };
  if (!raw || typeof raw !== "object") return resolved;
  for (const key of Object.keys(DEFAULT_FIRE_ASSUMPTIONS) as Array<keyof FireAssumptions>) {
    const value = raw[key];
    if (typeof value === "number" && Number.isFinite(value)) resolved[key] = value;
  }
  return resolved;
}
