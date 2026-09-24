import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import type { SessionRole } from "./browser-sessions.js";

interface OidcConfig { issuer: string; baseUrl: string; clientId: string; clientSecret: string }
interface Discovery {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  token_endpoint_auth_methods_supported?: string[];
}
interface Pending { cookie: string; nonce: string; verifier: string; expires: number }

export class OidcLogin {
  private discovery?: Promise<Discovery>;
  private pending = new Map<string, Pending>();
  private readonly issuer: string;
  private readonly redirectUri: string;
  constructor(private config: OidcConfig) {
    this.issuer = config.issuer.replace(/\/$/, "");
    this.redirectUri = new URL("/auth/oidc/callback", config.baseUrl).toString();
    for (const value of [this.issuer, config.baseUrl]) {
      const url = new URL(value);
      if (url.protocol !== "https:" && !(url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))) {
        throw new Error("OIDC erfordert HTTPS");
      }
    }
  }
  private async metadata(): Promise<Discovery> {
    if (!this.discovery) this.discovery = (async () => {
      const response = await fetch(`${this.issuer}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) throw new Error("OIDC-Discovery nicht verfügbar");
      const metadata = await response.json() as Discovery;
      if (metadata.issuer !== this.issuer) throw new Error("OIDC-Issuer ungültig");
      for (const endpoint of [metadata.authorization_endpoint, metadata.token_endpoint, metadata.jwks_uri]) {
        if (new URL(endpoint).origin !== new URL(this.issuer).origin) throw new Error("OIDC-Endpunkt ungültig");
      }
      return metadata;
    })().catch(error => { this.discovery = undefined; throw error; });
    return this.discovery;
  }
  private random(): string { return randomBytes(32).toString("base64url"); }
  private cleanup(): void {
    const now = Date.now();
    for (const [key, pending] of this.pending) if (pending.expires <= now) this.pending.delete(key);
  }
  async begin(): Promise<{ authorizationUrl: string; cookie: string }> {
    const metadata = await this.metadata();
    this.cleanup();
    while (this.pending.size >= 500) this.pending.delete(this.pending.keys().next().value!);
    const state = this.random(), cookieValue = this.random(), nonce = this.random(), verifier = this.random();
    this.pending.set(state, { cookie: cookieValue, nonce, verifier, expires: Date.now() + 600_000 });
    const url = new URL(metadata.authorization_endpoint);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", this.config.clientId);
    url.searchParams.set("redirect_uri", this.redirectUri);
    url.searchParams.set("scope", "openid profile email groups");
    url.searchParams.set("state", state);
    url.searchParams.set("nonce", nonce);
    url.searchParams.set("code_challenge", createHash("sha256").update(verifier).digest("base64url"));
    url.searchParams.set("code_challenge_method", "S256");
    return { authorizationUrl: url.toString(), cookie: `oidc_login=${cookieValue}; HttpOnly; SameSite=Lax; Path=/auth/oidc; Max-Age=600${this.redirectUri.startsWith("https:") ? "; Secure" : ""}` };
  }
  async finish(code: string, state: string, cookieHeader: string | undefined): Promise<SessionRole> {
    this.cleanup();
    const pending = this.pending.get(state);
    this.pending.delete(state);
    const cookie = /(?:^|;\s*)oidc_login=([A-Za-z0-9_-]+)(?:;|$)/.exec(cookieHeader ?? "")?.[1] ?? "";
    if (!pending || !cookie || !timingSafeEqual(Buffer.from(createHash("sha256").update(cookie).digest()), Buffer.from(createHash("sha256").update(pending.cookie).digest()))) {
      throw new Error("OIDC-State ungültig");
    }
    if (!code) throw new Error("OIDC-Code fehlt");
    const metadata = await this.metadata();
    const methods = metadata.token_endpoint_auth_methods_supported ?? ["client_secret_basic"];
    const form = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: this.redirectUri, code_verifier: pending.verifier });
    const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
    if (methods.includes("client_secret_post")) {
      form.set("client_id", this.config.clientId);
      form.set("client_secret", this.config.clientSecret);
    } else if (methods.includes("client_secret_basic")) {
      headers.authorization = `Basic ${Buffer.from(`${this.config.clientId}:${this.config.clientSecret}`).toString("base64")}`;
    } else throw new Error("OIDC-Clientauthentifizierung nicht unterstützt");
    const response = await fetch(metadata.token_endpoint, { method: "POST", headers, body: form, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("OIDC-Tokenaustausch fehlgeschlagen");
    const tokens = await response.json() as { id_token?: string };
    if (!tokens.id_token) throw new Error("OIDC-ID-Token fehlt");
    const { payload } = await jwtVerify(tokens.id_token, createRemoteJWKSet(new URL(metadata.jwks_uri), { timeoutDuration: 10_000 }), {
      issuer: this.issuer, audience: this.config.clientId, requiredClaims: ["nonce", "exp"]
    });
    if (payload.nonce !== pending.nonce) throw new Error("OIDC-Nonce ungültig");
    if (!Array.isArray(payload.groups) || !payload.groups.every(group => typeof group === "string")) throw new Error("Kein Zugang");
    if (payload.groups.includes("admin")) return "admin";
    if (payload.groups.includes("family")) return "viewer";
    throw new Error("Kein Zugang");
  }
}
