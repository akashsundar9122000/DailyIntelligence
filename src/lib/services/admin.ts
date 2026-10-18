import "server-only";

import { sql } from "drizzle-orm";

import type { CurrentSession } from "@/lib/auth/session";
import { execRows, withUser } from "@/lib/db/scope";
import { adminEmails } from "@/lib/env";
import { notFound } from "@/lib/errors";

/**
 * WHO IS AN ADMINISTRATOR. An account whose email address is in ADMIN_EMAILS
 * AND which has confirmed that address. Both, never either: the list alone
 * would make an administrator of whoever signs up with a listed address before
 * its owner does. Read from the database on every call, not from the session
 * that was handed in.
 *
 * WHO IS NOT gets "not found" from every admin function. The pages do not exist
 * for them; a "forbidden" would say that they do.
 *
 * EVERY FUNCTION checks for itself. A page that checked on the way in is not a
 * boundary: an action is its own entrypoint.
 */
export async function isAdmin(session: CurrentSession | null): Promise<boolean> {
  if (!session) return false;
  const listed = adminEmails();
  if (listed.length === 0) return false;
  const rows = await withUser(session.user.id, (tx) =>
    execRows<{ email: string; verified: boolean }>(tx, sql`select lower(email) as email, email_verified as verified from users where id = ${session.user.id}::uuid`),
  );
  const user = rows[0];
  return Boolean(user && user.verified && listed.includes(user.email));
}

export async function requireAdmin(session: CurrentSession | null): Promise<CurrentSession> {
  if (!session || !(await isAdmin(session))) throw notFound("That page");
  return session;
}
