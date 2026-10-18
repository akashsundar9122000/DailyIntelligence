/**
 * The category vocabulary (blueprint §4 step 2 and §5.5). One list, used by
 * onboarding, the category pages, the classifier and the source catalogue, so
 * a category cannot exist in one place and be missing from another.
 *
 * `sensitive` marks a category whose interest is never INFERRED from reading
 * (blueprint §4: no political, health or religious inference). A reader may
 * still choose it; it is then an explicit interest and can be removed.
 */
export type Category = {
  slug: string;
  label: string;
  /** One line for the category page header and onboarding chip tooltip. */
  summary: string;
  sensitive?: boolean;
};

export const CATEGORIES = [
  { slug: "cinema", label: "Cinema & Entertainment", summary: "Film industries, releases, box office and streaming." },
  { slug: "cricket", label: "Cricket", summary: "International and domestic cricket." },
  { slug: "football", label: "Football", summary: "Leagues, clubs and national teams." },
  { slug: "sports", label: "Other Sports", summary: "Tennis, motorsport, athletics, chess and more." },
  { slug: "india-politics", label: "Indian Politics", summary: "Parliament, states, elections and policy.", sensitive: true },
  { slug: "world-politics", label: "World Politics", summary: "Governments, diplomacy and conflict.", sensitive: true },
  { slug: "business", label: "Business & Markets", summary: "Companies, the economy and markets." },
  { slug: "startups", label: "Startups", summary: "Funding, founders and new companies." },
  { slug: "ai", label: "AI", summary: "Models, labs, research, products, policy and safety." },
  { slug: "technology", label: "Technology", summary: "Software, devices, the internet and telecom." },
  { slug: "science", label: "Science", summary: "Research and discovery." },
  { slug: "space", label: "Space", summary: "Missions, launches and astronomy." },
  { slug: "health", label: "Health", summary: "Public health, medicine and wellbeing.", sensitive: true },
  { slug: "climate", label: "Climate", summary: "Climate, weather extremes, energy and environment." },
  { slug: "gaming", label: "Gaming", summary: "Games, esports and the industry." },
  { slug: "education", label: "Education", summary: "Schools, universities and exams." },
  { slug: "lifestyle", label: "Lifestyle", summary: "Food, travel, culture and living." },
] as const satisfies readonly Category[];

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const CATEGORY_SLUGS = CATEGORIES.map((category) => category.slug) as readonly CategorySlug[];

export function categoryFor(slug: string): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}

export function isCategorySlug(value: unknown): value is CategorySlug {
  return typeof value === "string" && (CATEGORY_SLUGS as readonly string[]).includes(value);
}
