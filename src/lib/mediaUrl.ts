/**
 * URLs for a managed upload.
 *
 * Only files served by our own `/api/v1/media/{id}` route have variants. An
 * external image has no thumbnail to fall back on, and offering a download
 * button for somebody else's host would be misleading — so those are left
 * exactly as written.
 */

const MANAGED = /\/api\/v1\/media\/[A-Za-z0-9_-]{8,64}$/

export function isManagedMedia(src: string): boolean {
  return MANAGED.test(src)
}

/** What gets displayed. Falls back to the original for anything external. */
export function thumbnailUrl(src: string): string {
  return isManagedMedia(src) ? `${src}?variant=thumb` : src
}

/** Forces a download rather than opening in the tab. */
export function downloadUrl(src: string): string {
  return isManagedMedia(src) ? `${src}?download=true` : src
}
