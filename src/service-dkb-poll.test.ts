import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const root = mkdtempSync(join(tmpdir(), "dkb-poll-"));
for (const dir of ["data", "archive", "inbox", "secrets", "backup"]) mkdirSync(join(root, dir));
process.env.FINANCE_DATA_DIR = join(root, "data");
process.env.FINANCE_ARCHIVE_DIR = join(root, "archive");
process.env.FINANCE_INBOX_DIR = join(root, "inbox");
process.env.FINANCE_SECRETS_DIR = join(root, "secrets");
process.env.FINANCE_BACKUP_DIR = join(root, "backup");
writeFileSync(join(root, "secrets", "dkb-fints-product-id"), "A".repeat(25));
writeFileSync(join(root, "secrets", "dkb-fints-user-id"), "test-user");
writeFileSync(join(root, "secrets", "dkb-fints-pin"), "test-pin");

const { FinanceDatabase } = await import("./database.js");
const { FinanceService } = await import("./service.js");
import type { DkbHelperOutput } from "./connectors/dkb-fints.js";

function setup() {
  const db = new FinanceDatabase(join(root, "data", `f-${Math.random().toString(36).slice(2)}.sqlite`));
  const config = {
    port: 0,
    timezone: "Europe/Berlin",
    sources: [{
      id: "dkb-depots",
      kind: "dkb-fints",
      enabled: true,
      settings: { accounts: [{ accountId: "dkb-depot-a", accountNumber: "123456789" }] }
    }]
  };
  const service = new FinanceService(db, config as never);
  // Fake bank: a dialog is only valid at its exact current message number;
  // replaying an older state is rejected like FinTS 9010.
  const bank = { msgno: 1, confirmedAfter: 4, polls: 0, calls: 0, rejected: 0 };
  const cont = () => ({ phase: "init", decoupled: true, accountIndex: 0, completed: [], msgno: bank.msgno });
  service.dkbRunner = async (input): Promise<DkbHelperOutput> => {
    bank.calls += 1;
    if (input.action === "fetch") {
      bank.msgno = 2;
      return { state: "WAITING_FOR_USER", message: "DKB-Freigabe erforderlich", decoupled: true, continuation: cont() };
    }
    if ((input.continuation as { msgno: number }).msgno !== bank.msgno) {
      bank.rejected += 1;
      throw new Error("FinTS 9010: Dialog-ID ungültig oder abgelaufen");
    }
    bank.polls += 1;
    bank.msgno += 1;
    if (bank.polls < bank.confirmedAfter) {
      return { state: "WAITING_FOR_USER", message: "DKB-Freigabe erforderlich", decoupled: true, continuation: cont() };
    }
    return { state: "SUCCESS", message: "ok", portfolios: [{
      accountId: "dkb-depot-a",
      capturedAt: "2026-11-20T10:00:00Z",
      rawMt535: [":16R:FIN\n:35B:ISIN DE0007164600\n:16S:FIN"],
      positions: [{
        isin: "DE0007164600", name: "SAP SE", quantity: "1", price: "100.00", priceCurrency: "EUR",
        marketValue: "100.00", marketValueCurrency: "EUR", valuationDate: "2026-11-20"
      }]
    }], clientData: "client-blob" };
  };
  return { db, service, bank };
}

test("mehrere WAITING-Polls speichern jeweils den neuen Dialogzustand, danach Erfolg ohne 9010", async () => {
  const { service, bank } = setup();
  service.dkbMinPollIntervalMs = 0;
  const first = await service.sync("dkb-depots");
  assert.equal(first.state, "WAITING_FOR_USER");
  for (let i = 0; i < 3; i += 1) {
    const poll = await service.continueDkbFints("dkb-depots");
    assert.equal(poll.state, "WAITING_FOR_USER", poll.message);
  }
  const done = await service.continueDkbFints("dkb-depots");
  assert.equal(done.state, "SUCCESS", done.message);
  assert.equal(bank.rejected, 0);
  assert.ok(!service.db.getSetting("dkb-fints:dkb-depots:continuation"));
});

test("zu schnelle UI-Polls erreichen die Bank nicht und lassen den Dialog unberührt", async () => {
  const { service, bank } = setup();
  service.dkbMinPollIntervalMs = 60_000;
  await service.sync("dkb-depots");
  assert.equal(bank.calls, 1);
  for (let i = 0; i < 5; i += 1) {
    const poll = await service.continueDkbFints("dkb-depots");
    assert.equal(poll.state, "WAITING_FOR_USER");
    assert.equal(poll.decoupled, true);
  }
  // A new sync while approval is open resumes instead of opening a second dialog.
  const again = await service.sync("dkb-depots");
  assert.equal(again.state, "WAITING_FOR_USER");
  assert.equal(bank.calls, 1);
  assert.equal(bank.rejected, 0);
  assert.ok(service.db.getSetting("dkb-fints:dkb-depots:continuation"));
});

