import type { Metadata } from "next";

import { configuredProviders } from "@/lib/auth/auth";
import { linkedProviders } from "@/lib/auth/sessions";
import { requireSession } from "@/lib/auth/session";

import { AccountSettings } from "./form";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const session = await requireSession();
  const linked = await linkedProviders(session.user.id);
  return <AccountSettings name={session.user.name} email={session.user.email} linked={linked} available={configuredProviders()} />;
}
