import pg from "pg";

/*
 * A small invented edition for the end-to-end suite, written straight into
 * the TEST database before the run. Every headline is invented test text,
 * on .example domains; none of it is news, and none of it can reach a reader:
 * the suite's database is local and named *_test (assertTestDatabase).
 *
 * Seeded directly rather than through the pipeline because the suite's server
 * has no route to the internet by design; the pipeline itself is covered by
 * tests/integration/ingestion.test.ts with recorded responses.
 */

export type SeedStory = {
  key: string;
  headline: string;
  category: string;
  scope: "india" | "global";
  states?: string[];
  countries?: string[];
  heat: number;
  confidence: number;
  importance: number;
  publishers: string[];
  official?: boolean;
  /** The headline item comes from a source cleared for media, and carries a picture on its asset host. */
  photo?: boolean;
  minutesAgo: number;
};

export const SEED_STORIES: SeedStory[] = [
  { key: "lane", headline: "Seaside city council approves a longer cycle lane", category: "india-politics", scope: "india", states: ["TN"], heat: 72, confidence: 66, importance: 70, publishers: ["alpha.example", "beta.example", "gamma.example"], minutesAgo: 20 },
  { key: "monsoon", headline: "Monsoon reaches the southern districts two days early", category: "climate", scope: "india", states: ["KL"], heat: 55, confidence: 78, importance: 64, publishers: ["seed-official.example", "alpha.example"], official: true, minutesAgo: 45 },
  { key: "final", headline: "Regional side wins a tense cricket final on the last ball", category: "cricket", scope: "india", states: ["MH"], heat: 88, confidence: 32, importance: 40, publishers: ["delta.example", "beta.example"], minutesAgo: 10 },
  { key: "festival", headline: "Independent film festival announces its opening programme", category: "cinema", scope: "india", states: ["KA"], heat: 38, confidence: 44, importance: 28, publishers: ["gamma.example"], minutesAgo: 240 },
  { key: "survey", headline: "Observatory releases a new open map of the southern sky", category: "science", scope: "global", countries: ["AU"], photo: true, heat: 30, confidence: 51, importance: 33, publishers: ["epsilon.example", "zeta.example"], minutesAgo: 300 },
  { key: "river", headline: "Two neighbouring countries agree on a shared river survey", category: "world-politics", scope: "global", countries: ["FR", "DE"], heat: 46, confidence: 59, importance: 55, publishers: ["eta.example", "theta.example", "iota.example"], minutesAgo: 180 },
  { key: "chip", headline: "Chip makers outline a plan for quieter data centre cooling", category: "technology", scope: "global", countries: ["US"], heat: 41, confidence: 47, importance: 36, publishers: ["kappa.example", "lambda.example"], minutesAgo: 120 },
  { key: "model", headline: "Research lab publishes an open AI model for translation", category: "ai", scope: "global", countries: ["US"], heat: 63, confidence: 52, importance: 45, publishers: ["mu.example", "nu.example"], minutesAgo: 60 },
  { key: "market", headline: "Small business lending rises for a third straight month", category: "business", scope: "india", states: ["DL"], heat: 35, confidence: 61, importance: 48, publishers: ["xi.example", "omicron.example"], minutesAgo: 400 },
  { key: "football", headline: "Coastal club signs a young forward from the academy", category: "football", scope: "global", countries: ["ES"], heat: 50, confidence: 40, importance: 22, publishers: ["pi.example"], minutesAgo: 90 },
];

export const SEED_SOURCE_KEYS = { news: "e2e-news-index", official: "e2e-official", photo: "e2e-photo-desk" } as const;

/** The seed picture: on an allowed asset host (next.config remotePatterns), so it is served through /_next/image. */
export const SEED_PHOTO_URL = "https://assets.science.nasa.gov/dynamicimage/e2e/southern-sky.jpg";

