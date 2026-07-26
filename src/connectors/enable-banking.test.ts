import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

test("aktuelle Sitzung, Saldo, Vorzeichen und Folgeseiten werden verarbeitet", async () => {
  const secrets = mkdtempSync(join(tmpdir(), "finance-sync-enable-banking-"));
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  writeFileSync(
    join(secrets, "enable-banking-private-key.pem"),
    privateKey.export({ type: "pkcs8", format: "pem" }),
    { mode: 0o600 }
  );
  process.env.FINANCE_SECRETS_DIR = secrets;

  const requested: string[] = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    requested.push(`${url.pathname}${url.search}`);
    assert.match(
      new Headers(init?.headers).get("authorization") ?? "",
      /^Bearer [^.]+\.[^.]+\.[^.]+$/
    );
    if (url.pathname === "/sessions/session") {
      return Response.json({
        status: "AUTHORIZED",
        accounts: ["uid-1"],
        accounts_data: [{
          uid: "uid-1",
          identification_hash: "stable-account",
          identification_hashes: ["stable-account", "alternate-account"]
        }]
      });
    }
    if (url.pathname === "/accounts/uid-1/details") {
      return Response.json({
        uid: "uid-1",
        account_id: { iban: "DE001234" },
        currency: "EUR"
      });
    }
    if (url.pathname === "/accounts/uid-1/balances") {
      return Response.json({
        balances: [{
          balance_type: "CLAV",
          reference_date: "2026-07-26",
          balance_amount: { amount: "123.45", currency: "EUR" }
        }]
      });
    }
    if (
      url.pathname === "/accounts/uid-1/transactions"
      && !url.searchParams.has("continuation_key")
    ) {
      return Response.json({
        transactions: [{
          entry_reference: "debit",
          transaction_amount: { amount: "10.00", currency: "EUR" },
          credit_debit_indicator: "DBIT",
          booking_date: "2026-07-25",
          creditor: { name: "Shop" }
        }],
        continuation_key: "next-page"
      });
    }
    if (
      url.pathname === "/accounts/uid-1/transactions"
      && url.searchParams.get("continuation_key") === "next-page"
    ) {
      return Response.json({
        transactions: [{
          entry_reference: "credit",
          transaction_amount: { amount: "20.00", currency: "EUR" },
          credit_debit_indicator: "CRDT",
          booking_date: "2026-07-26",
          debtor: { name: "Employer" }
        }]
      });
    }
    return new Response(null, { status: 404 });
  };

  try {
    const { fetchEnableBanking } = await import("./enable-banking.js");
    const bundle = await fetchEnableBanking(
      {
        id: "bank",
        kind: "enable-banking",
        enabled: true,
        owners: ["Fallback"],
        settings: {
          applicationId: "app-id",
          dateFrom: "2026-07-01",
          dateTo: "2026-07-26",
          ownersByAccount: { "stable-account": ["Erik"] }
        }
      },
      "session"
    );

    assert.equal(bundle.balances?.length, 1);
    assert.equal(bundle.balances?.[0].amountMinor, 12345n);
    assert.equal(bundle.balances?.[0].owner, "Erik");
    assert.deepEqual(
      bundle.transactions?.map(({ amountMinor }) => amountMinor),
      [-1000n, 2000n]
    );
    assert.deepEqual(
      bundle.transactions?.map(({ payee }) => payee),
      ["Shop", "Employer"]
    );
    assert.ok(
      requested.includes(
        "/accounts/uid-1/transactions?transaction_status=BOOK&date_from=2026-07-01&date_to=2026-07-26&continuation_key=next-page"
      )
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
