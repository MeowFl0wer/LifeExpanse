/**
 * Builds backend/app/data/cities.json from GeoNames cities15000.
 *
 * The city dataset lives in the backend, not the frontend bundle: it is ~2 MB
 * and is only needed at *entry* time to resolve a typed city name to
 * coordinates. The map renders stored coordinates, so it never needs the full
 * table. A backend search endpoint keeps the megabytes off the client.
 *
 * We keep, per city: primary name, ascii name, the CJK alternate names (so a
 * Chinese user can type 上海), coordinates, alpha-3 country code, population.
 * Alternate names are filtered to CJK + a couple of romanisations to keep the
 * file small — the raw alternatenames field has dozens of transliterations
 * nobody searches by.
 *
 * Usage: node scripts/gen-cities.mjs /path/to/cities15000.txt
 * GeoNames data is CC BY 4.0 — the About page must credit it.
 */
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync } from 'node:fs'

const require = createRequire(import.meta.url)
const iso = require('i18n-iso-countries')

const src = process.argv[2]
if (!src) {
  console.error('usage: node scripts/gen-cities.mjs <cities15000.txt>')
  process.exit(1)
}

const CJK = /[㐀-鿿豈-﫿]/
const lines = readFileSync(src, 'utf8').split('\n').filter(Boolean)

const cities = []
for (const line of lines) {
  const f = line.split('\t')
  const [geonameid, name, ascii, alt, lat, lng] = f
  const alpha2 = f[8]
  const population = Number(f[14]) || 0

  const alpha3 = iso.alpha2ToAlpha3(alpha2)
  if (!alpha3) continue // Skip anything we cannot map to a known country.

  // Alternate names: keep the CJK ones for Chinese input, drop the rest.
  const cjkAlts = alt
    ? alt.split(',').map(s => s.trim()).filter(s => s && CJK.test(s))
    : []

  cities.push({
    id: geonameid,
    name,
    ascii,
    alt: Array.from(new Set(cjkAlts)),
    lat: Math.round(Number(lat) * 10000) / 10000,
    lng: Math.round(Number(lng) * 10000) / 10000,
    cc: alpha3,
    pop: population,
  })
}

// Most populous first, so a name shared by several cities offers the big one
// first (typing "Springfield" should not lead with a village).
cities.sort((a, b) => b.pop - a.pop)

const out = JSON.stringify(cities)
writeFileSync(new URL('../backend/app/data/cities.json', import.meta.url), out)
console.log(`wrote ${cities.length} cities, ${(out.length / 1024 / 1024).toFixed(1)} MB`)
