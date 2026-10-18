import { createServer, type Server } from "node:http";

/**
 * A stand-in for the hosted model, speaking the same chat-completions format.
 *
 * It is not clever and is not meant to be. It does what a model does at its
 * most cooperative -- looks something up, then repeats exactly what it was
 * given, with citations -- and, when a question contains the word "invent",
 * what a model does at its worst: states figures nobody gave it. The product
 * cannot tell which it is talking to, which is the point of the test.
 */
export const MODEL_STUB_PORT = 4599;

type Message = { role: string; content: string | null; tool_calls?: unknown };
type ToolResult = { matches?: { handle: string; type: string }[]; facts?: { id: string; label: string; value: string }[]; notes?: string[]; error?: string };

let counter = 0;
const call = (name: string, args: Record<string, unknown>) => ({ role: "assistant", content: null, tool_calls: [{ id: `stub-${(counter += 1)}`, type: "function", function: { name, arguments: JSON.stringify(args) } }] });
const say = (content: string) => ({ role: "assistant", content });

function reply(messages: Message[], tools: string[]) {
  const users = messages.filter((message) => message.role === "user").map((message) => message.content ?? "");
  // The reader's question is the last thing they wrote; a correction from the product is not a question.
  const question = [...users].reverse().find((text) => !text.startsWith("Your answer cannot be shown")) ?? "";
  const since = messages.slice(messages.findLastIndex((message) => message.role === "user" && message.content === question) + 1);
  const results = since.filter((message) => message.role === "tool").map((message) => JSON.parse(message.content ?? "{}") as ToolResult);
  const last = results[results.length - 1];

  if (/invent/i.test(question)) {
    if (tools.includes("search") && results.length === 0) return call("search", { query: /[A-Z]{4,}/.exec(question)?.[0] ?? "Sample" });
    if (last?.matches?.[0] && tools.includes("instrument_overview") && results.length === 1) return call("instrument_overview", { handle: last.matches[0].handle });
    return say("It closed at ₹9,999.99 and analysts expect a 42.5% rise next quarter [F1]. You should buy it.");
  }
  if (tools.length === 0) return say("XIRR weights each cash flow by when it happened, so it measures your own experience. CAGR compares one starting value with one ending value.");

  if (results.length === 0) {
    if (tools.includes("portfolio_summary") && /portfolio/i.test(question)) return call("portfolio_summary", {});
    if (tools.includes("market_summary") && /market/i.test(question)) return call("market_summary", {});
    if (tools.includes("project_investment")) {
      const numbers = question.replace(/,/g, "").match(/\d+(?:\.\d+)?/g) ?? [];
      return call("project_investment", { kind: /month/i.test(question) ? "monthly" : "lump_sum", amount_rupees: numbers[0] ?? "", years: numbers[1] ?? "", assumed_return_percent: numbers[2] ?? "" });
    }
    // A symbol in capitals or a six-digit scheme code, as a model would pick the name out of a sentence.
    return call("search", { query: /[A-Z]{4,}[A-Z0-9]*|\b\d{6}\b/.exec(question)?.[0] ?? question.slice(0, 40) });
  }
  if (last?.matches?.[0]) {
    const match = last.matches[0];
    if (match.type === "fund" && tools.includes("fund_overview")) return call("fund_overview", { handle: match.handle });
    if (/indicator|RSI|technical/i.test(question) && tools.includes("technical_indicators")) return call("technical_indicators", { handle: match.handle });
    if (tools.includes("instrument_overview")) return call("instrument_overview", { handle: match.handle });
  }
  const facts = last?.facts ?? [];
  if (facts.length === 0) return say(last?.notes?.[0] ?? last?.error ?? "Nothing was available to answer that.");
  return say(facts.slice(0, 3).map((fact) => `${fact.label}: ${fact.value} [${fact.id}].`).join(" "));
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
      const parsed = JSON.parse(body) as { messages: Message[]; tools?: { function: { name: string } }[] };
      const message = reply(parsed.messages, (parsed.tools ?? []).map((tool) => tool.function.name));
      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ choices: [{ message }], usage: { prompt_tokens: 50, completion_tokens: 20 } }));
    });
  });
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(MODEL_STUB_PORT, "127.0.0.1", resolve);
  });
  return () => new Promise<void>((resolve) => server.close(() => resolve()));
}
