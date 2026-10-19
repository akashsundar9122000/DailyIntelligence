import { categoryFor } from "@/config/categories";
import { INDIAN_STATES } from "@/config/regions";

/**
 * Which picture a story gets, decided in one place.
 *
 * In order: a licensed photo, an official video's thumbnail, a checked AI
 * illustration, a map of where it happened, and the section's cover art,
 * which every story can have -- so no story is ever without a picture, and
 * no story is ever given a picture it has no right to.
 *
 * Pure: no I/O. The queries supply what is stored (photo, video, AI rows,
 * each already through showableImage()); places and section come from the
 * story itself.
 *
 * A publisher's own photo is never one of the choices. GDELT carries its URL;
 * it is the publisher's copyright, and a feed existing is not permission.
 */

export type StoredImage = {
  kind: "photo" | "video" | "ai";
  src: string;
  width: number;
  height: number;
  alt: string;
  /** Who to credit: "NASA", "YouTube · DD News", "AI illustration". */
  credit: string;
};

export type StoryImage =
  | (StoredImage & { label: string })
  | { kind: "map"; focus: string; pins: string[]; alt: string; credit: string; label: string }
  | { kind: "art"; seed: string; section: string | null; alt: string; credit: string; label: string };

export type ImageInputs = {
  id: string;
  headline: string;
  category: string | null;
  scope: "india" | "global" | "both" | string;
  states: string[];
  countries: string[];
  /** Stored images for this story, best first by kind; any may be absent. */
  stored?: StoredImage[];
};

const ORDER: StoredImage["kind"][] = ["photo", "video", "ai"];

/** The label shown with each kind: never let an illustration pass for a photo. */
const LABELS = { photo: "Photo", video: "Video", ai: "AI illustration", map: "Map", art: "Illustration" } as const;

export function storyImage(story: ImageInputs): StoryImage {
  for (const kind of ORDER) {
    const found = story.stored?.find((image) => image.kind === kind);
    if (found) return { ...found, label: LABELS[kind] };
  }

  const place = placeOf(story);
  if (place) return { kind: "map", ...place, credit: "Map: Natural Earth", label: LABELS.map };

  const section = categoryFor(story.category ?? "")?.label ?? null;
  return {
    kind: "art",
    seed: story.id,
    section: story.category,
    // Decoration: the headline beside it already says what the story is.
    alt: "",
    credit: section ? `Illustration · ${section}` : "Illustration",
    label: LABELS.art,
  };
}

/**
 * A place specific enough to be worth a map: an Indian state, or a country
 * other than India. "Somewhere in India" on every Indian story would be the
 * same map a hundred times, which says nothing.
 */
function placeOf(story: ImageInputs): { focus: string; pins: string[]; alt: string } | null {
  const pins = story.states.filter((code) => INDIAN_STATES.some((state) => state.code === code)).slice(0, 3);
  if (pins.length > 0) {
    const names = pins.map((code) => INDIAN_STATES.find((state) => state.code === code)!.label);
    return { focus: "IN", pins, alt: `Map of India marking ${listOf(names)}` };
  }
  const abroad = story.countries.find((code) => code !== "IN");
  if (abroad && story.scope !== "india") return { focus: abroad, pins: [], alt: `Map marking ${abroad}` };
  return null;
}

function listOf(names: string[]): string {
  return names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
}
