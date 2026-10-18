import type { Metadata } from "next";

import { ProsePage, ProseSection } from "@/components/marketing/prose";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "How we use AI" };

export default function AiPolicyPage() {
  return (
    <ProsePage kicker="Trust" title="How we use AI" lead={`What the model in ${brand.name} does, what it is never allowed to do, and how you can tell its work from a publisher's.`}>
      <ProseSection id="does" title="What it does">
        <ul>
          <li>Writes short explainers for a story: what happened, why it matters, what is still unclear.</li>
          <li>Writes briefings for a period you choose, from the stories in it.</li>
          <li>Tags stories with categories, places, people and organisations.</li>
        </ul>
      </ProseSection>
      <ProseSection id="rules" title="The rules it works under">
        <ul>
          <li><strong>Only from the sources attached.</strong> It is given a story&rsquo;s source records and nothing else, and every factual claim it writes must cite one of them. An answer that cites something it was not given is rejected.</li>
          <li><strong>Only what each source permits.</strong> Where a publisher&rsquo;s terms allow headlines but not their text, the model sees the headline. The explainer then says how little it was based on.</li>
          <li><strong>Confirmed, claimed and unknown kept apart.</strong> &ldquo;The ministry said&rdquo; is not written as &ldquo;it is so&rdquo;. Where sources disagree, the disagreement is shown with who said what.</li>
          <li><strong>Source text is data, never instructions.</strong> Text inside an article that tries to instruct the model is treated as part of the article.</li>
          <li><strong>No invented quotes, no synthetic footage,</strong> and no &ldquo;fake&rdquo; verdicts from the model alone.</li>
        </ul>
      </ProseSection>
      <ProseSection id="labels" title="How you can tell">
        <p>Everything the model wrote is labelled &ldquo;AI-written&rdquo;, with the time it was written and the sources it used. The publisher&rsquo;s own headline and the link to the original are always shown beside it. If the AI service is unavailable, you get a plain, non-generated summary from the source records instead, labelled as such.</p>
      </ProseSection>
      <ProseSection id="provider" title="Which model">
        <p>Models hosted by NVIDIA, through its API. Source text is sent to it; your name, email address and interests are not. Which model wrote an explainer is recorded with it.</p>
      </ProseSection>
    </ProsePage>
  );
}
