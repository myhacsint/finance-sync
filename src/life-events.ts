import { createHash } from "node:crypto";

export interface LifeEvent {
  id: string;
  name: string;
  startMonth: string;
  monthlyChangeMinor: number;
  createdAt: string;
}

export function createLifeEvent(
  name: string,
  startMonth: string,
  monthlyChangeMinor: number,
  now = new Date()
): LifeEvent {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) throw new Error("Name fehlt");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(startMonth)) throw new Error("Startmonat ungültig");
  if (!Number.isFinite(monthlyChangeMinor)) throw new Error("Betrag ungültig");
  return {
    id: `event-${createHash("sha256").update(`finance-hub:event:${trimmed}:${startMonth}:${now.toISOString()}`).digest("hex").slice(0, 16)}`,
    name: trimmed,
    startMonth,
    monthlyChangeMinor: Math.round(monthlyChangeMinor),
    createdAt: now.toISOString()
  };
}

export function lifeEventMonthlyDelta(events: LifeEvent[], month: string): number {
  return events
    .filter((event) => event.startMonth <= month)
    .reduce((sum, event) => sum + event.monthlyChangeMinor, 0);
}
