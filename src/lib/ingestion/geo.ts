import type { WorldRegion } from "@/config/regions";

/**
 * GDELT writes places in FIPS 10-4 codes, not ISO 3166. They disagree for many
 * countries -- "CH" is China in FIPS and Switzerland in ISO, "UK" is the United
 * Kingdom, "SF" is South Africa -- so a country is converted here, once, and
 * everything downstream speaks ISO.
 *
 * [FIPS, ISO 3166-1 alpha-2, region]. Countries absent from this table are
 * kept out of event geography rather than guessed at.
 */
const COUNTRIES: [string, string, WorldRegion][] = [
  // South Asia
  ["IN", "IN", "south-asia"], ["PK", "PK", "south-asia"], ["BG", "BD", "south-asia"], ["CE", "LK", "south-asia"], ["NP", "NP", "south-asia"],
  ["BT", "BT", "south-asia"], ["MV", "MV", "south-asia"], ["AF", "AF", "south-asia"],
  // East Asia
  ["CH", "CN", "east-asia"], ["JA", "JP", "east-asia"], ["KS", "KR", "east-asia"], ["KN", "KP", "east-asia"], ["TW", "TW", "east-asia"],
  ["HK", "HK", "east-asia"], ["MG", "MN", "east-asia"], ["MC", "MO", "east-asia"],
  // Southeast Asia
  ["ID", "ID", "southeast-asia"], ["RP", "PH", "southeast-asia"], ["VM", "VN", "southeast-asia"], ["TH", "TH", "southeast-asia"],
  ["MY", "MY", "southeast-asia"], ["SN", "SG", "southeast-asia"], ["BM", "MM", "southeast-asia"], ["CB", "KH", "southeast-asia"],
  ["LA", "LA", "southeast-asia"], ["BX", "BN", "southeast-asia"], ["TT", "TL", "southeast-asia"],
  // Middle East
  ["IS", "IL", "middle-east"], ["WE", "PS", "middle-east"], ["GZ", "PS", "middle-east"], ["IR", "IR", "middle-east"], ["IZ", "IQ", "middle-east"],
  ["SA", "SA", "middle-east"], ["AE", "AE", "middle-east"], ["QA", "QA", "middle-east"], ["KU", "KW", "middle-east"], ["BA", "BH", "middle-east"],
  ["MU", "OM", "middle-east"], ["YM", "YE", "middle-east"], ["JO", "JO", "middle-east"], ["LE", "LB", "middle-east"], ["SY", "SY", "middle-east"],
  ["TU", "TR", "middle-east"], ["EG", "EG", "middle-east"], ["CY", "CY", "middle-east"],
  // Europe
  ["UK", "GB", "europe"], ["EI", "IE", "europe"], ["FR", "FR", "europe"], ["GM", "DE", "europe"], ["IT", "IT", "europe"], ["SP", "ES", "europe"],
  ["PO", "PT", "europe"], ["NL", "NL", "europe"], ["BE", "BE", "europe"], ["LU", "LU", "europe"], ["SZ", "CH", "europe"], ["AU", "AT", "europe"],
  ["SW", "SE", "europe"], ["NO", "NO", "europe"], ["DA", "DK", "europe"], ["FI", "FI", "europe"], ["IC", "IS", "europe"], ["PL", "PL", "europe"],
  ["EZ", "CZ", "europe"], ["LO", "SK", "europe"], ["HU", "HU", "europe"], ["RO", "RO", "europe"], ["BU", "BG", "europe"], ["GR", "GR", "europe"],
  ["HR", "HR", "europe"], ["SI", "SI", "europe"], ["RI", "RS", "europe"], ["BK", "BA", "europe"], ["MJ", "ME", "europe"], ["MK", "MK", "europe"],
  ["AL", "AL", "europe"], ["KV", "XK", "europe"], ["UP", "UA", "europe"], ["BO", "BY", "europe"], ["MD", "MD", "europe"], ["RS", "RU", "europe"],
  ["EN", "EE", "europe"], ["LG", "LV", "europe"], ["LH", "LT", "europe"], ["MT", "MT", "europe"], ["VT", "VA", "europe"], ["GG", "GE", "europe"],
  ["AM", "AM", "europe"], ["AJ", "AZ", "europe"],
  // Central Asia sits with South Asia for this product's purposes: it is covered alongside it in Indian reporting.
  ["KZ", "KZ", "south-asia"], ["UZ", "UZ", "south-asia"], ["TI", "TJ", "south-asia"], ["KG", "KG", "south-asia"], ["TX", "TM", "south-asia"],
  // Africa
  ["SF", "ZA", "africa"], ["NI", "NG", "africa"], ["KE", "KE", "africa"], ["ET", "ET", "africa"], ["GH", "GH", "africa"], ["TZ", "TZ", "africa"],
  ["UG", "UG", "africa"], ["RW", "RW", "africa"], ["SU", "SD", "africa"], ["OD", "SS", "africa"], ["SO", "SO", "africa"], ["DJ", "DJ", "africa"],
  ["ER", "ER", "africa"], ["MO", "MA", "africa"], ["AG", "DZ", "africa"], ["TS", "TN", "africa"], ["LY", "LY", "africa"], ["SG", "SN", "africa"],
  ["ML", "ML", "africa"], ["NG", "NE", "africa"], ["UV", "BF", "africa"], ["IV", "CI", "africa"], ["CM", "CM", "africa"], ["CG", "CD", "africa"],
  ["CF", "CG", "africa"], ["AO", "AO", "africa"], ["ZA", "ZM", "africa"], ["ZI", "ZW", "africa"], ["MZ", "MZ", "africa"], ["MI", "MW", "africa"],
  ["BC", "BW", "africa"], ["WA", "NA", "africa"], ["MA", "MG", "africa"], ["MP", "MU", "africa"], ["LI", "LR", "africa"], ["SL", "SL", "africa"],
  ["GV", "GN", "africa"], ["BN", "BJ", "africa"], ["TO", "TG", "africa"], ["CD", "TD", "africa"], ["GB", "GA", "africa"], ["EK", "GQ", "africa"],
  ["SE", "SC", "africa"], ["LT", "LS", "africa"], ["WZ", "SZ", "africa"], ["BY", "BI", "africa"], ["CV", "CV", "africa"], ["GA", "GM", "africa"],
  ["MR", "MR", "africa"], ["PU", "GW", "africa"], ["CN", "KM", "africa"],
  // North America
  ["US", "US", "north-america"], ["CA", "CA", "north-america"], ["MX", "MX", "latin-america"],
  // Latin America and the Caribbean
  ["BR", "BR", "latin-america"], ["AR", "AR", "latin-america"], ["CI", "CL", "latin-america"], ["CO", "CO", "latin-america"], ["PE", "PE", "latin-america"],
  ["VE", "VE", "latin-america"], ["EC", "EC", "latin-america"], ["BL", "BO", "latin-america"], ["PA", "PY", "latin-america"], ["UY", "UY", "latin-america"],
  ["GT", "GT", "latin-america"], ["HO", "HN", "latin-america"], ["ES", "SV", "latin-america"], ["NU", "NI", "latin-america"], ["CS", "CR", "latin-america"],
  ["PM", "PA", "latin-america"], ["CU", "CU", "latin-america"], ["HA", "HT", "latin-america"], ["DR", "DO", "latin-america"], ["JM", "JM", "latin-america"],
  ["TD", "TT", "latin-america"], ["BB", "BB", "latin-america"], ["BF", "BS", "latin-america"], ["GY", "GY", "latin-america"], ["NS", "SR", "latin-america"],
  ["RQ", "PR", "latin-america"],
  // Oceania
  ["AS", "AU", "oceania"], ["NZ", "NZ", "oceania"], ["PP", "PG", "oceania"], ["FJ", "FJ", "oceania"], ["BP", "SB", "oceania"], ["NH", "VU", "oceania"],
  ["WS", "WS", "oceania"], ["TN", "TO", "oceania"], ["KR", "KI", "oceania"],
];

