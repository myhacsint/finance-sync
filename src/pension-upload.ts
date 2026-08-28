import Busboy from "busboy";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, createWriteStream, mkdirSync, openSync, readSync, rmSync } from "node:fs";
import type { IncomingMessage } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { magicMediaType } from "./pension-security.js";

export const MAX_PENSION_UPLOAD_BYTES = 12 * 1024 * 1024;

export interface PensionUploadedFile {
  workDir: string;
  path: string;
  mediaType: "application/pdf" | "image/jpeg" | "image/png";
  sizeBytes: number;
  hash: string;
  cleanup(): void;
}

export async function receivePensionUpload(req: IncomingMessage): Promise<PensionUploadedFile> {
  const workDir = join(tmpdir(), `finance-pension-${randomUUID()}`);
  mkdirSync(workDir, { recursive: false, mode: 0o700 });
  const path = join(workDir, "document.bin");
  let settled = false;
  let fileSeen = false;
  let truncated = false;
  let declaredMime = "";
  let sizeBytes = 0;
  const hash = createHash("sha256");
  const cleanup = () => rmSync(workDir, { recursive: true, force: true });
  try {
    const result = await new Promise<void>((resolve, reject) => {
      let busboy: Busboy.Busboy;
      let parserFinished = false;
      let writerFinished = false;
      let promiseFinished = false;
      const fail = (error: Error) => {
        if (promiseFinished) return;
        promiseFinished = true;
        reject(error);
      };
      const finish = () => {
        if (promiseFinished || !parserFinished || !writerFinished) return;
        promiseFinished = true;
        truncated ? reject(new Error("UPLOAD_TOO_LARGE")) : resolve();
      };
      try {
        busboy = Busboy({
          headers: req.headers,
          // Busboy emits partsLimit when the configured boundary is reached,
          // so keep one sentinel slot while files/fields enforce the real shape.
          limits: { files: 1, fields: 0, parts: 2, fileSize: MAX_PENSION_UPLOAD_BYTES }
        });
      } catch {
        fail(new Error("UPLOAD_MULTIPART_REQUIRED"));
        return;
      }
      busboy.on("file", (name, stream, info) => {
        if (name !== "document" || fileSeen) {
          stream.resume();
          fail(new Error("UPLOAD_FILE_INVALID"));
          return;
        }
        fileSeen = true;
        declaredMime = info.mimeType;
        const output = createWriteStream(path, { flags: "wx", mode: 0o600 });
        stream.on("limit", () => { truncated = true; });
        stream.on("data", (chunk: Buffer) => {
          sizeBytes += chunk.length;
          hash.update(chunk);
        });
        stream.on("error", (error) => fail(error));
        output.on("error", (error) => fail(error));
        output.on("finish", () => { writerFinished = true; finish(); });
        stream.pipe(output);
      });
      busboy.on("filesLimit", () => fail(new Error("UPLOAD_TOO_MANY_FILES")));
      busboy.on("fieldsLimit", () => fail(new Error("UPLOAD_FIELDS_NOT_ALLOWED")));
      busboy.on("partsLimit", () => fail(new Error("UPLOAD_TOO_MANY_PARTS")));
      busboy.on("error", (error) => fail(error instanceof Error ? error : new Error("UPLOAD_MULTIPART_INVALID")));
      busboy.on("finish", () => {
        if (!fileSeen) fail(new Error("UPLOAD_FILE_MISSING"));
        else { parserFinished = true; finish(); }
      });
      req.pipe(busboy);
    });
    void result;
    if (sizeBytes < 32) throw new Error("UPLOAD_FILE_EMPTY");
    const descriptor = openSync(path, "r");
    const prefix = Buffer.alloc(16);
    try { readSync(descriptor, prefix, 0, prefix.length, 0); } finally { closeSync(descriptor); }
    const mediaType = magicMediaType(prefix);
    if (!mediaType || mediaType !== declaredMime) throw new Error("UPLOAD_MIME_MISMATCH");
    settled = true;
    return { workDir, path, mediaType, sizeBytes, hash: hash.digest("hex"), cleanup };
  } finally {
    if (!settled) cleanup();
  }
}
