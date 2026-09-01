import { createHash } from "node:crypto";
import { normalizeNewsletterInstrument, resolveNewsletterInstrument } from "./newsletter-instruments.js";
import type { NewsletterAnalysis } from "./types.js";

type NewsletterPrice = {
  symbol: string;
  name: string;
  priceMinor: number;
  currency: string;
  capturedAt?: string;
  source?: string;
};

export function buildCouncilInvestmentSnapshot(input: {
  generatedAt: string;
  state: "empty" | "ready";
  items: NewsletterAnalysis[];
  prices: NewsletterPrice[];
}) {
  const analyses = input.items.map((item) => ({
    source: item.source ?? "Newsletter",
    subject: item.subject,
    receivedAt: item.receivedAt,
    analyzedAt: item.analyzedAt,
    reviewState: item.state,
    summary: item.summary,
    theses: item.theses,
    uncertainties: item.uncertainties
  }));
  const prices = input.prices.map((price) => ({
    instrumentKey: price.symbol,
    name: price.name,
    priceMinor: price.priceMinor,
    currency: price.currency,
    capturedAt: price.capturedAt ?? null,
    source: price.source ?? "Ghostfolio"
  }));
  const pricesByKey = new Map(prices.flatMap((price) => [
    [normalizeNewsletterInstrument(price.instrumentKey), price] as const,
    [normalizeNewsletterInstrument(price.name), price] as const
  ]));
  const groups = new Map<string, {
    instrumentKey: string;
    instrument: string;
    ticker: string | null;
    assetClass: string;
    sources: Set<string>;
    analyses: typeof analyses;
    theses: NewsletterAnalysis["theses"];
    entries: Array<{ analysis: (typeof analyses)[number]; thesis: NewsletterAnalysis["theses"][number] }>;
  }>();
  const tickerByInstrumentName = new Map<string, string>();
  for (const analysis of analyses) for (const thesis of analysis.theses) {
    const resolved = resolveNewsletterInstrument(thesis.instrument, thesis.ticker);
    if (resolved.ticker) tickerByInstrumentName.set(normalizeNewsletterInstrument(thesis.instrument), resolved.ticker);
  }
  for (const analysis of analyses) for (const thesis of analysis.theses) {
    const resolved = resolveNewsletterInstrument(thesis.instrument, thesis.ticker);
    const ticker = resolved.ticker ?? tickerByInstrumentName.get(normalizeNewsletterInstrument(thesis.instrument)) ?? null;
    const instrumentKey = String(ticker || thesis.instrument).trim().toLocaleUpperCase("de-DE");
    const group = groups.get(instrumentKey) ?? {
      instrumentKey,
      instrument: thesis.instrument,
      ticker,
      assetClass: thesis.assetClass,
      sources: new Set<string>(),
      analyses: [],
      theses: [],
      entries: []
    };
    group.sources.add(analysis.source);
    group.analyses.push(analysis);
    group.theses.push(thesis);
    group.entries.push({ analysis, thesis });
    groups.set(instrumentKey, group);
  }
  const instrumentGroups = [...groups.values()].map((group) => {
    const entries = [...group.entries].sort((a, b) => b.analysis.receivedAt.localeCompare(a.analysis.receivedAt));
    const groupAnalyses = [...new Map(group.analyses.map((analysis) => [`${analysis.source}:${analysis.receivedAt}:${analysis.subject}`, analysis])).values()]
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    const latestAnalysis = groupAnalyses[0];
    const latestThesis = entries[0]?.thesis;
    const price = pricesByKey.get(normalizeNewsletterInstrument(group.ticker))
      ?? pricesByKey.get(normalizeNewsletterInstrument(group.instrument))
      ?? null;
    return {
      instrumentKey: group.instrumentKey,
      instrument: group.instrument,
      ticker: group.ticker,
      assetClass: group.assetClass,
      sources: [...group.sources].sort(),
      supportedBy: groupAnalyses.length,
      latestAt: latestAnalysis?.receivedAt ?? null,
      reviewState: groupAnalyses.every((item) => item.reviewState === "REVIEWED")
        ? "REVIEWED"
        : groupAnalyses.every((item) => item.reviewState === "DISMISSED") ? "DISMISSED" : "UNREVIEWED",
      synthesis: latestAnalysis?.summary ?? "",
      stance: latestThesis?.stance ?? null,
      horizon: latestThesis?.horizon ?? null,
      currentPrice: price,
      targetZone: latestThesis?.targetZone ?? null,
      entryZone: latestThesis?.entryZone ?? null,
      invalidation: latestThesis?.invalidation ?? null,
      catalysts: [...new Set(group.theses.flatMap((thesis) => thesis.catalysts))],
      risks: [...new Set(group.theses.flatMap((thesis) => thesis.risks))],
      uncertainties: [...new Set(groupAnalyses.flatMap((analysis) => analysis.uncertainties))],
      evidence: entries.flatMap(({ analysis, thesis }) => thesis.evidence.map((text) => ({
        source: analysis.source,
        subject: analysis.subject,
        receivedAt: analysis.receivedAt,
        text
      }))),
      analyses: groupAnalyses,
      theses: group.theses
    };
  }).sort((a, b) => String(b.latestAt).localeCompare(String(a.latestAt)));
  const content = { instrumentGroups, analyses, prices };
  const snapshotId = createHash("sha256").update(JSON.stringify(content)).digest("hex").slice(0, 24);
  return {
    schemaVersion: "1.0",
    snapshotId,
    generatedAt: input.generatedAt,
    state: input.state,
    scope: "newsletter-investment-cockpit",
    notice: "KI-extrahierte Newsletterdaten. Keine Anlageberatung und keine automatische Handelsfreigabe.",
    counts: {
      analyses: analyses.length,
      theses: analyses.reduce((sum, item) => sum + item.theses.length, 0),
      prices: prices.length
    },
    instrumentGroups,
    analyses,
    prices
  };
}
