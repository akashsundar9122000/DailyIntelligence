import type { Metadata } from "next";
import Link from "next/link";

import { DRAFT_NOTICE, ProsePage, ProseSection } from "@/components/marketing/prose";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "Terms of use" };

export default function TermsPage() {
  return (
    <ProsePage kicker="The fine print" title="Terms of use" lead={`The plain terms on which ${brand.name} is offered.`} notice={DRAFT_NOTICE}>
      <ProseSection id="what" title="What this is">
        <p>{brand.name} is a reader for news published by others. Headlines, excerpts and articles belong to their publishers; each is attributed and linked to its original. Summaries and explainers marked as AI-written are ours, and are generated from the sources they cite.</p>
      </ProseSection>
      <ProseSection id="accuracy" title="Accuracy">
        <p>We show what sources report, and how well a story is sourced. We do not certify that any report is true. A story&rsquo;s heat says how fast it is spreading, not whether it is right. Check the originals before acting on anything you read here.</p>
      </ProseSection>
      <ProseSection id="use" title="Your use">
        <ul>
          <li>Use it for your own reading. Do not scrape it, resell it or republish what it shows.</li>
          <li>Do not try to get around rate limits or access what is not yours.</li>
          <li>Reports you file should be honest. We may suspend an account that abuses them.</li>
        </ul>
      </ProseSection>
      <ProseSection id="publishers" title="For publishers">
        <p>If you publish a source we read and want it changed or removed, the <Link href="/sources">source directory</Link> lists what we read and how. Ask through the contact address there and we will act promptly; removing a source withdraws everything from it on the next request.</p>
      </ProseSection>
    </ProsePage>
  );
}
