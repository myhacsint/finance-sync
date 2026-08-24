import assert from "node:assert/strict";
import test from "node:test";
import { buildDashboardStatus, type SourceStatusRow } from "./dashboard-status.js";
import type { AppConfig } from "./types.js";
import type { HealthReport } from "./health.js";

const config: AppConfig = {
  port: 8080,
  timezone: "Europe/Berlin",
  sources: [
    { id: "dkb-giro", kind: "enable-banking", enabled: true, owners: ["Privatperson"] },
    { id: "dkb-depots", kind: "dkb-fints", enabled: true, owners: ["Privatperson"] },
    {
      id: "sutor-riester",
      kind: "manual",
      enabled: true,
      owners: ["Privatperson"],
      settings: { manualWorkflow: { label: "Sutor Riester" } }
    },
    { id: "dkb-csv-private-owner", kind: "dkb-csv", enabled: false, owners: ["Privatperson"] }
  ]
};

const health: HealthReport = {
  status: "ok",
  database: "ok",
  sources: 4,
  warnings: [],
  critical: [],
  freeBytes: 600 * 1024 ** 3,
  backup: { status: "ok", lastSuccessAt: "2026-08-10T02:00:00.000Z" },
  archive: { status: "ok", freeBytes: 600 * 1024 ** 3, totalBytes: 1024 ** 4 },
  time: "2026-08-10T12:00:00.000Z"
};

const rows: SourceStatusRow[] = [
  { id: "dkb-giro", kind: "enable-banking", enabled: 1, state: "SUCCESS", message: "12 Buchungen neu", last_success_at: "2026-08-10T10:00:00.000Z" },
  { id: "dkb-depots", kind: "dkb-fints", enabled: 1, state: "SUCCESS", message: "7 Positionen neu", last_success_at: "2026-08-10T10:05:00.000Z" },
  { id: "sutor-riester", kind: "manual", enabled: 1, state: "WAITING_FOR_USER", message: "Werteingabe erforderlich" },
  { id: "dkb-csv-private-owner", kind: "dkb-csv", enabled: 0, state: "SUCCESS", message: "Historischer Import", last_success_at: "2026-07-01T10:00:00.000Z" }
];

test("Dashboard gruppiert aktuelle, manuelle und historische Quellen", () => {
  const result = buildDashboardStatus(rows, config, health, {
    "sutor-riester": "2026-07-17T23:59:59+02:00"
  });
  assert.equal(result.headline, "Alle automatischen Quellen sind aktuell");
  assert.deepEqual(result.summary, {
    automaticCurrent: 2,
    automaticTotal: 2,
    tasks: 1,
    historicalImports: 1
  });
  assert.equal(result.automatic[0].label, "DKB Giro");
  assert.equal(result.tasks[0].label, "Sutor Riester");
  assert.equal(result.tasks[0].valueDate, "2026-07-17T23:59:59+02:00");
  assert.doesNotMatch(JSON.stringify(result), /private-owner|Privatperson/);
});

test("Fehler in einer automatischen Quelle wird als Handlungsbedarf gezeigt", () => {
  const broken = rows.map((row) => row.id === "dkb-depots"
    ? { ...row, state: "ERROR" as const, message: "Verbindung fehlgeschlagen" }
    : row);
  const result = buildDashboardStatus(broken, config, { ...health, status: "critical" });
  assert.equal(result.headline, "Mindestens eine Quelle braucht Aufmerksamkeit");
  assert.equal(result.summary.tasks, 1);
  assert.equal(result.automatic[1].status, "error");
});

test("Freigabeaufgabe ist sichtbar gelb, auch wenn das System gesund ist", () => {
  const waiting = rows.map((row) => row.id === "dkb-depots"
    ? { ...row, state: "WAITING_FOR_USER" as const, message: "Freigabe erforderlich" }
    : row);
  const result = buildDashboardStatus(waiting, config, health);
  assert.equal(result.headline, "Eine Quelle wartet auf deine Freigabe");
  assert.equal(result.overall, "warning");
});
