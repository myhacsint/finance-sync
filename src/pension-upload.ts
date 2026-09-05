import Busboy from "busboy";
import { createHash, randomUUID } from "node:crypto";
import { closeSync, createWriteStream, mkdirSync, openSync, readSync, rmSync, type WriteStream } from "node:fs";
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

export interface DocumentUploadOptions {
  tempPrefix?: string;
  allowedMediaTypes?: PensionUploadedFile["mediaType"][];
  timeoutMs?: number;
}

export async function receivePensionUpload(
  req: IncomingMessage,
  options: DocumentUploadOptions = {}
): Promise<PensionUploadedFile> {
  const tempPrefix = options.tempPrefix ?? "finance-pension";
  const workDir = join(process.env.FINANCE_PARSER_WORK_DIR || tmpdir(), `${tempPrefix}-${randomUUID()}`);
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
      let writer: WriteStream | undefined;
      let parserFinished = false;
      let writerFinished = false;
      let promiseFinished = false;
      const detach = () => {
        clearTimeout(timer);
        req.off("aborted", aborted);
        req.off("error", fail);
        req.off("close", closed);
      };
      const fail = (error: Error) => {
        if (promiseFinished) return;
        promiseFinished = true;
        detach();
        if (busboy) { req.unpipe(busboy); busboy.destroy(); }
        // Wait for the fd to close before the caller removes the private directory.
        if (writer && !writer.closed) {
          writer.once("close", () => reject(error));
          writer.destroy();
        } else reject(error);
      };
      const aborted = () => fail(new Error("UPLOAD_ABORTED"));
      const closed = () => { if (!req.complete && !req.readableEnded) aborted(); };
      const timer = setTimeout(() => fail(new Error("UPLOAD_TIMEOUT")), options.timeoutMs ?? 120_000);
      req.once("aborted", aborted);
      req.once("error", fail);
      req.once("close", closed);
      const finish = () => {
        if (promiseFinished || !parserFinished || !writerFinished) return;
        promiseFinished = true;
        detach();
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
        writer = output;
        stream.on("limit", () => { truncated = true; });
        stream.on("data", (chunk: Buffer) => {
          sizeBytes += chunk.length;
          hash.update(chunk);
        });
        stream.on("error", (error) => fail(error));
        output.on("error", (error) => fail(error));
        output.on("close", () => { writerFinished = true; finish(); });
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
    const header = Buffer.alloc(16);
    try { readSync(descriptor, header, 0, header.length, 0); } finally { closeSync(descriptor); }
    const mediaType = magicMediaType(header);
    if (!mediaType || mediaType !== declaredMime) throw new Error("UPLOAD_MIME_MISMATCH");
    if (options.allowedMediaTypes && !options.allowedMediaTypes.includes(mediaType)) {
      throw new Error("UPLOAD_MEDIA_TYPE_NOT_ALLOWED");
    }
    settled = true;
    return { workDir, path, mediaType, sizeBytes, hash: hash.digest("hex"), cleanup };
  } finally {
    if (!settled) cleanup();
  }
}
