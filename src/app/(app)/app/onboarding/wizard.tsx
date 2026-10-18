"use client";

import { ArrowLeft, ArrowRight, Plus, Star, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, useTransition, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/components/ui/toast";
import { CATEGORIES } from "@/config/categories";
import { INDIAN_STATES, SCOPE_LABELS, WORLD_REGIONS } from "@/config/regions";
import { onboardingStepAction, removeInterestAction, saveNotificationPrefsAction, setCategoryFollowsAction, setInterestAction } from "@/lib/actions/reader";
import { savePreferencesAction } from "@/lib/actions/preferences";
import type { InterestKind } from "@/lib/reader-vocab";
import type { NotificationPrefs } from "@/lib/services/reader";
import type { Preferences } from "@/lib/settings/preferences";

const LANDING_INTERESTS_KEY = "di-landing-interests";
export const STEPS = ["Coverage", "Sections", "Follows", "Reading", "Alerts", "Your edition"] as const;

type Follow = { id: string; kind: InterestKind; value: string; label: string };

export type WizardInitial = {
  step: number;
  preferences: Pick<Preferences, "defaultScope" | "readingStyle">;
  categories: string[];
  priorities: string[];
  places: Follow[];
  follows: Follow[];
  sources: { key: string; name: string; followed: boolean }[];
  notifications: NotificationPrefs;
};

export function Progress({ step }: { step: number }) {
  return (
    <ol className="grid grid-cols-6 gap-1.5" aria-label="Progress">
      {STEPS.map((label, index) => (
        <li key={label} className="min-w-0">
          <div className={cn("h-1", index < step ? "bg-text-primary" : "bg-border-strong")} aria-hidden />
          {/* Six labels do not fit a phone; there the bars and the step's own heading say where the reader is, and the labels are still read out. */}
          <p className={cn("mt-1.5 truncate text-[0.6875rem] max-sm:sr-only font-semibold uppercase tracking-[0.08em]", index + 1 === step ? "text-text-primary" : "text-text-tertiary")} aria-current={index + 1 === step ? "step" : undefined}>
            <span className="sr-only">Step {index + 1} of 6: </span>
            {label}
          </p>
        </li>
      ))}
    </ol>
  );
}

function Chip({ pressed, onClick, children, disabled }: { pressed: boolean; onClick: () => void; children: ReactNode; disabled?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center gap-1.5 border px-3.5 text-sm transition-colors disabled:opacity-40 coarse:h-11",
        pressed ? "border-text-primary bg-ink font-semibold text-on-ink" : "border-border-strong text-text-secondary hover:bg-surface-hover hover:text-text-primary",
      )}
    >
      {children}
    </button>
  );
}

