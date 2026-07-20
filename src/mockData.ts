import type {
  ContentItem, Thought, TrajectoryEntry, FootprintCity, FlightRecord, Airport, UserProfile, SiteStats,
  EncryptedSpace, SpacePost, SpaceReply, ArticleComment, DeviceSession, AdminAccessRecord,
  AdminUserRow, InvitationCode, SecurityLogEntry, RegistrationMode, Folder, Series,
} from './types'
import { matchFootprint } from './lib/footprint'
import { isExpired } from './lib/trash'
import { uniqueSlug } from './lib/slug'

export const euanProfile: UserProfile = {
  username: 'euan',
  displayName: 'Euan',
  bio: '',
  avatar: '/brand/euan-avatar.jpg',
  publicSince: '2023-03-15',
  // Shown masked; the full address is only ever revealed in the settings form.
  email: 'euan@example.com',
  backupEmail: '',
}

export const siteStats: SiteStats = {
  launchedAt: '2023-03-15T08:00:00Z',
  totalPV: 14382,
  totalUV: 3217,
}

const recentThoughts: Thought[] = [
  {
    id: 'q1',
    text: '旅行的意义不是到达某处，而是在途中保持清醒。',
    thoughtType: 'original',
    personalNote: '东京转机时写下的短句。',
    tags: [{ id: 't1', name: '旅行' }, { id: 't2', name: '随想' }],
    visibility: 'public',
    createdAt: '2024-11-20T14:32:00Z',
  },
  {
    id: 'q2',
    text: 'The best code is no code at all. The second best is code that reads like prose.',
    thoughtType: 'excerpt',
    sourceAuthor: 'Anonymous',
    sourceTitle: 'Engineering Notes',
    sourceType: 'article',
    sourceUrl: 'https://example.com/engineering-notes',
    sourceLocator: 'chapter 2',
    personalNote: '提醒自己不要把复杂性当成能力。',
    tags: [{ id: 't3', name: '技术' }, { id: 't4', name: '编程' }],
    visibility: 'public',
    createdAt: '2024-11-15T09:10:00Z',
  },
  {
    id: 'q3',
    text: '深夜的城市有种特别的诚实，它不假装白天那样繁忙和有意义。',
    thoughtType: 'original',
    tags: [{ id: 't5', name: '城市' }, { id: 't2', name: '随想' }],
    visibility: 'public',
    createdAt: '2024-11-08T23:45:00Z',
  },
]

const recentDiary: ContentItem[] = [
  {
    id: 'd1',
    slug: 'demo-diary',
    type: 'diary',
    title: '东京转机，三个小时的候机室',
    body: `## 候机室里的时间

成田机场 T2 的候机室。凌晨两点半，大多数人都在睡觉。

窗外是停机坪上的几架飞机，机身反着橘黄色的灯光。这个时候的机场有种特别的安静——不是空旷的安静，是被人填满但人都不说话的那种。

我打开电脑想写点东西，发现自己什么都不想写。就这样坐着，看着外面的飞机，想起这趟出发的理由，想起几年前第一次到这个机场时的心情。

> 有些地方你会反复经过，每次都不是同一个人。

三个小时后登机。目的地是伦敦。`,
    summary: '候机室里的无所事事，以及关于反复经过同一个地方的想法。',
    visibility: 'public',
    tags: [{ id: 't1', name: '旅行' }, { id: 't6', name: '东京' }, { id: 't7', name: '日记' }],
    createdAt: '2024-11-18T02:30:00Z',
    updatedAt: '2024-11-18T03:15:00Z',
    publishedAt: '2024-11-18T03:15:00Z',
    author: 'euan',
  },
  {
    id: 'd2',
    slug: 'rainy-afternoon-notes',
    type: 'diary',
    title: '雨天，在家整理代码',
    body: `今天雨很大，哪里也没有去。

把积压了两周的代码重构了一遍，主要是把那个状态管理的逻辑剥离出去，写成了独立的 hook。写完感觉整个人都干净了不少。

下午煮了一锅咖啡，窗外雨声很好听。`,
    summary: '雨天在家重构代码，窗外雨声很好听。',
    visibility: 'public',
    tags: [{ id: 't3', name: '技术' }, { id: 't7', name: '日记' }],
    createdAt: '2024-11-12T15:00:00Z',
    updatedAt: '2024-11-12T16:20:00Z',
    publishedAt: '2024-11-12T16:20:00Z',
    author: 'euan',
  },
]

