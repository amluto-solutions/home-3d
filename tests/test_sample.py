"""The sample home (#54, #101): a furnished two-storey house that anyone can load as a home of its own.

It ships in the public repository, so no real house data may be in it: every entity id is a generic placeholder
(`<domain>.sample_<what>`). A maintainer can also check it against a private list of words from their own house
(entity ids, names) that never enters the repository: set HOME3D_SAMPLE_DENYLIST to a file with one word per line.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import re
import subprocess
import sys

from homeassistant.core import HomeAssistant
import pytest

from custom_components.home_3d.packs import load_bundled
from custom_components.home_3d.recipes import used_pack_types
from custom_components.home_3d.sample import PLACEHOLDER, SAMPLE_FILE, entity_ids
from custom_components.home_3d.schema import BUILDING_SCHEMA
from tests.test_homes import _call, _named, _ok
from tests.test_init import _setup

ROOT = Path(__file__).resolve().parent.parent


def _sample() -> dict:
    return json.loads(SAMPLE_FILE.read_text(encoding="utf-8"))


def _strings(value) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, dict):
        return [s for k, v in value.items() for s in (k, *_strings(v))]
    if isinstance(value, list):
        return [s for v in value for s in _strings(v)]
    return []


def test_the_sample_is_a_valid_two_storey_building() -> None:
    building = BUILDING_SCHEMA(_sample())
    assert len(building["floors"]) == 2
    assert sum(len(f["furniture"]) for f in building["floors"]) > 50


def test_every_pack_item_in_the_sample_comes_from_a_bundled_pack() -> None:
    """No household's own items: the sample renders the same on every install."""
    building = _sample()
    bundled = {f"pack:{p['id']}:{i['id']}" for p in load_bundled() for i in p["items"]}
    assert used_pack_types(building) - bundled == set()
    assert set(building["recipes"]) <= bundled


def test_every_entity_id_in_the_sample_is_a_placeholder() -> None:
    ids = entity_ids(_sample())
    assert len(ids) >= 40
    assert [i for i in ids if not PLACEHOLDER.match(i)] == []


def test_the_sample_names_no_real_house_data() -> None:
    """No Home Assistant floor ids, people, presence or tablet users from the house it was built in."""
    building = _sample()
    assert all(f["ha_floor"] is None for f in building["floors"])
    assert all(r.get("area_id") is None for f in building["floors"] for r in f["rooms"])
    assert building.get("presence", []) == []
    settings = building["settings"]
    assert settings.get("tablet_users", []) == []
    assert not any(isinstance(v, str) and re.search(r"\d+\.\d+\.\d+\.\d+|https?://", v) for v in _strings(building))


def test_the_sample_is_a_demo_home_without_area_import() -> None:
    settings = _sample()["settings"]
    assert settings["demo"] is True
    assert settings["area_import"] is False


@pytest.mark.skipif(not os.environ.get("HOME3D_SAMPLE_DENYLIST"), reason="no private house word list given")
def test_the_sample_has_no_word_from_the_private_denylist() -> None:
    words = [
        w.strip().lower()
        for w in Path(os.environ["HOME3D_SAMPLE_DENYLIST"]).read_text(encoding="utf-8").splitlines()
        if w.strip() and not w.startswith("#")
    ]
    text = SAMPLE_FILE.read_text(encoding="utf-8").lower()
    tokens = set(re.split(r"[^a-z0-9]+", text))
    # short words only count as whole words (between separators, `_` included), longer ones anywhere
    found = [w for w in words if (w in tokens if len(w) < 5 else w in text)]
    assert found == []


async def test_loading_the_sample_adds_a_new_demo_home(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    before = await _ok(client, {"type": "home_3d/homes/list"})
    result = await _ok(client, {"type": "home_3d/homes/load_sample"})
    assert result["home"]["name"] == "Sample Home"
    assert result["home"]["id"] not in {h["id"] for h in before["homes"]}
    assert len(result["homes"]) == len(before["homes"]) + 1
    assert result["home"]["floors"] == 2
    # like any new home (#58) it does not take over the displays
    assert result["active"] == before["active"]
    got = await _ok(client, {"type": "home_3d/building/get", "home_id": result["home"]["id"]})
    assert len(got["building"]["floors"]) == 2
    assert got["building"]["settings"]["demo"] is True
    assert got["building"]["settings"]["area_import"] is False


async def test_loading_the_sample_never_overwrites_a_home(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    own = (await _ok(client, {"type": "home_3d/homes/list"}))["active"]
    await _ok(client, {"type": "home_3d/building/save", "building": _named("Mine")})
    first = await _ok(client, {"type": "home_3d/homes/load_sample"})
    second = await _ok(client, {"type": "home_3d/homes/load_sample"})
    assert first["home"]["id"] != second["home"]["id"]
    assert second["home"]["name"] == "Sample Home 2"
    mine = await _ok(client, {"type": "home_3d/building/get", "home_id": own})
    assert mine["building"]["floors"][0]["rooms"][0]["name"] == "Mine"


async def test_a_viewer_cannot_load_the_sample(
    hass: HomeAssistant, hass_ws_client, hass_admin_user, hass_read_only_access_token
) -> None:
    await _setup(hass)
    viewer = await hass_ws_client(hass, hass_read_only_access_token)
    reply = await _call(viewer, {"type": "home_3d/homes/load_sample"})
    assert reply["success"] is False
    assert reply["error"]["code"] == "unauthorized"


def test_the_check_script_lists_every_entity_id_in_the_sample() -> None:
    out = subprocess.run(
        [sys.executable, str(ROOT / "tools" / "sample_entities.py")], capture_output=True, text=True, check=True
    ).stdout
    listed = {line.split()[0] for line in out.splitlines() if line.strip()}
    assert listed == set(entity_ids(_sample()))
    assert "sensor.sample_solar_power" in listed
