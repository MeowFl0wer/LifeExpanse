# LifeExpanse

个人数字记录与公开分享平台 —— **前端原型**。

> Life is an expanse, not a track.

融合个人知识管理（PKM）、日记、随想、人生轨迹、城市足迹和飞行记录的综合性 Web 平台，
既服务于个人私密记录，也支持将部分内容公开为个人主页。

- 完整需求：[`docs/LifeExpanse_完整需求规格_v1.8.md`](docs/LifeExpanse_完整需求规格_v1.8.md)
- 视觉方向：[`docs/DESIGN_DIRECTION.md`](docs/DESIGN_DIRECTION.md)
- 版本变更：[`CHANGELOG.md`](CHANGELOG.md)

---

## ⚠️ 当前状态：v0.2.0 · 前端原型

**这个项目目前没有后端。** 所有数据来自 `src/mockData.ts` 的内存数组，
刷新页面即还原。登录、权限、保存、上传、备份全部是前端模拟，**不具备真实安全性**。

后端（API、数据库、鉴权、文件存储）尚未开始。详见 [架构现状](#架构现状)。

### 演示账号

```
用户名：euan
密码：demo123456
```

加密空间演示密码：`family2024`（给家人的信）、`oldfriends`（旧朋友）

---

## 功能清单

### 内容模块

| 模块 | 路由 | 状态 |
|---|---|---|
| 随想（原创 / 摘录） | `/{username}/thoughts` | 列表、快速输入、详情、编辑、删除 |
| 日记 | `/{username}/diary` | 列表、详情、编辑、删除 |
| 笔记与文章 | `/{username}/pkm` | 列表、文件夹 / 系列组织、详情、编辑、删除、评论 |
| 人生轨迹 | `/{username}/trajectory` | 热力图、时间线、月历、多日期批量记录 |
| 城市足迹 | `/{username}/map` | 世界地图、城市列表、手动添加到访记录 |
| 飞行日志 | `/{username}/flights` | 统计、航线图、手动录入、CSV 导入 |
| 独立加密空间 | `/{username}/space` | 密码入口、空间时间线、内容详情、匿名回复 |

### 平台页面

| 页面 | 路由 | 说明 |
|---|---|---|
| 公开主页 | `/` · `/{username}` | 个人简介、公开内容、私密板块提示 |
| 关于 | `/about` | 站点说明、板块导览、运行时长与访问统计 |
| 登录 / 注册 | `/login` · `/register` | 支持 `?next=` 回跳 |
| 工作台 | `/app` | 内容入口、最近更新、记录日历、统计 |
| 创建 | `/new/:type` | 五种内容类型的创建模式 |
| 搜索 | `/search` | 跨模块搜索，遵守内容权限 |
| 账号 | `/account` | 资料、安全、设备、数据导出导入 |
| 回收站 | `/trash` | 恢复、彻底删除、清空 |
| 管理后台 | `/admin` | 注册模式、用户、邀请码、备份、安全日志 |

### 关键行为

**可见性**：每条内容为 公开 / 私密 / 草稿。
未登录访客只能看到公开内容；私密与草稿即使知道链接也返回 404。
人生轨迹、城市足迹、飞行记录默认整体私密，访客只看到条数与登录提示。

**只读优先**：已保存内容默认只读，点击「编辑」才进入编辑模式，
离开未保存的编辑页会提醒。

**笔记库层级**：系列 > 文件夹 > 内容。
一条内容可归入多个文件夹与系列，一个文件夹可归入多个系列。
内容跟随所在文件夹进入系列，不会在系列中脱离文件夹单独出现。

**回收站**：删除的内容保留 30 天，可恢复，超期自动清理。

---

## 技术栈

| 层 | 选型 |
|---|---|
| 框架 | React 19 + TypeScript 5.9 |
| 构建 | Vite 8 |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite`，无 PostCSS 配置） |
| 路由 | React Router 7 |
| 测试 | Vitest + jsdom + Testing Library |
| 包管理 | pnpm（`packageManager` 已声明） |

无第三方 UI 组件库；设计 token 与共用样式集中在 [`src/index.css`](src/index.css)。

---

## 架构现状

### 目录结构

```
src/
├── App.tsx           # 路由表与权限守卫
├── auth.ts           # 前端会话（响应式 store，原型用）
├── mockData.ts       # 内存数据存储 + 全部读写函数
├── types.ts          # 共用类型
├── index.css         # 设计 token 与全局样式
├── lib/              # 纯逻辑与单元测试
├── components/       # 共用组件
├── pages/            # 页面
└── test/setup.ts     # 测试环境
docs/                 # 需求规格与设计文档
public/brand/         # 品牌与主视觉资源
```

### 前后端分离情况

**尚未分离，因为后端还不存在。**

当前数据流是：页面组件 → 直接 `import { allContent, addContentItem } from '../mockData'`
→ 操作模块级数组。共有 20 个页面/组件直接依赖 `mockData`，没有 API 层、
没有网络请求、没有加载与错误状态。

这意味着接入真实后端时，这 20 个文件的数据调用都需要改写。
建议在开始写后端前先插入一层 `src/api/`，把同步调用改成返回 Promise 的异步接口，
让组件先具备 async / loading / error 的处理能力，再把实现从内存换成 `fetch`。

### 代码规范情况

**较好的部分**
- TypeScript `strict` 全开，含 `noUnusedLocals` / `noUnusedParameters`
- 纯逻辑抽到 `src/lib/`，186 个测试覆盖，可独立验证
- 权限判断收敛到 `auth.ts`，层级规则收敛到 `lib/library.ts`
- 内容主存储 `allContent` 为唯一读取入口，种子数组不导出（编译期防止读到过期快照）

**待改进的部分**
- 缺少 API / service 层（见上）
- `mockData.ts` 约 900 行，同时承担数据与业务逻辑，接入后端时需拆分
- 没有 ESLint（仅有 `oxfmt` 格式化）
- 部分页面组件偏长（`ContentListPage` 约 600 行），可继续拆分
- 没有 CI，测试需手动运行

---

## 开发

本项目使用 **pnpm**。没有全局 pnpm 时可用 Node 自带的 corepack：

```bash
corepack enable          # 之后可直接使用 pnpm
# 或不启用，直接前缀调用：corepack pnpm <命令>
```

```bash
pnpm install
pnpm dev        # 开发服务器，默认 $PORT 或 8443
pnpm build      # 生产构建
pnpm preview    # 预览构建产物
pnpm test       # 运行单元测试
pnpm test:watch # 监听模式
```

**关于 npm**：`npm test` / `npm run build` 等*运行脚本*没有问题（已验证结果一致）。
但不要用 `npm install` 安装依赖——那会生成与 `pnpm-lock.yaml` 竞争的
`package-lock.json`。安装请统一用 pnpm。

### 测试

```
186 个测试 / 16 个文件
```

| 模块 | 覆盖内容 |
|---|---|
| `lib/csv.ts` | RFC 4180 解析：引号内逗号、转义引号、换行、CRLF、首尾空白 |
| `lib/slug.ts` | slug 生成与同名去重 |
| `lib/footprint.ts` | 足迹合并：城市 + 国家匹配、同名不同国、缺国家时的歧义处理 |
| `lib/library.ts` | 系列 > 文件夹 > 内容的多对多归属规则、`#标签` 提取 |
| `lib/redirect.ts` | 登录回跳校验：拒绝站外、协议相对、回到登录页 |
| `lib/markdownImport.ts` | front-matter、首个一级标题、文件名兜底、类型与大小校验 |
| `lib/trash.ts` | 回收站保留期与到期判定 |
| `auth.ts` | 会话读写、两种持久化模式、管理员与归属判断 |
| `PublicHeader` | 登录 / 登出切换、挂载后登录仍会更新 |
| `ContentListPage` | 各板块渲染、访客看不到私密与草稿、空态文案 |
| `PkmFacets` | 文件夹 / 系列浏览与下钻、标签条多选、访客看不到私密库结构 |
| `PrivateModules` | 三个私密板块对访客只显示数量与提示 |
| `LoginFlow` · `LoginTimer` | 登录回跳、会话存储模式、受保护路由、跳转定时器清理 |
| `ContentActions` | 删除两步确认、编辑器字段可见性、导入入口 |
| `Trash` | 软删除后从各页面消失、恢复、到期清理、彻底删除 |

页面组件测试覆盖主要流程；地图绘制与富交互仍需手动验证。

---

## 后续计划

1. **插入 API 层** —— 把 `mockData` 的同步调用改为异步接口，为接入后端做准备
2. **后端** —— FastAPI / SQLite，实现鉴权、内容 CRUD、权限过滤（后端强制）
3. **文件存储** —— 图片与小视频上传、私密资源鉴权访问
4. **数据导出与备份恢复** —— 用户级合并导入、系统级完整备份
5. **部署** —— Docker Compose、HTTPS、定期备份

详见需求规格文档第 19、20、23 章。
