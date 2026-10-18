import type { Metadata } from "next";

import { listSecurityEvents } from "@/lib/auth/security-events";
import { listDeviceSessions } from "@/lib/auth/sessions";
import { requireSession } from "@/lib/auth/session";

import { SecuritySettings } from "./panels";

export const metadata: Metadata = { title: "Security" };

export default async function SecurityPage() {
  const session = await requireSession();
  // One scope at a time: scopes do not nest and must not overlap on one connection.
  const devices = await listDeviceSessions(session.user.id, session.sessionId);
  const activity = await listSecurityEvents(session.user.id, 100);
  return <SecuritySettings devices={devices} activity={{ intact: activity.intact, events: activity.events }} />;
}