const recentNotes: ContentItem[] = [
  {
    id: 'n1',
    slug: 'demo-note',
    type: 'pkm',
    contentKind: 'note',
    title: 'React 中的并发模式：一些实践记录',
    body: `# React 中的并发模式

React 18 引入的并发特性改变了我对状态更新的理解方式。

## startTransition

\`startTransition\` 允许你将某些更新标记为非紧急：

\`\`\`tsx
import { startTransition } from 'react'

function SearchInput() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])

  function handleChange(e) {
    // 紧急：更新输入框值
    setQuery(e.target.value)

    // 非紧急：更新搜索结果
    startTransition(() => {
      setResults(search(e.target.value))
    })
  }
}
\`\`\`

> 关键在于：React 可以中断非紧急更新，优先响应用户输入。

## useDeferredValue

另一个有用的 hook：

\`\`\`tsx
const deferredQuery = useDeferredValue(query)
\`\`\`

这在处理大型列表过滤时特别有效。

## 实际体验

在一个包含 5000 条记录的列表中，加入并发特性后，输入延迟从 200ms 降到了几乎感知不到的水平。

---

附一个参考视频：

[![React Conf 2021 - What is Concurrent React?](https://img.youtube.com/vi/FZ0cG47msEk/maxresdefault.jpg)](https://www.youtube.com/watch?v=FZ0cG47msEk)

外部链接：[React 官方文档 - Concurrent Features](https://react.dev/blog/2022/03/29/react-v18)`,
    summary: 'React 18 并发特性的实践笔记，包括 startTransition 和 useDeferredValue 的使用场景。',
    visibility: 'public',
    tags: [{ id: 't3', name: '技术' }, { id: 't8', name: 'React' }, { id: 't9', name: '前端' }],
    createdAt: '2024-11-10T20:00:00Z',
    updatedAt: '2024-11-11T09:30:00Z',
    publishedAt: '2024-11-11T09:30:00Z',
    author: 'euan',
    folderIds: ['fd1'],
    favorite: true,
    archived: false,
    allowComments: false,
  },
  {
    id: 'n2',
    slug: 'ssh-config-tips',
    type: 'pkm',
    contentKind: 'note',
    title: 'SSH Config 常用配置备忘',
    body: `# SSH Config 常用配置

记录一些常用的 ssh config 写法，避免每次都要查文档。

## 基础结构

\`\`\`
Host myserver
  HostName 192.168.1.100
  User ubuntu
  Port 22
  IdentityFile ~/.ssh/id_ed25519
\`\`\`

## 跳板机配置

\`\`\`
Host internal
  HostName 10.0.0.5
  User dev
  ProxyJump bastion
\`\`\``,
    summary: 'SSH Config 配置文件常用写法备忘，包括跳板机配置。',
    visibility: 'public',
    tags: [{ id: 't3', name: '技术' }, { id: 't10', name: 'Linux' }, { id: 't11', name: '运维' }],
    createdAt: '2024-10-28T11:00:00Z',
    updatedAt: '2024-10-28T11:45:00Z',
    publishedAt: '2024-10-28T11:45:00Z',
    author: 'euan',
    folderIds: ['fd2'],
    favorite: false,
    archived: false,
    allowComments: false,
  },
  {
    id: 'n3',
    slug: 'private-note-draft',
    type: 'pkm',
    contentKind: 'note',
    title: '待整理的想法（草稿）',
    body: `这里有一些还没成形的想法...`,
    summary: '一些未完成的思考片段。',
    visibility: 'draft',
    tags: [{ id: 't2', name: '随想' }],
    createdAt: '2024-11-19T22:00:00Z',
    updatedAt: '2024-11-19T22:10:00Z',
    publishedAt: '',
    author: 'euan',
    folderIds: ['fd3'],
    favorite: false,
    archived: false,
    allowComments: false,
  },
]

