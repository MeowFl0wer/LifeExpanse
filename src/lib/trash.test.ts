import { describe, it, expect } from 'vitest'
import { daysRemaining, isExpired, retentionLabel, TRASH_RETENTION_DAYS } from './trash'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2024-11-20T12:00:00Z').getTime()

function daysAgo(n: number): string {
  return new Date(NOW - n * DAY).toISOString()
}

describe('daysRemaining', () => {
  it('gives the full window for something just deleted', () => {
    expect(daysRemaining(daysAgo(0), NOW)).toBe(TRASH_RETENTION_DAYS)
  })

  it('counts down as time passes', () => {
    expect(daysRemaining(daysAgo(1), NOW)).toBe(29)
    expect(daysRemaining(daysAgo(29), NOW)).toBe(1)
  })

  it('never goes negative', () => {
    expect(daysRemaining(daysAgo(40), NOW)).toBe(0)
  })

  it('returns 0 for an unparseable timestamp', () => {
    expect(daysRemaining('not-a-date', NOW)).toBe(0)
  })

  it('honours a custom retention window', () => {
    expect(daysRemaining(daysAgo(2), NOW, 7)).toBe(5)
  })
})

describe('isExpired', () => {
  it('is false inside the window', () => {
    expect(isExpired(daysAgo(0), NOW)).toBe(false)
    expect(isExpired(daysAgo(29), NOW)).toBe(false)
  })

  it('is true at and past the boundary', () => {
    expect(isExpired(daysAgo(30), NOW)).toBe(true)
    expect(isExpired(daysAgo(31), NOW)).toBe(true)
  })

  // Better to purge something with a broken timestamp than keep it forever.
  it('treats an unparseable timestamp as expired', () => {
    expect(isExpired('nonsense', NOW)).toBe(true)
  })
})

describe('retentionLabel', () => {
  it('describes a fresh deletion', () => {
    expect(retentionLabel(daysAgo(0), NOW)).toBe('30 天后清理')
  })

  it('warns on the last day', () => {
    expect(retentionLabel(daysAgo(29), NOW)).toBe('今天到期')
  })

  it('marks expired items', () => {
    expect(retentionLabel(daysAgo(30), NOW)).toBe('即将被清理')
  })
})
