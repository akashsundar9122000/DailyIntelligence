import { describe, expect, it } from "vitest";

import { illustrationPrompt, verdictFrom } from "@/lib/ai/illustration";
import { CATEGORIES } from "@/config/categories";

describe("what an illustration is asked to show", () => {
  it("names no one: every capitalised word is gone from the subject, the first word too", () => {
    const request = illustrationPrompt({ headline: "Rohit Sharma leads India to a tense series win in Chennai", category: "cricket" })!;
    for (const name of ["Rohit", "Sharma", "India", "Chennai"]) expect(request.prompt).not.toContain(name);
    expect(request.prompt).toContain("leads to a tense series win");
    expect(request.prompt).toContain("cricket news story");
  });

  it("says what may not be drawn: no text, no logos, no recognisable people, nothing photorealistic", () => {
    const { prompt } = illustrationPrompt({ headline: "Small business lending rises for a third straight month", category: "business" })!;
    for (const rule of ["No text or lettering", "no logos or flags", "no recognisable people", "not photorealistic"]) expect(prompt).toContain(rule);
  });

  it("is never asked for in a sensitive section: politics and health get no AI picture", () => {
    for (const category of CATEGORIES.filter((entry) => "sensitive" in entry && entry.sensitive)) {
      expect(illustrationPrompt({ headline: "A vote on a new bill passes", category: category.slug }), category.slug).toBeNull();
    }
    expect(illustrationPrompt({ headline: "Something happened", category: null })).toBeNull();
  });

  it("is never asked for a story about violence, conflict, crime, death or disaster, whatever section it was filed in", () => {
    // The story that taught this: an attack, filed under Business.
    expect(illustrationPrompt({ headline: "Photographer attacked by settlers in the West Bank", category: "business" })).toBeNull();
    for (const headline of ["Two killed as a bus crashes on the highway", "Floods leave thousands without power", "Police arrest three after a market fire", "Army moves troops to the border"]) {
      expect(illustrationPrompt({ headline, category: "technology" }), headline).toBeNull();
    }
    // Whole words only: "warehouse" is not "war", "fireworks" is not "fire".
    expect(illustrationPrompt({ headline: "A warehouse robot learns to stack fireworks boxes safely", category: "technology" })).not.toBeNull();
  });

  it("falls back to the section alone when the headline is all names", () => {
    expect(illustrationPrompt({ headline: "Infosys Q2 Results", category: "business" })!.prompt).toContain("Flat editorial illustration for a business and markets news story.");
  });

  it("labels the picture as AI, from the section, never from what the picture shows", () => {
    expect(illustrationPrompt({ headline: "Monsoon reaches the southern districts early", category: "climate" })!.alt).toBe("AI illustration for a Climate story");
  });
});

describe("the check every illustration passes before anyone sees it", () => {
  const clean = { photorealistic: false, real_identifiable_person: false, close_up_face: false, weapons: false, confrontation: false, text_or_letters: false, logo_or_flag: false, violence_or_gore: false, describe: "A lighthouse at dusk" };

  it("passes a picture only when every answer is no", () => {
    expect(verdictFrom(JSON.stringify(clean))).toEqual({ ok: true, reasons: [], description: "A lighthouse at dusk" });
  });

  it("refuses on any yes, and says why", () => {
    const verdict = verdictFrom(JSON.stringify({ ...clean, photorealistic: true, text_or_letters: true }));
    expect(verdict.ok).toBe(false);
    expect(verdict.reasons).toEqual(["it looks like a photograph", "it contains text or letters"]);
  });

  it("refuses a picture of weapons or a confrontation, even with no gore in it", () => {
    expect(verdictFrom(JSON.stringify({ ...clean, weapons: true, confrontation: true })).reasons).toEqual(["it shows a weapon", "it shows a fight, a confrontation or people threatening others"]);
  });

  it("refuses when an answer is missing: not answering is not a no", () => {
    const partial: Record<string, unknown> = { ...clean };
    delete partial.close_up_face;
    expect(verdictFrom(JSON.stringify(partial))).toMatchObject({ ok: false, reasons: ["it shows a face in close-up"] });
  });

  it("refuses an answer that is not the JSON asked for", () => {
    expect(verdictFrom("Looks fine to me!").ok).toBe(false);
    expect(verdictFrom(null).ok).toBe(false);
  });
});
