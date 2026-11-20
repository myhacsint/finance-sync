import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { tmpdir } from "node:os";
import { paths } from "./config.js";
import type { FinanceDatabase } from "./database.js";
import { buildHealth } from "./health.js";
import type { AppConfig } from "./types.js";

const config: AppConfig = { port: 8080, timezone: "Europe/Berlin", sources: [] };
const db = {
  listSources: () => [],
  getSetting: () => undefined
} as unknown as FinanceDatabase;

function healthForWorker(worker: "missing" | "stale" | "fresh") {
  const root = mkdtempSync(join(tmpdir(), "finance-health-"));
  const previousWorkDir = process.env.FINANCE_PARSER_WORK_DIR;
  const previousArchive = paths.archive;
  const previousBackup = paths.backup;
  try {
    paths.archive = join(root, "archive");
    paths.backup = join(root, "backup");
    mkdirSync(paths.archive);
    mkdirSync(paths.backup);
    writeFileSync(join(paths.backup, "last-success"), "ok");
    if (worker === "missing") {
      delete process.env.FINANCE_PARSER_WORK_DIR;
    } else {
      const workDir = join(root, "parser-work");
      const heartbeat = join(workDir, ".queue", "heartbeat");
      mkdirSync(join(workDir, ".queue"), { recursive: true });
      writeFileSync(heartbeat, "ok");
      if (worker === "stale") {
        const staleAt = new Date(Date.now() - 91_000);
        utimesSync(heartbeat, staleAt, staleAt);
      }
      process.env.FINANCE_PARSER_WORK_DIR = workDir;
    }
    return buildHealth(db, config);
  } finally {
    if (previousWorkDir === undefined) delete process.env.FINANCE_PARSER_WORK_DIR;
    else process.env.FINANCE_PARSER_WORK_DIR = previousWorkDir;
    paths.archive = previousArchive;
    paths.backup = previousBackup;
    rmSync(root, { recursive: true, force: true });
  }
}

test("health reports a missing document-worker setting as a warning", () => {
  const report = healthForWorker("missing");
  assert.equal(report.status, "warning");
  assert.deepEqual(report.warnings, [
    "Isolierte Dokumenterkennung ist nicht konfiguriert; FINANCE_PARSER_WORK_DIR setzen"
  ]);
});

test("health reports a stale document-worker heartbeat as a warning", () => {
  const report = healthForWorker("stale");
  assert.equal(report.status, "warning");
  assert.deepEqual(report.warnings, [
    "Isolierte Dokumenterkennung nicht verfügbar; Dokument-Worker in Unraid prüfen"
  ]);
});

test("health is ok with a fresh document-worker heartbeat", () => {
  const report = healthForWorker("fresh");
  assert.equal(report.status, "ok");
  assert.deepEqual(report.warnings, []);
});

function healthWithTurnoverWarning(sinceDaysAgo: number, rawSetting?: string) {
  const root = mkdtempSync(join(tmpdir(), "finance-health-dkb-"));
  const previousArchive = paths.archive;
  const previousBackup = paths.backup;
  const previousWorkDir = process.env.FINANCE_PARSER_WORK_DIR;
  try {
    paths.archive = join(root, "archive");
    paths.backup = join(root, "backup");
    mkdirSync(paths.archive);
    mkdirSync(paths.backup);
    writeFileSync(join(paths.backup, "last-success"), "ok");
    const workDir = join(root, "parser-work");
    mkdirSync(join(workDir, ".queue"), { recursive: true });
    writeFileSync(join(workDir, ".queue", "heartbeat"), "ok");
    process.env.FINANCE_PARSER_WORK_DIR = workDir;
    const now = new Date().toISOString();
    const since = new Date(Date.now() - sinceDaysAgo * 86_400_000 - 60_000).toISOString();
    const dkbDb = {
      listSources: () => [{ id: "dkb-depots", enabled: 1, state: "SUCCESS", message: "ok", last_success_at: now, last_attempt_at: now }],
      getSetting: (key: string) => key === "dkb-fints:dkb-depots:turnover-warning"
        ? rawSetting ?? JSON.stringify({ accounts: [{ accountId: "a", since, lastAt: now, message: "FinTS 9010: Bank meldet 'x'" }] })
        : undefined
    } as unknown as FinanceDatabase;
    const dkbConfig = {
      ...config,
      sources: [{ id: "dkb-depots", kind: "dkb-fints", enabled: true, settings: { accounts: [{ accountId: "a", accountNumber: "1234567851" }] } }]
    } as unknown as AppConfig;
    return { report: buildHealth(dkbDb, dkbConfig), since };
  } finally {
    paths.archive = previousArchive;
    paths.backup = previousBackup;
    if (previousWorkDir === undefined) delete process.env.FINANCE_PARSER_WORK_DIR;
    else process.env.FINANCE_PARSER_WORK_DIR = previousWorkDir;
    rmSync(root, { recursive: true, force: true });
  }
}

test("health: DKB turnover failure under 60 days is a warning, not critical", () => {
  const { report, since } = healthWithTurnoverWarning(10);
  assert.equal(report.status, "warning");
  assert.deepEqual(report.critical, []);
  assert.deepEqual(report.warnings, [
    `dkb-depots: Depotumsätze für Depot …851 seit ${since.slice(0, 10)} nicht abrufbar (FinTS 9010: Bank meldet 'x')`
  ]);
  assert.ok(!JSON.stringify(report).includes("1234567851"));
});

test("health: DKB turnover failure of 60 days or more is critical", () => {
  const { report } = healthWithTurnoverWarning(60);
  assert.equal(report.status, "critical");
  assert.deepEqual(report.critical, ["dkb-depots: Depotumsätze für Depot …851 seit 60 Tagen nicht abrufbar; Lücke ab 90 Tagen"]);
});

test("health: malformed DKB turnover state does not crash /health", () => {
  for (const raw of ["{not json", "null", "5", '{"accounts":[null,7,"x",{"since":"nope"}]}', '{"accounts":{"a":1}}']) {
    const { report } = healthWithTurnoverWarning(0, raw);
    assert.equal(report.status, "ok", raw);
    assert.deepEqual(report.critical, [], raw);
  }
});
