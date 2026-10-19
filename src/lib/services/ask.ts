import "server-only";

import { answerQuestion, MAX_QUESTION_CHARS } from "@/lib/ai/ask";
import { loadBundle } from "@/lib/ai/bundle";
import { AiUnavailable, nvidiaModel, type ChatModel } from "@/lib/ai/nvidia-client";
import type { Claim } from "@/lib/ai/validate";
import { withPublic } from "@/lib/db/scope";
import { aiConfigured } from "@/lib/env";
import { AppError, notFound, unavailable } from "@/lib/errors";

import { takeReaderAiCall } from "./ai-budget";

export type AskResult =
  | { kind: "answer"; claims: Claim[]; refs: Record<string, { itemId: string; publisher: string }>; model: string }
  /** The records do not say, or every answer the model gave failed the checks: both are "the sources here do not say". */
  | { kind: "not-in-sources" };

/**
 * A reader's question about one story, answered from that story's records.
 *
 * The question is not stored: it may be personal, and nothing about the
 * product needs it kept. The rate limits are per account, hourly and daily,
 * because each question is a paid model call.
 */
export async function askAboutStory(userId: string, storyId: string, question: string, model?: ChatModel, ip = "unknown"): Promise<AskResult> {
  const text = question.trim().replace(/\s+/g, " ");
  if (text.length < 3) throw new AppError("VALIDATION", "Ask a question about the story.", { question: "Ask a question about the story." });
  if (text.length > MAX_QUESTION_CHARS) throw new AppError("VALIDATION", `Keep the question under ${MAX_QUESTION_CHARS} characters.`, { question: `Keep it under ${MAX_QUESTION_CHARS} characters.` });
  if (!model && !aiConfigured()) throw unavailable("Questions are not available on this deployment.");

  await takeReaderAiCall(userId, ip, "ask");

  // The reader's own scope: a withdrawn source is withdrawn from the answer too.
  const bundle = await withPublic((tx) => loadBundle(tx, storyId));
  if (!bundle || bundle.records.length === 0) throw notFound("That story");

  try {
    // A reader is waiting: forty seconds for both attempts, then an honest "try again".
    const outcome = await answerQuestion(model ?? nvidiaModel({ deadline: Date.now() + 40_000 }), bundle, text);
    if (!outcome.ok || !outcome.value.answerable) return { kind: "not-in-sources" };
    const cited = new Set(outcome.value.answer.flatMap((claim) => claim.cites));
    const refs = Object.fromEntries(bundle.records.filter((record) => cited.has(record.ref)).map((record) => [record.ref, { itemId: record.itemId, publisher: record.publisher }]));
    return { kind: "answer", claims: outcome.value.answer, refs, model: outcome.model };
  } catch (error) {
    if (error instanceof AiUnavailable) throw unavailable("The model could not be reached. Please try again in a minute.");
    throw error;
  }
}
