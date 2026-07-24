import { request } from './http'
import type { FootprintCityResult, FootprintPlace, FootprintVisitRecord } from '../types'
import type { CitySearchOptions, VisitInput } from './footprint'

/**
 * Backend-backed footprint data layer.
 *
 * `footprint.ts` picks between this and the in-memory store. The wire format is
 * snake_case; the app is camelCase, and the mapping lives here so neither side
 * leaks into the other.
 */

interface WireCity {
  id: string
  name: string
  lat: number
  lng: number
  country_code: string
  population: number
}

interface WirePlace {
  id: string
  city: string
  country_code: string
  lat: number
  lng: number
  first_visit: string | null
  last_visit: string | null
  visit_count: number
}

interface WireVisit {
  id: string
  place_id: string
  visited_on: string
  note: string | null
  source: string
}

function fromCity(w: WireCity): FootprintCityResult {
  return { id: w.id, name: w.name, lat: w.lat, lng: w.lng, countryCode: w.country_code, population: w.population }
}

function fromPlace(w: WirePlace): FootprintPlace {
  return {
    id: w.id,
    city: w.city,
    countryCode: w.country_code,
    lat: w.lat,
    lng: w.lng,
    firstVisit: w.first_visit,
    lastVisit: w.last_visit,
    visitCount: w.visit_count,
  }
}

function fromVisit(w: WireVisit): FootprintVisitRecord {
  return { id: w.id, placeId: w.place_id, visitedOn: w.visited_on, note: w.note, source: w.source }
}

export async function searchCities(query: string, opts: CitySearchOptions = {}): Promise<FootprintCityResult[]> {
  const rows = await request<WireCity[]>('/footprint/cities', {
    query: { q: query, country: opts.country, limit: opts.limit },
  })
  return rows.map(fromCity)
}

export async function listPlaces(username: string): Promise<FootprintPlace[]> {
  const rows = await request<WirePlace[]>(`/footprint/${encodeURIComponent(username)}/places`)
  return rows.map(fromPlace)
}

export async function addVisit(input: VisitInput): Promise<FootprintVisitRecord> {
  // The owner is the session user server-side; we never send it. The coordinate
  // is looked up on the server from (city, country), not sent either.
  const w = await request<WireVisit>('/footprint/visits', {
    method: 'POST',
    body: {
      city: input.city,
      country_code: input.countryCode,
      visited_on: input.visitedOn,
      note: input.note?.trim() || null,
    },
  })
  return fromVisit(w)
}

export async function deleteVisit(visitId: string): Promise<void> {
  await request(`/footprint/visits/${encodeURIComponent(visitId)}`, { method: 'DELETE' })
}
