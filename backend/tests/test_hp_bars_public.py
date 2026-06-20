"""Tests for new campaign hp_bars_public field & share endpoint propagation."""
import os
import uuid
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://campaign-forge-129.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def campaign():
    # CREATE
    r = requests.post(f"{BASE_URL}/api/campaigns", json={"name": f"TEST_HP_{uuid.uuid4().hex[:6]}", "description": "hp bars test"})
    assert r.status_code == 200, r.text
    data = r.json()
    yield data
    # cleanup
    requests.delete(f"{BASE_URL}/api/campaigns/{data['id']}")


def test_campaign_default_hp_bars_public_true(campaign):
    r = requests.get(f"{BASE_URL}/api/campaigns/{campaign['id']}")
    assert r.status_code == 200
    data = r.json()
    assert "hp_bars_public" in data, "hp_bars_public field missing on campaign"
    assert data["hp_bars_public"] is True, f"Expected default True, got {data['hp_bars_public']}"


def test_patch_hp_bars_public_false(campaign):
    r = requests.patch(f"{BASE_URL}/api/campaigns/{campaign['id']}", json={"hp_bars_public": False})
    assert r.status_code == 200, r.text
    assert r.json()["hp_bars_public"] is False

    # Verify persistence with GET
    r2 = requests.get(f"{BASE_URL}/api/campaigns/{campaign['id']}")
    assert r2.json()["hp_bars_public"] is False


def test_patch_hp_bars_public_true_again(campaign):
    r = requests.patch(f"{BASE_URL}/api/campaigns/{campaign['id']}", json={"hp_bars_public": True})
    assert r.status_code == 200
    assert r.json()["hp_bars_public"] is True


def test_share_endpoint_returns_hp_bars_public_flag(campaign):
    # Set hp_bars_public to False
    requests.patch(f"{BASE_URL}/api/campaigns/{campaign['id']}", json={"hp_bars_public": False})
    # Enable share
    sr = requests.post(f"{BASE_URL}/api/campaigns/{campaign['id']}/share")
    assert sr.status_code == 200
    token = sr.json()["share_token"]
    assert token

    # Fetch shared
    g = requests.get(f"{BASE_URL}/api/share/{token}")
    assert g.status_code == 200, g.text
    body = g.json()
    assert "campaign" in body and "maps" in body
    assert "hp_bars_public" in body["campaign"]
    assert body["campaign"]["hp_bars_public"] is False, "Share endpoint did not propagate hp_bars_public=False"

    # Flip true and re-check share
    requests.patch(f"{BASE_URL}/api/campaigns/{campaign['id']}", json={"hp_bars_public": True})
    g2 = requests.get(f"{BASE_URL}/api/share/{token}")
    assert g2.json()["campaign"]["hp_bars_public"] is True


def test_list_campaigns_includes_hp_bars_public():
    r = requests.get(f"{BASE_URL}/api/campaigns")
    assert r.status_code == 200
    items = r.json()
    assert isinstance(items, list)
    if items:
        # at least one entry should expose the field (default True for legacy ones, included by model)
        sample = items[0]
        assert "hp_bars_public" in sample
