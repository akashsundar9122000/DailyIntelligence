import { describe, expect, it } from "vitest";

import { formatClock, formatDateline, formatDay, formatInstant, isDay, relativeTime, timesLine } from "@/lib/format/date";

describe("days", () => {
  it("formats a day without ever making it a Date", () => {
    expect(formatDay("2026-10-09")).toBe("9 Oct 2026");
    expect(formatDay("2026-01-01")).toBe("1 Jan 2026");
    expect(formatDay("2024-02-29")).toBe("29 Feb 2024");
  });

  it("gives the same answer in every time zone", () => {
    // The bug this prevents: new Date("2026-10-09") is the 8th in the Americas.
    const original = process.env.TZ;
    for (const zone of ["Asia/Kolkata", "America/Los_Angeles", "Pacific/Kiritimati", "UTC"]) {
      process.env.TZ = zone;
      expect(formatDay("2026-10-09")).toBe("9 Oct 2026");
    }
    process.env.TZ = original;
  });

  it("rejects what is not a real day", () => {
    for (const bad of ["2026-02-30", "2025-02-29", "2026-13-01", "2026-00-10", "09-10-2026", "2026-10-9", "", "2026-10-09T00:00:00Z"]) {
      expect(isDay(bad)).toBe(false);
      expect(() => formatDay(bad)).toThrow(RangeError);
    }
  });
});

describe("instants", () => {
  it("shows the moment in India Standard Time and says so", () => {
    expect(formatInstant("2026-10-09T10:00:00Z")).toBe("9 Oct 2026, 3:30 pm IST");
    // Late evening UTC is already the next day in India.
    expect(formatInstant("2026-10-09T20:00:00Z")).toBe("10 Oct 2026, 1:30 am IST");
    // Midnight and noon are where engines' hour cycles part company ("0:00", "12:00").
    expect(formatInstant("2026-10-09T18:30:00Z")).toBe("10 Oct 2026, 12:00 am IST");
    expect(formatInstant("2026-10-09T06:30:00Z")).toBe("9 Oct 2026, 12:00 pm IST");
  });

  it("rejects what is not an instant", () => {
    expect(() => formatInstant("yesterday")).toThrow(RangeError);
  });
});

describe("relative times", () => {
  const now = new Date("2026-10-18T12:00:00Z");

  it("reads the way a reader scans", () => {
    expect(relativeTime("2026-10-18T11:59:30Z", now)).toBe("just now");
    expect(relativeTime("2026-10-18T11:42:00Z", now)).toBe("18 min ago");
    expect(relativeTime("2026-10-18T09:00:00Z", now)).toBe("3 hr ago");
    expect(relativeTime("2026-10-17T10:00:00Z", now)).toBe("yesterday");
    expect(relativeTime("2026-10-15T10:00:00Z", now)).toBe("3 days ago");
    // "Sep", from our own table: Node's en-IN wrote "Sept" and WebKit "Sep", and the difference broke hydration on an iPhone.
    expect(relativeTime("2026-09-01T10:00:00Z", now)).toBe("1 Sep 2026");
  });

  it("never says a story was published in the future", () => {
    // A source's clock running ahead of ours is "just now", not "in 4 min".
    expect(relativeTime("2026-10-18T12:04:00Z", now)).toBe("just now");
  });
});

describe("the provenance line", () => {
  const now = new Date("2026-10-18T12:00:00Z");

  it("keeps publication and detection apart", () => {
    expect(timesLine("2026-10-18T11:42:00Z", "2026-10-18T11:58:00Z", now)).toBe("Published 18 min ago · Detected 2 min ago");
  });

  it("says so when the source gave no publication time, rather than borrowing the detection time", () => {
    expect(timesLine(null, "2026-10-18T11:58:00Z", now)).toBe("Publication time not given · Detected 2 min ago");
  });
});

describe("the masthead", () => {
  it("dates the paper in India", () => {
    // 20:00 UTC on the 17th is already the 18th in India.
    expect(formatDateline("2026-10-17T20:00:00Z")).toBe("Sunday, 18 October 2026");
    expect(formatClock("2026-10-18T10:12:00Z")).toBe("3:42 pm");
  });
});
