import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { timingSafeEqual } from "node:crypto";
import { loadConfig, paths, readSecret } from "./config.js";
import { FinanceDatabase } from "./database.js";
import { FinanceService } from "./service.js";
import { exportAll } from "./exporter.js";
import { manualSnapshotBundle } from "./connectors/manual.js";
import { importBundle } from "./importer.js";
import { snapshotSqlite } from "./backup.js";
import { renderUi } from "./ui.js";
import { buildHealth } from "./health.js";

mkdirSync(paths.data, { recursive: true });
mkdirSync(paths.archive, { recursive: true });
mkdirSync(paths.inbox, { recursive: true });
const config = loadConfig();
const db = new FinanceDatabase(join(paths.data, "finance.sqlite"));
const service = new FinanceService(db, config);
const scheduler = service.startScheduler();

function json(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body, (_, value) => typeof value === "bigint" ? value.toString() : value));
}

function authorized(req: IncomingMessage): boolean {
  const configured = readSecret("admin-token");
  if (!configured) return false;
  const supplied = req.headers.authorization?.replace(/^Bearer\s+/i, "") ?? "";
  const left = Buffer.from(configured);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

async function body(req: IncomingMessage, max = 1_048_576): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > max) throw new Error("Anfrage ist zu groß");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    if (req.method === "GET" && url.pathname === "/health") {
      const report = buildHealth(db, config);
      return json(res, report.status === "critical" ? 503 : 200, report);
    }
    if (req.method === "GET" && url.pathname === "/callbacks/enable-banking") {
      const code = url.searchParams.get("code") ?? "";
      const state = url.searchParams.get("state") ?? "";
      await service.completeEnableBanking(code, state);
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end("<!doctype html><meta charset=utf-8><title>FinanceSync</title><p>Bankverbindung wurde bestätigt. Dieses Fenster kann geschlossen werden.</p>");
    }
    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      return res.end(renderUi());
    }
    if (!authorized(req)) return json(res, 401, { error: "Nicht autorisiert" });
    if (req.method === "GET" && url.pathname === "/api/status") {
      return json(res, 200, { sources: db.listSources() });
    }
    const syncMatch = /^\/api\/sync\/([^/]+)$/.exec(url.pathname);
    if (req.method === "POST" && syncMatch) {
      const result = await service.sync(decodeURIComponent(syncMatch[1]));
      return json(res, result.state === "ERROR" ? 500 : 200, result);
    }
    const authMatch = /^\/api\/enable-banking\/start\/([^/]+)$/.exec(url.pathname);
    if (req.method === "POST" && authMatch) {
      const result = await service.startEnableBanking(decodeURIComponent(authMatch[1]));
      return json(res, 200, result);
    }
    if (req.method === "POST" && url.pathname === "/api/export") {
      exportAll(db, paths.archive);
      return json(res, 200, { ok: true });
    }
    if (req.method === "POST" && url.pathname === "/api/reconcile") {
      const result = await service.reconcileInternalTransfers();
      return json(res, 200, { ok: true, ...result });
    }
    if (req.method === "POST" && url.pathname === "/api/manual-snapshot") {
      const payload = await body(req);
      const sourceId = String((payload as { sourceId?: string }).sourceId ?? "");
      const source = service.getSource(sourceId);
      if (!source || source.kind !== "manual") {
        return json(res, 400, { error: "Manuelle Quelle nicht gefunden" });
      }
      const bundle = manualSnapshotBundle(source, payload as never);
      const counts = importBundle(db, paths.archive, source.id, bundle);
      exportAll(db, paths.archive);
      return json(res, 200, { ok: true, counts });
    }
    if (req.method === "POST" && url.pathname === "/api/backup") {
      const target = join(paths.archive, "normalized", "finance-snapshot.sqlite");
      snapshotSqlite(db, target);
      return json(res, 200, { ok: true, target });
    }
    return json(res, 404, { error: "Nicht gefunden" });
  } catch (error) {
    return json(res, 500, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(config.port, "0.0.0.0", () => {
  process.stdout.write(`FinanceSync lauscht auf Port ${config.port}\n`);
});

function shutdown(): void {
  clearInterval(scheduler);
  server.close(() => {
    db.close();
    process.exit(0);
  });
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
