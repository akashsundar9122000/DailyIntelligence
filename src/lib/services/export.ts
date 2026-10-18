import "server-only";

import { sql } from "drizzle-orm";

import { execRows, withUser } from "@/lib/db/scope";
import { isoInstant } from "@/lib/db/sql";

/**
 * Everything held about one reader, in one JSON document. Read in their own
 * scope, by NAMED columns: no session token, no code, no OAuth token, no
 * hash. What is not theirs to read is not in it, by construction.
 */
export async function exportReaderData(userId: string): Promise<Record<string, unknown>> {
  return withUser(userId, async (tx) => {
    const take = <T,>(query: ReturnType<typeof sql>) => execRows<T>(tx, query);
    return {
      exportedAt: new Date().toISOString(),
      account: (await take(sql`select name, email, email_verified as "emailVerified", ${isoInstant(sql`created_at`)} as "createdAt" from users where id = ${userId}::uuid`))[0] ?? null,
      preferences: (await take<{ preferences: unknown }>(sql`select preferences from user_settings where user_id = ${userId}::uuid`))[0]?.preferences ?? {},
      profile: (await take(sql`select onboarding_step as "onboardingStep", ${isoInstant(sql`onboarded_at`)} as "onboardedAt", timezone, notify_breaking as "notifyBreaking",
                                 notify_hot as "notifyHot", notify_topics as "notifyTopics", notify_story_updates as "notifyStoryUpdates", morning_briefing as "morningBriefing",
                                 evening_briefing as "eveningBriefing", email_digest as "emailDigest", morning_at as "morningAt", evening_at as "eveningAt",
                                 quiet_hours as "quietHours", quiet_start as "quietStart", quiet_end as "quietEnd", daily_cap as "dailyCap"
                            from reader_profiles where user_id = ${userId}::uuid`))[0] ?? null,
      interests: await take(sql`select kind, value, label, stance, priority, origin, ${isoInstant(sql`created_at`)} as "createdAt" from user_interests where user_id = ${userId}::uuid order by created_at`),
      saved: await take(sql`select b.story_id as "storyId", b.headline_snapshot as headline, b.note, ${isoInstant(sql`b.read_at`)} as "readAt", ${isoInstant(sql`b.created_at`)} as "savedAt",
                                   coalesce((select array_agg(c.name) from collection_items ci join collections c on c.id = ci.collection_id where ci.bookmark_id = b.id), '{}') as collections
                              from bookmarks b where b.user_id = ${userId}::uuid order by b.created_at`),
      collections: await take(sql`select name, ${isoInstant(sql`created_at`)} as "createdAt" from collections where user_id = ${userId}::uuid order by name`),
      feedback: await take(sql`select story_id as "storyId", kind, ${isoInstant(sql`created_at`)} as "createdAt" from user_story_feedback where user_id = ${userId}::uuid order by created_at`),
      readingHistory: await take(sql`select story_id as "storyId", opens, ${isoInstant(sql`first_opened_at`)} as "firstOpenedAt", ${isoInstant(sql`last_opened_at`)} as "lastOpenedAt"
                                       from reading_history where user_id = ${userId}::uuid order by last_opened_at`),
      reports: await take(sql`select story_id as "storyId", reason, detail, status, ${isoInstant(sql`created_at`)} as "createdAt" from content_reports where user_id = ${userId}::uuid order by created_at`),
      securityLog: await take(sql`select kind, detail, ${isoInstant(sql`created_at`)} as "createdAt" from security_events where user_id = ${userId}::uuid order by seq`),
    };
  });
}
