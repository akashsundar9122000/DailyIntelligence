import { notFound } from "next/navigation";

import { PageHeader } from "@/components/ui/page-header";
import { NAV_ITEMS } from "@/config/navigation";
import { SECTION_PLANS } from "@/config/sections";

/**
 * The page for a section that is not built yet. It says what the section is
 * for, that it is in preparation, and what it will hold -- and shows nothing
 * that could be mistaken for the section itself: no sample stories, no
 * placeholder headlines.
 */
export function SectionPage({ href }: { href: string }) {
  const item = NAV_ITEMS.find((entry) => entry.href === href);
  const plan = SECTION_PLANS[href];
  if (!item || !plan) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <PageHeader kicker="In preparation" title={item.label} description={item.summary} />
      <section aria-labelledby="plan-heading" className="grid gap-8 md:grid-cols-[minmax(0,1fr)_14rem]">
        <div className="space-y-4">
          <h2 id="plan-heading" className="text-2xl font-bold">
            What this section will hold
          </h2>
          <ol className="space-y-4">
            {plan.willHold.map((line, index) => (
              <li key={line} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-3 border-t border-border pt-4">
                <span className="font-display text-2xl font-bold leading-none text-text-tertiary" aria-hidden>
                  {index + 1}
                </span>
                <p className="font-serif text-lg leading-relaxed text-text-primary">{line}</p>
              </li>
            ))}
          </ol>
        </div>
        <aside className="h-fit border-t-2 border-rule pt-3">
          <p className="kicker text-text-tertiary">Goes to press</p>
          <p className="mt-1 font-display text-3xl font-bold">Phase {plan.phase}</p>
          <p className="mt-2 text-sm text-text-secondary">This page shows no stories until the section is built. Nothing here is sample news.</p>
        </aside>
      </section>
    </div>
  );
}
