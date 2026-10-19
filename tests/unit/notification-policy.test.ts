import { describe, expect, it } from "vitest";

import { decide, inQuietHours, localDay, scheduledNow, type Candidate, type ReaderRules } from "@/lib/notifications/policy";

const RULES: ReaderRules = {
  breaking: true,
  hot: true,
  topics: true,
  storyUpdates: true,
  morningBriefing: true,
  eveningBriefing: true,
  emailDigest: true,
  quietHours: true,
  quietStart: "22:00",
  quietEnd: "07:00",
  dailyCap: 3,
  pausedUntil: null,
  timezone: "Asia/Kolkata",
};
const FRESH = { alertsToday: 0, lastAlertForStory: null };
/** 10:00 IST: outside quiet hours. */
const DAY = new Date("2026-10-19T04:30:00Z");
const story = (overrides: Partial<Candidate>): Candidate => ({ kind: "hot", storyId: "s1", importance: 60, heat: 90, confidence: 70, sourceCount: 4, officialCount: 0, relevance: 1, ...overrides });

describe("deciding whether a notification may go", () => {
  it("sends a hot story the reader follows, confirmed by several publishers", () => {
    expect(decide(story({}), RULES, FRESH, DAY)).toEqual({ allow: true });
  });

  it("never sends on heat alone: a viral, unconfirmed story is held back with the reason", () => {
    expect(decide(story({ heat: 99, confidence: 20 }), RULES, FRESH, DAY)).toEqual({ allow: false, reason: "Spreading faster than it is being confirmed (sourced 20 of 50 needed)." });
    expect(decide(story({ heat: 99, relevance: 0.2 }), RULES, FRESH, DAY)).toEqual({ allow: false, reason: "Hot, but not about anything you follow." });
  });

  it("needs breaking news to be important, confirmed, and from two publishers or an official source", () => {
    expect(decide(story({ kind: "breaking", importance: 80, relevance: 0 }), RULES, FRESH, DAY)).toEqual({ allow: true });
    expect(decide(story({ kind: "breaking", importance: 80, sourceCount: 1 }), RULES, FRESH, DAY)).toMatchObject({ allow: false, reason: "Only one publisher has it, and no official source." });
    expect(decide(story({ kind: "breaking", importance: 80, sourceCount: 1, officialCount: 1 }), RULES, FRESH, DAY)).toEqual({ allow: true });
    expect(decide(story({ kind: "breaking", importance: 60 }), RULES, FRESH, DAY).allow).toBe(false);
  });

  it("sends nothing the reader has not switched on", () => {
    expect(decide(story({}), { ...RULES, hot: false }, FRESH, DAY)).toEqual({ allow: false, reason: "You have not switched this kind of notification on." });
  });

  it("holds alerts in quiet hours, which run past midnight, in the reader's own time zone", () => {
    const lateIst = new Date("2026-10-19T17:30:00Z"); // 23:00 IST
    expect(decide(story({}), RULES, FRESH, lateIst)).toEqual({ allow: false, reason: "It arrived during your quiet hours." });
    // The same instant is 18:30 in London: not quiet there.
    expect(decide(story({}), { ...RULES, timezone: "Europe/London" }, FRESH, lateIst)).toEqual({ allow: true });
  });

  it("lets the briefing the reader scheduled through quiet hours, but not an alert", () => {
    const early = new Date("2026-10-19T00:30:00Z"); // 06:00 IST
    expect(decide(story({ kind: "morning_briefing" }), RULES, FRESH, early)).toEqual({ allow: true });
    expect(decide(story({}), RULES, FRESH, early).allow).toBe(false);
  });

  it("stops at the daily limit, and never alerts twice about one story within twelve hours", () => {
    expect(decide(story({}), RULES, { alertsToday: 3, lastAlertForStory: null }, DAY)).toEqual({ allow: false, reason: "You had reached your daily limit of 3." });
    expect(decide(story({}), RULES, { alertsToday: 0, lastAlertForStory: "2026-10-19T00:00:00Z" }, DAY)).toEqual({ allow: false, reason: "You were alerted about this story in the last twelve hours." });
    expect(decide(story({}), RULES, { alertsToday: 0, lastAlertForStory: "2026-10-18T12:00:00Z" }, DAY)).toEqual({ allow: true });
  });

  it("honours the reader's pause and the editors' pause, except for a test the reader asked for", () => {
    expect(decide(story({}), { ...RULES, pausedUntil: "2026-10-19T08:00:00Z" }, FRESH, DAY)).toEqual({ allow: false, reason: "You paused notifications." });
    expect(decide(story({}), RULES, FRESH, DAY, { globalPause: true })).toEqual({ allow: false, reason: "Notifications are paused for everyone by the editors." });
    expect(decide(story({ kind: "test" }), { ...RULES, pausedUntil: "2026-10-19T08:00:00Z" }, FRESH, DAY, { globalPause: true })).toEqual({ allow: true });
  });
});

describe("time in the reader's own zone", () => {
  it("knows a quiet window that does not cross midnight, and one that is switched off", () => {
    const rules = { quietHours: true, quietStart: "13:00", quietEnd: "14:00", timezone: "Asia/Kolkata" };
    expect(inQuietHours(new Date("2026-10-19T07:45:00Z"), rules)).toBe(true); // 13:15 IST
    expect(inQuietHours(new Date("2026-10-19T08:45:00Z"), rules)).toBe(false); // 14:15 IST
    expect(inQuietHours(new Date("2026-10-19T07:45:00Z"), { ...rules, quietHours: false })).toBe(false);
  });

  it("counts the day in the reader's zone, and a scheduled send is due for the hour after its time", () => {
    expect(localDay(new Date("2026-10-18T20:00:00Z"), "Asia/Kolkata")).toBe("2026-10-19");
    expect(scheduledNow(new Date("2026-10-19T02:00:00Z"), "07:30", "Asia/Kolkata")).toBe(true); // 07:30 IST
    expect(scheduledNow(new Date("2026-10-19T02:59:00Z"), "07:30", "Asia/Kolkata")).toBe(true); // 08:29
    expect(scheduledNow(new Date("2026-10-19T03:00:00Z"), "07:30", "Asia/Kolkata")).toBe(false); // 08:30
    expect(scheduledNow(new Date("2026-10-19T18:40:00Z"), "23:50", "Asia/Kolkata")).toBe(true); // 00:10 next day
  });
});
