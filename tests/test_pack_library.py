"""The library in a light form (#44): `packs/list` sends an index of the items, `packs/items` the recipes on demand."""

from __future__ import annotations

import json

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.home_3d import packs
from custom_components.home_3d.const import DOMAIN

PACK_JSON = {"format": "home3d-pack", "version": 2, "id": "test.starter", "name": "Starter", "publisher": "Test"}
PACK_JSON |= {"licence": "MIT"}
PART = {"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 1, "color": "wood"}
SHELF = {
    "id": "shelf",
    "name": {"en": "Shelf"},
    "size": [0.8, 0.3, 1.8],
    "mount": "wall",
    "wall_y": 0.4,
    "group": "storage",
    "room": ["living"],
    "tags": ["books"],
    "family": "shelf",
    "variant": {"en": "Tall"},
    "ikea": "BILLY",
    "parts": [PART],
    "symbol": [{"shape": "rect", "x": 0, "z": 0, "w": 1, "d": 1}],
}
STOOL = {"id": "stool", "name": {"en": "Stool"}, "size": [0.4, 0.4, 0.45], "parts": [PART, {**PART, "h": 0.1}]}


def _folder(**items: dict) -> dict[str, str]:
    return {"pack.json": json.dumps(PACK_JSON)} | {f"{key}.json": json.dumps(item) for key, item in items.items()}


async def _client(hass: HomeAssistant, hass_ws_client):
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return await hass_ws_client(hass)


async def _call(client, **msg) -> dict:
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def _listed(client) -> dict[str, dict]:
    result = await _call(client, type="home_3d/packs/list")
    assert result["success"], result
    return {p["id"]: p for p in result["result"]["packs"]}


async def test_the_list_carries_what_browsing_needs_but_no_recipes(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    assert (await _call(client, type="home_3d/packs/import", files=_folder(shelf=SHELF, stool=STOOL)))["success"]
    pack = (await _listed(client))["test.starter"]

    assert pack["name"] == "Starter" and pack["licence"] == "MIT" and pack["release"] == 1
    assert pack["hash"].startswith("sha256:")
    shelf = next(i for i in pack["items"] if i["id"] == "shelf")
    assert shelf == {
        "id": "shelf",
        "name": {"en": "Shelf"},
        "size": [0.8, 0.3, 1.8],
        "mount": "wall",
        "wall_y": 0.4,
        "group": "storage",
        "room": ["living"],
        "tags": ["books"],
        "family": "shelf",
        "variant": {"en": "Tall"},
        "ikea": "BILLY",
    }
    # the defaults the check fills in stay out: a stool is a stool on the floor
    assert next(i for i in pack["items"] if i["id"] == "stool") == {
        "id": "stool",
        "name": {"en": "Stool"},
        "size": [0.4, 0.4, 0.45],
    }
    # the files the pack was imported from stay on the server (a backup carries them)
    assert "files" not in (pack.get("source") or {})


async def test_recipes_come_on_demand_for_the_items_asked_for(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    assert (await _call(client, type="home_3d/packs/import", files=_folder(shelf=SHELF, stool=STOOL)))["success"]
    listed = (await _listed(client))["test.starter"]

    result = await _call(client, type="home_3d/packs/items", pack_id="test.starter", items=["stool", "gone"])
    assert result["success"], result
    assert result["result"]["pack_id"] == "test.starter"
    # the same hash as the list: a browser keeps the recipes it fetched while the hash stays
    assert result["result"]["hash"] == listed["hash"]
    assert result["result"]["release"] == 1
    # an id the pack does not have is left out
    [stool] = result["result"]["items"]
    assert stool["id"] == "stool" and len(stool["parts"]) == 2 and stool["mount"] == "floor"

    # without a list of ids: every item of the pack
    result = await _call(client, type="home_3d/packs/items", pack_id="test.starter")
    assert sorted(i["id"] for i in result["result"]["items"]) == ["shelf", "stool"]
    assert next(i for i in result["result"]["items"] if i["id"] == "shelf")["symbol"][0]["shape"] == "rect"

    result = await _call(client, type="home_3d/packs/items", pack_id="test.nothing", items=["stool"])
    assert not result["success"] and result["error"]["code"] == "not_found"


async def test_a_new_release_changes_the_hash(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    assert (await _call(client, type="home_3d/packs/import", files=_folder(stool=STOOL)))["success"]
    before = (await _listed(client))["test.starter"]["hash"]
    taller = {**STOOL, "size": [0.4, 0.4, 0.65]}
    newer = {**PACK_JSON, "release": 2}
    files = {"pack.json": json.dumps(newer), "stool.json": json.dumps(taller)}
    assert (await _call(client, type="home_3d/packs/import", files=files))["success"]
    after = (await _listed(client))["test.starter"]
    assert after["hash"] != before and after["release"] == 2
    recipe = (await _call(client, type="home_3d/packs/items", pack_id="test.starter", items=["stool"]))["result"]
    assert recipe["hash"] == after["hash"] and recipe["items"][0]["size"] == [0.4, 0.4, 0.65]


async def test_the_bundled_library_lists_light(hass: HomeAssistant, hass_ws_client) -> None:
    """The bundled packs hold well over a thousand items: the list carries none of their recipes, so it stays a
    fraction of their size, also with a whole imported copy of the core pack next to them."""
    client = await _client(hass, hass_ws_client)
    core = packs.read_folder(packs.BUNDLED_DIR / "amluto.living")
    meta = json.loads(core["pack.json"])
    # a copy under an id of its own: files can't carry the id of one of our packs (#372)
    core["pack.json"] = json.dumps({**meta, "id": "test.living", "publisher": "Test"})
    assert (await _call(client, type="home_3d/packs/import", files=core))["success"]

    await client.send_json_auto_id({"type": "home_3d/packs/list"})
    message = await client.receive_str()
    listed = json.loads(message)["result"]["packs"]
    assert {p["id"] for p in listed} >= {"amluto.living", "amluto.ikea-uk"}
    assert not any("parts" in item or "symbol" in item for pack in listed for item in pack["items"])
    whole = sum(len(json.dumps(p["items"], separators=(",", ":"))) for p in hass.data[DOMAIN].offered_packs)
    assert len(message) < whole / 4, (len(message), whole)

    # an item's recipe comes on demand
    item = next(i for i in listed[0]["items"])
    result = await _call(client, type="home_3d/packs/items", pack_id=listed[0]["id"], items=[item["id"]])
    assert result["result"]["items"][0]["parts"]
