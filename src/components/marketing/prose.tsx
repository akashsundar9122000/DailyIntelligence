import type { ReactNode } from "react";

/** A long-form page: the source directory, the AI policy and the legal pages, set as a column. */
export function ProsePage({ kicker, title, lead, notice, children }: { kicker?: string; title: string; lead: string; notice?: string; children: ReactNode }) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:py-20">
      <div className="border-t-[3px] border-text-primary pt-4">
        {kicker ? <p className="kicker text-text-tertiary">{kicker}</p> : null}
        <h1 className="mt-2 text-5xl font-bold leading-[1.02] text-text-primary sm:text-6xl">{title}</h1>
        <p className="dek pt-5 text-xl leading-relaxed">{lead}</p>
      </div>
      {notice ? <p className="mt-8 border-l-[3px] border-warning bg-warning-subtle p-4 text-sm text-warning">{notice}</p> : null}
      <div className="space-y-12 pt-12">{children}</div>
    </article>
  );
}

export function ProseSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 space-y-4 border-t border-border-strong pt-5">
      <h2 id={`${id}-title`} className="text-3xl font-bold text-text-primary">
        {title}
      </h2>
      <div className="space-y-4 font-serif text-lg leading-relaxed text-text-secondary [&_a]:text-text-primary [&_a]:underline [&_a]:underline-offset-4 [&_li]:ml-5 [&_li]:list-disc [&_strong]:font-semibold [&_strong]:text-text-primary [&_ul]:space-y-2">
        {children}
      </div>
    </section>
  );
}

export const DRAFT_NOTICE =
  "Draft. This page describes how the product works today in plain language. It has not been reviewed by a lawyer and is not yet a binding agreement; it will be replaced by a reviewed version before the product is promoted widely.";
