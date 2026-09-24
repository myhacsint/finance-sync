import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:http";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";

const source = readFileSync(new URL("../src/server.ts", import.meta.url), "utf8");
const uuid = "00000000-0000-0000-0000-000000000000";
const recurring = "recurring-000000000000000000";
const dynamic: Record<string, string> = {
  revokedSession: `/api/sessions/${"0".repeat(64)}`, cardMatch: `/api/card-documents/previews/${uuid}/confirm`,
  sutorConfirm: `/api/sutor-documents/previews/${uuid}/confirm`, sutorPreview: `/api/sutor-documents/previews/${uuid}`,
  pensionField: `/api/pension-documents/previews/${uuid}/fields/Value`,
  pensionFirePreview: `/api/pension-documents/previews/${uuid}/fire-preview`,
  pensionConfirm: `/api/pension-documents/previews/${uuid}/confirm`, pensionPreview: `/api/pension-documents/previews/${uuid}`,
  ruleDelete: "/api/dashboard/merchant-rules/x", eventDelete: "/api/dashboard/events/x",
  scenarioDelete: "/api/dashboard/scenarios/x", newsletterState: "/api/dashboard/investment-newsletters/x/state",
  recurringDecisionMatch: `/api/decisions/recurring-expenses/${recurring}`,
  recurringOptimizationMatch: `/api/decisions/recurring-expenses/${recurring}/optimization`,
  syncMatch: "/api/sync/x", authMatch: "/api/enable-banking/start/x",
  dkbPreflightMatch: "/api/dkb-fints/preflight/x", dkbContinueMatch: "/api/dkb-fints/continue/x"
};
function writeRoutes(): [string, string][] {
  const routes: [string, string][] = [];
  const routePattern = /if\s*\(\s*req\.method\s*===\s*["'](POST|PUT|PATCH|DELETE)["']\s*&&\s*([^\n)]*(?:\([^\n)]*\))?)/g;
  for (const match of source.matchAll(routePattern)) {
    const method = match[1], condition = match[2];
    const literal = /url\.pathname\s*===?\s*["']([^"']+)/.exec(condition);
    const variable = /^(\w+)/.exec(condition)?.[1];
    const path = literal?.[1] ?? (variable ? dynamic[variable] : undefined)
      ?? (condition.includes("cardMatch") ? `/api/card-documents/previews/${uuid}` : undefined)
      ?? (condition.includes("saved-views") ? "/api/dashboard/saved-views" : undefined);
    assert.ok(path, `Unmapped ${method}: ${condition}`);
    routes.push([method, condition.includes("!cardMatch[2]") || method === "DELETE" && variable === "cardMatch"
      ? `/api/card-documents/previews/${uuid}` : method === "DELETE" && condition.includes("saved-views")
        ? `/api/dashboard/saved-views/${uuid}` : path]);
  }
  return routes;
}

async function freePort(): Promise<number> {
  const server = createServer();
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  return port;
}
async function fixture(oidc = false, omit?: "FINANCE_OIDC_ISSUER" | "FINANCE_OIDC_BASE_URL" | "oidc-client-id" | "oidc-client-secret") {
  const root = mkdtempSync(join(tmpdir(), "finance-auth-test-"));
  const secrets = join(root, "test-credentials");
  mkdirSync(secrets);
  writeFileSync(join(secrets, "admin-token"), "test-admin-token");
  writeFileSync(join(secrets, "hq-read-token"), "test-hq-token");
  let provider: ReturnType<typeof createServer> | undefined;
  let groups: string[] = ["family"];
  let nonce = "";
  if (oidc) {
    const { privateKey, publicKey } = await generateKeyPair("RS256");
    const jwk = { ...await exportJWK(publicKey), alg: "RS256", kid: "key1", use: "sig" };
    provider = createServer(async (req, res) => {
      const issuer = `http://127.0.0.1:${(provider!.address() as { port: number }).port}`;
      res.setHeader("content-type", "application/json");
      if (req.url === "/.well-known/openid-configuration") res.end(JSON.stringify({ issuer, authorization_endpoint: issuer + "/authorize", token_endpoint: issuer + "/token", jwks_uri: issuer + "/jwks", token_endpoint_auth_methods_supported: ["client_secret_basic"] }));
      else if (req.url === "/jwks") res.end(JSON.stringify({ keys: [jwk] }));
      else if (req.url === "/token") {
        assert.match(String(req.headers.authorization), /^Basic /);
        const token = await new SignJWT({ groups, nonce }).setProtectedHeader({ alg: "RS256", kid: "key1" })
          .setIssuer(issuer).setAudience("test-client").setIssuedAt().setExpirationTime("5m").sign(privateKey);
        res.end(JSON.stringify({ id_token: token }));
      } else res.end("{}");
    });
    await new Promise<void>(resolve => provider!.listen(0, "127.0.0.1", resolve));
    if (omit !== "oidc-client-id") writeFileSync(join(secrets, "oidc-client-id"), "test-client");
    if (omit !== "oidc-client-secret") writeFileSync(join(secrets, "oidc-client-secret"), "test-client-secret");
  }
  const port = await freePort();
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["--experimental-sqlite", new URL("./server.js", import.meta.url).pathname], {
    env: { ...process.env, PORT: String(port), FINANCE_DATA_DIR: join(root, "data"), FINANCE_ARCHIVE_DIR: join(root, "archive"), FINANCE_INBOX_DIR: join(root, "inbox"), FINANCE_SECRETS_DIR: secrets,
      FINANCE_OIDC_ISSUER: oidc && omit !== "FINANCE_OIDC_ISSUER" ? `http://127.0.0.1:${(provider!.address() as { port: number }).port}` : "",
      FINANCE_OIDC_BASE_URL: oidc && omit !== "FINANCE_OIDC_BASE_URL" ? base : "" }, stdio: "ignore"
  });
  for (let attempt = 0; attempt < 100; attempt++) {
    if (child.exitCode !== null) throw new Error("server exited");
    try { await fetch(base + "/health"); break; } catch { await new Promise(resolve => setTimeout(resolve, 50)); }
  }
  async function login(role: "admin" | "viewer" | "none") {
    groups = role === "none" ? [] : role === "admin" ? ["admin"] : ["family"];
    const start = await fetch(base + "/auth/oidc/login", { redirect: "manual" });
    const startCookie = start.headers.get("set-cookie")!.split(";")[0];
    const authorization = new URL(start.headers.get("location")!);
    nonce = authorization.searchParams.get("nonce")!;
    const callback = await fetch(base + `/auth/oidc/callback?code=test-code&state=${authorization.searchParams.get("state")}`, { headers: { cookie: startCookie }, redirect: "manual" });
    return { start, callback, cookie: callback.headers.getSetCookie().find(value => value.startsWith("finance_session="))?.split(";")[0] ?? "" };
  }
  return { base, child, login, async close() {
    child.kill("SIGTERM");
    await new Promise(resolve => child.once("exit", resolve));
    if (provider) await new Promise<void>(resolve => provider!.close(() => resolve()));
    rmSync(root, { recursive: true, force: true });
  } };
}

test("OIDC stays disabled if any required setting or secret is absent", async () => {
  for (const missing of ["FINANCE_OIDC_ISSUER", "FINANCE_OIDC_BASE_URL", "oidc-client-id", "oidc-client-secret"] as const) {
    const app = await fixture(true, missing);
    try {
      assert.equal((await fetch(app.base + "/auth/oidc/login")).status, 404, missing);
      assert.doesNotMatch(await (await fetch(app.base + "/")).text(), /Anmelden mit Pocket ID/);
    } finally { await app.close(); }
  }
});

test("optional OIDC stays disabled and token login continues; HQ token is overview-only", async () => {
  const app = await fixture();
  try {
    assert.equal((await fetch(app.base + "/auth/oidc/login")).status, 404);
    assert.equal((await fetch(app.base + "/auth/oidc/callback")).status, 404);
    const session = await fetch(app.base + "/api/session", { method: "POST", headers: { authorization: "Bearer test-admin-token", origin: app.base }, body: "{}" });
    assert.equal(session.status, 200);
    assert.equal((await fetch(app.base + "/api/sessions", { headers: { cookie: session.headers.get("set-cookie")!.split(";")[0] } })).status, 200);
    for (const [method, path, expected] of [["GET", "/api/dashboard/overview", 200], ["HEAD", "/api/dashboard/overview", 200], ["GET", "/api/status", 403], ["GET", "/health", 403], ["POST", "/api/backup", 403], ["POST", "/api/session", 401]] as const) {
      assert.equal((await fetch(app.base + path, { method, headers: { authorization: "Bearer test-hq-token" } })).status, expected, `${method} ${path}`);
    }
    assert.equal((await fetch(app.base + "/api/dashboard/overview", { headers: { authorization: "Bearer test-admin-token" } })).status, 200);
  } finally { await app.close(); }
});

test("OIDC admin and viewer access; viewer blocks every write route discovered from source", async () => {
  const app = await fixture(true);
  try {
    const admin = await app.login("admin");
    assert.equal(admin.callback.status, 200);
    assert.match(await admin.callback.clone().text(), /http-equiv="refresh" content="0;url=\/"/);
    assert.equal((await fetch(app.base + "/api/sessions", { headers: { cookie: admin.cookie } })).status, 200);
    assert.match(await (await fetch(app.base + "/", { headers: { cookie: admin.cookie } })).text(), /Anmelden mit Pocket ID/);
    const viewer = await app.login("viewer");
    assert.equal(viewer.callback.status, 200);
    assert.equal((await fetch(app.base + "/api/dashboard/overview", { headers: { cookie: viewer.cookie } })).status, 200);
    assert.deepEqual(await (await fetch(app.base + "/api/me", { headers: { cookie: viewer.cookie } })).json(), { role: "viewer" });
    assert.equal((await fetch(app.base + "/api/session", { method: "POST", headers: { cookie: viewer.cookie, origin: app.base }, body: "{}" })).status, 403);
    assert.equal((await fetch(app.base + "/api/v1/council/investment-cockpit", { headers: { cookie: viewer.cookie } })).status, 200);
    assert.equal((await fetch(app.base + "/auth/oidc/callback?code=x&state=wrong", { redirect: "manual" })).status, 400);
    assert.match(await (await fetch(app.base + "/", { headers: { cookie: viewer.cookie } })).text(), /data-role="viewer"/);
    for (const [method, path] of writeRoutes()) {
      const response = await fetch(app.base + path, { method, headers: { cookie: viewer.cookie, origin: app.base }, body: method === "DELETE" ? undefined : "{}" });
      assert.equal(response.status, 403, `${method} ${path}`);
      assert.deepEqual(await response.json(), { error: "Nur-Lesen-Zugang" });
    }
    for (const path of ["/api/sessions", "/callbacks/enable-banking?code=x&state=y"]) {
      assert.equal((await fetch(app.base + path, { headers: { cookie: viewer.cookie } })).status, 403);
    }
    assert.equal((await app.login("none")).callback.status, 403);
  } finally { await app.close(); }
});