function Step({ kicker, title, dek, children }: { kicker: string; title: string; dek: string; children: ReactNode }) {
  return (
    <section className="space-y-6">
      <div>
        <p className="kicker text-text-tertiary">{kicker}</p>
        <h1 tabIndex={-1} className="mt-1 text-4xl font-bold leading-tight focus:outline-none sm:text-5xl">
          {title}
        </h1>
        <p className="dek mt-2 text-lg">{dek}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * Onboarding, steps 1 to 5. Each step saves when the reader moves on, so
 * leaving halfway keeps what was chosen; every choice can be changed in
 * Settings afterwards, and every step but the first can be skipped. Step 6 is
 * the server's: the real feed, ranked by what was chosen here.
 */
export function OnboardingWizard({ initial }: { initial: WizardInitial }) {
  const router = useRouter();
  const [step, setStep] = useState(Math.min(Math.max(initial.step, 1), 5));
  const [pending, startTransition] = useTransition();
  const [scope, setScope] = useState(initial.preferences.defaultScope);
  const [readingStyle, setReadingStyle] = useState(initial.preferences.readingStyle);
  const [categories, setCategories] = useState<string[]>(initial.categories);
  const [priorities, setPriorities] = useState<string[]>(initial.priorities);
  const [places, setPlaces] = useState<Follow[]>(initial.places);
  const [follows, setFollows] = useState<Follow[]>(initial.follows);
  const [sources, setSources] = useState(initial.sources);
  const [draft, setDraft] = useState({ kind: "entity" as InterestKind, text: "" });
  const [alerts, setAlerts] = useState(initial.notifications);

  // Choices made on the landing page before signing in, offered here (not applied silently: the reader decides).
  const carriedRaw = useSyncExternalStore(
    () => () => undefined,
    () => {
      try {
        return localStorage.getItem(LANDING_INTERESTS_KEY);
      } catch {
        return null;
      }
    },
    () => null,
  );
  const carried = (() => {
    try {
      const stored = JSON.parse(carriedRaw ?? "null") as { chosen?: string[]; priority?: string[] } | null;
      const chosen = (stored?.chosen ?? []).filter((slug) => CATEGORIES.some((entry) => entry.slug === slug));
      return chosen.length ? { chosen, priority: (stored?.priority ?? []).filter((slug) => chosen.includes(slug)).slice(0, 3) } : null;
    } catch {
      return null;
    }
  })();

  useEffect(() => {
    document.querySelector<HTMLElement>("main h1")?.focus();
  }, [step]);

  function go(next: number, save?: () => Promise<{ ok: boolean; message?: string } | void>) {
    startTransition(async () => {
      if (save) {
        const result = await save();
        if (result && !result.ok) {
          toast.error(result.message ?? "That could not be saved.");
          return;
        }
      }
      await onboardingStepAction({ step: Math.min(next, 6) });
      if (next >= 6) {
        router.push("/app/onboarding?step=6");
        router.refresh();
        return;
      }
      setStep(next);
    });
  }

  async function togglePlace(kind: "state" | "region", value: string, label: string) {
    const existing = places.find((place) => place.kind === kind && place.value === value);
    if (existing) {
      setPlaces((current) => current.filter((place) => place !== existing));
      const result = await removeInterestAction({ id: existing.id });
      if (!result.ok) toast.error(result.message);
      return;
    }
    const result = await setInterestAction({ kind, value, label, stance: "follow" });
    if (!result.ok) return void toast.error(result.message);
    setPlaces((current) => [...current, { id: result.data.id, kind, value, label }]);
  }

  async function addFollow() {
    const text = draft.text.trim();
    if (text.length < 2) return;
    const result = await setInterestAction({ kind: draft.kind, value: text, label: text, stance: "follow" });
    if (!result.ok) return void toast.error(result.message);
    setFollows((current) => [...current.filter((entry) => entry.id !== result.data.id), { id: result.data.id, kind: draft.kind, value: result.data.value, label: text }]);
    setDraft((current) => ({ ...current, text: "" }));
  }

  async function toggleSource(key: string, name: string, followed: boolean) {
    setSources((current) => current.map((source) => (source.key === key ? { ...source, followed: !followed } : source)));
    const result = followed ? null : await setInterestAction({ kind: "source", value: key, label: name, stance: "follow" });
    if (result && !result.ok) toast.error(result.message);
  }

  const back = step > 1 ? (
    <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={pending}>
      <ArrowLeft className="size-4" aria-hidden /> Back
    </Button>
  ) : <span />;

  return (
    <div className="space-y-10">
      <Progress step={step} />

      {step === 1 ? (
        <Step kicker="Step 1 of 6" title="Choose your coverage" dek="Your edition opens on this. You can switch it any time from the top of every page.">
          <div role="radiogroup" aria-label="Coverage" className="grid gap-3 sm:grid-cols-3">
            {(["both", "india", "global"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={scope === value}
                onClick={() => setScope(value)}
                className={cn("border p-4 text-left transition-colors", scope === value ? "border-text-primary border-t-[3px] bg-surface" : "border-border-strong hover:bg-surface-hover")}
              >
                <p className="font-display text-2xl font-bold">{SCOPE_LABELS[value]}</p>
                <p className="mt-1 text-sm text-text-secondary">{{ both: "India and the world, together. Recommended.", india: "National, state and Indian government news.", global: "World news by region." }[value]}</p>
              </button>
            ))}
          </div>
          <div className="space-y-3">
            <p className="font-semibold">States you want more of <span className="font-normal text-text-tertiary">(optional)</span></p>
            <div className="flex flex-wrap gap-2">
              {INDIAN_STATES.map((state) => (
                <Chip key={state.code} pressed={places.some((place) => place.kind === "state" && place.value === state.code)} onClick={() => void togglePlace("state", state.code, state.label)}>
                  {state.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <p className="font-semibold">World regions you want more of <span className="font-normal text-text-tertiary">(optional)</span></p>
            <div className="flex flex-wrap gap-2">
              {WORLD_REGIONS.map((region) => (
                <Chip key={region.slug} pressed={places.some((place) => place.kind === "region" && place.value === region.slug)} onClick={() => void togglePlace("region", region.slug, region.label)}>
                  {region.label}
                </Chip>
              ))}
            </div>
          </div>
          <div className="flex justify-between border-t border-border pt-5">
            {back}
            <Button size="lg" loading={pending} onClick={() => go(2, () => savePreferencesAction({ defaultScope: scope }))}>
              Continue <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </Step>
      ) : null}

      {step === 2 ? (
        <Step kicker="Step 2 of 6" title="Pick your sections" dek="Choose as many as you like, and star up to three as top priorities. Nothing is guessed: politics, health and religion are only ever things you chose.">
          <ul className="flex flex-wrap gap-2" aria-label="Sections">
            {CATEGORIES.map((category) => {
              const on = categories.includes(category.slug);
              const starred = priorities.includes(category.slug);
              return (
                <li key={category.slug} className={cn("inline-flex border", on ? "border-text-primary" : "border-border-strong")}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      setCategories((current) => (on ? current.filter((slug) => slug !== category.slug) : [...current, category.slug]));
                      if (on) setPriorities((current) => current.filter((slug) => slug !== category.slug));
                    }}
                    className={cn("h-10 px-3.5 text-sm coarse:h-11", on ? "bg-ink font-semibold text-on-ink" : "text-text-secondary hover:bg-surface-hover")}
                  >
                    {category.label}
                  </button>
                  {on ? (
                    <button
                      type="button"
                      aria-pressed={starred}
                      aria-label={starred ? `${category.label} is a top priority. Remove it.` : `Make ${category.label} a top priority`}
                      disabled={!starred && priorities.length >= 3}
                      onClick={() => setPriorities((current) => (starred ? current.filter((slug) => slug !== category.slug) : [...current, category.slug]))}
                      className="flex w-10 items-center justify-center border-l border-on-ink/30 bg-ink text-on-ink disabled:opacity-40 coarse:w-11"
                    >
                      <Star className={cn("size-4", starred && "fill-current")} aria-hidden />
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
          <div className="flex flex-wrap items-center gap-3 text-sm text-text-tertiary">
            <span>
              {categories.length} chosen · {priorities.length}/3 top priorities
            </span>
            {carried && categories.length === 0 ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setCategories(carried.chosen);
                  setPriorities(carried.priority);
                }}
              >
                Use the {carried.chosen.length} sections you picked on the front page
              </Button>
            ) : null}
          </div>
          <div className="flex justify-between border-t border-border pt-5">
            {back}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => go(3)} disabled={pending}>
                Skip
              </Button>
              <Button size="lg" loading={pending} onClick={() => go(3, () => setCategoryFollowsAction({ categories, priorities }))}>
                Continue <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </Step>
      ) : null}

      {step === 3 ? (
        <Step kicker="Step 3 of 6" title="Anything in particular?" dek="People, teams, companies, film industries, technologies, keywords, or the sources you trust. All optional.">
          <div className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="follow-kind" className="sr-only">
              What it is
            </label>
            <select
              id="follow-kind"
              value={draft.kind}
              onChange={(event) => setDraft((current) => ({ ...current, kind: event.target.value as InterestKind }))}
              className="h-11 border border-border-input bg-surface px-3"
            >
              <option value="entity">A person, team or organisation</option>
              <option value="keyword">A keyword or topic</option>
            </select>
            <label htmlFor="follow-text" className="sr-only">
              Name
            </label>
            <input
              id="follow-text"
              value={draft.text}
              onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void addFollow();
                }
              }}
              placeholder={draft.kind === "entity" ? "e.g. ISRO, Chennai Super Kings, Infosys" : "e.g. monsoon, semiconductors"}
              maxLength={120}
              className="h-11 flex-1 border border-border-input bg-surface px-3"
            />
            <Button variant="secondary" size="lg" onClick={() => void addFollow()} disabled={draft.text.trim().length < 2}>
              <Plus className="size-4" aria-hidden /> Follow
            </Button>
          </div>
          {follows.length ? (
            <ul className="flex flex-wrap gap-2" aria-label="You follow">
              {follows.map((follow) => (
                <li key={follow.id} className="inline-flex items-center gap-1 border border-text-primary bg-ink py-1 pl-3 pr-1 text-sm font-semibold text-on-ink">
                  {follow.label}
                  <button
                    type="button"
                    aria-label={`Stop following ${follow.label}`}
                    className="flex size-7 items-center justify-center"
                    onClick={async () => {
                      setFollows((current) => current.filter((entry) => entry.id !== follow.id));
                      await removeInterestAction({ id: follow.id });
                    }}
                  >
                    <X className="size-3.5" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="space-y-3">
            <p className="font-semibold">Sources to see more of</p>
            <div className="flex flex-wrap gap-2">
              {sources.map((source) => (
                <Chip key={source.key} pressed={source.followed} onClick={() => void toggleSource(source.key, source.name, source.followed)} disabled={source.followed}>
                  {source.name}
                </Chip>
              ))}
            </div>
            <p className="text-xs text-text-tertiary">To stop following a source later, use Settings.</p>
          </div>
          <div className="flex justify-between border-t border-border pt-5">
            {back}
            <Button size="lg" loading={pending} onClick={() => go(4)}>
              {follows.length || sources.some((source) => source.followed) ? "Continue" : "Skip"} <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </Step>
      ) : null}

      {step === 4 ? (
        <Step kicker="Step 4 of 6" title="How do you like to read?" dek="The length explainers open at. Every story lets you switch.">
          <div role="radiogroup" aria-label="Reading style" className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["concise", "Concise", "The gist in a few sentences."],
                ["balanced", "Balanced", "What happened, why it matters, what is next."],
                ["deep", "Deep dive", "The background and every angle the sources give."],
              ] as const
            ).map(([value, label, body]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={readingStyle === value}
                onClick={() => setReadingStyle(value)}
                className={cn("border p-4 text-left", readingStyle === value ? "border-text-primary border-t-[3px] bg-surface" : "border-border-strong hover:bg-surface-hover")}
              >
                <p className="font-display text-xl font-bold">{label}</p>
                <p className="mt-1 text-sm text-text-secondary">{body}</p>
              </button>
            ))}
          </div>
          <p className="text-sm text-text-secondary">The paper is in English. Tamil and Hindi editions are planned; machine translation, when it comes, will always be labelled.</p>
          <div className="flex justify-between border-t border-border pt-5">
            {back}
            <Button size="lg" loading={pending} onClick={() => go(5, () => savePreferencesAction({ readingStyle }))}>
              Continue <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </Step>
      ) : null}

      {step === 5 ? (
        <Step kicker="Step 5 of 6" title="Alerts, only if you want them" dek="Everything is off unless you turn it on, and nothing reaches your screen until you also allow it in your browser.">
          <div className="divide-y divide-border border-y border-border">
            {(
              [
                ["breaking", "Breaking", "Exceptionally important, well-sourced stories only."],
                ["hot", "Hot stories", "A story you follow is rising sharply."],
                ["topics", "Topic alerts", "Something you follow crosses a threshold."],
                ["morningBriefing", "Morning briefing", "Your edition, summarised, at the time you choose."],
                ["eveningBriefing", "Evening recap", "What changed during the day."],
              ] as const
            ).map(([key, label, description]) => (
              <div key={key} className="py-3">
                <Switch label={label} description={description} checked={alerts[key]} onCheckedChange={(next) => setAlerts((current) => ({ ...current, [key]: next }))} />
              </div>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <label className="space-y-1.5 text-sm font-medium">
              <span>Quiet from</span>
              <input type="time" value={alerts.quietStart} onChange={(event) => setAlerts((current) => ({ ...current, quietStart: event.target.value }))} className="h-11 w-full border border-border-input bg-surface px-3" />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <span>Quiet until</span>
              <input type="time" value={alerts.quietEnd} onChange={(event) => setAlerts((current) => ({ ...current, quietEnd: event.target.value }))} className="h-11 w-full border border-border-input bg-surface px-3" />
            </label>
            <label className="space-y-1.5 text-sm font-medium">
              <span>At most, per day</span>
              <select value={alerts.dailyCap} onChange={(event) => setAlerts((current) => ({ ...current, dailyCap: Number(event.target.value) }))} className="h-11 w-full border border-border-input bg-surface px-3">
                {[1, 2, 3, 5, 8].map((value) => (
                  <option key={value} value={value}>
                    {value} {value === 1 ? "alert" : "alerts"}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p className="border-l-[3px] border-border-strong pl-3 text-sm text-text-secondary">
            Alert delivery is being built. Your choices are saved now and used when it arrives; until then nothing is sent.
          </p>
          <div className="flex justify-between border-t border-border pt-5">
            {back}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => go(6)} disabled={pending}>
                Skip
              </Button>
              <Button size="lg" loading={pending} onClick={() => go(6, () => saveNotificationPrefsAction(alerts))}>
                See my edition <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
        </Step>
      ) : null}
    </div>
  );
}
