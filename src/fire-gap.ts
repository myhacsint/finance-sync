export interface FireGapClose {
  targetAge: number;
  currentExitAge: number | null;
  requiredAnnualMinor: number | null;
  requiredMonthlyMinor: number | null;
  confirmedAnnualMinor: number;
  remainingAnnualMinor: number | null;
  remainingMonthlyMinor: number | null;
}

export function fireGapClose(input: {
  targetAge: number;
  selectedRecurringAnnualSavingsMinor: number;
  currentExitAge: number | null;
  annualGapToTargetMinor: number | null;
}): FireGapClose {
  const requiredAnnualMinor = input.annualGapToTargetMinor;
  const confirmedAnnualMinor = Math.max(0, input.selectedRecurringAnnualSavingsMinor);
  const remainingAnnualMinor = requiredAnnualMinor === null
    ? null
    : Math.max(0, requiredAnnualMinor - confirmedAnnualMinor);
  return {
    targetAge: input.targetAge,
    currentExitAge: input.currentExitAge,
    requiredAnnualMinor,
    requiredMonthlyMinor: requiredAnnualMinor === null ? null : Math.round(requiredAnnualMinor / 12),
    confirmedAnnualMinor,
    remainingAnnualMinor,
    remainingMonthlyMinor: remainingAnnualMinor === null ? null : Math.round(remainingAnnualMinor / 12)
  };
}
