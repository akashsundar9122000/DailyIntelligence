import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { getPreferences } from "@/lib/queries/preferences";

/**
 * Where signing in lands when no particular page was asked for: the reader's
 * chosen landing page. A route rather than a constant, so the choice is read
 * from the database at the moment it is needed.
 */
export default async function StartPage() {
  const session = await requireSession();
  const { landingPage } = await getPreferences(session.user.id);
  redirect(landingPage);
}
