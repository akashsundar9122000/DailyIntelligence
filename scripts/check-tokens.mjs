#!/usr/bin/env node
/**
 * Colour lives in src/styles/tokens.css. Source under src/ may not use:
 *   - raw hex, rgb() or hsl();
 *   - a named CSS colour (white, black, red, …) in a style value, an SVG
 *     colour attribute or a CSS declaration;
 *   - a Tailwind colour utility whose colour is not a token (bg-white,
 *     from-black/85, text-red-500). tokens.css resets `--color-*`, so those
 *     classes compile to NOTHING: the element silently loses its colour.
 * One hard-coded colour is how a theme decays.
 * Allowed: the token file itself, src/app/globals.css, and the email template
 * (mail clients ignore CSS variables).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOTS = ["src/app", "src/components", "src/lib", "src/config"];
const SKIP = new Set(["src/app/globals.css"]);
/** Whole files exempt from the rule. Each entry needs a reason beside it. */
const ALLOW = new Set([
  // Email is not the web: a mail client resolves no custom properties and no
  // stylesheet, so a token would arrive as nothing. Literal colours are the
  // correct answer in this one file, and only in this one file.
  "src/lib/mail/templates.ts",
  // The link-preview image is drawn by an image renderer with no stylesheet
  // and no custom properties. Same reason, same single file.
  "src/app/opengraph-image.tsx",
]);
const RAW = /(#[0-9a-fA-F]{3,8}\b(?![-\w]))|(\brgba?\()|(\bhsla?\()/;

// Every CSS named colour (CSS Color 4), minus the keywords that are not a colour choice.
const NAMED = "aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen".split(" ");
const NAMED_RE = NAMED.join("|");
// Tailwind's default palette families (also reset by tokens.css).
const PALETTE = "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

// Colour names the token file defines are fine as utilities (bg-accent, text-danger, …).
const TOKENS = new Set([...readFileSync("src/styles/tokens.css", "utf8").matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]));

const UTIL = "bg|text|border(?:-[trblxyse])?|fill|stroke|ring|ring-offset|outline|from|via|to|decoration|divide|placeholder|caret|accent|shadow|inset-shadow|drop-shadow";
// A class token: prefix-colour, optional /opacity, bounded by a non-class character.
const UTIL_RE = new RegExp(`(?<![\\w-])(?:[a-z0-9-]+:)*(${UTIL})-((?:${NAMED_RE})|(?:${PALETTE})-\\d{2,3})(?:\\/\\d+)?(?![\\w-])`, "g");
// style={{ color: "white" }}, fill="white", stroke={"black"}, border: "1px solid white".
const STYLE_PROP = "color|background|backgroundColor|borderColor|border(?:Top|Right|Bottom|Left)?Color|outlineColor|caretColor|accentColor|textDecorationColor|columnRuleColor|fill|stroke|stopColor|floodColor|lightingColor";
const STYLE_RE = new RegExp(`\\b(?:${STYLE_PROP})\\s*[:=]\\s*\\{?\\s*["'\`]\\s*(${NAMED_RE})\\s*["'\`]`, "i");
const SHORTHAND_RE = new RegExp(`\\b(?:border(?:Top|Right|Bottom|Left)?|outline|boxShadow|textShadow|background)\\s*:\\s*["'\`][^"'\`]*\\b(${NAMED_RE})\\b[^"'\`]*["'\`]`, "i");
// CSS: `color: white;`, `border: 1px solid black`.
const CSS_RE = new RegExp(`(?:^|[;{\\s])(?:color|background(?:-color)?|border(?:-[a-z]+)*|outline(?:-color)?|fill|stroke|box-shadow|text-shadow|caret-color|accent-color|stop-color|column-rule(?:-color)?|text-decoration(?:-color)?)\\s*:\\s*[^;{}]*?\\b(${NAMED_RE})\\b`, "i");

function strip(line) {
  return line
    .replace(/url\([^)]*\)/g, "")
    .replace(/var\([^)]*\)/g, "")
    .replace(/href="#[^"]*"/g, "")
    .replace(/aria-[a-z]+="[^"]*"/g, "");
}

/** Every colour problem on one line of a file of the given kind ("css" or "ts"). */
export function colourProblems(rawLine, kind) {
  const line = strip(rawLine);
  const out = [];
  const raw = RAW.exec(line);
  if (raw) out.push(raw[0]);
  if (kind === "css") {
    const m = CSS_RE.exec(line);
    if (m) out.push(m[0].trim());
    return out;
  }
  for (const m of line.matchAll(UTIL_RE)) {
    if (!TOKENS.has(m[2])) out.push(m[0]);
  }
  const s = STYLE_RE.exec(line) ?? SHORTHAND_RE.exec(line);
  if (s) out.push(s[0]);
  return out;
}

const bad = [];
let scanned = 0;
function walk(d) {
  let names;
  try {
    names = readdirSync(d);
  } catch {
    return; // a root that does not exist yet
  }
  for (const name of names) {
    const p = join(d, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(tsx?|css)$/.test(p) && !ALLOW.has(p) && !SKIP.has(p)) {
      scanned++;
      const kind = p.endsWith(".css") ? "css" : "ts";
      readFileSync(p, "utf8").split("\n").forEach((line, i) => {
        if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
        for (const hit of colourProblems(line, kind)) bad.push(`${p}:${i + 1}  ${hit}`);
      });
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  for (const r of ROOTS) walk(r);
  if (bad.length) {
    console.error("check:tokens FAILED — use a token from src/styles/tokens.css:\n  " + bad.join("\n  "));
    process.exit(1);
  }
  if (scanned === 0) {
    console.error("check:tokens FAILED — no source files found under src/. A scan of nothing proves nothing.");
    process.exit(1);
  }
  console.log(`check:tokens ok — ${scanned} files, ${TOKENS.size} colour tokens known`);
}
