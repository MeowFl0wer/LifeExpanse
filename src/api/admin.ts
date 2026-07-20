import { request, usingBackend } from './http'

/**
 * The administration console's data access.
 *
 * Every one of these is re-checked server side against the admin role; the
 * frontend guard only decides what to render. With no backend configured they
 * return sample data so the page can be worked on offline.
 */

export interface SystemStatus {
  uptimeSeconds: number
  loadAverage: number[]
  cpuCount: number
  platform: string
  pythonVersion: string
  onlineUsers: number
  liveSessions: number
  totalUsers: number
  totalContents: number
  registrationMode: RegistrationMode
  serverTime: string
}

export type RegistrationMode = 'closed' | 'invite' | 'open'
export type UserSort = 'login_count' | 'last_login' | 'created'

export interface AdminUser {
  id: string
  username: string
  displayName: string
  emailMasked: string
  isActive: boolean
  totpEnabled: boolean
  canUploadImage: boolean
  canUploadVideo: boolean
  loginCount: number
  lastLoginAt: string | null
  createdAt: string
}

export interface AdminUserDetail extends AdminUser {
  backupEmailMasked: string
  emailVerified: boolean
  contentCounts: {
    total: number
    thought: number
    diary: number
    pkm: number
    public: number
  }
  mediaCounts: { images: number; videos: number; bytes: number }
}

export interface Invite {
  id: string
  code: string
  note: string
  usedBy: string | null
  usedAt: string | null
  revokedAt: string | null
  createdAt: string
  spent: boolean
}

export interface AuditEntry {
  id: number
  actor: string
  event: string
  detail: string
  createdAt: string
}

/* ---------------- wire mapping ---------------- */

interface WireUser {
  id: string
  username: string
  display_name: string
  email_masked: string
  is_active: boolean
  totp_enabled: boolean
  can_upload_image: boolean
  can_upload_video: boolean
  login_count: number
  last_login_at: string | null
  created_at: string
}

function userFromWire(w: WireUser): AdminUser {
  return {
    id: w.id,
    username: w.username,
    displayName: w.display_name,
    emailMasked: w.email_masked,
    isActive: w.is_active,
    totpEnabled: w.totp_enabled,
    canUploadImage: w.can_upload_image,
    canUploadVideo: w.can_upload_video,
    loginCount: w.login_count,
    lastLoginAt: w.last_login_at,
    createdAt: w.created_at,
  }
}

/* ---------------- sample data (no backend) ---------------- */

const sampleUsers: AdminUser[] = [
  {
    id: 'u1', username: 'euan', displayName: 'Euan',
    emailMasked: 'e***n@example.com', isActive: true, totpEnabled: true,
    canUploadImage: true, canUploadVideo: true, loginCount: 128,
    lastLoginAt: '2026-07-20T02:10:00Z', createdAt: '2023-03-15T08:00:00Z',
  },
  {
    id: 'u2', username: 'alice', displayName: 'Alice',
    emailMasked: 'a***e@example.com', isActive: true, totpEnabled: false,
    canUploadImage: true, canUploadVideo: false, loginCount: 12,
    lastLoginAt: '2026-07-18T11:42:00Z', createdAt: '2025-11-02T09:30:00Z',
  },
  {
    id: 'u3', username: 'bob', displayName: 'Bob',
    emailMasked: 'b***b@example.com', isActive: false, totpEnabled: false,
    canUploadImage: false, canUploadVideo: false, loginCount: 3,
    lastLoginAt: null, createdAt: '2026-02-14T15:05:00Z',
  },
]

let sampleMode: RegistrationMode = 'closed'
const sampleInvites: Invite[] = []

/* ---------------- endpoints ---------------- */

export async function fetchStatus(): Promise<SystemStatus> {
  if (usingBackend()) {
    const w = await request<{
      uptime_seconds: number; load_average: number[]; cpu_count: number
      platform: string; python_version: string; online_users: number
      live_sessions: number; total_users: number; total_contents: number
      registration_mode: RegistrationMode; server_time: string
    }>('/admin/status')
    return {
      uptimeSeconds: w.uptime_seconds,
      loadAverage: w.load_average,
      cpuCount: w.cpu_count,
      platform: w.platform,
      pythonVersion: w.python_version,
      onlineUsers: w.online_users,
      liveSessions: w.live_sessions,
      totalUsers: w.total_users,
      totalContents: w.total_contents,
      registrationMode: w.registration_mode,
      serverTime: w.server_time,
    }
  }
  return {
    uptimeSeconds: 86400 * 3 + 3600 * 5,
    loadAverage: [0.42, 0.38, 0.31],
    cpuCount: 4,
    platform: '示例数据（未连接后端）',
    pythonVersion: '3.12',
    onlineUsers: 1,
    liveSessions: 2,
    totalUsers: sampleUsers.length,
    totalContents: 42,
    registrationMode: sampleMode,
    serverTime: new Date().toISOString(),
  }
}

