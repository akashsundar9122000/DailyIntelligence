/**
 * THE SAMPLE EDITION. Invented stories, for demonstrating the paper where no
 * source has reported yet and DEMO_MODE=1 is set. Nothing here is news.
 *
 * The publisher is "Sample Gazette" on a .invalid domain (reserved by RFC 2606
 * for exactly this), and every headline is ordinary and unremarkable, so that
 * a screenshot of the demo cannot be passed off as a real report about real
 * people. Read only through ./provider.ts, which labels each one "Sample"
 * (check:provenance enforces both).
 */
export type SampleStory = {
  id: string;
  headline: string;
  excerpt: string;
  category: string;
  scope: "india" | "global";
  states: string[];
  sourceCount: number;
  heat: number;
  confidence: number;
  importance: number;
  official: boolean;
  minutesAgo: number;
};

export const SAMPLE_STORIES: SampleStory[] = [
  { id: "00000000-0000-4000-8000-000000000001", headline: "Sample: City council approves a longer cycle lane along the seafront", excerpt: "An invented story showing how a lead story with several sources is set.", category: "india-politics", scope: "india", states: ["TN"], sourceCount: 5, heat: 74, confidence: 68, importance: 70, official: false, minutesAgo: 22 },
  { id: "00000000-0000-4000-8000-000000000002", headline: "Sample: Monsoon arrives two days early in the southern districts", excerpt: "An invented story showing an official statement beside reporting.", category: "climate", scope: "india", states: ["KL"], sourceCount: 3, heat: 58, confidence: 81, importance: 64, official: true, minutesAgo: 47 },
  { id: "00000000-0000-4000-8000-000000000003", headline: "Sample: Research team describes a quieter way to cool data centres", excerpt: "An invented story showing a preprint, labelled as not peer reviewed.", category: "science", scope: "global", states: [], sourceCount: 1, heat: 31, confidence: 22, importance: 30, official: false, minutesAgo: 95 },
  { id: "00000000-0000-4000-8000-000000000004", headline: "Sample: Regional team wins a close final on the last ball", excerpt: "An invented story showing a hot story with limited sources.", category: "cricket", scope: "india", states: ["MH"], sourceCount: 2, heat: 88, confidence: 34, importance: 40, official: false, minutesAgo: 12 },
  { id: "00000000-0000-4000-8000-000000000005", headline: "Sample: Two neighbouring countries agree on a shared river survey", excerpt: "An invented story showing world coverage.", category: "world-politics", scope: "global", states: [], sourceCount: 4, heat: 46, confidence: 59, importance: 55, official: false, minutesAgo: 180 },
  { id: "00000000-0000-4000-8000-000000000006", headline: "Sample: Independent film festival announces its opening programme", excerpt: "An invented story showing a cinema section entry.", category: "cinema", scope: "india", states: ["KA"], sourceCount: 2, heat: 39, confidence: 45, importance: 25, official: false, minutesAgo: 240 },
];
