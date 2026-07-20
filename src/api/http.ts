import { ApiError } from './client'

/**
 * HTTP transport for the backend.
 *
 * Enabled by setting `VITE_API_BASE` (e.g. `/api/v1`). When it is unset the
 * app keeps using the in-memory store, so `pnpm dev` and the test suite run
 * without a server. That switch is what lets the backend land without every
 * page and test changing on the same day.
 */

export const API_BASE: string = import.meta.env.VITE_API_BASE ?? ''

export function usingBackend(): boolean {
  return API_BASE !== ''
}

interface RequestOptions {
  method?: string
  body?: unknown
  query?: Record<string, string | number | boolean | string[] | undefined>
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = `${API_BASE}${path}`
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue
    if (Array.isArray(value)) value.forEach(v => params.append(key, v))
    else params.append(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? 'GET',
      // The session is an HttpOnly cookie, so it must ride along.
      credentials: 'include',
      headers: options.body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    })
  } catch {
    // A dropped connection is not a 4xx; say so rather than showing "not found".
    throw new ApiError('无法连接到服务器，请检查网络后重试', 0)
  }

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const data = text ? safeParse(text) : null

  if (!response.ok) {
    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : `请求失败（${response.status}）`
    throw new ApiError(detail, response.status)
  }

  return data as T
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}
