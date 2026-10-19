import "server-only";

import { sql } from "drizzle-orm";
import { uuidv7 } from "uuidv7";

import { brand } from "@/config/brand";
import { categoryFor } from "@/config/categories";
import { siteUrl } from "@/config/site";
import { execRows, withSystem } from "@/lib/db/scope";
import { isoInstant } from "@/lib/db/sql";
import { flushMail, queueMail } from "@/lib/mail/send";
import { decide, localDay, scheduledNow, type Candidate, type ReaderRules } from "@/lib/notifications/policy";
import { webPushSender, type PushPayload, type PushSender, type PushTarget } from "@/lib/notifications/push";
import { latestEditionBriefing } from "@/lib/queries/ai";
import { getPreferences } from "@/lib/queries/preferences";
import { candidateStories, type StoryCard } from "@/lib/queries/stories";
import { score } from "@/lib/ranking/relevance";
import type { NotificationChannel, NotificationKind } from "@/lib/reader-vocab";

import { recordedJob } from "./jobs";
import { isOn } from "./ops";
import { readerContext } from "./reader";

/*
 * The notification pass, run by the scheduler after the AI pass.
 *
 * At most ONE alert per reader per run: a run that finds three things worth
 * knowing sends the most important, and the next run the next, so a busy hour
 * does not arrive as a burst. Every decision is recorded once per reader per
 * dedupe key -- sent, or suppressed with the reason -- except a story that was
 * simply not good enough, which is the normal case and not news to anyone.
 */

const READERS_PER_RUN = 500;
const BREAKING_WINDOW_MINUTES = 60;

type Reader = ReaderRules & { userId: string; email: string; morningAt: string; eveningAt: string };

export type NotifySummary = {
  paused: boolean;
  readers: number;
  sent: number;
  suppressed: number;
  failed: number;
  emails: number;
  devicesRevoked: number;
};

async function readersToConsider(): Promise<Reader[]> {
  return withSystem("notify.readers", (tx) =>
    execRows<Reader>(
      tx,
      sql`select rp.user_id as "userId", u.email, rp.timezone, rp.notify_breaking as breaking, rp.notify_hot as hot, rp.notify_topics as topics,
                 rp.notify_story_updates as "storyUpdates", rp.morning_briefing as "morningBriefing", rp.evening_briefing as "eveningBriefing",
                 rp.email_digest as "emailDigest", rp.quiet_hours as "quietHours", rp.quiet_start as "quietStart", rp.quiet_end as "quietEnd",
                 rp.daily_cap as "dailyCap", ${isoInstant(sql`rp.paused_until`)} as "pausedUntil", rp.morning_at as "morningAt", rp.evening_at as "eveningAt"
            from reader_profiles rp join users u on u.id = rp.user_id
           where u.email_verified
             and (rp.notify_breaking or rp.notify_hot or rp.notify_topics or rp.notify_story_updates or rp.morning_briefing or rp.evening_briefing or rp.email_digest)
           order by rp.user_id
           limit ${READERS_PER_RUN}`,
    ),
  );
}

type Recent = { alertsToday: number; lastByStory: Map<string, string>; savedUpdates: { storyId: string; headline: string; itemCount: number; confidence: number }[]; devices: (PushTarget & { id: string })[] };

