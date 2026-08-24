import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import {
  newsletterAnalysisSchema,
  validateNewsletterModelResult,
  type NewsletterMessage,
  type NewsletterModelResult
} from "./newsletter-analysis.js";

export interface CodexAnalysisOptions {
  primaryModel?: string;
  fallbackModel?: string;
  reasoningEffort?: string;
  timeoutMs?: number;
}

function promptFor(message: NewsletterMessage): string {
  return [
    "Analysiere ausschließlich den folgenden Investment-Newsletter.",
    "Extrahiere Aussagen des Autors, keine eigenen Anlageempfehlungen.",
    "Erfinde keine Ticker, Preise oder Zeithorizonte. Jede konkrete These braucht kurze Belegstellen.",
    "Setze requiresEscalation nur dann auf true, wenn der Text intern widersprüchlich, beschädigt oder so unklar ist,",
    "dass keine belastbare Extraktion möglich ist. Fehlende Ticker, Ziele oder Risiken und normale Handelssignale",
    "sind ausdrücklich kein Eskalationsgrund.",
    "Nenne die Gründe knapp in escalationReasons. Die Ausgabe ist keine Anlageberatung.",
    `Absender: ${message.sender}`,
    `Betreff: ${message.subject}`,
    `Datum: ${message.receivedAt}`,
    "",
    message.content
  ].join("\n");
}

async function execCodex<T>(
  prompt: string,
  schema: object,
  model: string,
  reasoningEffort: string,
  timeoutMs: number,
  validate: (value: unknown) => T
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "finance-newsletter-"));
  const schemaPath = join(dir, "schema.json");
  const outputPath = join(dir, "output.json");
  await writeFile(schemaPath, JSON.stringify(schema), { mode: 0o600 });
  try {
    await new Promise<void>((resolve, reject) => {
      const child = spawn("codex", [
        "-a", "never",
        "exec", "-m", model,
        "-c", `model_reasoning_effort=\"${reasoningEffort}\"`,
        "--sandbox", "read-only",
        "--skip-git-repo-check",
        "--ephemeral",
        "--output-schema", schemaPath,
        "--output-last-message", outputPath,
        "-"
      ], { stdio: ["pipe", "ignore", "pipe"] });
      let stderr = "";
      const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
      child.stderr.on("data", (chunk) => { stderr += String(chunk).slice(0, 4_000); });
      child.on("error", reject);
      child.on("close", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve();
        else reject(new Error(`Codex ${model} fehlgeschlagen (${code ?? "Signal"}): ${stderr.trim()}`));
      });
      child.stdin.end(prompt);
    });
    return validate(JSON.parse(await readFile(outputPath, "utf8")));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function analyzeNewsletterWithCodex(
  message: NewsletterMessage,
  options: CodexAnalysisOptions = {}
): Promise<{ result: NewsletterModelResult; model: string }> {
  const primaryModel = options.primaryModel ?? "gpt-5.6-terra";
  const fallbackModel = options.fallbackModel ?? "gpt-5.6-sol";
  const reasoningEffort = options.reasoningEffort ?? "medium";
  const timeoutMs = options.timeoutMs ?? 10 * 60_000;
  let first: NewsletterModelResult;
  try {
    first = await execCodex(
      promptFor(message), newsletterAnalysisSchema, primaryModel, reasoningEffort, timeoutMs,
      validateNewsletterModelResult
    );
  } catch (error) {
    if (fallbackModel === primaryModel) throw error;
    return {
      result: await execCodex(
        promptFor(message), newsletterAnalysisSchema, fallbackModel, reasoningEffort, timeoutMs,
        validateNewsletterModelResult
      ),
      model: fallbackModel
    };
  }
  if (!first.requiresEscalation || fallbackModel === primaryModel) {
    return { result: first, model: primaryModel };
  }
  return {
    result: await execCodex(
      promptFor(message), newsletterAnalysisSchema, fallbackModel, reasoningEffort, timeoutMs,
      validateNewsletterModelResult
    ),
    model: fallbackModel
  };
}

interface BatchItem extends NewsletterModelResult { messageId: string }

function batchSchema(messageIds: string[]): object {
  return {
    type: "object",
    additionalProperties: false,
    required: ["analyses"],
    properties: {
      analyses: {
        type: "array",
        minItems: messageIds.length,
        maxItems: messageIds.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["messageId", "summary", "theses", "uncertainties", "requiresEscalation", "escalationReasons"],
          properties: {
            messageId: { type: "string", enum: messageIds },
            summary: newsletterAnalysisSchema.properties.summary,
            theses: newsletterAnalysisSchema.properties.theses,
            uncertainties: newsletterAnalysisSchema.properties.uncertainties,
            requiresEscalation: newsletterAnalysisSchema.properties.requiresEscalation,
            escalationReasons: newsletterAnalysisSchema.properties.escalationReasons
          }
        }
      }
    }
  };
}

