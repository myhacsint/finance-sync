import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FinanceDatabase } from "./database.js";
import { importBundle } from "./importer.js";
import { exportAll } from "./exporter.js";
import {
  findInternalTransferPairs,
  markInternalTransfers
} from "./reconcile.js";

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
