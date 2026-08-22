import assert from "node:assert/strict";
import test from "node:test";
import { parseMilesMoreStatement } from "./miles-more-statement.js";

const sample = `
03.07.2026 06.07.2026 GITHUB, SAN FRANCISCO, CA USD -12,00 1,13744 -10,55
AUSLANDSEINSATZENTGELT -0,21
Meilen +5
06.07.2026 07.07.2026 STRIPE-Z.AI, SINGAPORE USD -10,00 1,14155 -8,76
AUSLANDSEINSATZENTGELT -0,17
09.07.2026 10.07.2026 Gut Huegle GmbH, Ravensburg, DEU -1.270,48
Saldo -1.290,17
`;

test("Miles-&-More-Abrechnung faltet Gebühren ein und gleicht den Saldo ab", () => {
  const result = parseMilesMoreStatement(sample, "2026-08-03");
  assert.equal(result.balanceMinor, -129017);
  assert.equal(result.transactions.length, 3);
  assert.deepEqual(
    result.transactions.map((item) => [item.payee, item.amountMinor, item.foreignFeeMinor]),
    [
      ["GitHub", -1076, -21],
      ["Z.AI", -893, -17],
      ["Gut Huegle GmbH, Ravensburg", -127048, 0]
    ]
  );
  assert.equal(result.transactions[0].categoryName, "Homelab & IT");
  assert.match(result.transactions[0].importedId, /^miles-more:2026-08-03:[a-f0-9]{24}$/);
});

test("Miles-&-More-Abrechnung bricht bei einer nicht aufgehenden Summe ab", () => {
  assert.throws(
    () => parseMilesMoreStatement(sample.replace("Saldo -1.290,17", "Saldo -1.290,18"), "2026-08-03"),
    /Abrechnung stimmt nicht/
  );
});
