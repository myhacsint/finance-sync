import { existsSync, mkdirSync, renameSync, unlinkSync } from "node:fs";
import { dirname } from "node:path";
import type { FinanceDatabase } from "./database.js";

export function snapshotSqlite(db: FinanceDatabase, target: string): void {
  mkdirSync(dirname(target), { recursive: true });
  const temp = `${target}.tmp-${process.pid}`;
  if (existsSync(temp)) unlinkSync(temp);
  db.db.prepare("VACUUM INTO ?").run(temp);
  renameSync(temp, target);
}
