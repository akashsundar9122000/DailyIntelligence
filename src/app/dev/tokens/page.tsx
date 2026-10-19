import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Logo } from "@/components/branding/logo";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PalettePicker } from "@/components/ui/palette-picker";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/states";
import { ThemeSwitcher } from "@/components/ui/theme-switcher";
import { devToolsEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Design tokens", robots: { index: false, follow: false } };

/*
 * Class names are written out in full. Tailwind finds utilities by scanning
 * source text, so a class assembled from a variable is never generated and the
 * swatch renders with no colour and no error.
 */
const SURFACES = [
  { name: "canvas", swatch: "bg-canvas" },
  { name: "surface", swatch: "bg-surface" },
  { name: "surface-raised", swatch: "bg-surface-raised" },
  { name: "surface-sunken", swatch: "bg-surface-sunken" },
  { name: "surface-hover", swatch: "bg-surface-hover" },
];

const LINES = [
  { name: "border", swatch: "bg-border" },
  { name: "border-strong", swatch: "bg-border-strong" },
  { name: "border-input", swatch: "bg-border-input" },
];

const ACCENTS = [
  { name: "accent", swatch: "bg-accent" },
  { name: "accent-hover", swatch: "bg-accent-hover" },
  { name: "accent-subtle", swatch: "bg-accent-subtle" },
  { name: "accent-border", swatch: "bg-accent-border" },
  { name: "accent-2", swatch: "bg-accent-2" },
  { name: "ink", swatch: "bg-ink" },
];

const GLOWS = [
  { name: "glow-1", swatch: "bg-glow-1" },
  { name: "glow-2", swatch: "bg-glow-2" },
  { name: "glow-3", swatch: "bg-glow-3" },
];

const SIGNALS = [
  { name: "press", swatch: "bg-press" },
  { name: "press-solid", swatch: "bg-press-solid" },
  { name: "press-subtle", swatch: "bg-press-subtle" },
];

const CHARTS = [
  { name: "chart-1", swatch: "bg-chart-1" },
  { name: "chart-2", swatch: "bg-chart-2" },
  { name: "chart-3", swatch: "bg-chart-3" },
  { name: "chart-4", swatch: "bg-chart-4" },
  { name: "chart-5", swatch: "bg-chart-5" },
  { name: "chart-6", swatch: "bg-chart-6" },
  { name: "chart-grid", swatch: "bg-chart-grid" },
  { name: "chart-track", swatch: "bg-chart-track" },
];

const STATUSES = [
  { name: "Success", className: "bg-success-subtle text-success" },
  { name: "Warning", className: "bg-warning-subtle text-warning" },
  { name: "Danger", className: "bg-danger-subtle text-danger" },
  { name: "Info", className: "bg-info-subtle text-info" },
];

/** Column counts are chosen per set so no swatch is left alone on a last row. */
const COLUMNS = {
  five: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5",
  six: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6",
  four: "grid-cols-2 lg:grid-cols-4",
  three: "grid-cols-3",
} as const;

function Swatches({ items, columns = "five" }: { items: { name: string; swatch: string }[]; columns?: keyof typeof COLUMNS }) {
  return (
    <ul className={`grid gap-3 ${COLUMNS[columns]}`}>
      {items.map((item) => (
        <li key={item.name} className="overflow-hidden rounded-lg border border-border bg-surface">
          <div className={`h-14 border-b border-border ${item.swatch}`} />
          <p className="px-3 py-2 font-mono text-xs text-text-secondary">{item.name}</p>
        </li>
      ))}
    </ul>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold text-text-primary">{title}</h2>
        {note ? <p className="max-w-[70ch] text-sm text-text-secondary">{note}</p> : null}
      </div>
      {children}
    </section>
  );
}

export default async function TokensPage() {
  // The flag is read per request: without this the page is prerendered at
  // build time and the answer is frozen into the HTML.
  await connection();
  if (!devToolsEnabled()) notFound();

  return (
    <main className="mx-auto max-w-[var(--container)] space-y-12 px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Logo />
          <h1 className="text-3xl font-semibold text-text-primary">Design tokens</h1>
          <p className="max-w-[60ch] text-sm text-text-secondary">
            The design reference. Every colour in the product resolves through one of these names, in every
            theme by day and by night, with and without high contrast, and in the night band.
          </p>
        </div>
        <ThemeSwitcher />
      </header>

      <Section title="Surfaces">
        <Swatches items={SURFACES} />
      </Section>

      <Section title="Borders" note="Three, because a divider, a card edge and an input boundary need different contrast.">
        <Swatches items={LINES} />
      </Section>

      <Section title="Text">
        <div className="space-y-2 rounded-lg border border-border bg-surface p-5">
          <p className="text-2xl font-semibold text-text-primary">Primary: headings and figures</p>
          <p className="text-base text-text-secondary">Secondary: supporting copy and labels.</p>
          <p className="text-sm text-text-tertiary">Tertiary: captions and timestamps.</p>
          <p className="font-mono text-sm text-text-secondary" data-numeric>
            Mono, tabular figures: 0123456789
          </p>
        </div>
      </Section>

      <Section title="Theme">
        <PalettePicker />
      </Section>

      <Section title="Accent">
        <Swatches items={ACCENTS} columns="six" />
      </Section>

      <Section title="Light" note="The glows behind a theme's atmosphere and its card shadows. Never behind text without a surface between.">
        <Swatches items={GLOWS} columns="three" />
      </Section>

      <Section title="The alert colour" note="Reserved in every theme: breaking, live, or something is wrong, and nothing else. It is kept visibly apart from the accent.">
        <Swatches items={SIGNALS} columns="four" />
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone="press">Breaking</Badge>
          <Badge tone="outline">Official statement</Badge>
          <Badge tone="outline">Preprint</Badge>
          <Badge>Sample</Badge>
          <span className="kicker text-press">A breaking kicker</span>
        </div>
      </Section>

      <Section title="Newsprint">
        <div className="space-y-4 border border-border bg-surface p-5">
          <div className="rule-double" />
          <p className="kicker text-text-tertiary">Kicker</p>
          <p className="font-display text-4xl font-bold leading-tight">A headline in the display serif</p>
          <p className="dek text-lg">A dek in the text serif, italic, saying why to read on.</p>
          <p className="prose-news drop-cap">
            Reading text is set in the text serif at a measure of about sixty-eight characters, with generous leading, so a long explainer reads like a column rather than an interface label. This paragraph shows the drop cap used at the start of an explainer.
          </p>
          <div className="rule-thick" />
        </div>
      </Section>

      <Section title="Status">
        <ul className="flex flex-wrap gap-3">
          {STATUSES.map((status) => (
            <li key={status.name} className={`rounded-full px-3 py-1 text-sm font-medium ${status.className}`}>
              {status.name}
            </li>
          ))}
        </ul>
      </Section>

      <Section
        title="Chart series"
        note="The theme's series colours (ink steps in Newspaper). Never told apart by colour alone: every series also has a dash pattern or a direct label."
      >
        <Swatches items={CHARTS} columns="four" />
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="ink">Ink</Button>
          <Button variant="danger">Delete</Button>
          <Button variant="link">Link</Button>
          <Button loading>Saving</Button>
          <Button disabled>Disabled</Button>
        </div>
      </Section>

      <Section title="States">
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <LoadingState label="Loading example" />
          <EmptyState
            title="Nothing saved yet"
            description="Save a story and it appears here, with the sources it was saved from."
            action={<Button size="sm">Browse For You</Button>}
          />
          <ErrorState
            description="The data source did not respond. Nothing was changed."
            reference="REF-EXAMPLE"
            retry={
              <Button size="sm" variant="secondary">
                Try again
              </Button>
            }
          />
        </div>
      </Section>
    </main>
  );
}
