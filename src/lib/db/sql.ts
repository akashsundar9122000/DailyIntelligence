import { sql, type SQL } from "drizzle-orm";

/**
 * A timestamp column as an ISO-8601 UTC string, formatted BY POSTGRES.
 *
 * A timestamptz read through raw SQL does not arrive as a Date. The ORM
 * installs its own type parsers, so it arrives as a string -- in Postgres's
 * text format on one driver and possibly another shape on the next. A type
 * that says `Date` is then a lie the compiler believes, and the first call to
 * a date method crashes the page.
 *
 * So raw queries never return a timestamp as itself. They return this: one
 * exact string, the same from the local driver and from Neon's, typed as a
 * string.
 */
export function isoInstant(column: SQL): SQL<string> {
  return sql<string>`to_char(${column} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
}

/**
 * The condition that an item's source may be SHOWN, for a query that has
 * joined `sources` under the alias `src`.
 *
 * THE ONE COPY. Every query that decides what a reader may see asks this, so
 * a source withdrawn by an administrator -- its rights changed, or it was
 * switched off -- disappears from every screen on the next request, and there
 * is no list of eight queries to keep in step.
 *
 * Checked where data is READ, not where it is stored: rights can change after
 * an item was fetched, and the stored rows do not know.
 */
export function showableSource(): SQL {
  return sql`(src.rights_status = 'cleared' and src.headline_display_allowed)`;
}
