import assert from "node:assert/strict";
import test from "node:test";
import { importMilesMoreStatement, previewMilesMoreWithActual } from "./miles-more-import.js";

const text = `
03.07.2026 06.07.2026 GITHUB, SAN FRANCISCO, CA USD -12,00 1,13744 -10,55
AUSLANDSEINSATZENTGELT -0,21
Saldo -10,76
`;

function fakeActual(extraMatches = 0) {
  const rows = new Map<string, Array<Record<string, unknown>>>([
    ["giro", [{ id: "bank-1", amount: -1076, date: "2026-08-06", transfer_id: null }]],
    ["card", []]
  ]);
  for (let index = 0; index < extraMatches; index += 1) {
    rows.set(`giro-${index}`, [{ id: `bank-extra-${index}`, amount: -1076, date: "2026-08-07", transfer_id: null }]);
  }
  const accounts = [
    { id: "giro", name: "Girokonto" },
    { id: "card", name: "Miles & More Kreditkarte" },
    ...Array.from({ length: extraMatches }, (_, index) => ({ id: `giro-${index}`, name: `Giro ${index}` }))
  ];
  return {
    rows,
    api: {
      async init() {}, async downloadBudget() {}, async shutdown() {}, async sync() {},
      async getAccounts() { return accounts; },
      async getCategories() { return [{ id: "homelab", name: "Homelab & IT" }]; },
      async getTransactions(accountId: string) { return (rows.get(accountId) ?? []) as never; },
      async getPayees() {
        return [
          { id: "to-card", name: "Transfer Kreditkarte", transfer_acct: "card" },
          { id: "to-giro", name: "Transfer Giro", transfer_acct: "giro" }
        ];
      },
      async importTransactions(accountId: string, transactions: Array<Record<string, unknown>>) {
        const target = rows.get(accountId) ?? [];
        for (const transaction of transactions) {
          if (target.some((item) => item.imported_id === transaction.imported_id)) continue;
          target.push({ ...transaction, id: `card-${target.length + 1}`, imported_id: transaction.imported_id, date: transaction.date });
        }
        rows.set(accountId, target);
        return { errors: [], added: transactions };
      },
      async updateTransaction(id: string, fields: Record<string, unknown>) {
        for (const list of rows.values()) {
          const row = list.find((item) => item.id === id);
          if (row) Object.assign(row, fields);
        }
      }
    }
  };
}

test("Miles & More Vorschau findet genau einen Giro-Ausgleich ohne zu schreiben", async () => {
  const fake = fakeActual();
  const result = await previewMilesMoreWithActual({
    text, statementDate: "2026-08-03", serverURL: "http://actual", budgetId: "budget", password: "secret",
    loadApi: async () => fake.api as never
  });
  assert.equal(result.settlement.status, "ready");
  assert.equal(result.settlement.sourceAccountName, "Girokonto");
  assert.equal(fake.rows.get("card")?.length, 0);
});

test("Miles & More Import verknüpft einen eindeutigen Ausgleich beidseitig", async () => {
  const fake = fakeActual();
  const result = await importMilesMoreStatement({
    text, statementDate: "2026-08-03", serverURL: "http://actual", budgetId: "budget", password: "secret",
    loadApi: async () => fake.api as never
  });
  assert.equal(result.settlement.status, "ready");
  const bank = fake.rows.get("giro")?.[0];
  const payment = fake.rows.get("card")?.find((item) => String(item.imported_id).startsWith("miles-more-payment:"));
  assert.equal(bank?.transfer_id, payment?.id);
  assert.equal(payment?.transfer_id, bank?.id);
});

test("Miles & More Import rät bei mehreren Ausgleichen nicht", async () => {
  const fake = fakeActual(1);
  const result = await importMilesMoreStatement({
    text, statementDate: "2026-08-03", serverURL: "http://actual", budgetId: "budget", password: "secret",
    loadApi: async () => fake.api as never
  });
  assert.equal(result.settlement.status, "ambiguous");
  assert.equal(fake.rows.get("card")?.some((item) => String(item.imported_id).startsWith("miles-more-payment:")), false);
});
