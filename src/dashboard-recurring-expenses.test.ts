import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDashboardRecurringExpenseDetail,
  buildDashboardRecurringExpenses,
  buildDashboardRecurringExpenseOptimizations,
  detectRecurringCandidates,
  recurringExpenseRange
} from "./dashboard-recurring-expenses.js";
import type { ActualSpendingRangeSnapshot, SpendingLine } from "./dashboard-spending.js";
import type { RecurringExpenseDecisionRecord } from "./types.js";

function line(
  id: string,
  date: string,
  amountMinor: number,
  options: Partial<SpendingLine> = {}
): SpendingLine {
  return {
    id,
    date,
    merchantKey: "merchant-service",
    merchant: "Beispielservice GmbH",
    notes: "",
    accountKey: "account",
    accountLabel: "Giro",
    categoryKey: "category-subscription",
    categoryLabel: "Abonnements",
    categorized: true,
    amountMinor,
    ...options
  };
}

function snapshot(lines: SpendingLine[]): ActualSpendingRangeSnapshot {
  return {
    startDate: "2024-02-01",
    endDate: "2026-07-31",
    generatedAt: "2026-08-14T08:00:00.000Z",
    lines,
    accounts: [{ key: "account", label: "Giro" }],
    catalog: []
  };
}

test("Auswertungsfenster endet am letzten vollständigen Monat", () => {
  assert.deepEqual(
    recurringExpenseRange(new Date("2026-08-14T08:00:00Z"), "Europe/Berlin"),
    { startDate: "2024-02-01", endDate: "2026-07-31", lastCompleteMonth: "2026-07" }
  );
});

test("stabile aktuelle Monatszahlung wird aus Einzelbuchungen erkannt", () => {
  const dates = [
    "2025-08-03", "2025-09-03", "2025-10-03", "2025-11-03",
    "2025-12-03", "2026-01-03", "2026-02-03", "2026-03-03",
    "2026-04-03", "2026-05-03", "2026-06-03", "2026-07-03"
  ];
  const input = snapshot(dates.map((date, index) =>
    line(`monthly-${index}`, date, index === 4 ? 1_050 : 1_000)
  ));
  const detected = detectRecurringCandidates(input);
  assert.equal(detected.candidates.length, 1);
  assert.equal(detected.candidates[0].rhythm.kind, "monatlich");
  assert.equal(detected.candidates[0].rhythm.typicalMinor, 1_000);
  const dashboard = buildDashboardRecurringExpenses(input, []);
  assert.equal(dashboard.summary.possible, 1);
  assert.equal(dashboard.candidates[0].statusLabel, "Mögliche regelmäßige Zahlung");
  assert.equal(dashboard.candidates[0].classification.value, "UNKLAR");
  assert.equal(dashboard.candidates[0].decisionLabEligible, false);
  assert.equal("totalMinor" in dashboard.summary, false);
});

test("vierteljährliche und jährliche Rhythmen bleiben getrennt", () => {
  const quarterly = ["2025-03-15", "2025-06-15", "2025-09-15", "2025-12-15", "2026-03-15", "2026-06-15"]
    .map((date, index) => line(`quarter-${index}`, date, 5_000, {
      merchantKey: "merchant-quarter",
      merchant: "Quartalsdienst AG"
    }));
  const annual = ["2025-06-20", "2026-06-20"]
    .map((date, index) => line(`annual-${index}`, date, 12_000, {
      merchantKey: "merchant-annual",
      merchant: "Jahresdienst AG"
    }));
  const result = detectRecurringCandidates(snapshot([...quarterly, ...annual]));
  assert.deepEqual(
    result.candidates.map((candidate) => candidate.rhythm.kind).sort(),
    ["jaehrlich", "vierteljaehrlich"]
  );
});

test("instabile, alte und hart ausgeschlossene Gruppen werden nicht Kandidat", () => {
  const dates = [
    "2025-08-03", "2025-09-03", "2025-10-03", "2025-11-03",
    "2025-12-03", "2026-01-03", "2026-02-03", "2026-03-03"
  ];
  const marketplace = dates.map((date, index) => line(`market-${index}`, date, 2_000, {
    merchantKey: "merchant-market",
    merchant: "Amazon Marketplace"
  }));
  const privateRows = dates.map((date, index) => line(`private-${index}`, date, 2_000, {
    merchantKey: "merchant-private",
    merchant: "Private Gegenpartei"
  }));
  const uncertain = dates.map((date, index) => line(`uncertain-${index}`, date, 2_000, {
    merchantKey: "merchant-uncertain",
    categorized: false,
    categoryLabel: "Ohne Kategorie"
  }));
  const cards = dates.map((date, index) => line(`card-${index}`, date, 2_000, {
    merchantKey: "merchant-card",
    categoryKey: "category-card",
    categoryLabel: "Kreditkarte historisch"
  }));
  const unstable = dates.map((date, index) => line(`unstable-${index}`, date, (index + 1) * 2_000, {
    merchantKey: "merchant-unstable"
  }));
  const result = detectRecurringCandidates(snapshot([
    ...marketplace, ...privateRows, ...uncertain, ...cards, ...unstable
  ]));
  assert.equal(result.candidates.length, 0);
  assert.deepEqual(result.excluded, {
    "marketplace-without-item-evidence": 1,
    "private-or-unusable": 1,
    "uncertain-assignment": 1,
    "historical-card-aggregate": 1
  });
});

