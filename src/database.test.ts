import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FinanceDatabase } from "./database.js";
import { createNamedScenario } from "./named-scenarios.js";
import { importBundle } from "./importer.js";
import { exportAll } from "./exporter.js";
import {
  findInternalTransferPairs,
  markInternalTransfers
} from "./reconcile.js";
import { manualSnapshotBundle } from "./connectors/manual.js";

test("wiederholter Import erzeugt keine Dubletten", () => {
  const root = mkdtempSync(join(tmpdir(), "finance-sync-"));
  const db = new FinanceDatabase(join(root, "finance.sqlite"));
  const transaction = {
    sourceId: "bank",
    sourceTransactionId: "tx-1",
    accountId: "giro",
    bookedAt: "2026-07-01",
    amountMinor: 1234n,
    currency: "EUR",
    rawHash: "abc"
  };
  const first = importBundle(db, root, "bank", {
    raw: { transaction: "tx-1" },
    transactions: [transaction]
  });
  const second = importBundle(db, root, "bank", {
    raw: { transaction: "tx-1" },
    transactions: [transaction]
  });
  assert.equal(first.transactions, 1);
  assert.equal(second.transactions, 0);
  assert.equal(db.query("SELECT count(*) AS count FROM transactions")[0].count, 1);
  db.close();
});

test("Entscheidungen zu regelmäßigen Ausgaben werden getrennt und idempotent gespeichert", () => {
  const root = mkdtempSync(join(tmpdir(), "finance-sync-recurring-decision-"));
  const db = new FinanceDatabase(join(root, "finance.sqlite"));
  const created = db.setRecurringExpenseDecision(
    "recurring-0123456789abcdef01",
    "GESTALTBAR",
    "evidence-0123456789abcdef0123",
    1,
    new Date("2026-08-14T10:00:00.000Z")
  );
  assert.equal(created.decision, "GESTALTBAR");
  const updated = db.setRecurringExpenseDecision(
    created.candidateKey,
    "VERMEIDBAR",
    created.evidenceHash,
    1,
    new Date("2026-08-14T11:00:00.000Z")
  );
  assert.equal(updated.decision, "VERMEIDBAR");
  assert.equal(updated.createdAt, created.createdAt);
  assert.equal(updated.updatedAt, "2026-08-14T11:00:00.000Z");
  assert.equal(db.listRecurringExpenseDecisions().length, 1);
  assert.equal(
    db.query("SELECT count(*) AS count FROM recurring_expense_decisions")[0].count,
    1
  );
  db.close();
});

test("Optimierungsmaßnahmen speichern nur abstrakte Entscheidung und Wirkung", () => {
  const root = mkdtempSync(join(tmpdir(), "finance-sync-recurring-optimization-"));
  const db = new FinanceDatabase(join(root, "finance.sqlite"));
  const created = db.setRecurringExpenseOptimization(
    "recurring-0123456789abcdef01",
    "evidence-0123456789abcdef0123",
    "GEPLANT",
    "2026-12-01",
    15_000,
    "HOCH",
    new Date("2026-08-22T10:00:00.000Z")
  );
  assert.equal(created.status, "GEPLANT");
  assert.equal(created.expectedAnnualSavingsMinor, 15_000);
  const updated = db.setRecurringExpenseOptimization(
    created.candidateKey,
    created.evidenceHash,
    "GEKUENDIGT",
    null,
    15_000,
    "HOCH",
    new Date("2026-08-22T11:00:00.000Z")
  );
  assert.equal(updated.createdAt, created.createdAt);
  assert.equal(updated.updatedAt, "2026-08-22T11:00:00.000Z");
  assert.deepEqual(
    Object.keys(updated).sort(),
    [
      "candidateKey", "createdAt", "effectiveDate", "evidenceHash",
      "expectedAnnualSavingsMinor", "priority", "status", "updatedAt"
    ].sort()
  );
  db.close();
});

