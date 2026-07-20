import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .bootstrap import ensure_admin
from .config import get_settings
from .db import Base, SessionLocal, engine
from .routers import admin, auth, comments, content, drafts, library, trash, twofactor

settings = get_settings()

@asynccontextmanager
async def lifespan(_: FastAPI):
    # Without a handler, application log records are dropped. That matters
    # most for the console email backend, where the log is the only place a
    # verification code ever appears.
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(name)s %(message)s",
    )
    # Fine for SQLite and a single-owner deployment. A migration tool (Alembic)
    # should replace this before the schema changes under real data.
    Base.metadata.create_all(bind=engine)
    with SessionLocal() as db:
        ensure_admin(db)
    yield


app = FastAPI(
    title="LifeExpanse API",
    version="0.10.0",
    description="个人数字记录与公开分享平台的后端。权限在服务端强制执行。",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    # The session lives in an HttpOnly cookie, so credentials must be allowed
    # and the origin list cannot be a wildcard.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(content.router)
app.include_router(comments.router)
app.include_router(library.router)
app.include_router(trash.router)
app.include_router(drafts.router)
app.include_router(twofactor.router)
app.include_router(admin.router)


@app.get("/api/v1/health")
def health() -> dict[str, str]:
    return {"status": "ok", "version": app.version}
