import type { SourceConfig } from "./types.js";
export function sourceIsStale(source: SourceConfig | undefined, lastSuccess: string | null | undefined, now: Date): boolean {
  if (!source?.enabled || source.kind === "manual" || source.kind === "dkb-csv") return false;
  if (!lastSuccess) return true;
  const age = now.getTime() - new Date(lastSuccess).getTime();
  const hours = source.kind === "dkb-fints" ? 7 * 24 : Math.max(1, source.scheduleHours ?? (source.kind === "solana" ? 6 : 24)) * 2;
  return !Number.isFinite(age) || age < 0 || age > hours * 3600_000;
}
