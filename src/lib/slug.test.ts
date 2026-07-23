import { describe, it, expect } from 'vitest'
import { MAX_SLUG_LENGTH, slugify, uniqueSlug } from './slug'

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

describe('slug length is capped', () => {
  // A title is user input; an uncapped slug flows straight into a URL and a
  // fixed-width database column (the backend slug column is String(200)).
  it('caps a very long title', () => {
    const slug = slugify('a'.repeat(500))
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH)
  })

  it('leaves room for the uniqueness suffix inside the column', () => {
    const base = slugify('word '.repeat(100))
    const taken = [base]
    const unique = uniqueSlug(base, taken)
    // base + "-2" must still fit the 200-char column.
    expect(unique.length).toBeLessThanOrEqual(200)
    expect(unique).not.toBe(base)
  })

  it('cuts on a word boundary rather than mid-word', () => {
    const slug = slugify(`${'ab-'.repeat(200)}`)
    expect(slug.endsWith('-')).toBe(false)
    expect(slug.length).toBeLessThanOrEqual(MAX_SLUG_LENGTH)
  })

  it('does not cut a short slug', () => {
    expect(slugify('My First Post')).toBe('my-first-post')
  })

  it('caps a raw base passed straight to uniqueSlug', () => {
    const raw = 'x'.repeat(500)
    expect(uniqueSlug(raw, []).length).toBeLessThanOrEqual(MAX_SLUG_LENGTH)
  })
})
