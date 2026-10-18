import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";

import { ProsePage, ProseSection } from "@/components/marketing/prose";
import { Badge } from "@/components/ui/badge";
import { formatDay } from "@/lib/format/date";
import { publicDirectory, type DirectoryEntry } from "@/lib/sources/catalogue";

export const metadata: Metadata = { title: "Source directory" };

function Entries({ entries }: { entries: DirectoryEntry[] }) {
  return (
    <ul className="divide-y divide-border border-y border-border font-sans">
      {entries.map((entry) => (
        <li key={entry.key} className="py-4">
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="font-display text-xl font-bold text-text-primary">{entry.name}</p>
            <Badge tone="outline">{entry.kind}</Badge>
          </div>
          <p className="mt-1.5 text-base text-text-secondary">{entry.note}</p>
          <p className="mt-2 text-sm text-text-tertiary">
            Terms read on {formatDay(entry.checkedOn)} ·{" "}
            <a href={entry.termsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-text-primary underline underline-offset-4">
              Read their terms <ExternalLink className="size-3.5" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </p>
        </li>
      ))}
    </ul>
  );
}

export default function SourcesPage() {
  const directory = publicDirectory();
  return (
    <ProsePage
      kicker="Trust"
      title="Source directory"
      lead="Every source this paper has considered: what it reads, what it shows from each, and the ones it does not read, with the reason. A feed existing is not permission."
    >
      <ProseSection id="on-the-press" title="On the press">
        <p>Read on a schedule. For each we show only what its terms allow: from the world news index, a headline, the publisher, the time and a link; from official and research sources, a short excerpt too.</p>
        <Entries entries={directory.onPress} />
      </ProseSection>
      <ProseSection id="waiting" title="Waiting for permission or review">
        <p>Not read until the question in each note is settled. Nothing from these is stored or shown.</p>
        <Entries entries={directory.pending} />
      </ProseSection>
      <ProseSection id="not-included" title="Not included, and why">
        <p>Their terms do not allow a public news reader to show their headlines. Where the world news index points to one of them, the item is dropped before it is stored.</p>
        <Entries entries={directory.notIncluded} />
      </ProseSection>
      <ProseSection id="publishers" title="If you are a publisher">
        <p>To have your source added, changed or removed, open an issue at github.com/akashsundar9122000/DailyIntelligence. Removing a source withdraws everything from it on the next request. This directory is engineering diligence, not legal advice.</p>
      </ProseSection>
    </ProsePage>
  );
}
