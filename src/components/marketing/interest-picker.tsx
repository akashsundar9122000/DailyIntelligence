"use client";

import { ArrowRight, Star } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { CATEGORIES, categoryFor, type CategorySlug } from "@/config/categories";

/** Read by onboarding, which offers these as its starting choices. A convenience: losing it loses nothing. */
export const LANDING_INTERESTS_KEY = "di-landing-interests";
const MAX_PRIORITIES = 3;

/**
 * The landing page's "your paper" demonstration, and it is a real control:
 * the chips choose, the stars prioritise (three at most, as onboarding
 * allows), and "Start with these" carries the choice into onboarding after
 * sign-in. Nothing is sent anywhere until the reader has an account.
 */
export function InterestPicker() {
  const [chosen, setChosen] = useState<CategorySlug[]>(["cricket", "ai", "business"]);
  const [priority, setPriority] = useState<CategorySlug[]>(["ai"]);

  function toggle(slug: CategorySlug) {
    setChosen((current) => (current.includes(slug) ? current.filter((entry) => entry !== slug) : [...current, slug]));
    setPriority((current) => current.filter((entry) => entry !== slug || !chosen.includes(slug)));
  }

  function star(slug: CategorySlug) {
    setPriority((current) => {
      if (current.includes(slug)) return current.filter((entry) => entry !== slug);
      if (current.length >= MAX_PRIORITIES) return current;
      return [...current, slug];
    });
  }

  function remember() {
    try {
      localStorage.setItem(LANDING_INTERESTS_KEY, JSON.stringify({ chosen, priority }));
    } catch {
      // Private browsing: onboarding simply starts from nothing.
    }
  }

  const lead = priority[0] ?? chosen[0];
  return (
    <div className="border border-border-strong border-t-[3px] border-t-rule bg-surface p-5 sm:p-7">
      <p className="kicker text-text-tertiary">Try it: choose your sections</p>
      <ul className="mt-4 flex flex-wrap gap-2" aria-label="Categories">
        {CATEGORIES.map((category) => {
          const on = chosen.includes(category.slug);
          const starred = priority.includes(category.slug);
          return (
            <li key={category.slug} className={cn("inline-flex border", on ? "border-text-primary" : "border-border-strong")}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => toggle(category.slug)}
                className={cn("h-9 px-3 text-sm transition-colors coarse:h-11", on ? "bg-ink font-semibold text-on-ink" : "text-text-secondary hover:bg-surface-hover hover:text-text-primary")}
              >
                {category.label}
              </button>
              {on ? (
                <button
                  type="button"
                  aria-pressed={starred}
                  aria-label={starred ? `${category.label} is a top priority. Remove it.` : `Make ${category.label} a top priority`}
                  title={starred ? "Top priority" : "Make a top priority"}
                  disabled={!starred && priority.length >= MAX_PRIORITIES}
                  onClick={() => star(category.slug)}
                  className="flex w-9 items-center justify-center border-l border-on-ink/30 bg-ink text-on-ink disabled:opacity-40 coarse:w-11"
                >
                  <Star className={cn("size-3.5", starred && "fill-current")} aria-hidden />
                </button>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-sm text-text-tertiary">
        Star up to three as top priorities. {priority.length}/{MAX_PRIORITIES} starred.
      </p>

      <div className="mt-6 border-t border-border pt-4" aria-live="polite">
        <p className="kicker text-text-tertiary">Your edition would lead with</p>
        <p className="mt-1 font-display text-2xl font-bold leading-snug">
          {chosen.length === 0 ? "Today's most important stories, the same for every reader." : chosen.map((slug) => categoryFor(slug)?.label).join(", ")}
        </p>
        {lead ? (
          <p className="mt-3 flex flex-wrap items-center gap-2 font-serif text-base italic text-text-secondary">
            Each story then says why it is there, for example: “Because you follow {categoryFor(lead)?.label}{priority.includes(lead) ? ", one of your top priorities" : ""}.”
          </p>
        ) : null}
      </div>

      <Button asChild size="lg" className="mt-6 w-full sm:w-auto">
        <Link href="/login?next=%2Fapp%2Fonboarding" onClick={remember}>
          Start with these <ArrowRight className="size-4" aria-hidden />
        </Link>
      </Button>
    </div>
  );
}