export async function fetchUsers(sort: UserSort, keyword = ''): Promise<AdminUser[]> {
  if (usingBackend()) {
    const rows = await request<WireUser[]>('/admin/users', { query: { sort, keyword } })
    return rows.map(userFromWire)
  }
  const needle = keyword.trim().toLowerCase()
  const filtered = needle
    ? sampleUsers.filter(u =>
        u.username.toLowerCase().includes(needle) || u.displayName.toLowerCase().includes(needle))
    : [...sampleUsers]
  const key = {
    login_count: (u: AdminUser) => u.loginCount,
    last_login: (u: AdminUser) => (u.lastLoginAt ? Date.parse(u.lastLoginAt) : 0),
    created: (u: AdminUser) => Date.parse(u.createdAt),
  }[sort]
  return filtered.sort((a, b) => key(b) - key(a))
}

export async function fetchUserDetail(id: string): Promise<AdminUserDetail> {
  if (usingBackend()) {
    const w = await request<WireUser & {
      backup_email_masked: string; email_verified: boolean
      content_counts: AdminUserDetail['contentCounts']
      media_counts: AdminUserDetail['mediaCounts']
    }>(`/admin/users/${id}`)
    return {
      ...userFromWire(w),
      backupEmailMasked: w.backup_email_masked,
      emailVerified: w.email_verified,
      contentCounts: w.content_counts,
      mediaCounts: w.media_counts,
    }
  }
  const base = sampleUsers.find(u => u.id === id) ?? sampleUsers[0]!
  return {
    ...base,
    backupEmailMasked: '',
    emailVerified: true,
    contentCounts: { total: 24, thought: 8, diary: 10, pkm: 6, public: 9 },
    mediaCounts: { images: 0, videos: 0, bytes: 0 },
  }
}

export async function setPermissions(
  id: string,
  changes: { canUploadImage?: boolean; canUploadVideo?: boolean; isActive?: boolean }
): Promise<void> {
  if (usingBackend()) {
    const query: Record<string, boolean> = {}
    if (changes.canUploadImage !== undefined) query.can_upload_image = changes.canUploadImage
    if (changes.canUploadVideo !== undefined) query.can_upload_video = changes.canUploadVideo
    if (changes.isActive !== undefined) query.is_active = changes.isActive
    await request<void>(`/admin/users/${id}/permissions`, { method: 'PATCH', query })
    return
  }
  const user = sampleUsers.find(u => u.id === id)
  if (!user) return
  if (changes.canUploadImage !== undefined) user.canUploadImage = changes.canUploadImage
  if (changes.canUploadVideo !== undefined) user.canUploadVideo = changes.canUploadVideo
  if (changes.isActive !== undefined) user.isActive = changes.isActive
}

export async function setRegistrationMode(mode: RegistrationMode): Promise<void> {
  if (usingBackend()) {
    await request<void>('/admin/settings/registration-mode', { method: 'PATCH', query: { mode } })
    return
  }
  sampleMode = mode
}

export async function fetchInvites(): Promise<Invite[]> {
  if (usingBackend()) {
    const rows = await request<{
      id: string; code: string; note: string; used_by: string | null
      used_at: string | null; revoked_at: string | null; created_at: string; spent: boolean
    }[]>('/admin/invites')
    return rows.map(r => ({
      id: r.id, code: r.code, note: r.note, usedBy: r.used_by,
      usedAt: r.used_at, revokedAt: r.revoked_at, createdAt: r.created_at, spent: r.spent,
    }))
  }
  return [...sampleInvites].reverse()
}

export async function createInvite(note: string): Promise<Invite> {
  if (usingBackend()) {
    const r = await request<{ id: string; code: string; note: string }>('/admin/invites', {
      method: 'POST',
      query: { note },
    })
    return {
      id: r.id, code: r.code, note: r.note, usedBy: null,
      usedAt: null, revokedAt: null, createdAt: new Date().toISOString(), spent: false,
    }
  }
  const invite: Invite = {
    id: `inv-${sampleInvites.length + 1}`,
    code: Math.random().toString(36).slice(2, 14),
    note,
    usedBy: null, usedAt: null, revokedAt: null,
    createdAt: new Date().toISOString(),
    spent: false,
  }
  sampleInvites.push(invite)
  return invite
}

export async function revokeInvite(id: string): Promise<void> {
  if (usingBackend()) {
    await request<void>(`/admin/invites/${id}`, { method: 'DELETE' })
    return
  }
  const invite = sampleInvites.find(i => i.id === id)
  if (invite) { invite.revokedAt = new Date().toISOString(); invite.spent = true }
}

export async function fetchAudit(event = '', limit = 100): Promise<AuditEntry[]> {
  if (usingBackend()) {
    const rows = await request<{
      id: number; actor: string; event: string; detail: string; created_at: string
    }[]>('/admin/audit', { query: { event, limit } })
    return rows.map(r => ({
      id: r.id, actor: r.actor, event: r.event, detail: r.detail, createdAt: r.created_at,
    }))
  }
  return [
    { id: 3, actor: 'AdminEuan', event: 'permissions_changed', detail: 'alice: can_upload_video=True', createdAt: new Date().toISOString() },
    { id: 2, actor: 'euan', event: 'login', detail: '', createdAt: new Date().toISOString() },
    { id: 1, actor: 'AdminEuan', event: 'registration_mode_changed', detail: 'open → closed', createdAt: new Date().toISOString() },
  ].filter(e => !event || e.event === event)
}
