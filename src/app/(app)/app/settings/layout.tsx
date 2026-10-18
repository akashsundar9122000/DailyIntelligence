import type { ReactNode } from "react";

import { PageHeader } from "@/components/ui/page-header";
import { PillTabs } from "@/components/ui/pill-tabs";

/**
 * One route per tab, so a tab can be linked to, reloaded and reached with the
 * back button. A tab is listed only once what it holds works: a settings tab
 * that leads to "coming soon" is a dead end, which the blueprint rules out.
 */
export const SETTINGS_TABS = [
  { href: "/app/settings/account", label: "Account" },
  { href: "/app/settings/interests", label: "Interests" },
  { href: "/app/settings/reading", label: "Reading" },
  { href: "/app/settings/appearance", label: "Appearance" },
  { href: "/app/settings/security", label: "Security" },
  { href: "/app/settings/data", label: "Data & privacy" },
];

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader kicker="Your desk" title="Settings" description="What you follow, how the paper looks, how you are alerted, and what is kept about you." />
      <PillTabs label="Settings sections" tabs={SETTINGS_TABS} />
      {/* One column at a reading width: a setting's explanation is read, and squeezed beside its control into half a page it was not. */}
      <div className="grid grid-cols-1 items-start gap-5">{children}</div>
    </div>
  );
}
