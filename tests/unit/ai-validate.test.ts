import { describe, expect, it } from "vitest";

import { canonical, checkClaims, correction, namesIn, numbersIn, type SourceRecord } from "@/lib/ai/validate";

/*
 * Every record in this file is invented test text. None of it is news.
 */
const RECORDS: SourceRecord[] = [
  { ref: "S1", text: "publisher: alpha.example | headline: Floods cut off 14 villages in the Nilgiri hills as rain continues for a third day" },
  { ref: "S2", text: "publisher: beta.example | headline: Rescue teams reach 1,200 stranded residents near Ooty" },
  { ref: "S3", text: "publisher: Example Bureau | type: official statement | headline: State releases ₹25 crore for flood relief", official: true },
];

describe("checking a model's sentences against the records", () => {
  it("passes a sentence that says what its cited records say", () => {
    expect(checkClaims([{ text: "Floods have cut off 14 villages in the Nilgiri hills.", cites: ["S1"] }], RECORDS)).toEqual({ ok: true, problems: [] });
  });

  it("refuses a sentence with no citation, or one citing a record that does not exist", () => {
    expect(checkClaims([{ text: "Floods have cut off villages.", cites: [] }], RECORDS).problems).toEqual([{ kind: "no-citation", text: "Floods have cut off villages." }]);
    expect(checkClaims([{ text: "Floods have cut off villages.", cites: ["S9"] }], RECORDS).problems).toEqual([{ kind: "unknown-citation", text: "S9" }]);
  });

  it("refuses a number that is not in the records the sentence cites, even when another record has it", () => {
    // 1,200 is in S2, but this sentence cites only S1.
    const check = checkClaims([{ text: "About 1,200 residents are stranded.", cites: ["S1"] }], RECORDS);
    expect(check.problems).toEqual([{ kind: "unsupported-number", text: "1,200" }]);
    expect(checkClaims([{ text: "About 1200 residents are stranded.", cites: ["S2"] }], RECORDS).ok).toBe(true);
  });

  it("refuses a rounded or estimated number", () => {
    expect(checkClaims([{ text: "Roughly 1,000 residents are stranded.", cites: ["S2"] }], RECORDS).problems).toEqual([{ kind: "unsupported-number", text: "1,000" }]);
    expect(checkClaims([{ text: "Rain has fallen for 72 hours.", cites: ["S1"] }], RECORDS).problems).toEqual([{ kind: "unsupported-number", text: "72" }]);
  });

  it("never lets a record's publication time stand in for a number it does not give", () => {
    // Records carry their publication time. Its minutes are not a fact about the story.
    const timed: SourceRecord[] = [{ ref: "S1", text: "publisher: alpha.example | published: 19 Oct 2026, 11:40 am IST | headline: Floods cut off 14 villages" }];
    expect(checkClaims([{ text: "The minister visited with 40 officials.", cites: ["S1"] }], timed).problems).toEqual([{ kind: "unsupported-number", text: "40" }]);
    // The time itself, stated as a time, is supported; a different time is not.
    expect(checkClaims([{ text: "The report was published at 11:40 am.", cites: ["S1"] }], timed).ok).toBe(true);
    expect(checkClaims([{ text: "The report was published at 11:45 am.", cites: ["S1"] }], timed).problems).toEqual([{ kind: "unsupported-number", text: "11:45" }]);
    // And the date in the same line still supports a date.
    expect(checkClaims([{ text: "Floods cut off 14 villages on 19 October 2026.", cites: ["S1"] }], timed).ok).toBe(true);
  });

  it("reads a decimal as a number, not as a clock", () => {
    expect(checkClaims([{ text: "Rescue teams reached 1,200 residents.", cites: ["S2"] }], RECORDS).ok).toBe(true);
    expect(checkClaims([{ text: "Relief of ₹2.50 crore was sent.", cites: ["S2"] }], RECORDS).problems).toEqual([{ kind: "unsupported-number", text: "₹2.50" }]);
  });

  it("lets small counting words through, but never a percentage or a sum of money", () => {
    expect(checkClaims([{ text: "Two publishers report 3 rescue teams.", cites: ["S1"] }], RECORDS).ok).toBe(true);
    expect(checkClaims([{ text: "Rainfall rose 5% on the day.", cites: ["S1"] }], RECORDS).problems).toEqual([{ kind: "unsupported-number", text: "5%" }]);
  });

  it("refuses a name that no record contains", () => {
    const check = checkClaims([{ text: "Rescue teams led by Commander Rao reached Ooty.", cites: ["S2"] }], RECORDS);
    expect(check.problems).toEqual([
      { kind: "unsupported-name", text: "Commander" },
      { kind: "unsupported-name", text: "Rao" },
    ]);
  });

  it("requires an official statement to be attributed, never stated as the paper's own fact", () => {
    expect(checkClaims([{ text: "₹25 crore has been released for flood relief.", cites: ["S3"] }], RECORDS).problems.map((problem) => problem.kind)).toEqual(["unattributed-official"]);
    expect(checkClaims([{ text: "The bureau said ₹25 crore has been released for flood relief.", cites: ["S3"] }], RECORDS).ok).toBe(true);
  });

  it("refuses a future stated as certain", () => {
    expect(checkClaims([{ text: "The rain will certainly stop by tomorrow.", cites: ["S1"] }], RECORDS).problems.map((problem) => problem.kind)).toEqual(["certain-future"]);
  });

  it("refuses an empty output unless empty is allowed", () => {
    expect(checkClaims([], RECORDS).ok).toBe(false);
    expect(checkClaims([], RECORDS, { allowEmpty: true }).ok).toBe(true);
  });

  it("tells the model what to fix, without inventing a rule", () => {
    const check = checkClaims([{ text: "About 1,000 people were moved by Commander Rao.", cites: ["S2"] }], RECORDS);
    const advice = correction(check);
    expect(advice).toContain("1,000");
    expect(advice).toContain("Rao");
  });
});

