/**
 * Whether one notification may reach one reader, now. Pure: no clock, no
 * database, so every rule is tested with the cases that would embarrass us.
 *
 * The order is the order a reader would want explained: the editors' pause,
 * then the reader's own pause and choices, then whether the story is good
 * enough, then the reader's quiet hours and daily cap, then repetition.
 *
 * THE RULE THAT MATTERS MOST: heat alone never notifies. A story spreading
 * fast and confirmed by nobody is exactly the story that must not buzz a
 * phone. Every alert needs confidence and, except for breaking news, a match
 * with what the reader follows.
 */
import type { NotificationKind } from "@/lib/reader-vocab";

export type AlertKind = Extract<NotificationKind, "breaking" | "hot" | "topic" | "story_update">;
export const ALERT_KINDS: readonly AlertKind[] = ["breaking", "hot", "topic", "story_update"];

export type Candidate = {
  kind: NotificationKind;
  storyId: string | null;
  importance: number;
  heat: number;
  confidence: number;
  sourceCount: number;
  officialCount: number;
  /** 0-1: how well the story matches what the reader follows. 1 is an explicit follow. */
  relevance: number;
};

export type ReaderRules = {
  breaking: boolean;
  hot: boolean;
  topics: boolean;
  storyUpdates: boolean;
  morningBriefing: boolean;
  eveningBriefing: boolean;
  emailDigest: boolean;
  quietHours: boolean;
  quietStart: string;
  quietEnd: string;
  dailyCap: number;
  pausedUntil: string | null;
  timezone: string;
};

export type History = {
  /** Alerts (not briefings or digests) already sent today, in the reader's own day. */
  alertsToday: number;
  /** When this reader was last alerted about this story, if ever. */
  lastAlertForStory: string | null;
};

export type Decision = { allow: true } | { allow: false; reason: string };

export const STORY_COOLDOWN_HOURS = 12;

/** Minimum quality, per kind. Exported so the page that explains alerts states the real numbers. */
export const THRESHOLDS = {
  breaking: { importance: 75, confidence: 50 },
  hot: { heat: 75, confidence: 50, relevance: 0.5 },
  topic: { importance: 40, confidence: 40, relevance: 0.6 },
  story_update: { confidence: 30 },
} as const;

const OPTED: Record<NotificationKind, (rules: ReaderRules) => boolean> = {
  breaking: (rules) => rules.breaking,
  hot: (rules) => rules.hot,
  topic: (rules) => rules.topics,
  story_update: (rules) => rules.storyUpdates,
  morning_briefing: (rules) => rules.morningBriefing,
  evening_briefing: (rules) => rules.eveningBriefing,
  digest: (rules) => rules.emailDigest,
  test: () => true,
};

/** Minutes since local midnight in a time zone. */
export function localMinutes(now: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(now);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return (value("hour") % 24) * 60 + value("minute");
}

const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Whether `now` is inside the quiet window, which may run past midnight (22:00 to 07:00). */
export function inQuietHours(now: Date, rules: Pick<ReaderRules, "quietHours" | "quietStart" | "quietEnd" | "timezone">): boolean {
  if (!rules.quietHours) return false;
  const at = localMinutes(now, rules.timezone);
  const start = minutesOf(rules.quietStart);
  const end = minutesOf(rules.quietEnd);
  if (start === end) return false;
  return start < end ? at >= start && at < end : at >= start || at < end;
}

function goodEnough(candidate: Candidate): string | null {
  switch (candidate.kind) {
    case "breaking": {
      const t = THRESHOLDS.breaking;
      if (candidate.sourceCount < 2 && candidate.officialCount < 1) return "Only one publisher has it, and no official source.";
      if (candidate.importance < t.importance) return `Not important enough to interrupt you (${candidate.importance} of ${t.importance} needed).`;
      if (candidate.confidence < t.confidence) return `Not confirmed enough yet (sourced ${candidate.confidence} of ${t.confidence} needed).`;
      return null;
    }
    case "hot": {
      const t = THRESHOLDS.hot;
      if (candidate.heat < t.heat) return `Not hot enough (${candidate.heat} of ${t.heat}).`;
      if (candidate.confidence < t.confidence) return `Spreading faster than it is being confirmed (sourced ${candidate.confidence} of ${t.confidence} needed).`;
      if (candidate.relevance < t.relevance) return "Hot, but not about anything you follow.";
      return null;
    }
    case "topic": {
      const t = THRESHOLDS.topic;
      if (candidate.relevance < t.relevance) return "Not about anything you follow.";
      if (candidate.importance < t.importance) return `Not important enough to interrupt you (${candidate.importance} of ${t.importance} needed).`;
      if (candidate.confidence < t.confidence) return `Not confirmed enough yet (sourced ${candidate.confidence} of ${t.confidence} needed).`;
      return null;
    }
    case "story_update":
      return candidate.confidence < THRESHOLDS.story_update.confidence ? "The new reports are not confirmed enough yet." : null;
    default:
      return null;
  }
}

export function decide(candidate: Candidate, rules: ReaderRules, history: History, now: Date, { globalPause = false }: { globalPause?: boolean } = {}): Decision {
  const no = (reason: string): Decision => ({ allow: false, reason });
  const alert = (ALERT_KINDS as readonly string[]).includes(candidate.kind);
  if (globalPause && candidate.kind !== "test") return no("Notifications are paused for everyone by the editors.");
  if (rules.pausedUntil && new Date(rules.pausedUntil) > now && candidate.kind !== "test") return no("You paused notifications.");
  if (!OPTED[candidate.kind](rules)) return no("You have not switched this kind of notification on.");
  const quality = goodEnough(candidate);
  if (quality) return no(quality);
  // Briefings and the digest come at the times the reader chose; quiet hours are for interruptions.
  if (alert && inQuietHours(now, rules)) return no("It arrived during your quiet hours.");
  if (alert && history.alertsToday >= rules.dailyCap) return no(`You had reached your daily limit of ${rules.dailyCap}.`);
  if (alert && history.lastAlertForStory && now.getTime() - new Date(history.lastAlertForStory).getTime() < STORY_COOLDOWN_HOURS * 3_600_000) {
    return no("You were alerted about this story in the last twelve hours.");
  }
  return { allow: true };
}

/** The reader's own calendar day, as a string: the unit the daily cap counts in. */
export function localDay(now: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** Whether a scheduled send ("07:30") is due now: within the hour after the chosen time, in the reader's zone. */
export function scheduledNow(now: Date, at: string, timezone: string): boolean {
  const minute = localMinutes(now, timezone);
  const target = minutesOf(at);
  const since = (minute - target + 1440) % 1440;
  return since < 60;
}
