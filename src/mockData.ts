import type { ContentItem, Thought, TrajectoryEntry, FootprintCity, FlightRecord, Airport, UserProfile, SiteStats } from './types'

export const euanProfile: UserProfile = {
  username: 'euan',
  displayName: 'Euan',
  bio: '',
  avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&auto=format',
  publicSince: '2023-03-15',
}

export const siteStats: SiteStats = {
  launchedAt: '2023-03-15T08:00:00Z',
  totalPV: 14382,
  totalUV: 3217,
}

export const recentThoughts: Thought[] = [
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

export const recentDiary: ContentItem[] = [
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

export const recentNotes: ContentItem[] = [
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
    folder: '前端 / React',
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
    folder: '系统 / Linux',
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
    folder: 'Inbox',
    favorite: false,
    archived: false,
    allowComments: false,
  },
]

export const recentBlog: ContentItem[] = [
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
    series: 'LifeExpanse 构建札记',
    cover: '/brand/hero-lifeexpanse-desktop.png',
    seoTitle: '为什么我要自己做一个记录平台 - LifeExpanse',
    seoDescription: '关于数据主权、公私边界和长期可用性的个人记录平台思考。',
    allowComments: true,
    favorite: true,
    archived: false,
  },
]

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

export const thoughtContent: ContentItem[] = recentThoughts.map((thought, index) => ({
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

export const allContent: ContentItem[] = [...thoughtContent, ...recentDiary, ...recentNotes, ...recentBlog]

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
