import type {
  AppConfig,
  PhysicalAssetConfig,
  PhysicalAssetValuationConfig
} from "./types.js";

function validDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(`${value}T00:00:00Z`));
}

function validValuation(value: PhysicalAssetValuationConfig): boolean {
  return validDate(value.date)
    && Number.isSafeInteger(value.amountMinor)
    && value.amountMinor > 0
    && Boolean(value.basis.trim())
    && Boolean(value.source.trim());
}

export function configuredPhysicalAssets(config: AppConfig): PhysicalAssetConfig[] {
  return (config.physicalAssets ?? []).filter((asset) =>
    Boolean(asset.id)
    && Boolean(asset.label)
    && asset.kind === "gold"
    && Number.isFinite(asset.weightGrams)
    && asset.weightGrams > 0
    && Number.isFinite(asset.fineness)
    && asset.fineness > 0
    && asset.fineness <= 1000
    && asset.valuations.some(validValuation)
  );
}

export function latestPhysicalAssetValuation(
  asset: PhysicalAssetConfig,
  onOrBefore?: string
): PhysicalAssetValuationConfig | undefined {
  return asset.valuations
    .filter((valuation) => validValuation(valuation) && (!onOrBefore || valuation.date <= onOrBefore))
    .sort((left, right) => right.date.localeCompare(left.date))[0];
}

export function physicalAssetsTotalMinor(config: AppConfig, onOrBefore?: string): number {
  return configuredPhysicalAssets(config).reduce((sum, asset) => {
    const valuation = latestPhysicalAssetValuation(asset, onOrBefore);
    return sum + (valuation?.amountMinor ?? 0);
  }, 0);
}
