import { describe, it, expect, beforeEach } from 'vitest'
import { searchCities, listPlaces, addVisit, deleteVisit } from './footprint'
import { placeRows, visitRows } from './footprintStore'
import { ApiError } from './client'
import { SITE_OWNER } from '../lib/site'

// The store is module-level mutable state; snapshot the seed once and restore it
// before each test so a create/delete in one test cannot bleed into the next.
const seedPlaces = placeRows.map(p => ({ ...p }))
const seedVisits = visitRows.map(v => ({ ...v }))

beforeEach(() => {
  placeRows.splice(0, placeRows.length, ...seedPlaces.map(p => ({ ...p })))
  visitRows.splice(0, visitRows.length, ...seedVisits.map(v => ({ ...v })))
})

describe('searchCities (memory gazetteer)', () => {
  it('matches a Chinese alias to the English city', async () => {
    const hits = await searchCities('上海')
    expect(hits[0]?.name).toBe('Shanghai')
    expect(hits[0]?.countryCode).toBe('CHN')
  })

  it('matches an English prefix', async () => {
    const hits = await searchCities('Osak')
    expect(hits.map(c => c.name)).toContain('Osaka')
  })

  it('narrows a shared prefix by country', async () => {
    // "San" would surface San Francisco; constrain to a different country and it
    // must not leak in.
    const inUsa = await searchCities('San', { country: 'USA' })
    expect(inUsa.every(c => c.countryCode === 'USA')).toBe(true)
    const inJapan = await searchCities('San', { country: 'JPN' })
    expect(inJapan.find(c => c.name === 'San Francisco')).toBeUndefined()
  })

  it('orders shared results by population and respects the limit', async () => {
    const hits = await searchCities('a', { limit: 3 })
    expect(hits.length).toBeLessThanOrEqual(3)
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1]!.population).toBeGreaterThanOrEqual(hits[i]!.population)
    }
  })

  it('returns nothing for an empty query', async () => {
    expect(await searchCities('   ')).toEqual([])
  })
})

describe('listPlaces owner scoping', () => {
  it('gives the owner their seeded places, biggest first', async () => {
    const places = await listPlaces(SITE_OWNER, SITE_OWNER)
    expect(places.length).toBeGreaterThan(0)
    for (let i = 1; i < places.length; i++) {
      expect(places[i - 1]!.visitCount).toBeGreaterThanOrEqual(places[i]!.visitCount)
    }
  })

  it('derives first/last/count from the real visit rows', async () => {
    const places = await listPlaces(SITE_OWNER, SITE_OWNER)
    const tokyo = places.find(p => p.city === 'Tokyo')!
    // Seed has two Tokyo visits: 2020-01-15 and 2024-11-18.
    expect(tokyo.visitCount).toBe(2)
    expect(tokyo.firstVisit).toBe('2020-01-15')
    expect(tokyo.lastVisit).toBe('2024-11-18')
  })

  it('shows a guest nothing', async () => {
    expect(await listPlaces(SITE_OWNER, null)).toEqual([])
  })

  it('shows another signed-in user nothing (owner isolation)', async () => {
    expect(await listPlaces(SITE_OWNER, 'someone-else')).toEqual([])
  })
})

describe('addVisit', () => {
  it('creates a place and a visit, taking the coordinate from the dataset', async () => {
    const before = (await listPlaces(SITE_OWNER, SITE_OWNER)).length
    const visit = await addVisit(SITE_OWNER, { city: 'Berlin', countryCode: 'DEU', visitedOn: '2024-05-01' })
    expect(visit.placeId).toBeTruthy()

    const after = await listPlaces(SITE_OWNER, SITE_OWNER)
    const berlin = after.find(p => p.city === 'Berlin')!
    expect(after.length).toBe(before + 1)
    // Coordinate is Berlin's from the gazetteer, not anything the caller sent.
    expect(berlin.lat).toBeCloseTo(52.52, 1)
    expect(berlin.lng).toBeCloseTo(13.405, 1)
  })

  it('folds a repeat visit into the existing place instead of duplicating it', async () => {
    await addVisit(SITE_OWNER, { city: 'Berlin', countryCode: 'DEU', visitedOn: '2024-05-01' })
    await addVisit(SITE_OWNER, { city: 'Berlin', countryCode: 'DEU', visitedOn: '2024-09-01' })
    const places = await listPlaces(SITE_OWNER, SITE_OWNER)
    const berlins = places.filter(p => p.city === 'Berlin')
    expect(berlins.length).toBe(1)
    expect(berlins[0]!.visitCount).toBe(2)
    expect(berlins[0]!.firstVisit).toBe('2024-05-01')
    expect(berlins[0]!.lastVisit).toBe('2024-09-01')
  })

  it('refuses a city that does not resolve', async () => {
    await expect(addVisit(SITE_OWNER, { city: 'Nowhereville', countryCode: 'FRA', visitedOn: '2024-01-01' }))
      .rejects.toMatchObject({ status: 400 })
  })

  it("does not add another owner's visit into this owner's map", async () => {
    await addVisit('other-user', { city: 'Berlin', countryCode: 'DEU', visitedOn: '2024-05-01' })
    const ownerPlaces = await listPlaces(SITE_OWNER, SITE_OWNER)
    expect(ownerPlaces.find(p => p.city === 'Berlin')).toBeUndefined()
  })
})

describe('deleteVisit', () => {
  it('drops the place when its last visit is removed', async () => {
    const visit = await addVisit(SITE_OWNER, { city: 'Berlin', countryCode: 'DEU', visitedOn: '2024-05-01' })
    await deleteVisit(SITE_OWNER, visit.id)
    const places = await listPlaces(SITE_OWNER, SITE_OWNER)
    expect(places.find(p => p.city === 'Berlin')).toBeUndefined()
  })

  it('keeps the place while other visits remain', async () => {
    const first = await addVisit(SITE_OWNER, { city: 'Berlin', countryCode: 'DEU', visitedOn: '2024-05-01' })
    await addVisit(SITE_OWNER, { city: 'Berlin', countryCode: 'DEU', visitedOn: '2024-09-01' })
    await deleteVisit(SITE_OWNER, first.id)
    const berlin = (await listPlaces(SITE_OWNER, SITE_OWNER)).find(p => p.city === 'Berlin')!
    expect(berlin.visitCount).toBe(1)
    expect(berlin.lastVisit).toBe('2024-09-01')
  })

  it('answers 404 for a visit that is not yours, and does not delete it', async () => {
    const other = await addVisit('other-user', { city: 'Berlin', countryCode: 'DEU', visitedOn: '2024-05-01' })
    await expect(deleteVisit(SITE_OWNER, other.id)).rejects.toBeInstanceOf(ApiError)
    // Still there for its real owner.
    expect((await listPlaces('other-user', 'other-user')).find(p => p.city === 'Berlin')).toBeTruthy()
  })
})
