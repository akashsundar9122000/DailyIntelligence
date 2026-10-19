import { IllustrationNote } from "@/components/marketing/section";

const PARTS = [
  { n: 1, label: "What it is", body: "Report, official statement, preprint or post. Never left to guess." },
  { n: 2, label: "The publisher's headline", body: "Their words, not ours, with their name beside them." },
  { n: 3, label: "Two times", body: "When they published it, and when we found it." },
  { n: 4, label: "Heat and confidence", body: "How fast it is spreading; how well it is sourced." },
  { n: 5, label: "Every source", body: "How many independent publishers, and the original one tap away." },
];

function Marker({ n }: { n: number }) {
  return (
    <span aria-hidden className="flex size-5 shrink-0 items-center justify-center rounded-full bg-ink font-sans text-[0.625rem] font-bold text-on-ink">
      {n}
    </span>
  );
}

/**
 * What every story card carries, drawn as a labelled diagram: ink bars where
 * the words would be, numbered to the legend beside it. There is no headline
 * text in it, so nothing here can be mistaken for a story.
 */
export function StoryAnatomy() {
  return (
    <figure aria-labelledby="anatomy-caption" className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="self-start border border-border-strong border-t-2 border-t-rule bg-surface p-5" aria-hidden>
        <div className="flex items-center gap-2">
          <Marker n={1} />
          <span className="kicker border border-current px-1.5 py-0.5 text-[0.625rem] text-text-secondary">Official</span>
          <span className="kicker text-[0.625rem] text-text-tertiary">India</span>
        </div>
        <div className="mt-3 flex items-start gap-2">
          <Marker n={2} />
          <div className="flex-1 space-y-2 pt-0.5">
            <div className="h-3 w-full bg-text-primary" />
            <div className="h-3 w-4/5 bg-text-primary" />
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Marker n={3} />
          <div className="h-1.5 w-2/3 bg-border-strong" />
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-border pt-3">
          <Marker n={4} />
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-10 bg-press-solid" />
            <span className="h-2 w-6 bg-text-primary" />
          </span>
          <span className="ml-auto flex items-center gap-2">
            <Marker n={5} />
            <span className="h-1.5 w-12 bg-border-strong" />
          </span>
        </div>
      </div>
      <div>
        <ol className="space-y-2.5">
          {PARTS.map((part) => (
            <li key={part.n} className="flex gap-2.5">
              <Marker n={part.n} />
              <p className="text-sm leading-snug text-text-secondary">
                <span className="font-semibold text-text-primary">{part.label}.</span> {part.body}
              </p>
            </li>
          ))}
        </ol>
        <figcaption id="anatomy-caption" className="mt-3">
          <IllustrationNote>Illustration: the parts of every story</IllustrationNote>
        </figcaption>
      </div>
    </figure>
  );
}
