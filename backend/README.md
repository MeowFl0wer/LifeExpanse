# LifeExpanse 后端

FastAPI + SQLAlchemy + SQLite。**权限在这里强制执行**——前端的同类判断只服务于界面，
不构成安全边界。

## 快速开始

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements-dev.txt

# 首次运行需要允许注册，之后建议改回 closed
LIFE_REGISTRATION_MODE=open uvicorn app.main:app --reload --port 8000
```

接口文档：http://localhost:8000/docs

```bash
pytest -q          # 55 个测试
```

## 配置

全部通过环境变量（前缀 `LIFE_`）或 `.env` 提供：

| 变量 | 默认 | 说明 |
|---|---|---|
| `LIFE_SECRET_KEY` | `dev-only-change-me` | **部署必须覆盖**。`openssl rand -hex 32` |
| `LIFE_DATABASE_URL` | `sqlite:///./data/lifeexpanse.db` | 数据库位置 |
| `LIFE_SITE_OWNER` | `euan` | 唯一可进入 `/admin` 的账号 |
| `LIFE_REGISTRATION_MODE` | `closed` | `closed` / `invite` / `open` |
| `LIFE_CORS_ORIGINS` | localhost | 允许携带 Cookie 调用的来源，逗号分隔 |
| `LIFE_SESSION_DAYS` | `30` | 「保持登录」的有效期 |
| `LIFE_TRASH_RETENTION_DAYS` | `30` | 回收站保留期 |
| `LIFE_DRAFT_RETENTION_DAYS` | `14` | 草稿保留期 |

## 接口

| 分组 | 路径 |
|---|---|
| 鉴权 | `POST /api/v1/auth/register` `login` `logout`，`GET me` `sessions` |
| 内容 | `GET/POST /api/v1/content`，`GET /{author}/{type}/{slug}`，`PATCH/DELETE /{id}`，`POST /{id}/publish` `revert` |
| 库 | `GET/POST/PATCH/DELETE /api/v1/library/folders` 与 `/series` |
| 回收站 | `GET /api/v1/trash`，`POST /{id}/restore`，`DELETE /{id}`，`DELETE /`（清空） |
| 草稿 | `GET/PUT/DELETE /api/v1/drafts/{key}`，`GET /api/v1/drafts` |
| 评论 | `GET/POST /api/v1/content/{id}/comments`，`DELETE /{comment_id}` |

## 安全设计

- **密码**：Argon2id（passlib）。明文不落库、不进日志
- **会话**：不可猜测的随机 id，存 HttpOnly Cookie；勾选「保持登录」才设 `max_age`，
  否则随浏览器会话结束。生产环境需把 `secure=True` 打开（见 `routers/auth.py`）
- **可见性**：每次读取都在服务端过滤。私密与草稿内容对非作者一律 404
- **不存在与无权限返回同一个 404**：避免用响应差异探测哪些 id / slug 存在
- **写操作校验归属**：`services.owned_content` / `owned_folder` / `owned_series`
  是唯一入口，路由无法绕过
- **删除是软删除**：进回收站，超期由 `purge_expired` 清理
- **删除容器不删内容**：删除文件夹或系列只解除关联

## 尚未实现

- 加密互动空间（需求 15）
- 人生轨迹 / 城市足迹 / 飞行记录（模型可直接照内容表扩展）
- 图片与小视频上传（需求 18）
- 数据导出与系统备份（需求 19）
- 限流、邮件、邀请码校验的完整流程
- 数据库迁移工具（当前用 `create_all`，schema 变动前应换成 Alembic）
