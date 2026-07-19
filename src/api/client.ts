/**
 * Transport shim for the data layer.
 *
 * Every api/* function returns a Promise even though the current
 * implementation reads an in-memory store. That keeps call sites written for a
 * real backend — loading states, error handling, awaited mutations — so
 * swapping the body of these modules for `fetch` does not touch components.
 */

/** Simulated latency, so loading states are exercised during development. */
const LATENCY_MS = 0

export async function ok<T>(value: T): Promise<T> {
  if (LATENCY_MS > 0) await new Promise(r => setTimeout(r, LATENCY_MS))
  // Structured clone would be closer to a network boundary, but the mock store
  // hands out live object references that the UI mutates in place today.
  return value
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number = 400
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function fail(message: string, status = 400): Promise<never> {
  if (LATENCY_MS > 0) await new Promise(r => setTimeout(r, LATENCY_MS))
  throw new ApiError(message, status)
}
