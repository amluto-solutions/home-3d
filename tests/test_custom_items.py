"""Custom items (#13): items the household makes in the item editor. They are kept in Home Assistant, shared by
everyone who uses it, offered to the library as one more pack, and are plain pack v2 items, so an exported item
imports on another install and checks like any pack item."""

from __future__ import annotations

import json
from pathlib import Path

from homeassistant.core import HomeAssistant
import pytest
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from custom_components.home_3d import packs
from tests import test_pack_github as github
from tests.test_init import _setup

CUSTOM = "household.custom"

SHELF = {
    "id": "wall_shelf",
    "name": {"en": "Wall shelf"},
    "size": [0.8, 0.25, 0.3],
    "group": "storage",
    "room": ["living"],
    "tags": ["floating"],
    "mount": "wall",
    "parts": [
        {"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 0.1, "color": "wood", "fix": "h"},
        {"shape": "rbox", "x": 0, "z": 0, "w": 0.3, "d": 0.6, "y": 0.1, "h": 0.9, "color": "accent", "round": 0.3},
    ],
}


def _custom(packs: list[dict]) -> dict | None:
    return next((p for p in packs if p["id"] == CUSTOM), None)


async def _packs(client) -> list[dict]:
    await client.send_json_auto_id({"type": "home_3d/packs/list"})
    result = await client.receive_json()
    assert result["success"], result
    return result["result"]["packs"]


async def test_a_saved_item_is_offered_to_everyone_as_a_pack(
    hass: HomeAssistant, hass_ws_client, hass_read_only_access_token
) -> None:
    await _setup(hass)
    admin = await hass_ws_client(hass)
    assert _custom(await _packs(admin)) is None, "no custom pack while there are no custom items"

    await admin.send_json_auto_id({"type": "home_3d/items/save", "item": SHELF})
    result = await admin.receive_json()
    assert result["success"], result
    assert result["result"]["item"]["id"] == "wall_shelf"

    # another user of the same Home Assistant sees it too
    other = await hass_ws_client(hass, hass_read_only_access_token)
    pack = _custom(await _packs(other))
    assert pack is not None
    assert pack["custom"] is True
    assert [item["id"] for item in pack["items"]] == ["wall_shelf"]
    assert pack["items"][0]["name"] == {"en": "Wall shelf"}


async def test_only_editors_make_and_remove_items(
    hass: HomeAssistant, hass_ws_client, hass_read_only_access_token
) -> None:
    await _setup(hass)
    viewer = await hass_ws_client(hass, hass_read_only_access_token)
    for command in (
        {"type": "home_3d/items/save", "item": SHELF},
        {"type": "home_3d/items/remove", "item_id": "wall_shelf"},
    ):
        await viewer.send_json_auto_id(command)
        result = await viewer.receive_json()
        assert result["error"]["code"] == "unauthorized", command
    assert _custom(await _packs(viewer)) is None


@pytest.mark.parametrize(
    ("bad", "code"),
    [
        ({**SHELF, "parts": []}, "invalid_content"),
        ({**SHELF, "id": "Not An Id"}, "invalid_content"),
        ({**SHELF, "size": [0.8, 0.25, 50]}, "invalid_content"),
        ({**SHELF, "colour": "red"}, "invalid_content"),
        ({**SHELF, "tags": ["see https://example.com"]}, "not_data"),
        ({**SHELF, "parts": [{**SHELF["parts"][0], "shape": "torus"}]}, "needs_update"),
    ],
)
async def test_an_item_that_breaks_the_pack_schema_is_refused(
    hass: HomeAssistant, hass_ws_client, bad: dict, code: str
) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/items/save", "item": bad})
    result = await client.receive_json()
    assert not result["success"]
    assert result["error"]["code"] == code
    assert _custom(await _packs(client)) is None


async def test_saved_items_check_as_a_pack_folder(hass: HomeAssistant, hass_ws_client) -> None:
    """Every saved item passes the same checks as the item files of a pack folder."""
    await _setup(hass)
    client = await hass_ws_client(hass)
    lamp = {
        "id": "globe_lamp",
        "name": {"en": "Globe lamp", "fr": "Lampe boule"},
        "size": [0.3, 0.3, 0.5],
        "group": "lamp",
        "light": "table",
        "electric": True,
        "parts": [
            {
                "shape": "lathe",
                "x": 0,
                "z": 0,
                "w": 0.5,
                "d": 0.5,
                "y": 0,
                "h": 0.4,
                "color": "pot",
                "profile": [[0, 0], [1, 0], [0.3, 1], [0, 1]],
            },
            {"shape": "sphere", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0.4, "h": 0.6, "color": "white", "glow": True},
        ],
    }
    for item in (SHELF, lamp):
        await client.send_json_auto_id({"type": "home_3d/items/save", "item": item})
        assert (await client.receive_json())["success"]
    pack = _custom(await _packs(client))
    meta = {k: pack[k] for k in ("format", "version", "id", "name", "publisher", "licence", "release", "description")}
    files = {"pack.json": json.dumps(meta)} | {f"{i['id']}.json": json.dumps(i) for i in pack["items"]}
    checked = packs.verify_folder(files)
    assert [i["id"] for i in checked["items"]] == ["globe_lamp", "wall_shelf"]


async def test_saving_the_same_id_changes_the_item_and_items_can_be_removed(
    hass: HomeAssistant, hass_ws_client
) -> None:
    entry = await _setup(hass)
    client = await hass_ws_client(hass)
    for item in (SHELF, {**SHELF, "name": {"en": "Oak shelf"}}, {**SHELF, "id": "spare"}):
        await client.send_json_auto_id({"type": "home_3d/items/save", "item": item})
        assert (await client.receive_json())["success"]
    pack = _custom(await _packs(client))
    assert [(i["id"], i["name"]["en"]) for i in pack["items"]] == [("wall_shelf", "Oak shelf"), ("spare", "Wall shelf")]

    await client.send_json_auto_id({"type": "home_3d/items/remove", "item_id": "spare"})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/items/remove", "item_id": "spare"})
    assert (await client.receive_json())["error"]["code"] == "not_found"

    # kept in Home Assistant: still there after a restart of the integration
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    assert [i["id"] for i in _custom(await _packs(client))["items"]] == ["wall_shelf"]


async def test_an_imported_pack_cannot_take_the_custom_items_id(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    meta = {
        "format": "home3d-pack",
        "version": 2,
        "id": CUSTOM,
        "name": "Sneaky",
        "publisher": "Someone",
        "licence": "MIT",
    }
    files = {"pack.json": json.dumps(meta), "wall_shelf.json": json.dumps(SHELF)}
    await client.send_json_auto_id({"type": "home_3d/packs/import", "files": files})
    result = await client.receive_json()
    assert not result["success"]
    assert result["error"]["code"] == "reserved"


async def test_a_backup_carries_the_custom_items(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/items/save", "item": SHELF})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/backup/export"})
    backup = (await client.receive_json())["result"]
    assert [i["id"] for i in backup["items"]] == ["wall_shelf"]
    await client.send_json_auto_id({"type": "home_3d/items/remove", "item_id": "wall_shelf"})
    assert (await client.receive_json())["success"]

    # a broken item in the file is skipped, the good ones come back
    items = [*backup["items"], {**SHELF, "id": "broken", "parts": []}]
    await client.send_json_auto_id({"type": "home_3d/backup/import", "building": backup["building"], "items": items})
    result = await client.receive_json()
    assert result["success"], result
    assert result["result"]["items"] == 1
    assert result["result"]["skipped"] == [{"id": "broken", "reason": "invalid_content"}]
    assert [i["id"] for i in _custom(await _packs(client))["items"]] == ["wall_shelf"]

    # a backup from before custom items leaves them as they are
    await client.send_json_auto_id({"type": "home_3d/backup/import", "building": backup["building"]})
    assert (await client.receive_json())["success"]
    assert [i["id"] for i in _custom(await _packs(client))["items"]] == ["wall_shelf"]


async def test_no_other_way_in_can_take_the_custom_items_id(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    """Installing from GitHub (#25) and restoring a backup refuse the reserved pack id as well."""
    await _setup(hass)
    client = await hass_ws_client(hass)
    meta = {**github.PACK_JSON, "id": CUSTOM}
    github._mock_repo(aioclient_mock, {"pack.json": json.dumps(meta), "cube_chair.json": json.dumps(github.CHAIR)})
    result = await github._install(client, f"https://github.com/{github.OWNER}/{github.REPO}")
    assert result["error"]["code"] == "reserved"

    await client.send_json_auto_id({"type": "home_3d/backup/export"})
    backup = (await client.receive_json())["result"]
    pack = {"id": CUSTOM, "source": {"files": {"pack.json": json.dumps(meta), "wall_shelf.json": json.dumps(SHELF)}}}
    await client.send_json_auto_id({"type": "home_3d/backup/import", "building": backup["building"], "packs": [pack]})
    result = await client.receive_json()
    assert result["result"]["skipped"] == [{"id": CUSTOM, "reason": "reserved"}]
    assert _custom(await _packs(client)) is None


async def test_an_item_an_llm_wrote_from_the_brief_imports_as_it_is(hass: HomeAssistant, hass_ws_client) -> None:
    """#14: the item editor copies a brief for an LLM; the answer an LLM gave (kept verbatim in the fixture) saves
    without hand editing and is offered to the library as written."""
    answer = (Path(__file__).parent / "fixtures" / "llm_item_answer.txt").read_text(encoding="utf8")
    item = json.loads(answer)
    await _setup(hass)
    admin = await hass_ws_client(hass)
    await admin.send_json_auto_id({"type": "home_3d/items/save", "item": item})
    result = await admin.receive_json()
    assert result["success"], result
    pack = _custom(await _packs(admin))
    assert pack is not None
    saved = pack["items"][0]
    assert saved["id"] == "oak_bedside_table"
    # as written (the backend only adds its defaults)
    assert {k: saved[k] for k in item if k != "parts"} == {k: v for k, v in item.items() if k != "parts"}
    assert [{k: part[k] for k in written} for part, written in zip(saved["parts"], item["parts"], strict=True)] == item[
        "parts"
    ]
