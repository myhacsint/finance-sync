import { randomUUID } from "node:crypto";
import { sha256 } from "./archive.js";
import type { AppConfig, SourceConfig } from "./types.js";
import type { ManualSnapshot } from "./connectors/manual.js";

type Provider = "alte-leipziger";

interface WorkflowSettings {
  provider: Provider;
  accountId: string;
  owner?: string;
  label?: string;
}

interface Fund {
  aliases: string[];
  symbol: string;
  name: string;
}

const alteFunds: Fund[] = [
  {
    aliases: ["AL GlobalAktiv+"],
    symbol: "LU0327386487",
    name: "AL GlobalAktiv+ LC"
  },
  {
    aliases: ["Dimensional Global Core Equity Fund"],
    symbol: "IE00B2PC0260",
    name: "Dimensional Global Core Equity Fund EUR Acc"
  },
  {
    aliases: [
      "Dimensional Global Core Equity Lower Carbon ESG Screened Fund"
    ],
    symbol: "IE00B7T1D258",
    name: "Dimensional Global Core Equity Lower Carbon ESG Screened Fund EUR Acc"
  },
  {
    aliases: ["iShares Core MSCI World ETF"],
    symbol: "IE00B4L5Y983",
    name: "iShares Core MSCI World UCITS ETF USD (Acc)"
  },
  {
    aliases: ["iShares Global Govt Bond ETF"],
    symbol: "IE00B3F81K65",
    name: "iShares Global Government Bond UCITS ETF USD (Dist)"
  },
  {
    aliases: ["iShares NASDAQ-100 ETF"],
    symbol: "DE000A0F5UF5",
    name: "iShares NASDAQ-100 UCITS ETF (DE)"
  },
  {
    aliases: ["Xtrackers MSCI Europe Small Cap ETF"],
    symbol: "LU0322253906",
    name: "Xtrackers MSCI Europe Small Cap UCITS ETF 1C"
  }
];

export interface ManualWorkflowPreview {
  id: string;
  sourceId: string;
  label: string;
  provider: Provider;
  createdAt: string;
  expiresAt: string;
  accountId: string;
  owner?: string;
  capturedAt: string;
  totalMinor: string;
  holdings: Array<{
    symbol: string;
    name: string;
    quantityAtomic: string;
    quantityDecimals: number;
    priceAtomic: string;
    priceDecimals: number;
    priceCurrency: string;
    marketValueMinor: string;
    ghostfolioMapped: boolean;
  }>;
  ghostfolioReady: boolean;
  warnings: string[];
}

interface StoredPreview extends ManualWorkflowPreview {
  source: SourceConfig;
  snapshot: ManualSnapshot;
}

function workflowSettings(source: SourceConfig): WorkflowSettings {
  const value = source.settings?.manualWorkflow as Partial<WorkflowSettings> | undefined;
  if (
    !value
    || value.provider !== "alte-leipziger"
    || typeof value.accountId !== "string"
    || value.accountId.length === 0
  ) {
    throw new Error(`Vorsorge-Konfiguration für ${source.id} fehlt`);
  }
  return value as WorkflowSettings;
}

export function supportsLegacyManualWorkflow(
  source: SourceConfig | undefined
): source is SourceConfig {
  if (!source || source.kind !== "manual") return false;
  try {
    workflowSettings(source);
    return true;
  } catch {
    return false;
  }
}

function germanMinor(value: string): bigint {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^\d+\.\d{2}$/.test(normalized)) {
    throw new Error(`Ungültiger Euro-Betrag: ${value}`);
  }
  const [whole, fraction] = normalized.split(".");
  return BigInt(whole) * 100n + BigInt(fraction);
}

function decimalAtomic(value: string, decimalSeparator: "," | "."): {
  atomic: string;
  decimals: number;
} {
  const thousands = decimalSeparator === "," ? /\./g : /,/g;
  const normalized = value.replace(/\s/g, "").replace(thousands, "");
  const parts = normalized.split(decimalSeparator);
  if (parts.length > 2 || !parts.every((part) => /^\d+$/.test(part))) {
    throw new Error(`Ungültige Dezimalzahl: ${value}`);
  }
  return {
    atomic: `${parts[0]}${parts[1] ?? ""}`.replace(/^0+(?=\d)/, ""),
    decimals: parts[1]?.length ?? 0
  };
}

