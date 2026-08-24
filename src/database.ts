import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseNamedScenario, type NamedScenario } from "./named-scenarios.js";
import type { LifeEvent } from "./life-events.js";
import type {
  NormalizedActivity,
  NormalizedBalance,
  NormalizedHolding,
  NormalizedTransaction,
  ImportBundle,
  RecurringExpenseDecision,
  RecurringExpenseDecisionRecord,
  RecurringExpenseOptimizationPriority,
  RecurringExpenseOptimizationRecord,
  RecurringExpenseOptimizationStatus,
  SyncState
  , NewsletterAnalysis
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
      CREATE TABLE IF NOT EXISTS recurring_expense_decisions (
        candidate_key TEXT PRIMARY KEY,
        decision TEXT NOT NULL CHECK(decision IN (
          'GRUNDBEDARF', 'GESTALTBAR', 'VERMEIDBAR', 'UNKLAR', 'KEIN_KANDIDAT'
        )),
        evidence_hash TEXT NOT NULL,
        fingerprint_version INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS recurring_expense_optimizations (
        candidate_key TEXT PRIMARY KEY,
        evidence_hash TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN (
          'PRUEFEN', 'GEPLANT', 'GEKUENDIGT', 'BEIBEHALTEN'
        )),
        effective_date TEXT,
        expected_annual_savings_minor INTEGER CHECK(
          expected_annual_savings_minor IS NULL OR expected_annual_savings_minor >= 0
        ),
        priority TEXT CHECK(priority IS NULL OR priority IN ('HOCH', 'MITTEL', 'NIEDRIG')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS merchant_aliases (
        from_key TEXT PRIMARY KEY,
        to_label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS merchant_rules (
        pattern TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS named_scenarios (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS life_events (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        start_month TEXT NOT NULL,
        monthly_change_minor INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS month_closes (
        month TEXT PRIMARY KEY,
        note TEXT NOT NULL,
        closed_at TEXT NOT NULL,
        snapshot_json TEXT,
        checklist_json TEXT
      );
      CREATE TABLE IF NOT EXISTS asset_market_snapshots (
        valuation_date TEXT NOT NULL,
        source_id TEXT NOT NULL,
        account_id TEXT NOT NULL,
        captured_at TEXT NOT NULL,
        amount_minor INTEGER NOT NULL,
        currency TEXT NOT NULL CHECK(currency='EUR'),
        provider TEXT NOT NULL CHECK(provider='Ghostfolio'),
        PRIMARY KEY(valuation_date, source_id, account_id)
      );
      CREATE TABLE IF NOT EXISTS newsletter_analyses (
        message_id TEXT PRIMARY KEY,
        inbox_id TEXT NOT NULL,
        sender TEXT NOT NULL,
        subject TEXT NOT NULL,
        received_at TEXT NOT NULL,
        content_hash TEXT NOT NULL,
        model TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('UNREVIEWED', 'REVIEWED', 'DISMISSED')),
        analyzed_at TEXT NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_analyses_content_hash
        ON newsletter_analyses(content_hash);
      CREATE INDEX IF NOT EXISTS idx_transactions_account_date
        ON transactions(account_id, booked_at);
      CREATE INDEX IF NOT EXISTS idx_balances_account_date
        ON balances(account_id, captured_at);
      CREATE INDEX IF NOT EXISTS idx_asset_market_snapshots_account_date
        ON asset_market_snapshots(source_id, account_id, valuation_date);
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
    const monthCloseColumns = new Set(
      (this.db.prepare("PRAGMA table_info(month_closes)").all() as Array<{ name: string }>)
        .map((column) => column.name)
    );
    if (!monthCloseColumns.has("snapshot_json")) {
      this.db.exec("ALTER TABLE month_closes ADD COLUMN snapshot_json TEXT");
    }
    if (!monthCloseColumns.has("checklist_json")) {
      this.db.exec("ALTER TABLE month_closes ADD COLUMN checklist_json TEXT");
    }
  }

  hasNewsletterAnalysis(messageId: string, contentHash: string): boolean {
    return Boolean(this.db.prepare(`
      SELECT 1 FROM newsletter_analyses
      WHERE message_id = ? OR content_hash = ? LIMIT 1
    `).get(messageId, contentHash));
  }

  saveNewsletterAnalysis(analysis: NewsletterAnalysis): NewsletterAnalysis {
    this.db.prepare(`
      INSERT INTO newsletter_analyses(
        message_id, inbox_id, sender, subject, received_at, content_hash,
        model, payload_json, state, analyzed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(message_id) DO UPDATE SET
        inbox_id=excluded.inbox_id,
        sender=excluded.sender,
        subject=excluded.subject,
        received_at=excluded.received_at,
        content_hash=excluded.content_hash,
        model=excluded.model,
        payload_json=excluded.payload_json,
        state=excluded.state,
        analyzed_at=excluded.analyzed_at
    `).run(
      analysis.messageId,
      analysis.inboxId,
      analysis.sender,
      analysis.subject,
      analysis.receivedAt,
      analysis.contentHash,
      analysis.model,
      JSON.stringify(analysis),
      analysis.state,
      analysis.analyzedAt
    );
    return analysis;
  }

  listNewsletterAnalyses(limit = 100): NewsletterAnalysis[] {
    const safeLimit = Math.max(1, Math.min(500, Math.trunc(limit)));
    const rows = this.db.prepare(`
      SELECT payload_json FROM newsletter_analyses
      ORDER BY received_at DESC, analyzed_at DESC LIMIT ?
    `).all(safeLimit) as Array<{ payload_json: string }>;
    return rows.map((row) => JSON.parse(row.payload_json) as NewsletterAnalysis);
  }

  updateNewsletterAnalysisState(messageId: string, state: "UNREVIEWED" | "REVIEWED" | "DISMISSED"): NewsletterAnalysis | null {
    const row = this.db.prepare("SELECT payload_json FROM newsletter_analyses WHERE message_id = ?")
      .get(messageId) as { payload_json: string } | undefined;
    if (!row) return null;
    const analysis = JSON.parse(row.payload_json) as NewsletterAnalysis;
    const updated = { ...analysis, state };
    this.db.prepare("UPDATE newsletter_analyses SET state = ?, payload_json = ? WHERE message_id = ?")
      .run(state, JSON.stringify(updated), messageId);
    return updated;
  }

  assetAccountSources(): Map<string, string> {
    const rows = this.db.prepare(`
      SELECT account_id, min(source_id) AS source_id
      FROM (
        SELECT account_id, source_id FROM balances
        UNION ALL
        SELECT account_id, source_id FROM holdings
      )
      GROUP BY account_id
    `).all() as Array<{ account_id: string; source_id: string }>;
    return new Map(rows.map((row) => [row.account_id, row.source_id]));
  }

  upsertAssetMarketSnapshots(items: Array<{
    valuationDate: string;
    sourceId: string;
    accountId: string;
    capturedAt: string;
    amountMinor: number;
  }>): number {
    const stmt = this.db.prepare(`
      INSERT INTO asset_market_snapshots(
        valuation_date, source_id, account_id, captured_at, amount_minor, currency, provider
      ) VALUES (?, ?, ?, ?, ?, 'EUR', 'Ghostfolio')
      ON CONFLICT(valuation_date, source_id, account_id) DO UPDATE SET
        captured_at=excluded.captured_at,
        amount_minor=excluded.amount_minor
    `);
    let changed = 0;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const item of items) {
        const result = stmt.run(
          item.valuationDate,
          item.sourceId,
          item.accountId,
          item.capturedAt,
          item.amountMinor
        );
        changed += Number(result.changes);
      }
      this.db.exec("COMMIT");
      return changed;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  latestAssetMarketSnapshotDate(): string | undefined {
    const row = this.db.prepare(`
      SELECT max(valuation_date) AS valuation_date FROM asset_market_snapshots
    `).get() as { valuation_date?: string | null } | undefined;
    return row?.valuation_date ?? undefined;
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

  manualSnapshotState(
    sourceId: string,
    bundle: ImportBundle
  ): "new" | "equivalent" | "conflict" {
    const balance = bundle.balances?.[0];
    if (!balance) throw new Error("Manueller Snapshot enthält keinen Gesamtwert");
    const holdings = bundle.holdings ?? [];
    const existingBalances = this.db.prepare(`
      SELECT amount_minor, currency, owner
      FROM balances
      WHERE source_id=? AND account_id=? AND captured_at=?
    `).all(sourceId, balance.accountId, balance.capturedAt) as Array<{
      amount_minor: number | bigint;
      currency: string;
      owner: string | null;
    }>;
    const existingHoldings = this.db.prepare(`
      SELECT symbol, name, quantity_atomic, atomic_decimals, price_minor,
        currency, price_atomic, price_decimals, price_currency,
        market_value_minor, market_value_currency, owner
      FROM holdings
      WHERE source_id=? AND account_id=? AND captured_at=?
    `).all(sourceId, balance.accountId, balance.capturedAt) as Array<
      Record<string, string | number | bigint | null>
    >;
    if (existingBalances.length === 0 && existingHoldings.length === 0) return "new";

    const same = (
      left: string | number | bigint | null | undefined,
      right: string | number | bigint | null | undefined
    ) => String(left ?? "") === String(right ?? "");
    const balanceMatches = existingBalances.some((row) =>
      same(row.amount_minor, balance.amountMinor)
      && row.currency === balance.currency
      && same(row.owner, balance.owner)
    );
    const symbols = new Set(holdings.map((holding) => holding.symbol));
    const existingSymbols = new Set(
      existingHoldings.map((holding) => String(holding.symbol))
    );
    const holdingsMatch = symbols.size === existingSymbols.size
      && [...symbols].every((symbol) => existingSymbols.has(symbol))
      && holdings.every((holding) => existingHoldings.some((row) =>
        row.symbol === holding.symbol
        && same(row.name, holding.name)
        && same(row.quantity_atomic, holding.quantityAtomic)
        && same(row.atomic_decimals, holding.atomicDecimals)
        && same(row.price_minor, holding.priceMinor)
        && same(row.currency, holding.currency)
        && same(row.price_atomic, holding.priceAtomic)
        && same(row.price_decimals, holding.priceDecimals)
        && same(row.price_currency, holding.priceCurrency)
        && same(row.market_value_minor, holding.marketValueMinor)
        && same(row.market_value_currency, holding.marketValueCurrency)
        && same(row.owner, holding.owner)
      ));
    return balanceMatches && holdingsMatch ? "equivalent" : "conflict";
  }

  listSources(): Record<string, unknown>[] {
    return this.db.prepare(`
      SELECT id, kind, enabled, state, message, last_attempt_at, last_success_at, next_due_at
      FROM sources ORDER BY id
    `).all() as Record<string, unknown>[];
  }

  latestBalanceCapturedAt(sourceId: string): string | undefined {
    const row = this.db.prepare(`
      SELECT max(captured_at) AS captured_at FROM balances WHERE source_id=?
    `).get(sourceId) as { captured_at: string | null } | undefined;
    return row?.captured_at ?? undefined;
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

  listRecurringExpenseDecisions(): RecurringExpenseDecisionRecord[] {
    const rows = this.db.prepare(`
      SELECT candidate_key, decision, evidence_hash, fingerprint_version,
        created_at, updated_at
      FROM recurring_expense_decisions
      ORDER BY candidate_key
    `).all() as Array<{
      candidate_key: string;
      decision: RecurringExpenseDecision;
      evidence_hash: string;
      fingerprint_version: number;
      created_at: string;
      updated_at: string;
    }>;
    return rows.map((row) => ({
      candidateKey: row.candidate_key,
      decision: row.decision,
      evidenceHash: row.evidence_hash,
      fingerprintVersion: row.fingerprint_version,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  setRecurringExpenseDecision(
    candidateKey: string,
    decision: RecurringExpenseDecision,
    evidenceHash: string,
    fingerprintVersion = 1,
    now = new Date()
  ): RecurringExpenseDecisionRecord {
    const timestamp = now.toISOString();
    this.db.prepare(`
      INSERT INTO recurring_expense_decisions(
        candidate_key, decision, evidence_hash, fingerprint_version, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(candidate_key) DO UPDATE SET
        decision=excluded.decision,
        evidence_hash=excluded.evidence_hash,
        fingerprint_version=excluded.fingerprint_version,
        updated_at=excluded.updated_at
    `).run(candidateKey, decision, evidenceHash, fingerprintVersion, timestamp, timestamp);
    return this.listRecurringExpenseDecisions()
      .find((row) => row.candidateKey === candidateKey)!;
  }

  listRecurringExpenseOptimizations(): RecurringExpenseOptimizationRecord[] {
    const rows = this.db.prepare(`
      SELECT candidate_key, evidence_hash, status, effective_date,
        expected_annual_savings_minor, priority, created_at, updated_at
      FROM recurring_expense_optimizations
      ORDER BY candidate_key
    `).all() as Array<{
      candidate_key: string;
      evidence_hash: string;
      status: RecurringExpenseOptimizationStatus;
      effective_date: string | null;
      expected_annual_savings_minor: number | null;
      priority: RecurringExpenseOptimizationPriority | null;
      created_at: string;
      updated_at: string;
    }>;
    return rows.map((row) => ({
      candidateKey: row.candidate_key,
      evidenceHash: row.evidence_hash,
      status: row.status,
      effectiveDate: row.effective_date,
      expectedAnnualSavingsMinor: row.expected_annual_savings_minor,
      priority: row.priority,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  setRecurringExpenseOptimization(
    candidateKey: string,
    evidenceHash: string,
    status: RecurringExpenseOptimizationStatus,
    effectiveDate: string | null,
    expectedAnnualSavingsMinor: number | null,
    priority: RecurringExpenseOptimizationPriority | null,
    now = new Date()
  ): RecurringExpenseOptimizationRecord {
    const timestamp = now.toISOString();
    this.db.prepare(`
      INSERT INTO recurring_expense_optimizations(
        candidate_key, evidence_hash, status, effective_date,
        expected_annual_savings_minor, priority, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(candidate_key) DO UPDATE SET
        evidence_hash=excluded.evidence_hash,
        status=excluded.status,
        effective_date=excluded.effective_date,
        expected_annual_savings_minor=excluded.expected_annual_savings_minor,
        priority=excluded.priority,
        updated_at=excluded.updated_at
    `).run(
      candidateKey,
      evidenceHash,
      status,
      effectiveDate,
      expectedAnnualSavingsMinor,
      priority,
      timestamp,
      timestamp
    );
    return this.listRecurringExpenseOptimizations()
      .find((row) => row.candidateKey === candidateKey)!;
  }

  listMerchantAliases(): Array<{ fromKey: string; toLabel: string; createdAt: string; updatedAt: string }> {
    const rows = this.db.prepare(`
      SELECT from_key, to_label, created_at, updated_at
      FROM merchant_aliases
      ORDER BY to_label, from_key
    `).all() as Array<{
      from_key: string;
      to_label: string;
      created_at: string;
      updated_at: string;
    }>;
    return rows.map((row) => ({
      fromKey: row.from_key,
      toLabel: row.to_label,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  setMerchantAlias(fromKey: string, toLabel: string, now = new Date()): { fromKey: string; toLabel: string } {
    const timestamp = now.toISOString();
    this.db.prepare(`
      INSERT INTO merchant_aliases(from_key, to_label, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(from_key) DO UPDATE SET
        to_label=excluded.to_label,
        updated_at=excluded.updated_at
    `).run(fromKey, toLabel, timestamp, timestamp);
    return { fromKey, toLabel };
  }

  listMerchantRules(): Array<{ pattern: string; label: string }> {
    const rows = this.db.prepare(`
      SELECT pattern, label
      FROM merchant_rules
      ORDER BY label, pattern
    `).all() as Array<{ pattern: string; label: string }>;
    return rows;
  }

  setMerchantRule(pattern: string, label: string, now = new Date()): { pattern: string; label: string } {
    const timestamp = now.toISOString();
    this.db.prepare(`
      INSERT INTO merchant_rules(pattern, label, created_at, updated_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(pattern) DO UPDATE SET
        label=excluded.label,
        updated_at=excluded.updated_at
    `).run(pattern, label, timestamp, timestamp);
    return { pattern, label };
  }

  deleteMerchantRule(pattern: string): boolean {
    return this.db.prepare(`DELETE FROM merchant_rules WHERE pattern = ?`).run(pattern).changes > 0;
  }

  listLifeEvents(): LifeEvent[] {
    return this.db.prepare(`
      SELECT id, name, start_month AS startMonth, monthly_change_minor AS monthlyChangeMinor, created_at AS createdAt
      FROM life_events ORDER BY start_month, name
    `).all() as unknown as LifeEvent[];
  }

  saveLifeEvent(event: LifeEvent): LifeEvent {
    this.db.prepare(`
      INSERT INTO life_events(id, name, start_month, monthly_change_minor, created_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        start_month=excluded.start_month,
        monthly_change_minor=excluded.monthly_change_minor
    `).run(event.id, event.name, event.startMonth, event.monthlyChangeMinor, event.createdAt);
    return event;
  }

  deleteLifeEvent(id: string): boolean {
    return this.db.prepare(`DELETE FROM life_events WHERE id = ?`).run(id).changes > 0;
  }

  listMonthCloses(): Array<{
    month: string;
    note: string;
    closedAt: string;
    snapshot: Record<string, number> | null;
    checklist: { payrollReviewed: boolean; cardReviewed: boolean } | null;
  }> {
    const rows = this.db.prepare(`
      SELECT month, note, closed_at AS closedAt, snapshot_json AS snapshotJson,
        checklist_json AS checklistJson
      FROM month_closes ORDER BY month DESC
    `).all() as Array<{
      month: string;
      note: string;
      closedAt: string;
      snapshotJson: string | null;
      checklistJson: string | null;
    }>;
    return rows.map((row) => ({
      month: row.month,
      note: row.note,
      closedAt: row.closedAt,
      snapshot: row.snapshotJson ? JSON.parse(row.snapshotJson) as Record<string, number> : null,
      checklist: row.checklistJson ? JSON.parse(row.checklistJson) as { payrollReviewed: boolean; cardReviewed: boolean } : null
    }));
  }

  closeMonth(
    month: string,
    note: string,
    snapshot: Record<string, number>,
    checklist: { payrollReviewed: boolean; cardReviewed: boolean },
    now = new Date()
  ) {
    const closedAt = now.toISOString();
    this.db.prepare(`
      INSERT INTO month_closes(month, note, closed_at, snapshot_json, checklist_json)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(month) DO UPDATE SET note=excluded.note, closed_at=excluded.closed_at,
        snapshot_json=excluded.snapshot_json, checklist_json=excluded.checklist_json
    `).run(month, note.slice(0, 200), closedAt, JSON.stringify(snapshot), JSON.stringify(checklist));
    return { month, note: note.slice(0, 200), closedAt, snapshot, checklist };
  }

  listNamedScenarios(): NamedScenario[] {
    const rows = this.db.prepare(`
      SELECT payload FROM named_scenarios ORDER BY updated_at DESC, name
    `).all() as Array<{ payload: string }>;
    return rows.map((row) => parseNamedScenario(JSON.parse(row.payload)));
  }

  saveNamedScenario(scenario: NamedScenario): NamedScenario {
    this.db.prepare(`
      INSERT INTO named_scenarios(id, name, payload, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name=excluded.name,
        payload=excluded.payload,
        updated_at=excluded.updated_at
    `).run(scenario.id, scenario.name, JSON.stringify(scenario), scenario.createdAt, scenario.updatedAt);
    return scenario;
  }

  deleteNamedScenario(id: string): boolean {
    const result = this.db.prepare(`DELETE FROM named_scenarios WHERE id = ?`).run(id);
    return result.changes > 0;
  }

  close(): void {
    this.db.close();
  }
}
