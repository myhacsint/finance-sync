import { randomUUID } from "node:crypto";
import type { FireAssumptions } from "./fire-assumptions.js";
import type { PensionExtractedField, PensionFireImpact, PensionPreviewSummary } from "./pension-document-types.js";

function numberField(fields: PensionExtractedField[], key: PensionExtractedField["key"]): number {
  const value = Number(fields.find((field) => field.key === key)?.value);
  if (!Number.isFinite(value)) throw new Error("PENSION_FIELD_INVALID");
  return value;
}

export function pensionAssumptionsFromFields(
  fields: PensionExtractedField[],
  current: FireAssumptions
): FireAssumptions {
  const startValue = fields.find((field) => field.key === "pensionStart")?.value ?? "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(startValue);
  if (!match) throw new Error("PENSION_START_INVALID");
  const startYear = Number(match[1]);
  const startMonth = Number(match[2]);
  const earnedPoints = numberField(fields, "earnedPoints");
  const rentValueMinor = numberField(fields, "currentPensionValueMinor");
  const projectedMonthlyGrossMinor = numberField(fields, "projectedMonthlyGrossMinor");
  const projectedPoints = projectedMonthlyGrossMinor / rentValueMinor;
  const yearsToPension = Math.max(1, startYear - current.modelYear);
  const pointsPerYear = Math.max(0, (projectedPoints - earnedPoints) / yearsToPension);
  return {
    ...current,
    erikPointsBase: earnedPoints,
    erikPointsPerYear: pointsPerYear,
    rentValueMinor: Math.round(rentValueMinor),
    erikPensionAge: startYear - current.erikBirthYear,
    erikPensionStartMonth: startMonth
  };
}

export function monthlyPensionAtStartMinor(assumptions: FireAssumptions, exitAge: number | null): number | null {
  if (exitAge === null) return null;
  const exitYear = assumptions.erikBirthYear + exitAge;
  const points = assumptions.erikPointsBase
    + assumptions.erikPointsPerYear * Math.max(0, exitYear - assumptions.modelYear);
  return Math.round(points * assumptions.rentValueMinor * assumptions.erikNetFactor);
}

export function pensionImpact(
  targetAge: number,
  previous: { exitAge: number | null; requiredCapitalAtTargetMinor: number | null; assumptions: FireAssumptions },
  proposed: { exitAge: number | null; requiredCapitalAtTargetMinor: number | null; assumptions: FireAssumptions }
): PensionFireImpact {
  const previousPension = monthlyPensionAtStartMinor(previous.assumptions, previous.exitAge);
  const proposedPension = monthlyPensionAtStartMinor(proposed.assumptions, proposed.exitAge);
  const delta = (right: number | null, left: number | null) => right === null || left === null ? null : right - left;
  return {
    estimate: true,
    marker: "[SCHÄTZUNG]",
    targetAge,
    previous: {
      exitAge: previous.exitAge,
      requiredCapitalAtTargetMinor: previous.requiredCapitalAtTargetMinor,
      monthlyPensionAtStartMinor: previousPension
    },
    proposed: {
      exitAge: proposed.exitAge,
      requiredCapitalAtTargetMinor: proposed.requiredCapitalAtTargetMinor,
      monthlyPensionAtStartMinor: proposedPension
    },
    delta: {
      exitAge: delta(proposed.exitAge, previous.exitAge),
      requiredCapitalAtTargetMinor: delta(proposed.requiredCapitalAtTargetMinor, previous.requiredCapitalAtTargetMinor),
      monthlyPensionAtStartMinor: delta(proposedPension, previousPension)
    },
    assumptions: [
      "Reale Euro des Modelljahres; keine doppelte Rentenanpassung.",
      `Nettofaktor ${Math.round(proposed.assumptions.erikNetFactor * 100)} % [SCHÄTZUNG].`,
      "Weitere Entgeltpunkte entstehen nur bis zum jeweiligen Exit [SCHÄTZUNG].",
      "Erwerbsminderungsrente ist nicht enthalten."
    ]
  };
}

export interface ConfirmedPensionRevision {
  revisionId: string;
  documentHash: string;
  confirmedAt: string;
  extractionVersion: string;
  fields: PensionExtractedField[];
  assumptions: FireAssumptions;
  impact: PensionFireImpact;
  status: "USER_CONFIRMED";
}

export function createConfirmedPensionRevision(
  preview: PensionPreviewSummary,
  assumptions: FireAssumptions,
  impact: PensionFireImpact,
  confirmedAt = new Date().toISOString()
): ConfirmedPensionRevision {
  return {
    revisionId: `pension-revision-${randomUUID()}`,
    documentHash: preview.documentHash,
    confirmedAt,
    extractionVersion: preview.extractionVersion,
    fields: preview.fields.map((field) => ({ ...field, status: "USER_CONFIRMED" })),
    assumptions,
    impact,
    status: "USER_CONFIRMED"
  };
}
