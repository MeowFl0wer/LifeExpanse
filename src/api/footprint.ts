import { ok, fail } from './client'
import { usingBackend } from './http'
import * as remote from './footprintHttp'
import {
  searchGazetteer, resolveGazetteer, aggregatePlaces,
  findOrCreatePlace, addVisitRow, removeVisitRow,
} from './footprintStore'
import type { FootprintCityResult, FootprintPlace, FootprintVisitRecord } from '../types'

/**
 * Footprint data access (v1.9 §33 / handoff §6).
 *
 * Same shape as the rest of `src/api/`: each function checks `usingBackend()`
 * and either calls the server or the in-memory store. Pages call these names
 * and never learn which is live.
 *
 * Two rules that are security on the server and mirrored here so the memory
 * branch does not lie about them: the coordinate of a visit comes from the
 * dataset, not the caller; and a person's places are owner-scoped — a viewer
 * who is not the owner sees nothing (until server-side public visibility
 * exists, which is a separate piece of work).
 */

export interface VisitInput {
  city: string
  /** ISO 3166-1 alpha-3. */
  countryCode: string
  /** ISO date or datetime. */
  visitedOn: string
  note?: string
}

export interface CitySearchOptions {
  /** Narrow to one country (alpha-3) to disambiguate a shared name. */
  country?: string
  limit?: number
}

export async function searchCities(query: string, opts: CitySearchOptions = {}): Promise<FootprintCityResult[]> {
  if (usingBackend()) return remote.searchCities(query, opts)
  return ok(searchGazetteer(query, opts))
}

export async function listPlaces(username: string, viewer: string | null): Promise<FootprintPlace[]> {
  if (usingBackend()) return remote.listPlaces(username)
  // Owner-only for now, the same as the server. A guest or another user sees an
  // empty footprint rather than someone else's travel.
  if (viewer === null || viewer !== username) return ok([])
  return ok(aggregatePlaces(username))
}

export async function addVisit(owner: string, input: VisitInput): Promise<FootprintVisitRecord> {
  if (usingBackend()) return remote.addVisit(input)

  // Resolve the coordinate from the dataset by (city, country); refuse rather
  // than pin the visit to a made-up point.
  const city = resolveGazetteer(input.city, input.countryCode)
  if (!city) return fail('找不到这座城市，请检查城市名与国家是否匹配', 400)

  const place = findOrCreatePlace(owner, city)
  const row = addVisitRow(owner, place.id, input.visitedOn, input.note?.trim() || null)
  return ok({ id: row.id, placeId: row.placeId, visitedOn: row.visitedOn, note: row.note, source: row.source })
}

export async function deleteVisit(owner: string, visitId: string): Promise<void> {
  if (usingBackend()) return remote.deleteVisit(visitId)
  // Same 404 whether it is missing or not yours.
  if (!removeVisitRow(owner, visitId)) return fail('记录不存在', 404)
  return ok(undefined)
}
