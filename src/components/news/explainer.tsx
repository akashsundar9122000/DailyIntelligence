"use client";

import { Sparkles } from "lucide-react";
import { useState } from "react";

import { Segmented } from "@/components/ui/segmented";
import type { Claim } from "@/lib/ai/validate";
import type { ReadingStyle } from "@/lib/settings/preferences";

export type CiteTarget = { itemId: string; publisher: string };

/** A sentence and its citations: each a numbered link to the source it rests on, further down the page. */
export function CitedText({ claim, refs }: { claim: Claim; refs: Record<string, CiteTarget> }) {
  return (
    <>
      {claim.text}
      {claim.cites.map((ref) => {
        const target = refs[ref];
        if (!target) return null;
        return (
          // Sized in rem, not em: inside a <sup> an em shrinks twice, and the markers came out at 8px.
          // The link's reach is widened by an invisible box, not padding, so a finger can find it
          // without the extra height pushing the lines of the sentence apart.
          <sup key={ref} className="ml-0.5 text-xs leading-none">
            <a
              href={`#source-${target.itemId}`}
              className="relative font-sans font-semibold text-text-secondary underline-offset-2 after:absolute after:-inset-x-1 after:-inset-y-3.5 after:content-[''] hover:text-text-primary hover:underline"
            >
              [{ref.slice(1)}]<span className="sr-only">: {target.publisher}</span>
            </a>
          </sup>
        );
      })}
    </>
  );
}

const SECTIONS = [
  { key: "whatHappened", title: "What happened" },
  { key: "whyItMatters", title: "Why it matters" },
  { key: "keyDetails", title: "Key details", list: true },
  { key: "whatsNext", title: "What is next" },
] as const;

/** Which sections each length shows. "Concise" stops at the minute; "deep dive" shows everything the records support. */
const SHOWN: Record<ReadingStyle, readonly string[]> = {
  concise: [],
  balanced: ["whatHappened", "whyItMatters"],
  deep: ["whatHappened", "whyItMatters", "keyDetails", "whatsNext"],
};

export type ExplainerContent = Record<"oneMinute" | (typeof SECTIONS)[number]["key"], Claim[]>;

/**
 * The AI explainer. Labelled as written by a model, with which model and when,
 * and with what it could and could not read. Every sentence carries its
 * citations. Opens at the reader's chosen length and switches in place.
 */
export function StoryExplainer({
  content,
  refs,
  initialLength,
  model,
  generatedLabel,
  textRead,
  stale,
  recordCount,
}: {
  content: ExplainerContent;
  refs: Record<string, CiteTarget>;
  initialLength: ReadingStyle;
  model: string;
  generatedLabel: string;
  textRead: boolean;
  stale: boolean;
  recordCount: number;
}) {
  const [length, setLength] = useState<ReadingStyle>(initialLength);
  const shown = SECTIONS.filter((section) => SHOWN[length].includes(section.key) && content[section.key].length > 0);
  return (
    <section aria-labelledby="explainer" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-t-2 border-rule pt-2.5">
        <div>
          <p className="kicker flex items-center gap-1.5 text-text-tertiary">
            <Sparkles className="size-3.5" aria-hidden data-ai-mark /> AI-generated summary
          </p>
          <h2 id="explainer" className="text-2xl font-bold leading-tight">
            In one minute
          </h2>
        </div>
        <Segmented
          legend="Explainer length"
          size="sm"
          options={[
            { value: "concise", label: "Concise" },
            { value: "balanced", label: "Balanced" },
            { value: "deep", label: "Deep dive" },
          ]}
          value={length}
          onChange={setLength}
        />
      </div>
      <div className="prose-news space-y-2">
        {content.oneMinute.map((claim, index) => (
          <p key={index} className={index === 0 ? "drop-cap" : undefined}>
            <CitedText claim={claim} refs={refs} />
          </p>
        ))}
      </div>
      {shown.map((section) => (
        <div key={section.key} className="space-y-1.5">
          <h3 className="font-display text-lg font-bold">{section.title}</h3>
          {"list" in section ? (
            <ul className="list-disc space-y-1 pl-5 font-serif text-base leading-relaxed">
              {content[section.key].map((claim, index) => (
                <li key={index}>
                  <CitedText claim={claim} refs={refs} />
                </li>
              ))}
            </ul>
          ) : (
            content[section.key].map((claim, index) => (
              <p key={index} className="font-serif text-base leading-relaxed">
                <CitedText claim={claim} refs={refs} />
              </p>
            ))
          )}
        </div>
      ))}
      {length !== "deep" && SECTIONS.some((section) => !SHOWN[length].includes(section.key) && content[section.key].length > 0) ? (
        <button type="button" onClick={() => setLength("deep")} className="text-sm font-semibold underline underline-offset-4">
          Read the deep dive
        </button>
      ) : null}
      <p className="text-xs leading-relaxed text-text-tertiary">
        Written by an AI model ({model}) {generatedLabel}, from {recordCount} source {recordCount === 1 ? "record" : "records"}, and checked: every sentence cites a record, and every
        name and number had to appear in one. {textRead ? "Some records include text their source lets us read." : "Based on headlines and publication details only; article text was not read."}{" "}
        {stale ? "New reports have arrived since it was written; it is rewritten on the next pass." : ""}
      </p>
    </section>
  );
}
