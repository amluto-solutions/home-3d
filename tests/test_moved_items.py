"""Bundled items can move between packs without breaking plans (#110).

An item's type names its pack ("pack:<pack>:<item>"), so a move changes the id every placed copy, recipe copy, pin and
rollback entry refers to. The moved-items table (custom_components/home_3d/moved_items.json) maps old types to new
ones; plans migrate wherever they come in, and old ids still resolve.

The fixture: the pack `test.old` was split and retired. Its cube chair moved to `test.new` under the same id, its lamp
moved and was renamed `reading_lamp`. `test.new` is installed; `test.old` is not.
"""

from __future__ import annotations

import copy
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
from custom_components.home_3d.recipes import recipes_validator

OLD_CHAIR = "pack:test.old:cube_chair"
OLD_LAMP = "pack:test.old:lamp"
NEW_CHAIR = "pack:test.new:cube_chair"
NEW_LAMP = "pack:test.new:reading_lamp"
TABLE = {"moved": {OLD_CHAIR: NEW_CHAIR, OLD_LAMP: NEW_LAMP}}

CHAIR = {
    "id": "cube_chair",
    "name": {"en": "Cube chair"},
    "size": [0.8, 0.8, 0.75],
    "parts": [{"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 1, "color": "fabric"}],
}
LAMP = {
    "id": "lamp",
    "name": {"en": "Lamp"},
    "size": [0.3, 0.3, 1.5],
    "parts": [{"shape": "cyl", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 1, "color": "metal"}],
}


def _pack_files(pack_id: str, items: list[dict], release: int = 1) -> dict[str, str]:
    files = {
        "pack.json": json.dumps(
            {
                "format": "home3d-pack",
                "version": 2,
                "id": pack_id,
                "name": pack_id,
                "publisher": "Test",
                "licence": "MIT",
                "release": release,
            }
        )
    }
    files.update({f"items/{item['id']}.json": json.dumps(item) for item in items})
    return files


NEW_PACK_FILES = _pack_files("test.new", [CHAIR, {**LAMP, "id": "reading_lamp"}])


def _copy(pack: str, item: dict, item_id: str | None = None, release: int = 3) -> dict:
    """A recipe copy as a plan saved before the move keeps it."""
    recipe = {**item, "id": item_id or item["id"]}
    return {"pack": pack, "item": recipe["id"], "release": release, "recipe": recipe}


def _furniture(item_id: str, type_: str, **extra) -> dict:
    return {
        "id": item_id,
        "type": type_,
        "x": 1,
        "z": 1,
        "rotation": 0,
        "w": 0.8,
        "d": 0.8,
        "h": 0.75,
        "variant": None,
        **extra,
    }


def _building(*furniture: dict, recipes: dict | None = None) -> dict:
    building = {
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
                "furniture": list(furniture),
                "placements": [],
                "background": None,
            }
        ],
    }
    if recipes is not None:
        building["recipes"] = recipes
    return building


def _pre_move_plan() -> dict:
    """Three chairs and a lamp of the retired pack, with their recipe copies, plus a built-in sofa."""
    return _building(
        _furniture("a", OLD_CHAIR),
        _furniture("b", OLD_CHAIR),
        _furniture("c", OLD_CHAIR),
        _furniture("d", OLD_LAMP),
        _furniture("e", "sofa"),
        recipes={OLD_CHAIR: _copy("test.old", CHAIR), OLD_LAMP: _copy("test.old", LAMP)},
    )


def _types(building: dict) -> list[str]:
    return [f["type"] for floor in building["floors"] for f in floor["furniture"]]


