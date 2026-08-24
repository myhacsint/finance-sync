import type { AppConfig, SourceConfig, SourceKind, SyncState } from "./types.js";
import type { HealthReport } from "./health.js";

export interface SourceStatusRow {
  id: string;
  kind: SourceKind;
  enabled: boolean | number;
  state: SyncState;
  message?: string | null;
  last_attempt_at?: string | null;
  last_success_at?: string | null;
  next_due_at?: string | null;
}

export interface DashboardSource {
  id: string;
  label: string;
  kind: SourceKind;
  state: SyncState;
  status: "current" | "running" | "action" | "error" | "disabled";
  message: string;
  lastAttemptAt?: string;
  lastSuccessAt?: string;
  nextDueAt?: string;
  supportsDkbApproval: boolean;
}

export interface DashboardTask extends DashboardSource {
  valueDate?: string;
}

export interface DashboardStatus {
  generatedAt: string;
  overall: "ok" | "warning" | "critical";
  headline: string;
  summary: {
    automaticCurrent: number;
    automaticTotal: number;
    tasks: number;
    historicalImports: number;
  };
  tasks: DashboardTask[];
  automatic: DashboardSource[];
  historical: {
    count: number;
    lastSuccessAt?: string;
  };
  system: {
    financeSync: "ok" | "warning" | "critical";
    database: "ok";
    backup: "ok" | "warning" | "critical";
    backupLastSuccessAt?: string;
    archive: "ok" | "warning" | "critical";
    archiveFreeBytes: number;
    archiveTotalBytes: number;
  };
}

const labels: Record<string, string> = {
  "dkb-giro": "DKB Giro",
  "dkb-gemeinschaft": "DKB Gemeinschaftskonto",
  "dkb-depots": "DKB Depots",
  "comdirect-giro": "comdirect Giro",
  "comdirect-depot": "comdirect Depot",
  solana: "Solana"
};

const kindLabels: Record<SourceKind, string> = {
  "enable-banking": "Bankkonto",
  "dkb-csv": "Historischer Bankimport",
  comdirect: "comdirect Depot",
  "dkb-fints": "DKB Depots",
  solana: "Solana",
  manual: "Manueller Vertragsstand"
};

function settingString(source: SourceConfig | undefined, key: string): string | undefined {
  const value = source?.settings?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function sourceLabel(source: SourceConfig | undefined, row: SourceStatusRow): string {
  const workflow = source?.settings?.manualWorkflow as { label?: unknown } | undefined;
  const manualLabel = typeof workflow?.label === "string" ? workflow.label.trim() : "";
  return settingString(source, "displayName")
    ?? (manualLabel || labels[row.id] || kindLabels[row.kind]);
}

function sourceStatus(state: SyncState): DashboardSource["status"] {
  if (state === "SUCCESS" || state === "READY") return "current";
  if (state === "RUNNING") return "running";
  if (state === "ERROR") return "error";
  if (state === "DISABLED") return "disabled";
  return "action";
}

function defined(value: string | null | undefined): string | undefined {
  return value || undefined;
}

function toDashboardSource(
  row: SourceStatusRow,
  source: SourceConfig | undefined
): DashboardSource {
  return {
    id: row.id,
    label: sourceLabel(source, row),
    kind: row.kind,
    state: row.state,
    status: sourceStatus(row.state),
    message: row.message?.trim() || "Noch kein Abruf ausgeführt",
    lastAttemptAt: defined(row.last_attempt_at),
    lastSuccessAt: defined(row.last_success_at),
    nextDueAt: defined(row.next_due_at),
    supportsDkbApproval: row.kind === "dkb-fints"
  };
}

export function buildDashboardStatus(
  rows: SourceStatusRow[],
  config: AppConfig,
  health: HealthReport,
  manualValueDates: Record<string, string | undefined> = {}
): DashboardStatus {
  const configById = new Map(config.sources.map((source) => [source.id, source]));
  const sourceOrder = new Map(config.sources.map((source, index) => [source.id, index]));
  const enabled = rows
    .filter((row) => Boolean(row.enabled))
    .sort((left, right) =>
      (sourceOrder.get(left.id) ?? Number.MAX_SAFE_INTEGER)
      - (sourceOrder.get(right.id) ?? Number.MAX_SAFE_INTEGER)
    );
  const automatic = enabled
    .filter((row) => row.kind !== "manual")
    .map((row) => toDashboardSource(row, configById.get(row.id)));
  const manual = enabled
    .filter((row) => row.kind === "manual")
    .map((row) => ({
      ...toDashboardSource(row, configById.get(row.id)),
      valueDate: manualValueDates[row.id]
    }));
  const historicalRows = rows.filter((row) => !Boolean(row.enabled));
  const historicalLastSuccess = historicalRows
    .map((row) => row.last_success_at)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1);
  const automaticCurrent = automatic.filter((source) => source.status === "current").length;
  const automaticError = automatic.some((source) => source.status === "error");
  const automaticAction = automatic.some((source) => source.status === "action");
  const automaticRunning = automatic.some((source) => source.status === "running");
  const tasks = manual.length;
  const overall: DashboardStatus["overall"] = health.status === "critical" || automaticError
    ? "critical"
    : health.status === "warning" || automaticAction || automaticRunning || automaticCurrent < automatic.length
      ? "warning"
      : "ok";

  let headline = "Alle automatischen Quellen sind aktuell";
  if (health.status === "critical" || automaticError) {
    headline = "Mindestens eine Quelle braucht Aufmerksamkeit";
  } else if (automaticAction) {
    headline = "Eine Quelle wartet auf deine Freigabe";
  } else if (automaticRunning) {
    headline = "Daten werden gerade aktualisiert";
  } else if (automatic.length === 0) {
    headline = "Noch keine automatische Quelle aktiv";
  } else if (automaticCurrent < automatic.length || health.status === "warning") {
    headline = "Datenstatus mit Hinweisen";
  }

  return {
    generatedAt: health.time,
    overall,
    headline,
    summary: {
      automaticCurrent,
      automaticTotal: automatic.length,
      tasks,
      historicalImports: historicalRows.length
    },
    tasks: manual,
    automatic,
    historical: {
      count: historicalRows.length,
      lastSuccessAt: historicalLastSuccess
    },
    system: {
      financeSync: health.status,
      database: health.database,
      backup: health.backup.status,
      backupLastSuccessAt: health.backup.lastSuccessAt,
      archive: health.archive.status,
      archiveFreeBytes: health.archive.freeBytes,
      archiveTotalBytes: health.archive.totalBytes
    }
  };
}
