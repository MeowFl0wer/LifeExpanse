import { ApiError } from './client'
import { API_BASE, request, usingBackend } from './http'

/**
 * Uploads.
 *
 * The upload itself does not go through `request()` — that helper serialises
 * JSON, and a file needs `FormData` with the browser setting its own multipart
 * boundary. Everything else about it is the same: same-origin, cookie session,
 * `ApiError` on failure.
 *
 * With no backend configured, uploading returns an object URL so the editor
 * still works offline. Those URLs die with the page, which is exactly why the
 * prototype needed replacing.
 */

export interface UploadedMedia {
  id: string
  url: string
  kind: 'image' | 'video'
  mime: string
  sizeBytes: number
  visibility: 'public' | 'private'
  originalName: string
}

export interface MediaQuota {
  usedBytes: number
  quotaBytes: number
  images: number
  videos: number
  canUploadImage: boolean
  canUploadVideo: boolean
  maxImageBytes: number
  maxVideoBytes: number
}

interface WireMedia {
  id: string
  url: string
  kind: 'image' | 'video'
  mime: string
  size_bytes: number
  visibility: 'public' | 'private'
  original_name: string
}

function fromWire(w: WireMedia): UploadedMedia {
  return {
    id: w.id,
    // Prefixed so the URL works whatever base the API is mounted at.
    url: `${API_BASE}${w.url}`,
    kind: w.kind,
    mime: w.mime,
    sizeBytes: w.size_bytes,
    visibility: w.visibility,
    originalName: w.original_name,
  }
}

export interface UploadOptions {
  visibility?: 'public' | 'private'
  asAvatar?: boolean
}

export async function uploadMedia(file: File, options: UploadOptions = {}): Promise<UploadedMedia> {
  if (!usingBackend()) {
    // Object URLs do not survive a reload. The editor stays usable offline,
    // but nothing here is persisted.
    return {
      id: `local-${Date.now()}`,
      url: URL.createObjectURL(file),
      kind: file.type.startsWith('video/') ? 'video' : 'image',
      mime: file.type,
      sizeBytes: file.size,
      visibility: options.visibility ?? 'private',
      originalName: file.name,
    }
  }

  const form = new FormData()
  form.append('file', file)

  const params = new URLSearchParams()
  if (options.visibility) params.set('visibility', options.visibility)
  if (options.asAvatar) params.set('as_avatar', 'true')
  const query = params.toString()

  let response: Response
  try {
    response = await fetch(`${API_BASE}/media${query ? `?${query}` : ''}`, {
      method: 'POST',
      credentials: 'include',
      // No Content-Type header: the browser must set the multipart boundary.
      body: form,
    })
  } catch {
    throw new ApiError('无法连接到服务器，请检查网络后重试', 0)
  }

  const text = await response.text()
  const data = text ? safeParse(text) : null

  if (!response.ok) {
    const detail =
      data && typeof data === 'object' && 'detail' in data
        ? String((data as { detail: unknown }).detail)
        : `上传失败（${response.status}）`
    throw new ApiError(detail, response.status)
  }

  return fromWire(data as WireMedia)
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return null
  }
}

export async function fetchQuota(): Promise<MediaQuota> {
  if (!usingBackend()) {
    return {
      usedBytes: 0,
      quotaBytes: 2 * 1024 * 1024 * 1024,
      images: 0,
      videos: 0,
      // Offline, the editor should not pretend a permission is missing.
      canUploadImage: true,
      canUploadVideo: true,
      maxImageBytes: 10 * 1024 * 1024,
      maxVideoBytes: 200 * 1024 * 1024,
    }
  }
  const w = await request<{
    used_bytes: number; quota_bytes: number; images: number; videos: number
    can_upload_image: boolean; can_upload_video: boolean
    max_image_bytes: number; max_video_bytes: number
  }>('/media/quota')
  return {
    usedBytes: w.used_bytes,
    quotaBytes: w.quota_bytes,
    images: w.images,
    videos: w.videos,
    canUploadImage: w.can_upload_image,
    canUploadVideo: w.can_upload_video,
    maxImageBytes: w.max_image_bytes,
    maxVideoBytes: w.max_video_bytes,
  }
}

export async function listMedia(kind?: 'image' | 'video'): Promise<UploadedMedia[]> {
  if (!usingBackend()) return []
  const rows = await request<WireMedia[]>('/media', { query: kind ? { kind } : {} })
  return rows.map(fromWire)
}

export async function setMediaVisibility(
  id: string, visibility: 'public' | 'private'
): Promise<void> {
  if (!usingBackend()) return
  await request<void>(`/media/${id}`, { method: 'PATCH', query: { visibility } })
}

export async function deleteMedia(id: string): Promise<void> {
  if (!usingBackend()) return
  await request<void>(`/media/${id}`, { method: 'DELETE' })
}

/** Human-readable size, for quota displays and error messages. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}
