import { createHash, randomBytes } from "node:crypto";
export const SESSION_SECONDS = 8 * 3600;
export const TRUSTED_SECONDS = 90 * 24 * 3600;
export const SESSION_STORE_KEY = "security:browser-sessions:v1";
interface Store { getSetting(key: string): string | undefined; setSetting(key: string, value: string): void }
export type SessionRole = "admin" | "viewer";
interface Session { id: string; expires: number; created: number; tokenHash: string; trusted: boolean; role?: SessionRole }
/** Persist credential hashes only, never the cookie or management token. */
export class BrowserSessions {
  private memory: Session[] = [];
  constructor(private store?: Store) {}
  private read(): Session[] {
    if (!this.store) return this.memory;
    try {
      const rows: unknown = JSON.parse(this.store.getSetting(SESSION_STORE_KEY) ?? "[]");
      if (!Array.isArray(rows)) return [];
      return rows.filter((s): s is Session => s && /^[a-f0-9]{64}$/.test(s.id)
        && /^[a-f0-9]{64}$/.test(s.tokenHash) && Number.isFinite(s.expires)
        && Number.isFinite(s.created) && typeof s.trusted === "boolean"
        && (s.role === undefined || s.role === "admin" || s.role === "viewer")).slice(-100);
    } catch { return []; }
  }
  private write(rows: Session[]): void {
    if (this.store) this.store.setSetting(SESSION_STORE_KEY, JSON.stringify(rows));
    else this.memory = rows;
  }
  create(token: string, now = Date.now(), trusted = false, role: SessionRole = "admin"): string {
    const rows = this.read().filter(s => s.expires > now && s.tokenHash === this.hash(token)).slice(-99);
    const credential = randomBytes(32).toString("hex");
    rows.push({ id: this.hash(credential), expires: now + (trusted ? TRUSTED_SECONDS : SESSION_SECONDS) * 1000,
      created: now, tokenHash: this.hash(token), trusted, role });
    this.write(rows);
    return credential;
  }
  private cookieId(cookie?: string): string | undefined {
    const credential = /(?:^|;\s*)finance_session=([a-f0-9]{64})(?:;|$)/.exec(cookie ?? "")?.[1];
    return credential ? this.hash(credential) : undefined;
  }
  role(cookie: string | undefined, token: string, now = Date.now()): SessionRole | undefined {
    if (!token) return undefined;
    const session = this.read().find(s => s.id === this.cookieId(cookie) && s.expires > now && s.tokenHash === this.hash(token));
    return session?.role ?? (session ? "admin" : undefined);
  }
  valid(cookie: string | undefined, token: string, now = Date.now()): boolean {
    return this.role(cookie, token, now) !== undefined;
  }
  list(cookie: string | undefined, token: string, now = Date.now()) {
    return this.read().filter(s => s.expires > now && s.tokenHash === this.hash(token))
      .map(s => ({ id: s.id, createdAt: new Date(s.created).toISOString(), expiresAt: new Date(s.expires).toISOString(),
        trusted: s.trusted, current: s.id === this.cookieId(cookie) }));
  }
  revoke(id: string): void { this.write(this.read().filter(s => s.id !== id)); }
  private hash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
}
