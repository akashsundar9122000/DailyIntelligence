/**
 * The check every model sentence passes before a reader sees it.
 *
 * THE RULE: a sentence may say only what the records it cites say. A model
 * summarising five headlines will, sooner or later, add the casualty figure,
 * the minister's name or the date that "everyone knows" -- in the same
 * confident sentence as the ones it was given. Nothing in the text tells the
 * two apart, so the text is not trusted:
 *
 *   - every claim cites at least one record, and only records it was given;
 *   - every number in a claim is in a record that claim cites (by value: "1,200"
 *     matches "1200"; NOT by closeness: "1,200" does not match "1,180");
 *   - every name in a claim -- a capitalised word that does not start the
 *     sentence -- is in some record of the bundle;
 *   - an official statement is attributed to whoever made it, never stated as
 *     fact in the paper's own voice;
 *   - the future is never stated as certain.
 *
 * It is deliberately blunt. It cannot tell that a record's number was used for
 * the wrong thing; it can tell that a number no record gave was used at all,
 * and that is the failure that must never reach a reader. An output that fails
 * is stored as `rejected` and the reader sees the rule-written summary instead.
 */

export type SourceRecord = {
  /** "S1", "S2" for a story's items; "B1", "B2" for the stories in a briefing. */
  ref: string;
  /** Everything the model was shown for this record, joined: headline, excerpt, publisher, times. */
  text: string;
  /** An official statement is a claim by its issuer. */
  official?: boolean;
};

export type Claim = { text: string; cites: string[] };

export type Problem =
  | { kind: "no-citation"; text: string }
  | { kind: "unknown-citation"; text: string }
  | { kind: "unsupported-number"; text: string }
  | { kind: "unsupported-name"; text: string }
  | { kind: "unattributed-official"; text: string }
  | { kind: "certain-future"; text: string }
  | { kind: "too-long"; text: string }
  | { kind: "empty"; text: string };

export type Check = { ok: boolean; problems: Problem[] };

const NUMBER = /(?<![A-Za-z0-9.])[+\-−]?\s?[₹$€£]?\s?\d+(?:,\d+)*(?:\.\d+)?\s?%?/g;

/** A number reduced to its value: no sign, currency, grouping, percent, or zeros that change nothing. */
export function canonical(token: string): string {
  const digits = token.replace(/[^0-9.]/g, "");
  const [integer = "", fraction = ""] = digits.split(".");
  const whole = integer.replace(/^0+(?=\d)/, "") || "0";
  const part = fraction.replace(/0+$/, "");
  return part ? `${whole}.${part}` : whole;
}

export function numbersIn(text: string): string[] {
  return (text.match(NUMBER) ?? []).map((token) => token.trim()).filter((token) => /\d/.test(token));
}

/* Counting words a sentence needs ("two reports", "the 3 publishers") are not facts anyone could invent. */
const SMALL_WHOLE = /^(?:[0-9]|1[0-2])$/;

/*
 * Capitalised words that are not names: calendar words, and the words a
 * neutral sentence about news uses after a colon or in a title. Kept short on
 * purpose -- a longer list is a wider door for an invented name.
 */
const NOT_NAMES = new Set(
  [
    "I", "A", "An", "The", "AI", "UTC", "IST",
    "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday",
  ].map((word) => word.toLowerCase()),
);

