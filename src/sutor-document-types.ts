import type { ManualSnapshot } from "./connectors/manual.js";
import type { SourceConfig } from "./types.js";

export const SUTOR_EXTRACTION_VERSION = "sutor-v1";

export type SutorExtractionMethod = "native" | "ocr";

export interface SutorProvenance {
  page: number;
  confidence: number;
  method: SutorExtractionMethod;
}

export interface SutorPosition {
  isin: string;
  fundName: string;
  allocationBps: number | null;
  quantityAtomic: string;
  quantityDecimals: number;
  priceAtomic: string;
  priceDecimals: number;
  priceCurrency: "EUR" | "USD";
  marketValueMinor: string;
  fxRateAtomic: string | null;
  fxRateDecimals: number | null;
  provenance: SutorProvenance;
  validatorCodes: string[];
  ghostfolioMapped: boolean;
}

export interface ParsedSutorStatement {
  documentType: "Sutor Depotauszug";
  statementDate: string;
  statementDateOccurrences: Array<{ value: string; page: number }>;
  positions: Omit<SutorPosition, "ghostfolioMapped">[];
  totalMarketValueMinor: string;
  cashMinor: string;
  contractValueMinor: string;
  totalProvenance: SutorProvenance;
  cashProvenance: SutorProvenance;
  extractionMethod: SutorExtractionMethod;
  warnings: string[];
}

export type SutorSnapshotState = "new" | "equivalent" | "conflict";

export interface SutorPreviousStand {
  statementDate: string;
  contractValueMinor: string;
}

export interface SutorPreviewSummary {
  id: string;
  pageCount: number;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string;
  extractionVersion: string;
  documentType: "Sutor Depotauszug";
  statementDate: string;
  positions: SutorPosition[];
  totalMarketValueMinor: string;
  cashMinor: string;
  contractValueMinor: string;
  previous: SutorPreviousStand | null;
  deltaMinor: string | null;
  snapshotState: SutorSnapshotState;
  duplicate: null | { confirmedAt: string };
  warnings: string[];
  canConfirm: boolean;
  extractionMethod: SutorExtractionMethod;
}

export interface StoredSutorPreview extends SutorPreviewSummary {
  documentHash: string;
  mediaType: "application/pdf";
  source: SourceConfig;
  snapshot: ManualSnapshot;
}

export interface ConfirmedSutorRevision {
  revisionId: string;
  documentHash: string;
  confirmedAt: string;
  extractionVersion: string;
  statementDate: string;
  documentType: "Sutor Depotauszug";
  positionCount: number;
  totalMarketValueMinor: string;
  cashMinor: string;
  contractValueMinor: string;
  previous: SutorPreviousStand | null;
  deltaMinor: string | null;
  provenance: Array<{ isin: string; page: number; method: SutorExtractionMethod; confidence: number }>;
  reconciliation: "SYNCED" | "PENDING";
  status: "USER_CONFIRMED";
}
