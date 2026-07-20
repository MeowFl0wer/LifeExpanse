from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Content, User
from ..schemas import TrashOut
from ..security import current_user
from .. import services as svc

router = APIRouter(prefix="/api/v1/trash", tags=["trash"])


def _binned(db: Session, content_id: str, actor: User) -> Content:
    item = db.get(Content, content_id)
    if item is None or item.author_id != actor.id or item.deleted_at is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, svc.NOT_FOUND)
    return item


@router.get("", response_model=list[TrashOut])
def list_trash(actor: User = Depends(current_user), db: Session = Depends(get_db)):
    # Anything past its window is gone on arrival, so the bin never shows an
    # item the retention policy says should already have been cleared.
    svc.purge_expired(db)
    rows = db.scalars(
        select(Content)
        .where(Content.author_id == actor.id, Content.deleted_at.is_not(None))
        .order_by(Content.deleted_at.desc())
    ).all()
    return [
        TrashOut(
            item=svc.to_out(i),
            deleted_at=i.deleted_at,
            days_remaining=svc.trash_days_remaining(i.deleted_at),
        )
        for i in rows
    ]


@router.post("/{content_id}/restore")
def restore(content_id: str, actor: User = Depends(current_user), db: Session = Depends(get_db)):
    item = _binned(db, content_id, actor)
    # The slug may have been taken while this sat in the bin.
    clash = db.scalar(
        select(Content).where(
            Content.author_id == actor.id,
            Content.slug == item.slug,
            Content.id != item.id,
            Content.deleted_at.is_(None),
        )
    )
    if clash:
        item.slug = svc.unique_slug(db, actor.id, item.slug)
    item.deleted_at = None
    db.commit()
    db.refresh(item)
    return svc.to_out(item)


@router.delete("/{content_id}", status_code=status.HTTP_204_NO_CONTENT)
def purge(content_id: str, actor: User = Depends(current_user), db: Session = Depends(get_db)):
    db.delete(_binned(db, content_id, actor))
    db.commit()


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
def empty(actor: User = Depends(current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(Content).where(Content.author_id == actor.id, Content.deleted_at.is_not(None))
    ).all()
    for item in rows:
        db.delete(item)
    db.commit()
