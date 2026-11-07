"""Home 3D moved to Amluto (#424): its packs are amluto.* instead of theovencook.*.

Old ids keep working wherever they can be stored: placed items and recipe copies in a plan, a backup, an installed
pack, a pin or a rollback entry, the language pack a device's language comes from. Both prefixes stay reserved for
Home 3D's own packs; the official GitHub owner is amluto-solutions, and theovencook still counts for packs already
installed from there.
"""

from __future__ import annotations

import json
from pathlib import Path

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.home_3d import moves, packs
from custom_components.home_3d.const import (
    DATA_PACK_UPDATES,
    DOMAIN,
    STORAGE_KEY_BUILDING,
    STORAGE_KEY_PACK_UPDATES,
    STORAGE_KEY_PACKS,
)
from custom_components.home_3d.pack_index import DEFAULT_INDEX_URL, index_url
from custom_components.home_3d.packs import PackError

ROOT = Path(__file__).resolve().parent.parent
LIVING = next(p for p in packs.load_bundled() if p["id"] == "amluto.living")
SOFA = LIVING["items"][0]
OLD_SOFA = f"pack:theovencook.living:{SOFA['id']}"
NEW_SOFA = f"pack:amluto.living:{SOFA['id']}"
# an item of the former core pack (#111): theovencook.core -> theovencook.kitchen-bath -> amluto.kitchen-bath
OLD_CORE = "pack:theovencook.core:air_fryer"
NEW_CORE = "pack:amluto.kitchen-bath:air_fryer"
KITCHEN = next(p for p in packs.load_bundled() if p["id"] == "amluto.kitchen-bath")
AIR_FRYER = next(i for i in KITCHEN["items"] if i["id"] == "air_fryer")

PART = {"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 0.55, "color": "fabric"}
CHAIR = {"id": "cube_chair", "name": {"en": "Cube chair"}, "size": [0.8, 0.8, 0.75], "parts": [PART]}


def _furniture(item_id: str, type_: str) -> dict:
    return {"id": item_id, "type": type_, "x": 1, "z": 1, "rotation": 0, "w": 0.8, "d": 0.8, "h": 0.75, "variant": None}


def _copy(pack: str, item: dict, release: int = 4) -> dict:
    """A recipe copy as a plan saved before #424 keeps it."""
    return {"pack": pack, "item": item["id"], "release": release, "recipe": item}


def _old_plan() -> dict:
    """A sofa of theovencook.living and an air fryer of the former theovencook.core, with their recipe copies."""
    return {
        "version": 1,
        "settings": {"wall_exterior": 0.24, "wall_interior": 0.12, "grid": 0.05},
        "floors": [
            {
                "id": "f1",
                "name": "Ground floor",
                "elevation": 0,
                "height": 2.5,
                "cut_height": 1.15,
                "rooms": [],
                "openings": [],
                "furniture": [_furniture("a", OLD_SOFA), _furniture("b", OLD_CORE), _furniture("c", "sofa")],
                "placements": [],
                "background": None,
            }
        ],
        "recipes": {OLD_SOFA: _copy("theovencook.living", SOFA), OLD_CORE: _copy("theovencook.core", AIR_FRYER)},
    }


def _types(building: dict) -> list[str]:
    return [f["type"] for floor in building["floors"] for f in floor["furniture"]]


def _folder(pack_id: str, *, release: int = 1, publisher: str = "theovencook", **extra) -> dict[str, str]:
    pack = {
        "format": "home3d-pack",
        "version": 2,
        "id": pack_id,
        "name": "A pack",
        "publisher": publisher,
        "licence": "MIT",
        "release": release,
        **extra,
    }
    return {"pack.json": json.dumps(pack), "cube_chair.json": json.dumps(CHAIR)}


def _origin(owner: str, folder: str) -> dict:
    return {
        "type": "github",
        "url": f"https://github.com/{owner}/home-3d-packs/tree/main/{folder}",
        "owner": owner,
        "repo": "home-3d-packs",
        "ref": "main",
        "default_branch": False,
        "folder": folder,
        "commit": "a" * 40,
    }


async def _setup(hass: HomeAssistant) -> None:
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)


