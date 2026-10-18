import type { Metadata } from "next";

import { DRAFT_NOTICE, ProsePage, ProseSection } from "@/components/marketing/prose";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Privacy notice" };

export default function PrivacyPage() {
  return (
    <ProsePage kicker="The fine print" title="Privacy notice" lead={`What ${brand.name} keeps about you, why, and how to take it back.`} notice={DRAFT_NOTICE}>
      <ProseSection id="what" title="What we keep">
        <ul>
          <li><strong>Your email address and name</strong>, to sign you in. There is no password.</li>
          <li><strong>What you chose</strong>: the categories, places, people, topics and sources you follow, mute or block, and your top priorities.</li>
          <li><strong>What you saved</strong>: bookmarks, collections and any private note you write on them.</li>
          <li><strong>What you read</strong>, only while &ldquo;Remember what I read&rdquo; is on. Switch it off and nothing you open is recorded.</li>
          <li><strong>Your settings</strong>: appearance, edition, notification rules and quiet hours.</li>
          <li><strong>Security records</strong>: the devices signed in to your account, and a log of sign-ins and security changes. A network is kept as its first two numbers only, and a device as its browser family.</li>
        </ul>
      </ProseSection>
      <ProseSection id="not" title="What we do not do">
        <ul>
          <li>We do not infer your politics, health or religion from what you read. Those interests exist only if you choose them.</li>
          <li>We do not sell or share your interests with advertisers. There are no advertisers.</li>
          <li>We do not send your email address or name to the AI service. It sees source text, not you.</li>
        </ul>
      </ProseSection>
      <ProseSection id="control" title="Your control">
        <p>From Settings you can change every interest, switch reading history and personalisation off, sign out other devices, and delete your account. Deleting it removes everything listed above at once and cannot be undone.</p>
      </ProseSection>
      <ProseSection id="processors" title="Who processes it">
        <p>The service runs on Vercel (application hosting) and Neon (database), in the Singapore region. Sign-in codes are sent by email through Google&rsquo;s mail servers. If you use &ldquo;Continue with Google&rdquo;, Google tells us your email address and name.</p>
      </ProseSection>
    </ProsePage>
  );
}
