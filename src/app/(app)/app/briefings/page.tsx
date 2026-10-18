import type { Metadata } from "next";

import { SectionPage } from "@/components/shell/section-page";

export const metadata: Metadata = { title: "Briefings" };

export default function Page() {
  return <SectionPage href="/app/briefings" />;
}
