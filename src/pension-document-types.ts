export const PENSION_EXTRACTION_VERSION = "drv-v1";

export type PensionFieldKey =
  | "documentDate"
  | "dataThrough"
  | "pensionStart"
  | "earnedPoints"
  | "earnedMonthlyGrossMinor"
  | "projectedMonthlyGrossMinor"
  | "currentPensionValueMinor";

export type PensionFieldStatus = "EXTRACTED" | "USER_CORRECTED" | "USER_CONFIRMED";

export interface PensionExtractedField {
  key: PensionFieldKey;
  label: string;
  value: string;
  unit: "date" | "points" | "EUR_MONTH" | "EUR_POINT";
  page: number;
  confidence: number;
  confidenceLabel: "hoch" | "prüfen" | "fehlt";
  extractionMethod: "native" | "ocr" | "manual";
  validatorCodes: string[];
  status: PensionFieldStatus;
}

export interface PensionPreviewSummary {
  id: string;
  documentHash: string;
  mediaType: "application/pdf" | "image/jpeg" | "image/png";
  pageCount: number;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string;
  extractionVersion: string;
  fields: PensionExtractedField[];
  warnings: string[];
  duplicate: null | { revisionId: string; confirmedAt: string };
  canPreview: boolean;
  canConfirm: boolean;
}

export interface PensionFireImpactSide {
  exitAge: number | null;
  requiredCapitalAtTargetMinor: number | null;
  monthlyPensionAtStartMinor: number | null;
}

export interface PensionFireImpact {
  estimate: true;
  marker: "[SCHÄTZUNG]";
  targetAge: number;
  previous: PensionFireImpactSide;
  proposed: PensionFireImpactSide;
  delta: {
    exitAge: number | null;
    requiredCapitalAtTargetMinor: number | null;
    monthlyPensionAtStartMinor: number | null;
  };
  assumptions: string[];
}

export const PENSION_FIELD_META: Record<PensionFieldKey, {
  label: string;
  unit: PensionExtractedField["unit"];
}> = {
  documentDate: { label: "Dokumentdatum", unit: "date" },
  dataThrough: { label: "Daten berücksichtigt bis", unit: "date" },
  pensionStart: { label: "Regulärer Rentenbeginn", unit: "date" },
  earnedPoints: { label: "Erworbene Entgeltpunkte", unit: "points" },
  earnedMonthlyGrossMinor: { label: "Bisher erworbene Monatsrente brutto", unit: "EUR_MONTH" },
  projectedMonthlyGrossMinor: { label: "Prognose bei weiteren Beiträgen brutto", unit: "EUR_MONTH" },
  currentPensionValueMinor: { label: "Aktueller Rentenwert", unit: "EUR_POINT" }
};

export const PENSION_FIELD_KEYS = Object.keys(PENSION_FIELD_META) as PensionFieldKey[];
