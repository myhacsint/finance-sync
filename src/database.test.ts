import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FinanceDatabase } from "./database.js";
import { importBundle } from "./importer.js";
import { exportAll } from "./exporter.js";
import { markInternalTransfers } from "./reconcile.js";

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
  assert.equal(markInternalTransfers(db), 1);
  exportAll(db, root);
  const csv = readFileSync(join(root, "exports", "transactions.csv"), "utf8");
  assert.match(csv, /internal_transfer_id/);
  assert.equal(
    db.query("SELECT count(*) AS count FROM transactions WHERE internal_transfer_id IS NOT NULL")[0].count,
    2
  );
  db.close();
});
