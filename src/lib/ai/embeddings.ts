import "server-only";

import { z } from "zod";

import { EMBEDDING_DIMENSIONS } from "@/lib/db/schema/news";
import { env } from "@/lib/env";

import { AiOutOfTime, AiUnavailable } from "./nvidia-client";

/**
 * Embeddings for search by meaning, from the same provider and key as the
 * explainers. Headlines go in -- what the page already shows -- never article
 * text, and the width is checked on the way back: a model that changed its
 * output size would otherwise write vectors the index cannot compare.
 */
export const EMBEDDING_MODEL = "nvidia/nemotron-3-embed-1b";

const answer = z.object({ data: z.array(z.object({ index: z.number(), embedding: z.array(z.number()) })) });

export interface Embedder {
  readonly model: string;
  embed(texts: string[], kind: "query" | "passage"): Promise<number[][]>;
}

export function nvidiaEmbedder({ deadline }: { deadline?: number } = {}): Embedder {
  const { NVIDIA_API_KEY: key, NVIDIA_BASE_URL: baseUrl } = env();
  if (!key) throw new AiUnavailable("Search by meaning is not configured on this deployment.");
  return {
    model: EMBEDDING_MODEL,
    async embed(texts, kind) {
      if (texts.length === 0) return [];
      const remaining = deadline === undefined ? 20_000 : deadline - Date.now() - 500;
      if (remaining < 2_000) throw new AiOutOfTime();
      let status: number | undefined;
      try {
        const response = await fetch(`${baseUrl.replace(/\/$/, "")}/embeddings`, {
          method: "POST",
          signal: AbortSignal.timeout(Math.min(20_000, remaining)),
          headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
          body: JSON.stringify({ model: EMBEDDING_MODEL, input: texts, input_type: kind, encoding_format: "float" }),
        });
        status = response.status;
        if (!response.ok) throw new Error(`status ${response.status}`);
        const parsed = answer.parse(await response.json());
        const vectors = parsed.data.sort((a, b) => a.index - b.index).map((row) => row.embedding);
        if (vectors.length !== texts.length || vectors.some((vector) => vector.length !== EMBEDDING_DIMENSIONS)) throw new Error("wrong shape");
        return vectors;
      } catch (error) {
        // The model and the status only: the request holds the key.
        console.error(`ai: embeddings failed (${status ?? (error instanceof Error ? error.name : "error")})`);
        throw new AiUnavailable("Search by meaning could not be reached.");
      }
    },
  };
}

/** A vector as Postgres reads a halfvec literal. */
export function vectorLiteral(vector: number[]): string {
  return `[${vector.map((value) => (Number.isFinite(value) ? value.toFixed(6) : "0")).join(",")}]`;
}
