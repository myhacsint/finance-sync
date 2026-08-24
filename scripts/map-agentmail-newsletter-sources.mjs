import { AgentMailClient } from "agentmail";

let secret = "";
for await (const chunk of process.stdin) secret += chunk;
secret = secret.trim();
if (!secret) throw new Error("Agent-Mail-Schlüssel fehlt");

const client = new AgentMailClient({ apiKey: secret });
const inboxes = await client.inboxes.list({ limit: 10 });
if (inboxes.inboxes.length !== 1) throw new Error("Es wurde nicht genau ein Agent-Mail-Postfach gefunden");
const inboxId = inboxes.inboxes[0].inboxId;

async function searchAll(query) {
  const messages = [];
  let pageToken;
  do {
    const page = await client.inboxes.messages.search(inboxId, { q: query, limit: 100, pageToken });
    messages.push(...page.messages);
    pageToken = page.nextPageToken;
  } while (pageToken && messages.length < 2_000);
  return messages;
}

const rows = [];
for (const [source, query] of [["HKCM", "HKCM"], ["Friedrich Report", "Friedrich Report"]]) {
  for (const message of await searchAll(query)) rows.push([String(message.messageId), source]);
}
const unique = new Map(rows.map((row) => [row[0], row[1]]));
for (const [messageId, source] of unique) process.stdout.write(`${messageId}\t${source}\n`);
