import "server-only";

import { eq, sql } from "drizzle-orm";

import { getAuthDb } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { withSystem } from "@/lib/db/scope";
import { AppError } from "@/lib/errors";
import { accountDeletedMail } from "@/lib/mail/auth-mail";
import { flushMail, queueMail } from "@/lib/mail/send";

import type { CurrentSession } from "./session";
import { stepUpWithCode } from "./step-up";

/**
 * Delete an account and everything that belongs to it.
 *
 * A fresh emailed code is checked here, not only by an earlier step-up: this
 * cannot be undone, and the check must sit beside the delete it guards.
 *
 * One DELETE on `users`. Every table holding a user's data references it with
 * ON DELETE CASCADE -- sessions, preferences, interests, bookmarks, history,
 * push subscriptions, the security log --
 * so there is no list of tables here to forget to extend. The row count is
 * read back; zero rows is a failure, not a success.
 */
export async function deleteAccount(session: CurrentSession, code: string, requestHeaders: Headers): Promise<void> {
  await stepUpWithCode(session, code, requestHeaders);

  const removed = await getAuthDb().delete(users).where(eq(users.id, session.user.id)).returning({ id: users.id });
  if (removed.length !== 1) throw new AppError("INTERNAL", "Your account could not be deleted. Please try again.");

  // After the delete, to the address the account had. Best effort: the account
  // is gone whether or not this message can be sent.
  try {
    // The outbox has no link to an account, so nothing removes its rows with one. The messages sent
    // to this address (codes, digests naming what was followed) go first; the farewell
    // then queued is the only one left, and says nothing about what the account held.
    await withSystem("account.deleted-mail", async (tx) => {
      await tx.execute(sql`delete from email_outbox where lower(to_email) = lower(${session.user.email})`);
      await queueMail(tx, session.user.email, "account-deleted", accountDeletedMail());
    });
    await flushMail();
  } catch {
    // Nothing to roll back to.
  }
}
