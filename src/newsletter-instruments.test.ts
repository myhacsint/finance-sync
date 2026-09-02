import assert from "node:assert/strict";
import test from "node:test";
import { NEWSLETTER_INSTRUMENT_MAPPINGS, resolveNewsletterInstrument } from "./newsletter-instruments.js";

test("Ticker-Mapping deckt alle validierten Basiswerte ab", () => {
  assert.equal(NEWSLETTER_INSTRUMENT_MAPPINGS.length, 32);
  for (const mapping of NEWSLETTER_INSTRUMENT_MAPPINGS) {
    for (const alias of mapping.aliases) {
      assert.deepEqual(resolveNewsletterInstrument(alias, null), { ticker: mapping.ticker, yahooSymbol: mapping.yahooSymbol });
    }
  }
  assert.deepEqual(resolveNewsletterInstrument("Chipotle Mexican Grill", null), { ticker: "CMG", yahooSymbol: "CMG" });
  assert.deepEqual(resolveNewsletterInstrument("Loma Negra Compañía Industrial Argentina S.A.", null), { ticker: "LOMA", yahooSymbol: "LOMA" });
  assert.deepEqual(resolveNewsletterInstrument("Andrada Mining (ehemals Afritin)", null), { ticker: "ATM.L", yahooSymbol: "ATM.L" });
  assert.deepEqual(resolveNewsletterInstrument("Copper Giant Resources", null), { ticker: "CGNT.V", yahooSymbol: "CGNT.V" });
});

test("Explizite Ticker haben Vorrang vor Namens-Aliassen", () => {
  assert.deepEqual(resolveNewsletterInstrument("Novo Nordisk", "NOVO-B.CO"), { ticker: "NOVO-B.CO" });
});

test("Nackte Heimatbörsen-Ticker werden auf das validierte Yahoo-Suffix erweitert", () => {
  assert.deepEqual(resolveNewsletterInstrument("Ivanhoe Mines", "IVN"), { ticker: "IVN.TO", yahooSymbol: "IVN.TO" });
  assert.deepEqual(resolveNewsletterInstrument("Silver Mountain Resources", "AGMR"), { ticker: "AGMR.TO", yahooSymbol: "AGMR.TO" });
  assert.deepEqual(resolveNewsletterInstrument("Southern Silver Exploration", "SSV"), { ticker: "SSV.V", yahooSymbol: "SSV.V" });
});

test("CBTC verwendet den SIX-Yahoo-Ticker, behält aber den Cockpit-Schlüssel", () => {
  assert.deepEqual(resolveNewsletterInstrument("21Shares Bitcoin Core ETP", "CBTC"), { ticker: "CBTC", yahooSymbol: "CBTC.SW" });
  assert.deepEqual(resolveNewsletterInstrument("Unbekanntes Instrument", "CBTC"), { ticker: "CBTC", yahooSymbol: "CBTC.SW" });
});
