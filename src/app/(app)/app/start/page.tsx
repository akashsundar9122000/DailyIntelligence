import { redirect } from "next/navigation";

import { requireSession } from "@/lib/auth/session";
import { getPreferences } from "@/lib/queries/preferences";
import { getReaderProfile } from "@/lib/services/reader";

/**
 * Where signing in lands when no particular page was asked for: onboarding
 * for a reader who has not finished it, otherwise their chosen landing page.
 * A route rather than a constant, so the choice is read at the moment it is needed.
 */
export default async function StartPage() {
  const session = await requireSession();
  const profile = await getReaderProfile(session.user.id);
  if (!profile.onboardedAt) redirect("/app/onboarding");
  const { landingPage } = await getPreferences(session.user.id);
  redirect(landingPage);
}
