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
