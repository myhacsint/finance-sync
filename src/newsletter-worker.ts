import { pathToFileURL } from "node:url";
import { AgentMailClient } from "agentmail";
import { loadConfig, paths, readSecret } from "./config.js";
import { FinanceDatabase } from "./database.js";
import { analyzeNewsletterBatchWithCodex } from "./codex-newsletter-analyzer.js";
import { newsletterPlainText } from "./newsletter-content.js";
import {
  buildNewsletterAnalysis,
  newsletterContentHash,
  type NewsletterMessage
} from "./newsletter-analysis.js";

interface WorkerOptions {
  inboxId: string;
  senderFilters: string[];
  model: string;
  fallbackModel?: string;
  reasoningEffort?: string;
  searchQuery?: string;
  after?: string;
  limit?: number;
}

export async function runNewsletterWorker(options: WorkerOptions): Promise<{
  inspected: number;
  analyzed: number;
  skipped: number;
}> {
  const agentMailKey = readSecret("agentmail-api-key");
  if (!agentMailKey) throw new Error("Agent-Mail-Secret fehlt");

  const db = new FinanceDatabase(`${paths.data}/finance.sqlite`);
  const mail = new AgentMailClient({ apiKey: agentMailKey });
  let inspected = 0;
  let analyzed = 0;
  let skipped = 0;
  try {
    const listedMessages = [];
    let pageToken: string | undefined;
    const after = options.after ? new Date(options.after) : undefined;
    if (after && Number.isNaN(after.getTime())) throw new Error("INVESTMENT_AFTER ist ungültig");
    do {
      const page = options.searchQuery
        ? await mail.inboxes.messages.search(options.inboxId, {
            q: options.searchQuery, limit: Math.min(options.limit ?? 100, 100),
            after, pageToken
          })
        : await mail.inboxes.messages.list(options.inboxId, {
            limit: Math.min(options.limit ?? 100, 100), after, pageToken
          });
      listedMessages.push(...page.messages);
      pageToken = page.nextPageToken;
    } while (pageToken && listedMessages.length < (options.limit ?? 500));
    const pending: NewsletterMessage[] = [];
    for (const item of [...listedMessages].reverse()) {
      inspected += 1;
      const sender = String(item.from);
      if (options.senderFilters.length > 0
        && !options.senderFilters.some((filter) => sender.toLowerCase().includes(filter.toLowerCase()))) {
        skipped += 1;
        continue;
      }
      if (db.hasNewsletterAnalysis(String(item.messageId), "__message-id-only__")) {
        skipped += 1;
        continue;
      }
      const full = await mail.inboxes.messages.get(options.inboxId, item.messageId);
      const content = newsletterPlainText(full);
      if (!content) {
        skipped += 1;
        continue;
      }
      const message: NewsletterMessage = {
        messageId: String(full.messageId),
        inboxId: String(full.inboxId),
        sender,
        source: /friedrich/i.test(options.searchQuery ?? "") ? "Friedrich Report"
          : /hkcm/i.test(options.searchQuery ?? "") ? "HKCM" : undefined,
        subject: full.subject ?? "Ohne Betreff",
        receivedAt: new Date(full.timestamp).toISOString(),
        content
      };
      const hash = newsletterContentHash(message);
      if (db.hasNewsletterAnalysis(message.messageId, hash)) {
        skipped += 1;
        continue;
      }
      pending.push(message);
    }
    for (let offset = 0; offset < pending.length; offset += 12) {
      const batch = pending.slice(offset, offset + 12);
      const analysis = await analyzeNewsletterBatchWithCodex(batch, {
        primaryModel: options.model,
        fallbackModel: options.fallbackModel,
        reasoningEffort: options.reasoningEffort
      });
      const byId = new Map(batch.map((message) => [message.messageId, message]));
      for (const result of analysis.results) {
        const message = byId.get(result.messageId);
        if (!message) throw new Error(`Unbekannte Mail-ID aus Modellantwort: ${result.messageId}`);
        db.saveNewsletterAnalysis(buildNewsletterAnalysis(message, result.model, result));
        analyzed += 1;
      }
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
  const result = await runNewsletterWorker({
    inboxId,
    model,
    fallbackModel: process.env.INVESTMENT_FALLBACK_MODEL?.trim() || "gpt-5.6-sol",
    reasoningEffort: process.env.INVESTMENT_REASONING_EFFORT?.trim() || "medium",
    searchQuery: process.env.INVESTMENT_NEWSLETTER_QUERY?.trim() || undefined,
    after: process.env.INVESTMENT_AFTER?.trim() || undefined,
    senderFilters
  });
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