test("Monatsabschluss friert Plan-vs-Ist und Prüfschritte ein", () => {
  const root = mkdtempSync(join(tmpdir(), "finance-sync-month-close-"));
  const db = new FinanceDatabase(join(root, "finance.sqlite"));
  db.closeMonth(
    "2026-07",
    "Karte vollständig",
    { actualNetMinor: 125_00, expectedNetMinor: -50_00, uncategorizedBookings: 0 },
    { payrollReviewed: true, cardReviewed: true },
    new Date("2026-08-24T12:00:00.000Z")
  );
  assert.deepEqual(db.listMonthCloses()[0], {
    month: "2026-07",
    note: "Karte vollständig",
    closedAt: "2026-08-24T12:00:00.000Z",
    snapshot: { actualNetMinor: 125_00, expectedNetMinor: -50_00, uncategorizedBookings: 0 },
    checklist: { payrollReviewed: true, cardReviewed: true }
  });
  db.close();
});

test("korrigierte Normalisierung aktualisiert denselben Saldo-Snapshot", () => {
  const root = mkdtempSync(join(tmpdir(), "finance-sync-balance-"));
  const db = new FinanceDatabase(join(root, "finance.sqlite"));
  const base = {
    sourceId: "bank",
    accountId: "account",
    capturedAt: "2026-07-27",
    amountMinor: 100n,
    currency: "EUR",
    rawHash: "same-raw"
  };

  db.importBalances([base]);
  db.importBalances([{ ...base, amountMinor: 200n }]);

  assert.equal(
    db.query("SELECT amount_minor FROM balances")[0].amount_minor,
    200
  );
  assert.equal(
    db.query("SELECT count(*) AS count FROM balances")[0].count,
    1
  );
  db.close();
});

test("manuelle Positionen bewahren exakten Quellkurs und ausgewiesenen Kurswert", () => {
  const root = mkdtempSync(join(tmpdir(), "finance-sync-holding-value-"));
  const db = new FinanceDatabase(join(root, "finance.sqlite"));

  db.importHoldings([{
    sourceId: "sutor-riester",
    accountId: "riester",
    capturedAt: "2026-03-31",
    symbol: "IE00BL25JN58",
    name: "Xtrackers MSCI World Min Vol ETF",
    quantityAtomic: "4336642",
    atomicDecimals: 4,
    priceAtomic: "491199",
    priceDecimals: 4,
    priceCurrency: "USD",
    marketValueMinor: 1852630n,
    marketValueCurrency: "EUR",
    owner: "Erik",
    rawHash: "statement"
  }]);

  const row = db.query(`
    SELECT price_atomic, price_decimals, price_currency,
      market_value_minor, market_value_currency
    FROM holdings
  `)[0];
  assert.deepEqual({ ...row }, {
    price_atomic: "491199",
    price_decimals: 4,
    price_currency: "USD",
    market_value_minor: 1852630,
    market_value_currency: "EUR"
  });
  db.close();
});

test("identischer manueller Stichtag wird auch bei anderem Rohbeleg erkannt", () => {
  const root = mkdtempSync(join(tmpdir(), "finance-sync-manual-equivalent-"));
  const db = new FinanceDatabase(join(root, "finance.sqlite"));
  const source = {
    id: "pension",
    kind: "manual" as const,
    enabled: true,
    owners: ["Person A"]
  };
  const snapshot = {
    accountId: "contract",
    capturedAt: "2026-07-24T23:59:59+02:00",
    amount: "100.00",
    currency: "EUR",
    owner: "Person A",
    holdings: [{
      symbol: "FUND",
      name: "Fund",
      quantityAtomic: "12345",
      atomicDecimals: 3,
      priceAtomic: "8100",
      priceDecimals: 2,
      priceCurrency: "EUR",
      marketValueMinor: "10000",
      marketValueCurrency: "EUR"
    }]
  };
  const first = manualSnapshotBundle(source, snapshot);
  importBundle(db, root, source.id, first);
  const second = manualSnapshotBundle(source, {
    ...snapshot,
    evidence: {
      type: "confirmed-pasted-text",
      sha256: "different",
      text: "different raw evidence"
    }
  });
  assert.equal(db.manualSnapshotState(source.id, second), "equivalent");
  assert.equal(
    db.manualSnapshotState(source.id, manualSnapshotBundle(source, {
      ...snapshot,
      amount: "101.00"
    })),
    "conflict"
  );
  db.close();
});

