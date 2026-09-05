import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { BrowserSessions } from "./browser-sessions.js";
import { migrateSchema } from "./schema-migrations.js";
import { csvCell } from "./exporter.js";
import { readActualOverview } from "./dashboard-overview.js";
import { readActualSpendingRange } from "./dashboard-spending.js";
import { reconcileOverviewHistory } from "./overview-history.js";
import type { DashboardOverview } from "./dashboard-overview.js";
import type { DashboardWealthHistory } from "./dashboard-wealth-history.js";
import { FinanceDatabase } from "./database.js";
import { PublishJournal } from "./publish-journal.js";
import { sourceIsStale } from "./source-freshness.js";

test("browser sessions expire and token rotation revokes access", () => {
  const sessions = new BrowserSessions();
  const id = sessions.create("synthetic", 1000);
  assert.equal(sessions.valid(`finance_session=${id}`, "synthetic", 2000), true);
  assert.equal(sessions.valid(`finance_session=${id}`, "rotated", 2000), false);
  assert.equal(sessions.valid(`finance_session=${id}`, "synthetic", 1000 + 8 * 3600_000), false);
});

test("freshness uses source interval rather than historical SUCCESS alone", () => {
  const source={id:"synthetic",kind:"solana" as const,enabled:true,scheduleHours:6};
  const now=new Date("2026-09-05T12:00:00Z");
  assert.equal(sourceIsStale(source,"2026-09-05T06:00:00Z",now),false);
  assert.equal(sourceIsStale(source,"2026-09-04T06:00:00Z",now),true);
  assert.equal(sourceIsStale(source,undefined,now),true);
  assert.equal(sourceIsStale({...source,kind:"manual"},undefined,now),false);
});

test("schema migrations roll back failures and reject newer schemas", () => {
  const db = new DatabaseSync(":memory:");
  try {
    assert.throws(() => migrateSchema(db, [{ version: 1, name: "fail", up() { db.exec("CREATE TABLE should_not_exist(id TEXT)"); throw new Error("fail"); } }]));
    assert.equal(db.prepare("SELECT name FROM sqlite_master WHERE name='should_not_exist'").get(), undefined);
    migrateSchema(db, [{ version: 1, name: "baseline", up() { db.exec("CREATE TABLE sample(id TEXT)"); } }]);
    assert.throws(() => migrateSchema(db, []), /neuer/);
    assert.equal(db.prepare("SELECT count(*) AS n FROM schema_migrations").get()?.n, 1);
  } finally { db.close(); }
});

test("a failed bundle rolls back transactions, balances and holdings together", () => {
  const db = new FinanceDatabase(":memory:");
  try {
    assert.throws(() => db.atomic(() => {
      db.importTransactions([{ sourceId:"test",sourceTransactionId:"t1",accountId:"a",bookedAt:"2026-08-01",amountMinor:-100n,currency:"EUR",rawHash:"synthetic" }]);
      db.setSetting("atomic-test","must roll back");
      throw new Error("synthetic holdings failure");
    }));
    assert.equal(db.query("SELECT count(*) AS n FROM transactions")[0].n, 0);
    assert.equal(db.getSetting("atomic-test"), undefined);
  } finally { db.close(); }
});

test("history and comparison use one dated basis and reject partial baselines", () => {
  const overview = { generatedAt:"2026-08-31T22:30:00Z",totalMinor:120000,
    cash:{amountMinor:40000}, investments:{amountMinor:80000},
    comparison:{effectiveDate:"2026-08-31"},
    cashflow:{months:[{key:"2026-09",partial:true,incomeMinor:10000,spentMinor:6000}]}
  } as DashboardOverview;
  const history = {points:[{date:"2026-08-31",cashMinor:30000,investmentsMinor:70000,totalMinor:100000,quality:"reconstructed"}]} as DashboardWealthHistory;
  const output = reconcileOverviewHistory(overview,history);
  assert.equal(output.comparison.previousTotalMinor,100000);
  assert.equal(output.wealthBridge?.valuationAndOtherMinor,16000);
  assert.equal(output.wealthBridge?.month,"2026-09");
  history.points[0].quality="partial";
  assert.equal(reconcileOverviewHistory(overview,history).comparison.previousTotalMinor,null);
  assert.equal(reconcileOverviewHistory(overview).wealthBridge,undefined);
});

test("spreadsheet-safe export escapes formulas only in text; machine CSV stays exact", () => {
  for (const text of ["=1+1", "+1", "@SUM(A1)", " -1"]) {
    assert.equal(csvCell(text), text);
    assert.equal(csvCell(text, true), `'${text}`);
  }
  assert.equal(csvCell(-500, true), "-500");
});

test("delivery failure survives restart and retry records successful completion without error payloads", async () => {
  const db = new FinanceDatabase(":memory:");
  try {
    const first = new PublishJournal(db,"synthetic",{raw:{}});
    await assert.rejects(first.stage("actual",async()=>{throw new Error("private error body");}));
    const failed = db.getSetting(first.key)!;
    assert.match(failed,/"ERROR"/);
    assert.doesNotMatch(failed,/private error/);
    const retry = new PublishJournal(db,"synthetic",{raw:{}});
    await retry.stage("actual",async()=>1);
    retry.complete();
    assert.equal(JSON.parse(db.getSetting(retry.key)!).state,"SUCCESS");
    assert.equal(JSON.parse(db.getSetting(retry.key)!).attempts,2);
  } finally { db.close(); }
});

test("overview and detail agree with uncategorized expenses, refunds, income and transfers", async () => {
  const api = {
    async init() {}, async downloadBudget() {}, async shutdown() {},
    async getAccounts() { return [{ id: "a", name: "Test Giro" }]; },
    async getCategories() { return [{ id: "food", name: "Lebensmittel" }]; },
    async getPayees() { return []; },
    async getTransactions() { return [
      { id: "expense", amount: -10000, category: "food" },
      { id: "refund", amount: 2000, category: "food" },
      { id: "unknown", amount: -5000 },
      { id: "income", amount: 30000 },
      { id: "transfer", amount: -9000, transfer_id: "other" }
    ].map(t => ({ ...t, account: "a", date: "2026-08-15" })); }
  };
  const config = { enabled: true, serverUrl: "http://invalid", budgetId: "synthetic", dataDir: "unused", accountMap: {} };
  const options = { password: "synthetic", loadApi: async () => api };
  const now = new Date("2026-09-05T12:00:00Z");
  const overview = await readActualOverview(config, "Europe/Berlin", now, options);
  const detail = await readActualSpendingRange(config, "2026-08-01", "2026-08-31", now, options);
  assert.equal(overview.categoryTotalMinor, detail.lines.reduce((sum, line) => sum + line.amountMinor, 0));
  assert.equal(overview.categoryTotalMinor, 13000);
  assert.equal(overview.months.find(m => m.key === "2026-08")?.incomeMinor, 30000);
});
