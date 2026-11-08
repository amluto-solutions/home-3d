"""Home 3D's own packs are amluto.*, published by Amluto Solutions from the GitHub organisation amluto-solutions.

What ships names only those ids; the prefix and the publisher are reserved for Home 3D's own packs, and only the
bundled packs and packs installed from amluto-solutions may use them.
"""

from __future__ import annotations

import json
import re

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.home_3d import moves, packs
from custom_components.home_3d.const import DOMAIN
from custom_components.home_3d.pack_index import DEFAULT_INDEX_URL, index_url
from custom_components.home_3d.packs import PackError

SAMPLE = packs.BUNDLED_DIR.parent / "sample" / "sample-home.json"
PART = {"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 0.55, "color": "fabric"}
CHAIR = {"id": "cube_chair", "name": {"en": "Cube chair"}, "size": [0.8, 0.8, 0.75], "parts": [PART]}


def _folder(pack_id: str, *, publisher: str) -> dict[str, str]:
    pack = {
        "format": "home3d-pack",
        "version": 2,
        "id": pack_id,
        "name": "A pack",
        "publisher": publisher,
        "licence": "MIT",
        "release": 1,
    }
    return {"pack.json": json.dumps(pack), "cube_chair.json": json.dumps(CHAIR)}


async def _setup(hass: HomeAssistant) -> None:
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)


# ---------------------------------------------------------------------------- what ships


def test_every_bundled_pack_is_an_amluto_pack() -> None:
    for root in (packs.BUNDLED_DIR, packs.BUNDLED_LANGUAGES_DIR):
        bundled = packs.load_bundled(root)
        assert bundled, root
        for pack in bundled:
            assert pack["id"].startswith(packs.RESERVED_PREFIX), pack["id"]
            assert pack["publisher"] == packs.RESERVED_PUBLISHER, pack["id"]
        # every folder is one of the packs
        assert sorted(f.name for f in root.iterdir() if f.is_dir()) == sorted(p["id"] for p in bundled)


def test_the_moved_items_table_and_the_sample_home_name_amluto_packs_only() -> None:
    for path in (moves.MOVES_FILE, SAMPLE):
        ids = set(re.findall(r'"pack:([a-z0-9_-]+\.[a-z0-9_-]+):', path.read_text(encoding="utf-8")))
        assert ids, path.name
        assert {i for i in ids if not i.startswith(packs.RESERVED_PREFIX)} == set(), path.name


def test_an_item_of_the_former_core_pack_resolves_to_its_pack_now() -> None:
    table = moves.load_moves()
    assert moves.resolve("pack:amluto.core:air_fryer", table) == "pack:amluto.kitchen-bath:air_fryer"
    assert moves.resolve("pack:amluto.living:sofa", table) == "pack:amluto.living:sofa"
    assert moves.resolve("sofa", table) == "sofa"


# ---------------------------------------------------------------------------- trust


@pytest.mark.parametrize(
    ("pack_id", "publisher"),
    [("amluto.chairs", "Acme"), ("acme.chairs", "Amluto Solutions"), ("acme.chairs", "amluto")],
)
def test_a_third_party_pack_can_not_use_the_prefix_or_the_publisher(pack_id: str, publisher: str) -> None:
    pack = {"id": pack_id, "publisher": publisher}
    assert packs.is_reserved(pack)
    for origin in (None, {"type": "github", "owner": "acme", "repo": "home-3d-packs"}):
        with pytest.raises(PackError) as err:
            packs.official_only(pack, origin)
        assert err.value.code == "reserved_id"
    for owner in ("amluto-solutions", "Amluto-Solutions"):
        assert packs.official_only(pack, {"type": "github", "owner": owner}) is pack


def test_a_pack_of_another_publisher_is_not_reserved() -> None:
    assert not packs.is_reserved({"id": "acme.chairs", "publisher": "Acme"})


async def test_a_file_can_not_bring_a_reserved_id(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {"type": "home_3d/packs/import", "files": _folder("amluto.garden", publisher="Acme"), "confirm": True}
    )
    refused = await client.receive_json()
    assert refused["error"]["code"] == "reserved_id"
    assert hass.data[DOMAIN].packs == []


def test_the_default_pack_list_is_the_amluto_one() -> None:
    assert DEFAULT_INDEX_URL == "https://raw.githubusercontent.com/amluto-solutions/home-3d-packs/main/index.json"
    assert index_url("") == DEFAULT_INDEX_URL
    assert packs.OFFICIAL_OWNER == "amluto-solutions"
