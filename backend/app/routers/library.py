from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Content, Folder, Series, User
from ..schemas import FolderOut, LibraryIn, SeriesOut
from ..security import current_user, current_user_optional
from .. import services as svc

router = APIRouter(prefix="/api/v1/library", tags=["library"])


def _folder_out(f: Folder) -> FolderOut:
    return FolderOut(
        id=f.id, name=f.name, description=f.description, cover=f.cover,
        owner=f.owner_id, series_ids=[s.id for s in f.series], created_at=f.created_at,
    )


def _series_out(s: Series) -> SeriesOut:
    return SeriesOut(
        id=s.id, name=s.name, description=s.description, cover=s.cover,
        owner=s.owner_id, created_at=s.created_at,
    )


@router.get("/folders", response_model=list[FolderOut])
def list_folders(
    author: str,
    viewer: User | None = Depends(current_user_optional),
    db: Session = Depends(get_db),
):
    """A folder's name and description are themselves metadata, so a guest only
    sees folders that actually hold something public."""
    owner = svc.get_user_by_username(db, author)
    folders = list(db.scalars(select(Folder).where(Folder.owner_id == owner.id)).all())
    if viewer is not None and viewer.id == owner.id:
        return [_folder_out(f) for f in folders]
    return [
        _folder_out(f)
        for f in folders
        if any(c.visibility == "public" and c.deleted_at is None for c in f.contents)
    ]


@router.get("/series", response_model=list[SeriesOut])
def list_series(
    author: str,
    viewer: User | None = Depends(current_user_optional),
    db: Session = Depends(get_db),
):
    owner = svc.get_user_by_username(db, author)
    entries = list(db.scalars(select(Series).where(Series.owner_id == owner.id)).all())
    if viewer is not None and viewer.id == owner.id:
        return [_series_out(s) for s in entries]

    def has_public(s: Series) -> bool:
        direct = any(c.visibility == "public" and c.deleted_at is None for c in s.contents)
        via_folder = any(
            c.visibility == "public" and c.deleted_at is None
            for f in s.folders for c in f.contents
        )
        return direct or via_folder

    return [_series_out(s) for s in entries if has_public(s)]


@router.post("/folders", response_model=FolderOut, status_code=status.HTTP_201_CREATED)
def create_folder(payload: LibraryIn, actor: User = Depends(current_user), db: Session = Depends(get_db)):
    folder = Folder(
        owner_id=actor.id, name=payload.name.strip(),
        description=payload.description.strip(), cover=payload.cover,
    )
    folder.series = [svc.owned_series(db, sid, actor) for sid in dict.fromkeys(payload.series_ids)]
    db.add(folder)
    db.commit()
    db.refresh(folder)
    return _folder_out(folder)


@router.patch("/folders/{folder_id}", response_model=FolderOut)
def update_folder(
    folder_id: str, payload: LibraryIn,
    actor: User = Depends(current_user), db: Session = Depends(get_db),
):
    folder = svc.owned_folder(db, folder_id, actor)
    folder.name = payload.name.strip()
    folder.description = payload.description.strip()
    folder.cover = payload.cover
    folder.series = [svc.owned_series(db, sid, actor) for sid in dict.fromkeys(payload.series_ids)]
    db.commit()
    db.refresh(folder)
    return _folder_out(folder)


@router.delete("/folders/{folder_id}")
def delete_folder(folder_id: str, actor: User = Depends(current_user), db: Session = Depends(get_db)):
    """Deleting a container never deletes what it held — content is detached."""
    folder = svc.owned_folder(db, folder_id, actor)
    detached = len(folder.contents)
    folder.contents = []
    folder.series = []
    db.delete(folder)
    db.commit()
    return {"detached": detached}


@router.post("/series", response_model=SeriesOut, status_code=status.HTTP_201_CREATED)
def create_series(payload: LibraryIn, actor: User = Depends(current_user), db: Session = Depends(get_db)):
    entry = Series(
        owner_id=actor.id, name=payload.name.strip(),
        description=payload.description.strip(), cover=payload.cover,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _series_out(entry)


@router.patch("/series/{series_id}", response_model=SeriesOut)
def update_series(
    series_id: str, payload: LibraryIn,
    actor: User = Depends(current_user), db: Session = Depends(get_db),
):
    entry = svc.owned_series(db, series_id, actor)
    entry.name = payload.name.strip()
    entry.description = payload.description.strip()
    entry.cover = payload.cover
    db.commit()
    db.refresh(entry)
    return _series_out(entry)


@router.delete("/series/{series_id}")
def delete_series(series_id: str, actor: User = Depends(current_user), db: Session = Depends(get_db)):
    entry = svc.owned_series(db, series_id, actor)
    detached_folders = len(entry.folders)
    detached_items = len(entry.contents)
    entry.folders = []
    entry.contents = []
    db.delete(entry)
    db.commit()
    return {"detached_folders": detached_folders, "detached_items": detached_items}
