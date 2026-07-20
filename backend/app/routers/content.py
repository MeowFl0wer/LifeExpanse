from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Content, User, utcnow
from ..schemas import ContentIn, ContentOut, ContentPatch
from ..security import current_user, current_user_optional
from .. import services as svc

router = APIRouter(prefix="/api/v1/content", tags=["content"])


@router.get("", response_model=list[ContentOut])
def list_content(
    author: str,
    type: str | None = None,
    kind: str | None = None,
    folder_id: str | None = None,
    series_id: str | None = None,
    tag: list[str] | None = Query(default=None),
    keyword: str | None = None,
    visibility: str | None = None,
    favourite_only: bool = False,
    include_archived: bool = False,
    viewer: User | None = Depends(current_user_optional),
    db: Session = Depends(get_db),
):
    """Lists an author's content. Visibility is applied here, not by the caller."""
    owner = svc.get_user_by_username(db, author)
    stmt = svc.live_content_query(owner.id, viewer)
    if type:
        stmt = stmt.where(Content.type == type)
    if kind:
        stmt = stmt.where(Content.content_kind == kind)
    if visibility:
        stmt = stmt.where(Content.visibility == visibility)
    if favourite_only:
        stmt = stmt.where(Content.favorite.is_(True))
    if not include_archived:
        stmt = stmt.where(Content.archived.is_(False))

    items = list(db.scalars(stmt.order_by(Content.created_at.desc())).all())

    if folder_id:
        items = [i for i in items if any(f.id == folder_id for f in i.folders)]
    if series_id:
        items = [i for i in items if any(s.id == series_id for s in i.series)]
    if tag:
        wanted = set(tag)
        items = [i for i in items if wanted & {t.name for t in i.tags}]
    if keyword:
        kw = keyword.lower()
        items = [i for i in items if kw in i.title.lower() or kw in i.summary.lower()]

    return [svc.to_out(i) for i in items]


@router.get("/{author}/{type}/{slug}", response_model=ContentOut)
def get_one(
    author: str,
    type: str,
    slug: str,
    viewer: User | None = Depends(current_user_optional),
    db: Session = Depends(get_db),
):
    """Scoped to author *and* type: another user's slug, or a diary entry
    requested through the notes route, must not resolve here."""
    owner = svc.get_user_by_username(db, author)
    item = db.scalar(
        select(Content).where(
            Content.author_id == owner.id, Content.slug == slug, Content.type == type
        )
    )
    if item is None or not svc.visible_to(item, viewer):
        raise HTTPException(status.HTTP_404_NOT_FOUND, svc.NOT_FOUND)
    return svc.to_out(item)


@router.post("", response_model=ContentOut, status_code=status.HTTP_201_CREATED)
def create(payload: ContentIn, actor: User = Depends(current_user), db: Session = Depends(get_db)):
    title = payload.title.strip() or payload.body.strip()[:30]
    item = Content(
        author_id=actor.id,
        slug=svc.unique_slug(db, actor.id, svc.slugify(title, f"entry-{int(utcnow().timestamp())}")),
        type=payload.type,
        content_kind=payload.content_kind,
        thought_type=payload.thought_type,
        title=title,
        body=payload.body,
        summary=(payload.summary or payload.body).strip()[:200],
        visibility=payload.visibility,
        category=payload.category,
        cover=payload.cover,
        seo_title=payload.seo_title,
        seo_description=payload.seo_description,
        # Enforced rather than trusted: a note cannot be created with comments on.
        allow_comments=(
            payload.type == "pkm"
            and payload.content_kind == "article"
            and (payload.allow_comments if payload.allow_comments is not None else True)
        ),
        favorite=bool(payload.favorite),
        archived=bool(payload.archived),
        source_author=payload.source_author,
        source_title=payload.source_title,
        source_type=payload.source_type,
        source_url=payload.source_url,
        source_locator=payload.source_locator,
        published_at=None if payload.visibility == "draft" else utcnow(),
    )
    db.add(item)
    db.flush()
    svc.set_tags(db, item, payload.tags)
    svc.apply_membership(db, item, actor, payload.folder_ids, payload.series_ids)
    db.commit()
    db.refresh(item)
    return svc.to_out(item)


@router.patch("/{content_id}", response_model=ContentOut)
def update(
    content_id: str,
    payload: ContentPatch,
    actor: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    item = svc.owned_content(db, content_id, actor)
    data = payload.model_dump(exclude_unset=True)

    if "title" in data:
        if not str(data["title"]).strip():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "标题不能为空")
        item.title = str(data["title"]).strip()
    for field in (
        "body", "summary", "visibility", "content_kind", "thought_type", "category",
        "cover", "seo_title", "seo_description", "favorite", "archived",
    ):
        if field in data:
            setattr(item, field, data[field])

    # Applied after content_kind so switching form and flag in one request
    # cannot leave a note with comments enabled.
    if "allow_comments" in data:
        item.allow_comments = svc.normalise_comment_flag(item, data["allow_comments"])
    elif "content_kind" in data:
        item.allow_comments = svc.normalise_comment_flag(item, item.allow_comments)

    if "tags" in data:
        svc.set_tags(db, item, data["tags"] or [])
    if "folder_ids" in data or "series_ids" in data:
        svc.apply_membership(
            db, item, actor,
            data.get("folder_ids", [f.id for f in item.folders]),
            data.get("series_ids", [s.id for s in item.series]),
        )

    db.commit()
    db.refresh(item)
    return svc.to_out(item)


@router.post("/{content_id}/publish", response_model=ContentOut)
def publish_as_article(
    content_id: str, actor: User = Depends(current_user), db: Session = Depends(get_db)
):
    """Note -> article, keeping the same id, slug and body."""
    item = svc.owned_content(db, content_id, actor)
    if item.type != "pkm":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "只有笔记可以发布为文章")
    item.content_kind = "article"
    item.allow_comments = True
    db.commit()
    db.refresh(item)
    return svc.to_out(item)


@router.post("/{content_id}/revert", response_model=ContentOut)
def revert_to_note(
    content_id: str, actor: User = Depends(current_user), db: Session = Depends(get_db)
):
    item = svc.owned_content(db, content_id, actor)
    item.content_kind = "note"
    item.allow_comments = False
    db.commit()
    db.refresh(item)
    return svc.to_out(item)


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
def soft_delete(content_id: str, actor: User = Depends(current_user), db: Session = Depends(get_db)):
    """Moves content to the recycle bin rather than removing it."""
    item = svc.owned_content(db, content_id, actor)
    item.deleted_at = utcnow()
    db.commit()
