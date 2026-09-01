export type NewsletterInstrumentMapping = {
  aliases: readonly string[];
  ticker: string;
  yahooSymbol: string;
};

export const NEWSLETTER_INSTRUMENT_MAPPINGS: readonly NewsletterInstrumentMapping[] = [
  { aliases: ["Chipotle Mexican Grill"], ticker: "CMG", yahooSymbol: "CMG" },
  { aliases: ["Novo Nordisk"], ticker: "NVO", yahooSymbol: "NVO" },
  { aliases: ["dLocal"], ticker: "DLO", yahooSymbol: "DLO" },
  { aliases: ["Coinbase Global Inc.", "Coinbase Global Inc", "Coinbase"], ticker: "COIN", yahooSymbol: "COIN" },
  { aliases: ["Cresud S.A. ADR"], ticker: "CRESY", yahooSymbol: "CRESY" },
  { aliases: ["Loma Negra Compañía Industrial Argentina", "Loma Negra Compañía Industrial Argentina S.A."], ticker: "LOMA", yahooSymbol: "LOMA" },
  { aliases: ["Gladstone Land"], ticker: "LAND", yahooSymbol: "LAND" },
  { aliases: ["Northern Star Resources"], ticker: "NST.AX", yahooSymbol: "NST.AX" },
  { aliases: ["Ivanhoe Mines"], ticker: "IVN.TO", yahooSymbol: "IVN.TO" },
  { aliases: ["21Shares Bitcoin Core ETP"], ticker: "CBTC", yahooSymbol: "CBTC.SW" },
  { aliases: ["Invesco US Treasury Bond 0-1 Year UCITS ETF Dist"], ticker: "TREI.L", yahooSymbol: "TREI.L" },
  { aliases: ["iShares $ Ultrashort Bond UCITS ETF"], ticker: "ERND.L", yahooSymbol: "ERND.L" },
  { aliases: ["Silver Mountain Resources"], ticker: "AGMR.TO", yahooSymbol: "AGMR.TO" },
  { aliases: ["Southern Silver Exploration"], ticker: "SSV.V", yahooSymbol: "SSV.V" },
  { aliases: ["Lotus Resources"], ticker: "LOT.AX", yahooSymbol: "LOT.AX" },
  { aliases: ["Nuvau Minerals"], ticker: "NMC.V", yahooSymbol: "NMC.V" },
  { aliases: ["Maritana Minerals"], ticker: "MRT.AX", yahooSymbol: "MRT.AX" },
  { aliases: ["29Metals"], ticker: "29M.AX", yahooSymbol: "29M.AX" },
  { aliases: ["Verde AgriTech"], ticker: "NPK.TO", yahooSymbol: "NPK.TO" },
  { aliases: ["Tudor Gold"], ticker: "TUD.V", yahooSymbol: "TUD.V" },
  { aliases: ["Helium One Global"], ticker: "HE1.L", yahooSymbol: "HE1.L" },
  { aliases: ["KEFI Gold and Copper"], ticker: "KEFI.L", yahooSymbol: "KEFI.L" },
  { aliases: ["Midnight Sun Mining"], ticker: "MMA.V", yahooSymbol: "MMA.V" },
  { aliases: ["Argentina Lithium & Energy"], ticker: "LIT.V", yahooSymbol: "LIT.V" },
  { aliases: ["Challenger Gold"], ticker: "CEL.AX", yahooSymbol: "CEL.AX" },
  { aliases: ["West Wits Mining"], ticker: "WWI.AX", yahooSymbol: "WWI.AX" },
  { aliases: ["Apollo Minerals"], ticker: "AON.AX", yahooSymbol: "AON.AX" },
  { aliases: ["Theta Gold Mines"], ticker: "TGM.AX", yahooSymbol: "TGM.AX" },
  { aliases: ["Andrada Mining", "Andrada Mining (ehemals Afritin)"], ticker: "ATM.L", yahooSymbol: "ATM.L" },
  { aliases: ["Cassiar Gold"], ticker: "GLDC.V", yahooSymbol: "GLDC.V" },
  { aliases: ["Kutcho Copper"], ticker: "KC.V", yahooSymbol: "KC.V" }
] as const;

export function normalizeNewsletterInstrument(value: string | null | undefined): string {
  return String(value ?? "").normalize("NFKD").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
}

const MAPPING_BY_NAME = new Map(NEWSLETTER_INSTRUMENT_MAPPINGS.flatMap((mapping) =>
  mapping.aliases.map((alias) => [normalizeNewsletterInstrument(alias), mapping] as const)
));

export function resolveNewsletterInstrument(instrument: string, ticker: string | null | undefined): {
  ticker: string | null;
  yahooSymbol?: string;
} {
  const suppliedTicker = String(ticker ?? "").trim();
  const mapping = MAPPING_BY_NAME.get(normalizeNewsletterInstrument(instrument));
  if (mapping) {
    const mappedBaseTicker = mapping.ticker.split(".")[0];
    if (!suppliedTicker
      || normalizeNewsletterInstrument(suppliedTicker) === normalizeNewsletterInstrument(mappedBaseTicker)
      || normalizeNewsletterInstrument(suppliedTicker) === normalizeNewsletterInstrument(mapping.ticker)) {
      return { ticker: mapping.ticker, yahooSymbol: mapping.yahooSymbol };
    }
  }
  if (suppliedTicker.toUpperCase() === "CBTC") return { ticker: "CBTC", yahooSymbol: "CBTC.SW" };
  return suppliedTicker ? { ticker: suppliedTicker } : { ticker: null };
}
