import "server-only";

import { sql } from "drizzle-orm";

import { DatabaseNotConfigured } from "@/lib/db/client";
import { execRows, withPublic } from "@/lib/db/scope";
import { isoInstant, showableSocial, showableSource } from "@/lib/db/sql";

/*
 * Social Pulse reads. A post is shown only through its platform's embed, and
 * only while its source is cleared and switched on (showableSocial). A story
 * it is attached to must itself be showable.
 */

export type PostCard = {
  id: string;
  platform: "mastodon" | "bluesky" | "youtube";
  url: string;
  embedUrl: string;
  authorHandle: string;
  authorName: string | null;
  postedAt: string;
  replies: number;
  reposts: number;
  likes: number;
};

const POST_COLUMNS = sql`sp.id, sp.platform, sp.url, sp.embed_url as "embedUrl", sp.author_handle as "authorHandle", sp.author_name as "authorName",
  ${isoInstant(sql`sp.posted_at`)} as "postedAt", sp.replies, sp.reposts, sp.likes`;

async function read<T>(query: Parameters<typeof execRows>[1]): Promise<T[]> {
  try {
    return await withPublic((tx) => execRows<T>(tx, query));
  } catch (error) {
    if (error instanceof DatabaseNotConfigured) return [];
    throw error;
  }
}

export type Conversation = {
  storyId: string;
  headline: string;
  category: string | null;
  scope: "india" | "global";
  postsDay: number;
  postsSixHours: number;
  postsLastHour: number;
  /** "Accelerating" only against the story's own observed baseline: the last hour against the average hour of the five before. */
  accelerating: boolean;
  posts: PostCard[];
};

/** Stories with conversation in the last day, most discussed first, each with its newest posts. */
export async function conversations(limit = 12, perStory = 2): Promise<Conversation[]> {
  const rows = await read<Omit<Conversation, "accelerating" | "posts"> & { postsPrevFive: number }>(
    sql`select st.id as "storyId", st.headline, st.primary_category as category, st.scope,
               count(*)::int as "postsDay",
               count(*) filter (where sp.posted_at > now() - interval '6 hours')::int as "postsSixHours",
               count(*) filter (where sp.posted_at > now() - interval '1 hour')::int as "postsLastHour",
               count(*) filter (where sp.posted_at <= now() - interval '1 hour' and sp.posted_at > now() - interval '6 hours')::int as "postsPrevFive"
          from social_posts sp
          join sources ps on ps.id = sp.source_id
          join stories st on st.id = sp.story_id
          join raw_source_items hi on hi.id = st.headline_item_id
          join sources src on src.id = hi.source_id
         where ${showableSocial("ps")} and ${showableSource()} and sp.posted_at > now() - interval '24 hours'
         group by st.id
         order by count(*) desc, max(sp.posted_at) desc
         limit ${limit}`,
  );
  const result: Conversation[] = [];
  for (const row of rows) {
    const posts = await read<PostCard>(
      sql`select ${POST_COLUMNS} from social_posts sp join sources src on src.id = sp.source_id
           where sp.story_id = ${row.storyId}::uuid and ${showableSocial()} order by sp.posted_at desc limit ${perStory}`,
    );
    const baseline = row.postsPrevFive / 5;
    const { postsPrevFive, ...story } = row;
    void postsPrevFive;
    result.push({ ...story, accelerating: row.postsLastHour >= 3 && row.postsLastHour > 2 * Math.max(baseline, 0.5), posts });
  }
  return result;
}

export type TopicCount = { tag: string; posts: number };

/** The hashtags with the most posts in the last day. */
export async function topTopics(limit = 16): Promise<TopicCount[]> {
  return read<TopicCount>(
    sql`select tag, count(*)::int as posts from social_posts sp join sources src on src.id = sp.source_id, unnest(sp.hashtags) as tag
         where ${showableSocial()} and sp.posted_at > now() - interval '24 hours'
         group by tag order by count(*) desc, tag limit ${limit}`,
  );
}

export async function postsForTopic(tag: string, limit = 12): Promise<PostCard[]> {
  return read<PostCard>(
    sql`select ${POST_COLUMNS} from social_posts sp join sources src on src.id = sp.source_id
         where ${showableSocial()} and ${tag.toLowerCase()} = any(sp.hashtags) and sp.posted_at > now() - interval '24 hours'
         order by sp.posted_at desc limit ${limit}`,
  );
}

/** A story's conversation, for its page. */
export async function postsForStory(storyId: string, limit = 6): Promise<PostCard[]> {
  return read<PostCard>(
    sql`select ${POST_COLUMNS} from social_posts sp join sources src on src.id = sp.source_id
         where sp.story_id = ${storyId}::uuid and ${showableSocial()} order by sp.posted_at desc limit ${limit}`,
  );
}

export type PlatformState = { key: string; name: string; platform: string; connected: boolean; reason: string | null; postsDay: number };

/** Every social source and whether it is connected, with the reason when not: a platform that is off is said to be off. */
export async function platformStates(): Promise<PlatformState[]> {
  return read<PlatformState>(
    sql`select src.key, src.name, src.provider as platform, (src.enabled and src.rights_status = 'cleared') as connected,
               case when src.enabled then null else coalesce(src.rights_note, src.disable_reason) end as reason,
               (select count(*)::int from social_posts sp where sp.source_id = src.id and sp.posted_at > now() - interval '24 hours') as "postsDay"
          from sources src where src.source_type in ('social', 'video')
         order by (src.enabled and src.rights_status = 'cleared') desc, src.name`,
  );
}
