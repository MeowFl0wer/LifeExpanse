# LifeExpanse

个人数字记录与公开分享平台 —— 前端原型。

> Life is an expanse, not a track.

融合个人知识管理（PKM）、日记、随想、人生轨迹、城市足迹和飞行记录的综合性 Web 平台，
既服务于个人私密记录，也支持将部分内容公开为个人主页。

## 当前状态

**前端原型阶段。**

所有数据来自 `src/mockData.ts`，尚无后端。数据只存在于内存，刷新页面即还原。
完整需求见 [`docs/LifeExpanse_完整需求规格_v1.8.md`](docs/LifeExpanse_完整需求规格_v1.8.md)。

### 已实现页面

| 路由 | 说明 |
|---|---|
| `/` · `/euan` | 公开个人主页 |
| `/login` · `/register` | 登录与注册 |
| `/app` | 登录后的私人工作台 |
| `/{username}/thoughts` | 随想（原创与摘录） |
| `/{username}/diary` | 日记 |
| `/{username}/pkm` | 笔记与文章 |
| `/{username}/trajectory` | 人生轨迹（热力图 / 时间线 / 月历） |
| `/{username}/map` | 足迹地图（城市级） |
| `/{username}/flights` | 飞行日志与航线图 |
| `/{username}/space` | 多密码加密互动空间入口 |
| `/new/{type}` | 创建模式（随想 / 日记 / 笔记 / 文章 / 轨迹） |
| `/search` | 统一搜索（遵守内容权限） |
| `/account` | 账号资料、安全、数据导出与备份 |
| `/admin` | 管理后台（仅站点主人） |

内容详情页 `/{username}/{section}/{slug}` 默认只读，
点击「编辑」后才进入 `/{username}/{section}/{slug}/edit` 编辑模式。

加密空间遵循「密码即入口」：`/{username}/space` 只显示欢迎语和密码框，
验证成功后进入 `/{username}/space/{opaque_key}`，会话只对该空间有效。

### 实现程度

页面和路由已按 v1.8 铺开，但**这仍是没有后端的前端原型**，不等于 v1.8 功能闭环。
具体分两类：

**交互真实（会真正改变页面内的数据，但只存在于内存，刷新即还原）**

- 创建内容：`/new/{type}` 保存后会写入内容列表，能在列表、搜索和详情页看到
- 人生轨迹批量记录：连续范围 / 日历多选 / 快捷选择，重复日期会提示，勾选后同步写入足迹
- 足迹到访录入：按「城市 + 国家」合并已有记录并累加到访次数；同名不同国不会被合并，
  缺国家且同名有多条时新建待确认记录；无坐标的城市标记为待确认、不落到地图上
- 飞行 CSV 导入：预览、去重、字段归一化；机场代码匹配不上会报错而不是猜坐标
- 随想快速输入：列表页顶部的快速输入会真正创建随想（默认私密）
- 文章评论、加密空间回复
- 权限判断：私密 / 草稿内容对非作者不可见（列表、搜索、详情页直达均已拦截）
- 加密空间密码流：失败不区分原因、连续失败锁定并倒计时、会话按 space_id 校验

**仅界面演示（点击后是提示框或仅本地 state，没有持久化）**

- 账号资料保存、主页可见性设置、修改密码
- 数据导出 / 导入、删除账号
- 后台备份与恢复、公告发布、邮件配置
- 加密空间的新建与设置、在空间内发布内容
- 笔记发布为文章 / 退回笔记（只切换当前页面显示）

登录状态存在 `localStorage`，加密空间访客会话存在 `sessionStorage`，
都只是原型替身——真实实现应使用 `HttpOnly + Secure + SameSite` Cookie 并由后端校验。

### 演示账号

```
用户名：euan
密码：demo123456
```

加密空间演示密码：`family2024`（给家人的信）、`oldfriends`（旧朋友）。

## 技术栈

- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4（通过 `@tailwindcss/vite`，无 PostCSS 配置）
- React Router 7

无第三方 UI 组件库；设计 token 与共用样式集中在 [`src/index.css`](src/index.css)。
视觉方向见 [`docs/DESIGN_DIRECTION.md`](docs/DESIGN_DIRECTION.md)。

## 开发

```bash
pnpm install
pnpm dev        # 开发服务器，默认 $PORT 或 8443
pnpm build      # 生产构建
pnpm preview    # 预览构建产物
pnpm test       # 运行单元测试（vitest）
pnpm test:watch # 监听模式
```

### 测试

纯逻辑部分抽到 `src/lib/` 并有单元测试覆盖：

| 模块 | 覆盖内容 |
|---|---|
| `lib/csv.ts` | RFC 4180 解析：引号内逗号、转义引号、换行、CRLF、空行、首尾空白 |
| `lib/slug.ts` | slug 生成与同名去重（`test` → `test-2`） |
| `lib/footprint.ts` | 足迹合并判定：城市 + 国家匹配、同名不同国、缺国家时的歧义处理 |

页面组件目前没有测试（无 DOM 测试环境），仍需手动验证。

## 目录结构

```
src/
├── App.tsx           # 路由表
├── auth.ts           # 前端会话（localStorage，原型用）
├── lib/              # 纯逻辑与单元测试（csv / slug / footprint）
├── mockData.ts       # 全部演示数据
├── types.ts          # 共用类型
├── index.css         # 设计 token 与全局样式
├── components/       # 共用组件
└── pages/            # 页面
docs/                 # 需求规格与设计文档
public/brand/         # 品牌与主视觉资源
```

## 后续计划

后端（FastAPI / SQLite）、多用户隔离、加密互动空间、
数据导出与备份恢复等，详见需求规格文档第 15、19、20 章。
