import { createHash, randomBytes } from "node:crypto";

export class BrowserSessions {
  private sessions = new Map<string, { expires: number; tokenHash: string }>();
  create(token: string, now = Date.now()): string {
    for (const [id, session] of this.sessions) if (session.expires <= now) this.sessions.delete(id);
    if (this.sessions.size >= 100) this.sessions.delete(this.sessions.keys().next().value!);
    const id = randomBytes(32).toString("hex");
    this.sessions.set(id, { expires: now + 8 * 3600_000, tokenHash: this.hash(token) });
    return id;
  }
  valid(cookie: string | undefined, token: string, now = Date.now()): boolean {
    const id = /(?:^|;\s*)finance_session=([a-f0-9]{64})(?:;|$)/.exec(cookie ?? "")?.[1];
    const session = id ? this.sessions.get(id) : undefined;
    return Boolean(token && session && session.expires > now && session.tokenHash === this.hash(token));
  }
  private hash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
}
