import { describe, it, expect } from 'vitest'
import { downloadUrl, isManagedMedia, thumbnailUrl } from './mediaUrl'

const managed = '/api/v1/media/abcdefgh12345678'

describe('managed media detection', () => {
  it('recognises our own media URLs', () => {
    expect(isManagedMedia(managed)).toBe(true)
    expect(isManagedMedia(`https://life.example.com${managed}`)).toBe(true)
  })

  it('does not claim external images', () => {
    expect(isManagedMedia('https://example.com/photo.png')).toBe(false)
    expect(isManagedMedia('blob:http://localhost/abc')).toBe(false)
  })

  // A URL that already carries a variant must not have a second one appended.
  it('does not match a URL that already has a query', () => {
    expect(isManagedMedia(`${managed}?variant=thumb`)).toBe(false)
  })
})

describe('variants', () => {
  it('points display at the thumbnail', () => {
    expect(thumbnailUrl(managed)).toBe(`${managed}?variant=thumb`)
  })

  it('leaves an external image alone — there is no thumbnail to ask for', () => {
    const external = 'https://example.com/photo.png'
    expect(thumbnailUrl(external)).toBe(external)
    expect(downloadUrl(external)).toBe(external)
  })

  it('builds a download URL', () => {
    expect(downloadUrl(managed)).toBe(`${managed}?download=true`)
  })
})
