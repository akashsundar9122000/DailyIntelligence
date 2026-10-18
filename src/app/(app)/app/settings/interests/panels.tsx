"use client";

import { ArrowDown, ArrowUp, Plus, Star, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";

import { Panel } from "@/components/settings/panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { toast } from "@/components/ui/toast";
import { categoryFor } from "@/config/categories";
import { INDIAN_STATES, WORLD_REGIONS } from "@/config/regions";
import { removeInterestAction, reorderInterestsAction, setInterestAction } from "@/lib/actions/reader";
import type { InterestRow } from "@/lib/services/reader";

const KIND_LABEL: Record<InterestRow["kind"], string> = { category: "Section", region: "Region", state: "State", entity: "Name", keyword: "Keyword", source: "Source" };

function nameOf(interest: InterestRow): string {
  if (interest.kind === "category") return categoryFor(interest.value)?.label ?? interest.label;
  if (interest.kind === "state") return INDIAN_STATES.find((state) => state.code === interest.value)?.label ?? interest.label;
  if (interest.kind === "region") return WORLD_REGIONS.find((region) => region.slug === interest.value)?.label ?? interest.label;
  return interest.label;
}

/**
 * Everything the reader follows, mutes and blocks, in three lists, each entry
 * with the kind of thing it is, whether the reader chose it or it was
 * inferred, and one button to undo it. Sections can be reordered and starred
 * (three at most). Nothing here is hidden behind another page.
 */
export function InterestsSettings({ interests }: { interests: InterestRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState({ text: "", stance: "mute" as "mute" | "block" });
  const follows = interests.filter((entry) => entry.stance === "follow");
  const sections = follows.filter((entry) => entry.kind === "category").sort((a, b) => a.position - b.position);
  const others = follows.filter((entry) => entry.kind !== "category");
  const muted = interests.filter((entry) => entry.stance === "mute");
  const blocked = interests.filter((entry) => entry.stance === "block");
  const priorities = follows.filter((entry) => entry.priority).length;

  function run(action: () => Promise<{ ok: boolean; message?: string }>, done?: string) {
    startTransition(async () => {
      const result = await action();
      if (!result.ok) return void toast.error(result.message ?? "That did not work.");
      if (done) toast.success(done);
      router.refresh();
    });
  }

  function move(index: number, by: -1 | 1) {
    const order = sections.map((entry) => entry.id);
    const [moved] = order.splice(index, 1);
    order.splice(index + by, 0, moved!);
    run(() => reorderInterestsAction({ ids: order }));
  }

  function addWord(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.text.trim();
    if (text.length < 2) return;
    setDraft((current) => ({ ...current, text: "" }));
    run(() => setInterestAction({ kind: "keyword", value: text, label: text, stance: draft.stance }), draft.stance === "mute" ? `“${text}” muted.` : `“${text}” blocked.`);
  }

  const row = (interest: InterestRow, extra?: React.ReactNode) => (
    <li key={interest.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <span className="font-semibold">{nameOf(interest)}</span>
        <Badge>{KIND_LABEL[interest.kind]}</Badge>
        {interest.origin === "inferred" ? <Badge tone="outline">Guessed from your reading</Badge> : null}
        {interest.priority ? <Badge tone="accent">Top priority</Badge> : null}
      </div>
      <div className="flex items-center gap-1">
        {extra}
        <Button variant="ghost" size="sm" disabled={pending} onClick={() => run(() => removeInterestAction({ id: interest.id }), `Removed ${nameOf(interest)}.`)} aria-label={`Remove ${nameOf(interest)}`}>
          <X className="size-4" aria-hidden /> Remove
        </Button>
      </div>
    </li>
  );

  return (
    <>
      <Panel title="Sections you follow" note={`In your order: the first ones lead your edition. Star up to three as top priorities (${priorities}/3).`}>
        {sections.length === 0 ? (
          <p className="py-4 text-sm text-text-secondary">
            None yet. <Link href="/app/categories" className="font-semibold underline">Browse the sections</Link> or <Link href="/app/onboarding?step=2" className="font-semibold underline">choose them again</Link>.
          </p>
        ) : (
          <ol className="divide-y divide-border">
            {sections.map((interest, index) =>
              row(
                interest,
                <>
                  <Button variant="ghost" size="icon" disabled={pending || index === 0} onClick={() => move(index, -1)} aria-label={`Move ${nameOf(interest)} up`}>
                    <ArrowUp className="size-4" aria-hidden />
                  </Button>
                  <Button variant="ghost" size="icon" disabled={pending || index === sections.length - 1} onClick={() => move(index, 1)} aria-label={`Move ${nameOf(interest)} down`}>
                    <ArrowDown className="size-4" aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-pressed={interest.priority}
                    disabled={pending || (!interest.priority && priorities >= 3)}
                    onClick={() => run(() => setInterestAction({ kind: "category", value: interest.value, label: interest.label, stance: "follow", priority: !interest.priority }))}
                    aria-label={interest.priority ? `${nameOf(interest)} is a top priority. Remove it.` : `Make ${nameOf(interest)} a top priority`}
                  >
                    <Star className={cn("size-4", interest.priority && "fill-current")} aria-hidden />
                  </Button>
                </>,
              ),
            )}
          </ol>
        )}
      </Panel>

      <Panel title="Places, names, keywords and sources you follow">
        {others.length === 0 ? <p className="py-4 text-sm text-text-secondary">None yet. Follow a place from India or Global, or a source from Explore.</p> : <ul className="divide-y divide-border">{others.map((interest) => row(interest))}</ul>}
      </Panel>

      <Panel title="Muted and blocked" note="Muted is shown lower, never hidden. Blocked is removed from every feed.">
        <form onSubmit={addWord} className="flex flex-col gap-2 py-4 sm:flex-row">
          <label htmlFor="word" className="sr-only">
            A word or name
          </label>
          <input id="word" value={draft.text} onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))} placeholder="A word or a name" maxLength={120} className="h-11 flex-1 border border-border-input bg-surface px-3" />
          <label htmlFor="stance" className="sr-only">
            Mute or block
          </label>
          <select id="stance" value={draft.stance} onChange={(event) => setDraft((current) => ({ ...current, stance: event.target.value as "mute" | "block" }))} className="h-11 border border-border-input bg-surface px-3">
            <option value="mute">Mute</option>
            <option value="block">Block</option>
          </select>
          <Button type="submit" variant="secondary" size="lg" disabled={pending || draft.text.trim().length < 2}>
            <Plus className="size-4" aria-hidden /> Add
          </Button>
        </form>
        {muted.length + blocked.length === 0 ? <p className="py-4 text-sm text-text-secondary">Nothing muted or blocked.</p> : <ul className="divide-y divide-border">{[...muted, ...blocked].map((interest) => row(interest, <Badge tone={interest.stance === "block" ? "danger" : "neutral"}>{interest.stance === "block" ? "Blocked" : "Muted"}</Badge>))}</ul>}
      </Panel>
    </>
  );
}
