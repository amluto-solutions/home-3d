"""Plans keep a copy of each placed item's recipe (#2): removing or updating a pack never changes a placed item."""

from __future__ import annotations

import copy
import json

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.home_3d import packs
from custom_components.home_3d.const import DOMAIN, STORAGE_KEY_BUILDING, STORAGE_KEY_PACKS

PACK_JSON = {
    "format": "home3d-pack",
    "version": 2,
    "id": "test.starter",
    "name": "Starter",
    "publisher": "Test",
    "licence": "MIT",
    "release": 1,
}
CHAIR = {
    "id": "cube_chair",
    "name": {"en": "Cube chair"},
    "size": [0.8, 0.8, 0.75],
    "parts": [
        {"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 0.55, "color": "fabric"},
        {"shape": "box", "x": 0, "z": -0.4, "w": 1, "d": 0.2, "y": 0.55, "h": 0.45, "color": "#223355"},
    ],
}
CHAIR_TYPE = "pack:test.starter:cube_chair"


def _files(release: int = 1, **chair_changes) -> dict[str, str]:
    return {
        "pack.json": json.dumps({**PACK_JSON, "release": release}),
        "seating/cube_chair.json": json.dumps({**CHAIR, **chair_changes}),
    }


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


def _building(*furniture: dict) -> dict:
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
                "furniture": list(furniture),
                "placements": [],
                "background": None,
            }
        ],
    }


async def _client(hass: HomeAssistant, hass_ws_client):
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return await hass_ws_client(hass)


async def _call(client, **msg) -> dict:
    await client.send_json_auto_id(msg)
    result = await client.receive_json()
    assert result["success"], result
    return result["result"]


