/**
 * Column helpers: the schema decisions, made once.
 *
 * A decision made in a shared helper is a decision nobody re-makes badly later.
 */
import { sql } from "drizzle-orm";
import { date, timestamp, uuid } from "drizzle-orm/pg-core";
import { uuidv7 } from "uuidv7";

/**
 * uuidv7, generated in APPLICATION code.
 *
 *  - time-sortable, so inserts keep B-tree locality instead of scattering;
 *  - not enumerable -- nobody walks /portfolios/1;
 *  - KNOWN BEFORE THE INSERT, so a parent, its children and an audit row go
 *    into one transaction with no RETURNING round trip;
 *  - independent of the server: local Postgres 17 has no uuidv7(), and a
 *    default written for one server version fails on the other.
 */
export const primaryId = () => uuid("id").primaryKey().$defaultFn(uuidv7);

/** A foreign key to another table's id. Cascade is opt-in, per call site. */
export const fk = (name: string) => uuid(name);

/**
 * A timestamp whose column name you choose.
 *
 * There is deliberately no `createdAt()` helper with a fixed column name: used
 * for a second field on the same table it makes two TypeScript properties point
 * at ONE column. Drizzle dedupes them silently and the failure appears only at
 * INSERT time as `column "created_at" specified more than once`.
 *
 * timestamptz always. A naive timestamp is a bug waiting for the first reader
 * in another zone.
 */
export const namedTimestamp = (name: string) =>
  timestamp(name, { withTimezone: true, mode: "date" }).notNull().default(sql`now()`);

/** Nullable variant, for "has not happened yet". */
export const optionalTimestamp = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

/**
 * A DAY, not an instant: a NAV date, a trade date, an ex-dividend date.
 *
 * Read as a string and kept as one. A date read as a Date and written back
 * through .toISOString() LOSES A DAY for anyone east of UTC -- which is every
 * user this product is built for.
 */
export const day = (name: string) => date(name, { mode: "string" });

/**
 * A CHECK constraint generated from the same array that gives the TS union.
 *
 * sql.raw, deliberately: sql`${value}` produces a BIND PARAMETER, and a bind
 * parameter is not legal in DDL. A generated CHECK once came out as
 * `IN ($1, $2, $3)`.
 */
export const inVocab = (column: string, values: readonly string[]) =>
  sql.raw(`"${column}" IN (${values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")})`);