/** Capitalised words that are not the first word of a sentence. */
export function namesIn(text: string): string[] {
  const names: string[] = [];
  for (const sentence of text.split(/(?<=[.!?:;])\s+|\n+/)) {
    const words = sentence.split(/[\s,()"“”‘’]+/).filter(Boolean);
    words.slice(1).forEach((raw) => {
      const word = raw.replace(/['’]s$/, "").replace(/[^\p{L}\p{N}-]/gu, "");
      if (word.length >= 2 && /^\p{Lu}/u.test(word) && !NOT_NAMES.has(word.toLowerCase())) names.push(word);
    });
  }
  return names;
}

const CERTAIN_FUTURE = /\bwill (?:definitely|certainly|surely|undoubtedly)\b|\bis (?:certain|guaranteed) to\b|\bwithout (?:a )?doubt\b/i;
/* A sentence about an official record that names who said it. */
/*
 * Speech verbs and source phrases only. Not "released" or "issued": "₹25 crore
 * has been released" uses the word and attributes nothing.
 */
const ATTRIBUTED = /\b(?:said|says|stated|states|announced|announces|told|claimed|claims|according to|in (?:a|its|the) (?:statement|release|press release|notice))\b/i;

export const MAX_CLAIM_CHARS = 420;

export function checkClaims(claims: readonly Claim[], records: readonly SourceRecord[], { allowEmpty = false }: { allowEmpty?: boolean } = {}): Check {
  const problems: Problem[] = [];
  if (claims.length === 0 && !allowEmpty) problems.push({ kind: "empty", text: "There is nothing to show." });
  const byRef = new Map(records.map((record) => [record.ref, record]));
  const everything = records.map((record) => record.text).join("\n").toLowerCase();

  for (const claim of claims) {
    const text = claim.text.trim();
    if (!text) {
      problems.push({ kind: "empty", text: "An empty sentence." });
      continue;
    }
    if (text.length > MAX_CLAIM_CHARS) problems.push({ kind: "too-long", text: text.slice(0, 60) });
    const cites = [...new Set(claim.cites)];
    if (cites.length === 0) problems.push({ kind: "no-citation", text });
    const cited = cites.map((ref) => byRef.get(ref)).filter((record): record is SourceRecord => Boolean(record));
    for (const ref of cites) if (!byRef.has(ref)) problems.push({ kind: "unknown-citation", text: ref });

    const known = new Set(cited.flatMap((record) => numbersIn(record.text).map(canonical)));
    for (const token of numbersIn(text)) {
      const value = canonical(token);
      if (!/[₹$€£%.]/.test(token) && SMALL_WHOLE.test(value)) continue;
      if (!known.has(value)) problems.push({ kind: "unsupported-number", text: token });
    }
    for (const name of namesIn(text)) if (!everything.includes(name.toLowerCase())) problems.push({ kind: "unsupported-name", text: name });
    if (CERTAIN_FUTURE.test(text)) problems.push({ kind: "certain-future", text });
    // Resting only on official records and not saying who said it is the paper vouching for a government's claim.
    if (cited.length > 0 && cited.every((record) => record.official) && !ATTRIBUTED.test(text)) {
      problems.push({ kind: "unattributed-official", text: text.slice(0, 80) });
    }
  }
  return { ok: problems.length === 0, problems };
}

/** What to tell the model when its output fails, so a second attempt can pass. Never shown to a reader. */
export function correction(check: Check): string {
  const of = (kind: Problem["kind"]) => check.problems.filter((problem) => problem.kind === kind).map((problem) => problem.text);
  const lines = ["Your output cannot be shown. Rewrite it, following every rule."];
  if (of("unsupported-number").length) lines.push(`These numbers are not in the records each sentence cites: ${of("unsupported-number").join(", ")}. Use only numbers written in the cited records, exactly as written. Do not round, convert or estimate.`);
  if (of("unsupported-name").length) lines.push(`These names are not in any record: ${of("unsupported-name").join(", ")}. Use only names the records contain.`);
  if (of("unattributed-official").length) lines.push(`These sentences state an official claim as fact: ${of("unattributed-official").map((text) => `"${text}"`).join("; ")}. Say who made it ("the ministry said", "according to the release").`);
  if (of("unknown-citation").length) lines.push(`These citations do not exist: ${of("unknown-citation").join(", ")}. Cite only the record ids you were given.`);
  if (of("no-citation").length) lines.push("Every sentence must cite at least one record id.");
  if (of("certain-future").length) lines.push("Do not state the future as certain; say what was announced or scheduled, and by whom.");
  if (of("too-long").length) lines.push(`Keep each sentence under ${MAX_CLAIM_CHARS} characters.`);
  if (of("empty").length) lines.push("The output was empty.");
  return lines.join(" ");
}
