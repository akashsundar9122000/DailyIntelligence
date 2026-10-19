import "server-only";

import { nvidiaEmbedder, vectorLiteral, type Embedder } from "@/lib/ai/embeddings";
import { AiUnavailable } from "@/lib/ai/nvidia-client";
import { aiConfigured } from "@/lib/env";
import { storiesByMeaning, type StoryCard, type StoryFilter } from "@/lib/queries/stories";
import { AppError } from "@/lib/errors";

import { takeReaderAiCall } from "./ai-budget";

/**
 * Search by meaning: the reader's words become a vector and are compared with
 * each headline's. A convenience beside the word search, never instead of it:
 * when the model is unavailable, or the reader has used their share, it is
 * simply absent and the word search still answers.
 */
export async function searchByMeaning(userId: string, query: string, filter: StoryFilter, exclude: Set<string>, embedder?: Embedder, ip = "unknown"): Promise<{ stories: StoryCard[]; available: boolean }> {
  const text = query.trim().replace(/\s+/g, " ").slice(0, 200);
  if (text.length < 3 || (!embedder && !aiConfigured())) return { stories: [], available: false };
  try {
    await takeReaderAiCall(userId, ip, "meaning");
  } catch (error) {
    // Over a limit, search by meaning is simply absent: the word search still answers.
    if (error instanceof AppError) return { stories: [], available: false };
    throw error;
  }
  try {
    const [vector] = await (embedder ?? nvidiaEmbedder({ deadline: Date.now() + 8_000 })).embed([text], "query");
    const stories = await storiesByMeaning(vectorLiteral(vector!), filter, 10 + exclude.size);
    return { stories: stories.filter((story) => !exclude.has(story.id)).slice(0, 8), available: true };
  } catch (error) {
    if (error instanceof AiUnavailable) return { stories: [], available: false };
    throw error;
  }
}
