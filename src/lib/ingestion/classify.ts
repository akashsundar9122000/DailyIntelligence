import type { CategorySlug } from "@/config/categories";

/**
 * Category tagging by rule, before any model is involved: whole-word matches
 * on the headline. Deterministic,
 * explainable ("tagged Cricket because the headline says IPL") and testable,
 * which a model's guess is not. The AI layer refines these in phase 2; it does
 * not replace the fact that they were derived from the source.
 *
 * NOT GDELT'S THEMES. They were tried first and dropped: a theme describes
 * anything an article mentions, not what it is about. On 2026-10-18 a piece
 * on why people like spicy food carried ECON_WORLDCURRENCIES and EDUCATION,
 * and a profile of a balloonist carried MILITARY and DISASTER_FIRE. The
 * themes are kept in the item's metadata; they do not decide its section.
 * A headline the rules cannot place is left uncategorised for the AI layer.
 *
 * Rules are in PRIORITY order: the first that matches is the primary
 * category. A sport outranks business because "IPL franchise valuation" is a
 * cricket story first.
 */
/**
 * `words` is case-insensitive. `acronyms` is case-SENSITIVE, for the short
 * words that are only meaningful in capitals: "WHO" is the health
 * organisation and "who" is in half of all headlines; "AI" is not "ai".
 */
type Rule = { category: CategorySlug; words?: RegExp; acronyms?: RegExp };

const RULES: Rule[] = [
  { category: "cricket", words: /\b(cricket|ipl|bcci|t20|odi|test match|wicket|wickets|ranji|icc|kohli|rohit sharma|bumrah|gill|innings)\b/i },
  { category: "football", words: /\b(football|soccer|fifa|uefa|premier league|la liga|bundesliga|serie a|isl|champions league|messi|ronaldo)\b/i },
  {
    category: "sports",
    words: /\b(olympic|olympics|tennis|wimbledon|grand slam|formula 1|formula one|f1|grand prix|chess|badminton|hockey|athletics|marathon|kabaddi|wrestling|boxing|golf|nba|asian games|commonwealth games)\b/i,
  },
  // Product names that are also ordinary words or names (Gemini, Claude, Copilot) are left out: they would tag horoscopes and people.
  { category: "ai", words: /\b(artificial intelligence|genai|generative ai|openai|chatgpt|anthropic|llms?|large language models?|machine learning|deep learning|neural networks?|chatbots?|deepfakes?)\b/i, acronyms: /\b(AI|A\.I\.)\b/ },
  {
    category: "cinema",
    words: /\b(film|films|movie|movies|box office|bollywood|kollywood|tollywood|mollywood|sandalwood|cinema|actor|actress|director|trailer|teaser|ott|netflix|prime video|hotstar|oscars?|filmfare|web series|biopic)\b/i,
  },
  { category: "space", words: /\b(isro|nasa|esa|spacex|space station|satellite|rocket|launch vehicle|chandrayaan|gaganyaan|aditya-l1|astronaut|lunar|moon mission|mars|orbit|telescope)\b/i },
  { category: "startups", words: /\b(startup|start-up|startups|unicorn|seed round|series [a-e]|funding round|raises \$|raises rs|venture capital|vc fund|founder)\b/i },
  {
    category: "business",
    words: /\b(sensex|nifty|rbi|repo rate|inflation|gdp|stock market|shares|ipo|earnings|quarterly results|q[1-4] results|revenue|profit|merger|acquisition|tariff|trade deal|rupee|economy|economic|fiscal|budget|gst|exports|imports|bank|banks|crude|oil prices)\b/i,
  },
  { category: "technology", words: /\b(smartphone|iphone|android|apple|google|microsoft|meta|semiconductor|chip|chips|5g|6g|software|app|cyberattack|cyber attack|data breach|hackers?|internet|telecom|gadget|laptop)\b/i },
  { category: "health", words: /\b(health|hospital|hospitals|disease|virus|vaccine|vaccination|covid|dengue|malaria|cancer|outbreak|medical|medicine|doctors|patients|mental health|nutrition)\b/i, acronyms: /\b(WHO|ICMR|AIIMS)\b/ },
  {
    category: "climate",
    words: /\b(climate|heatwave|heat wave|monsoon|cyclone|flood|floods|drought|wildfire|earthquake|landslide|emissions|carbon|renewable|solar|wind power|pollution|aqi|air quality|global warming|cop\d+)\b/i,
  },
  { category: "science", words: /\b(scientists?|research|researchers|study finds|discovery|physics|chemistry|biology|genome|fossil|archaeolog\w+|quantum)\b/i },
  { category: "education", words: /\b(neet|jee|cbse|icse|ugc|exam|exams|university|universities|college|school|schools|students|admission|syllabus|iit|iim)\b/i },
  { category: "gaming", words: /\b(video game|videogame|gaming|esports|e-sports|playstation|xbox|nintendo|steam|bgmi|gta)\b/i },
  {
    category: "india-politics",
    words: /\b(lok sabha|rajya sabha|parliament|bjp|congress|dmk|aiadmk|shiv sena|election commission|assembly elections?|chief minister|modi|rahul gandhi|amit shah|minister|ministry|governor)\b/i,
    acronyms: /\b(AAP|TMC|MLA|MLAs|MP|MPs|CM)\b/,
  },
  { category: "world-politics", words: /\b(president|prime minister|parliament|election|elections|sanctions|ceasefire|war|military|diplomat\w*|summit|united nations|nato|un security council|g20|g7|brics)\b/i },
  { category: "lifestyle", words: /\b(food|recipe|travel|fashion|wellness|fitness|yoga|festival|diwali|holi|eid|christmas|wedding|lifestyle)\b/i },
];

/**
 * The categories a headline belongs to, primary first. `india` decides which
 * of the two politics categories a political story is: the place of the event,
 * never the publisher's country.
 */
export function categorise({ title, india }: { title: string; india: boolean }): CategorySlug[] {
  const found: CategorySlug[] = [];
  for (const rule of RULES) {
    const byWords = (rule.words?.test(title) ?? false) || (rule.acronyms?.test(title) ?? false);
    if (!byWords) continue;
    let category = rule.category;
    if (category === "india-politics" && !india) category = "world-politics";
    if (category === "world-politics" && india && byWords && /\b(lok sabha|rajya sabha|bjp|congress|election commission|chief minister|modi)\b/i.test(title)) category = "india-politics";
    if (!found.includes(category)) found.push(category);
  }
  return found;
}

/**
 * People and organisations named by GDELT for an item, at most `limit` of each,
 * in the order GDELT lists them (by first mention). Title-cased: GDELT writes
 * them in lower case.
 */
export function entitiesFromGkg(persons: string, organisations: string, limit = 5): { kind: "person" | "organisation"; name: string }[] {
  const titleCase = (name: string) => name.replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
  const take = (field: string) =>
    [...new Set(field.split(";").map((entry) => entry.split(",")[0]!.trim()).filter((entry) => entry.length >= 3))].slice(0, limit).map(titleCase);
  return [...take(persons).map((name) => ({ kind: "person" as const, name })), ...take(organisations).map((name) => ({ kind: "organisation" as const, name }))];
}