async def _send(client, **msg) -> dict:
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def _call(client, **msg) -> dict:
    result = await _send(client, **msg)
    assert result["success"], result
    return result["result"]


# ---------------------------------------------------------------------------- nothing old is left in what ships


def test_no_theovencook_id_is_left_in_the_bundled_packs() -> None:
    for root in (packs.BUNDLED_DIR, packs.BUNDLED_LANGUAGES_DIR):
        bundled = packs.load_bundled(root)
        assert bundled, root
        for pack in bundled:
            assert pack["id"].startswith("amluto."), pack["id"]
            assert pack["publisher"] == "Amluto Solutions", pack["id"]
            assert (root / pack["id"] / packs.PACK_FILE).is_file()
        assert not [f.name for f in root.iterdir() if f.name.startswith("theovencook.")]
    # the moved-items table and the sample home name the new ids only
    for path in (moves.MOVES_FILE, ROOT / "custom_components" / "home_3d" / "sample" / "sample-home.json"):
        assert "theovencook." not in path.read_text(encoding="utf-8"), path.name


# ---------------------------------------------------------------------------- old ids map to the new ones


def test_an_old_id_resolves_to_its_amluto_id_in_one_step() -> None:
    table = moves.load_moves()
    assert moves.resolve(OLD_SOFA, table) == NEW_SOFA
    # an entry of the table that named the old prefix ends at the final amluto id, not half-way
    assert moves.resolve(OLD_CORE, table) == NEW_CORE
    assert moves.resolve("pack:amluto.core:air_fryer", table) == NEW_CORE
    assert moves.resolve(NEW_SOFA, table) == NEW_SOFA
    # an item a pack dropped since (only a plan's copy has it) is renamed by the rule as well
    assert moves.resolve("pack:theovencook.living:gone", table) == "pack:amluto.living:gone"
    # other packs and the built-in types are left alone
    assert moves.resolve("pack:acme.theovencook:chair", table) == "pack:acme.theovencook:chair"
    assert moves.resolve("sofa", table) == "sofa"
    # a table written with old ids on both sides reads with the new ones
    old_table = moves.parse_moves({"moved": {"pack:theovencook.a:x": "pack:theovencook.b:x"}})
    assert old_table == {"pack:amluto.a:x": "pack:amluto.b:x"}


def test_a_recipe_copy_under_an_old_id_moves_to_the_amluto_id() -> None:
    migrated = moves.migrate_building(_old_plan(), moves.load_moves())
    assert _types(migrated) == [NEW_SOFA, NEW_CORE, "sofa"]
    assert set(migrated["recipes"]) == {NEW_SOFA, NEW_CORE}
    sofa = migrated["recipes"][NEW_SOFA]
    assert (sofa["pack"], sofa["item"]) == ("amluto.living", SOFA["id"])
    # the recipe the plan showed stays: the same hash as the bundled item's
    assert sofa["hash"] == packs.recipe_hash(SOFA)
    # a plan without old ids is left as it is
    assert moves.migrate_building(migrated, moves.load_moves()) is migrated


async def test_a_plan_with_old_ids_loads_with_the_amluto_ids(hass: HomeAssistant, hass_storage) -> None:
    hass_storage[STORAGE_KEY_BUILDING] = {
        "version": 1,
        "minor_version": 2,
        "key": STORAGE_KEY_BUILDING,
        "data": {"revision": 5, "building": _old_plan()},
    }
    await _setup(hass)
    building = hass.data[DOMAIN].building
    assert _types(building) == [NEW_SOFA, NEW_CORE, "sofa"]
    assert set(building["recipes"]) == {NEW_SOFA, NEW_CORE}
    # nothing shows as an update: the copies hold what the bundled items hold
    status = hass.data[DATA_PACK_UPDATES].status()
    assert [i["type"] for i in status["items"] if i["type"] in (NEW_SOFA, NEW_CORE)] == []
    # written back once, at the same revision
    stored = hass_storage[STORAGE_KEY_BUILDING]["data"]
    assert stored["revision"] == 5 and _types(stored["building"]) == [NEW_SOFA, NEW_CORE, "sofa"]


