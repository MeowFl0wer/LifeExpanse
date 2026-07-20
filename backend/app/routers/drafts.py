import json
from datetime import timedelta

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import Draft, User, utcnow
from ..schemas import DraftIn, DraftOut
from ..security import current_user

router = APIRouter(prefix="/api/v1/drafts", tags=["drafts"])


def _prune(db: Session, owner_id: str) -> None:
    cutoff = utcnow() - timedelta(days=get_settings().draft_retention_days)
    stale = db.scalars(
        select(Draft).where(Draft.owner_id == owner_id, Draft.saved_at < cutoff)
    ).all()
    for d in stale:
        db.delete(d)
    if stale:
        db.commit()


def _out(d: Draft) -> DraftOut:
    return DraftOut(
        key=d.key, payload=json.loads(d.payload),
        base_updated_at=d.base_updated_at, saved_at=d.saved_at,
    )


@router.get("", response_model=list[DraftOut])
def list_drafts(actor: User = Depends(current_user), db: Session = Depends(get_db)):
    _prune(db, actor.id)
    rows = db.scalars(
        select(Draft).where(Draft.owner_id == actor.id).order_by(Draft.saved_at.desc())
    ).all()
    return [_out(d) for d in rows]


@router.get("/{key:path}", response_model=DraftOut | None)
def get_draft(key: str, actor: User = Depends(current_user), db: Session = Depends(get_db)):
    _prune(db, actor.id)
    d = db.scalar(select(Draft).where(Draft.owner_id == actor.id, Draft.key == key))
    return _out(d) if d else None


@router.put("/{key:path}", response_model=DraftOut)
def put_draft(
    key: str, payload: DraftIn,
    actor: User = Depends(current_user), db: Session = Depends(get_db),
):
    """Upsert. Drafts are per-user, so one account never sees another's."""
    d = db.scalar(select(Draft).where(Draft.owner_id == actor.id, Draft.key == key))
    if d is None:
        d = Draft(owner_id=actor.id, key=key, payload="{}")
        db.add(d)
    d.payload = json.dumps(payload.payload, ensure_ascii=False)
    d.base_updated_at = payload.base_updated_at
    d.saved_at = utcnow()
    db.commit()
    db.refresh(d)
    return _out(d)


@router.delete("/{key:path}", status_code=status.HTTP_204_NO_CONTENT)
def delete_draft(key: str, actor: User = Depends(current_user), db: Session = Depends(get_db)):
    d = db.scalar(select(Draft).where(Draft.owner_id == actor.id, Draft.key == key))
    if d:
        db.delete(d)
        db.commit()
