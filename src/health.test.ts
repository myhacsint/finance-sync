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
