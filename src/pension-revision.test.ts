import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FinanceDatabase } from "./database.js";
import { DEFAULT_FIRE_ASSUMPTIONS } from "./fire-assumptions.js";
import { PensionPreviewStore } from "./pension-preview-store.js";
import { createConfirmedPensionRevision, pensionAssumptionsFromFields, pensionImpact } from "./pension-revisions.js";
import type { PensionExtractedField, PensionFieldKey } from "./pension-document-types.js";

const values: Record<PensionFieldKey, string> = {
  documentDate: "2026-08-15", dataThrough: "2025-12-31", pensionStart: "2045-10-01",
  earnedPoints: "40.0000", earnedMonthlyGrossMinor: "160000",
  projectedMonthlyGrossMinor: "290000", currentPensionValueMinor: "4000"
};

function fields(): PensionExtractedField[] {
  return Object.entries(values).map(([key, value]) => ({
    key: key as PensionFieldKey, label: key, value,
    unit: key.includes("Date") || key === "dataThrough" || key === "pensionStart" ? "date" : key === "earnedPoints" ? "points" : key === "currentPensionValueMinor" ? "EUR_POINT" : "EUR_MONTH",
    page: 1, confidence: 0.98, confidenceLabel: "hoch", extractionMethod: "native", validatorCodes: [], status: "EXTRACTED"
  }));
}

test("review corrections use euros and previews retain derived fields only", () => {
  const store = new PensionPreviewStore();
  const preview = store.create({ documentHash: "hash-derived-only", mediaType: "application/pdf", pageCount: 1, sizeBytes: 5000, fields: fields(), duplicate: null });
  const corrected = store.updateField(preview.id, "earnedMonthlyGrossMinor", "1.600,00");
  assert.equal(corrected.fields.find((field) => field.key === "earnedMonthlyGrossMinor")?.value, "160000");
  assert.doesNotMatch(JSON.stringify(corrected), /Versicherungsnummer|Musterstraße|rawText|fullText/);
  assert.equal(store.markReviewed(preview.id).canConfirm, true);
});

test("confirmation is audited, duplicate-safe and contains no raw document text", () => {
  const root = mkdtempSync(join(tmpdir(), "finance-pension-revision-"));
  const file = join(root, "finance.sqlite");
  const db = new FinanceDatabase(file);
  const store = new PensionPreviewStore();
  let preview = store.create({ documentHash: "synthetic-hash-001", mediaType: "application/pdf", pageCount: 2, sizeBytes: 8000, fields: fields(), duplicate: null });
  preview = store.markReviewed(preview.id);
  const assumptions = pensionAssumptionsFromFields(preview.fields, DEFAULT_FIRE_ASSUMPTIONS);
  const impact = pensionImpact(55,
    { exitAge: 57, requiredCapitalAtTargetMinor: 100_000_000, assumptions: DEFAULT_FIRE_ASSUMPTIONS },
    { exitAge: 56, requiredCapitalAtTargetMinor: 98_000_000, assumptions }
  );
  const revision = createConfirmedPensionRevision(preview, assumptions, impact, "2026-08-15T12:00:00.000Z");
  assert.equal(db.confirmPensionRevision(preview, revision).created, true);
  assert.equal(db.confirmPensionRevision(preview, revision).created, false);
  assert.equal(db.query("SELECT count(*) AS count FROM pension_revisions")[0].count, 1);
  assert.equal(db.query("SELECT count(*) AS count FROM pension_audit_events WHERE event='USER_CONFIRMED'")[0].count, 1);
  db.close();
  const bytes = readFileSync(file).toString("latin1");
  assert.doesNotMatch(bytes, /Musterstraße|Versicherungsnummer|rawText|fullText/);
});
