import type { AppConfig, ImportBundle, SourceConfig, SyncResult } from "./types.js";
import type { FinanceDatabase } from "./database.js";
import { paths } from "./config.js";
import { fetchSolana } from "./connectors/solana.js";
import { fetchEnableBanking } from "./connectors/enable-banking.js";
import {
  completeAuthorization,
  startAuthorization
} from "./connectors/enable-banking.js";
import { preflightInteractiveSource } from "./connectors/status-only.js";
import { importBundle } from "./importer.js";
import { exportAll } from "./exporter.js";
import { pushToActual } from "./sinks/actual.js";
import { pushToGhostfolio } from "./sinks/ghostfolio.js";

export class FinanceService {
  private running = new Set<string>();

  constructor(readonly db: FinanceDatabase, readonly config: AppConfig) {
    for (const source of config.sources) {
      db.registerSource(source.id, source.kind, source.enabled);
    }
    exportAll(db, paths.archive);
  }

  getSource(id: string): SourceConfig | undefined {
    return this.config.sources.find((source) => source.id === id);
  }

  async sync(id: string): Promise<SyncResult> {
    const source = this.getSource(id);
    if (!source) return { state: "ERROR", message: "Unbekannte Quelle" };
    if (!source.enabled) return { state: "DISABLED", message: "Quelle ist deaktiviert" };
    if (this.running.has(id)) return { state: "RUNNING", message: "Abruf läuft bereits" };
    this.running.add(id);
    const runId = this.db.beginRun(id);
    try {
      let bundle: ImportBundle;
      if (source.kind === "solana") {
        bundle = await fetchSolana(source);
      } else if (source.kind === "enable-banking") {
        bundle = await fetchEnableBanking(
          source,
          this.db.getSetting(`enable-banking:${source.id}:session`)
        );
      } else if (source.kind === "comdirect" || source.kind === "dkb-fints") {
        const result = preflightInteractiveSource(source);
        this.db.finishRun(runId, id, result.state, result.message);
        return result;
      } else {
        const result: SyncResult = {
          state: "WAITING_FOR_USER",
          message: "Werteingabe oder neues Dokument erforderlich"
        };
        this.db.finishRun(runId, id, result.state, result.message);
        return result;
      }
      const counts = importBundle(this.db, paths.archive, id, bundle);
      if (this.config.actual?.enabled) {
        counts.actual = await pushToActual(
          this.config.actual,
          bundle.transactions ?? []
        );
      }
      if (this.config.ghostfolio?.enabled) {
        counts.ghostfolio = await pushToGhostfolio(
          this.config.ghostfolio,
          bundle.activities ?? []
        );
      }
      exportAll(this.db, paths.archive);
      const message = `Abruf erfolgreich; ${Object.values(counts).reduce((a, b) => a + b, 0)} neue Datensätze`;
      this.db.finishRun(runId, id, "SUCCESS", message, counts);
      return { state: "SUCCESS", message, counts };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const waiting = /Secret|Zustimmung|TAN|SCA|fehlt/i.test(message);
      const state = waiting ? "WAITING_FOR_USER" : "ERROR";
      this.db.finishRun(runId, id, state, message);
      return { state, message };
    } finally {
      this.running.delete(id);
    }
  }

  startScheduler(): NodeJS.Timeout {
    const tick = async () => {
      const statusById = new Map(
        this.db.listSources().map((row) => [String(row.id), row])
      );
      for (const source of this.config.sources) {
        if (!source.enabled || this.running.has(source.id)) continue;
        const last = statusById.get(source.id)?.last_attempt_at;
        const hours = source.scheduleHours ?? (source.kind === "solana" ? 6 : 24);
        if (!last || Date.now() - new Date(String(last)).getTime() >= hours * 3_600_000) {
          void this.sync(source.id);
        }
      }
    };
    void tick();
    return setInterval(() => void tick(), 60_000);
  }

  async startEnableBanking(id: string): Promise<{ url: string }> {
    const source = this.getSource(id);
    if (!source || source.kind !== "enable-banking") {
      throw new Error("Enable-Banking-Quelle nicht gefunden");
    }
    if (!this.config.publicBaseUrl) throw new Error("publicBaseUrl fehlt");
    const redirectUrl = new URL("/callbacks/enable-banking", this.config.publicBaseUrl);
    const auth = await startAuthorization(source, redirectUrl.toString());
    this.db.setSetting(`enable-banking:${id}:state`, auth.state);
    this.db.setSetting(`enable-banking:${id}:consent-expires`, auth.validUntil);
    return { url: auth.url };
  }

  async completeEnableBanking(code: string, state: string): Promise<string> {
    const matched = this.config.sources.find(
      (item) => item.kind === "enable-banking"
        && this.db.getSetting(`enable-banking:${item.id}:state`) === state
    );
    const id = matched?.id ?? "";
    const source = this.getSource(id);
    if (!source || source.kind !== "enable-banking") {
      throw new Error("Ungültiger OAuth-State");
    }
    const expected = this.db.getSetting(`enable-banking:${id}:state`);
    if (!expected || expected !== state) throw new Error("Ungültiger OAuth-State");
    const completed = await completeAuthorization(source, code);
    this.db.setSetting(`enable-banking:${id}:session`, completed.sessionId);
    this.db.setSetting(`enable-banking:${id}:state`, "");
    return id;
  }
}
