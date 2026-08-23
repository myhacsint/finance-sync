import assert from "node:assert/strict";
import test from "node:test";
import { fireGapClose } from "./fire-gap.js";

test("Lücke 66 gegen 60 nennt restliche Euro pro Monat nach bestätigten Hebeln", () => {
  const result = fireGapClose({
    targetAge: 60,
    selectedRecurringAnnualSavingsMinor: 240_000,
    currentExitAge: 66,
    annualGapToTargetMinor: 2_000_000
  });
  assert.equal(result.requiredMonthlyMinor, 166_667);
  assert.equal(result.confirmedAnnualMinor, 240_000);
  assert.equal(result.remainingAnnualMinor, 1_760_000);
  assert.equal(result.remainingMonthlyMinor, 146_667);
});
