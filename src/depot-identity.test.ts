import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FinanceDatabase } from "./database.js";
import { normalizeDkbFintsBundle, type DkbHelperOutput } from "./connectors/dkb-fints.js";
import { depotEconomicActivityId, legacyNonrefActivityId } from "./depot-identity.js";
import type { SourceConfig } from "./types.js";

const source: SourceConfig = { id: "dkb-depots", kind: "dkb-fints", enabled: false,
  settings: { accounts: [{ accountId: "dkb-depot-a", accountNumber: "123456789" }] } };
const isin = "US0378331005";
const buy = { identity: null, isin, direction: "RECE" as const, quantity: "8", date: "2026-08-25", amount: "3880", currency: "EUR" };
const sell = { identity: null, isin, direction: "DELI" as const, quantity: "8", date: "2026-10-23", amount: "4592", currency: "EUR" };

function output(turnovers: NonNullable<DkbHelperOutput["portfolios"]>[number]["turnovers"]): DkbHelperOutput {
  return { state: "SUCCESS", message: "ok", portfolios: [{ accountId: "dkb-depot-a",
    capturedAt: "2026-11-02T08:29:00Z", rawMt535: ["raw"], positions: [], turnovers }] };
}

test("NONREF buy and sell of one ISIN import as two depot turnovers", () => {
  const db = new FinanceDatabase(":memory:");
  try {
    const first = normalizeDkbFintsBundle(source, output([buy])).activities ?? [];
    assert.equal(db.importActivities(first), 1);
    const later = normalizeDkbFintsBundle(source, output([buy, sell])).activities ?? [];
    assert.notEqual(later[0].sourceActivityId, later[1].sourceActivityId);
    assert.equal(db.importActivities(later), 1);
    assert.equal(db.importActivities(later), 0, "re-fetch is idempotent");
    assert.equal(db.query("SELECT COUNT(*) AS n FROM investment_activities")[0].n, 2);
  } finally { db.close(); }
});

test("identical NONREF partial executions stay separate and stable", () => {
  const db = new FinanceDatabase(":memory:");
  try {
    const items = normalizeDkbFintsBundle(source, output([buy, { ...buy }])).activities ?? [];
    assert.notEqual(items[0].sourceActivityId, items[1].sourceActivityId);
    assert.equal(db.importActivities(items), 2);
    assert.equal(db.importActivities(normalizeDkbFintsBundle(source, output([buy, { ...buy }])).activities ?? []), 0);
  } finally { db.close(); }
});

test("quantity formatting does not change the NONREF identity", () => {
  const a = normalizeDkbFintsBundle(source, output([buy])).activities?.[0];
  const b = normalizeDkbFintsBundle(source, output([{ ...buy, quantity: "8.000" }])).activities?.[0];
  assert.equal(a?.sourceActivityId, b?.sourceActivityId);
});

test("real bank references keep their previous identity and conflict guard", () => {
  const db = new FinanceDatabase(":memory:");
  try {
    const identity = "a".repeat(64);
    const items = normalizeDkbFintsBundle(source, output([{ ...buy, identity }])).activities ?? [];
    assert.equal(db.importActivities(items), 1);
    const changed = normalizeDkbFintsBundle(source, output([{ ...buy, identity, quantity: "9" }])).activities ?? [];
    assert.throws(() => db.importActivities(changed), /Widersprüchlicher Depotumsatz/);
  } finally { db.close(); }
});

test("missing identity field fails closed", () => {
  const broken = { ...buy } as Record<string, unknown>;
  delete broken.identity;
  assert.throws(() => normalizeDkbFintsBundle(source, output([broken as typeof buy])), /Ungültiger DKB-Depotumsatz/);
});

test("migration re-keys legacy NONREF rows so the next fetch adds only the sale", () => {
  const dir = mkdtempSync(join(tmpdir(), "finance-nonref-"));
  const file = join(dir, "finance.sqlite");
  try {
    const legacy = new FinanceDatabase(file);
    const legacyId = legacyNonrefActivityId("dkb-depot-a", isin);
    legacy.importActivities([{ sourceId: "dkb-depots", sourceActivityId: legacyId, accountId: "dkb-depot-a",
      occurredAt: "2026-08-25", type: "DEPOT_RECE", symbol: isin, quantityAtomic: "8", atomicDecimals: 0,
      amountMinor: 388000n, currency: "EUR", rawHash: "synthetic" }]);
    legacy.importActivities([{ sourceId: "other", sourceActivityId: "untouched", accountId: "x",
      occurredAt: "2026-08-25", type: "DEPOT_RECE", symbol: isin, quantityAtomic: "1", atomicDecimals: 0,
      rawHash: "synthetic" }]);
    legacy.db.exec("DELETE FROM schema_migrations WHERE version=2; PRAGMA user_version=1");
    const legacyRowId = legacy.query("SELECT id FROM investment_activities WHERE source_id='dkb-depots'")[0].id;
    legacy.close();

    const db = new FinanceDatabase(file);
    try {
      const row = db.query("SELECT id, source_activity_id, identity_key FROM investment_activities WHERE source_id='dkb-depots'")[0];
      const expected = depotEconomicActivityId({ accountId: "dkb-depot-a", symbol: isin, type: "DEPOT_RECE",
        occurredAt: "2026-08-25", quantityAtomic: "8", atomicDecimals: 0, amountMinor: 388000n, currency: "EUR" }, 0);
      assert.equal(row.id, legacyRowId, "row id (settlement confirmations) is preserved");
      assert.equal(row.source_activity_id, expected);
      assert.equal(row.identity_key, `dkb-depots:id:${expected}`);
      assert.equal(db.query("SELECT source_activity_id FROM investment_activities WHERE source_id='other'")[0].source_activity_id, "untouched");
      assert.equal(db.importActivities(normalizeDkbFintsBundle(source, output([buy, sell])).activities ?? []), 1);
      assert.equal(db.query("SELECT COUNT(*) AS n FROM investment_activities WHERE source_id='dkb-depots'")[0].n, 2);
    } finally { db.close(); }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