const recentBlog: ContentItem[] = [
  {
    id: 'b1',
    slug: 'building-personal-platform',
    type: 'pkm',
    contentKind: 'article',
    title: '为什么我要自己做一个记录平台',
    body: `# 为什么我要自己做一个记录平台

过去几年我用过很多工具：Notion、Obsidian、Logseq、Bear、Day One……每个都有它的优点，但没有一个真正解决我的核心问题。

## 核心问题是什么

1. **数据主权**：我的文字存在哪里，谁能看到？
2. **公开与私密的边界**：有些内容我想公开，有些只给特定的人，有些只给自己。
3. **长期可用性**：这个工具五年后还在吗？

## 所以我决定自己做

这不是一个典型的工程师决策——「自己做肯定比现有工具好」。恰恰相反，我完全清楚自己做会带来什么麻烦：维护成本、功能缺失、各种小 bug。

但对我来说，这是一个「我愿意承担这些代价」的决定。

> 拥有一个不完美但完全属于自己的空间，胜过使用一个完美但随时可能消失的工具。

## 技术选型

后端用 FastAPI，数据库用 SQLite（个人版本完全够用），前端用 React + Vite + Tailwind。

部署在一台 VPS 上，用 Docker Compose 管理。`,
    summary: '关于为什么要自己搭建个人记录平台的思考——数据主权、公私边界和长期可用性。',
    visibility: 'public',
    tags: [{ id: 't3', name: '技术' }, { id: 't12', name: '产品' }, { id: 't13', name: '个人项目' }],
    createdAt: '2024-11-05T10:00:00Z',
    updatedAt: '2024-11-06T14:30:00Z',
    publishedAt: '2024-11-06T14:30:00Z',
    author: 'euan',
    category: '产品与工程',
    seriesIds: ['sr1'],
    cover: '/brand/hero-lifeexpanse-desktop.png',
    seoTitle: '为什么我要自己做一个记录平台 - LifeExpanse',
    seoDescription: '关于数据主权、公私边界和长期可用性的个人记录平台思考。',
    allowComments: true,
    favorite: true,
    archived: false,
  },
]

/* ---- Library: series > folder > note ---- */

export const series: Series[] = [
  {
    id: 'sr1', owner: 'euan', name: 'LifeExpanse 构建札记',
    description: '从需求到实现，记录这个平台是怎么一步步搭起来的。',
    createdAt: '2024-11-01T00:00:00Z',
  },
  {
    id: 'sr2', owner: 'euan', name: '工程笔记',
    description: '平时攒下来的技术备忘。',
    createdAt: '2024-09-01T00:00:00Z',
  },
]

export const folders: Folder[] = [
  {
    id: 'fd1', owner: 'euan', name: '前端 / React',
    description: 'React 相关的实践与踩坑。',
    seriesIds: ['sr2'],
    createdAt: '2024-10-01T00:00:00Z',
  },
  {
    id: 'fd2', owner: 'euan', name: '系统 / Linux',
    description: '服务器和命令行备忘。',
    seriesIds: ['sr2'],
    createdAt: '2024-10-05T00:00:00Z',
  },
  {
    id: 'fd3', owner: 'euan', name: 'Inbox',
    description: '还没归类的东西。',
    createdAt: '2024-01-01T00:00:00Z',
  },
]

export function addFolder(folder: Folder): void {
  folders.push(folder)
}

export function addSeries(entry: Series): void {
  series.push(entry)
}

export function updateFolder(id: string, patch: Partial<Folder>): void {
  const target = folders.find(f => f.id === id)
  if (target) Object.assign(target, patch)
}

export function updateSeries(id: string, patch: Partial<Series>): void {
  const target = series.find(s => s.id === id)
  if (target) Object.assign(target, patch)
}

/* ---- Recycle bin (PRD 25.2) ----
 *
 * Deleted items move out of `allContent` into a separate store rather than
 * being flagged in place. Every list, search and detail lookup reads
 * `allContent`, so nothing can accidentally keep showing a deleted item
 * because one query forgot to filter on a flag.
 */

export interface TrashEntry {
  item: ContentItem
  deletedAt: string
}

export const trashedItems: TrashEntry[] = []

/** Soft delete: recoverable until the retention window closes. */
export function deleteContentItem(id: string): void {
  const index = allContent.findIndex(c => c.id === id)
  if (index < 0) return
  const [item] = allContent.splice(index, 1)
  trashedItems.push({ item: item!, deletedAt: new Date().toISOString() })
}

/**
 * Puts an item back. If its slug was taken while it sat in the bin, it is
 * given a fresh one so the restore cannot collide with live content.
 */
export function restoreContentItem(id: string): ContentItem | undefined {
  const index = trashedItems.findIndex(t => t.item.id === id)
  if (index < 0) return undefined
  const [entry] = trashedItems.splice(index, 1)
  const item = entry!.item
  if (allContent.some(c => c.slug === item.slug)) {
    item.slug = makeUniqueSlug(item.slug)
  }
  allContent.push(item)
  return item
}

/** Permanent removal — no way back. */
export function purgeContentItem(id: string): void {
  const index = trashedItems.findIndex(t => t.item.id === id)
  if (index >= 0) trashedItems.splice(index, 1)
}

export function emptyTrash(owner: string): void {
  for (let i = trashedItems.length - 1; i >= 0; i--) {
    if (trashedItems[i]!.item.author === owner) trashedItems.splice(i, 1)
  }
}

