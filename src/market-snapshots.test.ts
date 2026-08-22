import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { FinanceDatabase } from "./database.js";
import {
  archiveGhostfolioMarketSnapshot,
  marketSnapshotDate
} from "./market-snapshots.js";

function database(): FinanceDatabase {
  const db = new FinanceDatabase(join(mkdtempSync(join(tmpdir(), "market-archive-")), "finance.sqlite"));
  db.importBalances([
    {
      sourceId: "pension-one",
      accountId: "contract-one",
      capturedAt: "2026-07-17T22:00:00Z",
      amountMinor: 7_200_000n,
      currency: "EUR",
      rawHash: "pension"
    },
    {
      sourceId: "depot-one",
      accountId: "depot-account",
      capturedAt: "2026-08-21T08:00:00Z",
      amountMinor: 3_400_000n,
      currency: "EUR",
      rawHash: "depot"
    }
  ]);
  return db;
}

test("Marktwertstichtag folgt dem lokalen Kalendertag", () => {
  assert.equal(
    marketSnapshotDate(new Date("2026-08-21T22:30:00Z"), "Europe/Berlin"),
    "2026-08-22"
  );
});

test("tägliche Ghostfolio-Marktwerte werden idempotent je Konto archiviert", () => {
  const db = database();
  try {
    const first = archiveGhostfolioMarketSnapshot(db, {
      capturedAt: "2026-08-22T08:00:00Z",
      valuesByAccount: {
        "contract-one": 7_390_000,
        "depot-account": 3_500_000
      }
    }, "Europe/Berlin", new Date("2026-08-22T09:00:00Z"));
    const second = archiveGhostfolioMarketSnapshot(db, {
      capturedAt: "2026-08-22T12:00:00Z",
      valuesByAccount: {
        "contract-one": 7_400_000,
        "depot-account": 3_510_000
      }
    }, "Europe/Berlin", new Date("2026-08-22T13:00:00Z"));
    assert.deepEqual(first, { valuationDate: "2026-08-22", positions: 2 });
    assert.deepEqual(second, { valuationDate: "2026-08-22", positions: 2 });
    assert.equal(db.latestAssetMarketSnapshotDate(), "2026-08-22");
    assert.deepEqual(db.query(`
      SELECT source_id, amount_minor, captured_at
      FROM asset_market_snapshots ORDER BY source_id
    `).map((row) => ({ ...row })), [
      { source_id: "depot-one", amount_minor: 3_510_000, captured_at: "2026-08-22T12:00:00Z" },
      { source_id: "pension-one", amount_minor: 7_400_000, captured_at: "2026-08-22T12:00:00Z" }
    ]);
  } finally {
    db.close();
  }
});

test("nicht zugeordnete Ghostfolio-Konten werden nicht archiviert", () => {
  const db = database();
  try {
    assert.throws(() => archiveGhostfolioMarketSnapshot(db, {
      valuesByAccount: { "unknown-account": 100_000 }
    }, "Europe/Berlin", new Date("2026-08-22T09:00:00Z")), /unvollständig/);
    assert.equal(db.query("SELECT count(*) AS count FROM asset_market_snapshots")[0]?.count, 0);
  } finally {
    db.close();
  }
});

test("unvollständiger Tagesstand wird vollständig verworfen", () => {
  const db = database();
  try {
    assert.throws(() => archiveGhostfolioMarketSnapshot(db, {
      valuesByAccount: { "contract-one": 7_390_000 }
    }, "Europe/Berlin", new Date("2026-08-22T09:00:00Z"), [
      "contract-one",
      "depot-account"
    ]), /unvollständig/);
    assert.equal(db.query("SELECT count(*) AS count FROM asset_market_snapshots")[0]?.count, 0);
  } finally {
    db.close();
  }
});
