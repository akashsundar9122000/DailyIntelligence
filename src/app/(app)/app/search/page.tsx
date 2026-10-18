import type { Metadata } from "next";

import { SectionPage } from "@/components/shell/section-page";

export const metadata: Metadata = { title: "Explore" };

export default function Page() {
  return <SectionPage href="/app/search" />;
}