/** Drops entries whose retention window has closed. */
export function purgeExpiredTrash(now: number = Date.now()): number {
  let removed = 0
  for (let i = trashedItems.length - 1; i >= 0; i--) {
    if (isExpired(trashedItems[i]!.deletedAt, now)) {
      trashedItems.splice(i, 1)
      removed++
    }
  }
  return removed
}

export function getTrash(owner: string): TrashEntry[] {
  return trashedItems
    .filter(t => t.item.author === owner)
    .sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime())
}

export function updateContentItem(id: string, patch: Partial<ContentItem>): void {
  const target = allContent.find(c => c.id === id)
  if (target) Object.assign(target, patch)
}

export function deleteFolder(id: string): void {
  const index = folders.findIndex(f => f.id === id)
  if (index >= 0) folders.splice(index, 1)
}

export function deleteSeries(id: string): void {
  const index = series.findIndex(s => s.id === id)
  if (index >= 0) series.splice(index, 1)
}

export function getFolder(id: string | undefined): Folder | undefined {
  return id ? folders.find(f => f.id === id) : undefined
}

export function getSeries(id: string | undefined): Series | undefined {
  return id ? series.find(s => s.id === id) : undefined
}

export const airports: Record<string, Airport> = {
  PEK: { iata: 'PEK', name: '北京首都国际机场', city: '北京', country: '中国', lat: 40.0799, lng: 116.6031 },
  NRT: { iata: 'NRT', name: '成田国际机场', city: '东京', country: '日本', lat: 35.7647, lng: 140.3864 },
  LHR: { iata: 'LHR', name: '伦敦希思罗机场', city: '伦敦', country: '英国', lat: 51.4700, lng: -0.4543 },
  ICN: { iata: 'ICN', name: '首尔仁川国际机场', city: '首尔', country: '韩国', lat: 37.4602, lng: 126.4407 },
}

export const trajectoryEntries: TrajectoryEntry[] = [
  {
    id: 'tr1', date: '2024-11-20', city: '北京', country: '中国',
    summary: '在家写代码，整理人生轨迹页面的设计。',
    tags: [{ id: 'tt1', name: '技术' }],
  },
  {
    id: 'tr2', date: '2024-11-18', city: '东京', country: '日本',
    summary: '成田机场转机，候机三小时。',
    tags: [{ id: 'tt2', name: '旅行' }, { id: 'tt3', name: '东京' }],
    diarySlug: 'demo-diary',
  },
  {
    id: 'tr3', date: '2024-11-12', city: '北京', country: '中国',
    summary: '雨天在家重构代码，窗外雨声很好听。',
    tags: [{ id: 'tt1', name: '技术' }],
    diarySlug: 'rainy-afternoon-notes',
  },
  {
    id: 'tr4', date: '2024-11-01', city: '伦敦', country: '英国',
    summary: '工作出差，开了三天会议。',
    tags: [{ id: 'tt4', name: '出差' }],
  },
  {
    id: 'tr5', date: '2024-10-15', city: '上海', country: '中国',
    summary: '回国探亲，见了老朋友。',
    tags: [{ id: 'tt5', name: '家人' }],
  },
  {
    id: 'tr6', date: '2024-09-20', city: '首尔', country: '韩国',
    summary: '短暂停留，吃了很多东西。',
    tags: [{ id: 'tt2', name: '旅行' }],
  },
  {
    id: 'tr7', date: '2024-08-05', city: '巴黎', country: '法国',
    summary: '巴黎出差，参观了几个博物馆。',
    tags: [{ id: 'tt4', name: '出差' }],
  },
  {
    id: 'tr8', date: '2024-07-22', city: '新加坡', country: '新加坡',
    summary: '转机停留，见了老同事。',
    tags: [{ id: 'tt2', name: '旅行' }],
  },
]

export function addTrajectoryEntry(entry: TrajectoryEntry): void {
  trajectoryEntries.push(entry)
}

/**
 * City centre coordinates used to place a newly recorded city on the map.
 * A city that is not in this table is stored with `pending: true` and kept off
 * the map rather than being guessed at a wrong location (Ch 13.3).
 */
