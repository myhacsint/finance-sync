import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractSutorPdfDocument, parseOcrTsv } from "./pension-extractor.js";
import type { CommandRunner } from "./pension-security.js";

function encryptedRunner(options: { pages?: number; passwordFailure?: boolean }): CommandRunner {
  return async (command, args) => {
    if (command.endsWith("qpdf") && args[0] === "--show-encryption") {
      if (options.passwordFailure) throw new Error("invalid password");
      return { stdout: "User password = \nSupplied password is user password\nprint low resolution: allowed\n", stderr: "" };
    }
    if (command.endsWith("qpdf") && args.includes("--decrypt")) {
      writeFileSync(args.at(-1)!, "%PDF-1.7\n", { mode: 0o600 });
      return { stdout: "", stderr: "" };
    }
    if (command.endsWith("qpdf")) return { stdout: args[0] === "--json" ? '{"pages":[{}]}' : "", stderr: "" };
    if (command.endsWith("pdfinfo")) return { stdout: `Pages: ${options.pages ?? 7}\nEncrypted: no\n`, stderr: "" };
    if (command.endsWith("pdftotext")) {
      const page = Number(args[args.indexOf("-f") + 1]);
      writeFileSync(args.at(-1)!, `Synthetische native Seite ${page} `.repeat(10), { mode: 0o600 });
      return { stdout: "", stderr: "" };
    }
    throw new Error(`unexpected command ${command}`);
  };
}

test("empty-user-password printable PDF is accepted up to 12 pages", async () => {
  const root = mkdtempSync(join(tmpdir(), "sutor-security-"));
  const file = join(root, "statement.pdf");
  writeFileSync(file, "%PDF-1.7\n", { mode: 0o600 });
  const extracted = await extractSutorPdfDocument(file, root, encryptedRunner({ pages: 12 }), async () => {});
  assert.equal(extracted.pageCount, 12);
});

test("real password and more than 12 pages are rejected", async () => {
  const root = mkdtempSync(join(tmpdir(), "sutor-security-reject-"));
  const file = join(root, "statement.pdf");
  writeFileSync(file, "%PDF-1.7\n", { mode: 0o600 });
  await assert.rejects(() => extractSutorPdfDocument(file, root, encryptedRunner({ passwordFailure: true }), async () => {}), /PDF_ENCRYPTED/);
  await assert.rejects(() => extractSutorPdfDocument(file, root, encryptedRunner({ pages: 13 }), async () => {}), /PDF_TOO_MANY_PAGES/);
});

test("OCR TSV preserves reconstructed lines instead of flattening the table", () => {
  const header = "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext";
  const tsv = [header,
    "5\t1\t1\t1\t1\t2\t100\t10\t20\t10\t95\tISIN",
    "5\t1\t1\t1\t1\t1\t10\t10\t80\t10\t96\tInvestment",
    "5\t1\t1\t1\t2\t1\t10\t30\t80\t10\t94\tSynthetic",
    "5\t1\t1\t1\t2\t2\t100\t30\t100\t10\t93\tIE00B8KGV557"
  ].join("\n");
  const result = parseOcrTsv(tsv);
  assert.equal(result.text, "Investment ISIN\nSynthetic IE00B8KGV557");
  assert.ok(result.confidence > 0.9);
});
