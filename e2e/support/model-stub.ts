import { createServer, type Server } from "node:http";

/**
 * A stand-in for the hosted model, speaking the same chat-completions format.
 *
 * It is not clever and is not meant to be. For an explainer or a briefing it
 * does what a model does at its most careful -- repeats the records it was
 * given, cited -- and for one story, the observatory map, what a model does at
 * its worst: states a figure no record gave. The product cannot tell which it
 * is talking to, which is the point of the test: the careful output must
 * reach the page, the invented one must not.
 *
 * For a question: "who" is answered from the first record; anything else is
 * honestly unanswerable from the records.
 */
export const MODEL_STUB_PORT = 4599;

type Message = { role: string; content: string | null };

/** "S1 | publisher: x | type: official statement | ... | headline: y" -> its parts. */
function records(text: string, tag: string) {
  const body = new RegExp(`<${tag}>\\n([\\s\\S]*?)\\n</${tag}>`).exec(text)?.[1] ?? "";
  return body
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [ref, ...fields] = line.split(" | ");
      const field = (name: string) => fields.find((entry) => entry.startsWith(`${name}: `))?.slice(name.length + 2) ?? "";
      return { ref: ref!.trim(), publisher: field("publisher"), official: field("type") === "official statement", headline: field("headline") };
    });
}

const sentence = (record: { publisher: string; official: boolean; headline: string }) =>
  // An official record's claim is attributed, as the product requires; a report is repeated as reported.
  record.official ? `${record.publisher} said: ${record.headline}.` : `${record.publisher} reported: ${record.headline}.`;

function reply(messages: Message[]): string {
  const system = messages.find((message) => message.role === "system")?.content ?? "";
  const user = [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
  const first = messages.find((message) => message.role === "user")?.content ?? "";

  if (system.startsWith("You write short, neutral explainers")) {
    const list = records(first, "records");
    if (list.some((record) => /observatory/i.test(record.headline))) {
      return JSON.stringify({ oneMinute: [{ text: "The new map charts 4,000 stars never seen before.", cites: ["S1"] }], whatHappened: [], whyItMatters: [], keyDetails: [], whatsNext: [], categories: [] });
    }
    return JSON.stringify({
      oneMinute: [{ text: sentence(list[0]!), cites: [list[0]!.ref] }],
      whatHappened: list.slice(1, 3).map((record) => ({ text: sentence(record), cites: [record.ref] })),
      whyItMatters: [],
      // A fact of its own: the product drops a key detail that only repeats what happened.
      keyDetails: list.length > 1 ? [{ text: `${list[list.length - 1]!.publisher} is among the publishers carrying it.`, cites: [list[list.length - 1]!.ref] }] : [],
      whatsNext: [],
      categories: [],
    });
  }
  if (system.includes("briefing for a newspaper")) {
    const stories = /<stories>\n([\s\S]*?)\n<\/stories>/.exec(first)?.[1]?.split("\n") ?? [];
    return JSON.stringify({ lines: stories.map((line) => ({ ref: line.split(" | ")[0]!, text: `${/headline: (.*?) \| note:/.exec(line)?.[1] ?? ""}.` })) });
  }
  if (system.startsWith("You answer a reader's question")) {
    const question = /<question>([\s\S]*?)<\/question>/.exec(user)?.[1] ?? "";
    const list = records(first, "records");
    if (/\bwho\b/i.test(question) && list[0]) return JSON.stringify({ answerable: true, answer: [{ text: sentence(list[0]), cites: [list[0].ref] }] });
    return JSON.stringify({ answerable: false, answer: [] });
  }
  return "I was not asked for anything I recognise.";
}

export async function startModelStub(): Promise<() => Promise<void>> {
  const server: Server = createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => (body += chunk.toString("utf8")));
    request.on("end", () => {
      // A request with no key is the product forgetting to send one.
      if (!request.headers.authorization?.startsWith("Bearer ") || request.url !== "/v1/chat/completions") {
        response.writeHead(request.headers.authorization ? 404 : 401).end();
        return;
      }
      const parsed = JSON.parse(body) as { messages: Message[] };
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ choices: [{ message: { role: "assistant", content: reply(parsed.messages) } }], usage: { prompt_tokens: 50, completion_tokens: 20 } }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(MODEL_STUB_PORT, "127.0.0.1", resolve);
  });
  return () => new Promise<void>((resolve) => server.close(() => resolve()));
}