test("Erstattung bleibt Ausnahme und Detail enthält nur pseudonyme Buchungsschlüssel", () => {
  const dates = [
    "2025-12-05", "2026-01-05", "2026-02-05", "2026-03-05",
    "2026-04-05", "2026-05-05", "2026-06-05", "2026-07-05"
  ];
  const input = snapshot([
    ...dates.map((date, index) => line(`payment-${index}`, date, 3_000)),
    line("refund", "2026-04-12", -500)
  ]);
  const candidate = detectRecurringCandidates(input).candidates[0];
  const detail = buildDashboardRecurringExpenseDetail(input, [], candidate.key)!;
  assert.equal(detail.candidate.observation.exceptions, 1);
  assert.equal(detail.payments.find((payment) => payment.amountMinor < 0)?.kind, "refund");
  assert.match(detail.payments[0].key, /^booking-[a-f0-9]{18}$/);
  assert.doesNotMatch(JSON.stringify(detail), /payment-0|account/);
});

test("Nutzerentscheidung wird nur bei passendem Beleg-Fingerprint angewendet", () => {
  const dates = [
    "2025-12-05", "2026-01-05", "2026-02-05", "2026-03-05",
    "2026-04-05", "2026-05-05", "2026-06-05", "2026-07-05"
  ];
  const input = snapshot(dates.map((date, index) => line(`payment-${index}`, date, 3_000)));
  const candidate = detectRecurringCandidates(input).candidates[0];
  const base: RecurringExpenseDecisionRecord = {
    candidateKey: candidate.key,
    decision: "GESTALTBAR",
    evidenceHash: candidate.evidenceHash,
    fingerprintVersion: 1,
    createdAt: "2026-08-14T09:00:00.000Z",
    updatedAt: "2026-08-14T09:00:00.000Z"
  };
  const confirmed = buildDashboardRecurringExpenses(input, [base], { review: "alle" });
  assert.equal(confirmed.candidates[0].reviewStatus, "bestaetigt");
  assert.equal(confirmed.candidates[0].decisionLabEligible, true);
  const stale = buildDashboardRecurringExpenses(input, [{ ...base, evidenceHash: "evidence-stale" }], { review: "alle" });
  assert.equal(stale.candidates[0].reviewStatus, "moeglich");
  assert.equal(stale.candidates[0].decision?.stale, true);
  assert.equal(stale.candidates[0].decisionLabEligible, false);
});

test("Optimierungsliste trennt geschätzte Jahreskosten von bestätigter Entlastung", () => {
  const dates = [
    "2025-12-05", "2026-01-05", "2026-02-05", "2026-03-05",
    "2026-04-05", "2026-05-05", "2026-06-05", "2026-07-05"
  ];
  const input = snapshot(dates.map((date, index) => line(`payment-${index}`, date, 3_000)));
  const candidate = detectRecurringCandidates(input).candidates[0];
  const decision: RecurringExpenseDecisionRecord = {
    candidateKey: candidate.key,
    decision: "VERMEIDBAR",
    evidenceHash: candidate.evidenceHash,
    fingerprintVersion: 1,
    createdAt: "2026-08-22T09:00:00.000Z",
    updatedAt: "2026-08-22T09:00:00.000Z"
  };
  const empty = buildDashboardRecurringExpenseOptimizations(input, [decision], []);
  assert.equal(empty.items[0].estimatedAnnualCostMinor, 36_000);
  assert.equal(empty.summary.expectedAnnualSavingsMinor, null);
  const planned = buildDashboardRecurringExpenseOptimizations(input, [decision], [{
    candidateKey: candidate.key,
    evidenceHash: candidate.evidenceHash,
    status: "GEPLANT",
    effectiveDate: "2026-12-01",
    expectedAnnualSavingsMinor: 30_000,
    priority: "HOCH",
    createdAt: "2026-08-22T10:00:00.000Z",
    updatedAt: "2026-08-22T10:00:00.000Z"
  }]);
  assert.equal(planned.summary.plannedOrCancelled, 1);
  assert.equal(planned.summary.expectedAnnualSavingsMinor, 30_000);
  assert.equal(planned.items[0].estimate, true);
});
