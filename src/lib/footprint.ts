export interface MatchableCity {
  city: string
  country: string
}

export type FootprintMatch<T> =
  | { kind: 'merge'; target: T }
  | { kind: 'create' }
  /** Same city name exists in several countries and none was supplied. */
  | { kind: 'ambiguous' }

/**
 * Decides whether a recorded visit folds into an existing city.
 *
 * Cities are identified by name *and* country so同名 cities in different
 * countries stay separate. When no country is given and the name is not unique,
 * the result is `ambiguous`: the caller must hold the entry for confirmation
 * rather than guessing which city was meant.
 */
export function matchFootprint<T extends MatchableCity>(
  cities: readonly T[],
  city: string,
  country: string
): FootprintMatch<T> {
  const name = city.trim()
  const land = country.trim()
  if (!name) return { kind: 'create' }

  const sameName = cities.filter(c => c.city === name)

  if (land) {
    const exact = sameName.find(c => c.country === land)
    return exact ? { kind: 'merge', target: exact } : { kind: 'create' }
  }

  if (sameName.length === 1) return { kind: 'merge', target: sameName[0]! }
  if (sameName.length > 1) return { kind: 'ambiguous' }
  return { kind: 'create' }
}
