/**
 * Geography vocabulary (blueprint §5.3, §5.4).
 *
 * An EVENT's location is not its PUBLISHER's location: a London paper writing
 * about Chennai is an India story. Stories carry event geography from the
 * source's own tags (GDELT locations, a feed's region), never from the
 * publisher's country alone.
 */
export const WORLD_REGIONS = [
  { slug: "north-america", label: "North America" },
  { slug: "latin-america", label: "Latin America" },
  { slug: "europe", label: "Europe" },
  { slug: "middle-east", label: "Middle East" },
  { slug: "africa", label: "Africa" },
  { slug: "south-asia", label: "South Asia" },
  { slug: "east-asia", label: "East Asia" },
  { slug: "southeast-asia", label: "Southeast Asia" },
  { slug: "oceania", label: "Oceania" },
] as const;

export type WorldRegion = (typeof WORLD_REGIONS)[number]["slug"];

/** Indian states and union territories, by this product's short code. GDELT's FIPS codes map to these in lib/ingestion/geo.ts. */
export const INDIAN_STATES = [
  { code: "AP", label: "Andhra Pradesh" },
  { code: "AR", label: "Arunachal Pradesh" },
  { code: "AS", label: "Assam" },
  { code: "BR", label: "Bihar" },
  { code: "CT", label: "Chhattisgarh" },
  { code: "GA", label: "Goa" },
  { code: "GJ", label: "Gujarat" },
  { code: "HR", label: "Haryana" },
  { code: "HP", label: "Himachal Pradesh" },
  { code: "JH", label: "Jharkhand" },
  { code: "KA", label: "Karnataka" },
  { code: "KL", label: "Kerala" },
  { code: "MP", label: "Madhya Pradesh" },
  { code: "MH", label: "Maharashtra" },
  { code: "MN", label: "Manipur" },
  { code: "ML", label: "Meghalaya" },
  { code: "MZ", label: "Mizoram" },
  { code: "NL", label: "Nagaland" },
  { code: "OR", label: "Odisha" },
  { code: "PB", label: "Punjab" },
  { code: "RJ", label: "Rajasthan" },
  { code: "SK", label: "Sikkim" },
  { code: "TN", label: "Tamil Nadu" },
  { code: "TG", label: "Telangana" },
  { code: "TR", label: "Tripura" },
  { code: "UP", label: "Uttar Pradesh" },
  { code: "UT", label: "Uttarakhand" },
  { code: "WB", label: "West Bengal" },
  { code: "DL", label: "Delhi" },
  { code: "JK", label: "Jammu and Kashmir" },
  { code: "LA", label: "Ladakh" },
  { code: "PY", label: "Puducherry" },
  { code: "CH", label: "Chandigarh" },
] as const;

/** The India/Global switch. "both" is the default edition. */
export const SCOPE_LABELS = { both: "India + World", india: "India", global: "World" } as const;
