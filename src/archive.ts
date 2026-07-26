import { createHash } from "node:crypto";
import { existsSync, mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import type { FinanceDatabase } from "./database.js";

export function sha256(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

function safeSegment(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_");
}

export function archiveRaw(
  db: FinanceDatabase,
  archiveRoot: string,
  sourceId: string,
  payload: unknown,
  mediaType = "application/json"
): { hash: string; path: string } {
  const body = Buffer.isBuffer(payload)
    ? payload
    : Buffer.from(typeof payload === "string" ? payload : JSON.stringify(payload, null, 2));
  const hash = sha256(body);
  const now = new Date();
  const extension = mediaType.includes("json") ? "json" : mediaType.includes("pdf") ? "pdf" : "bin";
  const path = join(
    archiveRoot,
    "raw",
    safeSegment(sourceId),
    String(now.getUTCFullYear()),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    `${now.toISOString().replace(/[:.]/g, "-")}-${hash.slice(0, 16)}.${extension}`
  );
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) {
    const temp = `${path}.tmp-${process.pid}`;
    writeFileSync(temp, body, { flag: "wx", mode: 0o640 });
    renameSync(temp, path);
  }
  db.recordRaw(hash, sourceId, mediaType, relative(archiveRoot, path));
  return { hash, path };
}

export function writeAtomic(path: string, content: string | Buffer): void {
  mkdirSync(dirname(path), { recursive: true });
  const temp = `${path}.tmp-${process.pid}`;
  writeFileSync(temp, content, { mode: 0o640 });
  renameSync(temp, path);
}
