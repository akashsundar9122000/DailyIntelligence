import type { Metadata } from "next";

import { ReadingSettings } from "./form";

export const metadata: Metadata = { title: "Reading" };

export default function ReadingPage() {
  return <ReadingSettings />;
}