const WARNING = [{ accountId: "dkb-depot-a", message: "FinTS 9010: Bank meldet 'Verarbeitungssystem nicht verfügbar'" }];
const WARNING_KEY = "dkb-fints:dkb-depots:turnover-warning";

function withWarnings(service: ReturnType<typeof setup>["service"], warnings: () => DkbHelperOutput["turnoverErrors"]) {
  const base = service.dkbRunner!;
  service.dkbRunner = async (input) => {
    const out = await base(input);
    return out.state === "SUCCESS" ? { ...out, turnoverErrors: warnings() } : out;
  };
}

test("HKWDU-Fehler (Continue-Pfad): Bestände gespeichert, Lauf SUCCESS, Warnung mit …Endziffern gespeichert", async () => {
  const { service } = setup();
  service.dkbMinPollIntervalMs = 0;
  withWarnings(service, () => WARNING);
  await service.sync("dkb-depots");
  let result = await service.continueDkbFints("dkb-depots");
  while (result.state === "WAITING_FOR_USER") result = await service.continueDkbFints("dkb-depots");
  assert.equal(result.state, "SUCCESS");
  assert.match(result.message, /^Depotbestände gespeichert \(\d+ neu\); Depotumsätze für Depot …789 nicht abrufbar: FinTS 9010: Bank meldet/);
  assert.ok(!result.message.includes("123456789"));
  const stored = JSON.parse(service.db.getSetting(WARNING_KEY)!) as { accounts: Array<{ accountId: string; since: string; lastAt: string; message: string }> };
  assert.equal(stored.accounts.length, 1);
  assert.equal(stored.accounts[0].accountId, "dkb-depot-a");
  assert.equal(stored.accounts[0].message, WARNING[0].message);
  assert.equal(service.db.getSetting("dkb-fints:dkb-depots:client"), "client-blob");
  assert.ok(!service.db.getSetting("dkb-fints:dkb-depots:continuation"));
});

test("HKWDU-Fehler (Sync-Pfad): SUCCESS, since bleibt beim zweiten Fehler, sauberer Lauf leert die Einstellung", async () => {
  const { service } = setup();
  let failing = true;
  service.dkbRunner = async () => ({
    state: "SUCCESS", message: "ok", clientData: "client-blob",
    turnoverErrors: failing ? WARNING : undefined,
    portfolios: [{
      accountId: "dkb-depot-a", capturedAt: "2026-11-20T10:00:00Z",
      rawMt535: [":16R:FIN\n:35B:ISIN DE0007164600\n:16S:FIN"],
      positions: [{ isin: "DE0007164600", name: "SAP SE", quantity: "1", price: "100.00", priceCurrency: "EUR",
        marketValue: "100.00", marketValueCurrency: "EUR", valuationDate: "2026-11-20" }]
    }]
  });
  const first = await service.sync("dkb-depots");
  assert.equal(first.state, "SUCCESS");
  assert.match(first.message, /Depot …789 nicht abrufbar/);
  const sinceFirst = (JSON.parse(service.db.getSetting(WARNING_KEY)!) as { accounts: Array<{ since: string }> }).accounts[0].since;
  // Backdate so a changed `since` would be visible.
  const backdated = "2026-10-01T00:00:00.000Z";
  service.db.setSetting(WARNING_KEY, JSON.stringify({ accounts: [{ accountId: "dkb-depot-a", since: backdated, lastAt: sinceFirst, message: "alt" }] }));
  const second = await service.sync("dkb-depots");
  assert.equal(second.state, "SUCCESS");
  const kept = (JSON.parse(service.db.getSetting(WARNING_KEY)!) as { accounts: Array<{ since: string; lastAt: string; message: string }> }).accounts[0];
  assert.equal(kept.since, backdated);
  assert.equal(kept.message, WARNING[0].message);
  failing = false;
  const clean = await service.sync("dkb-depots");
  assert.equal(clean.state, "SUCCESS");
  assert.doesNotMatch(clean.message, /nicht abrufbar/);
  assert.equal(service.db.getSetting(WARNING_KEY), "");
});
