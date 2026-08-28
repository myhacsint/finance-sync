import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractPensionDocument } from "./pension-extractor.js";
import { assertSafePdfJson, magicMediaType, scanMalware, type CommandRunner } from "./pension-security.js";

test("file type is derived from magic bytes, not extension", () => {
  assert.equal(magicMediaType(Buffer.from("%PDF-1.7\n")), "application/pdf");
  assert.equal(magicMediaType(Buffer.from([0xff, 0xd8, 0xff, 0x00])), "image/jpeg");
  assert.equal(magicMediaType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])), "image/png");
  assert.equal(magicMediaType(Buffer.from("invoice.pdf")), null);
});

test("active PDF content is rejected", () => {
  assert.throws(() => assertSafePdfJson('{"/OpenAction":{"/JS":"alert(1)"}}'), /PDF_ACTIVE_CONTENT/);
  assert.doesNotThrow(() => assertSafePdfJson('{"pages":[{}]}'));
  assert.doesNotThrow(() => assertSafePdfJson('{"/DocChecksum":"/AA4796DE0994AF32C2D5D22CE3E4C61F"}'));
  assert.throws(() => assertSafePdfJson("not-json"), /PDF_STRUCTURE_INVALID/);
});

test("malware scanner fails closed and distinguishes a detection", async () => {
  const stale = process.env.FINANCE_CLAMAV_DATABASE_DIR;
  const root = mkdtempSync(join(tmpdir(), "finance-clam-test-"));
  writeFileSync(join(root, "daily.cvd"), "synthetic-signature");
  process.env.FINANCE_CLAMAV_DATABASE_DIR = root;
  const unavailable: CommandRunner = async () => { throw new Error("scanner missing"); };
  const infected: CommandRunner = async () => { throw Object.assign(new Error("FOUND"), { stdout: "sample: Test FOUND" }); };
  await assert.rejects(() => scanMalware("/tmp/sample", unavailable), /SECURITY_SCAN_FAILED/);
  await assert.rejects(() => scanMalware("/tmp/sample", infected), /SECURITY_MALWARE_DETECTED/);
  if (stale === undefined) delete process.env.FINANCE_CLAMAV_DATABASE_DIR; else process.env.FINANCE_CLAMAV_DATABASE_DIR = stale;
});

function pdfRunner(options: { pages?: number; native?: string; tsv?: string }): CommandRunner {
  return async (command, args) => {
    if (command.endsWith("qpdf")) return { stdout: args[0] === "--json" ? '{"pages":[{}]}' : "", stderr: "" };
    if (command.endsWith("pdfinfo")) return { stdout: `Pages: ${options.pages ?? 1}\nEncrypted: no\n`, stderr: "" };
    if (command.endsWith("pdftotext")) {
      writeFileSync(args.at(-1)!, options.native ?? "", { mode: 0o600 });
      return { stdout: "", stderr: "" };
    }
    if (command.endsWith("pdftoppm")) {
      const prefix = args.at(-1)!;
      for (let page = 1; page <= (options.pages ?? 1); page += 1) writeFileSync(`${prefix}-${page}.png`, "synthetic", { mode: 0o600 });
      return { stdout: "", stderr: "" };
    }
    if (command.endsWith("tesseract")) return { stdout: options.tsv ?? "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext\n5\t1\t1\t1\t1\t1\t0\t0\t1\t1\t95\tRenteninformation", stderr: "" };
    throw new Error(`unexpected command ${command}`);
  };
}

test("native PDF text is preferred and OCR is a bounded fallback", async () => {
  const root = mkdtempSync(join(tmpdir(), "finance-pdf-test-"));
  const file = join(root, "document.pdf");
  writeFileSync(file, "%PDF-1.7\n", { mode: 0o600 });
  const nativeText = "Renteninformation ".repeat(20);
  const native = await extractPensionDocument(file, "application/pdf", root, pdfRunner({ native: nativeText }), async () => {});
  assert.equal(native.pages[0].method, "native");
  assert.equal(native.pages[0].text, nativeText);

  const fallbackRoot = mkdtempSync(join(tmpdir(), "finance-pdf-ocr-test-"));
  const fallbackFile = join(fallbackRoot, "document.pdf");
  writeFileSync(fallbackFile, "%PDF-1.7\n", { mode: 0o600 });
  const fallback = await extractPensionDocument(fallbackFile, "application/pdf", fallbackRoot, pdfRunner({ native: "short" }), async () => {});
  assert.equal(fallback.pages[0].method, "ocr");
  assert.match(fallback.pages[0].text, /Renteninformation/);
});

test("malicious, malformed and overlong PDFs stop before parsing", async () => {
  const root = mkdtempSync(join(tmpdir(), "finance-pdf-reject-test-"));
  const file = join(root, "document.pdf");
  writeFileSync(file, "%PDF-1.7\n", { mode: 0o600 });
  await assert.rejects(
    () => extractPensionDocument(file, "application/pdf", root, pdfRunner({ pages: 7 }), async () => {}),
    /PDF_TOO_MANY_PAGES/
  );
  await assert.rejects(
    () => extractPensionDocument(file, "application/pdf", root, async () => { throw new Error("malformed"); }, async () => {}),
    /malformed/
  );
  let parsed = false;
  await assert.rejects(
    () => extractPensionDocument(file, "application/pdf", root, async () => { parsed = true; return { stdout: "", stderr: "" }; }, async () => { throw new Error("SECURITY_MALWARE_DETECTED"); }),
    /SECURITY_MALWARE_DETECTED/
  );
  assert.equal(parsed, false);
  assert.equal(readFileSync(file, "utf8"), "%PDF-1.7\n");
});