async def test_placing_a_pack_item_stores_its_recipe_in_the_plan(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    await _call(client, type="home_3d/packs/import", files=_files())

    saved = await _call(client, type="home_3d/building/save", building=_building(_furniture("a", CHAIR_TYPE)))
    plan = (await _call(client, type="home_3d/building/get"))["building"]

    copy_ = plan["recipes"][CHAIR_TYPE]
    assert copy_["pack"] == "test.starter"
    assert copy_["item"] == "cube_chair"
    assert copy_["release"] == 1
    assert copy_["recipe"]["size"] == [0.8, 0.8, 0.75]
    assert copy_["recipe"]["name"] == {"en": "Cube chair"}
    assert [p["color"] for p in copy_["recipe"]["parts"]] == ["fabric", "#223355"]
    # the hash names the recipe's content, so an update check can compare it with the installed item (#26)
    installed = next(i for i in hass.data[DOMAIN].packs[0]["items"] if i["id"] == "cube_chair")
    assert copy_["hash"] == packs.recipe_hash(installed)
    # the save answers with the plan's recipes, so an open editor knows them too
    assert saved["recipes"] == plan["recipes"]


async def test_removing_the_pack_keeps_the_placed_items_recipe(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    await _call(client, type="home_3d/packs/import", files=_files())
    plan = _building(_furniture("a", CHAIR_TYPE), _furniture("b", CHAIR_TYPE, x=3))
    await _call(client, type="home_3d/building/save", building=plan)
    before = (await _call(client, type="home_3d/building/get"))["building"]["recipes"]

    await _call(client, type="home_3d/packs/remove", pack_id="test.starter")
    assert (await _call(client, type="home_3d/building/get"))["building"]["recipes"] == before

    # a later save without the copies (a client that does not know them) keeps them; one copy for both chairs
    await _call(client, type="home_3d/building/save", building=plan)
    after = (await _call(client, type="home_3d/building/get"))["building"]["recipes"]
    assert after == before
    assert list(after) == [CHAIR_TYPE]


async def test_a_newer_release_does_not_change_placed_items_until_they_are_updated(
    hass: HomeAssistant, hass_ws_client
) -> None:
    client = await _client(hass, hass_ws_client)
    await _call(client, type="home_3d/packs/import", files=_files())
    plan = _building(_furniture("a", CHAIR_TYPE))
    await _call(client, type="home_3d/building/save", building=plan)
    old = (await _call(client, type="home_3d/building/get"))["building"]["recipes"][CHAIR_TYPE]

    await _call(client, type="home_3d/packs/import", files=_files(release=2, size=[1.2, 0.9, 0.8]))
    await _call(client, type="home_3d/building/save", building=plan)
    kept = (await _call(client, type="home_3d/building/get"))["building"]
    assert kept["recipes"][CHAIR_TYPE] == old
    assert kept["recipes"][CHAIR_TYPE]["release"] == 1

    # updating the item puts the new release's copy into the plan (what the updates ticket #26 sends)
    new_item = next(i for i in hass.data[DOMAIN].packs[0]["items"] if i["id"] == "cube_chair")
    update = {"pack": "test.starter", "item": "cube_chair", "release": 2, "recipe": new_item}
    await _call(client, type="home_3d/building/save", building={**kept, "recipes": {CHAIR_TYPE: update}})
    updated = (await _call(client, type="home_3d/building/get"))["building"]["recipes"][CHAIR_TYPE]
    assert updated["release"] == 2
    assert updated["recipe"]["size"] == [1.2, 0.9, 0.8]
    assert updated["hash"] == packs.recipe_hash(new_item) != old["hash"]


async def test_an_open_editors_save_keeps_an_update_made_on_the_server_meanwhile(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """The race of #45: an editor loaded the plan, the server updated a placed item, then the editor saves its older
    copy. It sends the hashes it started from, so the server keeps the newer copy unless the editor changed it."""
    client = await _client(hass, hass_ws_client)
    await _call(client, type="home_3d/packs/import", files=_files())
    await _call(client, type="home_3d/building/save", building=_building(_furniture("a", CHAIR_TYPE)))
    opened = (await _call(client, type="home_3d/building/get"))["building"]
    bases = {t: c["hash"] for t, c in opened["recipes"].items()}

    await _call(client, type="home_3d/packs/import", files=_files(release=2, size=[1.2, 0.9, 0.8]))
    await _call(client, type="home_3d/packs/update_items", types=[CHAIR_TYPE])

    # the editor moves the chair and saves the copy it loaded
    edited = copy.deepcopy(opened)
    edited["floors"][0]["furniture"][0]["x"] = 2
    saved = await _call(client, type="home_3d/building/save", building=edited, recipe_bases=bases)
    plan = (await _call(client, type="home_3d/building/get"))["building"]
    assert plan["floors"][0]["furniture"][0]["x"] == 2
    assert plan["recipes"][CHAIR_TYPE]["release"] == 2
    # the answer brings the newer copy, so the editor picks it up
    assert saved["recipes"][CHAIR_TYPE]["release"] == 2

    # a copy the editor did change on purpose (it differs from the one it started from) still wins
    mine = {**opened["recipes"][CHAIR_TYPE], "recipe": {**opened["recipes"][CHAIR_TYPE]["recipe"], "size": [2, 2, 2]}}
    bases = {CHAIR_TYPE: plan["recipes"][CHAIR_TYPE]["hash"]}
    mine_plan = {**plan, "recipes": {CHAIR_TYPE: mine}}
    await _call(client, type="home_3d/building/save", building=mine_plan, recipe_bases=bases)
    kept = (await _call(client, type="home_3d/building/get"))["building"]["recipes"][CHAIR_TYPE]
    assert kept["recipe"]["size"] == [2, 2, 2]


async def test_the_plan_keeps_only_the_recipes_it_uses(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    await _call(client, type="home_3d/packs/import", files=_files())
    bed = "pack:amluto.bedroom:single_bed_simple"
    await _call(
        client, type="home_3d/building/save", building=_building(_furniture("a", CHAIR_TYPE), _furniture("b", bed))
    )
    assert set((await _call(client, type="home_3d/building/get"))["building"]["recipes"]) == {CHAIR_TYPE, bed}

    await _call(client, type="home_3d/building/save", building=_building(_furniture("b", bed)))
    assert set((await _call(client, type="home_3d/building/get"))["building"]["recipes"]) == {bed}


async def test_a_parking_spot_keeps_the_recipes_of_its_vehicles(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    await _call(client, type="home_3d/packs/import", files=_files())
    spot = _furniture("p", "parking", vehicle=CHAIR_TYPE, types=[{"state": "x", "vehicle": CHAIR_TYPE}])
    await _call(client, type="home_3d/building/save", building=_building(spot))
    assert list((await _call(client, type="home_3d/building/get"))["building"]["recipes"]) == [CHAIR_TYPE]


async def test_a_copy_that_does_not_check_is_left_out(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    broken = {"pack": "test.starter", "item": "cube_chair", "recipe": {**CHAIR, "parts": []}}
    linked = {"pack": "test.starter", "item": "cube_chair", "recipe": {**CHAIR, "name": {"en": "see www.example.com"}}}
    other = {"pack": "test.starter", "item": "other", "recipe": CHAIR}
    for entry in (broken, linked, other):
        plan = {**_building(_furniture("a", CHAIR_TYPE)), "recipes": {CHAIR_TYPE: entry}}
        await _call(client, type="home_3d/building/save", building=plan)
        # the pack is not installed: the item has no recipe and shows as a plain box
        assert (await _call(client, type="home_3d/building/get"))["building"]["recipes"] == {}


async def test_a_plan_saved_before_recipes_picks_them_up_on_load(hass: HomeAssistant, hass_storage) -> None:
    pack = {**packs.verify_folder(_files()), "imported_at": 1.0}
    bed = "pack:amluto.bedroom:single_bed_simple"
    old_plan = _building(_furniture("a", CHAIR_TYPE), _furniture("b", bed), _furniture("c", "pack:gone.pack:lamp"))
    hass_storage[STORAGE_KEY_PACKS] = {"version": 1, "key": STORAGE_KEY_PACKS, "data": {"packs": [pack]}}
    hass_storage[STORAGE_KEY_BUILDING] = {
        "version": 1,
        "minor_version": 2,
        "key": STORAGE_KEY_BUILDING,
        "data": {"revision": 7, "building": copy.deepcopy(old_plan)},
    }
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()

    data = hass.data[DOMAIN]
    # the installed chair and the bundled bed get their copies; an item of a pack that is gone stays a plain box
    assert set(data.building["recipes"]) == {CHAIR_TYPE, bed}
    assert data.building["recipes"][CHAIR_TYPE]["recipe"]["size"] == [0.8, 0.8, 0.75]
    assert data.revision == 7
    # and keeps them: written back to the store, so removing the pack before the next save changes nothing
    stored = hass_storage[STORAGE_KEY_BUILDING]["data"]
    assert set(stored["building"]["recipes"]) == {CHAIR_TYPE, bed}


async def test_a_copy_sent_back_by_a_browser_keeps_its_hash(hass: HomeAssistant, hass_ws_client) -> None:
    """A browser reads 1.0 as 1 and sends it back so: the copy checks to the same recipe and the same hash."""
    client = await _client(hass, hass_ws_client)
    await _call(client, type="home_3d/packs/import", files=_files())
    await _call(client, type="home_3d/building/save", building=_building(_furniture("a", CHAIR_TYPE)))
    plan = (await _call(client, type="home_3d/building/get"))["building"]
    stored = plan["recipes"][CHAIR_TYPE]

    as_js = json.loads(json.dumps(plan).replace(".0,", ",").replace(".0]", "]").replace(".0}", "}"))
    assert as_js["recipes"][CHAIR_TYPE]["recipe"]["parts"][0]["w"] == 1
    as_js["recipes"][CHAIR_TYPE]["hash"] = "sha256:whatever"
    await _call(client, type="home_3d/building/save", building=as_js)
    again = (await _call(client, type="home_3d/building/get"))["building"]["recipes"][CHAIR_TYPE]
    assert again == stored
