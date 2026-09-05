import type { FinanceDatabase } from "./database.js";
import { createHash } from "node:crypto";
import type { ImportBundle } from "./types.js";

/** Durable stage receipt, no raw payloads or error messages. Retried by the existing source sync. */
export class PublishJournal {
  readonly key: string;
  constructor(private db: FinanceDatabase, sourceId: string, bundle: ImportBundle) {
    const digest = createHash("sha256").update(JSON.stringify({
      transactions: bundle.transactions, activities: bundle.activities,
      holdings: bundle.holdings, balances: bundle.balances
    }, (_, value) => typeof value === "bigint" ? value.toString() : value)).digest("hex");
    this.key = `publish:${sourceId}`;
    const previous = db.getSetting(this.key);
    const before = previous ? JSON.parse(previous) : undefined;
    db.setSetting(this.key, JSON.stringify({digest, state:"PENDING", stages:{}, attempts:(before?.attempts ?? 0)+1, updatedAt:new Date().toISOString()}));
  }
  private update(stage: string, state: string): void {
    const value = JSON.parse(this.db.getSetting(this.key)!);
    value.stages[stage] = state;
    value.state = state === "ERROR" ? "ERROR" : "PENDING";
    value.updatedAt = new Date().toISOString();
    this.db.setSetting(this.key,JSON.stringify(value));
  }
  async stage<T>(name: string, operation: () => Promise<T>): Promise<T> {
    this.update(name,"PENDING");
    try { const result = await operation(); this.update(name,"SUCCESS"); return result; }
    catch(error) { this.update(name,"ERROR"); throw error; }
  }
  complete(): void {
    const value = JSON.parse(this.db.getSetting(this.key)!);
    value.state="SUCCESS";value.updatedAt=new Date().toISOString();
    this.db.setSetting(this.key,JSON.stringify(value));
  }
}