/** Write the seed edition. Idempotent within a run: the caller truncates first. */
export async function seedEdition(ownerUrl: string): Promise<void> {
  const client = new pg.Client({ connectionString: ownerUrl });
  await client.connect();
  try {
    const source = async (key: string, name: string, type: string, official: boolean, excerpt: boolean) =>
      (
        await client.query<{ id: string }>(
          `insert into sources (id, key, name, canonical_domain, source_type, provider, feed_url, country_or_region, is_official, rights_status,
                                headline_display_allowed, excerpt_display_allowed, enabled, health_status, last_success_at, newest_item_at, terms_url, rights_checked_on)
           values (gen_random_uuid(), $1, $2, $3, $4, 'rss', 'https://fixtures.invalid/feed', 'IN', $5, 'cleared', true, $6, true, 'healthy', now() - interval '3 minutes',
                   now() - interval '10 minutes', 'https://fixtures.invalid/terms', '2026-10-18')
           returning id`,
          [key, name, `${key}.example`, type, official, excerpt],
        )
      ).rows[0]!.id;
    const newsId = await source(SEED_SOURCE_KEYS.news, "E2E News Index", "aggregator", false, false);
    const officialId = await source(SEED_SOURCE_KEYS.official, "E2E Official Bureau", "official", true, true);
    // Cleared for media, as NASA is: its pictures are shown, credited to it.
    const photoId = await source(SEED_SOURCE_KEYS.photo, "E2E Photo Desk", "official", true, false);
    await client.query("update sources set media_reuse_allowed = true where id = $1", [photoId]);

    for (const story of SEED_STORIES) {
      const itemIds: string[] = [];
      for (const [index, publisher] of story.publishers.entries()) {
        const isOfficial = story.official && index === 0;
        const withPhoto = story.photo && index === 0;
        const minutes = story.minutesAgo + index * 7;
        const item = await client.query<{ id: string }>(
          `insert into raw_source_items (id, source_id, provider_item_id, canonical_url, url_hash, publisher_domain, publisher_name, title, normalized_title, excerpt,
                                         content_type, published_at, ingested_at, categories, event_countries, indian_states, media_url, metadata)
           values (gen_random_uuid(), $1, $2, $3, md5($3), $4, $5, $6, lower($6), $7, $8, now() - make_interval(mins => $9), now() - make_interval(mins => $9 - 3), $10, $11, $12,
                   $13, $14::jsonb)
           returning id`,
          [
            withPhoto ? photoId : isOfficial ? officialId : newsId,
            `${story.key}-${index}`,
            `https://${publisher}/${story.key}-${index}`,
            publisher,
            publisher.replace(".example", "").replace(/^\w/, (c) => c.toUpperCase()),
            index === 0 ? story.headline : `${story.headline} (report ${index + 1})`,
            isOfficial ? "The bureau's own statement, quoted here as the excerpt its terms allow." : null,
            isOfficial ? "official_statement" : "report",
            minutes,
            [story.category],
            story.scope === "india" ? ["IN"] : story.countries ?? [],
            story.states ?? [],
            withPhoto ? SEED_PHOTO_URL : null,
            JSON.stringify(withPhoto ? { mediaAlt: "Stars over an observatory dome" } : {}),
          ],
        );
        itemIds.push(item.rows[0]!.id);
      }
      const created = await client.query<{ id: string }>(
        `insert into stories (id, headline, headline_item_id, signature, primary_category, categories, scope, event_countries, indian_states, state,
                              item_count, source_count, official_count, first_seen_at, first_published_at, last_updated_at, heat, confidence, importance, score_version, scored_at)
         values (gen_random_uuid(), $1, $2, lower($1), $3, $4, $5, $6, $7, $8, $9, $9, $10, now() - make_interval(mins => $11 + 30),
                 now() - make_interval(mins => $11 + 30), now() - make_interval(mins => $11), $12, $13, $14, 'e2e-seed', now())
         returning id`,
        [
          story.headline,
          itemIds[0],
          story.category,
          [story.category],
          story.scope,
          story.scope === "india" ? ["IN"] : story.countries ?? [],
          story.states ?? [],
          story.minutesAgo < 60 ? "developing" : "active",
          story.publishers.length,
          story.official ? 1 : 0,
          story.minutesAgo,
          story.heat,
          story.confidence,
          story.importance,
        ],
      );
      const storyId = created.rows[0]!.id;
      for (const itemId of itemIds) {
        await client.query(`insert into story_items (id, story_id, item_id, association_confidence, method) values (gen_random_uuid(), $1, $2, 90, 'title')`, [storyId, itemId]);
      }
      await client.query(
        `insert into story_scores (id, story_id, version, heat, heat_components, confidence, confidence_components, importance, importance_components)
         values (gen_random_uuid(), $1, 'e2e-seed', $2, '{"velocity":600,"spread":500,"recency":800,"engagement":0,"breadth":200}', $3,
                 '{"independent":500,"primary":0,"settled":700}', $4, '{"official":0,"severity":1000,"reach":0,"coverage":500}')`,
        [storyId, story.heat, story.confidence, story.importance],
      );
    }

    // Social Pulse: one connected platform with three posts about the cricket final, and one that is not connected, with its reason.
    const mastodon = (
      await client.query<{ id: string }>(
        `insert into sources (id, key, name, canonical_domain, source_type, provider, feed_url, country_or_region, rights_status, headline_display_allowed, enabled, rights_note)
         values (gen_random_uuid(), 'e2e-mastodon', 'mastodon.social', 'mastodon.social', 'social', 'mastodon', 'https://fixtures.invalid/api/v1/timelines/tag/', 'global', 'cleared', false, true, 'Public posts, embedded and linked.')
         returning id`,
      )
    ).rows[0]!.id;
    await client.query(
      `insert into sources (id, key, name, canonical_domain, source_type, provider, feed_url, country_or_region, rights_status, headline_display_allowed, enabled, rights_note)
       values (gen_random_uuid(), 'e2e-bluesky', 'Bluesky', 'bsky.app', 'social', 'bluesky', 'https://fixtures.invalid/xrpc', 'global', 'pending_review', false, false,
               'Not yet: needs a public contact address.')`,
    );
    const final = (await client.query<{ id: string }>("select id from stories where headline = $1", [SEED_STORIES.find((story) => story.key === "final")!.headline])).rows[0]!.id;
    for (const n of [1, 2, 3]) {
      await client.query(
        `insert into social_posts (id, source_id, platform, external_id, url, embed_url, author_handle, author_name, posted_at, tokens, hashtags, replies, reposts, likes, story_id)
         values (gen_random_uuid(), $1, 'mastodon', $2, $3, $4, $5, 'A Cricket Fan', now() - make_interval(mins => $6), '{cricket,final,ball}', '{cricket}', 1, 2, 3, $7)`,
        [mastodon, `e2e-${n}`, `https://fixtures.invalid/@fan${n}/${n}`, `https://fixtures.invalid/@fan${n}/${n}/embed`, `@fan${n}@mastodon.social`, n * 10, final],
      );
    }
  } finally {
    await client.end();
  }
}
