import { SITE_OWNER } from '../lib/site'
import type { FootprintCityResult, FootprintPlace } from '../types'
import { nextId } from './store'

/**
 * In-memory footprint store — the v1.9 Place / Visit model (handoff §5),
 * mirroring the backend so the data layer's two branches behave the same.
 *
 * A **Place** is one city at owner granularity, its coordinate taken from the
 * gazetteer (never the client). A **Visit** is one dated stay; "first / last /
 * count" are derived from real visit rows, not stored counters, exactly as the
 * server derives them. Everything is owner-scoped: one person's travel never
 * appears in another's aggregate.
 *
 * The gazetteer here is a small sample, enough for `pnpm dev` and the tests to
 * resolve a typed city to a coordinate. The real search is the backend's 34k
 * GeoNames dataset; this stand-in is only used when `VITE_API_BASE` is unset.
 */

interface GazCity {
  id: string
  /** English primary name. */
  name: string
  /** ISO 3166-1 alpha-3. */
  cc: string
  lat: number
  lng: number
  pop: number
  /** Aliases, including CJK, so 上海 resolves to Shanghai. */
  alt: string[]
}

// A deliberately small sample. Kept sorted-ish by prominence; search re-sorts
// by population anyway.
const GAZETTEER: GazCity[] = [
  { id: 'g-pek', name: 'Beijing', cc: 'CHN', lat: 39.9042, lng: 116.4074, pop: 18960744, alt: ['北京'] },
  { id: 'g-sha', name: 'Shanghai', cc: 'CHN', lat: 31.2304, lng: 121.4737, pop: 22315474, alt: ['上海'] },
  { id: 'g-can', name: 'Guangzhou', cc: 'CHN', lat: 23.1291, lng: 113.2644, pop: 11071424, alt: ['广州'] },
  { id: 'g-hkg', name: 'Hong Kong', cc: 'HKG', lat: 22.3193, lng: 114.1694, pop: 7012738, alt: ['香港'] },
  { id: 'g-tpe', name: 'Taipei', cc: 'TWN', lat: 25.0330, lng: 121.5654, pop: 2646204, alt: ['台北'] },
  { id: 'g-tyo', name: 'Tokyo', cc: 'JPN', lat: 35.6762, lng: 139.6503, pop: 8336599, alt: ['东京'] },
  { id: 'g-osa', name: 'Osaka', cc: 'JPN', lat: 34.6937, lng: 135.5023, pop: 2592413, alt: ['大阪'] },
  { id: 'g-kyo', name: 'Kyoto', cc: 'JPN', lat: 35.0116, lng: 135.7681, pop: 1459640, alt: ['京都'] },
  { id: 'g-sel', name: 'Seoul', cc: 'KOR', lat: 37.5665, lng: 126.9780, pop: 10349312, alt: ['首尔', '汉城'] },
  { id: 'g-sin', name: 'Singapore', cc: 'SGP', lat: 1.3521, lng: 103.8198, pop: 5638700, alt: ['新加坡'] },
  { id: 'g-bkk', name: 'Bangkok', cc: 'THA', lat: 13.7563, lng: 100.5018, pop: 5104476, alt: ['曼谷'] },
  { id: 'g-kul', name: 'Kuala Lumpur', cc: 'MYS', lat: 3.1390, lng: 101.6869, pop: 1768000, alt: ['吉隆坡'] },
  { id: 'g-del', name: 'Delhi', cc: 'IND', lat: 28.6139, lng: 77.2090, pop: 10927986, alt: ['德里'] },
  { id: 'g-dxb', name: 'Dubai', cc: 'ARE', lat: 25.0772, lng: 55.3093, pop: 2502715, alt: ['迪拜'] },
  { id: 'g-lon', name: 'London', cc: 'GBR', lat: 51.5074, lng: -0.1278, pop: 8961989, alt: ['伦敦'] },
  { id: 'g-par', name: 'Paris', cc: 'FRA', lat: 48.8566, lng: 2.3522, pop: 2138551, alt: ['巴黎'] },
  { id: 'g-ber', name: 'Berlin', cc: 'DEU', lat: 52.5200, lng: 13.4050, pop: 3426354, alt: ['柏林'] },
  { id: 'g-mad', name: 'Madrid', cc: 'ESP', lat: 40.4168, lng: -3.7038, pop: 3255944, alt: ['马德里'] },
  { id: 'g-rom', name: 'Rome', cc: 'ITA', lat: 41.9028, lng: 12.4964, pop: 2318895, alt: ['罗马'] },
  { id: 'g-ams', name: 'Amsterdam', cc: 'NLD', lat: 52.3676, lng: 4.9041, pop: 741636, alt: ['阿姆斯特丹'] },
  { id: 'g-zrh', name: 'Zurich', cc: 'CHE', lat: 47.3769, lng: 8.5417, pop: 341730, alt: ['苏黎世'] },
  { id: 'g-mos', name: 'Moscow', cc: 'RUS', lat: 55.7558, lng: 37.6173, pop: 10381222, alt: ['莫斯科'] },
  { id: 'g-nyc', name: 'New York', cc: 'USA', lat: 40.7128, lng: -74.0060, pop: 8175133, alt: ['纽约'] },
  { id: 'g-sfo', name: 'San Francisco', cc: 'USA', lat: 37.7749, lng: -122.4194, pop: 864816, alt: ['旧金山', '三藩市'] },
  { id: 'g-lax', name: 'Los Angeles', cc: 'USA', lat: 34.0522, lng: -118.2437, pop: 3971883, alt: ['洛杉矶'] },
  { id: 'g-yto', name: 'Toronto', cc: 'CAN', lat: 43.6532, lng: -79.3832, pop: 2731571, alt: ['多伦多'] },
  { id: 'g-mex', name: 'Mexico City', cc: 'MEX', lat: 19.4326, lng: -99.1332, pop: 12294193, alt: ['墨西哥城'] },
  { id: 'g-sao', name: 'São Paulo', cc: 'BRA', lat: -23.5505, lng: -46.6333, pop: 10021295, alt: ['圣保罗', 'Sao Paulo'] },
  { id: 'g-syd', name: 'Sydney', cc: 'AUS', lat: -33.8688, lng: 151.2093, pop: 4627345, alt: ['悉尼'] },
  { id: 'g-akl', name: 'Auckland', cc: 'NZL', lat: -36.8485, lng: 174.7633, pop: 1415550, alt: ['奥克兰'] },
  { id: 'g-cai', name: 'Cairo', cc: 'EGY', lat: 30.0444, lng: 31.2357, pop: 7734614, alt: ['开罗'] },
  { id: 'g-cpt', name: 'Cape Town', cc: 'ZAF', lat: -33.9249, lng: 18.4241, pop: 3433441, alt: ['开普敦'] },
]