@pytest.fixture
def table(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """The fixture's moved-items table in place of the shipped one."""
    path = tmp_path / "moved_items.json"
    path.write_text(json.dumps(TABLE), encoding="utf-8")
    monkeypatch.setattr(moves, "MOVES_FILE", path)
    return path


async def _setup(hass: HomeAssistant) -> None:
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


def _stored_packs(hass_storage) -> None:
    pack = {**packs.verify_folder(NEW_PACK_FILES), "imported_at": 1.0}
    hass_storage[STORAGE_KEY_PACKS] = {"version": 1, "key": STORAGE_KEY_PACKS, "data": {"packs": [pack]}}


async def test_a_plan_saved_before_a_move_loads_with_the_new_ids(hass: HomeAssistant, hass_storage, table) -> None:
    _stored_packs(hass_storage)
    hass_storage[STORAGE_KEY_BUILDING] = {
        "version": 1,
        "minor_version": 2,
        "key": STORAGE_KEY_BUILDING,
        "data": {"revision": 7, "building": _pre_move_plan()},
    }
    await _setup(hass)

    building = hass.data[DOMAIN].building
    # every item in place, the same count, the new ids
    assert _types(building) == [NEW_CHAIR, NEW_CHAIR, NEW_CHAIR, NEW_LAMP, "sofa"]
    assert set(building["recipes"]) == {NEW_CHAIR, NEW_LAMP}
    # the copies keep the recipe the plan had (not the installed item's), under the new pack and item id
    lamp = building["recipes"][NEW_LAMP]
    assert (lamp["pack"], lamp["item"], lamp["recipe"]["id"]) == ("test.new", "reading_lamp", "reading_lamp")
    assert lamp["recipe"]["size"] == [0.3, 0.3, 1.5]
    assert lamp["hash"] == packs.recipe_hash(lamp["recipe"])
    # written back once, at the same revision
    stored = hass_storage[STORAGE_KEY_BUILDING]["data"]
    assert stored["revision"] == 7
    assert _types(stored["building"]) == _types(building)
    assert set(stored["building"]["recipes"]) == {NEW_CHAIR, NEW_LAMP}


async def test_rack_gear_that_moved_loads_with_the_new_ids(hass: HomeAssistant, hass_storage, table) -> None:
    """Gear in a rack is placed by slot type (#113): a slot's type and its recipe copy follow the move like a placed
    item's, so the rack keeps its gear (racks.py and the 3D view skip a slot whose type has no item)."""
    _stored_packs(hass_storage)
    rack = _furniture("r", "network_rack", rack={"slots": [{"id": "s1", "type": OLD_LAMP, "u": 1}]})
    hass_storage[STORAGE_KEY_BUILDING] = {
        "version": 1,
        "minor_version": 2,
        "key": STORAGE_KEY_BUILDING,
        "data": {"revision": 4, "building": _building(rack, recipes={OLD_LAMP: _copy("test.old", LAMP)})},
    }
    await _setup(hass)

    building = hass.data[DOMAIN].building
    slots = building["floors"][0]["furniture"][0]["rack"]["slots"]
    assert slots == [{"id": "s1", "type": NEW_LAMP, "u": 1}]
    assert set(building["recipes"]) == {NEW_LAMP}
    stored = hass_storage[STORAGE_KEY_BUILDING]["data"]["building"]
    assert stored["floors"][0]["furniture"][0]["rack"]["slots"][0]["type"] == NEW_LAMP


def test_a_rack_without_moved_gear_is_left_as_it_is() -> None:
    rack = _furniture("r", "network_rack", rack={"slots": [{"id": "s1", "type": NEW_LAMP, "u": 1}]})
    plan = _building(rack)
    assert moves.migrate_building(plan, moves.parse_moves(TABLE)) is plan


async def _client(hass: HomeAssistant, hass_ws_client):
    await _setup(hass)
    return await hass_ws_client(hass)


async def _call(client, **msg) -> dict:
    await client.send_json_auto_id(msg)
    result = await client.receive_json()
    assert result["success"], result
    return result["result"]


async def test_an_imported_plan_from_before_a_move_is_saved_with_the_new_ids(
    hass: HomeAssistant, hass_ws_client, table
) -> None:
    client = await _client(hass, hass_ws_client)
    await _call(client, type="home_3d/packs/import", files=NEW_PACK_FILES)

    saved = await _call(client, type="home_3d/building/save", building=_pre_move_plan())
    plan = (await _call(client, type="home_3d/building/get"))["building"]
    assert _types(plan) == [NEW_CHAIR, NEW_CHAIR, NEW_CHAIR, NEW_LAMP, "sofa"]
    assert set(plan["recipes"]) == set(saved["recipes"]) == {NEW_CHAIR, NEW_LAMP}
    # the plan's own copy moved with it (release 1: the old pack's release says nothing about the new pack)
    chair = plan["recipes"][NEW_CHAIR]
    assert (chair["pack"], chair["item"], chair["release"]) == ("test.new", "cube_chair", 1)


async def test_an_old_id_without_a_recipe_copy_resolves_to_the_moved_item(
    hass: HomeAssistant, hass_ws_client, table
) -> None:
    """A plan exported before recipe copies (#2) and before the move names only the old id."""
    client = await _client(hass, hass_ws_client)
    await _call(client, type="home_3d/packs/import", files=NEW_PACK_FILES)

    await _call(client, type="home_3d/building/save", building=_building(_furniture("a", OLD_LAMP)))
    plan = (await _call(client, type="home_3d/building/get"))["building"]
    assert _types(plan) == [NEW_LAMP]
    installed = next(i for i in hass.data[DOMAIN].packs[0]["items"] if i["id"] == "reading_lamp")
    assert plan["recipes"][NEW_LAMP]["hash"] == packs.recipe_hash(installed)
    assert moves.resolve(OLD_LAMP, hass.data[DOMAIN].moves) == NEW_LAMP
    assert moves.resolve("pack:test.new:cube_chair", hass.data[DOMAIN].moves) == NEW_CHAIR


async def test_an_open_editor_from_before_a_move_keeps_an_update_made_meanwhile(
    hass: HomeAssistant, hass_ws_client, table
) -> None:
    """An editor opened before the restart that brought the move saves its old ids and the hashes it started from
    (#45): its unchanged copy still gives way to the newer one the server keeps."""
    client = await _client(hass, hass_ws_client)
    await _call(client, type="home_3d/packs/import", files=NEW_PACK_FILES)
    opened = _pre_move_plan()
    # the copies as the server handed them out before the move
    opened["recipes"] = recipes_validator(opened["recipes"])
    await _call(client, type="home_3d/building/save", building=copy.deepcopy(opened))
    # the server's copy changes meanwhile (as an update would)
    data = hass.data[DOMAIN]
    newer = {**data.building["recipes"][NEW_CHAIR]}
    newer["recipe"] = {**newer["recipe"], "size": [1, 1, 1]}
    newer["hash"] = packs.recipe_hash(newer["recipe"])
    await data.async_save_building({**data.building, "recipes": {**data.building["recipes"], NEW_CHAIR: newer}})

    bases = {t: c["hash"] for t, c in opened["recipes"].items()}
    await _call(client, type="home_3d/building/save", building=opened, recipe_bases=bases)
    plan = (await _call(client, type="home_3d/building/get"))["building"]
    assert plan["recipes"][NEW_CHAIR]["recipe"]["size"] == [1, 1, 1]


async def test_a_backup_from_before_a_move_restores_with_the_new_ids(
    hass: HomeAssistant, hass_ws_client, table
) -> None:
    client = await _client(hass, hass_ws_client)
    await _call(client, type="home_3d/packs/import", files=NEW_PACK_FILES)
    backup = await _call(client, type="home_3d/backup/export")
    backup["homes"] = [
        {"id": backup["active"], "name": "Home", "building": _pre_move_plan()},
        {"id": "cottage", "name": "Cottage", "building": _building(_furniture("x", OLD_LAMP))},
    ]
    del backup["building"]

    await _call(
        client, type="home_3d/backup/import", **{k: v for k, v in backup.items() if k not in ("format", "version")}
    )
    data = hass.data[DOMAIN]
    assert _types(data.homes[backup["active"]].building) == [NEW_CHAIR, NEW_CHAIR, NEW_CHAIR, NEW_LAMP, "sofa"]
    assert _types(data.homes["cottage"].building) == [NEW_LAMP]
    assert set(data.homes["cottage"].building["recipes"]) == {NEW_LAMP}

    # a backup from before several homes (#53) carries one building
    await _call(
        client, type="home_3d/backup/import", building=_building(_furniture("y", OLD_CHAIR)), packs=backup["packs"]
    )
    assert _types(data.building) == [NEW_CHAIR]


async def test_restoring_a_restore_point_from_before_a_move_migrates_it(
    hass: HomeAssistant, hass_ws_client, table
) -> None:
    client = await _client(hass, hass_ws_client)
    await _call(client, type="home_3d/packs/import", files=NEW_PACK_FILES)
    data = hass.data[DOMAIN]
    # a restore point taken before the move keeps the old ids
    data.active._history.append({"id": "old", "revision": 1, "saved_at": 1.0, "building": _pre_move_plan()})

    await _call(client, type="home_3d/history/restore", snapshot_id="old")
    assert _types(data.building) == [NEW_CHAIR, NEW_CHAIR, NEW_CHAIR, NEW_LAMP, "sofa"]


async def test_a_sample_home_from_before_a_move_loads_with_the_new_ids(hass: HomeAssistant, table) -> None:
    """The sample loader (#54) adds its file as a new home (async_create_home); a sample file that still names old
    ids migrates there. A tool refreshing the file migrates it with moves.migrate_building."""
    await _setup(hass)
    data = hass.data[DOMAIN]
    sample = _pre_move_plan()

    home = await data.async_create_home("Sample Home", copy.deepcopy(sample))
    assert _types(home.building) == [NEW_CHAIR, NEW_CHAIR, NEW_CHAIR, NEW_LAMP, "sofa"]
    assert set(home.building["recipes"]) == {NEW_CHAIR, NEW_LAMP}

    refreshed = moves.migrate_building(sample, moves.load_moves())
    assert _types(refreshed) == _types(home.building)
    assert refreshed["recipes"] == home.building["recipes"]
    # the file as loaded is left as it was
    assert _types(sample)[0] == OLD_CHAIR


def _stored_updates(hass_storage, pinned: list[str], previous: dict) -> None:
    hass_storage[STORAGE_KEY_PACK_UPDATES] = {
        "version": 1,
        "key": STORAGE_KEY_PACK_UPDATES,
        "data": {"settings": {}, "pinned": pinned, "previous": previous, "checks": {}, "last_check": None},
    }


async def test_pins_follow_the_move_and_a_retired_pack_leaves_no_pin_or_rollback(
    hass: HomeAssistant, hass_storage, hass_ws_client, table
) -> None:
    _stored_packs(hass_storage)
    _stored_updates(hass_storage, ["test.old"], {"test.old": {"id": "test.old", "release": 2, "bundled": True}})
    client = await _client(hass, hass_ws_client)

    status = await _call(client, type="home_3d/packs/updates")
    new = next(p for p in status["packs"] if p["id"] == "test.new")
    # the household pinned the items' old pack: they stay pinned in their new one
    assert new["pinned"] is True
    assert [p["id"] for p in status["packs"] if p["id"] == "test.old"] == []
    updates = hass.data[DATA_PACK_UPDATES]
    assert updates.pinned == {"test.new"}
    assert "test.old" not in updates.previous
    stored = hass_storage[STORAGE_KEY_PACK_UPDATES]["data"]
    assert stored["pinned"] == ["test.new"]
    assert stored["previous"] == {}


async def test_rolling_back_a_pack_rolls_back_the_items_that_moved_out_of_it(
    hass: HomeAssistant, hass_storage, hass_ws_client, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The chair moved out of `test.split`, which keeps its stool. The chair had taken release 2 of `test.split`;
    rolling that pack back to release 1 puts the chair's release 1 recipe back too, under its new id."""
    path = tmp_path / "moved_items.json"
    path.write_text(json.dumps({"moved": {"pack:test.split:cube_chair": NEW_CHAIR}}), encoding="utf-8")
    monkeypatch.setattr(moves, "MOVES_FILE", path)
    stool = {**LAMP, "id": "stool"}
    big_chair = {**CHAIR, "size": [1.2, 1.2, 1.0]}
    release_1 = {**packs.verify_folder(_pack_files("test.split", [CHAIR, stool], release=1)), "imported_at": 1.0}
    release_2 = {**packs.verify_folder(_pack_files("test.split", [big_chair, stool], release=2)), "imported_at": 2.0}
    new_pack = {**packs.verify_folder(NEW_PACK_FILES), "imported_at": 1.0}
    hass_storage[STORAGE_KEY_PACKS] = {"version": 1, "key": STORAGE_KEY_PACKS, "data": {"packs": [release_2, new_pack]}}
    _stored_updates(hass_storage, [], {"test.split": release_1})
    old_chair = "pack:test.split:cube_chair"
    plan = _building(_furniture("a", old_chair), recipes={old_chair: _copy("test.split", big_chair, release=2)})
    hass_storage[STORAGE_KEY_BUILDING] = {
        "version": 1,
        "minor_version": 2,
        "key": STORAGE_KEY_BUILDING,
        "data": {"revision": 3, "building": plan},
    }
    client = await _client(hass, hass_ws_client)
    assert hass.data[DOMAIN].building["recipes"][NEW_CHAIR]["recipe"]["size"] == [1.2, 1.2, 1.0]

    await _call(client, type="home_3d/packs/rollback", pack_id="test.split")
    plan = (await _call(client, type="home_3d/building/get"))["building"]
    assert _types(plan) == [NEW_CHAIR]
    chair = plan["recipes"][NEW_CHAIR]
    assert (chair["pack"], chair["item"]) == ("test.new", "cube_chair")
    assert chair["recipe"]["size"] == [0.8, 0.8, 0.75]


def test_every_shipped_move_leads_to_a_bundled_item() -> None:
    """The table that ships: every entry is a pack item type, ends at an item a bundled pack has, and no bundled pack
    still offers the old id (the item moved; it is not in two places)."""
    raw = json.loads(moves.MOVES_FILE.read_text(encoding="utf-8"))
    assert set(raw) == {"moved"}
    table = moves.load_moves()
    # nothing in the file is dropped as broken or looping
    assert len(table) == len(raw["moved"])
    bundled = {f"pack:{p['id']}:{i['id']}" for p in packs.load_bundled() for i in p["items"]}
    assert sorted(new for new in table.values() if new not in bundled) == []
    assert sorted(old for old in table if old in bundled) == []


def test_a_chain_of_moves_ends_at_the_last_pack_and_a_loop_is_left_out() -> None:
    table = moves.parse_moves(
        {
            "moved": {
                "pack:a.one:chair": "pack:b.two:chair",
                "pack:b.two:chair": "pack:c.three:armchair",
                "pack:x.loop:a": "pack:x.loop:b",
                "pack:x.loop:b": "pack:x.loop:a",
                "sofa": "pack:c.three:sofa",
            }
        }
    )
    assert table == {"pack:a.one:chair": "pack:c.three:armchair", "pack:b.two:chair": "pack:c.three:armchair"}
    assert moves.resolve("pack:a.one:chair", table) == "pack:c.three:armchair"
    assert moves.resolve("pack:c.three:armchair", table) == "pack:c.three:armchair"
    assert moves.parse_moves(None) == {}


def test_a_building_without_moved_items_is_left_as_it_is() -> None:
    plan = _building(_furniture("a", NEW_CHAIR), recipes={NEW_CHAIR: _copy("test.new", CHAIR)})
    assert moves.migrate_building(plan, moves.parse_moves(TABLE)) is plan


def test_parking_spots_keep_their_moved_vehicles() -> None:
    spot = _furniture("p", "parking", vehicle=OLD_CHAIR, types=[{"state": "x", "vehicle": OLD_LAMP}])
    moved = moves.migrate_building(_building(spot), moves.parse_moves(TABLE))
    item = moved["floors"][0]["furniture"][0]
    assert (item["type"], item["vehicle"], item["types"]) == (
        "parking",
        NEW_CHAIR,
        [{"state": "x", "vehicle": NEW_LAMP}],
    )


async def test_the_library_lists_the_old_ids_of_moved_items(hass: HomeAssistant, hass_ws_client, table) -> None:
    """So a browser resolves an old id too (a plan file being imported, an exported plan, a card's config)."""
    client = await _client(hass, hass_ws_client)
    await _call(client, type="home_3d/packs/import", files=NEW_PACK_FILES)

    listed = {p["id"]: p for p in (await _call(client, type="home_3d/packs/list"))["packs"]}
    assert listed["test.new"]["aliases"] == {OLD_CHAIR: "cube_chair", OLD_LAMP: "reading_lamp"}
    # a pack nothing moved into lists none
    assert "aliases" not in listed["amluto.ikea-uk"]
