import { describe, it, expect } from 'vitest'
import { matchFootprint } from './footprint'

const cities = [
  { city: '北京', country: '中国' },
  { city: '伦敦', country: '英国' },
  { city: '剑桥', country: '英国' },
  { city: '剑桥', country: '美国' },
]

describe('matchFootprint', () => {
  it('merges when city and country both match', () => {
    const result = matchFootprint(cities, '北京', '中国')
    expect(result).toEqual({ kind: 'merge', target: { city: '北京', country: '中国' } })
  })

  it('creates a new entry for the same name in a different country', () => {
    expect(matchFootprint(cities, '伦敦', '加拿大')).toEqual({ kind: 'create' })
  })

  it('merges on a unique city name when no country is given', () => {
    const result = matchFootprint(cities, '北京', '')
    expect(result).toEqual({ kind: 'merge', target: { city: '北京', country: '中国' } })
  })

  it('reports ambiguity for a duplicated name with no country', () => {
    expect(matchFootprint(cities, '剑桥', '')).toEqual({ kind: 'ambiguous' })
  })

  it('still disambiguates a duplicated name when the country is given', () => {
    const result = matchFootprint(cities, '剑桥', '英国')
    expect(result).toEqual({ kind: 'merge', target: { city: '剑桥', country: '英国' } })
  })

  it('creates for an unseen city', () => {
    expect(matchFootprint(cities, '大阪', '日本')).toEqual({ kind: 'create' })
  })

  it('ignores surrounding whitespace', () => {
    const result = matchFootprint(cities, '  北京  ', '  中国  ')
    expect(result).toEqual({ kind: 'merge', target: { city: '北京', country: '中国' } })
  })

  it('creates rather than throwing on an empty city name', () => {
    expect(matchFootprint(cities, '   ', '中国')).toEqual({ kind: 'create' })
  })
})
