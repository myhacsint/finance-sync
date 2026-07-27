import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type {
  NormalizedActivity,
  NormalizedBalance,
  NormalizedHolding,
  NormalizedTransaction,
  SyncState
} from "./types.js";

export class FinanceDatabase {
  readonly db: DatabaseSync;

  constructor(file: string) {
    mkdirSync(dirname(file), { recursive: true });
    this.db = new DatabaseSync(file);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 0,
        state TEXT NOT NULL DEFAULT 'DISABLED',
        message TEXT,
        last_attempt_at TEXT,
        last_success_at TEXT,
        next_due_at TEXT
      );
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        external_id TEXT NOT NULL,
        name TEXT,
        type TEXT,
        currency TEXT,
        owner TEXT,
        UNIQUE(source_id, external_id)
      );
      CREATE TABLE IF NOT EXISTS raw_objects (
        hash TEXT PRIMARY KEY,
        source_id TEXT NOT NULL,
        fetched_at TEXT NOT NULL,
        media_type TEXT NOT NULL,
        relative_path TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY,
        source_id TEXT NOT NULL,
        source_transaction_id TEXT,
        account_id TEXT NOT NULL,
        booked_at TEXT NOT NULL,
        value_at TEXT,
        amount_minor INTEGER NOT NULL,
        currency TEXT NOT NULL,
        payee TEXT,
        memo TEXT,
        category TEXT,
        owner TEXT,
        counterparty_iban TEXT,
        internal_transfer_id TEXT,
        raw_hash TEXT NOT NULL,
        identity_key TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS balances (
        id INTEGER PRIMARY KEY,
        source_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        currency TEXT NOT NULL,
        owner TEXT,
        raw_hash TEXT NOT NULL,
        UNIQUE(source_id, account_id, captured_at, raw_hash)
      );
      CREATE TABLE IF NOT EXISTS holdings (
        id INTEGER PRIMARY KEY,
        source_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        symbol TEXT NOT NULL,
        name TEXT,
        quantity_atomic TEXT NOT NULL,
        atomic_decimals INTEGER NOT NULL,
        price_minor INTEGER,
        currency TEXT,
        owner TEXT,
        raw_hash TEXT NOT NULL,
        UNIQUE(source_id, account_id, captured_at, symbol, raw_hash)
      );
      CREATE TABLE IF NOT EXISTS investment_activities (
        id INTEGER PRIMARY KEY,
        source_id TEXT NOT NULL,
        source_activity_id TEXT,
        account_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        type TEXT NOT NULL,
        symbol TEXT,
        quantity_atomic TEXT,
        atomic_decimals INTEGER,
        amount_minor INTEGER,
        currency TEXT,
        fee_minor INTEGER,
        note TEXT,
        raw_hash TEXT NOT NULL,
        identity_key TEXT NOT NULL UNIQUE
      );
      CREATE TABLE IF NOT EXISTS sync_runs (
        id INTEGER PRIMARY KEY,
        source_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        finished_at TEXT,
        state TEXT NOT NULL,
        message TEXT,
        counts_json TEXT
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_transactions_account_date
        ON transactions(account_id, booked_at);
      CREATE INDEX IF NOT EXISTS idx_balances_account_date
        ON balances(account_id, captured_at);
    `);
    const holdingColumns = new Set(
      (this.db.prepare("PRAGMA table_info(holdings)").all() as Array<{ name: string }>)
        .map((column) => column.name)
    );
    const additions: Array<[string, string]> = [
      ["price_atomic", "TEXT"],
      ["price_decimals", "INTEGER"],
      ["price_currency", "TEXT"],
      ["market_value_minor", "INTEGER"],
      ["market_value_currency", "TEXT"]
    ];
    for (const [name, type] of additions) {
      if (!holdingColumns.has(name)) {
        this.db.exec(`ALTER TABLE holdings ADD COLUMN ${name} ${type}`);
      }
    }
  }

  registerSource(id: string, kind: string, enabled: boolean): void {
    this.db.prepare(`
      INSERT INTO sources(id, kind, enabled, state)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET kind=excluded.kind, enabled=excluded.enabled
    `).run(id, kind, enabled ? 1 : 0, enabled ? "READY" : "DISABLED");
  }

  beginRun(sourceId: string): number {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE sources SET state='RUNNING', last_attempt_at=?, message=NULL WHERE id=?
    `).run(now, sourceId);
    return Number(this.db.prepare(`
      INSERT INTO sync_runs(source_id, started_at, state) VALUES (?, ?, 'RUNNING')
    `).run(sourceId, now).lastInsertRowid);
  }

  finishRun(
    runId: number,
    sourceId: string,
    state: SyncState,
    message: string,
    counts: Record<string, number> = {}
  ): void {
    const now = new Date().toISOString();
    this.db.prepare(`
      UPDATE sync_runs SET finished_at=?, state=?, message=?, counts_json=? WHERE id=?
    `).run(now, state, message, JSON.stringify(counts), runId);
    this.db.prepare(`
      UPDATE sources SET state=?, message=?,
        last_success_at=CASE WHEN ?='SUCCESS' THEN ? ELSE last_success_at END
      WHERE id=?
    `).run(state, message, state, now, sourceId);
  }

  recordRaw(hash: string, sourceId: string, mediaType: string, relativePath: string): void {
    this.db.prepare(`
      INSERT OR IGNORE INTO raw_objects(hash, source_id, fetched_at, media_type, relative_path)
      VALUES (?, ?, ?, ?, ?)
    `).run(hash, sourceId, new Date().toISOString(), mediaType, relativePath);
  }

  importTransactions(items: NormalizedTransaction[]): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO transactions(
        source_id, source_transaction_id, account_id, booked_at, value_at,
        amount_minor, currency, payee, memo, category, owner, counterparty_iban,
        internal_transfer_id, raw_hash, identity_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    let inserted = 0;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const item of items) {
        const identity = item.sourceTransactionId
          ? `${item.sourceId}:id:${item.sourceTransactionId}`
          : `${item.sourceId}:hash:${item.rawHash}:${item.accountId}:${item.bookedAt}:${item.amountMinor}`;
        const result = stmt.run(
          item.sourceId, item.sourceTransactionId ?? null, item.accountId,
          item.bookedAt, item.valueAt ?? null, item.amountMinor, item.currency,
          item.payee ?? null, item.memo ?? null, item.category ?? null,
          item.owner ?? null, item.counterpartyIban ?? null,
          item.internalTransferId ?? null, item.rawHash, identity
        );
        inserted += Number(result.changes);
      }
      this.db.exec("COMMIT");
      return inserted;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  importBalances(items: NormalizedBalance[]): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO balances(
        source_id, account_id, captured_at, amount_minor, currency, owner, raw_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(source_id, account_id, captured_at, raw_hash) DO UPDATE SET
        amount_minor=excluded.amount_minor,
        currency=excluded.currency,
        owner=excluded.owner
    `);
    let inserted = 0;
    for (const item of items) {
      inserted += Number(stmt.run(
        item.sourceId, item.accountId, item.capturedAt, item.amountMinor,
        item.currency, item.owner ?? null, item.rawHash
      ).changes);
    }
    return inserted;
  }

  importHoldings(items: NormalizedHolding[]): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO holdings(
        source_id, account_id, captured_at, symbol, name, quantity_atomic,
        atomic_decimals, price_minor, currency, price_atomic, price_decimals,
        price_currency, market_value_minor, market_value_currency, owner, raw_hash
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    let inserted = 0;
    for (const item of items) {
      inserted += Number(stmt.run(
        item.sourceId, item.accountId, item.capturedAt, item.symbol,
        item.name ?? null, item.quantityAtomic, item.atomicDecimals,
        item.priceMinor ?? null, item.currency ?? null,
        item.priceAtomic ?? null, item.priceDecimals ?? null,
        item.priceCurrency ?? null, item.marketValueMinor ?? null,
        item.marketValueCurrency ?? null, item.owner ?? null, item.rawHash
      ).changes);
    }
    return inserted;
  }

  importActivities(items: NormalizedActivity[]): number {
    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO investment_activities(
        source_id, source_activity_id, account_id, occurred_at, type, symbol,
        quantity_atomic, atomic_decimals, amount_minor, currency, fee_minor,
        note, raw_hash, identity_key
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    let inserted = 0;
    for (const item of items) {
      const identity = item.sourceActivityId
        ? `${item.sourceId}:id:${item.sourceActivityId}`
        : `${item.sourceId}:hash:${item.rawHash}:${item.accountId}:${item.occurredAt}:${item.type}`;
      inserted += Number(stmt.run(
        item.sourceId, item.sourceActivityId ?? null, item.accountId,
        item.occurredAt, item.type, item.symbol ?? null,
        item.quantityAtomic ?? null, item.atomicDecimals ?? null,
        item.amountMinor ?? null, item.currency ?? null, item.feeMinor ?? null,
        item.note ?? null, item.rawHash, identity
      ).changes);
    }
    return inserted;
  }

  listSources(): Record<string, unknown>[] {
    return this.db.prepare(`
      SELECT id, kind, enabled, state, message, last_attempt_at, last_success_at, next_due_at
      FROM sources ORDER BY id
    `).all() as Record<string, unknown>[];
  }

  query(sql: string): Record<string, unknown>[] {
    return this.db.prepare(sql).all() as Record<string, unknown>[];
  }

  getSetting(key: string): string | undefined {
    const row = this.db.prepare("SELECT value FROM settings WHERE key=?").get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  }

  setSetting(key: string, value: string): void {
    this.db.prepare(`
      INSERT INTO settings(key, value) VALUES (?, ?)
      ON CONFLICT(key) DO UPDATE SET value=excluded.value
    `).run(key, value);
  }

  close(): void {
    this.db.close();
  }
}
