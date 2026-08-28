import test from "node:test";
import assert from "node:assert/strict";
import { parseDrvPensionPages } from "./drv-pension-parser.js";
import { validatePensionFields } from "./drv-pension-validator.js";

const syntheticText = `
Renteninformation vom 15.08.2026
Ihre Daten wurden bis zum 31.12.2025 berücksichtigt.
Regulärer Rentenbeginn: 01.10.2045
Sie haben 40,0000 Entgeltpunkte erworben.
Bislang erworbene monatliche Regelaltersrente 1.600,00 EUR.
Prognose: voraussichtliche monatliche Regelaltersrente 2.900,00 EUR.
Aktueller Rentenwert: 40,00 EUR
`;

test("extracts all seven required DRV fields with provenance", () => {
  const fields = parseDrvPensionPages([{ page: 1, text: syntheticText, method: "native", confidence: 0.98 }]);
  assert.equal(fields.length, 7);
  assert.deepEqual(Object.fromEntries(fields.map((field) => [field.key, field.value])), {
    documentDate: "2026-08-15",
    dataThrough: "2025-12-31",
    pensionStart: "2045-10-01",
    earnedPoints: "40.0000",
    earnedMonthlyGrossMinor: "160000",
    projectedMonthlyGrossMinor: "290000",
    currentPensionValueMinor: "4000"
  });
  assert.ok(fields.every((field) => field.page === 1 && field.extractionMethod === "native"));
  assert.equal(validatePensionFields(fields).valid, true);
});

test("missing and ambiguous values remain blocking until reviewed", () => {
  const fields = parseDrvPensionPages([
    { page: 1, text: syntheticText, method: "ocr", confidence: 0.82 },
    { page: 2, text: "Aktueller Rentenwert: 41,00 EUR", method: "ocr", confidence: 0.82 }
  ]);
  const pensionValue = fields.find((field) => field.key === "currentPensionValueMinor")!;
  assert.ok(pensionValue.validatorCodes.includes("FIELD_AMBIGUOUS"));
  assert.equal(validatePensionFields(fields).valid, false);

  const missing = parseDrvPensionPages([{ page: 1, text: "Renteninformation vom 15.08.2026", method: "native", confidence: 0.98 }]);
  assert.ok(missing.some((field) => field.validatorCodes.includes("FIELD_MISSING")));
  assert.equal(validatePensionFields(missing).valid, false);
});

test("deterministic validators reject inconsistent points and chronology", () => {
  const fields = parseDrvPensionPages([{ page: 1, text: syntheticText, method: "native", confidence: 0.98 }]);
  fields.find((field) => field.key === "earnedMonthlyGrossMinor")!.value = "120000";
  fields.find((field) => field.key === "dataThrough")!.value = "2027-01-01";
  const validated = validatePensionFields(fields);
  assert.equal(validated.valid, false);
  assert.ok(validated.warnings.includes("POINTS_VALUE_MISMATCH"));
  assert.ok(validated.warnings.includes("DATA_AFTER_DOCUMENT"));
});
