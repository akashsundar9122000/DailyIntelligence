import type { ReactNode } from "react";

import { cn } from "@/components/ui/cn";

/**
 * A landing-page section set like a newspaper section: a thick rule, a kicker,
 * the headline in the display serif and a dek, then the content. The heading
 * block reveals on scroll; the content decides for itself.
 */
export function Section({
  id,
  kicker,
  title,
  dek,
  children,
  className,
  wide = false,
}: {
  id: string;
  kicker?: string;
  title: ReactNode;
  dek?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Let the content run the full container width under a narrower heading. */
  wide?: boolean;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={cn("scroll-mt-20 px-4 py-16 sm:px-6 lg:py-24", className)}>
      <div className="mx-auto max-w-[var(--container)]">
        <div data-reveal className="border-t-[3px] border-rule pt-4">
          <div className={cn("grid gap-4", wide ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-end" : "max-w-3xl")}>
            <div>
              {kicker ? <p className="kicker text-text-tertiary">{kicker}</p> : null}
              <h2 id={`${id}-title`} className="mt-2 text-[clamp(2rem,4.2vw,3.5rem)] font-bold leading-[1.05] text-text-primary">
                {title}
              </h2>
            </div>
            {dek ? <p className="dek text-lg sm:text-xl">{dek}</p> : null}
          </div>
        </div>
        <div className="pt-10 lg:pt-14">{children}</div>
      </div>
    </section>
  );
}

/**
 * The label every illustrative figure sits under. A figure on this page that
 * looks like news but is a drawing of how the product works says so, in so
 * many words, beside it.
 *
 * A <span>, not a <p>: it is used inside sentences, and a paragraph inside a
 * paragraph is invalid HTML that the browser repairs into a hydration failure.
 */
export function IllustrationNote({ children = "Illustration of how it works. Not live news.", className }: { children?: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 border border-current px-1.5 py-0.5 text-[0.6875rem] font-bold uppercase tracking-[0.08em] text-text-tertiary", className)}>
      {children}
    </span>
  );
}
