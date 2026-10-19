import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { extractJson } = await import("@/lib/ai/chat-json");
const { checkExplainer, explainerSchema, recordLine, withoutRepeats } = await import("@/lib/ai/explainer");
const { checkBriefing } = await import("@/lib/ai/briefing");
const { briefingSlot, istDay } = await import("@/lib/services/enrichment");

/* Every record in this file is invented test text. None of it is news. */

describe("taking the model's JSON out of what it wrapped it in", () => {
  it("reads through a reasoning block and a code fence", () => {
    expect(extractJson('<think>let me see {"no":1}</think>\n```json\n{"ok": true}\n```')).toEqual({ ok: true });
  });

  it("gives null, never a guess, for anything that is not one JSON object", () => {
    expect(extractJson("I cannot help with that.")).toBeNull();
    expect(extractJson('{"broken": ')).toBeNull();
    expect(extractJson(null)).toBeNull();
  });
});

describe("an explainer", () => {
  const record = { itemId: "00000000-0000-4000-8000-000000000001", publisher: "alpha.example", contentType: "report", headline: "Floods cut off 14 villages in the hill district", excerpt: null, publishedAt: "2026-10-19T02:30:00.000Z" };
  const bundle = { storyId: "s", headline: record.headline, categories: [], records: [{ ...record, ref: "S1", text: recordLine(record) }] };
  const base = { whatHappened: [], whyItMatters: [], keyDetails: [], whatsNext: [], categories: [] as string[] };

  it("shows the model the publication time in IST, so a date it repeats can be checked", () => {
    expect(recordLine(record)).toBe("publisher: alpha.example | type: news report | published: 19 October 2026 at 08:00 IST | headline: Floods cut off 14 villages in the hill district");
  });

  it("checks the sentences, whatever sections it suggests", () => {
    expect(checkExplainer({ ...base, oneMinute: [{ text: "Floods have cut off 14 villages.", cites: ["S1"] }], categories: ["climate"] }, bundle).ok).toBe(true);
    expect(checkExplainer({ ...base, oneMinute: [{ text: "Floods have cut off 40 villages.", cites: ["S1"] }], categories: ["climate"] }, bundle).ok).toBe(false);
  });
});

describe("an edition briefing", () => {
  const stories = [
    { ref: "B1", storyId: "a", headline: "x", text: "headline: Floods cut off 14 villages | note: Floods have cut off 14 villages." },
    { ref: "B2", storyId: "b", headline: "y", text: "headline: Council approves a 6 km cycle lane | note: The council approved it." },
  ];

  it("checks each line against its own story only", () => {
    expect(checkBriefing({ lines: [{ ref: "B1", text: "Floods have cut off 14 villages." }] }, stories).ok).toBe(true);
    // 14 belongs to B1; a line about B2 may not borrow it.
    expect(checkBriefing({ lines: [{ ref: "B2", text: "The council approved 14 lanes." }] }, stories).ok).toBe(false);
  });

  it("refuses a story listed twice", () => {
    expect(checkBriefing({ lines: [{ ref: "B1", text: "Floods have cut off 14 villages." }, { ref: "B1", text: "Floods have cut off 14 villages." }] }, stories).ok).toBe(false);
  });
});

describe("which briefing is current", () => {
  it("is the morning one from 06:00 IST, the evening one from 18:00, and before 06:00 the previous evening's", () => {
    expect(briefingSlot(new Date("2026-10-19T00:29:00Z"))).toEqual({ key: "2026-10-18:evening", slot: "evening" }); // 05:59 IST
    expect(briefingSlot(new Date("2026-10-19T00:30:00Z"))).toEqual({ key: "2026-10-19:morning", slot: "morning" }); // 06:00 IST
    expect(briefingSlot(new Date("2026-10-19T12:30:00Z"))).toEqual({ key: "2026-10-19:evening", slot: "evening" }); // 18:00 IST
  });

  it("counts the day in IST, as a string", () => {
    expect(istDay(new Date("2026-10-18T19:00:00Z"))).toBe("2026-10-19");
  });
});

describe("saying each fact once", () => {
  const c = (text: string) => ({ text, cites: ["S1"] });
  const empty = { whatHappened: [], whyItMatters: [], keyDetails: [], whatsNext: [], categories: [] };

  it("drops a later sentence that adds nothing, and keeps one that adds detail", () => {
    const out = withoutRepeats({
      ...empty,
      oneMinute: [c("Floods cut off fourteen hill villages.")],
      whatHappened: [c("Fourteen hill villages were cut off by floods."), c("Rescue teams reached the villages by boat on the third day.")],
    });
    expect(out.oneMinute).toHaveLength(1);
    expect(out.whatHappened.map((claim) => claim.text)).toEqual(["Rescue teams reached the villages by boat on the third day."]);
  });

  it("drops a blank sentence instead of rejecting the explainer", () => {
    const parsed = explainerSchema.safeParse({ ...empty, oneMinute: [c("Floods cut off villages."), c("  ")] });
    expect(parsed.success && parsed.data.oneMinute).toHaveLength(1);
    expect(explainerSchema.safeParse({ ...empty, oneMinute: [c("")] }).success).toBe(false);
  });
});