function validateBatch(value: unknown, messageIds: string[]): BatchItem[] {
  if (!value || typeof value !== "object" || !Array.isArray((value as { analyses?: unknown }).analyses)) {
    throw new Error("Batch-Antwort enthält keine Analysenliste");
  }
  const allowed = new Set(messageIds);
  const seen = new Set<string>();
  const analyses = (value as { analyses: unknown[] }).analyses.map((raw) => {
    if (!raw || typeof raw !== "object") throw new Error("Ungültige Batch-Analyse");
    const messageId = String((raw as { messageId?: unknown }).messageId ?? "");
    if (!allowed.has(messageId) || seen.has(messageId)) throw new Error(`Ungültige oder doppelte Mail-ID: ${messageId}`);
    seen.add(messageId);
    return { messageId, ...validateNewsletterModelResult(raw) };
  });
  if (seen.size !== allowed.size) throw new Error("Batch-Antwort ist unvollständig");
  return analyses;
}

function batchPrompt(messages: NewsletterMessage[]): string {
  return [
    "Analysiere jede der folgenden Investment-Newsletter getrennt und ausschließlich anhand ihres Textes.",
    "Gib für jede messageId genau einen Eintrag zurück. Vermische keine Aussagen zwischen Nachrichten.",
    "Extrahiere Aussagen des Autors, keine eigenen Empfehlungen. Erfinde keine Angaben.",
    "Jede konkrete These braucht kurze Belegstellen aus derselben Nachricht.",
    "Setze requiresEscalation nur, wenn eine Nachricht intern widersprüchlich, beschädigt oder so unklar ist,",
    "dass keine belastbare Extraktion möglich ist. Fehlende Ticker, Ziele oder Risiken und normale Handelssignale",
    "sind ausdrücklich kein Eskalationsgrund. Die Ausgabe ist keine Anlageberatung.",
    ...messages.map((message) => [
      "\n--- NACHRICHT ---",
      `messageId: ${message.messageId}`,
      `Absender: ${message.sender}`,
      `Betreff: ${message.subject}`,
      `Datum: ${message.receivedAt}`,
      message.content,
      "--- ENDE ---"
    ].join("\n"))
  ].join("\n");
}

export async function analyzeNewsletterBatchWithCodex(
  messages: NewsletterMessage[],
  options: CodexAnalysisOptions = {}
): Promise<{ results: Array<BatchItem & { model: string }> }> {
  if (messages.length === 0) return { results: [] };
  const primaryModel = options.primaryModel ?? "gpt-5.6-terra";
  const fallbackModel = options.fallbackModel ?? "gpt-5.6-sol";
  const reasoningEffort = options.reasoningEffort ?? "medium";
  const timeoutMs = options.timeoutMs ?? 15 * 60_000;
  const ids = messages.map((message) => message.messageId);
  const prompt = batchPrompt(messages);
  const schema = batchSchema(ids);
  const validate = (value: unknown) => validateBatch(value, ids);
  let first: BatchItem[];
  try {
    first = await execCodex(prompt, schema, primaryModel, reasoningEffort, timeoutMs, validate);
  } catch (error) {
    if (fallbackModel === primaryModel) throw error;
    const recovered = await execCodex(prompt, schema, fallbackModel, reasoningEffort, timeoutMs, validate);
    return { results: recovered.map((item) => ({ ...item, model: fallbackModel })) };
  }
  const escalatedIds = new Set(first.filter((item) => item.requiresEscalation).map((item) => item.messageId));
  if (escalatedIds.size === 0 || fallbackModel === primaryModel) {
    return { results: first.map((item) => ({ ...item, model: primaryModel })) };
  }
  const escalatedMessages = messages.filter((message) => escalatedIds.has(message.messageId));
  const escalatedMessageIds = escalatedMessages.map((message) => message.messageId);
  const second = await execCodex(
    batchPrompt(escalatedMessages), batchSchema(escalatedMessageIds), fallbackModel,
    reasoningEffort, timeoutMs, (value) => validateBatch(value, escalatedMessageIds)
  );
  const replacements = new Map(second.map((item) => [item.messageId, item]));
  return {
    results: first.map((item) => replacements.has(item.messageId)
      ? { ...replacements.get(item.messageId)!, model: fallbackModel }
      : { ...item, model: primaryModel })
  };
}
