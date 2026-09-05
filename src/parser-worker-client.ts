import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import type { CommandRunner, CommandResult } from "./pension-security.js";

/** Filesystem IPC to a network=none worker with no data or secret mounts. */
export const runParserWorker: CommandRunner = async (command, args, timeoutMs = 60_000) => {
  const root = process.env.FINANCE_PARSER_WORK_DIR;
  if (!root) throw new Error("SECURITY_PARSER_UNAVAILABLE");
  const queue = join(root, ".queue");
  try {
    if (Date.now() - statSync(join(queue, "heartbeat")).mtimeMs > 90_000) throw new Error();
  } catch { throw new Error("SECURITY_PARSER_UNAVAILABLE"); }
  mkdirSync(queue, { recursive: true, mode: 0o700 });
  const id = randomUUID();
  const request = join(queue, `${id}.request`);
  const result = join(queue, `${id}.result`);
  const expiresAt = Date.now() + timeoutMs;
  writeFileSync(`${request}.tmp`, JSON.stringify({ command, args, timeoutMs, expiresAt }), { flag: "wx", mode: 0o600 });
  renameSync(`${request}.tmp`, request);
  try {
    // Worker enforces the deadline, including while a request waits in the queue.
    while (Date.now() < expiresAt + 5000) {
      try {
        const output = JSON.parse(readFileSync(result, "utf8")) as CommandResult & { error?: string };
        if (output.error) throw Object.assign(new Error(output.error), { stderr: output.stderr });
        return output;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      await delay(80);
    }
    throw new Error("SECURITY_PARSER_TIMEOUT");
  } finally {
    for (const file of [request, result]) { try { unlinkSync(file); } catch {} }
  }
};
