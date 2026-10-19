import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CoverArt } from "@/components/news/cover-art";
import { PlaceMap } from "@/components/news/place-map";
import { CATEGORIES } from "@/config/categories";
import { INDIAN_STATES } from "@/config/regions";
import { COUNTRY_SHAPES } from "@/lib/media/geo/countries";
import { STATE_PINS } from "@/lib/media/geo/states";
import { seeded } from "@/lib/media/seed";
import { storyImage, type ImageInputs, type StoredImage } from "@/lib/media/story-image";

const STORY: ImageInputs = { id: "story-1", headline: "A headline", category: "cricket", scope: "india", states: [], countries: ["IN"] };
const stored = (kind: StoredImage["kind"]): StoredImage => ({ kind, src: `https://example.test/${kind}.webp`, width: 1024, height: 576, alt: `${kind} alt`, credit: kind });

describe("which picture a story gets", () => {
  it("takes a licensed photo first, then a video, then an AI illustration", () => {
    expect(storyImage({ ...STORY, stored: [stored("ai"), stored("video"), stored("photo")] }).kind).toBe("photo");
    expect(storyImage({ ...STORY, stored: [stored("ai"), stored("video")] }).kind).toBe("video");
    expect(storyImage({ ...STORY, stored: [stored("ai")] })).toMatchObject({ kind: "ai", label: "AI illustration", credit: "AI illustration" });
    // The caption says what the picture is, as well as whose.
    expect(storyImage({ ...STORY, stored: [stored("photo")] }).credit).toBe("Photo: photo");
  });

  it("draws a map when the story names an Indian state, pinning up to three", () => {
    const image = storyImage({ ...STORY, states: ["KL", "TN", "KA", "AP"] });
    expect(image).toMatchObject({ kind: "map", focus: "IN", pins: ["KL", "TN", "KA"], credit: "Map: Natural Earth", label: "Map" });
  });

  it("draws a map of a country abroad, but not 'somewhere in India' on every Indian story", () => {
    expect(storyImage({ ...STORY, scope: "global", countries: ["IN", "FR"] })).toMatchObject({ kind: "map", focus: "FR" });
    // Several countries named: the first is not reliably where it happened, so no map.
    expect(storyImage({ ...STORY, scope: "global", countries: ["AR", "VA", "IT"] }).kind).toBe("art");
    expect(storyImage({ ...STORY, scope: "india", countries: ["IN"] }).kind).toBe("art");
  });

  it("always has a picture: the section's cover art, labelled as an illustration, never as a photo", () => {
    const image = storyImage({ ...STORY, category: null, countries: [] });
    expect(image).toMatchObject({ kind: "art", label: "Illustration", alt: "" });
    expect(storyImage(STORY)).toMatchObject({ kind: "art", credit: "Illustration · Cricket" });
  });
});

describe("cover art", () => {
  const draw = (seed: string, section: string | null) => renderToStaticMarkup(createElement(CoverArt, { seed, section }));

  it("is the same drawing for the same story on every render, and differs between stories", () => {
    expect(draw("story-1", "business")).toBe(draw("story-1", "business"));
    expect(draw("story-1", "business")).not.toBe(draw("story-2", "business"));
  });

  it("is drawn for every section, coloured only by theme tokens, and never in the alert colour", () => {
    for (const section of [...CATEGORIES.map((category) => category.slug), null]) {
      const markup = draw(`seed-${section}`, section);
      expect(markup, String(section)).toContain('aria-hidden="true"');
      // Press red means breaking, live or wrong: in art it would read as an alarm.
      expect(markup, String(section)).not.toMatch(/press|danger/);
      // No literal colour: every fill and stroke is a token class.
      expect(markup, String(section)).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(/i);
    }
  });

  it("is repeatable from its seed", () => {
    const a = seeded("x");
    const b = seeded("x");
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("map data", () => {
  it("has India in India's own depiction, and the countries most stories name", () => {
    for (const code of ["IN", "PK", "CN", "BD", "NP", "LK", "US", "GB", "FR", "RU", "JP", "AU"]) {
      expect(COUNTRY_SHAPES[code]?.d, code).toBeTruthy();
    }
  });

  it("pins every Indian state, inside India's frame", () => {
    const [west, south, east, north] = COUNTRY_SHAPES.IN!.box;
    for (const state of INDIAN_STATES) {
      const pin = STATE_PINS[state.code];
      expect(pin, state.code).toBeDefined();
      expect(pin![0], state.code).toBeGreaterThanOrEqual(west);
      expect(pin![0], state.code).toBeLessThanOrEqual(east);
      expect(pin![1], state.code).toBeGreaterThanOrEqual(south);
      expect(pin![1], state.code).toBeLessThanOrEqual(north);
    }
  });

  it("names the place for a screen reader, and keeps a card map small", () => {
    const markup = renderToStaticMarkup(createElement(PlaceMap, { focus: "IN", pins: ["KL"] }));
    expect(markup).toContain('aria-label="Map of India marking Kerala"');
    // A card map is a few kilobytes, not a world: the budget that keeps a page of them light.
    expect(markup.length).toBeLessThan(20_000);
    // A thumbnail is the country alone: lighter still.
    expect(renderToStaticMarkup(createElement(PlaceMap, { focus: "IN", pins: ["KL"], detail: "thumb", aspect: 1 })).length).toBeLessThan(3_000);
  });
});
