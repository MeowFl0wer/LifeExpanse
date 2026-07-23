import { COUNTRY_DATA, type CountryInfo } from './countryData'

/**
 * ISO 3166-1 country normalisation.
 *
 * The database stores the **alpha-3** code (`CHN`, not `156` and not `中国`).
 * v1.9 §31.1: this must be settled before any real data is entered, because
 * "韩国 / 南韩 / Korea, South / Republic of Korea" all mean one country, and
 * matching on the display name is a losing game. So a user may type any of
 * those, and it is normalised to `KOR` on the way in and looked up for display
 * on the way out.
 *
 * The map (world-atlas) indexes geometries by numeric code, so a code→numeric
 * lookup lives here too — one place, tested, rather than scattered.
 */

/** Chinese and English names → alpha-3, plus a few common aliases the ISO
 *  data does not list under those exact strings. Built once at module load. */
const NAME_TO_ALPHA3 = new Map<string, string>()
for (const [alpha3, info] of COUNTRY_DATA) {
  NAME_TO_ALPHA3.set(info.zh.toLowerCase(), alpha3)
  NAME_TO_ALPHA3.set(info.en.toLowerCase(), alpha3)
}

// Aliases people actually type that the ISO English/Chinese names miss.
// Keyed lower-case. Kept small and explicit rather than fuzzy-matching, which
// would map the wrong country with quiet confidence.
const ALIASES: Record<string, string> = {
  'korea': 'KOR',
  'south korea': 'KOR',
  '南韩': 'KOR',
  'north korea': 'PRK',
  '北韩': 'PRK',
  '朝鲜': 'PRK',
  'usa': 'USA',
  'us': 'USA',
  'u.s.': 'USA',
  'u.s.a.': 'USA',
  'america': 'USA',
  'uk': 'GBR',
  'u.k.': 'GBR',
  'britain': 'GBR',
  'great britain': 'GBR',
  'england': 'GBR',
  '英国': 'GBR',
  'russia': 'RUS',
  '俄国': 'RUS',
  'hong kong': 'HKG',
  '香港': 'HKG',
  'macau': 'MAC',
  'macao': 'MAC',
  '澳门': 'MAC',
  'taiwan': 'TWN',
  '台湾': 'TWN',
  'vietnam': 'VNM',
  '越南': 'VNM',
  'czech republic': 'CZE',
  'uae': 'ARE',
}

/**
 * Normalises any reasonable spelling of a country to its alpha-3 code.
 *
 * Returns null when nothing matches — the caller shows the raw input for the
 * user to fix, rather than guessing a country and pinning a wrong flag on the
 * map.
 */
export function toAlpha3(input: string): string | null {
  const raw = input.trim()
  if (!raw) return null

  // Already an alpha-3.
  const upper = raw.toUpperCase()
  if (COUNTRY_DATA.has(upper)) return upper

  const lower = raw.toLowerCase()
  return ALIASES[lower] ?? NAME_TO_ALPHA3.get(lower) ?? null
}

/** The Chinese display name for a code, or the code itself if unknown. */
export function countryName(alpha3: string): string {
  return COUNTRY_DATA.get(alpha3.toUpperCase())?.zh ?? alpha3
}

/** The English display name for a code, or the code itself if unknown. */
export function countryNameEn(alpha3: string): string {
  return COUNTRY_DATA.get(alpha3.toUpperCase())?.en ?? alpha3
}

/**
 * The ISO numeric code for an alpha-3, as world-atlas keys its geometries.
 * Null when the code is unknown.
 */
export function numericFor(alpha3: string): string | null {
  return COUNTRY_DATA.get(alpha3.toUpperCase())?.numeric ?? null
}

/** Whether a string is a known alpha-3 code. */
export function isKnownCountry(alpha3: string): boolean {
  return COUNTRY_DATA.has(alpha3.toUpperCase())
}

/** All countries, for a picker. */
export function allCountries(): { alpha3: string; info: CountryInfo }[] {
  return Array.from(COUNTRY_DATA, ([alpha3, info]) => ({ alpha3, info }))
}
