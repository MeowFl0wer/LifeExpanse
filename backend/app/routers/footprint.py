from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .. import cities
from ..db import get_db
from ..models import FootprintVisit, Place, User
from ..security import current_user, current_user_optional

router = APIRouter(prefix="/api/v1/footprint", tags=["footprint"])

"""
The footprint map.

City search is public (it is just the GeoNames dataset). Everything about a
user's own travel — their places and visits — is owner-scoped: the aggregated
map a visitor sees on a public homepage shows only what the owner made public,
and one person's history never leaks into another's.

A place is city-granularity with an alpha-3 country code; the coordinate comes
from the dataset, not the client, so a visit cannot be pinned to an arbitrary
point on the map.
"""

_ALPHA3 = r"^[A-Za-z]{3}$"


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------

class CityOut(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    country_code: str
    population: int


class VisitIn(BaseModel):
    city: str = Field(min_length=1, max_length=120)
    country_code: str = Field(pattern=_ALPHA3)
    visited_on: datetime
    note: str | None = Field(default=None, max_length=500)


class VisitOut(BaseModel):
    id: str
    place_id: str
    visited_on: datetime
    note: str | None
    source: str


class PlaceOut(BaseModel):
    id: str
    city: str
    country_code: str
    lat: float
    lng: float
    first_visit: datetime | None
    last_visit: datetime | None
    visit_count: int


# --------------------------------------------------------------------------
# City search — public
# --------------------------------------------------------------------------

@router.get("/cities", response_model=list[CityOut])
def search_cities(
    q: str = Query(min_length=1, max_length=80),
    country: str | None = Query(default=None, pattern=_ALPHA3),
    limit: int = Query(default=10, ge=1, le=25),
):
    """Resolves a typed city name to coordinates. Chinese input works: 上海
    matches Shanghai."""
    found = cities.search(q, country_code=country, limit=limit)
    return [
        CityOut(
            id=c.id, name=c.name, lat=c.lat, lng=c.lng,
            country_code=c.country_code, population=c.population,
        )
        for c in found
    ]


# --------------------------------------------------------------------------
# Places — the aggregated map
# --------------------------------------------------------------------------

def _place_rows(db: Session, owner: User) -> list[PlaceOut]:
    """Places with visit aggregates derived from real visit rows."""
    agg = (
        select(
            FootprintVisit.place_id,
            func.min(FootprintVisit.visited_on).label("first"),
            func.max(FootprintVisit.visited_on).label("last"),
            func.count().label("n"),
        )
        .where(FootprintVisit.owner_id == owner.id)
        .group_by(FootprintVisit.place_id)
        .subquery()
    )
    rows = db.execute(
        select(Place, agg.c.first, agg.c.last, agg.c.n)
        .join(agg, agg.c.place_id == Place.id)
        .where(Place.owner_id == owner.id)
        .order_by(agg.c.n.desc())
    ).all()

    return [
        PlaceOut(
            id=place.id, city=place.city, country_code=place.country_code,
            lat=place.lat, lng=place.lng,
            first_visit=first, last_visit=last, visit_count=n,
        )
        for place, first, last, n in rows
    ]


@router.get("/{username}/places", response_model=list[PlaceOut])
def list_places(
    username: str,
    viewer: User | None = Depends(current_user_optional),
    db: Session = Depends(get_db),
):
    """The owner's footprint. Only the owner sees it for now; a public-map
    filter arrives with the public homepage integration."""
    owner = db.scalar(select(User).where(func.lower(User.username) == username.lower()))
    if owner is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "用户不存在")
    # Until visit-level visibility exists, the footprint is the owner's alone.
    if viewer is None or viewer.id != owner.id:
        return []
    return _place_rows(db, owner)


# --------------------------------------------------------------------------
# Visits — recording travel
# --------------------------------------------------------------------------

@router.post("/visits", response_model=VisitOut, status_code=status.HTTP_201_CREATED)
def add_visit(
    payload: VisitIn,
    actor: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    """Records a visit, creating the place if it is new.

    The coordinate is looked up from the dataset by (city, country), not taken
    from the client — a visit cannot be pinned to an arbitrary point.
    """
    country_code = payload.country_code.upper()
    city = cities.resolve(payload.city, country_code)
    if city is None:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "找不到这座城市，请检查城市名与国家是否匹配",
        )

    place = db.scalar(
        select(Place).where(
            Place.owner_id == actor.id,
            Place.city == city.name,
            Place.country_code == country_code,
        )
    )
    if place is None:
        place = Place(
            owner_id=actor.id,
            city=city.name,
            country_code=country_code,
            lat=city.lat,
            lng=city.lng,
        )
        db.add(place)
        db.flush()

    visit = FootprintVisit(
        owner_id=actor.id,
        place_id=place.id,
        visited_on=payload.visited_on,
        note=payload.note,
        source="manual",
    )
    db.add(visit)
    db.commit()
    db.refresh(visit)
    return VisitOut(
        id=visit.id, place_id=visit.place_id, visited_on=visit.visited_on,
        note=visit.note, source=visit.source,
    )


@router.get("/places/{place_id}/visits", response_model=list[VisitOut])
def list_visits(
    place_id: str,
    actor: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    place = db.get(Place, place_id)
    if place is None or place.owner_id != actor.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "地点不存在")
    rows = db.scalars(
        select(FootprintVisit)
        .where(FootprintVisit.place_id == place_id, FootprintVisit.owner_id == actor.id)
        .order_by(FootprintVisit.visited_on.desc())
    ).all()
    return [
        VisitOut(id=v.id, place_id=v.place_id, visited_on=v.visited_on, note=v.note, source=v.source)
        for v in rows
    ]


@router.delete("/visits/{visit_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_visit(
    visit_id: str,
    actor: User = Depends(current_user),
    db: Session = Depends(get_db),
):
    visit = db.get(FootprintVisit, visit_id)
    if visit is None or visit.owner_id != actor.id:
        # Same 404 whether missing or not yours.
        raise HTTPException(status.HTTP_404_NOT_FOUND, "记录不存在")

    place_id = visit.place_id
    db.delete(visit)
    db.flush()

    # A place with no visits left is meaningless; drop it so the map does not
    # keep a point nothing references.
    remaining = db.scalar(
        select(func.count()).select_from(FootprintVisit).where(FootprintVisit.place_id == place_id)
    )
    if not remaining:
        place = db.get(Place, place_id)
        if place is not None:
            db.delete(place)
    db.commit()