function isoDate(value: string): string {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  if (!match) throw new Error(`Ungültiges Datum: ${value}`);
  return `${match[3]}-${match[2]}-${match[1]}`;
}

function endOfDayBerlin(value: string): string {
  const date = isoDate(value);
  const zone = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Berlin",
    timeZoneName: "longOffset"
  }).formatToParts(new Date(`${date}T12:00:00Z`))
    .find((part) => part.type === "timeZoneName")?.value;
  const offset = zone?.replace("GMT", "") || "+01:00";
  return `${date}T23:59:59${offset}`;
}

function commonSnapshot(
  source: SourceConfig,
  settings: WorkflowSettings,
  text: string,
  capturedAt: string,
  amountMinor: bigint,
  holdings: NonNullable<ManualSnapshot["holdings"]>,
  details: Record<string, unknown>
): ManualSnapshot {
  return {
    accountId: settings.accountId,
    amount: `${amountMinor / 100n}.${String(amountMinor % 100n).padStart(2, "0")}`,
    currency: "EUR",
    capturedAt,
    owner: settings.owner ?? source.owners?.[0],
    evidence: {
      type: "confirmed-pasted-text",
      sha256: sha256(text),
      text
    },
    details,
    holdings
  };
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function contractValue(
  text: string,
  section: string,
  label: string
): { amountMinor: string; at: string } | undefined {
  const pattern = new RegExp(
    `${escapeRegExp(section)}[\\s\\S]{0,100}?Stand zum\\s+(\\d{2}\\.\\d{2}\\.\\d{4})[\\s\\S]{0,100}?${escapeRegExp(label)}\\s+([\\d.]+,\\d{2})\\s*€`
  );
  const match = pattern.exec(text);
  return match
    ? { amountMinor: germanMinor(match[2]).toString(), at: isoDate(match[1]) }
    : undefined;
}

function parseAlte(
  source: SourceConfig,
  settings: WorkflowSettings,
  text: string
): ManualSnapshot {
  const holdings: NonNullable<ManualSnapshot["holdings"]> = [];
  const dates = new Set<string>();
  for (const fund of alteFunds) {
    const alias = fund.aliases[0];
    const pattern = new RegExp(
      `(?:^|\\n)\\s*${escapeRegExp(alias)}\\s+([\\d.]+,\\d{2})\\s*€\\s*\\n\\s*Anteile:\\s*([\\d.]+)\\s*St\\.\\s*\\/\\s*Kurs:\\s*([\\d.]+,\\d{2})\\s*€\\s*\\n\\s*Stand zum:\\s*(\\d{2}\\.\\d{2}\\.\\d{4})`,
      "m"
    );
    const match = pattern.exec(text);
    if (!match) throw new Error(`Alte-Leipziger-Position nicht erkannt: ${alias}`);
    const quantity = decimalAtomic(match[2], ".");
    const price = decimalAtomic(match[3], ",");
    dates.add(match[4]);
    holdings.push({
      symbol: fund.symbol,
      name: fund.name,
      quantityAtomic: quantity.atomic,
      atomicDecimals: quantity.decimals,
      currency: "EUR",
      priceAtomic: price.atomic,
      priceDecimals: price.decimals,
      priceCurrency: "EUR",
      marketValueMinor: germanMinor(match[1]).toString(),
      marketValueCurrency: "EUR"
    });
  }
  if (dates.size !== 1) {
    throw new Error("Alte-Leipziger-Positionen haben kein einheitliches Kursdatum");
  }
  const totalMatch = /Gesamtdepot\s+([\d.]+,\d{2})\s*€/.exec(text);
  if (!totalMatch) throw new Error("Alte-Leipziger-Gesamtdepot wurde nicht erkannt");
  const amountMinor = germanMinor(totalMatch[1]);
  const holdingTotal = holdings.reduce(
    (sum, holding) => sum + BigInt(holding.marketValueMinor ?? 0),
    0n
  );
  if (holdingTotal !== amountMinor) {
    throw new Error("Alte-Leipziger-Gesamtdepot stimmt nicht mit den Positionen überein");
  }
  const monthly = /Aktuell zu zahlender Beitrag\s+([\d.]+,\d{2})\s*€/.exec(text);
  const surrender = contractValue(text, "Kündigung", "Gesamter Rückkaufswert");
  const death = contractValue(text, "Todesfall", "Gesamte Todesfallleistung");
  return commonSnapshot(
    source,
    settings,
    text,
    endOfDayBerlin([...dates][0]),
    amountMinor,
    holdings,
    {
      evidenceType: "confirmed-pasted-text",
      portalObservedAt: new Date().toISOString().slice(0, 10),
      monthlyContributionMinor: monthly
        ? germanMinor(monthly[1]).toString()
        : undefined,
      surrenderValueMinor: surrender?.amountMinor,
      surrenderValueAt: surrender?.at,
      deathBenefitMinor: death?.amountMinor,
      deathBenefitAt: death?.at,
      note: "Fund holdings and contract values are stored separately; the difference is not treated as cash."
    }
  );
}

export function parseManualWorkflowText(
  source: SourceConfig,
  text: string
): { settings: WorkflowSettings; snapshot: ManualSnapshot } {
  const settings = workflowSettings(source);
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (normalized.length < 100) throw new Error("Der eingefügte Text ist zu kurz");
  const snapshot = parseAlte(source, settings, normalized);
  return { settings, snapshot };
}

export class ManualPreviewStore {
  private readonly previews = new Map<string, StoredPreview>();
  constructor(private readonly ttlMs = 15 * 60_000) {}

  listSources(config: AppConfig): Array<{
    id: string;
    label: string;
    provider: Provider;
  }> {
    return config.sources
      .filter((source) => source.enabled && source.kind === "manual")
      .flatMap((source) => {
        try {
          const settings = workflowSettings(source);
          return [{
            id: source.id,
            label: settings.label ?? source.id,
            provider: settings.provider
          }];
        } catch {
          return [];
        }
      });
  }

  create(
    source: SourceConfig,
    text: string,
    config: AppConfig
  ): ManualWorkflowPreview {
    this.purge();
    const { settings, snapshot } = parseManualWorkflowText(source, text);
    const id = randomUUID();
    const created = Date.now();
    const holdings = (snapshot.holdings ?? []).map((holding) => {
      const mapping = config.ghostfolio?.holdingMap?.[holding.symbol];
      return {
        symbol: holding.symbol,
        name: holding.name ?? holding.symbol,
        quantityAtomic: holding.quantityAtomic,
        quantityDecimals: holding.atomicDecimals,
        priceAtomic: holding.priceAtomic ?? "",
        priceDecimals: holding.priceDecimals ?? 0,
        priceCurrency: holding.priceCurrency ?? "EUR",
        marketValueMinor: String(holding.marketValueMinor ?? 0),
        ghostfolioMapped: Boolean(mapping)
      };
    });
    const ghostfolioReady = Boolean(
      config.ghostfolio?.enabled
      && config.ghostfolio.accountMap[settings.accountId]
      && holdings.every((holding) => holding.ghostfolioMapped)
    );
    const preview: StoredPreview = {
      id,
      sourceId: source.id,
      source,
      label: settings.label ?? source.id,
      provider: settings.provider,
      createdAt: new Date(created).toISOString(),
      expiresAt: new Date(created + this.ttlMs).toISOString(),
      accountId: snapshot.accountId,
      owner: snapshot.owner,
      capturedAt: snapshot.capturedAt ?? "",
      snapshot,
      totalMinor: String(
        Math.round(Number(String(snapshot.amount).replace(",", ".")) * 100)
      ),
      holdings,
      ghostfolioReady,
      warnings: ghostfolioReady
        ? []
        : ["Ghostfolio-Ziel oder Wertpapierzuordnung ist noch nicht vollständig konfiguriert."]
    };
    this.previews.set(id, preview);
    const { source: _source, snapshot: _snapshot, ...publicPreview } = preview;
    return publicPreview;
  }

  take(id: string): StoredPreview {
    this.purge();
    const preview = this.previews.get(id);
    if (!preview) throw new Error("Vorschau ist abgelaufen; bitte erneut prüfen");
    return preview;
  }

  consume(id: string): void {
    this.previews.delete(id);
  }

  private purge(): void {
    const now = Date.now();
    for (const [id, preview] of this.previews) {
      if (new Date(preview.expiresAt).getTime() <= now) this.previews.delete(id);
    }
  }
}
