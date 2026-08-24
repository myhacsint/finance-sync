import { pathToFileURL } from "node:url";
import { AgentMailClient } from "agentmail";
import OpenAI from "openai";
import { loadConfig, paths, readSecret } from "./config.js";
import { FinanceDatabase } from "./database.js";
import {
  buildNewsletterAnalysis,
  newsletterAnalysisSchema,
  newsletterContentHash,
  validateNewsletterModelResult,
  type NewsletterMessage
} from "./newsletter-analysis.js";

interface WorkerOptions {
  inboxId: string;
  senderFilters: string[];
  model: string;
  limit?: number;
}

export async function runNewsletterWorker(options: WorkerOptions): Promise<{
  inspected: number;
  analyzed: number;
  skipped: number;
}> {
  const agentMailKey = readSecret("agentmail-api-key");
  const openAiKey = readSecret("openai-api-key");
  if (!agentMailKey) throw new Error("Agent-Mail-Secret fehlt");
  if (!openAiKey) throw new Error("OpenAI-Secret fehlt");

  const db = new FinanceDatabase(`${paths.data}/finance.sqlite`);
  const mail = new AgentMailClient({ apiKey: agentMailKey });
  const ai = new OpenAI({ apiKey: openAiKey });
  let inspected = 0;
  let analyzed = 0;
  let skipped = 0;
  try {
    const listed = await mail.inboxes.messages.list(options.inboxId, { limit: options.limit ?? 50 });
    for (const item of [...listed.messages].reverse()) {
      inspected += 1;
      const sender = String(item.from);
      if (options.senderFilters.length > 0
        && !options.senderFilters.some((filter) => sender.toLowerCase().includes(filter.toLowerCase()))) {
        skipped += 1;
        continue;
      }
      const full = await mail.inboxes.messages.get(options.inboxId, item.messageId);
      const content = (full.extractedText || full.text || "").trim();
      if (!content) {
        skipped += 1;
        continue;
      }
      const message: NewsletterMessage = {
        messageId: String(full.messageId),
        inboxId: String(full.inboxId),
        sender,
        subject: full.subject ?? "Ohne Betreff",
        receivedAt: new Date(full.timestamp).toISOString(),
        content
      };
      const hash = newsletterContentHash(message);
      if (db.hasNewsletterAnalysis(message.messageId, hash)) {
        skipped += 1;
        continue;
      }
      const response = await ai.responses.create({
        model: options.model,
        store: false,
        instructions: [
          "Analysiere den Investment-Newsletter ausschließlich anhand des gelieferten Textes.",
          "Extrahiere Aussagen, keine eigenen Empfehlungen. Erfinde keine Ticker, Preise oder Zeithorizonte.",
          "Jede konkrete These braucht kurze Belegstellen aus dem Newsletter.",
          "Unsicherheit und fehlende Angaben müssen ausdrücklich genannt werden.",
          "Die Ausgabe ist eine KI-Auswertung und keine Anlageberatung."
        ].join(" "),
        input: `Absender: ${message.sender}\nBetreff: ${message.subject}\nDatum: ${message.receivedAt}\n\n${message.content}`,
        text: {
          format: {
            type: "json_schema",
            name: "newsletter_analysis",
            strict: true,
            schema: newsletterAnalysisSchema
          }
        }
      });
      const parsed = validateNewsletterModelResult(JSON.parse(response.output_text));
      db.saveNewsletterAnalysis(buildNewsletterAnalysis(message, options.model, parsed));
      analyzed += 1;
    }
    return { inspected, analyzed, skipped };
  } finally {
    db.close();
  }
}

async function main(): Promise<void> {
  loadConfig();
  const inboxId = process.env.AGENTMAIL_INBOX_ID?.trim();
  const model = process.env.INVESTMENT_MODEL?.trim();
  if (!inboxId) throw new Error("AGENTMAIL_INBOX_ID fehlt");
  if (!model) throw new Error("INVESTMENT_MODEL fehlt");
  const senderFilters = (process.env.INVESTMENT_NEWSLETTER_SENDERS ?? "")
    .split(",").map((item) => item.trim()).filter(Boolean);
  const result = await runNewsletterWorker({ inboxId, model, senderFilters });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
