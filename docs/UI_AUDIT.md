# LifeExpanse 前端 UI 审查报告

> 状态：分析稿，只读审查，未修改任何代码或依赖。
> 审查范围：`package.json`、`docs/DESIGN_DIRECTION.md`、`docs/个人数字记录平台_完整需求规格_v1.6.md`（PRD v1.6）、`src/` 下全部路由、页面、组件与样式文件。
> 目标：为"重构为明朗、干净、克制、适合长期阅读的个人记录平台"提供现状盘点与分阶段实施建议。

---

## 1. 当前前端框架、构建工具与样式方案

- **框架**：React 19（`react` / `react-dom` ^19.0.0）+ TypeScript 5.7。
- **路由**：`react-router-dom` ^7.18.1，`BrowserRouter`。
- **构建工具**：Vite ^8.0.0，通过 `vite.config.ts` 接入 `@vitejs/plugin-react`。该配置文件本身较重，包含 Figma Make 平台注入的多个自定义插件（站点元信息、HMR 错误回放、React Refresh 兜底、`.figma/make/kit.html` 预览桩），这些与视觉重构无关，但说明项目仍托管在 Figma Make 环境中，构建链路不完全由项目自身掌控。
- **样式方案**：Tailwind CSS v4，通过 `@tailwindcss/vite` 插件接入（[vite.config.ts:3,21](vite.config.ts#L3)），**没有 PostCSS 配置**，也没有 `tailwind.config.js`（v4 特性，配置改为 CSS 内 `@theme`）。
- **设计 token 机制**：CSS 自定义属性（CSS variables）定义在 [src/index.css](src/index.css) 的 `:root` 和 `.dark` 块中，再通过 `@theme inline` 映射进 Tailwind 的语义化工具类（`bg-background`、`text-foreground` 等）。同时代码里大量直接使用 `style={{ background: 'var(--xxx)' }}` 和 `text-[color:var(--xxx)]` 任意值写法，两种引用方式混用。
- **格式化**：`oxfmt`（`package.json` `format` 脚本），没有 ESLint/Prettier 配置文件出现在树中。
- **组件库**：无（详见第 4 节）。
- **Markdown 渲染**：自研正则解析器（[src/components/MarkdownRenderer.tsx](src/components/MarkdownRenderer.tsx)），非成熟库（如 PRD 建议的 Vditor/Milkdown 均未使用）。
- **地图 / 图表**：均未接入，PKM/轨迹/足迹/飞行相关页面在前端完全是 stub（重定向到首页），与 PRD 第 12–14 章要求的功能相去甚远，本次审查按“已实现页面”为主。

---

## 2. 当前全部路由与页面

路由定义于 [src/App.tsx](src/App.tsx)：

| 路由 | 组件 | 状态 |
|---|---|---|
| `/` | `HomePage` | 公开主页，硬编码展示 `euan` |
| `/euan` | `HomePage` | 与 `/` 完全相同（PRD 6.4 的"根路径别名"设计） |
| `/login` | `LoginPage` | 表单校验为前端 mock，硬编码账号 `euan` / `demo123456` |
| `/register` | `RegisterPage` | 前端 mock，无真实后端 |
| `/app` | `AppDashboard` | 登录后工作台，无鉴权保护（任何人可直接访问） |
| `/:username/notes` `/diary` `/blog` `/quotes` | `ContentListPage` | 内容列表 |
| `/:username/notes/:slug` 等 | `ContentDetailPage` | 详情（只读） |
| `/:username/notes/:slug/edit` 等 | `ContentEditPage` | 编辑模式 |
| `/:username/trajectory` `/map` `/flights` `/space` | 全部 `<Navigate to="/" replace />` | **纯 stub，未实现任何页面** |
| `*` | 重定向到 `/` | 404 兜底 |

**与 PRD 第 6.7 节路由表的差距**（供后续规划参考，不属于本次视觉审查的强制项）：
- 缺少 `/account`、`/admin`、`/{username}/pkm`。
- `/{username}/space` 只是重定向桩，PRD 第 15 章的多密码加密空间未实现任何 UI。
- 人生轨迹、足迹地图、飞行日志（PRD 12–14 章）在前端完全没有页面，只在 `AppDashboard` 和 `HomePage` 里以卡片/列表形式引用了 mock 数据（如 `flightRecords`、`footprintCities`、`trajectoryEntries`），没有独立可访问页面。
- 语录（quotes）路由虽然存在，但存在数据未打通的问题（见第 10 节）。

---

## 3. 当前设计 tokens 与全局样式位置

全部集中在 [src/index.css](src/index.css)：

- `:root`（第 25–45 行）与 `.dark`（第 47–62 行）定义颜色、圆角、字体三类 token。
- `@theme inline`（第 4–23 行）把这些变量映射为 Tailwind 语义类名（`--color-background`、`--radius-DEFAULT` 等）。
- 全局 `.prose` 长文样式（第 96–166 行）：字号、行高、标题、引用块、代码块、列表、图片、分割线的排版规则，是长文阅读体验的核心，值得重点保留和打磨。
- 活跃热力图专用样式 `.heatmap-cell`（第 168–179 行），硬编码了 4 级色阶（`#B8D4C8` → `#2D4A3E`），与 token 系统脱节（不是变量引用）。
- 字体通过 Google Fonts `@import` 引入：`Lora`（衬线，标题）、`Inter`（正文）、`JetBrains Mono`（等宽，日期/标签/统计数字）。

**没有 Tailwind config 文件**，`rounded-sm`、`text-xs` 等全部是 Tailwind v4 默认标度类，与 `--radius` 变量**不是同一套系统**（详见第 6 节和第 11 节，这是重构时需要注意的技术细节）。

---

## 4. 当前使用的组件库

**没有使用任何第三方 UI 组件库**（无 shadcn/ui、Radix、Headless UI、MUI、Ant Design、Chakra 等）。`package.json` 的 `dependencies` 只有 `react`、`react-dom`、`react-router-dom` 三项。

所有 UI 元素——按钮、输入框、下拉菜单、徽章、卡片、Tab 切换——都是手写的 Tailwind 工具类拼接 + 内联 `style`，分散在 10 个组件文件和 7 个页面文件里，**没有任何共享的 Button / Input / Card 基础组件**。

这对本次重构是好消息也是坏消息：
- 好处：没有第三方库的视觉基因需要"洗掉"，重构阻力小，改 token 即可大范围生效。
- 坏处：因为没有基础组件做统一入口，同一视觉元素（按钮、输入框）在多个文件里被重复实现，容易出现细节漂移（见第 5 节），重构时必须逐文件替换，无法只改一处。

---

## 5. 重复或不一致的 UI 组件

1. **`AppHeader` 与 `PublicHeader` 高度重复**（[src/components/AppHeader.tsx](src/components/AppHeader.tsx) / [src/components/PublicHeader.tsx](src/components/PublicHeader.tsx)）：sticky 定位、Logo、桌面导航、移动端汉堡菜单的结构和样式几乎一致，仅链接内容不同，却是两份独立代码，圆角、间距、断点（一个用 `lg:`，一个用 `md:`）已经不统一。

2. **按钮样式没有抽象，散落 6+ 处手写**：`LoginPage`、`RegisterPage`、`ContentEditPage`、`MediaInsertMenu`、`AppHeader`（新建按钮）都各自写了一遍 `style={{ background: 'var(--primary)', color: 'var(--primary-foreground)' }}` + `rounded-sm` + `transition-*` 的组合，圆角、内边距（`py-2.5` vs `py-1.5` vs `py-2`）、字号（`text-sm` vs `text-xs`）均不统一。

3. **输入框样式重复**：`LoginPage`、`RegisterPage`、`ContentListPage`（搜索框）、`ContentEditPage`（标签输入）里，`border border-[color:var(--border)] rounded-sm bg-[color:var(--background)] ...` 这段近 200 字符的类名被逐字复制粘贴 6 次以上。

4. **`VisibilityBadge` 硬编码十六进制颜色**（[src/components/VisibilityBadge.tsx:10-12](src/components/VisibilityBadge.tsx#L10)）：`bg-[#EEF6F2] text-[#2D4A3E] border-[#C8E0D8]` 等，没有走 CSS 变量系统。`ContentListPage` 的可见性筛选按钮又在别处独立硬编码了同一个 `#EEF6F2`（[src/pages/ContentListPage.tsx:92](src/pages/ContentListPage.tsx#L92)），两处颜色值靠"人肉保持一致"，换色时极易漏改。

5. **字体切换用内联 `style` 而不是 Tailwind 工具类**：Tailwind `@theme inline` 已经声明了 `--font-serif: var(--font-display)`（即 `font-serif` class 本可直接使用），但全项目 20+ 处都是手写 `style={{ fontFamily: 'var(--font-display)' }}` 或 `'var(--font-mono)'`，而不是用 `font-serif` / `font-mono` 类名。这是明显的"有轮子不用"，也让后续统一改字体时必须逐处修改内联样式而非改一次 CSS。

6. **两套"下拉面板"实现**：`AppHeader` 的"新建"下拉（第 77–96 行）与 `MediaInsertMenu` 的插入媒体面板（[src/components/MediaInsertMenu.tsx:118-253](src/components/MediaInsertMenu.tsx#L118)）都是独立实现的 `absolute` 定位 + 点击外部关闭逻辑，没有共享的 Popover/Dropdown 组件，圆角、阴影（`shadow-lg`）、层级（`z-40` vs `z-50`）各写各的。

---

## 6. 卡片、阴影、圆角、颜色和间距问题

这是本次审查中**与 `DESIGN_DIRECTION.md` 冲突最直接、最需要优先处理**的部分。

### 6.1 圆角：设计方向文档与实现脱节

`DESIGN_DIRECTION.md` 明确要求"Standard border radius: 8–12px"，但：
- `index.css` 中 `--radius: 3px`（[src/index.css:40](src/index.css#L40)）——比目标值小了近 3–4 倍。
- 更关键的是：全代码库里的圆角类名清一色是 Tailwind 自带的 `rounded-sm`（约 2px），**而不是**引用 `--radius` 变量的裸 `rounded` 类。也就是说即使把 `--radius` 改成 12px，页面观感也不会变化，因为没有任何组件真正使用这个 token。这意味着圆角调整不是一次性改 CSS 变量能解决的，需要做一次全局的类名替换。

### 6.2 颜色：两份色板互相矛盾

`DESIGN_DIRECTION.md` 给出的目标色板是**冷色调、明亮、蓝色强调色**：
- 背景 `#F7F9FC`、强调色 `#4F86F7`（蓝）、无衬线字体栈。

而 `index.css` 实际实现的是**暖色调、米色底、深绿+棕色强调色的编辑风格**：
- 背景 `#F5F3EF`（米白）、主色 `#2D4A3E`（深绿）、强调色 `#B5895A`（棕）、衬线标题字体 Lora。

这不是小偏差，是两套完全不同的视觉方向。当前实现更接近"杂志 / 出版物"风格，而设计方向文档描述的是"明亮、清爽的 SaaS 风格浅色系统"。**这是启动重构前必须先由用户拍板的决策点**：是让实现向 `DESIGN_DIRECTION.md` 的冷色蓝调靠拢，还是更新 `DESIGN_DIRECTION.md` 去追认当前的暖色编辑风格？两者产出的视觉结果会完全不同，后续所有 token 工作都依赖这个决策（见第 12 节 Phase 1）。

### 6.3 卡片化程度过高

`AppDashboard.tsx` 几乎每个区块都套了一层 `border border-[color:var(--border)] rounded-sm p-4` + `background: var(--card)` 的卡片容器：内容模块网格、最近内容、活跃热力图、本月统计、最近到访城市、飞行总计、系统状态——侧边栏堆了 4 张独立卡片。这直接违反 `DESIGN_DIRECTION.md` 里"Do not wrap every section in a card"的原则，也是让页面看起来像企业后台的最主要原因（详见第 8 节）。

### 6.4 阴影

大部分组件遵循"无阴影或极轻阴影"的原则，但两处下拉面板（`AppHeader` 新建菜单、`MediaInsertMenu` 面板）使用了 `shadow-lg`，这是 Tailwind 里偏重的阴影级别，与"Avoid excessive shadows"的目标不符，应降级为 `shadow-sm` 或改用边框+背景色区分。

### 6.5 间距

Tailwind 间距标度使用较为规范，没有发现明显的随意像素值，这部分基本达标，重构时可以保留现有间距节奏。

---

## 7. 字体层级和长文阅读体验问题

1. **Lora 不含中文字形**：`--font-display: 'Lora', Georgia, serif'` 用于所有标题（`.prose h1-h4`、`ContentCard` 标题、`HomePage`/`ContentDetailPage` 大标题等），但 Lora 是纯拉丁字体，不覆盖中文字符。而 mock 数据里几乎全部标题都是中文（如"为什么我要自己做一个记录平台"）。这意味着"衬线标题"这个精心设计的视觉识别，在处理中文内容时会**静默降级**为系统默认衬线字体（macOS 上大概是宋体/serif fallback），实际效果与设计意图不符。这是长文阅读体验里最值得优先修复的问题之一——考虑到 PRD 明确要求中英文混排支持（`DESIGN_DIRECTION.md` 也建议 "Noto Sans SC" / "PingFang SC" 字体栈），当前实现并未落实这一点。

2. **等宽字体（JetBrains Mono）使用过于泛滥**：日期、标签、统计数字、模块计数、面包屑分隔符等大量非代码场景都套用了等宽字体（如 `AppDashboard` 里 "内容模块" "本月统计" 等分区标题也用了 mono + uppercase + tracking-wider）。这种"到处都是等宽大写小标签"的处理方式是很典型的**开发者工具/仪表盘**视觉语言，与"适合长期阅读的个人记录平台"想要传达的温度感有一定冲突，值得重新评估哪些场景真正需要等宽字体（如代码块、日期时间戳），哪些应该改回正文字体。

3. **阅读宽度定义了两次，来源不同**：`.prose` class 设置 `max-width: 70ch`（[src/index.css:102](src/index.css#L102)），`ContentDetailPage` 又用 Tailwind 容器 `max-w-3xl`（768px）包裹整个 `<main>`（[src/pages/ContentDetailPage.tsx:81](src/pages/ContentDetailPage.tsx#L81)）。两个宽度约束叠加生效，实际阅读宽度取决于两者较小值，没有单一可信来源，后续调整"最佳阅读宽度"时容易只改一处而漏改另一处。PRD/设计方向文档建议的 720–780px 目前是巧合达标，而非有意为之的统一设计。

4. **没有统一的字号/字重阶梯（type scale）**：标题字号在各页面独立选择（`text-xl`、`text-2xl`、`text-lg` 混用于不同层级的"页面标题"），没有一套 h1/h2/h3 语义化组件强制层级一致性，长期维护会越漂越远。

---

## 8. 哪些页面过于像企业 SaaS 后台

**`AppDashboard`（`/app`）是最典型的例子**，具体体现：
- 顶部四列统计卡片网格（内容模块计数）+ 侧边栏堆叠的 4 个独立小卡片（本月统计、最近到访城市、飞行总计、系统状态），系统状态卡片甚至有一个绿色圆点 + "系统运行正常" 文案——这是运维监控面板（Grafana/Vercel/Linear 风格）的标准语汇，而不是个人记录工具的语汇。
- GitHub 风格活跃热力图直接搬进主工作台首屏，强化了"开发者工具"既视感。
- 全部分区标题使用 uppercase + tracking-wider + mono 字体（"内容模块" "最近内容" "年度活跃热力图" 等），是典型的仪表盘小标签处理方式。

**`ContentEditPage` 次之**：顶部 sticky 编辑栏（返回/未保存标记/取消/保存按钮）+ Tab 切换（编写/预览）是标准 SaaS 编辑器 UI，功能上没问题，但视觉上也偏工具感，可以在保留交互逻辑的前提下做更克制、更"纸感"的处理。

**`LoginPage`/`RegisterPage`** 是标准的居中卡片式登录/注册表单，这个模式本身在认证页面属于行业通用做法，问题不大，但当前卡片边框、标签样式（`text-xs font-medium` 全部大写间距）依然是偏 SaaS 后台的处理方式，可以适度柔化。

相对而言，**`HomePage`（公开主页）和 `ContentDetailPage`（内容详情）已经比较接近"个人博客/编辑风格"**，是这次重构里可以作为视觉基准、向其他页面推广的两个页面。

---

## 9. 桌面、平板和手机端问题

`DESIGN_DIRECTION.md` 明确写了"Mobile layouts must be redesigned, not merely compressed desktop layouts"，但当前实现基本都是**响应式压缩**而非重新设计：

1. **断点策略不统一**：`AppHeader` 桌面导航在 `lg`（1024px）断点才展开，`PublicHeader` 在 `md`（768px）断点展开——两个头部对"何时该出现汉堡菜单"的判断标准不一致。PRD/设计方向文档定义的平板宽度是 768px，`AppHeader` 会导致 768–1023px 之间的平板视口一直显示汉堡菜单而非桌面导航，`PublicHeader` 在同一宽度下却已经展示桌面导航，两个头部在平板视口下表现不一致。

2. **多列布局在移动端简单堆叠为单列**：`HomePage`、`AppDashboard`、`ContentListPage` 的主布局都是 `grid-cols-1 lg:grid-cols-3`，移动端就是把桌面的三栏纵向堆叠，没有针对手机端重新设计信息优先级（比如侧边栏统计信息在手机上是否还需要全部展示、以什么顺序展示）。

3. **`MediaInsertMenu` 下拉面板固定宽度 288px（`w-72`），且用 `absolute left-0` 定位**（[src/components/MediaInsertMenu.tsx:120](src/components/MediaInsertMenu.tsx#L120)），在 PRD 建议的 390px 手机视口下，如果触发按钮靠右，面板很可能超出视口右边缘，没有边界碰撞处理。

4. **`Footer` 在窄屏上信息密度较高**：运行时长、总访问量、独立访客、版权、Slogan 五段信息挤在一个 footer 里，虽然用了 `flex-col sm:flex-row` 换行，但没有验证过在 390px 视口下的实际折行效果，容易出现拥挤或对齐参差。

5. 目前没有看到任何页面为平板（768px）专门设计过布局——所有断点只在"桌面"和"手机"两级之间切换，中间态基本是被动继承桌面或手机样式，这与 PRD 明确列出的三档响应式尺寸（1440/768/390）要求有落差。

---

## 10. 哪些页面或组件存在功能与视觉强耦合

1. **语录（Quotes）模块：视觉与数据模型双重脱节，是本次审查发现的最严重的耦合/隐藏 bug**。
   - `mockData.ts` 中 `recentQuotes` 是独立的 `Quote[]` 类型（[src/mockData.ts:17-42](src/mockData.ts#L17)），字段结构（`text`/`source`）与 `ContentItem`（`title`/`body`/`slug`）完全不同。
   - `HomePage` 用手写的 `<blockquote>` 直接渲染 `recentQuotes`（[src/pages/HomePage.tsx:140-158](src/pages/HomePage.tsx#L140)），有独立的视觉样式（左边框 + 斜体衬线字体）。
   - 但 `allContent`（供列表页/详情页使用的统一内容池）只合并了 `recentDiary`、`recentNotes`、`recentBlog` 三类（[src/mockData.ts:266](src/mockData.ts#L266)），**从未包含语录**。`ContentCard.getDetailPath` 里虽然写了 `quote: 'quotes'` 的路径映射（[src/components/ContentCard.tsx:19-26](src/components/ContentCard.tsx#L19)），但因为 `allContent` 里没有语录数据，访问 `/euan/quotes` 列表页永远显示"暂无语录"空态，语录也没有独立详情页。
   - **对本次视觉重构的影响**：不能简单地把 `HomePage` 里的语录 blockquote 样式套用到 `ContentCard`/列表/详情页体系上，因为语录目前根本不在这套管线里。重构语录展示样式时，必须同时决定是否顺带把数据模型接上（这已经超出"只做视觉"的范围，需要和用户确认边界），否则重构后语录板块的视觉与其余模块仍然是两套逻辑。

2. **`ContentEditPage` 标题输入框的字体样式直接写死在编辑态 DOM 上**（[src/pages/ContentEditPage.tsx:183-185](src/pages/ContentEditPage.tsx#L183)）：`style={{ fontFamily: 'var(--font-display)' }}` 挂在 `<input>` 元素本身，而不是通过 class。如果重构决定标题不再使用衬线字体，需要去逐个输入框元素改内联样式，而不是改一处全局规则。

3. **`MediaInsertMenu` 插入视频的方式与 `MarkdownRenderer` 的渲染能力不匹配**：`handleVideoFile` 把上传的视频包装成原始 HTML `<video src="..." controls>` 标签直接拼进 Markdown 正文（[src/components/MediaInsertMenu.tsx:71](src/components/MediaInsertMenu.tsx#L71)），但 `MarkdownRenderer.parseMarkdown` 的正则解析器并不识别 `<video>` 标签，只会把它当成普通文本行包进 `<p>` 标签（因为不匹配任何已知块级标签前缀）——由于最终通过 `dangerouslySetInnerHTML` 渲染，浏览器仍会解析出真实的 `<video>` 元素，但这是"意外生效"而非解析器设计支持的行为，且完全绕过了 PRD 18.7 节要求的"不允许保存任意危险 HTML，需要走受控扩展节点"的安全约束。视觉重构如果要统一媒体展示样式（比如给视频加统一的圆角/边框容器），需要注意这条路径目前没有真正被解析器感知，直接改 `.prose video` 的 CSS 是可以生效的，但更系统的方案应该配合内容模型走结构化语法而非原始 HTML 拼接（此为架构/安全问题，仅供后续规划参考，不属于本次视觉审查范围）。

4. **`VisibilityBadge` 把颜色语义和组件强耦合在一份 config 对象里**（第 5.4 节已述）：因为颜色是硬编码 hex 而不是引用 token，视觉重构时这个文件必须被单独处理，且要同步排查其他手动复制了这些 hex 值的地方（已发现 `ContentListPage` 一处）。

---

## 11. 如何在不破坏路由和交互的情况下重构视觉

结论：**风险总体可控**。核心原因是当前项目没有第三方组件库、状态管理都在页面级 `useState` 里、路由结构与视觉样式完全解耦——`App.tsx` 的路由表不引用任何样式，纯换皮不会牵动路由。具体建议：

1. **先修 token 管线，再动组件**：
   - 圆角：需要先搞清楚要不要把所有 `rounded-sm` 批量换成引用 `--radius` 的 `rounded` 类（或者干脆放弃变量、直接统一改字面值），否则光改 `--radius` 不会有任何视觉效果（见第 6.1 节）。
   - 颜色：先解决第 6.2 节提出的"暖色 vs 冷色"路线决策，再统一改 `:root`/`.dark`，因为几乎所有组件都是通过变量取色，这一步改完后大部分页面会自动跟随。
   - hex 硬编码：先把 `VisibilityBadge.tsx`、`ContentListPage.tsx` 里的字面量 hex 换成 `var(--xxx)` 引用，避免后续改 token 时有遗漏点。

2. **把重复的按钮/输入框/卡片模式收敛成共享组件，但保持对外行为不变**：新建 `Button`、`Input`、`Section`（替代到处手写的卡片容器）这类纯展示组件，函数签名只接受现有代码里已经在用的 props（如 `onClick`、`disabled`、`type`），迁移时是"替换 JSX 标签"而非"改变量名或状态逻辑"，因此不会影响交互行为、也不涉及路由。可以逐页替换、每页替换后独立验证，不需要一次性全量重写。

3. **`AppDashboard` 的"去卡片化"改造是纯布局层面的调整**：去掉容器的 `border`/`background`/`rounded-sm`，换成留白 + 分隔线（`border-b` 而非四边 `border`），不涉及任何数据获取或状态逻辑，可以整页重做而不影响其余路由。

4. **字体层级重构**（去除内联 `style` fontFamily，改用 Tailwind `font-serif`/`font-sans`/`font-mono` 工具类）是纯查找替换性质的工作，不影响任何 `onClick`/表单逻辑，可以用简单的批量替换完成，但由于是内联 `style` 而非 class（原生 style 优先级更高），删除时要小心不要漏删导致新旧规则冲突。

5. **语录模块**（第 10.1 节）如果只做视觉重构，建议**维持现状的"blockquote 手写卡片"独立实现不变**，只更新其颜色/字体以匹配新 token，不要在本次视觉任务中顺带修复数据模型问题——除非用户明确同意扩大任务范围。

6. **响应式重做**（第 9 节）建议放在视觉 token 和组件都稳定之后再做，因为断点调整会牵动每个页面的布局类名，如果在 token 还没定下来之前就动断点，容易返工两次。

---

## 12. 分阶段实施计划

### Phase 0 — 决策与地基清理（不改变任何可见效果 / 需要用户拍板一项）
- **需要用户决策**：`DESIGN_DIRECTION.md` 的冷色蓝调方向 vs. `index.css` 现有的暖色编辑风格，最终采用哪一套（或如何融合）。这个决策是后续所有阶段的输入，建议作为本报告交付后的第一个后续动作。
- 把 `VisibilityBadge`、`ContentListPage` 里硬编码的 hex 颜色改为变量引用（不改变现有颜色数值，只改变引用方式，视觉效果不变）。
- 梳理 `rounded-sm` 的替换策略（决定是批量替换成 `rounded` 还是保留 Tailwind 标度、直接调整数值）。

### Phase 1 — 设计 Token 层
- 按 Phase 0 决策更新 `src/index.css` 的 `:root` / `.dark` 颜色变量、`--radius`、字体栈（含 CJK 字体补充，解决第 7.1 节 Lora 中文缺字问题）。
- 更新 `.prose` 长文样式的排版细节（阅读宽度改为单一来源、行高等）。
- **预计涉及文件**：`src/index.css`（唯一）。

### Phase 2 — 共享视觉原语
- 新增 `Button`、`Input`（或表单字段）、`Section`/`Panel` 等纯展示组件，替代第 5 节列出的重复实现。
- 迁移试点页面：`LoginPage`、`RegisterPage`（表单密集、影响面小，适合作为第一批验证）。
- **预计涉及文件**：新增 `src/components/Button.tsx`、`src/components/Input.tsx`（或类似命名）；修改 `src/pages/LoginPage.tsx`、`src/pages/RegisterPage.tsx`。

### Phase 3 — 内容阅读核心组件
- 重做 `ContentCard`、`TagList`、`VisibilityBadge`、`MarkdownRenderer`（含 `.prose` 相关调整）——这是"适合长期阅读"这一目标最核心的落地点。
- 用 Phase 2 的 `Button`/`Input` 替换 `ContentEditPage` 和 `MediaInsertMenu` 里的散装按钮/输入框。
- **预计涉及文件**：`src/components/ContentCard.tsx`、`src/components/TagList.tsx`、`src/components/VisibilityBadge.tsx`、`src/components/MarkdownRenderer.tsx`、`src/components/MediaInsertMenu.tsx`、`src/pages/ContentEditPage.tsx`。

### Phase 4 — 列表与详情页
- `ContentListPage` 筛选栏去 SaaS 化（当前的按钮式可见性筛选、下拉标签、搜索框都要换新组件），`ContentDetailPage` 统一阅读宽度来源。
- **预计涉及文件**：`src/pages/ContentListPage.tsx`、`src/pages/ContentDetailPage.tsx`。

### Phase 5 — 首页、工作台与头部
- `AppDashboard` 去卡片化改造（第 8 节、第 11.3 节），是本阶段工作量最大的部分。
- `HomePage` 视觉打磨（作为"编辑风格"基准页面，改动应最小，主要是同步新 token）。
- `AppHeader`、`PublicHeader`、`Footer`、`Logo` 统一断点策略与视觉细节（第 9.1 节），可选择性提取共享头部组件（非必需，视时间预算决定）。
- **预计涉及文件**：`src/pages/AppDashboard.tsx`、`src/pages/HomePage.tsx`、`src/components/AppHeader.tsx`、`src/components/PublicHeader.tsx`、`src/components/Footer.tsx`、`src/components/Logo.tsx`。

### Phase 6 — 响应式专项
- 按 1440/768/390 三档重新设计（而非压缩）移动端与平板布局，统一头部导航断点，修复 `MediaInsertMenu` 面板的视口边界问题。
- **预计涉及文件**：`src/components/AppHeader.tsx`、`src/components/PublicHeader.tsx`、`src/components/MediaInsertMenu.tsx`、`src/components/Footer.tsx`、以及 Phase 3–5 中已重构过的页面（做响应式复查，不一定产生大改动）。

### Phase 7 — 收尾验收
- 全站过一遍浅色/深色模式（`.dark` token 目前已定义但未见任何页面提供切换入口，需确认是否要在本次一并补上切换 UI，或维持"预留变量、暂不提供入口"的现状）。
- 视觉走查 + 与 `DESIGN_DIRECTION.md` 逐条对照验收。

---

## 13. 每阶段涉及文件汇总（速查表）

| Phase | 主要文件 |
|---|---|
| 0 | 无代码改动（决策 + 规划） |
| 1 | `src/index.css` |
| 2 | 新增 `Button`/`Input` 组件；`src/pages/LoginPage.tsx`、`src/pages/RegisterPage.tsx` |
| 3 | `src/components/ContentCard.tsx`、`TagList.tsx`、`VisibilityBadge.tsx`、`MarkdownRenderer.tsx`、`MediaInsertMenu.tsx`、`src/pages/ContentEditPage.tsx` |
| 4 | `src/pages/ContentListPage.tsx`、`src/pages/ContentDetailPage.tsx` |
| 5 | `src/pages/AppDashboard.tsx`、`src/pages/HomePage.tsx`、`src/components/AppHeader.tsx`、`PublicHeader.tsx`、`Footer.tsx`、`Logo.tsx` |
| 6 | `AppHeader.tsx`、`PublicHeader.tsx`、`MediaInsertMenu.tsx`、`Footer.tsx`（+ 复查前序阶段页面） |
| 7 | 无新增文件，验收走查 |

未被上表覆盖、本次重构预计**不需要改动**的文件：`src/App.tsx`（路由）、`src/types.ts`、`src/mockData.ts`、`src/main.tsx`、`vite.config.ts`、`package.json`——这也印证了第 11 节"路由与视觉解耦、重构风险可控"的判断。

---

## 附：本次审查中发现但超出"纯视觉"范围的问题（仅记录，不建议本次处理）

- `/app` 工作台路由没有任何鉴权保护，任何人直接访问 URL 即可进入。
- 语录（Quotes）模块数据模型与内容池未打通（第 10.1 节）。
- `MediaInsertMenu` 视频插入方式绕过了 Markdown 解析器的结构化处理，长期看有 PRD 18.7 节提到的安全清洗风险。
- 人生轨迹、足迹地图、飞行日志、加密空间四个 PRD 核心模块在前端完全没有落地页面。

这些属于产品/工程范畴的问题，建议在视觉重构完成后另行立项处理。
