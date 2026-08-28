import { randomUUID } from "node:crypto";
import { PENSION_EXTRACTION_VERSION, PENSION_FIELD_KEYS, PENSION_FIELD_META, type PensionExtractedField, type PensionFieldKey, type PensionPreviewSummary } from "./pension-document-types.js";
import { validatePensionFields } from "./drv-pension-validator.js";

interface StoredPreview extends PensionPreviewSummary {}

function cleanValue(key: PensionFieldKey, raw: string): string {
  const value = raw.trim();
  if (PENSION_FIELD_META[key].unit === "date") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("FIELD_VALUE_INVALID");
    return value;
  }
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) throw new Error("FIELD_VALUE_INVALID");
  if (PENSION_FIELD_META[key].unit === "points") return parsed.toFixed(4);
  // The review form always exposes monetary values as euros. Internally the
  // FIRE model uses minor units, including for whole-euro corrections.
  return String(Math.round(parsed * 100));
}

export class PensionPreviewStore {
  private previews = new Map<string, StoredPreview>();
  constructor(private readonly ttlMs = 30 * 60_000) {}

  create(input: {
    documentHash: string;
    mediaType: StoredPreview["mediaType"];
    pageCount: number;
    sizeBytes: number;
    fields: PensionExtractedField[];
    duplicate: StoredPreview["duplicate"];
  }): PensionPreviewSummary {
    this.purge();
    const validated = validatePensionFields(input.fields);
    const now = Date.now();
    const preview: StoredPreview = {
      id: randomUUID(),
      documentHash: input.documentHash,
      mediaType: input.mediaType,
      pageCount: input.pageCount,
      sizeBytes: input.sizeBytes,
      createdAt: new Date(now).toISOString(),
      expiresAt: new Date(now + this.ttlMs).toISOString(),
      extractionVersion: PENSION_EXTRACTION_VERSION,
      fields: validated.fields,
      warnings: validated.warnings,
      duplicate: input.duplicate,
      canPreview: validated.valid && !input.duplicate,
      canConfirm: false
    };
    this.previews.set(preview.id, preview);
    return structuredClone(preview);
  }

  get(id: string): PensionPreviewSummary {
    this.purge();
    const preview = this.previews.get(id);
    if (!preview) throw new Error("PREVIEW_EXPIRED");
    return structuredClone(preview);
  }

  updateField(id: string, key: PensionFieldKey, rawValue: string): PensionPreviewSummary {
    this.purge();
    if (!PENSION_FIELD_KEYS.includes(key)) throw new Error("FIELD_UNKNOWN");
    const preview = this.previews.get(id);
    if (!preview) throw new Error("PREVIEW_EXPIRED");
    const current = preview.fields.find((field) => field.key === key)!;
    current.value = cleanValue(key, rawValue);
    current.page = Math.max(1, current.page || 1);
    current.confidence = 1;
    current.confidenceLabel = "hoch";
    current.extractionMethod = "manual";
    current.status = "USER_CORRECTED";
    current.validatorCodes = [];
    const validated = validatePensionFields(preview.fields);
    preview.fields = validated.fields;
    preview.warnings = validated.warnings;
    preview.canPreview = validated.valid && !preview.duplicate;
    preview.canConfirm = false;
    return structuredClone(preview);
  }

  markReviewed(id: string): PensionPreviewSummary {
    const preview = this.previews.get(id);
    if (!preview) throw new Error("PREVIEW_EXPIRED");
    const validated = validatePensionFields(preview.fields);
    if (!validated.valid || preview.duplicate) throw new Error("PREVIEW_NOT_CONFIRMABLE");
    preview.fields = validated.fields;
    preview.canPreview = true;
    preview.canConfirm = true;
    return structuredClone(preview);
  }

  consume(id: string): void { this.previews.delete(id); }

  private purge(): void {
    const now = Date.now();
    for (const [id, preview] of this.previews) {
      if (new Date(preview.expiresAt).getTime() <= now) this.previews.delete(id);
    }
  }
}
