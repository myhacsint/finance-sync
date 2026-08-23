export interface MonthVarianceInput {
  complete: boolean;
  pendingCardMinor: number;
  pendingCardLabel?: string | null;
  excludedIncomeMinor: number;
  workRegularMinor: number;
  workVariableMinor: number;
  typicalWorkRegularMinor: number | null;
  expensesMinor: number;
  typicalExpensesMinor: number | null;
}

export interface MonthVarianceReason {
  code: "incomplete" | "pending-card" | "unreviewed-income" | "extra-payroll" | "high-spend";
  label: string;
}

export function explainMonthVariance(input: MonthVarianceInput): MonthVarianceReason[] {
  const reasons: MonthVarianceReason[] = [];
  if (!input.complete) {
    reasons.push({ code: "incomplete", label: "Monat noch nicht abgeschlossen; zählt nicht in die Projektion." });
  }
  if (input.pendingCardMinor > 0) {
    const card = input.pendingCardLabel?.trim() || "Kreditkarte";
    reasons.push({
      code: "pending-card",
      label: `Offener ${card}-Stand ist als Summe enthalten, ohne Einzelkategorien.`
    });
  }
  if (input.excludedIncomeMinor > 0) {
    reasons.push({
      code: "unreviewed-income",
      label: "Noch nicht zugeordnete Einnahmen sind aus dem Saldo ausgeschlossen."
    });
  }
  const typicalWork = input.typicalWorkRegularMinor ?? 0;
  if (input.workVariableMinor > 0 && input.workVariableMinor >= Math.max(50_000, typicalWork * 0.5)) {
    reasons.push({
      code: "extra-payroll",
      label: "Zusätzliches Arbeitseinkommen in diesem Monat, etwa ein zweites Gehalt oder eine Einmalzahlung."
    });
  } else if (typicalWork > 0 && input.workRegularMinor >= typicalWork * 1.6) {
    reasons.push({
      code: "extra-payroll",
      label: "Arbeitseinkommen liegt deutlich über dem typischen Monat, wahrscheinlich zwei Gehälter."
    });
  }
  const typicalExpenses = input.typicalExpensesMinor ?? 0;
  if (typicalExpenses > 0 && input.expensesMinor >= typicalExpenses * 1.25) {
    reasons.push({
      code: "high-spend",
      label: "Ausgaben liegen deutlich über dem typischen Monat."
    });
  }
  return reasons;
}
