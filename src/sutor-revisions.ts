import { randomUUID } from "node:crypto";
import type { ConfirmedSutorRevision, StoredSutorPreview } from "./sutor-document-types.js";

export function createConfirmedSutorRevision(
  preview: StoredSutorPreview,
  reconciliation: "SYNCED" | "PENDING" = "SYNCED",
  confirmedAt = new Date().toISOString()
): ConfirmedSutorRevision {
  return {
    revisionId: `sutor-revision-${randomUUID()}`,
    documentHash: preview.documentHash,
    confirmedAt,
    extractionVersion: preview.extractionVersion,
    statementDate: preview.statementDate,
    documentType: preview.documentType,
    positionCount: preview.positions.length,
    totalMarketValueMinor: preview.totalMarketValueMinor,
    cashMinor: preview.cashMinor,
    contractValueMinor: preview.contractValueMinor,
    previous: preview.previous,
    deltaMinor: preview.deltaMinor,
    provenance: preview.positions.map((position) => ({
      isin: position.isin,
      page: position.provenance.page,
      method: position.provenance.method,
      confidence: position.provenance.confidence
    })),
    reconciliation,
    status: "USER_CONFIRMED"
  };
}