test("interne Überträge werden paarweise markiert und exportiert", () => {
  const root = mkdtempSync(join(tmpdir(), "finance-sync-"));
  const db = new FinanceDatabase(join(root, "finance.sqlite"));
  db.importTransactions([
    {
      sourceId: "bank",
      sourceTransactionId: "out",
      accountId: "a",
      bookedAt: "2026-07-01",
      amountMinor: -5000n,
      currency: "EUR",
      payee: "Erik",
      rawHash: "one"
    },
    {
      sourceId: "bank",
      sourceTransactionId: "in",
      accountId: "b",
      bookedAt: "2026-07-02",
      amountMinor: 5000n,
      currency: "EUR",
      rawHash: "two"
    }
  ]);
  const pairs = findInternalTransferPairs(db, ["Erik"]);
  assert.equal(markInternalTransfers(db, pairs), 1);
  exportAll(db, root);
  const csv = readFileSync(join(root, "exports", "transactions.csv"), "utf8");
  assert.match(csv, /internal_transfer_id/);
  assert.equal(
    db.query("SELECT count(*) AS count FROM transactions WHERE internal_transfer_id IS NOT NULL")[0].count,
    2
  );
  db.close();
});

test("mehrdeutige oder unbestätigte Transferkandidaten bleiben unmarkiert", () => {
  const root = mkdtempSync(join(tmpdir(), "finance-sync-ambiguous-"));
  const db = new FinanceDatabase(join(root, "finance.sqlite"));
  const base = {
    sourceId: "bank",
    bookedAt: "2026-07-01",
    currency: "EUR",
    rawHash: "raw"
  };
  db.importTransactions([
    {
      ...base,
      sourceTransactionId: "out",
      accountId: "a",
      amountMinor: -5000n,
      payee: "Erik"
    },
    {
      ...base,
      sourceTransactionId: "in-one",
      accountId: "b",
      amountMinor: 5000n
    },
    {
      ...base,
      sourceTransactionId: "in-two",
      accountId: "c",
      amountMinor: 5000n
    },
    {
      ...base,
      sourceTransactionId: "unrelated-out",
      accountId: "d",
      bookedAt: "2026-07-10",
      amountMinor: -3000n
    },
    {
      ...base,
      sourceTransactionId: "unrelated-in",
      accountId: "e",
      bookedAt: "2026-07-11",
      amountMinor: 3000n
    }
  ]);
  assert.equal(findInternalTransferPairs(db, ["Erik"]).length, 0);
  db.close();
});

test("Übertragshinweis wird erkannt, unterschiedliche Währungen jedoch nicht", () => {
  const root = mkdtempSync(join(tmpdir(), "finance-sync-transfer-word-"));
  const db = new FinanceDatabase(join(root, "finance.sqlite"));
  db.importTransactions([
    {
      sourceId: "bank",
      sourceTransactionId: "eur-out",
      accountId: "a",
      bookedAt: "2026-07-01",
      amountMinor: -5000n,
      currency: "EUR",
      memo: "Übertrag",
      rawHash: "eur-out"
    },
    {
      sourceId: "bank",
      sourceTransactionId: "eur-in",
      accountId: "b",
      bookedAt: "2026-07-02",
      amountMinor: 5000n,
      currency: "EUR",
      rawHash: "eur-in"
    },
    {
      sourceId: "bank",
      sourceTransactionId: "usd-out",
      accountId: "c",
      bookedAt: "2026-07-10",
      amountMinor: -3000n,
      currency: "USD",
      memo: "Transfer",
      rawHash: "usd-out"
    },
    {
      sourceId: "bank",
      sourceTransactionId: "eur-in-two",
      accountId: "d",
      bookedAt: "2026-07-11",
      amountMinor: 3000n,
      currency: "EUR",
      rawHash: "eur-in-two"
    }
  ]);
  const pairs = findInternalTransferPairs(db, []);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].left.sourceTransactionId, "eur-out");
  db.close();
});

test("benannte Szenarien bleiben persistiert und löschbar", () => {
  const root = mkdtempSync(join(tmpdir(), "finance-sync-scenarios-"));
  const db = new FinanceDatabase(join(root, "finance.sqlite"));
  const saved = db.saveNamedScenario(createNamedScenario("Abo weg", {
    monthlyChangeMinor: 20_000,
    fireTargetAge: 62
  }, new Date("2026-08-23T18:00:00.000Z")));
  assert.equal(db.listNamedScenarios()[0].name, "Abo weg");
  assert.equal(db.listNamedScenarios()[0].inputs.fireTargetAge, 62);
  assert.equal(db.deleteNamedScenario(saved.id), true);
  assert.equal(db.listNamedScenarios().length, 0);
  db.close();
});