// Mirror of the backend tokeniser: strip everything but ASCII word chars and
// CJK, then lower-case. Keeps "New York" matching "newyork" and lets a comma or
// apostrophe in a name pass.
const TOKEN = /[^\w一-鿿]+/g
function normalise(text: string): string {
  return text.replace(TOKEN, '').toLowerCase()
}

/**
 * Prefix search over names and CJK aliases, exact before prefix, then ordered
 * by population. `country` (alpha-3) narrows a shared name to one country — the
 * same contract the backend `search` offers.
 */
export function searchGazetteer(
  query: string,
  opts: { country?: string; limit?: number } = {}
): FootprintCityResult[] {
  const q = normalise(query)
  if (!q) return []
  const limit = opts.limit ?? 10
  const cc = opts.country?.toUpperCase()

  const exact: GazCity[] = []
  const prefix: GazCity[] = []
  for (const city of GAZETTEER) {
    if (cc && city.cc !== cc) continue
    let rank: 'exact' | 'prefix' | null = null
    for (const label of [city.name, ...city.alt]) {
      const norm = normalise(label)
      if (norm === q) { rank = 'exact'; break }
      if (norm.startsWith(q)) rank = 'prefix'
    }
    if (rank === 'exact') exact.push(city)
    else if (rank === 'prefix') prefix.push(city)
  }

  return [...exact, ...prefix]
    .sort((a, b) => b.pop - a.pop)
    .slice(0, limit)
    .map(c => ({ id: c.id, name: c.name, lat: c.lat, lng: c.lng, countryCode: c.cc, population: c.pop }))
}

/** The one city a name + country identifies, or null. */
export function resolveGazetteer(city: string, country: string): FootprintCityResult | null {
  return searchGazetteer(city, { country, limit: 1 })[0] ?? null
}

// --- Places & visits (owner-scoped) ----------------------------------------

export interface PlaceRow {
  id: string
  owner: string
  city: string
  countryCode: string
  lat: number
  lng: number
}

