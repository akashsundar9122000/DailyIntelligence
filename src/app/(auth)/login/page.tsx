import type { Metadata } from "next";

import { configuredProviders } from "@/lib/auth/auth";
import { oauthErrorMessage } from "@/lib/auth/messages";
import { safeNextPath } from "@/lib/auth/next-path";

import { LoginForm } from "./form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; email?: string; error?: string }> }) {
  const params = await searchParams;
  return (
    <LoginForm
      next={safeNextPath(params.next)}
      email={params.email ?? ""}
      providerError={oauthErrorMessage(params.error)}
      providers={configuredProviders()}
    />
  );
}