const BY_FIPS = new Map(COUNTRIES.map(([fips, iso, region]) => [fips, { iso, region }]));
const REGION_BY_ISO = new Map(COUNTRIES.map(([, iso, region]) => [iso, region]));

/** ISO code for a GDELT (FIPS) country code, or null when it is not one we place. */
export function isoFromFips(fips: string): string | null {
  return BY_FIPS.get(fips.toUpperCase())?.iso ?? null;
}

export function regionOfIso(iso: string): WorldRegion | null {
  return REGION_BY_ISO.get(iso.toUpperCase()) ?? null;
}

/**
 * Indian states by GDELT's FIPS ADM1 code, to this product's short code
 * (config/regions.ts). Read from real GKG rows on 2026-10-18 for every code
 * that appeared; the rest are the published FIPS 10-4 list. GDELT still
 * places Hyderabad in Andhra Pradesh (IN02) and Leh in Jammu and Kashmir
 * (IN12): the FIPS list predates Telangana and Ladakh, and nothing here can
 * tell them apart, so neither is guessed.
 */
export const INDIAN_STATE_BY_FIPS: Record<string, string> = {
  IN02: "AP",
  IN03: "AS",
  IN05: "CH",
  IN07: "DL",
  IN09: "GJ",
  IN10: "HR",
  IN11: "HP",
  IN12: "JK",
  IN13: "KL",
  IN16: "MH",
  IN17: "MN",
  IN18: "ML",
  IN19: "KA",
  IN20: "NL",
  IN21: "OR",
  IN22: "PY",
  IN23: "PB",
  IN24: "RJ",
  IN25: "TN",
  IN26: "TR",
  IN28: "WB",
  IN29: "SK",
  IN30: "AR",
  IN31: "MZ",
  IN33: "GA",
  IN34: "BR",
  IN35: "MP",
  IN36: "UP",
  IN37: "CT",
  IN38: "JH",
  IN39: "UT",
};

export type Places = { countries: string[]; indianStates: string[] };

/**
 * Event geography from a GKG V1LOCATIONS field: entries separated by ";",
 * fields by "#": type # full name # country (FIPS) # ADM1 # lat # long # id.
 * Countries come out as ISO, Indian states as short codes, each once.
 */
export function placesFromGkgLocations(field: string): Places {
  const countries = new Set<string>();
  const states = new Set<string>();
  for (const entry of field.split(";")) {
    const parts = entry.split("#");
    if (parts.length < 4) continue;
    const iso = isoFromFips(parts[2] ?? "");
    if (iso) countries.add(iso);
    const state = INDIAN_STATE_BY_FIPS[parts[3] ?? ""];
    if (state) states.add(state);
  }
  return { countries: [...countries].sort(), indianStates: [...states].sort() };
}

/** Every ISO country we place in a world region, for the region filter. */
export function countriesInRegion(region: WorldRegion): string[] {
  return [...new Set(COUNTRIES.filter(([, , r]) => r === region).map(([, iso]) => iso))];
}
