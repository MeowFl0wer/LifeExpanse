export type Visibility = 'public' | 'private' | 'draft'

export type ContentType = 'thought' | 'diary' | 'pkm'
export type ContentKind = 'note' | 'article'
export type ThoughtType = 'original' | 'excerpt'
export type ThoughtSourceType = 'book' | 'article' | 'video' | 'podcast' | 'speech' | 'webpage' | 'other'

export interface Tag {
  id: string
  name: string
}

export interface ContentItem {
  id: string
  slug: string
  type: ContentType
  contentKind?: ContentKind
  thoughtType?: ThoughtType
  title: string
  body: string
  summary: string
  visibility: Visibility
  tags: Tag[]
  createdAt: string
  updatedAt: string
  publishedAt: string
  author: string
  folder?: string
  category?: string
  series?: string
  cover?: string
  seoTitle?: string
  seoDescription?: string
  allowComments?: boolean
  favorite?: boolean
  archived?: boolean
  sourceAuthor?: string
  sourceTitle?: string
  sourceType?: ThoughtSourceType
  sourceUrl?: string
  sourceLocator?: string
  personalNote?: string
}

export interface Thought {
  id: string
  text: string
  thoughtType: ThoughtType
  sourceAuthor?: string
  sourceTitle?: string
  sourceType?: ThoughtSourceType
  sourceUrl?: string
  sourceLocator?: string
  personalNote?: string
  tags: Tag[]
  visibility: Visibility
  createdAt: string
}

export interface TrajectoryEntry {
  id: string
  date: string
  city: string
  country: string
  summary: string
  tags: Tag[]
  diarySlug?: string
  batchId?: string
}

export interface FootprintCity {
  id: string
  city: string
  country: string
  lat: number
  lng: number
  firstVisit: string
  lastVisit: string
  visitCount: number
  pending?: boolean
  note?: string
}

export type FlightStatus = 'normal' | 'delayed' | 'cancelled'

export interface FlightRecord {
  id: string
  date: string
  airline: string
  flightNo: string
  from: string
  to: string
  distance: number
  durationMinutes: number
  status: FlightStatus
}

export interface Airport {
  iata: string
  name: string
  city: string
  country: string
  lat: number
  lng: number
}

export interface UserProfile {
  username: string
  displayName: string
  bio: string
  avatar: string
  publicSince: string
}

export interface SiteStats {
  launchedAt: string
  totalPV: number
  totalUV: number
}

/* ---- Ch 15: encrypted interactive spaces ---- */

export interface EncryptedSpace {
  id: string
  /** Opaque, unguessable key used in the URL; never exposes the space name. */
  spaceKey: string
  owner: string
  name: string
  description: string
  welcome: string
  /** Prototype only. A real backend stores an HMAC fingerprint + Argon2id hash. */
  password: string
  sessionTtlMinutes: number
  allowReplies: boolean
  allowAnonymousReplies: boolean
  showReplyNickname: boolean
  showPostCount: boolean
  isActive: boolean
  createdAt: string
}

export interface SpacePost {
  id: string
  spaceId: string
  title: string
  body: string
  summary: string
  cover?: string
  createdAt: string
}

export interface SpaceReply {
  id: string
  spaceId: string
  postId: string
  nickname?: string
  content: string
  isAuthor: boolean
  hidden?: boolean
  createdAt: string
}

/* ---- Ch 11: article comments ---- */

export interface ArticleComment {
  id: string
  contentId: string
  author: string
  authorDisplayName: string
  body: string
  hidden?: boolean
  createdAt: string
}

/* ---- Ch 4.4 / 21: account security and admin console ---- */

export interface DeviceSession {
  id: string
  device: string
  location: string
  lastActive: string
  current: boolean
}

export interface AdminAccessRecord {
  id: string
  admin: string
  reason: string
  ticket: string
  scope: string
  occurredAt: string
  notifiedUser: boolean
}

export type RegistrationMode = 'closed' | 'invite' | 'open'

export interface AdminUserRow {
  id: string
  username: string
  displayName: string
  email: string
  status: 'active' | 'suspended'
  contentCount: number
  storageUsedMb: number
  storageLimitMb: number
  spaceLimit: number
  spacesUsed: number
  joinedAt: string
}

export interface InvitationCode {
  id: string
  code: string
  createdAt: string
  usedBy?: string
  expiresAt: string
}

export interface SecurityLogEntry {
  id: string
  event: string
  actor: string
  ip: string
  occurredAt: string
  level: 'info' | 'warning'
}
