import type { Metadata } from "next";

import { AppearanceSettings } from "./form";

export const metadata: Metadata = { title: "Appearance" };

export default function AppearancePage() {
  return <AppearanceSettings />;
}
