import type { Claim } from "./validate";
import { numbersIn } from "./validate";

/**
 * A story as a short sequence of cards: the visual explainer.
 *
 * Built only from what has already passed: the explainer's checked sentences
 * and the source records. Nothing is generated here -- no footage, no images,
 * no new words -- so every card is as true as the sentence or record it came
 * from, and says which. A figure card exists only for a number that a checked
 * sentence states, shown with that sentence and its citations.
 */
export type Slide =
  | { kind: "title"; headline: string; recordCount: number }
  | { kind: "summary"; text: string; cites: string[] }
  | { kind: "figure"; figure: string; text: string; cites: string[] }
  | { kind: "timeline"; entries: { at: string | null; publisher: string; official: boolean; title: string }[] }
  | { kind: "where"; places: string[] }
  | { kind: "sources"; publishers: string[] };

export type VisualInput = {
  headline: string;
  claims: { oneMinute: Claim[]; keyDetails: Claim[]; whatHappened: Claim[] };
  records: { publisher: string; official: boolean; title: string; publishedAt: string | null }[];
  places: string[];
};

/* Small whole numbers in a sentence ("two reports") are words, not figures worth a card. */
const FIGURE = /[₹$€£%.,]|\d{2,}/;

export function buildSlides(input: VisualInput, maxFigures = 3): Slide[] {
  const slides: Slide[] = [{ kind: "title", headline: input.headline, recordCount: input.records.length }];
  for (const claim of input.claims.oneMinute.slice(0, 2)) slides.push({ kind: "summary", text: claim.text, cites: claim.cites });

  const seen = new Set<string>();
  const figures: Slide[] = [];
  for (const claim of [...input.claims.keyDetails, ...input.claims.whatHappened, ...input.claims.oneMinute]) {
    for (const token of numbersIn(claim.text)) {
      if (!FIGURE.test(token) || seen.has(token) || figures.length >= maxFigures) continue;
      seen.add(token);
      figures.push({ kind: "figure", figure: token, text: claim.text, cites: claim.cites });
    }
  }
  slides.push(...figures);

  const timeline = [...input.records]
    .sort((a, b) => (a.publishedAt ?? "9999").localeCompare(b.publishedAt ?? "9999"))
    .slice(0, 5)
    .map((record) => ({ at: record.publishedAt, publisher: record.publisher, official: record.official, title: record.title }));
  if (timeline.length > 1) slides.push({ kind: "timeline", entries: timeline });
  if (input.places.length) slides.push({ kind: "where", places: input.places.slice(0, 6) });
  slides.push({ kind: "sources", publishers: [...new Set(input.records.map((record) => record.publisher))].slice(0, 8) });
  return slides;
}
