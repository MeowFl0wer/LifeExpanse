# LifeExpanse

个人数字记录与公开分享平台 —— 前端原型。

> Life is an expanse, not a track.

融合个人知识管理（PKM）、日记、随想、人生轨迹、城市足迹和飞行记录的综合性 Web 平台，
既服务于个人私密记录，也支持将部分内容公开为个人主页。

## 当前状态

**v0.0.1 — 前端原型阶段。**

所有数据来自 `src/mockData.ts`，尚无后端。登录、保存、上传等操作均为前端模拟。
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

### 演示账号

```
用户名：euan
密码：demo123456
```

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
pnpm dev      # 开发服务器，默认 $PORT 或 8443
pnpm build    # 生产构建
pnpm preview  # 预览构建产物
```

## 目录结构

```
src/
├── App.tsx           # 路由表
├── auth.ts           # 前端会话（localStorage，原型用）
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
