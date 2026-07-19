import { describe, it, expect } from 'vitest'
import { slugify, uniqueSlug } from './slug'

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Hello World')).toBe('hello-world')
  })

  it('collapses punctuation runs and trims edge hyphens', () => {
    expect(slugify('  Why I built --- this!  ')).toBe('why-i-built-this')
  })

  it('falls back when the title has no ASCII content', () => {
    expect(slugify('为什么我要自己做一个记录平台', 'entry-123')).toBe('entry-123')
  })

  it('keeps digits', () => {
    expect(slugify('React 18 notes')).toBe('react-18-notes')
  })
})

describe('uniqueSlug', () => {
  it('returns the base when it is free', () => {
    expect(uniqueSlug('test', ['other'])).toBe('test')
  })

  it('appends a counter on collision', () => {
    expect(uniqueSlug('test', ['test'])).toBe('test-2')
  })

  it('skips over existing counters', () => {
    expect(uniqueSlug('test', ['test', 'test-2', 'test-3'])).toBe('test-4')
  })

  it('does not treat a partial match as a collision', () => {
    expect(uniqueSlug('test', ['testing', 'test-post'])).toBe('test')
  })

  it('two saves with the same title get different slugs', () => {
    const taken: string[] = ['demo-note']
    const first = uniqueSlug(slugify('test'), taken)
    taken.push(first)
    const second = uniqueSlug(slugify('test'), taken)

    expect(first).toBe('test')
    expect(second).toBe('test-2')
    expect(first).not.toBe(second)
  })
})