export const CITY_COORDS: Record<string, { lat: number; lng: number; country: string }> = {
  北京: { lat: 39.9042, lng: 116.4074, country: '中国' },
  上海: { lat: 31.2304, lng: 121.4737, country: '中国' },
  香港: { lat: 22.3193, lng: 114.1694, country: '中国' },
  台北: { lat: 25.0330, lng: 121.5654, country: '中国' },
  东京: { lat: 35.6762, lng: 139.6503, country: '日本' },
  大阪: { lat: 34.6937, lng: 135.5023, country: '日本' },
  首尔: { lat: 37.5665, lng: 126.9780, country: '韩国' },
  新加坡: { lat: 1.3521, lng: 103.8198, country: '新加坡' },
  曼谷: { lat: 13.7563, lng: 100.5018, country: '泰国' },
  伦敦: { lat: 51.5074, lng: -0.1278, country: '英国' },
  巴黎: { lat: 48.8566, lng: 2.3522, country: '法国' },
  柏林: { lat: 52.5200, lng: 13.4050, country: '德国' },
  纽约: { lat: 40.7128, lng: -74.0060, country: '美国' },
  悉尼: { lat: -33.8688, lng: 151.2093, country: '澳大利亚' },
}

export interface FootprintVisitResult {
  /** True when the visit was folded into an existing city rather than added. */
  merged: boolean
  /** True when the city has known coordinates and therefore appears on the map. */
  onMap: boolean
  /**
   * True when a same-named city exists in another country and no country was
   * supplied, so a new pending row was created rather than guessing which one
   * was meant (Ch 13.3: never silently match the wrong city).
   */
  ambiguous: boolean
}

/**
 * Records a city-level visit. Cities are identified by name *and* country, so
 *同名 cities in different countries stay separate.
 */
export function recordFootprintVisit(
  city: string,
  country: string,
  date: string,
  options: { visitCount?: number; note?: string; departure?: string } = {}
): FootprintVisitResult {
  const name = city.trim()
  const land = country.trim()
  const times = Math.max(1, options.visitCount ?? 1)

  if (!name) return { merged: false, onMap: false, ambiguous: false }

  const match = matchFootprint(footprintCities, name, land)

  if (match.kind === 'merge') {
    const existing = match.target
    existing.visitCount += times
    if (date && date < existing.firstVisit) existing.firstVisit = date
    const latest = options.departure || date
    if (latest && latest > existing.lastVisit) existing.lastVisit = latest
    if (options.note) existing.note = options.note
    return { merged: true, onMap: !existing.pending, ambiguous: false }
  }

  const ambiguous = match.kind === 'ambiguous'
  const known = CITY_COORDS[name]
  // Only trust the coordinate when the country agrees (or none was supplied).
  const matched = !land || known?.country === land ? known : undefined
  const pending = ambiguous || !matched

  footprintCities.push({
    id: `fp-${name}-${Date.now()}`,
    city: name,
    country: land || matched?.country || '—',
    lat: matched?.lat ?? 0,
    lng: matched?.lng ?? 0,
    firstVisit: date,
    lastVisit: options.departure || date,
    visitCount: times,
    pending,
    note: options.note,
  })
  return { merged: false, onMap: !pending, ambiguous }
}

/** Appends a newly created item so it shows up in lists, search and detail pages. */
/**
 * Unique id. `Date.now()` alone collides when two items are created in the
 * same millisecond, which then makes lookups by id return the wrong one.
 */
