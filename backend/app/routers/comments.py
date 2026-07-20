from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import Comment, Content, User
from ..schemas import CommentIn, CommentOut
from ..security import current_user, current_user_optional
from .. import services as svc

router = APIRouter(prefix="/api/v1/content/{content_id}/comments", tags=["comments"])


def _readable(db: Session, content_id: str, viewer: User | None) -> Content:
    item = db.get(Content, content_id)
    if item is None or not svc.visible_to(item, viewer):
        raise HTTPException(status.HTTP_404_NOT_FOUND, svc.NOT_FOUND)
    return item


@router.get("", response_model=list[CommentOut])
def list_comments(
    content_id: str,
    viewer: User | None = Depends(current_user_optional),
    db: Session = Depends(get_db),
):
    item = _readable(db, content_id, viewer)
    rows = db.scalars(
        select(Comment).where(Comment.content_id == item.id, Comment.hidden.is_(False))
        .order_by(Comment.created_at)
    ).all()
    out = []
    for c in rows:
        author = db.get(User, c.author_id)
        out.append(CommentOut(
            id=c.id, content_id=c.content_id,
            author=author.username if author else "",
            author_display_name=author.display_name if author else "",
            body=c.body, created_at=c.created_at,
        ))
    return out


@router.post("", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
def add_comment(
    content_id: str, payload: CommentIn,
    actor: User = Depends(current_user), db: Session = Depends(get_db),
):
    """需求 11: only registered, signed-in users may comment, and only where the
    author switched comments on."""
    item = _readable(db, content_id, actor)
    if not item.allow_comments:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "这篇内容没有开启评论")
    comment = Comment(content_id=item.id, author_id=actor.id, body=payload.body.strip())
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return CommentOut(
        id=comment.id, content_id=item.id, author=actor.username,
        author_display_name=actor.display_name, body=comment.body, created_at=comment.created_at,
    )


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_comment(
    content_id: str, comment_id: str,
    actor: User = Depends(current_user), db: Session = Depends(get_db),
):
    """A commenter may delete their own; the content author may remove any on
    their own content."""
    comment = db.get(Comment, comment_id)
    if comment is None or comment.content_id != content_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "评论不存在")
    item = db.get(Content, content_id)
    if comment.author_id != actor.id and (item is None or item.author_id != actor.id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "评论不存在")
    db.delete(comment)
    db.commit()