async def test_a_backup_with_old_ids_restores_with_the_amluto_ids(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    backup = await _call(client, type="home_3d/backup/export")
    # a pack installed from the old account, as a backup made before #424 carries it
    garden = {"files": _folder("theovencook.garden"), "origin": _origin("theovencook", "theovencook.garden")}
    backup["homes"] = [{"id": backup["active"], "name": "Home", "building": _old_plan()}]
    backup["packs"] = [{"id": "theovencook.garden", "source": garden}]
    del backup["building"]
    result = await _call(
        client, type="home_3d/backup/import", **{k: v for k, v in backup.items() if k not in ("format", "version")}
    )
    assert result["skipped"] == []
    data = hass.data[DOMAIN]
    assert _types(data.building) == [NEW_SOFA, NEW_CORE, "sofa"]
    assert set(data.building["recipes"]) == {NEW_SOFA, NEW_CORE}
    assert [p["id"] for p in data.packs] == ["amluto.garden"]
    assert data.packs[0]["source"]["origin"]["owner"] == "theovencook"


async def test_installed_packs_pins_and_rollbacks_under_old_ids_move_to_the_amluto_ids(
    hass: HomeAssistant, hass_storage
) -> None:
    payload, source = packs.checked_folder(_folder("theovencook.garden", release=3))
    assert payload["id"] == "amluto.garden"
    # stored before #424: the pack under its old id, its pin, its rollback entry and its last check
    stored = {**payload, "id": "theovencook.garden", "source": source, "imported_at": 1.0}
    older = {**stored, "release": 2}
    hass_storage[STORAGE_KEY_PACKS] = {"version": 1, "key": STORAGE_KEY_PACKS, "data": {"packs": [stored]}}
    hass_storage[STORAGE_KEY_PACK_UPDATES] = {
        "version": 1,
        "key": STORAGE_KEY_PACK_UPDATES,
        "data": {
            "settings": {},
            "pinned": ["theovencook.garden", "theovencook.living"],
            "previous": {
                "theovencook.garden": older,
                "theovencook.living": {"id": "theovencook.living", "release": 4, "bundled": True},
            },
            "checks": {"theovencook.garden": {"checked_at": 1.0, "latest_release": 3}},
            "last_check": None,
        },
    }
    await _setup(hass)
    data = hass.data[DOMAIN]
    assert [p["id"] for p in data.packs] == ["amluto.garden"]
    assert hass_storage[STORAGE_KEY_PACKS]["data"]["packs"][0]["id"] == "amluto.garden"
    updates = hass.data[DATA_PACK_UPDATES]
    assert updates.pinned == {"amluto.garden", "amluto.living"}
    assert set(updates.previous) == {"amluto.garden", "amluto.living"}
    assert updates.previous["amluto.garden"]["id"] == "amluto.garden"
    assert updates.previous["amluto.living"] == {"id": "amluto.living", "release": 4, "bundled": True}
    assert set(updates.checks) == {"amluto.garden"}
    assert sorted(hass_storage[STORAGE_KEY_PACK_UPDATES]["data"]["pinned"]) == ["amluto.garden", "amluto.living"]


def test_a_pack_under_both_ids_keeps_the_higher_release() -> None:
    old = {"id": "theovencook.garden", "release": 3}
    new = {"id": "amluto.garden", "release": 2}
    other = {"id": "acme.chairs", "release": 1}
    assert packs.renamed_installed([old, new, other]) == [{"id": "amluto.garden", "release": 3}, other]
    # on a tie the one already under the new id stays
    tie = {"id": "amluto.garden", "release": 3}
    assert packs.renamed_installed([old, tie])[0] is tie
    nothing_old = [new, other]
    assert packs.renamed_installed(nothing_old) is nothing_old


async def test_the_chosen_language_from_an_old_language_pack_still_shows(
    hass: HomeAssistant, hass_storage, hass_ws_client
) -> None:
    """A device keeps its language by code (#292); an installed copy of theovencook.lang-de (a newer release from
    the old account) is now amluto.lang-de and still gives the German texts."""
    files = {
        "pack.json": json.dumps(
            {
                "format": "home3d-pack",
                "version": 2,
                "kind": "language",
                "language": "de",
                "id": "theovencook.lang-de",
                "name": "Deutsch",
                "publisher": "theovencook",
                "licence": "MIT",
                "release": 99,
            }
        ),
        "strings.json": json.dumps({"view": "Ansicht (neu)"}),
    }
    payload, source = packs.checked_folder(files)
    stored = {
        **payload,
        "id": "theovencook.lang-de",
        "source": {**source, "origin": _origin("theovencook", "theovencook.lang-de")},
        "imported_at": 1.0,
    }
    hass_storage[STORAGE_KEY_PACKS] = {"version": 1, "key": STORAGE_KEY_PACKS, "data": {"packs": [stored]}}
    await _setup(hass)
    client = await hass_ws_client(hass)
    got = await _call(client, type="home_3d/languages/get", language="de")
    assert got["packs"] == ["amluto.lang-de"] and got["strings"] == {"view": "Ansicht (neu)"}
    # removing the copy brings the bundled German back
    assert (await _send(client, type="home_3d/packs/remove", pack_id="amluto.lang-de"))["success"]
    got = await _call(client, type="home_3d/languages/get", language="de")
    assert got["packs"] == ["amluto.lang-de"] and len(got["strings"]) > 2000


# ---------------------------------------------------------------------------- trust


@pytest.mark.parametrize(
    ("pack_id", "publisher"),
    [
        ("amluto.chairs", "Acme"),
        ("theovencook.chairs", "Acme"),
        ("acme.chairs", "Amluto Solutions"),
        ("acme.chairs", "amluto"),
        ("acme.chairs", "theovencook"),
    ],
)
def test_a_third_party_pack_can_not_use_either_prefix_or_publisher(pack_id: str, publisher: str) -> None:
    pack = {"id": pack_id, "publisher": publisher}
    assert packs.is_reserved(pack)
    for origin in (None, {"type": "github", "owner": "acme", "repo": "home-3d-packs"}):
        with pytest.raises(PackError) as err:
            packs.official_only(pack, origin)
        assert err.value.code == "reserved_id"
    # the organisation, and the old account for packs already installed from it
    for owner in ("amluto-solutions", "Amluto-Solutions", "theovencook"):
        assert packs.official_only(pack, {"type": "github", "owner": owner}) is pack


async def test_a_file_can_not_bring_an_old_or_new_reserved_id(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    for files in (_folder("theovencook.garden", publisher="Acme"), _folder("amluto.garden", publisher="Acme")):
        refused = await _send(client, type="home_3d/packs/import", files=files, confirm=True)
        assert refused["error"]["code"] == "reserved_id"
    assert hass.data[DOMAIN].packs == []


def test_the_old_default_pack_list_reads_the_new_one() -> None:
    assert DEFAULT_INDEX_URL == "https://raw.githubusercontent.com/amluto-solutions/home-3d-packs/main/index.json"
    assert index_url("https://raw.githubusercontent.com/theovencook/home-3d-packs/main/index.json") == DEFAULT_INDEX_URL
    assert packs.OFFICIAL_OWNER == "amluto-solutions"
