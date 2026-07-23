import { describe, it, expect } from 'vitest'
import {
  toAlpha3, countryName, countryNameEn, numericFor, isKnownCountry, allCountries,
} from './country'

describe('normalising a country to alpha-3', () => {
  it('accepts a Chinese name', () => {
    expect(toAlpha3('中国')).toBe('CHN')
    expect(toAlpha3('日本')).toBe('JPN')
    expect(toAlpha3('韩国')).toBe('KOR')
  })

  it('accepts an English name', () => {
    expect(toAlpha3('Japan')).toBe('JPN')
    expect(toAlpha3('South Korea')).toBe('KOR')
  })

  it('accepts an alpha-3 code already', () => {
    expect(toAlpha3('KOR')).toBe('KOR')
    expect(toAlpha3('kor')).toBe('KOR')
  })

  // The exact reason the spec calls for this: one country, many spellings.
  it('collapses the many names of one country', () => {
    for (const spelling of ['韩国', '南韩', 'Korea', 'South Korea', 'KOR']) {
      expect(toAlpha3(spelling)).toBe('KOR')
    }
  })

  it('does not confuse the two Koreas', () => {
    expect(toAlpha3('北韩')).toBe('PRK')
    expect(toAlpha3('朝鲜')).toBe('PRK')
    expect(toAlpha3('韩国')).toBe('KOR')
  })

  it('handles common aliases', () => {
    expect(toAlpha3('USA')).toBe('USA')
    expect(toAlpha3('America')).toBe('USA')
    expect(toAlpha3('UK')).toBe('GBR')
    expect(toAlpha3('英国')).toBe('GBR')
    expect(toAlpha3('香港')).toBe('HKG')
  })

  it('ignores surrounding whitespace and case', () => {
    expect(toAlpha3('  japan  ')).toBe('JPN')
    expect(toAlpha3('JaPaN')).toBe('JPN')
  })

  // Guessing a country from an unrecognised string would pin a wrong flag on
  // the map, so it returns null and the caller surfaces the raw input.
  it('returns null rather than guessing', () => {
    expect(toAlpha3('Neverland')).toBeNull()
    expect(toAlpha3('随便写的')).toBeNull()
    expect(toAlpha3('')).toBeNull()
    expect(toAlpha3('   ')).toBeNull()
  })
})

describe('display names', () => {
  it('gives the Chinese name for a code', () => {
    expect(countryName('CHN')).toBe('中国')
    expect(countryName('kor')).toBe('韩国')
  })

  it('gives the English name for a code', () => {
    expect(countryNameEn('JPN')).toBe('Japan')
  })

  it('falls back to the code when unknown', () => {
    expect(countryName('ZZZ')).toBe('ZZZ')
  })
})

describe('numeric code for the map', () => {
  // world-atlas indexes geometries by numeric, so this bridge must be right.
  it('maps alpha-3 to the ISO numeric', () => {
    expect(numericFor('CHN')).toBe('156')
    expect(numericFor('KOR')).toBe('410')
    expect(numericFor('USA')).toBe('840')
  })

  it('returns null for an unknown code', () => {
    expect(numericFor('ZZZ')).toBeNull()
  })

  // A round trip a normalised value must survive: name → alpha-3 → numeric.
  it('round-trips from a typed name to a map numeric', () => {
    const alpha3 = toAlpha3('日本')!
    expect(numericFor(alpha3)).toBe('392')
  })
})

describe('membership and listing', () => {
  it('knows a real code from a fake one', () => {
    expect(isKnownCountry('FRA')).toBe(true)
    expect(isKnownCountry('ZZZ')).toBe(false)
  })

  it('lists every country for a picker', () => {
    const all = allCountries()
    expect(all.length).toBeGreaterThan(240)
    expect(all.every(c => c.alpha3.length === 3)).toBe(true)
    expect(all.find(c => c.alpha3 === 'CHN')?.info.zh).toBe('中国')
  })
})
