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
