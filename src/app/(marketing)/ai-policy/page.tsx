import type { Metadata } from "next";

import { ProsePage, ProseSection } from "@/components/marketing/prose";
import { brand } from "@/config/brand";

export const metadata: Metadata = { title: "How we use AI" };

export default function AiPolicyPage() {
  return (
    <ProsePage kicker="Trust" title="How we use AI" lead={`What the model in ${brand.name} does, what it is never allowed to do, and how you can tell its work from a publisher's.`}>
      <ProseSection id="does" title="What it does">
        <ul>
          <li>Writes a short explainer for a story once a second publisher or an official source has reported it: the story in one minute, what happened, why it matters, key details and what is next, each only where the sources say it.</li>
          <li>Writes the morning and evening edition briefing, one line per story, from those explainers.</li>
          <li>Answers your questions about a story, from that story&rsquo;s sources only.</li>
          <li>Chooses a section for a story when our own rules found none, from the paper&rsquo;s fixed list. The story page says when it did. Places, people and organisations come from the sources&rsquo; own data, not from the model.</li>
        </ul>
      </ProseSection>
      <ProseSection id="rules" title="The rules it works under">
        <ul>
          <li><strong>Only from the sources attached, and checked.</strong> It is given a story&rsquo;s source records and nothing else. Before anything is shown, every sentence is checked: it must cite a record, every number in it must appear in a record it cites, and every name must appear in the records. Output that fails is not shown, and the plain summary written by rule stays in its place. Failed output is kept for review, never published.</li>
          <li><strong>Only what each source permits.</strong> Where a publisher&rsquo;s terms allow headlines but not their text, the model sees the headline. The explainer then says how little it was based on.</li>
          <li><strong>Confirmed, claimed and unknown kept apart.</strong> &ldquo;The ministry said&rdquo; is not written as &ldquo;it is so&rdquo;. Where sources disagree, the disagreement is shown with who said what.</li>
          <li><strong>Source text is data, never instructions.</strong> Text inside an article that tries to instruct the model is treated as part of the article.</li>
          <li><strong>No invented quotes, no synthetic footage,</strong> and no &ldquo;fake&rdquo; verdicts from the model alone.</li>
          <li><strong>A daily ceiling.</strong> The number of model outputs per day is capped, so a fault costs a day at most.</li>
        </ul>
      </ProseSection>
      <ProseSection id="labels" title="How you can tell">
        <p>Everything the model wrote is labelled &ldquo;AI-generated&rdquo;, with which model, when, how many source records it used and whether it read any article text, and every sentence links to the sources it rests on. The publisher&rsquo;s own headline and the link to the original are always shown beside it. If the AI service is unavailable, you get a plain, non-generated summary from the source records instead, labelled as such.</p>
      </ProseSection>
      <ProseSection id="provider" title="Which model">
        <p>Models hosted by NVIDIA, through its API. A story&rsquo;s source records are sent to it. When you ask about a story, your question is sent with them; it is not stored. Your name, email address and interests are never sent. Which model wrote each explainer, and with which version of our instructions, is recorded with it.</p>
      </ProseSection>
    </ProsePage>
  );
}
