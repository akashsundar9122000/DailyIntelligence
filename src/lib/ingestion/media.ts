import { SOURCE_CATALOGUE } from "@/lib/sources/catalogue";

/**
 * Whether a picture offered by a feed may be kept: the one rule, applied by
 * the pipeline before anything is stored, as excerpts are.
 *
 * A source being cleared for media is not enough. NASA's terms are the
 * example: its own imagery is free to use, but "the NASA Insignia, Logotype,
 * identifiers, and imagery are not in the public domain", and it "occasionally
 * uses copyright-protected material of third parties", which "will be marked
 * ... with the name of the copyright holder". So a picture is kept only when:
 *   - its source's rights allow media at all;
 *   - it is served from one of that source's own asset hosts (mediaHosts);
 *   - nothing about it names a logo or insignia;
 *   - if it carries a credit or a copyright mark, the credit names the source.
 * Anything else is dropped, and the story falls back to its next picture.
 */
export type MediaCandidate = { url: string; alt: string | null; credit: string | null };

const LOGO = /\b(logo|logotype|insignia|meatball|worm[\s_-]?logo|wordmark|emblem|seal)\b/i;
const MARKED = /©|\(c\)|copyright|all rights reserved/i;

export function acceptMedia(sourceKey: string, candidate: MediaCandidate | null | undefined): { url: string; alt: string | null } | null {
  if (!candidate) return null;
  const definition = SOURCE_CATALOGUE.find((source) => source.key === sourceKey);
  if (!definition) return null;
  const rights = definition.rights;
  if (!rights.media || !rights.mediaHosts?.length) return null;

  let url: URL;
  try {
    url = new URL(candidate.url);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || !rights.mediaHosts.includes(url.hostname)) return null;

  const described = [decodeURIComponent(url.pathname), candidate.alt ?? "", candidate.credit ?? ""].join(" ");
  if (LOGO.test(described)) return null;

  const owner = definition.name.toLowerCase();
  const credit = candidate.credit ?? "";
  if ((credit || MARKED.test(described)) && !credit.toLowerCase().includes(owner)) return null;

  return { url: url.toString(), alt: candidate.alt?.trim() || null };
}
