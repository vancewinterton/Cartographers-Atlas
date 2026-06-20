"""Backend tests for Cartographer's Atlas API."""
import os
import base64
import io
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://heromap-studio.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="module")
def small_png_b64():
    # 1x1 red PNG (tiny). Spec says 1024x1024 solid color but a valid PNG is sufficient for input ref.
    png_bytes = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    )
    return base64.b64encode(png_bytes).decode("utf-8")


# ---- Root ----
def test_root(s):
    r = s.get(f"{API}/")
    assert r.status_code == 200
    assert "Cartographer" in r.json().get("message", "")


# ---- Campaign CRUD + auto root map ----
campaign_state = {}


def test_create_campaign(s):
    r = s.post(f"{API}/campaigns", json={"name": "TEST_Camp", "description": "desc1"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == "TEST_Camp"
    assert data["description"] == "desc1"
    assert "id" in data
    campaign_state["id"] = data["id"]


def test_list_campaigns(s):
    r = s.get(f"{API}/campaigns")
    assert r.status_code == 200
    ids = [c["id"] for c in r.json()]
    assert campaign_state["id"] in ids


def test_get_campaign(s):
    r = s.get(f"{API}/campaigns/{campaign_state['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == campaign_state["id"]


def test_patch_campaign(s):
    r = s.patch(f"{API}/campaigns/{campaign_state['id']}", json={"description": "new desc"})
    assert r.status_code == 200
    assert r.json()["description"] == "new desc"
    # verify via GET
    r2 = s.get(f"{API}/campaigns/{campaign_state['id']}")
    assert r2.json()["description"] == "new desc"


def test_root_map_auto_created(s):
    r = s.get(f"{API}/campaigns/{campaign_state['id']}/root_map")
    assert r.status_code == 200, r.text
    rm = r.json()
    assert rm["campaign_id"] == campaign_state["id"]
    assert rm["parent_map_id"] is None
    campaign_state["root_map_id"] = rm["id"]


def test_list_maps_has_root(s):
    r = s.get(f"{API}/campaigns/{campaign_state['id']}/maps")
    assert r.status_code == 200
    ids = [m["id"] for m in r.json()]
    assert campaign_state["root_map_id"] in ids


# ---- Map CRUD + nested + cascade delete ----
def test_create_submap(s):
    r = s.post(f"{API}/maps", json={
        "campaign_id": campaign_state["id"],
        "name": "Dungeon",
        "parent_map_id": campaign_state["root_map_id"],
    })
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["parent_map_id"] == campaign_state["root_map_id"]
    campaign_state["submap_id"] = data["id"]


def test_patch_map_layers_pins_roundtrip(s):
    layers = [{"id": "L1", "name": "base", "visible": True, "shapes": [
        {"type": "rect", "x": 10, "y": 20, "w": 30, "h": 40, "color": "#fff"}
    ]}]
    pins = [{"id": "P1", "x": 0.5, "y": 0.6, "label": "Cave", "linked_map_id": campaign_state["submap_id"]}]
    r = s.patch(f"{API}/maps/{campaign_state['root_map_id']}", json={"layers": layers, "pins": pins})
    assert r.status_code == 200
    # GET-verify persistence
    r2 = s.get(f"{API}/maps/{campaign_state['root_map_id']}")
    assert r2.status_code == 200
    body = r2.json()
    assert body["layers"] == layers
    assert body["pins"] == pins


def test_delete_parent_cascades(s):
    # Create another parent and child to test cascade
    pr = s.post(f"{API}/maps", json={"campaign_id": campaign_state["id"], "name": "Parent"})
    parent_id = pr.json()["id"]
    cr = s.post(f"{API}/maps", json={
        "campaign_id": campaign_state["id"], "name": "Child", "parent_map_id": parent_id
    })
    child_id = cr.json()["id"]
    # delete parent
    dr = s.delete(f"{API}/maps/{parent_id}")
    assert dr.status_code == 200
    # both should be gone
    assert s.get(f"{API}/maps/{parent_id}").status_code == 404
    assert s.get(f"{API}/maps/{child_id}").status_code == 404


# ---- AI redraw ----
def test_ai_redraw_invalid_model(s):
    r = s.post(f"{API}/ai/redraw", json={"prompt": "x", "model": "bogus"})
    assert r.status_code == 400


def test_ai_redraw_openai(s):
    r = s.post(f"{API}/ai/redraw",
               json={"prompt": "ancient elven citadel at sunset", "model": "openai"},
               timeout=180)
    assert r.status_code == 200, r.text[:500]
    b64 = r.json().get("image_base64", "")
    assert isinstance(b64, str) and len(b64) > 100


def test_ai_redraw_gemini(s, small_png_b64):
    r = s.post(f"{API}/ai/redraw",
               json={"prompt": "medieval port city with stone harbor",
                     "model": "gemini",
                     "image_base64": small_png_b64},
               timeout=180)
    assert r.status_code == 200, r.text[:500]
    b64 = r.json().get("image_base64", "")
    assert isinstance(b64, str) and len(b64) > 100


# ---- Cleanup: delete campaign ----
def test_zz_delete_campaign(s):
    r = s.delete(f"{API}/campaigns/{campaign_state['id']}")
    assert r.status_code == 200
    # campaign gone
    assert s.get(f"{API}/campaigns/{campaign_state['id']}").status_code == 404
    # maps gone too
    r2 = s.get(f"{API}/campaigns/{campaign_state['id']}/maps")
    assert r2.json() == []
