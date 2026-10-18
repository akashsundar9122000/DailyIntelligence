import type { Metadata } from "next";

import { requireSession } from "@/lib/auth/session";
import { listInterests } from "@/lib/services/reader";

import { InterestsSettings } from "./panels";

export const metadata: Metadata = { title: "Interests" };

export default async function InterestsPage() {
  const session = await requireSession();
  return <InterestsSettings interests={await listInterests(session.user.id)} />;
}
