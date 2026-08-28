import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assertSafePdfJson, runBounded, scanMalware, type CommandResult, type CommandRunner } from "./pension-security.js";
import type { PensionTextPage } from "./drv-pension-parser.js";

export interface ExtractedPensionDocument {
  pageCount: number;
  pages: PensionTextPage[];
}

function pdfInfoValue(output: string, key: string): string | null {
  return new RegExp(`^${key}:\\s*(.+)$`, "mi").exec(output)?.[1]?.trim() ?? null;
}

export function parseOcrTsv(tsv: string): { text: string; confidence: number } {
  const rows = tsv.split(/\r?\n/).slice(1).map((line) => line.split("\t"));
  const words = rows.filter((row) => row.length >= 12 && row[11]?.trim());
  const confidenceValues = words.map((row) => Number(row[10])).filter((value) => Number.isFinite(value) && value >= 0);
  const grouped = new Map<string, string[][]>();
  for (const row of words) {
    const key = [row[1], row[2], row[3], row[4]].join(":");
    const line = grouped.get(key) ?? [];
    line.push(row);
    grouped.set(key, line);
  }
  const text = [...grouped.values()].map((line) => {
    const sorted = line.sort((left, right) => Number(left[6]) - Number(right[6]));
    return sorted.reduce((value, row, index) => {
      if (index === 0) return row[11].trim();
      const previous = sorted[index - 1];
      const gap = Number(row[6]) - (Number(previous[6]) + Number(previous[8]));
      return `${value}${gap > 20 ? "\t" : " "}${row[11].trim()}`;
    }, "");
  }).join("\n");
  const average = confidenceValues.length
    ? confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length / 100
    : 0;
  return { text, confidence: average };
}

async function ocrImage(path: string, runner: CommandRunner): Promise<{ text: string; confidence: number }> {
  const result = await runner("/usr/bin/tesseract", [path, "stdout", "-l", "deu", "--psm", "6", "tsv"], 60_000);
  return parseOcrTsv(result.stdout);
}

export interface PensionExtractionOptions {
  maxPdfPages?: number;
  allowEmptyUserPasswordPrintable?: boolean;
}

async function extractPdf(
  path: string,
  workDir: string,
  runner: CommandRunner,
  options: PensionExtractionOptions
): Promise<ExtractedPensionDocument> {
  let extractionPath = path;
  let encryption: CommandResult;
  try { encryption = await runner("/usr/bin/qpdf", ["--show-encryption", path], 20_000); }
  catch (error) {
    const detail = `${error instanceof Error ? error.message : String(error)} ${String((error as { stderr?: string }).stderr ?? "")}`;
    if (/password/i.test(detail)) throw new Error("PDF_ENCRYPTED");
    throw error;
  }
  const encrypted = encryption.stdout.trim().length > 0 && !/File is not encrypted/i.test(encryption.stdout);
  if (encrypted) {
    const emptyUserPassword = /^User password\s*=\s*$/m.test(encryption.stdout)
      && /Supplied password is user password/i.test(encryption.stdout);
    const printable = /print (?:low|high) resolution:\s*allowed/i.test(encryption.stdout);
    if (!options.allowEmptyUserPasswordPrintable || !emptyUserPassword || !printable) {
      throw new Error("PDF_ENCRYPTED");
    }
    extractionPath = join(workDir, "decrypted.pdf");
    await runner("/usr/bin/qpdf", ["--password=", "--decrypt", path, extractionPath], 20_000);
    chmodSync(extractionPath, 0o600);
  }
  await runner("/usr/bin/qpdf", ["--check", extractionPath], 20_000);
  const qpdfJson = await runner("/usr/bin/qpdf", ["--json", extractionPath], 20_000);
  assertSafePdfJson(qpdfJson.stdout);
  const info = await runner("/usr/bin/pdfinfo", [extractionPath], 20_000);
  if (/^Encrypted:\s+yes/im.test(info.stdout)) throw new Error("PDF_ENCRYPTED");
  const pageCount = Number(pdfInfoValue(info.stdout, "Pages"));
  if (!Number.isSafeInteger(pageCount) || pageCount < 1) throw new Error("PDF_PAGE_COUNT_INVALID");
  if (pageCount > (options.maxPdfPages ?? 6)) throw new Error("PDF_TOO_MANY_PAGES");

  const nativePages: PensionTextPage[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    const output = join(workDir, `native-${page}.txt`);
    await runner("/usr/bin/pdftotext", ["-f", String(page), "-l", String(page), "-layout", "-nopgbrk", extractionPath, output], 20_000);
    const text = readFileSync(output, "utf8");
    nativePages.push({ page, text, method: "native", confidence: text.trim().length >= 80 ? 0.98 : 0.45 });
  }
  if (nativePages.reduce((sum, page) => sum + page.text.trim().length, 0) >= 200) return { pageCount, pages: nativePages };

  const prefix = join(workDir, "page");
  await runner("/usr/bin/pdftoppm", ["-png", "-r", "200", extractionPath, prefix], 60_000);
  const pages: PensionTextPage[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    const source = join(workDir, `page-${page}.png`);
    const result = await ocrImage(source, runner);
    pages.push({ page, text: result.text, method: "ocr", confidence: result.confidence });
  }
  return { pageCount, pages };
}

async function extractImage(path: string, workDir: string, runner: CommandRunner): Promise<ExtractedPensionDocument> {
  const sanitized = join(workDir, "sanitized.png");
  await runner("/usr/bin/convert", [
    "-limit", "memory", "128MiB", "-limit", "map", "256MiB", "-limit", "area", "100MP",
    path, "-auto-orient", "-strip", "-resize", "3000x3000>", `PNG:${sanitized}`
  ], 60_000);
  chmodSync(sanitized, 0o600);
  const dimensions = await runner("/usr/bin/identify", ["-format", "%w %h", sanitized], 10_000);
  const [width, height] = dimensions.stdout.trim().split(/\s+/).map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 400 || height < 400 || width * height > 100_000_000) {
    throw new Error("IMAGE_DIMENSIONS_INVALID");
  }
  const result = await ocrImage(sanitized, runner);
  return { pageCount: 1, pages: [{ page: 1, text: result.text, method: "ocr", confidence: result.confidence }] };
}

export async function extractPensionDocument(
  path: string,
  mediaType: "application/pdf" | "image/jpeg" | "image/png",
  workDir: string,
  runner: CommandRunner = runBounded,
  malwareScanner: (path: string, runner?: CommandRunner) => Promise<void> = scanMalware,
  options: PensionExtractionOptions = {}
): Promise<ExtractedPensionDocument> {
  // Do not reuse the tighter parser runner: ClamAV has a separately measured,
  // still bounded address-space limit for loading its signature database.
  await malwareScanner(path);
  return mediaType === "application/pdf"
    ? extractPdf(path, workDir, runner, options)
    : extractImage(path, workDir, runner);
}

export async function extractSutorPdfDocument(
  path: string,
  workDir: string,
  runner: CommandRunner = runBounded,
  malwareScanner: (path: string, runner?: CommandRunner) => Promise<void> = scanMalware
): Promise<ExtractedPensionDocument> {
  return extractPensionDocument(
    path,
    "application/pdf",
    workDir,
    runner,
    malwareScanner,
    { maxPdfPages: 12, allowEmptyUserPasswordPrintable: true }
  );
}

export function writePrivateFile(path: string, buffer: Buffer): void {
  writeFileSync(path, buffer, { mode: 0o600, flag: "wx" });
}
