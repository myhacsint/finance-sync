import { createHash } from "node:crypto";
import type { NewsletterAnalysis, NewsletterThesis } from "./types.js";

export interface NewsletterMessage {
  messageId: string;
  inboxId: string;
  sender: string;
  source?: string;
  subject: string;
  receivedAt: string;
  content: string;
}

export interface NewsletterModelResult {
  summary: string;
  theses: NewsletterThesis[];
  uncertainties: string[];
  requiresEscalation: boolean;
  escalationReasons: string[];
}

export function newsletterContentHash(message: NewsletterMessage): string {
  return createHash("sha256")
    .update(`${message.sender}\n${message.subject}\n${message.content}`)
    .digest("hex");
}

function boundedText(value: unknown, max: number): string {
  return String(value ?? "").trim().slice(0, max);
}

function nullableText(value: unknown, max: number): string | null {
  const text = boundedText(value, max);
  return text || null;
}

function stringList(value: unknown, maxItems = 12, maxLength = 500): string[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map((item) => boundedText(item, maxLength)).filter(Boolean);
}

export function validateNewsletterModelResult(value: unknown): NewsletterModelResult {
  if (!value || typeof value !== "object") throw new Error("Modellantwort ist kein Objekt");
  const raw = value as Record<string, unknown>;
  if (!Array.isArray(raw.theses)) throw new Error("Modellantwort enthält keine Thesenliste");
  const allowed = new Set(["BULLISH", "BEARISH", "NEUTRAL", "MIXED"]);
  const theses = raw.theses.slice(0, 40).map((item) => {
    if (!item || typeof item !== "object") throw new Error("Ungültiger Theseneintrag");
    const thesis = item as Record<string, unknown>;
    const stance = boundedText(thesis.stance, 16).toUpperCase();
    if (!allowed.has(stance)) throw new Error(`Ungültige Ausrichtung: ${stance}`);
    const instrument = boundedText(thesis.instrument, 160);
    if (!instrument) throw new Error("These ohne Instrument");
    return {
      instrument,
      ticker: nullableText(thesis.ticker, 32),
      assetClass: boundedText(thesis.assetClass, 80) || "Unklar",
      stance: stance as NewsletterThesis["stance"],
      horizon: nullableText(thesis.horizon, 120),
      entryZone: nullableText(thesis.entryZone, 160),
      targetZone: nullableText(thesis.targetZone, 160),
      invalidation: nullableText(thesis.invalidation, 300),
      catalysts: stringList(thesis.catalysts),
      risks: stringList(thesis.risks),
      evidence: stringList(thesis.evidence, 8, 700)
    };
  });
  return {
    summary: boundedText(raw.summary, 4_000),
    theses,
    uncertainties: stringList(raw.uncertainties, 20, 700),
    requiresEscalation: raw.requiresEscalation === true,
    escalationReasons: stringList(raw.escalationReasons, 10, 500)
  };
}

export function buildNewsletterAnalysis(
  message: NewsletterMessage,
  model: string,
  result: NewsletterModelResult,
  now = new Date()
): NewsletterAnalysis {
  return {
    messageId: message.messageId,
    inboxId: message.inboxId,
    sender: message.sender,
    ...(message.source ? { source: message.source } : {}),
    subject: message.subject,
    receivedAt: message.receivedAt,
    contentHash: newsletterContentHash(message),
    model,
    summary: result.summary,
    theses: result.theses,
    uncertainties: result.uncertainties,
    state: "UNREVIEWED",
    analyzedAt: now.toISOString()
  };
}

export const newsletterAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["summary", "theses", "uncertainties", "requiresEscalation", "escalationReasons"],
  properties: {
    summary: { type: "string" },
    uncertainties: { type: "array", items: { type: "string" } },
    requiresEscalation: { type: "boolean" },
    escalationReasons: { type: "array", items: { type: "string" } },
    theses: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: [
          "instrument", "ticker", "assetClass", "stance", "horizon", "entryZone",
          "targetZone", "invalidation", "catalysts", "risks", "evidence"
        ],
        properties: {
          instrument: { type: "string" },
          ticker: { type: ["string", "null"] },
          assetClass: { type: "string" },
          stance: { type: "string", enum: ["BULLISH", "BEARISH", "NEUTRAL", "MIXED"] },
          horizon: { type: ["string", "null"] },
          entryZone: { type: ["string", "null"] },
          targetZone: { type: ["string", "null"] },
          invalidation: { type: ["string", "null"] },
          catalysts: { type: "array", items: { type: "string" } },
          risks: { type: "array", items: { type: "string" } },
          evidence: { type: "array", items: { type: "string" } }
        }
      }
    }
  }
} as const;