let idCounter = 0
export function nextId(prefix: string): string {
  idCounter += 1
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}`
}

export function addContentItem(item: ContentItem): void {
  allContent.push(item)
}

/**
 * Slugs address content, so two items must never share one — otherwise
 * getContentBySlug returns the older item and "view what I just saved" opens
 * the wrong page. Appends -2, -3, ... until the slug is free.
 */
export function makeUniqueSlug(base: string): string {
  return uniqueSlug(base, allContent.map(c => c.slug))
}

export const footprintCities: FootprintCity[] = [
  { id: 'fp1', city: '北京', country: '中国', lat: 39.9042, lng: 116.4074, firstVisit: '2018-01-01', lastVisit: '2024-11-20', visitCount: 42 },
  { id: 'fp2', city: '伦敦', country: '英国', lat: 51.5074, lng: -0.1278, firstVisit: '2019-08-10', lastVisit: '2024-11-01', visitCount: 7 },
  { id: 'fp3', city: '东京', country: '日本', lat: 35.6762, lng: 139.6503, firstVisit: '2020-01-15', lastVisit: '2024-11-18', visitCount: 5 },
  { id: 'fp4', city: '上海', country: '中国', lat: 31.2304, lng: 121.4737, firstVisit: '2018-06-01', lastVisit: '2024-10-15', visitCount: 9 },
  { id: 'fp5', city: '首尔', country: '韩国', lat: 37.5665, lng: 126.9780, firstVisit: '2021-05-03', lastVisit: '2024-09-20', visitCount: 3 },
  { id: 'fp6', city: '新加坡', country: '新加坡', lat: 1.3521, lng: 103.8198, firstVisit: '2022-03-20', lastVisit: '2024-07-22', visitCount: 4 },
  { id: 'fp7', city: '巴黎', country: '法国', lat: 48.8566, lng: 2.3522, firstVisit: '2023-07-14', lastVisit: '2024-08-05', visitCount: 2 },
]

export const flightRecords: FlightRecord[] = [
  { id: 'fl1', date: '2024-11-18', airline: 'ANA', flightNo: 'NH202', from: 'PEK', to: 'NRT', distance: 2096, durationMinutes: 215, status: 'normal' },
  { id: 'fl2', date: '2024-11-18', airline: 'BA', flightNo: 'BA009', from: 'NRT', to: 'LHR', distance: 9560, durationMinutes: 715, status: 'normal' },
  { id: 'fl3', date: '2024-11-01', airline: 'BA', flightNo: 'BA038', from: 'PEK', to: 'LHR', distance: 8152, durationMinutes: 655, status: 'normal' },
  { id: 'fl4', date: '2024-09-20', airline: 'KE', flightNo: 'KE857', from: 'PEK', to: 'ICN', distance: 951, durationMinutes: 135, status: 'normal' },
  { id: 'fl5', date: '2024-09-23', airline: 'KE', flightNo: 'KE858', from: 'ICN', to: 'PEK', distance: 951, durationMinutes: 130, status: 'delayed' },
]

const thoughtContent: ContentItem[] = recentThoughts.map((thought, index) => ({
  id: thought.id,
  slug: `thought-${index + 1}`,
  type: 'thought',
  thoughtType: thought.thoughtType,
  title: thought.text,
  body: thought.thoughtType === 'excerpt'
    ? `> ${thought.text}\n\n${thought.sourceAuthor ? `作者或说话者：${thought.sourceAuthor}\n\n` : ''}${thought.sourceTitle ? `作品：${thought.sourceTitle}\n\n` : ''}${thought.sourceLocator ? `位置：${thought.sourceLocator}\n\n` : ''}${thought.personalNote ? `补充：${thought.personalNote}` : ''}`
    : thought.text,
  summary: thought.personalNote || thought.sourceTitle || thought.text,
  visibility: thought.visibility,
  tags: thought.tags,
  createdAt: thought.createdAt,
  updatedAt: thought.createdAt,
  publishedAt: thought.createdAt,
  author: 'euan',
  sourceAuthor: thought.sourceAuthor,
  sourceTitle: thought.sourceTitle,
  sourceType: thought.sourceType,
  sourceUrl: thought.sourceUrl,
  sourceLocator: thought.sourceLocator,
  personalNote: thought.personalNote,
}))

/**
 * The single live content store. Seed arrays above are private on purpose:
 * `allContent` is a copy made at module load, so anything reading a seed array
 * directly would miss every later create and keep showing deleted items.
 * Read through this array or the helpers below.
 */
export const allContent: ContentItem[] = [...thoughtContent, ...recentDiary, ...recentNotes, ...recentBlog]

/** Live content of one type, newest first, optionally narrowed to an author. */
export function contentOfType(
  type: ContentItem['type'],
  options: { author?: string; publicOnly?: boolean } = {}
): ContentItem[] {
  return allContent
    .filter(c => c.type === type)
    .filter(c => !options.author || c.author === options.author)
    .filter(c => !options.publicOnly || c.visibility === 'public')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

/** Most recently created live content, newest first. */
export function recentContent(
  limit: number,
  options: { author?: string; publicOnly?: boolean } = {}
): ContentItem[] {
  return allContent
    .filter(c => !options.author || c.author === options.author)
    .filter(c => !options.publicOnly || c.visibility === 'public')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit)
}

/** Live count for a type, for dashboard tiles. */
export function countOfType(type: ContentItem['type'], author: string): number {
  return allContent.filter(c => c.type === type && c.author === author).length
}

export function getContentBySlug(slug: string): ContentItem | undefined {
  return allContent.find(c => c.slug === slug)
}

export function getContentByTypeAndUser(type: ContentItem['type'], username: string): ContentItem[] {
  return allContent.filter(c => c.type === type && c.author === username)
}

function hashDate(dateStr: string): number {
  let hash = 0
  for (let i = 0; i < dateStr.length; i++) {
    hash = (hash * 31 + dateStr.charCodeAt(i)) >>> 0
  }
  return hash % 100
}

export function generateHeatmapData(): { date: string; level: 0 | 1 | 2 | 3 | 4 }[] {
  const data: { date: string; level: 0 | 1 | 2 | 3 | 4 }[] = []
  const today = new Date('2024-11-20')
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    const dateStr = d.toISOString().split('T')[0] ?? ''
    const seed = hashDate(dateStr)
    const level = seed > 75 ? (seed > 90 ? (seed > 97 ? 4 : 3) : 2) : seed > 50 ? 1 : 0
    data.push({
      date: dateStr,
      level: level as 0 | 1 | 2 | 3 | 4,
    })
  }
  return data
}

/* ---- Ch 15: encrypted interactive spaces ---- */

export const encryptedSpaces: EncryptedSpace[] = [
  {
    id: 'sp1',
    spaceKey: 'k7f2a9d4e1b8',
    owner: 'euan',
    name: '给家人的信',
    description: '写给家里人看的那些话。',
    welcome: '如果你知道密码，就进来看看吧。',
    password: 'family2024',
    sessionTtlMinutes: 120,
    allowReplies: true,
    allowAnonymousReplies: true,
    showReplyNickname: true,
    showPostCount: true,
    isActive: true,
    createdAt: '2024-03-10T10:00:00Z',
  },
  {
    id: 'sp2',
    spaceKey: 'm3c8b5a2f7e0',
    owner: 'euan',
    name: '旧朋友',
    description: '一些只想说给老朋友听的事。',
    welcome: '很久不见。',
    password: 'oldfriends',
    sessionTtlMinutes: 60,
    allowReplies: true,
    allowAnonymousReplies: false,
    showReplyNickname: true,
    showPostCount: false,
    isActive: true,
    createdAt: '2024-06-22T14:00:00Z',
  },
]

export const spacePosts: SpacePost[] = [
  {
    id: 'sps1',
    spaceId: 'sp1',
    title: '今年过年没能回家',
    body: `今年过年没能回家。

