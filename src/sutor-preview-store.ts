import { randomUUID } from "node:crypto";
import type { AppConfig, SourceConfig } from "./types.js";
import type { ManualSnapshot } from "./connectors/manual.js";
import {
  SUTOR_EXTRACTION_VERSION,
  type ParsedSutorStatement,
  type StoredSutorPreview,
  type SutorPreviousStand,
  type SutorPreviewSummary,
  type SutorSnapshotState
} from "./sutor-document-types.js";

function endOfDayBerlin(date: string): string {
  const zone = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Berlin",
    timeZoneName: "longOffset"
  }).formatToParts(new Date(`${date}T12:00:00Z`))
    .find((part) => part.type === "timeZoneName")?.value;
  return `${date}T23:59:59${zone?.replace("GMT", "") || "+01:00"}`;
}

export function sutorWorkflowSettings(source: SourceConfig): { accountId: string; owner?: string } {
  const settings = source.settings?.manualWorkflow as { provider?: string; accountId?: string; owner?: string } | undefined;
  if (settings?.provider !== "sutor" || !settings.accountId) throw new Error("SUTOR_SOURCE_INVALID");
  return { accountId: settings.accountId, owner: settings.owner ?? source.owners?.[0] };
}

export function buildSutorSnapshot(
  source: SourceConfig,
  statement: ParsedSutorStatement,
  documentHash: string
): ManualSnapshot {
  const settings = sutorWorkflowSettings(source);
  return {
    accountId: settings.accountId,
    capturedAt: endOfDayBerlin(statement.statementDate),
    amount: `${BigInt(statement.contractValueMinor) / 100n}.${String(BigInt(statement.contractValueMinor) % 100n).padStart(2, "0")}`,
    currency: "EUR",
    owner: settings.owner,
    evidence: { type: "confirmed-sutor-pdf-derived", sha256: documentHash },
    details: {
      evidenceType: "confirmed-sutor-pdf-derived",
      documentType: statement.documentType,
      statementDate: statement.statementDate,
      cashMinor: statement.cashMinor,
      totalMarketValueMinor: statement.totalMarketValueMinor,
      retentionMode: "derived-only",
      extractionVersion: SUTOR_EXTRACTION_VERSION
    },
    holdings: statement.positions.map((position) => ({
      symbol: position.isin,
      name: position.fundName,
      quantityAtomic: position.quantityAtomic,
      atomicDecimals: position.quantityDecimals,
      currency: position.priceCurrency,
      priceAtomic: position.priceAtomic,
      priceDecimals: position.priceDecimals,
      priceCurrency: position.priceCurrency,
      marketValueMinor: position.marketValueMinor,
      marketValueCurrency: "EUR"
    }))
  };
}

function publicPreview(preview: StoredSutorPreview): SutorPreviewSummary {
  const { documentHash: _hash, mediaType: _media, source: _source, snapshot: _snapshot, ...safe } = preview;
  return structuredClone(safe);
}

export class SutorPreviewStore {
  private previews = new Map<string, StoredSutorPreview>();
  constructor(private readonly ttlMs = 30 * 60_000) {}

  create(input: {
    documentHash: string;
    pageCount: number;
    sizeBytes: number;
    statement: ParsedSutorStatement;
    source: SourceConfig;
    config: AppConfig;
    previous: SutorPreviousStand | null;
    snapshotState: SutorSnapshotState;
    duplicate: null | { confirmedAt: string };
  }): SutorPreviewSummary {
    this.purge();
    const settings = sutorWorkflowSettings(input.source);
    const positions = input.statement.positions.map((position) => ({
      ...position,
      ghostfolioMapped: Boolean(input.config.ghostfolio?.holdingMap?.[position.isin])
    }));
    const ghostfolioTarget = Boolean(
      input.config.ghostfolio?.enabled
      && input.config.ghostfolio.accountMap[settings.accountId]
    );
    const mappingsReady = ghostfolioTarget && positions.every((position) => position.ghostfolioMapped);
    const validationReady = positions.every((position) => position.validatorCodes.length === 0);
    const warnings = [...input.statement.warnings];
    if (!ghostfolioTarget) warnings.push("GHOSTFOLIO_TARGET_MISSING");
    if (positions.some((position) => !position.ghostfolioMapped)) warnings.push("GHOSTFOLIO_MAPPING_MISSING");
    if (input.snapshotState === "equivalent") warnings.push("SNAPSHOT_EQUIVALENT");
    if (input.snapshotState === "conflict") warnings.push("SNAPSHOT_CONFLICT");
    const snapshot = buildSutorSnapshot(input.source, input.statement, input.documentHash);
    const now = Date.now();
    const preview: StoredSutorPreview = {
      id: randomUUID(),
      documentHash: input.documentHash,
      mediaType: "application/pdf",
      pageCount: input.pageCount,
      sizeBytes: input.sizeBytes,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.ttlMs).toISOString(),
      extractionVersion: SUTOR_EXTRACTION_VERSION,
      documentType: input.statement.documentType,
      statementDate: input.statement.statementDate,
      positions,
      totalMarketValueMinor: input.statement.totalMarketValueMinor,
      cashMinor: input.statement.cashMinor,
      contractValueMinor: input.statement.contractValueMinor,
      previous: input.previous,
      deltaMinor: input.previous
        ? (BigInt(input.statement.contractValueMinor) - BigInt(input.previous.contractValueMinor)).toString()
        : null,
      snapshotState: input.snapshotState,
      duplicate: input.duplicate,
      warnings: [...new Set(warnings)],
      canConfirm: !input.duplicate
        && input.snapshotState === "new"
        && input.statement.extractionMethod === "native"
        && validationReady
        && mappingsReady,
      extractionMethod: input.statement.extractionMethod,
      source: input.source,
      snapshot
    };
    this.previews.set(preview.id, preview);
    return publicPreview(preview);
  }

  get(id: string): SutorPreviewSummary {
    return publicPreview(this.take(id));
  }

  take(id: string): StoredSutorPreview {
    this.purge();
    const preview = this.previews.get(id);
    if (!preview) throw new Error("PREVIEW_EXPIRED");
    return preview;
  }

  consume(id: string): void { this.previews.delete(id); }

  private purge(): void {
    const now = Date.now();
    for (const [id, preview] of this.previews) {
      if (Date.parse(preview.expiresAt) <= now) this.previews.delete(id);
    }
  }
}
