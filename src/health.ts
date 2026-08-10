import { existsSync, statfsSync, statSync } from "node:fs";
import { join } from "node:path";
import type { AppConfig } from "./types.js";
import type { FinanceDatabase } from "./database.js";
import { paths } from "./config.js";

export interface HealthReport {
  status: "ok" | "warning" | "critical";
  database: "ok";
  sources: number;
  warnings: string[];
  critical: string[];
  freeBytes: number;
  backup: {
    status: "ok" | "warning" | "critical";
    lastSuccessAt?: string;
  };
  archive: {
    status: "ok" | "warning" | "critical";
    freeBytes: number;
    totalBytes: number;
  };
  time: string;
}

export function buildHealth(db: FinanceDatabase, config: AppConfig): HealthReport {
  const rows = db.listSources();
  const warnings: string[] = [];
  const critical: string[] = [];
  const now = Date.now();
  for (const row of rows) {
    if (!row.enabled) continue;
    if (row.state === "ERROR") critical.push(`${row.id}: ${row.message ?? "Fehler"}`);
    const source = config.sources.find((item) => item.id === row.id);
    if (source?.kind === "dkb-fints") {
      const basis = row.last_success_at ?? row.last_attempt_at;
      if (basis) {
        const days = (now - new Date(String(basis)).getTime()) / 86_400_000;
        if (days >= 10) critical.push(`${row.id}: seit ${Math.floor(days)} Tagen kein Erfolg`);
        else if (days >= 7) warnings.push(`${row.id}: seit ${Math.floor(days)} Tagen kein Erfolg`);
      }
    }
    const expiry = db.getSetting(`enable-banking:${row.id}:consent-expires`)
      ?? source?.settings?.consentExpiresAt;
    if (typeof expiry === "string") {
      const days = (new Date(expiry).getTime() - now) / 86_400_000;
      if (days <= 3) critical.push(`${row.id}: PSD2-Zustimmung läuft in ${Math.ceil(days)} Tagen ab`);
      else if (days <= 14) warnings.push(`${row.id}: PSD2-Zustimmung läuft in ${Math.ceil(days)} Tagen ab`);
    }
  }
  const backupMarker = join(paths.backup, "last-success");
  let backupStatus: HealthReport["backup"]["status"] = "ok";
  let backupLastSuccessAt: string | undefined;
  if (!existsSync(backupMarker)) {
    warnings.push("Noch kein erfolgreicher Finance-Hub-Backup-Lauf sichtbar");
    backupStatus = "warning";
  } else {
    const backupMtime = statSync(backupMarker).mtimeMs;
    backupLastSuccessAt = new Date(backupMtime).toISOString();
    const backupDays = (now - backupMtime) / 86_400_000;
    if (backupDays > 2) {
      critical.push(`Letztes Backup ist ${Math.floor(backupDays)} Tage alt`);
      backupStatus = "critical";
    } else if (backupDays > 1.25) {
      warnings.push("Letztes Backup ist älter als 30 Stunden");
      backupStatus = "warning";
    }
  }
  const fs = statfsSync(paths.archive);
  const freeBytes = Number(fs.bavail) * Number(fs.bsize);
  const totalBytes = Number(fs.blocks) * Number(fs.bsize);
  let archiveStatus: HealthReport["archive"]["status"] = "ok";
  if (freeBytes < 10 * 1024 ** 3 || freeBytes / totalBytes < 0.05) {
    critical.push("Kritisch wenig freier Speicher im Finanzarchiv");
    archiveStatus = "critical";
  } else if (freeBytes / totalBytes < 0.1) {
    warnings.push("Weniger als 10 Prozent freier Speicher im Finanzarchiv");
    archiveStatus = "warning";
  }
  return {
    status: critical.length ? "critical" : warnings.length ? "warning" : "ok",
    database: "ok",
    sources: rows.length,
    warnings,
    critical,
    freeBytes,
    backup: {
      status: backupStatus,
      lastSuccessAt: backupLastSuccessAt
    },
    archive: {
      status: archiveStatus,
      freeBytes,
      totalBytes
    },
    time: new Date().toISOString()
  };
}
