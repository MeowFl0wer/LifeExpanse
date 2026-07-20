/**
 * Masks the middle of an email for display.
 *
 * The mask is a fixed three asterisks regardless of how long the hidden part
 * is — a variable-width mask would leak the address length, which is exactly
 * the kind of detail this is meant to withhold.
 *
 * The domain is left intact: it is not sensitive on its own, and seeing it is
 * what lets you recognise which of your addresses this is.
 */
export function maskEmail(email: string): string {
  const trimmed = email.trim()
  if (!trimmed) return ''

  const at = trimmed.lastIndexOf('@')
  // No '@' at all: not an address, so mask it as a plain string.
  if (at < 0) return maskLocal(trimmed)
  // An empty local part is malformed. Masking it would keep the '@' and the
  // domain tail visible while hiding nothing, so hide the lot instead.
  if (at === 0) return '***'

  return `${maskLocal(trimmed.slice(0, at))}@${trimmed.slice(at + 1)}`
}

function maskLocal(local: string): string {
  if (local.length === 1) return '*'
  if (local.length === 2) return `${local[0]}*`
  return `${local[0]}***${local[local.length - 1]}`
}
