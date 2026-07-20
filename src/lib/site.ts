/**
 * Who this site belongs to.
 *
 * The spec (§1) is "one person first, multi-user later". Until then the public
 * pages — homepage, search, About — show this account's content, and the
 * backend's `/content` endpoint requires an author to scope by.
 *
 * Named rather than written as a bare `'euan'` in a dozen places, so the day
 * this stops being a constant there is one thing to change.
 */
export const SITE_OWNER = 'euan'
