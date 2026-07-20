import { describe, it, expect } from 'vitest'
import { maskEmail } from './mask'

describe('maskEmail', () => {
  it('keeps the first and last character of the local part', () => {
    expect(maskEmail('acai201812@gmail.com')).toBe('a***2@gmail.com')
  })

  it('keeps the domain intact so you can tell your addresses apart', () => {
    expect(maskEmail('euan@example.co.uk')).toBe('e***n@example.co.uk')
  })

  // A variable-width mask would give away the address length.
  it('uses a fixed-width mask regardless of how much is hidden', () => {
    const short = maskEmail('abcd@x.com')
    const long = maskEmail('abcdefghijklmnop@x.com')
    expect(short).toBe('a***d@x.com')
    expect(long).toBe('a***p@x.com')
  })

  it('masks a two-character local part without revealing both', () => {
    expect(maskEmail('ab@x.com')).toBe('a*@x.com')
  })

  it('masks a one-character local part entirely', () => {
    expect(maskEmail('a@x.com')).toBe('*@x.com')
  })

  it('masks the whole string when there is no domain', () => {
    expect(maskEmail('notanemail')).toBe('n***l')
  })

  // An empty local part is malformed: masking it would keep the '@' and the
  // domain tail visible while hiding nothing.
  it('hides everything when the local part is empty', () => {
    expect(maskEmail('@x.com')).toBe('***')
  })

  it('splits on the last @, so a local part containing one is still masked', () => {
    expect(maskEmail('a@b@x.com')).toBe('a***b@x.com')
  })

  it('returns an empty string for empty or blank input', () => {
    expect(maskEmail('')).toBe('')
    expect(maskEmail('   ')).toBe('')
  })

  it('ignores surrounding whitespace', () => {
    expect(maskEmail('  euan@x.com  ')).toBe('e***n@x.com')
  })
})
