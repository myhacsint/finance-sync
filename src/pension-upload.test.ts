import test from "node:test";
import assert from "node:assert/strict";
import { Readable, PassThrough } from "node:stream";
import { readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import type { IncomingMessage } from "node:http";
import { MAX_PENSION_UPLOAD_BYTES, receivePensionUpload } from "./pension-upload.js";

test("interrupted and timed-out uploads reject and remove their private files", async () => {
  for (const abort of [true, false]) {
    const prefix = `finance-abort-test-${crypto.randomUUID()}`;
    const req = new PassThrough() as unknown as IncomingMessage;
    req.headers = { "content-type": "multipart/form-data; boundary=test" };
    const result = receivePensionUpload(req, { tempPrefix: prefix, timeoutMs: 40 });
    (req as unknown as PassThrough).write('--test\r\nContent-Disposition: form-data; name="document"; filename="test.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.7 synthetic partial');
    if (abort) req.emit("aborted");
    await assert.rejects(result, abort ? /UPLOAD_ABORTED/ : /UPLOAD_TIMEOUT/);
    assert.equal(readdirSync(tmpdir()).some((name) => name.startsWith(prefix)), false);
    req.destroy();
  }
});

function multipart(content: Buffer, declaredMime: string, name = "document"): IncomingMessage {
  const boundary = "finance-synthetic-boundary";
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${name}"; filename="synthetic.bin"\r\nContent-Type: ${declaredMime}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const stream = Readable.from([head, content, tail]) as IncomingMessage;
  stream.headers = { "content-type": `multipart/form-data; boundary=${boundary}` };
  return stream;
}

test("invalid multipart file field is rejected without an unhandled stream error", async () => {
  const prefix = `finance-invalid-field-${crypto.randomUUID()}`;
  await assert.rejects(receivePensionUpload(multipart(Buffer.from("%PDF-1.7 synthetic test ".repeat(10)), "application/pdf", "file"), {tempPrefix:prefix}), /UPLOAD_FILE_INVALID/);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(readdirSync(tmpdir()).some(name=>name.startsWith(prefix)),false);
});

test("streaming upload rejects files above 12 MiB", async () => {
  const content = Buffer.alloc(MAX_PENSION_UPLOAD_BYTES + 1, 0x20);
  content.write("%PDF-1.7\n", 0, "ascii");
  await assert.rejects(() => receivePensionUpload(multipart(content, "application/pdf")), /UPLOAD_TOO_LARGE/);
});

test("declared MIME must match magic bytes", async () => {
  const content = Buffer.from(`%PDF-1.7\n${"synthetic ".repeat(8)}`);
  await assert.rejects(() => receivePensionUpload(multipart(content, "image/jpeg")), /UPLOAD_MIME_MISMATCH/);
});

test("Sutor upload accepts PDF only", async () => {
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64, 0x20)]);
  await assert.rejects(
    () => receivePensionUpload(multipart(jpeg, "image/jpeg"), {
      tempPrefix: "finance-sutor-test",
      allowedMediaTypes: ["application/pdf"]
    }),
    /UPLOAD_MEDIA_TYPE_NOT_ALLOWED/
  );
});
