import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import type { IncomingMessage } from "node:http";
import { MAX_PENSION_UPLOAD_BYTES, receivePensionUpload } from "./pension-upload.js";

function multipart(content: Buffer, declaredMime: string): IncomingMessage {
  const boundary = "finance-synthetic-boundary";
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="document"; filename="synthetic.bin"\r\nContent-Type: ${declaredMime}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  const stream = Readable.from([head, content, tail]) as IncomingMessage;
  stream.headers = { "content-type": `multipart/form-data; boundary=${boundary}` };
  return stream;
}

test("streaming upload rejects files above 12 MiB", async () => {
  const content = Buffer.alloc(MAX_PENSION_UPLOAD_BYTES + 1, 0x20);
  content.write("%PDF-1.7\n", 0, "ascii");
  await assert.rejects(() => receivePensionUpload(multipart(content, "application/pdf")), /UPLOAD_TOO_LARGE/);
});

test("declared MIME must match magic bytes", async () => {
  const content = Buffer.from(`%PDF-1.7\n${"synthetic ".repeat(8)}`);
  await assert.rejects(() => receivePensionUpload(multipart(content, "image/jpeg")), /UPLOAD_MIME_MISMATCH/);
});
