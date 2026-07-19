import { describe, it, expect } from 'vitest'
import { safeNextPath, loginUrlFor } from './redirect'

describe('safeNextPath', () => {
  it('accepts an in-site path', () => {
    expect(safeNextPath('/new/note')).toBe('/new/note')
  })

  it('keeps a query string', () => {
    expect(safeNextPath('/euan/pkm?folder=fd1')).toBe('/euan/pkm?folder=fd1')
  })

  it('falls back when absent', () => {
    expect(safeNextPath(null)).toBe('/app')
    expect(safeNextPath('')).toBe('/app')
  })

  it('rejects an absolute URL', () => {
    expect(safeNextPath('https://evil.example')).toBe('/app')
  })

  // These start with "/" and would pass a naive check, but leave the origin.
  it('rejects protocol-relative targets', () => {
    expect(safeNextPath('//evil.example')).toBe('/app')
    expect(safeNextPath('/\\evil.example')).toBe('/app')
  })

  it('rejects a redirect back to login or register', () => {
    expect(safeNextPath('/login')).toBe('/app')
    expect(safeNextPath('/login?next=%2Flogin')).toBe('/app')
    expect(safeNextPath('/register')).toBe('/app')
    expect(safeNextPath('/logout')).toBe('/app')
  })

  it('does not reject a path that merely starts with the same letters', () => {
    expect(safeNextPath('/loginhelp')).toBe('/loginhelp')
  })

  it('rejects embedded control characters', () => {
    expect(safeNextPath('/new\nnote')).toBe('/app')
    expect(safeNextPath('/new note')).toBe('/app')
  })

  it('honours a custom fallback', () => {
    expect(safeNextPath(null, '/')).toBe('/')
  })
})

describe('loginUrlFor', () => {
  it('encodes the return target', () => {
    expect(loginUrlFor('/new/note')).toBe('/login?next=%2Fnew%2Fnote')
  })

  it('keeps query strings in the target', () => {
    expect(loginUrlFor('/euan/pkm?folder=fd1')).toBe('/login?next=%2Feuan%2Fpkm%3Ffolder%3Dfd1')
  })

  it('omits next when the origin is not worth returning to', () => {
    expect(loginUrlFor('/login')).toBe('/login')
  })
})
