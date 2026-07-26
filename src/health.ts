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
  if (!existsSync(backupMarker)) {
    warnings.push("Noch kein erfolgreicher Finance-Hub-Backup-Lauf sichtbar");
  } else {
    const backupDays = (now - statSync(backupMarker).mtimeMs) / 86_400_000;
    if (backupDays > 2) critical.push(`Letztes Backup ist ${Math.floor(backupDays)} Tage alt`);
    else if (backupDays > 1.25) warnings.push("Letztes Backup ist älter als 30 Stunden");
  }
  const fs = statfsSync(paths.archive);
  const freeBytes = Number(fs.bavail) * Number(fs.bsize);
  const totalBytes = Number(fs.blocks) * Number(fs.bsize);
  if (freeBytes < 10 * 1024 ** 3 || freeBytes / totalBytes < 0.05) {
    critical.push("Kritisch wenig freier Speicher im Finanzarchiv");
  } else if (freeBytes / totalBytes < 0.1) {
    warnings.push("Weniger als 10 Prozent freier Speicher im Finanzarchiv");
  }
  return {
    status: critical.length ? "critical" : warnings.length ? "warning" : "ok",
    database: "ok",
    sources: rows.length,
    warnings,
    critical,
    freeBytes,
    time: new Date().toISOString()
  };
}
