import type { Metadata } from "next";

import { DataSettings } from "./form";

export const metadata: Metadata = { title: "Data & privacy" };

export default function DataPage() {
  return <DataSettings />;
}
