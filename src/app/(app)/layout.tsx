import type { ReactNode } from "react";

import { AppShell } from "@/components/shell/app-shell";
import { EditionStrip } from "@/components/shell/edition-strip";
import { requireSession } from "@/lib/auth/session";
import { getEditionStatus } from "@/lib/queries/edition";
import { getPreferences } from "@/lib/queries/preferences";
import { isAdmin } from "@/lib/services/admin";
import { PreferencesProvider } from "@/lib/settings/client";

/**
 * The signed-in frame. It sends a visitor with no session to sign in.
 *
 * That redirect is a convenience, NOT the boundary: a layout does not re-run
 * for a server action or an API route. Every page here that reads private data
 * resolves the session itself, and every action goes through signedInAction.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await requireSession();
  const preferences = await getPreferences(session.user.id);
  const edition = await getEditionStatus();
  // Only decides whether the menu shows a link. The pages and the service check again.
  const admin = await isAdmin(session);
  return (
    <PreferencesProvider initial={preferences}>
      <AppShell
        strip={<EditionStrip status={edition} now={new Date()} />}
        user={{ name: session.user.name || session.user.email, email: session.user.email, admin }}
        notifications={{ unread: 0, recent: [] }}
      >
        {children}
      </AppShell>
    </PreferencesProvider>
  );
}
