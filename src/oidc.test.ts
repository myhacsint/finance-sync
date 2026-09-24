import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { OidcLogin } from "./oidc.js";

async function issuerFixture() {
  const { publicKey, privateKey } = await generateKeyPair("RS256");
  const jwk = { ...await exportJWK(publicKey), kid: "test-key", alg: "RS256", use: "sig" };
  let claims: Record<string, unknown> = { groups: ["family"] };
  let nonce = "";
  let discovered = 0;
  let authorization = "";
  let badSignature = false;
  const server = createServer(async (req, res) => {
    const issuer = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    res.setHeader("content-type", "application/json");
    if (req.url === "/.well-known/openid-configuration") {
      discovered++;
      res.end(JSON.stringify({ issuer, authorization_endpoint: issuer + "/authorize", token_endpoint: issuer + "/token", jwks_uri: issuer + "/jwks", token_endpoint_auth_methods_supported: ["client_secret_post"] }));
    } else if (req.url === "/jwks") res.end(JSON.stringify({ keys: [jwk] }));
    else if (req.url === "/token") {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const params = new URLSearchParams(Buffer.concat(chunks).toString());
      assert.equal(params.get("client_id"), "test-client");
      assert.equal(params.get("client_secret"), "test-secret");
      assert.equal(params.get("code_verifier")?.length, 43);
      const key = badSignature ? (await generateKeyPair("RS256")).privateKey : privateKey;
      const signer = new SignJWT({ ...claims, nonce: claims.nonce ?? nonce }).setProtectedHeader({ alg: "RS256", kid: "test-key" })
        .setIssuer(String(claims.iss ?? issuer)).setAudience(String(claims.aud ?? "test-client")).setIssuedAt();
      if (!claims.noExp) signer.setExpirationTime(Number(claims.exp ?? Math.floor(Date.now() / 1000) + 300));
      const token = await signer.sign(key);
      res.end(JSON.stringify({ id_token: token }));
    } else { authorization = req.url ?? ""; res.end("{}"); }
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const issuer = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  const login = new OidcLogin({ issuer, baseUrl: "https://finance.example", clientId: "test-client", clientSecret: "test-secret" });
  return {
    login, issuer, get discovered() { return discovered; }, get authorization() { return authorization; },
    setClaims(next: Record<string, unknown>) { claims = next; }, setNonce(value: string) { nonce = value; },
    badSignature() { badSignature = true; }, close: () => new Promise<void>(resolve => server.close(() => resolve()))
  };
}

test("OIDC login uses PKCE, nonce, state and cached discovery; grants admin and viewer", async () => {
  const fixture = await issuerFixture();
  try {
    for (const [groups, role] of [[["admin"], "admin"], [["family"], "viewer"]] as const) {
      fixture.setClaims({ groups });
      const { authorizationUrl, cookie } = await fixture.login.begin();
      const url = new URL(authorizationUrl);
      assert.equal(url.searchParams.get("scope"), "openid profile email groups");
      assert.equal(url.searchParams.get("code_challenge_method"), "S256");
      assert.equal(url.searchParams.get("redirect_uri"), "https://finance.example/auth/oidc/callback");
      assert.match(cookie, /HttpOnly; SameSite=Lax/);
      fixture.setNonce(url.searchParams.get("nonce")!);
      assert.equal(await fixture.login.finish("code", url.searchParams.get("state")!, cookie), role);
    }
    assert.equal(fixture.discovered, 1);
  } finally { await fixture.close(); }
});

test("OIDC bounds pending login state and evicts oldest flow", async () => {
  const fixture = await issuerFixture();
  try {
    const first = await fixture.login.begin();
    for (let index = 0; index < 500; index++) await fixture.login.begin();
    const state = new URL(first.authorizationUrl).searchParams.get("state")!;
    fixture.setNonce(new URL(first.authorizationUrl).searchParams.get("nonce")!);
    await assert.rejects(fixture.login.finish("code", state, first.cookie));
  } finally { await fixture.close(); }
});

test("OIDC rejects missing groups, state/cookie mismatch, nonce, audience, issuer, expiry and signature", async () => {
  const fixture = await issuerFixture();
  try {
    for (const claims of [{ groups: [] }, { groups: ["family"], nonce: "wrong" },
      { groups: ["family"], aud: "wrong" }, { groups: ["family"], iss: "https://wrong.example" },
      { groups: ["family"], exp: 1 }, { groups: ["family"], noExp: true },
      { groups: ["family"], signature: "wrong" }]) {
      fixture.setClaims(claims);
      if (claims.signature) fixture.badSignature();
      const { authorizationUrl, cookie } = await fixture.login.begin();
      const url = new URL(authorizationUrl);
      fixture.setNonce(url.searchParams.get("nonce")!);
      await assert.rejects(fixture.login.finish("code", url.searchParams.get("state")!, cookie));
    }
    const { authorizationUrl, cookie } = await fixture.login.begin();
    const state = new URL(authorizationUrl).searchParams.get("state")!;
    await assert.rejects(fixture.login.finish("code", "wrong", cookie));
    await assert.rejects(fixture.login.finish("code", state, "oidc_login=wrong"));
  } finally { await fixture.close(); }
});
