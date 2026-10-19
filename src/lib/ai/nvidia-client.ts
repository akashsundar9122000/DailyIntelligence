import "server-only";

import { uuidv7 } from "uuidv7";

import { env } from "@/lib/env";

/**
 * The one place the hosted model is called from.
 *
 * Feature code depends on `ChatModel`, not on this vendor: the pipeline is
 * handed a model and never imports this module's fetch. That is also how the
 * tests run the whole pipeline against a scripted model, with no network.
 *
 * The key is read here and goes nowhere else. It is never logged, never put in
 * an error, and a failure is reported to callers as `AiUnavailable` with a
 * sentence a person can read; the provider's own message stays in the log line
 * as a status code and a model name, which are operational facts.
 */
export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

export type ToolCall = { id: string; type: "function"; function: { name: string; arguments: string } };
export type ToolSpec = { type: "function"; function: { name: string; description: string; parameters: Record<string, unknown> } };

export type ChatRequest = { messages: ChatMessage[]; tools: ToolSpec[]; maxTokens: number };
export type ChatResponse = {
  content: string | null;
  toolCalls: ToolCall[];
  model: string;
  usage: { promptTokens: number; completionTokens: number } | null;
};

export interface ChatModel {
  /** An id for this conversation with the provider, sent with every call. Not a secret. */
  readonly requestId: string;
  complete(request: ChatRequest): Promise<ChatResponse>;
}

/** Every failure a caller sees. Never carries a provider detail. */
export class AiUnavailable extends Error {
  constructor(message = "The research assistant could not be reached. Please try again in a minute.") {
    super(message);
    this.name = "AiUnavailable";
  }
}

/** The run's own time ran out before a model could answer. Not a failure of the model; nothing is recorded against it. */
export class AiOutOfTime extends AiUnavailable {
  constructor() {
    super("The run ran out of time before the model answered.");
    this.name = "AiOutOfTime";
  }
}

/*
 * Measured on 12 October 2026 against the catalogue this key can see: these two
 * answered a tool-calling request in about a second. Three other listed models
 * accepted the connection and never replied. The order is preference;
 * NVIDIA_MODEL replaces the list.
 */
export const DEFAULT_MODELS = ["nvidia/nemotron-3-super-120b-a12b", "openai/gpt-oss-20b"];

const PER_MODEL_TIMEOUT_MS = 25_000;
/** Not worth starting a call with less time than this left: it would be cut off before a model could answer. */
const MIN_CALL_MS = 4_000;

/*
 * Reasoning turned down, per model family. Measured on 19 October 2026 with
 * an explainer-sized request: Nemotron answered in 2.7s with thinking off
 * against 5.8s with it on (and, with it on, added a first name no record
 * gave); gpt-oss with low effort used a quarter of the tokens. The checks on
 * the output, not the model's private reasoning, are what keep it grounded.
 */
function modelOptions(model: string): Record<string, unknown> {
  if (model.startsWith("nvidia/nemotron")) return { chat_template_kwargs: { enable_thinking: false } };
  if (model.startsWith("openai/gpt-oss")) return { reasoning_effort: "low" };
  return {};
}
/** How long a model is left alone after failing: an hour if it is gone, briefly if it is busy. */
const cooldownFor = (status: number | undefined) => (status === 404 || status === 410 ? 3_600_000 : status === 429 || status === 503 ? 15_000 : 120_000);
const coolUntil = new Map<string, number>();

export function configuredModels(): string[] {
  const listed = (env().NVIDIA_MODEL ?? "").split(",").map((entry) => entry.trim()).filter(Boolean);
  return listed.length > 0 ? listed : DEFAULT_MODELS;
}

type Wire = { choices?: { message?: { content?: string | null; tool_calls?: ToolCall[] } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } };

/**
 * The hosted model. Models are tried in order; one that fails is skipped for a
 * while and the next is asked. Temperature is zero: this is retrieval and
 * explanation, and the same question should get the same answer.
 */
export function nvidiaModel({ deadline }: { /** Epoch ms after which no call is started or left running: a scheduled run's own budget. */ deadline?: number } = {}): ChatModel {
  const { NVIDIA_API_KEY: key, NVIDIA_BASE_URL: baseUrl } = env();
  if (!key) throw new AiUnavailable("The research assistant is not configured on this deployment.");
  const requestId = uuidv7();

  return {
    requestId,
    async complete(request) {
      const now = Date.now();
      const models = configuredModels();
      // If every model is cooling, try them anyway: a cooldown is a preference, not a ban.
      const ready = models.filter((model) => (coolUntil.get(model) ?? 0) <= now);
      for (const model of ready.length > 0 ? ready : models) {
        const remaining = deadline === undefined ? PER_MODEL_TIMEOUT_MS : deadline - Date.now() - 1_000;
        // Out of time is not the model's fault: no cooldown, and the caller records it as unreachable this run.
        if (remaining < MIN_CALL_MS) throw new AiOutOfTime();
        let status: number | undefined;
        try {
          const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
            method: "POST",
            signal: AbortSignal.timeout(Math.min(PER_MODEL_TIMEOUT_MS, remaining)),
            headers: { authorization: `Bearer ${key}`, "content-type": "application/json", "x-request-id": requestId },
            body: JSON.stringify({
              model,
              ...modelOptions(model),
              temperature: 0,
              max_tokens: request.maxTokens,
              messages: request.messages,
              ...(request.tools.length > 0 ? { tools: request.tools, tool_choice: "auto" } : {}),
            }),
          });
          status = response.status;
          if (!response.ok) throw new Error(`status ${response.status}`);
          const body = (await response.json()) as Wire;
          const message = body.choices?.[0]?.message;
          if (!message) throw new Error("no message");
          return {
            content: typeof message.content === "string" ? message.content : null,
            toolCalls: Array.isArray(message.tool_calls) ? message.tool_calls.filter((call) => call?.type === "function" && typeof call.function?.name === "string") : [],
            model,
            usage: body.usage ? { promptTokens: body.usage.prompt_tokens ?? 0, completionTokens: body.usage.completion_tokens ?? 0 } : null,
          };
        } catch (error) {
          coolUntil.set(model, Date.now() + cooldownFor(status));
          // The model and the status, and nothing else: an error object can hold the request, and the request holds the key.
          console.error(`ai: ${model} failed (${status ?? (error instanceof Error ? error.name : "error")}), request ${requestId}`);
        }
      }
      throw new AiUnavailable();
    },
  };
}