航班改签了三次，最后还是没赶上。视频里看到桌上摆了我的碗筷，妈说没关系，明年再回。

我知道没关系，但还是想说一句对不起。

> 有些距离不是公里数，是错过的那几顿饭。`,
    summary: '航班改签三次，最后还是没赶上年夜饭。',
    createdAt: '2024-02-10T13:20:00Z',
  },
  {
    id: 'sps2',
    spaceId: 'sp1',
    title: '关于那间老房子',
    body: `路过以前住的那条街，老房子还在，阳台上晾着别人家的衣服。

小时候总觉得那个阳台很高，现在看其实就两层楼。`,
    summary: '路过以前住的那条街，老房子还在。',
    createdAt: '2024-05-18T09:00:00Z',
  },
  {
    id: 'sps3',
    spaceId: 'sp2',
    title: '十年了',
    body: `距离我们最后一次一起吃饭，好像正好十年。

那天你说要去南方，我说好啊，然后我们谁也没再联系。不是吵架，就是各自忙起来了。

如果你看到这条，随便回一句就行。`,
    summary: '距离最后一次一起吃饭，正好十年。',
    createdAt: '2024-07-01T20:30:00Z',
  },
]

export const spaceReplies: SpaceReply[] = [
  {
    id: 'spr1', spaceId: 'sp1', postId: 'sps1',
    nickname: '妈', content: '真的没关系，路上注意安全就好。',
    isAuthor: false, createdAt: '2024-02-10T15:40:00Z',
  },
  {
    id: 'spr2', spaceId: 'sp1', postId: 'sps1',
    content: '明年一定回。', isAuthor: true, createdAt: '2024-02-11T08:12:00Z',
  },
  {
    id: 'spr3', spaceId: 'sp2', postId: 'sps3',
    nickname: '', content: '我也记得那天。南方挺好的，就是夏天太长。',
    isAuthor: false, createdAt: '2024-07-03T22:05:00Z',
  },
]

export function getSpaceByPassword(password: string): EncryptedSpace | undefined {
  return encryptedSpaces.find(s => s.isActive && s.password === password.trim())
}

export function getSpaceByKey(spaceKey: string): EncryptedSpace | undefined {
  return encryptedSpaces.find(s => s.spaceKey === spaceKey)
}

export function getSpacePosts(spaceId: string): SpacePost[] {
  return spacePosts
    .filter(p => p.spaceId === spaceId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
}

export function getSpaceReplies(postId: string): SpaceReply[] {
  return spaceReplies
    .filter(r => r.postId === postId && !r.hidden)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function addSpaceReply(reply: SpaceReply): void {
  spaceReplies.push(reply)
}

export const SPACE_LIMIT = 5

/* ---- Ch 11: article comments ---- */

export const articleComments: ArticleComment[] = [
  {
    id: 'cm1',
    contentId: 'b1',
    author: 'alice',
    authorDisplayName: 'Alice',
    body: '数据主权这一段说到我了。我也是从 Notion 迁出来的，最后自己写了个静态站。',
    createdAt: '2024-11-07T09:20:00Z',
  },
  {
    id: 'cm2',
    contentId: 'b1',
    author: 'euan',
    authorDisplayName: 'Euan',
    body: '静态站其实挺好，就是想加动态功能的时候会比较痛苦。',
    createdAt: '2024-11-07T14:05:00Z',
  },
]

export function getComments(contentId: string): ArticleComment[] {
  return articleComments
    .filter(c => c.contentId === contentId && !c.hidden)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
}

export function addComment(comment: ArticleComment): void {
  articleComments.push(comment)
}

/* ---- Ch 4.4 / 19 / 21: account and admin ---- */

export const deviceSessions: DeviceSession[] = [
  { id: 'ds1', device: 'macOS · Chrome', location: '北京', lastActive: '2024-11-20 14:32', current: true },
  { id: 'ds2', device: 'iPhone · Safari', location: '北京', lastActive: '2024-11-19 21:10', current: false },
  { id: 'ds3', device: 'iPad · Safari', location: '伦敦', lastActive: '2024-11-02 08:44', current: false },
]

export const adminAccessRecords: AdminAccessRecord[] = []

export const adminUsers: AdminUserRow[] = [
  {
    id: 'u1', username: 'euan', displayName: 'Euan', email: 'euan@example.com',
    status: 'active', contentCount: 232, storageUsedMb: 412, storageLimitMb: 2048,
    spaceLimit: 5, spacesUsed: 2, joinedAt: '2023-03-15',
  },
  {
    id: 'u2', username: 'alice', displayName: 'Alice', email: 'alice@example.com',
    status: 'active', contentCount: 18, storageUsedMb: 36, storageLimitMb: 1024,
    spaceLimit: 3, spacesUsed: 0, joinedAt: '2024-08-02',
  },
  {
    id: 'u3', username: 'bob', displayName: 'Bob', email: 'bob@example.com',
    status: 'suspended', contentCount: 4, storageUsedMb: 8, storageLimitMb: 1024,
    spaceLimit: 3, spacesUsed: 1, joinedAt: '2024-09-19',
  },
]

export const invitationCodes: InvitationCode[] = [
  { id: 'ic1', code: 'LIFE-7F2A-9D4E', createdAt: '2024-10-01', usedBy: 'alice', expiresAt: '2025-10-01' },
  { id: 'ic2', code: 'LIFE-3C8B-5A2F', createdAt: '2024-11-05', expiresAt: '2025-11-05' },
  { id: 'ic3', code: 'LIFE-B1D6-4E90', createdAt: '2024-11-18', expiresAt: '2025-11-18' },
]

export const securityLogs: SecurityLogEntry[] = [
  { id: 'sl1', event: '登录成功', actor: 'euan', ip: '203.0.113.**', occurredAt: '2024-11-20 14:32', level: 'info' },
  { id: 'sl2', event: '加密空间密码验证失败', actor: '匿名访客', ip: '198.51.100.**', occurredAt: '2024-11-20 11:07', level: 'warning' },
  { id: 'sl3', event: '连续登录失败触发限流', actor: '匿名访客', ip: '198.51.100.**', occurredAt: '2024-11-20 11:05', level: 'warning' },
  { id: 'sl4', event: '系统备份完成', actor: 'system', ip: '—', occurredAt: '2024-11-19 03:00', level: 'info' },
  { id: 'sl5', event: '登录成功', actor: 'alice', ip: '203.0.113.**', occurredAt: '2024-11-18 19:22', level: 'info' },
]

export const registrationMode: RegistrationMode = 'invite'

export const storageStats = {
  usedMb: 412,
  limitMb: 2048,
  imageCount: 184,
  videoCount: 7,
}

export const backupJobs = [
  { id: 'bk1', createdAt: '2024-11-19 03:00', sizeMb: 486, status: '成功', kind: '自动' },
  { id: 'bk2', createdAt: '2024-11-12 03:00', sizeMb: 471, status: '成功', kind: '自动' },
  { id: 'bk3', createdAt: '2024-11-05 22:14', sizeMb: 468, status: '成功', kind: '手动' },
]
