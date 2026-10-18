import type { Metadata } from "next";

import { SectionPage } from "@/components/shell/section-page";

export const metadata: Metadata = { title: "For You" };

export default function ForYouPage() {
  return <SectionPage href="/app" />;
}
