import { AgentMailClient } from "agentmail";

let secret = "";
for await (const chunk of process.stdin) secret += chunk;
secret = secret.trim();
if (!secret) throw new Error("Agent-Mail-Schlüssel fehlt");

const client = new AgentMailClient({ apiKey: secret });
const inboxes = await client.inboxes.list({ limit: 10 });
if (inboxes.inboxes.length !== 1) throw new Error(`Erwartet wurde genau ein Postfach, gefunden: ${inboxes.inboxes.length}`);
const inboxId = inboxes.inboxes[0].inboxId;
const messages = [];
let pageToken;
do {
  const page = await client.inboxes.messages.list(inboxId, { limit: 100, pageToken });
  messages.push(...page.messages);
  pageToken = page.nextPageToken;
} while (pageToken && messages.length < 2_000);

async function searchAll(query) {
  const found = [];
  let token;
  do {
    const page = await client.inboxes.messages.search(inboxId, { q: query, limit: 100, pageToken: token });
    found.push(...page.messages);
    token = page.nextPageToken;
  } while (token && found.length < 1_000);
  return found;
}

const searched = {
  HKCM: await searchAll("HKCM"),
  "Friedrich Report": await searchAll("Friedrich Report")
};

function sourceOf(message) {
  const haystack = `${message.subject ?? ""}\n${message.preview ?? ""}`;
  if (/hkcm|hopf[ -]?klinkm[üu]ller/i.test(haystack)) return "HKCM";
  if (/friedrich|friedrich[ -]?report/i.test(haystack)) return "Friedrich Report";
  return null;
}

const formatter = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin", weekday: "short", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", hour12: false
});
const rows = messages.flatMap((message) => {
  const source = sourceOf(message);
  if (!source) return [];
  const date = new Date(message.timestamp);
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return [{
    source,
    timestamp: date.toISOString(),
    local: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`,
    weekday: parts.weekday,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    subject: String(message.subject ?? "Ohne Betreff").slice(0, 180)
  }];
});

const result = {};
for (const source of ["HKCM", "Friedrich Report"]) {
  const sourceMessages = searched[source];
  const selected = sourceMessages.map((message) => {
    const date = new Date(message.timestamp);
    const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
    return {
      source,
      timestamp: date.toISOString(),
      local: `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`,
      weekday: parts.weekday,
      hour: Number(parts.hour),
      minute: Number(parts.minute),
      subject: String(message.subject ?? "Ohne Betreff").slice(0, 180)
    };
  }).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  const minutes = selected.map((row) => row.hour * 60 + row.minute).sort((a, b) => a - b);
  const percentile = (p) => minutes.length ? minutes[Math.min(minutes.length - 1, Math.floor((minutes.length - 1) * p))] : null;
  const hhmm = (value) => value === null ? null : `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  const weekdays = Object.fromEntries([...new Set(selected.map((row) => row.weekday))].map((day) => [day, selected.filter((row) => row.weekday === day).length]));
  result[source] = {
    count: selected.length,
    first: selected[0]?.local ?? null,
    last: selected.at(-1)?.local ?? null,
    timeP10: hhmm(percentile(0.1)),
    timeMedian: hhmm(percentile(0.5)),
    timeP90: hhmm(percentile(0.9)),
    weekdays,
    recent: selected.slice(-12).reverse()
  };
}
process.stdout.write(`${JSON.stringify({ inspected: messages.length, result }, null, 2)}\n`);
