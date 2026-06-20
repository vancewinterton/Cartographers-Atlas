"""Backend tests for new Campaign Export/Import endpoints."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def seeded_campaign(s):
    """Create a campaign with root map + sub map + pin linking to submap."""
    cr = s.post(f"{API}/campaigns", json={"name": "TEST_Export", "description": "exp desc"})
    assert cr.status_code == 200, cr.text
    cid = cr.json()["id"]

    rm = s.get(f"{API}/campaigns/{cid}/root_map").json()
    root_id = rm["id"]

    # Create submap
    sub = s.post(f"{API}/maps", json={
        "campaign_id": cid, "name": "Dungeon", "parent_map_id": root_id
    }).json()
    sub_id = sub["id"]

    # Attach a pin on root map linking to sub
    pins = [{"id": "P1", "x": 0.3, "y": 0.4, "label": "Stairs", "linked_map_id": sub_id}]
    layers = [{"id": "L1", "name": "base", "visible": True, "shapes": [
        {"id": "S1", "type": "token", "x": 0.5, "y": 0.5, "name": "Goblin", "color": "#ef4444",
         "hp": 7, "maxHp": 7, "ac": 13, "initBonus": 2,
         "attacks": [{"id": "A1", "name": "Scimitar", "toHit": 4, "damageDice": "1d6", "damageBonus": 2, "damageType": "slashing", "numAttacks": 1}]}
    ]}]
    pr = s.patch(f"{API}/maps/{root_id}", json={"pins": pins, "layers": layers})
    assert pr.status_code == 200, pr.text

    yield {"campaign_id": cid, "root_map_id": root_id, "sub_map_id": sub_id}

    # cleanup
    s.delete(f"{API}/campaigns/{cid}")


def test_export_returns_bundle(s, seeded_campaign):
    cid = seeded_campaign["campaign_id"]
    r = s.get(f"{API}/campaigns/{cid}/export")
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["format_version"] == 1
    assert "exported_at" in data
    assert data["campaign"]["id"] == cid
    assert data["campaign"]["name"] == "TEST_Export"
    # share_token must be stripped
    assert data["campaign"]["share_token"] is None
    # maps include root + sub
    map_ids = [m["id"] for m in data["maps"]]
    assert seeded_campaign["root_map_id"] in map_ids
    assert seeded_campaign["sub_map_id"] in map_ids
    # pins and shapes preserved
    root = next(m for m in data["maps"] if m["id"] == seeded_campaign["root_map_id"])
    assert len(root["pins"]) == 1
    assert root["pins"][0]["linked_map_id"] == seeded_campaign["sub_map_id"]
    assert len(root["layers"]) == 1
    assert root["layers"][0]["shapes"][0]["name"] == "Goblin"


def test_export_404(s):
    r = s.get(f"{API}/campaigns/nope-{uuid.uuid4()}/export")
    assert r.status_code == 404


def test_import_round_trip(s, seeded_campaign):
    cid = seeded_campaign["campaign_id"]
    export = s.get(f"{API}/campaigns/{cid}/export").json()

    # Import - no rename
    r = s.post(f"{API}/campaigns/import", json={"data": export})
    assert r.status_code == 200, r.text
    new_camp = r.json()
    new_cid = new_camp["id"]
    assert new_cid != cid  # fresh id
    assert new_camp["name"] == "TEST_Export"
    assert new_camp["share_token"] is None

    try:
        # Maps should exist with new ids and remapped parent/linked refs
        maps = s.get(f"{API}/campaigns/{new_cid}/maps").json()
        assert len(maps) == 2
        # Find new root + new sub
        new_root = next(m for m in maps if m["parent_map_id"] is None)
        new_sub = next(m for m in maps if m["parent_map_id"] is not None)
        # parent_map_id remapped to new root id
        assert new_sub["parent_map_id"] == new_root["id"]
        # pin linked_map_id remapped to new sub id
        assert len(new_root["pins"]) == 1
        assert new_root["pins"][0]["linked_map_id"] == new_sub["id"]
        # shape/token preserved
        assert new_root["layers"][0]["shapes"][0]["name"] == "Goblin"
        assert new_root["layers"][0]["shapes"][0]["attacks"][0]["damageDice"] == "1d6"
        # new map ids must not be old ones
        new_ids = {m["id"] for m in maps}
        assert seeded_campaign["root_map_id"] not in new_ids
        assert seeded_campaign["sub_map_id"] not in new_ids
    finally:
        s.delete(f"{API}/campaigns/{new_cid}")


def test_import_with_rename(s, seeded_campaign):
    cid = seeded_campaign["campaign_id"]
    export = s.get(f"{API}/campaigns/{cid}/export").json()
    r = s.post(f"{API}/campaigns/import", json={"data": export, "rename": "Renamed Camp"})
    assert r.status_code == 200
    new_cid = r.json()["id"]
    try:
        assert r.json()["name"] == "Renamed Camp"
    finally:
        s.delete(f"{API}/campaigns/{new_cid}")


def test_import_invalid_payload(s):
    r = s.post(f"{API}/campaigns/import", json={"data": {}})
    assert r.status_code == 400

    r2 = s.post(f"{API}/campaigns/import", json={"data": {"campaign": {"name": "x"}, "maps": "not-a-list"}})
    assert r2.status_code == 400


def test_import_empty_maps_guarantees_root(s):
    """If export has empty maps list, importer should still create a World Map root."""
    payload = {"data": {"campaign": {"name": "TEST_NoMaps", "description": ""}, "maps": []}}
    r = s.post(f"{API}/campaigns/import", json=payload)
    assert r.status_code == 200
    new_cid = r.json()["id"]
    try:
        rm = s.get(f"{API}/campaigns/{new_cid}/root_map")
        assert rm.status_code == 200
        assert rm.json()["name"] == "World Map"
    finally:
        s.delete(f"{API}/campaigns/{new_cid}")
