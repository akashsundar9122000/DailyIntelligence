import { SOURCE_CATALOGUE, EXCLUDED_PUBLISHER_DOMAINS, type SourceDefinition } from "./catalogue";

const yes = (value: boolean) => (value ? "yes" : "no");

function section(title: string, intro: string, sources: SourceDefinition[]): string {
  if (sources.length === 0) return "";
  const rows = sources.map((source) => {
    const r = source.rights;
    return [
      `### ${source.name} (\`${source.key}\`)`,
      "",
      `- **Kind:** ${source.kindLabel} · provider \`${source.provider}\` · ${source.feedUrl}`,
      `- **Terms read:** ${r.checkedOn} — ${r.termsUrl}`,
      `- **Decision:** ${r.status}. ${r.note}`,
      `- **May show:** headline ${yes(r.headline)} · excerpt ${yes(r.excerpt)} · AI summary ${yes(r.aiSummary)} · media ${yes(r.media)} · commercial use ${yes(r.commercialUse)}`,
      `- **Attribution:** ${r.attribution || "n/a"}`,
      `- **Retention:** ${r.retentionDays === null ? "with the story, until the purge job" : `${r.retentionDays} days`}`,
      `- **Polled:** every ${Math.round(source.pollIntervalSeconds / 60)} min`,
      `- **From the terms:** “${r.operativeQuote}”`,
      "",
    ].join("\n");
  });
  return [`## ${title}`, "", intro, "", ...rows].join("\n");
}

/**
 * docs/SOURCE_RIGHTS.md, rendered from the catalogue. The document is
 * generated, never hand-edited, so it cannot disagree with what the code
 * fetches; tests/unit/source-rights.test.ts fails when the committed copy is
 * out of date. Regenerate with `pnpm docs:sources`.
 */
export function renderSourceRights(): string {
  const by = (status: SourceDefinition["rights"]["status"]) => SOURCE_CATALOGUE.filter((source) => source.rights.status === status);
  return [
    "# Source rights",
    "",
    "<!-- Generated from src/lib/sources/catalogue.ts by `pnpm docs:sources`. Do not edit by hand. -->",
    "",
    "Every source Daily Intelligence has considered, what its terms say, and what we do as a result. A source is fetched only when it is **cleared**; anything unclear is **pending review** and never fetched; anything whose terms say no is **excluded**, listed publicly at `/sources` with the reason. Engineering diligence, not legal advice.",
    "",
    "Publishers whose items are dropped from the GDELT index before storage: " + EXCLUDED_PUBLISHER_DOMAINS.map((domain) => `\`${domain}\``).join(", ") + ".",
    "",
    section("Cleared", "Fetched on a schedule. Shown only as the flags allow.", by("cleared")),
    section("Pending review", "Not fetched until the question in each note is settled.", by("pending_review")),
    section("Excluded", "Not fetched. Their terms do not allow a public news reader to show their content.", by("excluded")),
  ]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trimEnd()
    .concat("\n");
}
