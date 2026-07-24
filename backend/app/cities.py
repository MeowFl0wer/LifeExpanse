from __future__ import annotations

import gzip
import json
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

"""
City lookup for footprint entry.

The dataset (GeoNames cities15000, ~34k cities) lives here rather than in the
frontend bundle: it is only needed to resolve a typed city name to
coordinates, and shipping ~4 MB to every visitor to power one form would be
the wrong trade. The map renders coordinates already stored on visits, so it
never needs this table.

Loaded once, lazily, on the first search. A CJK-aware index lets a Chinese
user type 上海 and match Shanghai, whose primary name is English.

GeoNames data is CC BY 4.0; the About page credits it.
"""

_DATA = Path(__file__).parent / "data" / "cities.json.gz"

# Split on whitespace and punctuation so "new york" matches "New York" and a
# comma or apostrophe in a name does not block a match.
_TOKEN = re.compile(r"[^\w一-鿿]+")


@dataclass(frozen=True)
class City:
    id: str
    name: str
    ascii: str
    lat: float
    lng: float
    country_code: str  # alpha-3
    population: int
    alt: tuple[str, ...]

    def as_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "lat": self.lat,
            "lng": self.lng,
            "country_code": self.country_code,
            "population": self.population,
        }


@lru_cache(maxsize=1)
def _cities() -> list[City]:
    with gzip.open(_DATA, "rt", encoding="utf-8") as handle:
        raw = json.load(handle)
    # Already sorted most-populous-first by the generator, so a shared name
    # offers the large city before the village.
    return [
        City(
            id=c["id"],
            name=c["name"],
            ascii=c["ascii"],
            lat=c["lat"],
            lng=c["lng"],
            country_code=c["cc"],
            population=c["pop"],
            alt=tuple(c["alt"]),
        )
        for c in raw
    ]


def _normalise(text: str) -> str:
    return _TOKEN.sub("", text).lower()


@lru_cache(maxsize=1)
def _index() -> dict[str, list[int]]:
    """Normalised name → indices into the city list, for exact resolution."""
    index: dict[str, list[int]] = {}
    for i, city in enumerate(_cities()):
        for label in (city.name, city.ascii, *city.alt):
            index.setdefault(_normalise(label), []).append(i)
    return index


def search(query: str, *, country_code: str | None = None, limit: int = 10) -> list[City]:
    """Prefix search over names and CJK aliases.

    Exact matches come first, then prefix matches, both already ordered by
    population from the underlying list. `country_code` (alpha-3) narrows the
    result when the caller knows the country — the way to disambiguate two
    cities that share a name.
    """
    q = _normalise(query)
    if not q:
        return []

    cities = _cities()
    seen: set[int] = set()
    exact: list[int] = []
    prefix: list[int] = []

    for norm, indices in _index().items():
        if norm == q:
            exact.extend(indices)
        elif norm.startswith(q):
            prefix.extend(indices)

    results: list[City] = []
    for i in [*exact, *prefix]:
        if i in seen:
            continue
        seen.add(i)
        city = cities[i]
        if country_code and city.country_code != country_code.upper():
            continue
        results.append(city)
        if len(results) >= limit:
            break

    # `exact` and `prefix` were each population-ordered, but concatenating them
    # is not, so a final stable sort keeps the biggest cities on top.
    results.sort(key=lambda c: c.population, reverse=True)
    return results[:limit]


def resolve(city_name: str, country_code: str) -> City | None:
    """The one city that a name + country identifies, or None.

    Used when saving a place: the pair must land on exactly one coordinate,
    and picking the wrong one would pin a visit to the wrong spot on the map.
    """
    matches = search(city_name, country_code=country_code, limit=1)
    return matches[0] if matches else None
