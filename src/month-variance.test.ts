import assert from "node:assert/strict";
import test from "node:test";
import { explainMonthVariance } from "./month-variance.js";

test("Monatsabweichung nennt offene Karte, unzugeordnetes Einkommen und Doppelgehalt", () => {
  const reasons = explainMonthVariance({
    complete: false,
    pendingCardMinor: 34_781,
    pendingCardLabel: "Miles & More Kreditkarte",
    excludedIncomeMinor: 120_000,
    workRegularMinor: 700_000,
    workVariableMinor: 650_000,
    typicalWorkRegularMinor: 700_000,
    expensesMinor: 900_000,
    typicalExpensesMinor: 650_000
  });
  assert.deepEqual(reasons.map((item) => item.code), [
    "incomplete",
    "pending-card",
    "unreviewed-income",
    "extra-payroll",
    "high-spend"
  ]);
  assert.match(reasons[1].label, /Miles & More/);
});

test("ein typischer vollständiger Monat bleibt ohne Begründung", () => {
  assert.deepEqual(explainMonthVariance({
    complete: true,
    pendingCardMinor: 0,
    excludedIncomeMinor: 0,
    workRegularMinor: 700_000,
    workVariableMinor: 0,
    typicalWorkRegularMinor: 700_000,
    expensesMinor: 650_000,
    typicalExpensesMinor: 640_000
  }), []);
});
