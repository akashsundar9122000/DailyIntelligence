import Link from "next/link";

import { Mark, Wordmark } from "@/components/branding/logo";
import { brand } from "@/config/brand";

const COLUMNS = [
  {
    title: "The paper",
    links: [
      { href: "/#how-it-works", label: "How it works" },
      { href: "/#hot-is-not-true", label: "Hot is not true" },
      { href: "/#your-paper", label: "Your paper" },
      { href: "/login", label: "Sign in" },
    ],
  },
  {
    title: "Trust",
    links: [
      { href: "/sources", label: "Source directory" },
      { href: "/ai-policy", label: "How we use AI" },
      { href: "/status", label: "Source status" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy notice" },
      { href: "/terms", label: "Terms of use" },
    ],
  },
];

/** The colophon: who made the paper, what it is set in, and where the fine print is. */
export function SiteFooter() {
  return (
    <footer className="border-t-[3px] border-text-primary bg-canvas px-4 pb-[calc(var(--safe-bottom)+2.5rem)] pt-10 sm:px-6">
      <div className="mx-auto grid max-w-[var(--container)] gap-10 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))]">
        <div className="space-y-3">
          <Link href="/" className="inline-flex items-center gap-2.5" aria-label={`${brand.name}, home`}>
            <Mark className="size-9" />
            <Wordmark className="text-2xl leading-none" />
          </Link>
          <p className="max-w-sm font-serif text-base italic text-text-secondary">{brand.tagline}</p>
          <p className="max-w-sm text-sm text-text-secondary">
            Headlines belong to their publishers and link to them. Summaries marked as AI-written are ours, and cite their sources.
          </p>
        </div>
        {COLUMNS.map((column) => (
          <nav key={column.title} aria-label={column.title}>
            <p className="kicker text-text-tertiary">{column.title}</p>
            <ul className="mt-3 space-y-2">
              {column.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-sm text-text-secondary hover:text-text-primary hover:underline hover:underline-offset-4">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-10 flex max-w-[var(--container)] flex-wrap items-center justify-between gap-3 border-t border-border pt-4 text-xs text-text-tertiary">
        <p>Set in Playfair Display, Newsreader and Geist. Printed on screen, every fifteen minutes.</p>
        <p>Engineering, not legal advice: every source&rsquo;s terms are linked from the directory.</p>
      </div>
    </footer>
  );
}
