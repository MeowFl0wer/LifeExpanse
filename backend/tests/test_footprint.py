"""The footprint map: city search, recording visits, owner isolation."""

from tests.conftest import login, register


def add_visit(client, city="上海", country="CHN", visited_on="2024-05-01T00:00:00", note=None):
    return client.post("/api/v1/footprint/visits", json={
        "city": city, "country_code": country, "visited_on": visited_on, "note": note,
    })


# --------------------------------------------------------------------------
# City search — public dataset
# --------------------------------------------------------------------------

def test_city_search_is_public(client):
    res = client.get("/api/v1/footprint/cities", params={"q": "tokyo"})
    assert res.status_code == 200
    assert any(c["name"] == "Tokyo" for c in res.json())


def test_chinese_input_matches_an_english_named_city(client):
    """The whole reason the dataset carries CJK aliases."""
    res = client.get("/api/v1/footprint/cities", params={"q": "上海"})
    top = res.json()[0]
    assert top["name"] == "Shanghai"
    assert top["country_code"] == "CHN"


def test_search_narrows_by_country(client):
    res = client.get("/api/v1/footprint/cities", params={"q": "Paris", "country": "FRA"})
    assert all(c["country_code"] == "FRA" for c in res.json())


def test_a_shared_name_offers_the_larger_city_first(client):
    res = client.get("/api/v1/footprint/cities", params={"q": "Springfield"})
    populations = [c["population"] for c in res.json()]
    assert populations == sorted(populations, reverse=True)


# --------------------------------------------------------------------------
# Recording a visit
# --------------------------------------------------------------------------

def test_a_visit_creates_a_place_with_dataset_coordinates(client):
    register(client, "euan")
    login(client, "euan")
    res = add_visit(client, "上海", "CHN")
    assert res.status_code == 201

    places = client.get("/api/v1/footprint/euan/places").json()
    assert len(places) == 1
    place = places[0]
    assert place["city"] == "Shanghai"
    assert place["country_code"] == "CHN"
    # The coordinate is the dataset's, not anything the client sent.
    assert 31 < place["lat"] < 32
    assert 121 < place["lng"] < 122


def test_the_coordinate_cannot_be_supplied_by_the_client(client):
    """The visit payload has no lat/lng field; it comes only from the dataset."""
    register(client, "euan")
    login(client, "euan")
    res = client.post("/api/v1/footprint/visits", json={
        "city": "上海", "country_code": "CHN", "visited_on": "2024-05-01T00:00:00",
        "lat": 0.0, "lng": 0.0,  # ignored — not part of the schema
    })
    assert res.status_code == 201
    place = client.get("/api/v1/footprint/euan/places").json()[0]
    assert place["lat"] != 0.0


def test_a_second_visit_to_the_same_city_reuses_the_place(client):
    register(client, "euan")
    login(client, "euan")
    add_visit(client, "上海", "CHN", "2024-05-01T00:00:00")
    add_visit(client, "上海", "CHN", "2024-08-01T00:00:00")

    places = client.get("/api/v1/footprint/euan/places").json()
    assert len(places) == 1
    assert places[0]["visit_count"] == 2


def test_place_aggregates_first_and_last_visit(client):
    register(client, "euan")
    login(client, "euan")
    add_visit(client, "上海", "CHN", "2024-08-01T00:00:00")
    add_visit(client, "上海", "CHN", "2024-05-01T00:00:00")

    place = client.get("/api/v1/footprint/euan/places").json()[0]
    assert place["first_visit"].startswith("2024-05-01")
    assert place["last_visit"].startswith("2024-08-01")


def test_an_unknown_city_is_refused(client):
    register(client, "euan")
    login(client, "euan")
    res = add_visit(client, "Neverland", "CHN")
    assert res.status_code == 400


def test_a_guest_cannot_record_a_visit(client):
    assert add_visit(client).status_code == 401


# --------------------------------------------------------------------------
# Owner isolation
# --------------------------------------------------------------------------

def test_one_persons_footprint_does_not_leak_into_anothers(client):
    register(client, "alice")
    login(client, "alice")
    add_visit(client, "Tokyo", "JPN")
    client.post("/api/v1/auth/logout")

    register(client, "euan")
    login(client, "euan")
    add_visit(client, "上海", "CHN")

    # euan sees only their own city, not alice's.
    mine = client.get("/api/v1/footprint/euan/places").json()
    assert [p["city"] for p in mine] == ["Shanghai"]


def test_two_users_visiting_the_same_city_are_separate_rows(client):
    register(client, "alice")
    login(client, "alice")
    add_visit(client, "Tokyo", "JPN")
    client.post("/api/v1/auth/logout")

    register(client, "euan")
    login(client, "euan")
    add_visit(client, "Tokyo", "JPN")

    assert len(client.get("/api/v1/footprint/euan/places").json()) == 1


def test_a_guest_sees_an_empty_footprint(client):
    register(client, "euan")
    login(client, "euan")
    add_visit(client, "上海", "CHN")
    client.post("/api/v1/auth/logout")

    # Visit-level visibility is not built yet, so the footprint is private.
    assert client.get("/api/v1/footprint/euan/places").json() == []


# --------------------------------------------------------------------------
# Deletion
# --------------------------------------------------------------------------

def test_deleting_the_last_visit_removes_the_place(client):
    register(client, "euan")
    login(client, "euan")
    add_visit(client, "上海", "CHN")

    place = client.get("/api/v1/footprint/euan/places").json()[0]
    visit = client.get(f"/api/v1/footprint/places/{place['id']}/visits").json()[0]

    assert client.delete(f"/api/v1/footprint/visits/{visit['id']}").status_code == 204
    # No visits left, so the place is gone too — the map keeps no stray point.
    assert client.get("/api/v1/footprint/euan/places").json() == []


def test_deleting_one_of_several_visits_keeps_the_place(client):
    register(client, "euan")
    login(client, "euan")
    add_visit(client, "上海", "CHN", "2024-05-01T00:00:00")
    add_visit(client, "上海", "CHN", "2024-08-01T00:00:00")

    place = client.get("/api/v1/footprint/euan/places").json()[0]
    visits = client.get(f"/api/v1/footprint/places/{place['id']}/visits").json()
    client.delete(f"/api/v1/footprint/visits/{visits[0]['id']}")

    remaining = client.get("/api/v1/footprint/euan/places").json()
    assert len(remaining) == 1
    assert remaining[0]["visit_count"] == 1


def test_cannot_delete_another_users_visit(client):
    register(client, "alice")
    login(client, "alice")
    add_visit(client, "Tokyo", "JPN")
    place = client.get("/api/v1/footprint/alice/places").json()[0]
    visit = client.get(f"/api/v1/footprint/places/{place['id']}/visits").json()[0]
    client.post("/api/v1/auth/logout")

    register(client, "euan")
    login(client, "euan")
    assert client.delete(f"/api/v1/footprint/visits/{visit['id']}").status_code == 404


def test_cannot_read_another_users_visits(client):
    register(client, "alice")
    login(client, "alice")
    add_visit(client, "Tokyo", "JPN")
    place = client.get("/api/v1/footprint/alice/places").json()[0]
    client.post("/api/v1/auth/logout")

    register(client, "euan")
    login(client, "euan")
    assert client.get(f"/api/v1/footprint/places/{place['id']}/visits").status_code == 404
