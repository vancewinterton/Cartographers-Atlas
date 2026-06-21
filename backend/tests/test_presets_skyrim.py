"""Backend tests for the Skyrim preset / template features (iteration 7)."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for inside-container test runs
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break

API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# --- Skyrim preset seed ---
class TestPresetsSeed:
    def test_list_presets_contains_skyrim(self, session):
        r = session.get(f"{API}/presets", timeout=20)
        assert r.status_code == 200, r.text
        presets = r.json()
        assert isinstance(presets, list) and len(presets) >= 1
        skyrim = [p for p in presets if p.get("name") == "Skyrim — The Province"]
        assert len(skyrim) >= 1, f"Skyrim preset missing. Got: {[p.get('name') for p in presets]}"
        p = skyrim[0]
        assert p.get("cover_image"), "cover_image is null/empty"
        # PresetMeta projection must not include 'data'
        assert "data" not in p, "PresetMeta should not include 'data' field"
        assert "id" in p


# --- POST /api/presets/{id}/use clones into a new campaign ---
class TestUsePreset:
    def test_use_skyrim_clones_into_new_campaign(self, session):
        presets = session.get(f"{API}/presets").json()
        skyrim = next(p for p in presets if p.get("name") == "Skyrim — The Province")
        preset_id = skyrim["id"]

        r = session.post(f"{API}/presets/{preset_id}/use", timeout=30)
        assert r.status_code == 200, r.text
        campaign = r.json()
        camp_id = campaign["id"]
        try:
            assert campaign["name"] == "Skyrim — The Province"

            # Fetch maps for cloned campaign
            r2 = session.get(f"{API}/campaigns/{camp_id}/maps", timeout=20)
            assert r2.status_code == 200, r2.text
            maps = r2.json()
            # Should have a root Skyrim map + nested Bleak Falls Barrow
            assert len(maps) >= 2, f"Expected >=2 maps, got {len(maps)}: {[m['name'] for m in maps]}"
            roots = [m for m in maps if m.get("parent_map_id") is None]
            assert len(roots) == 1, f"Expected exactly 1 root map, got {len(roots)}"
            root = roots[0]
            assert root["name"] == "Skyrim"
            assert root.get("image_data"), "Skyrim root map missing image_data"
            assert len(root.get("pins") or []) == 10, (
                f"Expected 10 pins (9 holds + Bleak Falls Barrow), got {len(root.get('pins') or [])}"
            )

            nested = [m for m in maps if m.get("parent_map_id") == root["id"]]
            assert len(nested) == 1, f"Expected 1 nested map, got {len(nested)}"
            barrow = nested[0]
            assert barrow["name"] == "Bleak Falls Barrow"
            assert barrow.get("parent_map_id") == root["id"]

            # Verify the barrow pin on root map points to the cloned barrow map id
            barrow_pins = [p for p in root["pins"] if p.get("label") == "Bleak Falls Barrow"]
            assert len(barrow_pins) == 1
            assert barrow_pins[0].get("linked_map_id") == barrow["id"], (
                "Pin linked_map_id was not remapped to cloned barrow id"
            )
        finally:
            # Cleanup the cloned test campaign
            session.delete(f"{API}/campaigns/{camp_id}")


# --- Save-as-preset round-trip ---
class TestSaveAsPreset:
    def test_save_campaign_as_preset_roundtrip(self, session):
        # Create a temp test campaign
        r = session.post(f"{API}/campaigns", json={
            "name": "TEST_SaveAsPreset_QA7",
            "description": "temp",
        }, timeout=20)
        assert r.status_code == 200, r.text
        camp_id = r.json()["id"]

        new_preset_id = None
        try:
            count_before = len(session.get(f"{API}/presets").json())

            r2 = session.post(f"{API}/campaigns/{camp_id}/save-as-preset", timeout=20)
            assert r2.status_code == 200, r2.text
            preset_meta = r2.json()
            new_preset_id = preset_meta["id"]
            assert preset_meta["name"] == "TEST_SaveAsPreset_QA7"
            assert "data" not in preset_meta

            # Confirm GET shows it
            after = session.get(f"{API}/presets").json()
            assert len(after) == count_before + 1
            assert any(p["id"] == new_preset_id for p in after)

            # Delete & confirm gone
            r3 = session.delete(f"{API}/presets/{new_preset_id}")
            assert r3.status_code == 200
            final = session.get(f"{API}/presets").json()
            assert not any(p["id"] == new_preset_id for p in final)
            new_preset_id = None  # marked clean
        finally:
            if new_preset_id:
                session.delete(f"{API}/presets/{new_preset_id}")
            session.delete(f"{API}/campaigns/{camp_id}")


# --- Import regression: nested maps + pin remap ---
class TestImportRegression:
    def test_import_clones_nested_maps_and_remaps_pins(self, session):
        import uuid as _uuid
        root_old = str(_uuid.uuid4())
        child_old = str(_uuid.uuid4())
        pin_id = str(_uuid.uuid4())
        bundle = {
            "format_version": 1,
            "campaign": {"name": "TEST_Import_QA7", "description": "tmp", "cover_image": None},
            "maps": [
                {
                    "id": root_old, "parent_map_id": None, "name": "Root",
                    "image_data": None, "image_width": 1600, "image_height": 1000,
                    "layers": [], "pins": [
                        {"id": pin_id, "x": 100, "y": 100, "label": "Entrance",
                         "linked_map_id": child_old},
                    ],
                },
                {
                    "id": child_old, "parent_map_id": root_old, "name": "Dungeon",
                    "image_data": None, "image_width": 1600, "image_height": 1000,
                    "layers": [], "pins": [],
                },
            ],
        }
        r = session.post(f"{API}/campaigns/import", json={"data": bundle}, timeout=20)
        assert r.status_code == 200, r.text
        camp = r.json()
        camp_id = camp["id"]
        try:
            maps = session.get(f"{API}/campaigns/{camp_id}/maps").json()
            roots = [m for m in maps if m["parent_map_id"] is None]
            assert len(roots) == 1
            root = roots[0]
            # IDs must have been regenerated
            assert root["id"] != root_old
            children = [m for m in maps if m["parent_map_id"] == root["id"]]
            assert len(children) == 1
            child = children[0]
            assert child["id"] != child_old
            # Pin should be remapped
            p = root["pins"][0]
            assert p["linked_map_id"] == child["id"], "linked_map_id was not remapped"
        finally:
            session.delete(f"{API}/campaigns/{camp_id}")
