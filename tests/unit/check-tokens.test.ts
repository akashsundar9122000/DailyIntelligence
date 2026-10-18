import { describe, expect, it } from "vitest";

import { colourProblems } from "../../scripts/check-tokens.mjs";

const hits = (line: string, kind: "ts" | "css" = "ts"): string[] => colourProblems(line, kind);

describe("check:tokens", () => {
  it("catches raw colour", () => {
    expect(hits('style={{ color: "#fff" }}')).toEqual(["#fff"]);
    expect(hits("background: rgb(0 0 0 / .5)", "css")).toHaveLength(1);
  });

  it("catches named colours in utilities, style values, SVG attributes and CSS", () => {
    expect(hits('<div className="bg-gradient-to-t from-black/85 to-transparent" />')).toEqual(["from-black/85"]);
    expect(hits('<div className="bg-white hover:text-red-500" />')).toEqual(["bg-white", "hover:text-red-500"]);
    expect(hits('<circle fill="white" />')).toEqual(['fill="white"']);
    expect(hits('style={{ color: "white" }}')).toHaveLength(1);
    expect(hits('style={{ border: "1px solid black" }}')).toHaveLength(1);
    expect(hits(".x { color: white; }", "css")).toHaveLength(1);
  });

  it("leaves tokens, keywords and prose alone", () => {
    expect(hits('<div className="bg-accent text-text-secondary border-border bg-transparent text-current to-50%" />')).toEqual([]);
    expect(hits('<rect className="fill-up-solid stroke-down-solid" />')).toEqual([]);
    expect(hits('<circle fill="currentColor" stroke="var(--chart-1)" />')).toEqual([]);
    expect(hits('const s = "The green candle closed higher"; const o = { label: "Black", value: "black" };')).toEqual([]);
    expect(hits(".x { background: url(white.png); color: var(--text-primary); }", "css")).toEqual([]);
  });
});

describe("radius utilities", () => {
  it("are all defined, because the token file resets the default scale", async () => {
    // tokens.css sets --radius-*: initial, so a rounded-* class with no token
    // behind it compiles to nothing and the corner is silently square.
    const { readFileSync, readdirSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");
    const tokens = readFileSync("src/styles/tokens.css", "utf8");
    const defined = new Set([...tokens.matchAll(/--radius-([a-z0-9]+)\s*:/g)].map((m) => m[1]));
    const used = new Set<string>();
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) walk(path);
        else if (/\.tsx?$/.test(name)) {
          for (const match of readFileSync(path, "utf8").matchAll(/\brounded(?:-[trblse]{1,2})?-(sm|md|lg|xl|[2-9]xl|full)\b/g)) used.add(match[1]!);
        }
      }
    };
    walk("src");
    expect([...used].filter((size) => !defined.has(size))).toEqual([]);
  });
});
