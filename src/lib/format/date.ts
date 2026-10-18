/**
 * Dates, in two kinds that must never be mixed.
 *
 * A DAY ("2026-10-09") is a calendar date with no time and no zone: a NAV date,
 * a trade date. It is formatted by string arithmetic and never becomes a Date,
 * because a Date built from it is midnight UTC, and midnight UTC is still the
 * previous day somewhere and the next day somewhere else.
 *
 * An INSTANT is a moment. It is shown in India Standard Time, stated.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isDay(value: string): boolean {
  const match = DAY_PATTERN.exec(value);
  if (!match) return false;
  const month = Number.parseInt(match[2]!, 10);
  const day = Number.parseInt(match[3]!, 10);
  const year = Number.parseInt(match[1]!, 10);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  const lengths = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= lengths[month - 1]!;
}

export type DateFormat = "long" | "numeric" | "iso";

/**
 * A day, written the way the reader chose: "9 Oct 2026", "09/10/2026" or
 * "2026-10-09". Throws on anything that is not a real day.
 *
 * The numeric form is day first. It is offered because it is the convention in
 * India; it is not the default because 03/04 is read as two different days by
 * two different readers.
 */
export function formatDay(day: string, format: DateFormat = "long"): string {
  if (!isDay(day)) throw new RangeError(`Not a calendar day: ${day}`);
  const [, year, month, date] = DAY_PATTERN.exec(day)!;
  if (format === "iso") return day;
  if (format === "numeric") return `${date}/${month}/${year}`;
  return `${Number.parseInt(date!, 10)} ${MONTHS[Number.parseInt(month!, 10) - 1]} ${year}`;
}

const IST = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

/** An instant in India Standard Time, with the zone stated: "9 Oct 2026, 3:30 pm IST". */
export function formatInstant(iso: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) throw new RangeError(`Not an instant: ${iso}`);
  return `${IST.format(instant).replace(/ /g, " ")} IST`;
}

const IST_TIME = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit", hour12: true });
const IST_DATELINE = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "long", year: "numeric" });

/** A time of day in IST: "3:30 pm". */
export function formatClock(iso: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) throw new RangeError(`Not an instant: ${iso}`);
  return IST_TIME.format(instant).replace(/\u202f/g, " ");
}

/** The masthead's dateline: "Sunday, 18 October 2026". */
export function formatDateline(iso: string): string {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) throw new RangeError(`Not an instant: ${iso}`);
  return IST_DATELINE.format(instant);
}

/**
 * How long ago, in words a reader scans: "just now", "18 min ago", "3 hr ago",
 * "2 days ago", then the date. `now` is passed in, never read here, so a
 * server render and the test suite agree about what "now" was.
 *
 * A time in the future (a source's clock running ahead) is "just now", not
 * "in 4 min": a story cannot have been published later than we read it.
 */
export function relativeTime(iso: string, now: Date): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) throw new RangeError(`Not an instant: ${iso}`);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return days === 1 ? "yesterday" : `${days} days ago`;
  return formatInstant(iso).replace(/, .*$/, "");
}

/**
 * The provenance line every story carries (blueprint §6.4): when the source
 * says it was published and when we first had it. Never one standing in for
 * the other; a missing publication time is said, not filled.
 */
export function timesLine(publishedAt: string | null, detectedAt: string, now: Date): string {
  const detected = `Detected ${relativeTime(detectedAt, now)}`;
  return publishedAt ? `Published ${relativeTime(publishedAt, now)} · ${detected}` : `Publication time not given · ${detected}`;
}
