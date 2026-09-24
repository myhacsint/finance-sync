import { test } from "node:test";
import assert from "node:assert/strict";
import { BrowserSessions, SESSION_SECONDS, TRUSTED_SECONDS } from "./browser-sessions.js";

test("trusted sessions survive service reconstruction, but expire and are revocable individually", () => {
  let value: string | undefined;
  const store = { getSetting: () => value, setSetting: (_key: string, next: string) => { value = next; } };
  const first = new BrowserSessions(store);
  const id = first.create("synthetic-admin", 1000, true);
  const other = first.create("synthetic-admin", 1000, true);
  const cookie = `finance_session=${id}`;
  assert.ok(!value!.includes(id) && !value!.includes("synthetic-admin"));
  const restarted = new BrowserSessions(store);
  assert.equal(restarted.valid(cookie, "synthetic-admin", 1000 + SESSION_SECONDS * 1000), true);
  assert.equal(restarted.valid(cookie, "synthetic-admin", 1000 + TRUSTED_SECONDS * 1000), false);
  assert.equal(restarted.valid(cookie, "rotated-admin", 2000), false);
  const row = restarted.list(cookie, "synthetic-admin", 2000).find(s => s.current)!;
  assert.ok(row.trusted);assert.notEqual(row.id, id);
  assert.equal(restarted.valid(`finance_session=${row.id}`, "synthetic-admin", 2000), false);
  restarted.revoke(row.id);
  assert.equal(first.valid(cookie, "synthetic-admin", 2000), false);
  assert.equal(first.valid(`finance_session=${other}`, "synthetic-admin", 2000), true);
});

test("viewer role persists, legacy rows default to admin and rotation invalidates both", () => {
  let value: string | undefined;
  const store = { getSetting: () => value, setSetting: (_key: string, next: string) => { value = next; } };
  const sessions = new BrowserSessions(store);
  const viewer = sessions.create("synthetic", 1000, true, "viewer");
  assert.equal(new BrowserSessions(store).role(`finance_session=${viewer}`, "synthetic", 2000), "viewer");
  assert.equal(sessions.role(`finance_session=${viewer}`, "rotated", 2000), undefined);
  const legacy = sessions.create("synthetic", 1000);
  value = value!.replace(/,"role":"admin"/g, "");
  assert.equal(new BrowserSessions(store).role(`finance_session=${legacy}`, "synthetic", 2000), "admin");
});

test("short sessions stay short, corrupt state fails closed, capacity is bounded", () => {
  let value: string | undefined;
  const store = { getSetting: () => value, setSetting: (_key: string, next: string) => { value = next; } };
  const sessions = new BrowserSessions(store);
  const id = sessions.create("synthetic", 1000);
  assert.equal(sessions.valid(`finance_session=${id}`, "synthetic", 1000 + SESSION_SECONDS * 1000), false);
  for(let n=0;n<105;n++)sessions.create("synthetic",1000,true);
  assert.equal(sessions.list(undefined,"synthetic",2000).length,100);
  value = "broken";
  assert.equal(sessions.valid(`finance_session=${id}`,"synthetic",2000),false);
  value = '[{}]';assert.deepEqual(sessions.list(undefined,"synthetic",2000),[]);
});
