import "server-only";

import type { z } from "zod";

import type { ChatMessage, ChatModel } from "./nvidia-client";
import { correction, type Check } from "./validate";

export type JsonOutcome<T> =
  | { ok: true; value: T; model: string; usage: Usage }
  | { ok: false; reason: string; raw: unknown; model: string | null; usage: Usage };

type Usage = { promptTokens: number; completionTokens: number };

/**
 * The model's JSON, out of whatever it wrapped it in: a reasoning block, a
 * code fence, a sentence before the brace. Anything that is not one JSON
 * object is null, and null is a rejection, never a guess.
 */
export function extractJson(content: string | null): unknown {
  if (!content) return null;
  const text = content.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/```(?:json)?/gi, "");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * Ask for JSON of a shape, check it, and give the model ONE chance to correct
 * itself with the reasons it failed. Two attempts and no more: a model that
 * fails twice on the same records is telling us the records cannot support
 * the output, and a third try is a request for it to try harder at inventing.
 */
export async function chatJson<T>(
  model: ChatModel,
  messages: ChatMessage[],
  schema: z.ZodType<T>,
  validate: (value: T) => Check,
  maxTokens: number,
): Promise<JsonOutcome<T>> {
  const usage: Usage = { promptTokens: 0, completionTokens: 0 };
  const conversation = [...messages];
  let lastReason = "";
  let lastRaw: unknown = null;
  let lastModel: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await model.complete({ messages: conversation, tools: [], maxTokens });
    lastModel = response.model;
    usage.promptTokens += response.usage?.promptTokens ?? 0;
    usage.completionTokens += response.usage?.completionTokens ?? 0;
    const raw = extractJson(response.content);
    lastRaw = raw ?? response.content;
    const parsed = schema.safeParse(raw);
    let retry: string;
    if (!parsed.success) {
      lastReason = `not the requested shape: ${parsed.error.issues.slice(0, 3).map((issue) => `${issue.path.join(".")} ${issue.message}`).join("; ")}`;
      retry = `Your output was not valid JSON of the requested shape (${lastReason}). Reply with the JSON object only.`;
    } else {
      const check = validate(parsed.data);
      if (check.ok) return { ok: true, value: parsed.data, model: response.model, usage };
      lastReason = check.problems.slice(0, 6).map((problem) => `${problem.kind}: ${problem.text}`).join("; ");
      retry = correction(check);
    }
    conversation.push({ role: "assistant", content: response.content ?? "" }, { role: "user", content: retry });
  }
  return { ok: false, reason: lastReason, raw: lastRaw, model: lastModel, usage };
}
