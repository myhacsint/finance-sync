import {
  PENSION_FIELD_KEYS,
  PENSION_FIELD_META,
  type PensionExtractedField,
  type PensionFieldKey
} from "./pension-document-types.js";

function dateValue(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00Z`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function numeric(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validatePensionFields(input: PensionExtractedField[]): {
  fields: PensionExtractedField[];
  warnings: string[];
  valid: boolean;
} {
  const byKey = new Map(input.map((field) => [field.key, { ...field, validatorCodes: [...field.validatorCodes] }]));
  for (const key of PENSION_FIELD_KEYS) {
    if (!byKey.has(key)) {
      byKey.set(key, {
        key,
        label: PENSION_FIELD_META[key].label,
        value: "",
        unit: PENSION_FIELD_META[key].unit,
        page: 0,
        confidence: 0,
        confidenceLabel: "fehlt",
        extractionMethod: "manual",
        validatorCodes: ["FIELD_MISSING"],
        status: "EXTRACTED"
      });
    }
  }
  const field = (key: PensionFieldKey) => byKey.get(key)!;
  const mark = (key: PensionFieldKey, code: string) => {
    const item = field(key);
    if (!item.validatorCodes.includes(code)) item.validatorCodes.push(code);
    item.confidenceLabel = item.value ? "prüfen" : "fehlt";
  };

  for (const key of PENSION_FIELD_KEYS) {
    const item = field(key);
    if (!item.value) mark(key, "FIELD_MISSING");
    if (item.unit === "date" && item.value && dateValue(item.value) === null) mark(key, "DATE_INVALID");
    if (item.unit !== "date" && item.value && (numeric(item.value) === null || Number(item.value) <= 0)) {
      mark(key, "VALUE_INVALID");
    }
  }
  const documentDate = dateValue(field("documentDate").value);
  const dataThrough = dateValue(field("dataThrough").value);
  const pensionStart = dateValue(field("pensionStart").value);
  if (documentDate !== null && dataThrough !== null && dataThrough > documentDate) mark("dataThrough", "DATA_AFTER_DOCUMENT");
  if (documentDate !== null && pensionStart !== null && pensionStart <= documentDate) mark("pensionStart", "PENSION_NOT_FUTURE");

  const points = numeric(field("earnedPoints").value);
  const rentValueMinor = numeric(field("currentPensionValueMinor").value);
  const earnedMinor = numeric(field("earnedMonthlyGrossMinor").value);
  if (points !== null && rentValueMinor !== null && earnedMinor !== null) {
    const expected = points * rentValueMinor;
    const relative = Math.abs(expected - earnedMinor) / Math.max(1, earnedMinor);
    if (relative > 0.03) {
      mark("earnedPoints", "POINTS_VALUE_MISMATCH");
      mark("earnedMonthlyGrossMinor", "POINTS_VALUE_MISMATCH");
      mark("currentPensionValueMinor", "POINTS_VALUE_MISMATCH");
    }
  }
  const projected = numeric(field("projectedMonthlyGrossMinor").value);
  if (projected !== null && earnedMinor !== null && projected < earnedMinor) {
    mark("projectedMonthlyGrossMinor", "FORECAST_BELOW_EARNED");
  }

  const fields = PENSION_FIELD_KEYS.map((key) => field(key));
  const warnings = [...new Set(fields.flatMap((item) => item.validatorCodes))];
  const blocking = new Set([
    "FIELD_MISSING", "DATE_INVALID", "VALUE_INVALID", "DATA_AFTER_DOCUMENT",
    "PENSION_NOT_FUTURE", "POINTS_VALUE_MISMATCH", "FORECAST_BELOW_EARNED", "FIELD_AMBIGUOUS"
  ]);
  return { fields, warnings, valid: !fields.some((item) => item.validatorCodes.some((code) => blocking.has(code))) };
}