async function readerState(reader: Reader, now: Date): Promise<Recent> {
  return withSystem("notify.state", async (tx) => {
    const day = localDay(now, reader.timezone);
    const events = await execRows<{ storyId: string | null; kind: string; at: string; day: string }>(
      tx,
      sql`select story_id as "storyId", kind, ${isoInstant(sql`created_at`)} as at,
                 to_char(created_at at time zone ${reader.timezone}, 'YYYY-MM-DD') as day
            from notification_events
           where user_id = ${reader.userId}::uuid and status in ('sent', 'opened') and created_at > now() - interval '36 hours'`,
    );
    const alerts = events.filter((event) => ["breaking", "hot", "topic", "story_update"].includes(event.kind));
    const lastByStory = new Map<string, string>();
    for (const event of alerts) if (event.storyId && (lastByStory.get(event.storyId) ?? "") < event.at) lastByStory.set(event.storyId, event.at);
    const savedUpdates = await execRows<{ storyId: string; headline: string; itemCount: number; confidence: number }>(
      tx,
      sql`select st.id as "storyId", st.headline, st.item_count as "itemCount", st.confidence
            from bookmarks b join stories st on st.id = b.story_id
           where b.user_id = ${reader.userId}::uuid and st.last_updated_at > b.created_at and st.last_updated_at > now() - interval '2 hours'`,
    );
    const devices = await execRows<PushTarget & { id: string }>(
      tx,
      sql`select id, endpoint, p256dh, auth from push_subscriptions where user_id = ${reader.userId}::uuid and revoked_at is null`,
    );
    return { alertsToday: alerts.filter((event) => event.day === day).length, lastByStory, savedUpdates, devices };
  });
}

type Pending = { kind: NotificationKind; channel: NotificationChannel; dedupeKey: string; storyId: string | null; title: string; body: string; url: string; candidate: Candidate };

const sourced = (story: { sourceCount: number; confidence: number }) => `${story.sourceCount} ${story.sourceCount === 1 ? "publisher" : "publishers"} · sourced ${story.confidence}`;

function alertFor(story: StoryCard, kind: "breaking" | "hot" | "topic", reason: string): Omit<Pending, "candidate" | "channel"> {
  const section = categoryFor(story.category ?? "")?.label;
  const title = kind === "breaking" ? `Breaking: ${story.headline}` : kind === "hot" ? `Hot now: ${story.headline}` : `${section ?? "You follow this"}: ${story.headline}`;
  const body = kind === "hot" ? `${sourced(story)}. Heat is attention, not truth: see who reports it.` : `${sourced(story)}. ${reason}.`;
  return { kind, dedupeKey: `alert:${story.id}`, storyId: story.id, title: title.slice(0, 140), body: body.slice(0, 240), url: `/app/story/${story.id}` };
}

/** The reader's candidates, best first. Quality and their rules are the policy's to judge; this only proposes. */
async function candidatesFor(reader: Reader, state: Recent, recent: StoryCard[], now: Date): Promise<Pending[]> {
  const out: Pending[] = [];
  if (state.devices.length) {
    const preferences = await getPreferences(reader.userId);
    const context = await readerContext(reader.userId, preferences.defaultScope, preferences.readingHistory);
    for (const story of recent) {
      const ranked = score(story, context);
      // Blocked, or hidden by the reader: never an alert, whatever its heat.
      if (!ranked) continue;
      const followed = ranked.reason.startsWith("Because");
      const candidate = (kind: Candidate["kind"]): Candidate => ({
        kind,
        storyId: story.id,
        importance: story.importance,
        heat: story.heat,
        confidence: story.confidence,
        sourceCount: story.sourceCount,
        officialCount: story.officialCount,
        relevance: followed ? 1 : 0.3,
      });
      if (now.getTime() - new Date(story.firstSeenAt).getTime() < BREAKING_WINDOW_MINUTES * 60_000) out.push({ ...alertFor(story, "breaking", ranked.reason), channel: "push", candidate: candidate("breaking") });
      if (followed) out.push({ ...alertFor(story, "topic", ranked.reason), channel: "push", candidate: candidate("topic") });
      out.push({ ...alertFor(story, "hot", ranked.reason), channel: "push", candidate: candidate("hot") });
    }
    for (const saved of state.savedUpdates) {
      out.push({
        kind: "story_update",
        channel: "push",
        // A new key for each new report: an update is news once per report, not once per story.
        dedupeKey: `update:${saved.storyId}:${saved.itemCount}`,
        storyId: saved.storyId,
        title: `Update: ${saved.headline}`.slice(0, 140),
        body: "New reports on a story you saved.",
        url: `/app/story/${saved.storyId}`,
        candidate: { kind: "story_update", storyId: saved.storyId, importance: 0, heat: 0, confidence: saved.confidence, sourceCount: 0, officialCount: 0, relevance: 1 },
      });
    }
    const briefing = await latestEditionBriefing();
    const day = localDay(now, reader.timezone);
    for (const slot of ["morning", "evening"] as const) {
      const at = slot === "morning" ? reader.morningAt : reader.eveningAt;
      if (briefing?.slot === slot && scheduledNow(now, at, reader.timezone)) {
        const kind = slot === "morning" ? "morning_briefing" : "evening_briefing";
        out.push({
          kind,
          channel: "push",
          dedupeKey: `${kind}:${day}`,
          storyId: null,
          title: `Your ${slot} briefing`,
          body: briefing.lines[0] ? `${briefing.lines.length} stories, starting with: ${briefing.lines[0].text}`.slice(0, 240) : "The edition in a few minutes.",
          url: "/app/briefings",
          candidate: { kind, storyId: null, importance: 0, heat: 0, confidence: 0, sourceCount: 0, officialCount: 0, relevance: 1 },
        });
      }
    }
  }
  return out;
}

