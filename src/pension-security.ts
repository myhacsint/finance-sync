import { execFile } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const MAX_SIGNATURE_AGE_MS = 72 * 60 * 60_000;

export interface CommandResult { stdout: string; stderr: string }
export type CommandRunner = (command: string, args: string[], timeoutMs?: number) => Promise<CommandResult>;

export const runBounded: CommandRunner = async (command, args, timeoutMs = 60_000) => {
  const result = await execFileAsync("/usr/bin/prlimit", [
    "--as=536870912", "--cpu=60", "--nproc=32", "--", command, ...args
  ], { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, encoding: "utf8" });
  return { stdout: result.stdout, stderr: result.stderr };
};

// Loading the official ClamAV signature set requires more address space than
// document parsing. Keep the scanner isolated with its own measured ceiling.
export const runClamBounded: CommandRunner = async (command, args, timeoutMs = 60_000) => {
  const result = await execFileAsync("/usr/bin/prlimit", [
    "--as=1610612736", "--cpu=60", "--nproc=32", "--", command, ...args
  ], { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024, encoding: "utf8" });
  return { stdout: result.stdout, stderr: result.stderr };
};

export function assertFreshClamDatabase(directory = process.env.FINANCE_CLAMAV_DATABASE_DIR || "/var/lib/clamav"): void {
  let newest = 0;
  try {
    for (const name of readdirSync(directory)) {
      if (!/\.(?:cvd|cld)$/i.test(name)) continue;
      newest = Math.max(newest, statSync(`${directory}/${name}`).mtimeMs);
    }
  } catch {
    throw new Error("SECURITY_SCANNER_UNAVAILABLE");
  }
  if (!newest || Date.now() - newest > MAX_SIGNATURE_AGE_MS) throw new Error("SECURITY_SIGNATURES_STALE");
}

export async function scanMalware(path: string, runner: CommandRunner = runClamBounded): Promise<void> {
  assertFreshClamDatabase();
  try {
    const result = await runner("/usr/bin/clamscan", ["--no-summary", "--stdout", path], 60_000);
    if (!/\sOK\s*$/m.test(result.stdout)) throw new Error("SECURITY_SCAN_FAILED");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/FOUND/i.test(message) || /FOUND/i.test(String((error as { stdout?: string }).stdout ?? ""))) {
      throw new Error("SECURITY_MALWARE_DETECTED");
    }
    if (/SECURITY_/.test(message)) throw error;
    throw new Error("SECURITY_SCAN_FAILED");
  }
}

export function magicMediaType(buffer: Buffer): "application/pdf" | "image/jpeg" | "image/png" | null {
  if (buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-") return "application/pdf";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  return null;
}

export function assertSafePdfJson(json: string): void {
  const forbidden = ["/JavaScript", "/JS", "/Launch", "/EmbeddedFile", "/OpenAction", "/AA", "/RichMedia"];
  if (forbidden.some((token) => json.includes(token))) throw new Error("PDF_ACTIVE_CONTENT");
}
