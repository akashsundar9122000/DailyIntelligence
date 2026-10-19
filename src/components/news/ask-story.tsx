"use client";

import { MessageCircleQuestion } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { askAboutStoryAction } from "@/lib/actions/ask";
import type { AskResult } from "@/lib/services/ask";

import { CitedText } from "./explainer";

const MAX = 300;

/**
 * Ask about this story. Answered from the story's own records by a model, and
 * checked like the explainer; when the records do not say, it says so, which
 * is the right answer far more often than a reader expects.
 */
export function AskStory({ storyId, recordCount }: { storyId: string; recordCount: number }) {
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState("");
  const [result, setResult] = useState<AskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = question.trim();
    if (text.length < 3) return setError("Ask a question about the story.");
    setBusy(true);
    setError(null);
    const response = await askAboutStoryAction({ storyId, question: text });
    setBusy(false);
    if (!response.ok) {
      setResult(null);
      return setError(response.message);
    }
    setAsked(text);
    setResult(response.data);
  }

  return (
    <section aria-labelledby="ask" className="space-y-3">
      <div className="border-t-2 border-text-primary pt-2.5">
        <p className="kicker text-text-tertiary">Answered from the {recordCount} records below</p>
        <h2 id="ask" className="text-2xl font-bold leading-tight">
          Ask about this story
        </h2>
      </div>
      <form onSubmit={onSubmit} className="space-y-2">
        <label htmlFor="ask-question" className="sr-only">
          Your question
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="ask-question"
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            maxLength={MAX}
            placeholder="Who said it? When? What do the sources disagree on?"
            className="h-11 flex-1 border border-border-input bg-surface px-3 text-text-primary placeholder:text-text-tertiary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "ask-error" : "ask-note"}
          />
          <Button type="submit" variant="secondary" size="lg" loading={busy}>
            <MessageCircleQuestion className="size-4" aria-hidden /> Ask
          </Button>
        </div>
        {error ? (
          <p id="ask-error" className="text-sm text-danger">
            {error}
          </p>
        ) : (
          <p id="ask-note" className="text-xs text-text-tertiary">
            Answered by an AI model from these records only, and checked against them. Your question is not stored.
          </p>
        )}
      </form>
      <div aria-live="polite">
        {result ? (
          <div className="border-l-[3px] border-text-primary bg-surface px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-text-tertiary">You asked: {asked}</p>
            {result.kind === "answer" ? (
              <div className="mt-2 space-y-1.5 font-serif text-base leading-relaxed">
                {result.claims.map((claim, index) => (
                  <p key={index}>
                    <CitedText claim={claim} refs={result.refs} />
                  </p>
                ))}
                <p className="font-sans text-xs text-text-tertiary">AI-generated answer ({result.model}), from the cited records.</p>
              </div>
            ) : (
              <p className="mt-2 font-serif text-base leading-relaxed">The sources here do not say. Nothing is guessed: open the originals below for anything they leave out.</p>
            )}
          </div>
        ) : null}
      </div>
    </section>
  );
}