describe("reading numbers and names out of text", () => {
  it("compares numbers by value, not by how they are written", () => {
    expect(numbersIn("₹1,976.50 and 12% and 2026")).toEqual(["₹1,976.50", "12%", "2026"]);
    expect(canonical("₹1,976.50")).toBe("1976.5");
    expect(canonical("007")).toBe("7");
  });

  it("finds capitalised words that do not start a sentence, and ignores calendar words", () => {
    expect(namesIn("Floods hit Ooty on Monday. Rescue began in October: Teams arrived.")).toEqual(["Ooty"]);
  });
});

describe("the visual explainer's cards", () => {
  it("are built only from checked sentences and records: a figure card exists only for a number a sentence states, with its citations", async () => {
    const { buildSlides } = await import("@/lib/ai/visual");
    const slides = buildSlides({
      headline: "Floods cut off 14 villages",
      claims: {
        oneMinute: [{ text: "Floods have cut off 14 villages in the hills.", cites: ["S1"] }],
        keyDetails: [{ text: "The bureau said ₹25 crore was released for relief.", cites: ["S2"] }, { text: "Two rescue teams are on the way.", cites: ["S1"] }],
        whatHappened: [],
      },
      records: [
        { publisher: "beta.example", official: false, title: "Rescue reaches villages", publishedAt: "2026-10-19T05:00:00Z" },
        { publisher: "Example Bureau", official: true, title: "Bureau releases ₹25 crore", publishedAt: "2026-10-19T03:00:00Z" },
      ],
      places: ["Kerala"],
    });
    expect(slides.map((slide) => slide.kind)).toEqual(["title", "summary", "figure", "figure", "timeline", "where", "sources"]);
    const figures = slides.filter((slide) => slide.kind === "figure");
    expect(figures).toEqual([
      { kind: "figure", figure: "₹25", text: "The bureau said ₹25 crore was released for relief.", cites: ["S2"] },
      { kind: "figure", figure: "14", text: "Floods have cut off 14 villages in the hills.", cites: ["S1"] },
    ]);
    // Earliest first, whoever published it.
    const timeline = slides.find((slide) => slide.kind === "timeline");
    expect(timeline && timeline.kind === "timeline" ? timeline.entries.map((entry) => entry.publisher) : []).toEqual(["Example Bureau", "beta.example"]);
  });
});
