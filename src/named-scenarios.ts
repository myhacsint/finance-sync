import { createHash } from "node:crypto";
import { decisionLabInputs, type DecisionLabRequest } from "./dashboard-decision-lab.js";

export interface NamedScenario {
  id: string;
  name: string;
  inputs: ReturnType<typeof decisionLabInputs>;
  createdAt: string;
  updatedAt: string;
}

export function createNamedScenario(
  name: string,
  request: DecisionLabRequest,
  now = new Date()
): NamedScenario {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) throw new Error("Name fehlt");
  const timestamp = now.toISOString();
  const id = `scenario-${createHash("sha256")
    .update(`finance-hub:scenario:${trimmed}:${timestamp}`)
    .digest("hex")
    .slice(0, 16)}`;
  return {
    id,
    name: trimmed,
    inputs: decisionLabInputs(request),
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

export function parseNamedScenario(value: unknown): NamedScenario {
  const record = value as Partial<NamedScenario> | null;
  if (!record || typeof record !== "object") throw new Error("Szenario ungültig");
  if (!/^scenario-[a-f0-9]{16}$/.test(String(record.id ?? ""))) throw new Error("Szenario ungültig");
  if (!String(record.name ?? "").trim()) throw new Error("Name fehlt");
  return {
    id: record.id as string,
    name: String(record.name).trim().slice(0, 80),
    inputs: decisionLabInputs(record.inputs ?? {}),
    createdAt: String(record.createdAt ?? new Date().toISOString()),
    updatedAt: String(record.updatedAt ?? record.createdAt ?? new Date().toISOString())
  };
}