/** Record a decision once. Null when this reader already has one for this key: it was decided on an earlier run. */
async function record(reader: Reader, pending: Pending, status: "queued" | "suppressed", reason: string | null): Promise<string | null> {
  const id = uuidv7();
  const rows = await withSystem("notify.record", (tx) =>
    execRows<{ id: string }>(
      tx,
      sql`insert into notification_events (id, user_id, story_id, kind, channel, dedupe_key, status, reason, title, body, url)
          values (${id}::uuid, ${reader.userId}::uuid, ${pending.storyId}::uuid, ${pending.kind}, ${pending.channel}, ${pending.dedupeKey}, ${status}, ${reason},
                  ${pending.title}, ${pending.body}, ${pending.url})
          on conflict (user_id, dedupe_key) do nothing
          returning id`,
    ),
  );
  return rows[0]?.id ?? null;
}

/** Send to every device; sent if any took it. A device the service reports gone is revoked. */
export async function deliverPush(eventId: string, devices: (PushTarget & { id: string })[], payload: PushPayload, sender: PushSender): Promise<{ sent: boolean; revoked: number }> {
  let sent = false;
  let revoked = 0;
  // All devices at once: one slow push service must not hold up the next device, or the next reader.
  const outcomes = await Promise.all(devices.map(async (device) => ({ device, outcome: await sender.send(device, payload) })));
  for (const { device, outcome } of outcomes) {
    await withSystem("notify.device", (tx) =>
      outcome.ok
        ? tx.execute(sql`update push_subscriptions set last_success_at = now(), failures = 0 where id = ${device.id}::uuid`)
        : tx.execute(
            sql`update push_subscriptions set failures = failures + 1, revoked_at = case when ${outcome.gone} or failures + 1 >= 5 then now() else revoked_at end
                 where id = ${device.id}::uuid`,
          ),
    );
    if (outcome.ok) sent = true;
    else if (outcome.gone) revoked += 1;
  }
  await withSystem("notify.sent", (tx) =>
    tx.execute(
      sent
        ? sql`update notification_events set status = 'sent', sent_at = now() where id = ${eventId}::uuid`
        : sql`update notification_events set status = 'failed', reason = 'No device accepted it.' where id = ${eventId}::uuid`,
    ),
  );
  return { sent, revoked };
}