export interface VisitRow {
  id: string
  owner: string
  placeId: string
  /** ISO datetime. */
  visitedOn: string
  note: string | null
  source: string
}

function seedPlace(owner: string, gazId: string): PlaceRow {
  const c = GAZETTEER.find(g => g.id === gazId)!
  return { id: `pl-${gazId}`, owner, city: c.name, countryCode: c.cc, lat: c.lat, lng: c.lng }
}

// A little seed travel for the site owner, so the map is not empty in dev.
export const placeRows: PlaceRow[] = [
  seedPlace(SITE_OWNER, 'g-pek'),
  seedPlace(SITE_OWNER, 'g-sha'),
  seedPlace(SITE_OWNER, 'g-tyo'),
  seedPlace(SITE_OWNER, 'g-lon'),
  seedPlace(SITE_OWNER, 'g-par'),
]

export const visitRows: VisitRow[] = [
  { id: 'vs-pek-1', owner: SITE_OWNER, placeId: 'pl-g-pek', visitedOn: '2018-01-01', note: null, source: 'manual' },
  { id: 'vs-pek-2', owner: SITE_OWNER, placeId: 'pl-g-pek', visitedOn: '2024-11-20', note: '回家', source: 'manual' },
  { id: 'vs-sha-1', owner: SITE_OWNER, placeId: 'pl-g-sha', visitedOn: '2018-06-01', note: null, source: 'manual' },
  { id: 'vs-tyo-1', owner: SITE_OWNER, placeId: 'pl-g-tyo', visitedOn: '2020-01-15', note: '第一次', source: 'manual' },
  { id: 'vs-tyo-2', owner: SITE_OWNER, placeId: 'pl-g-tyo', visitedOn: '2024-11-18', note: null, source: 'manual' },
  { id: 'vs-lon-1', owner: SITE_OWNER, placeId: 'pl-g-lon', visitedOn: '2019-08-10', note: null, source: 'manual' },
  { id: 'vs-par-1', owner: SITE_OWNER, placeId: 'pl-g-par', visitedOn: '2023-07-14', note: '巴黎的夏天', source: 'manual' },
]

/** Places for one owner with visit aggregates, biggest first — mirrors `_place_rows`. */
export function aggregatePlaces(owner: string): FootprintPlace[] {
  return placeRows
    .filter(p => p.owner === owner)
    .map(p => {
      const dates = visitRows
        .filter(v => v.owner === owner && v.placeId === p.id)
        .map(v => v.visitedOn)
        .sort()
      return {
        id: p.id,
        city: p.city,
        countryCode: p.countryCode,
        lat: p.lat,
        lng: p.lng,
        firstVisit: dates[0] ?? null,
        lastVisit: dates[dates.length - 1] ?? null,
        visitCount: dates.length,
      }
    })
    .filter(p => p.visitCount > 0)
    .sort((a, b) => b.visitCount - a.visitCount)
}

/** Find an owner's place for a resolved city, or create it. */
export function findOrCreatePlace(owner: string, city: FootprintCityResult): PlaceRow {
  const existing = placeRows.find(
    p => p.owner === owner && p.city === city.name && p.countryCode === city.countryCode
  )
  if (existing) return existing
  const row: PlaceRow = {
    id: nextId('pl'),
    owner,
    city: city.name,
    countryCode: city.countryCode,
    lat: city.lat,
    lng: city.lng,
  }
  placeRows.push(row)
  return row
}

export function addVisitRow(owner: string, placeId: string, visitedOn: string, note: string | null): VisitRow {
  const row: VisitRow = { id: nextId('vs'), owner, placeId, visitedOn, note, source: 'manual' }
  visitRows.push(row)
  return row
}

/**
 * Remove a visit the owner owns. Returns false when it does not exist or is not
 * theirs — the caller answers the same 404 either way. A place with no visits
 * left is dropped so the map keeps no orphan point.
 */
export function removeVisitRow(owner: string, visitId: string): boolean {
  const i = visitRows.findIndex(v => v.id === visitId && v.owner === owner)
  if (i < 0) return false
  const { placeId } = visitRows[i]!
  visitRows.splice(i, 1)
  const remaining = visitRows.some(v => v.placeId === placeId)
  if (!remaining) {
    const pi = placeRows.findIndex(p => p.id === placeId)
    if (pi >= 0) placeRows.splice(pi, 1)
  }
  return true
}
