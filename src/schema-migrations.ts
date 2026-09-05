import type { DatabaseSync } from "node:sqlite";

export interface SchemaMigration { version: number; name: string; up(): void }

export function migrateSchema(db: DatabaseSync, migrations: SchemaMigration[]): void {
  const version = Number((db.prepare("PRAGMA user_version").get() as { user_version: number }).user_version);
  const supported = migrations.at(-1)?.version ?? 0;
  if (version > supported) throw new Error("Datenbankschema ist neuer als diese FinanceSync-Version. Bitte passenden Release oder Sicherung verwenden.");
  for (const migration of migrations) {
    if (migration.version <= version) continue;
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec("CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL,applied_at TEXT NOT NULL)");
      migration.up();
      db.prepare("INSERT INTO schema_migrations VALUES(?,?,?)").run(migration.version, migration.name, new Date().toISOString());
      db.exec(`PRAGMA user_version=${migration.version}; COMMIT`);
    } catch (error) { db.exec("ROLLBACK"); throw error; }
  }
}