async function digest(reader: Reader, now: Date): Promise<boolean> {
  if (!reader.emailDigest || !scheduledNow(now, reader.morningAt, reader.timezone)) return false;
  const day = localDay(now, reader.timezone);
  const briefing = await latestEditionBriefing();
  const stories = briefing ? [] : (await candidateStories({ withinHours: 24 }, 40)).sort((a, b) => b.importance - a.importance).slice(0, 5);
  const lines = briefing ? briefing.lines.map((line) => line.text) : stories.map((story) => `${story.headline} (${sourced(story)})`);
  if (lines.length === 0) return false;
  const pending: Pending = {
    kind: "digest",
    channel: "email",
    dedupeKey: `digest:${day}`,
    storyId: null,
    title: `${brand.name}: your morning digest`,
    body: lines[0]!.slice(0, 240),
    url: "/app/briefings",
    candidate: { kind: "digest", storyId: null, importance: 0, heat: 0, confidence: 0, sourceCount: 0, officialCount: 0, relevance: 1 },
  };
  const id = await record(reader, pending, "queued", null);
  if (!id) return false;
  await withSystem("notify.digest", async (tx) => {
    await queueMail(tx, reader.email, "digest", {
      subject: pending.title,
      heading: briefing ? `The ${briefing.slot} briefing` : "The day's most important stories",
      paragraphs: [...lines.map((line, index) => `${index + 1}. ${line}`), briefing ? "Written by an AI model from the day's checked explainers; every line is linked to its sources in the paper." : "Ranked by importance, from rights-checked sources."],
      action: { label: "Open the paper", url: `${siteUrl}/app/briefings?n=${id}` },
      footnote: "You receive this because you switched on the email digest. Switch it off in Settings, Notifications.",
    });
    await tx.execute(sql`update notification_events set status = 'sent', sent_at = now() where id = ${id}::uuid`);
  });
  return true;
}

export async function runNotify({ trigger, budgetMs = 45_000, sender, now = new Date() }: { trigger: string; budgetMs?: number; sender?: PushSender | null; now?: Date }) {
  return recordedJob<NotifySummary>("notify", trigger, async () => {
    const summary: NotifySummary = { paused: false, readers: 0, sent: 0, suppressed: 0, failed: 0, emails: 0, devicesRevoked: 0 };
    const globalPause = !(await isOn("notifications"));
    if (globalPause) return { ...summary, paused: true };
    const deadline = Date.now() + budgetMs;
    const push = sender === undefined ? webPushSender() : sender;
    const readers = await readersToConsider();
    // One read of the recent paper for everyone; each reader's ranking is their own.
    const recent = (await candidateStories({ withinHours: 2 }, 120)).sort((a, b) => b.importance - a.importance || b.heat - a.heat);

    for (const reader of readers) {
      if (Date.now() > deadline - 5_000) break;
      summary.readers += 1;
      const state = await readerState(reader, now);
      if (await digest(reader, now)) summary.emails += 1;
      if (!push) continue;
      for (const pending of await candidatesFor(reader, state, recent, now)) {
        const decision = decide(pending.candidate, reader, { alertsToday: state.alertsToday, lastAlertForStory: pending.storyId ? (state.lastByStory.get(pending.storyId) ?? null) : null }, now, { globalPause });
        if (!decision.allow) {
          // Not good enough is the normal case and is not recorded; held back by the reader's own rules is, so "why did I not get it" has an answer.
          if (/quiet hours|daily limit|last twelve hours|paused/.test(decision.reason) && (await record(reader, pending, "suppressed", decision.reason))) summary.suppressed += 1;
          continue;
        }
        const eventId = await record(reader, pending, "queued", null);
        if (!eventId) continue;
        const outcome = await deliverPush(eventId, state.devices, { title: pending.title, body: pending.body, url: `${pending.url}?n=${eventId}`, tag: pending.dedupeKey }, push);
        summary.devicesRevoked += outcome.revoked;
        if (outcome.sent) summary.sent += 1;
        else summary.failed += 1;
        // One alert a run; a briefing is not an alert and does not use the turn.
        if (!pending.kind.endsWith("_briefing")) break;
      }
    }
    if (summary.emails) await flushMail();
    return summary;
  });
}
