"""The backend's failure and overlap cases (#167): a save while its home is deleted, a write that fails halfway, a
restore that fails, a backup without packs or custom items, a restore after the restore point's picture was pruned."""

from __future__ import annotations

import asyncio
import copy
import json
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.home_3d.const import DOMAIN, SIGNAL_BUILDING_UPDATED
from custom_components.home_3d.storage import FloorplanData, Home, HomesError
from tests.test_backup import PAYLOAD, _imported, _with_a_pack
from tests.test_init import BUILDING, IMAGE, _setup
from tests.test_restore_pictures import _restart, _setup_entry, _with_background
from tests.test_save_conflicts import _slow_writes


def _named(name: str) -> dict[str, Any]:
    building = copy.deepcopy(BUILDING)
    building["floors"][0]["rooms"][0]["name"] = name
    return building


def _room(building: dict[str, Any]) -> str:
    return building["floors"][0]["rooms"][0]["name"]


async def _call(client, msg: dict) -> dict:
    await client.send_json_auto_id(msg)
    while True:
        result = await client.receive_json()
        if result.get("type") == "result":
            return result


async def _ok(client, msg: dict) -> dict:
    result = await _call(client, msg)
    assert result["success"], result
    return result["result"]


def _failing_writes(home: Home, times: int = 1) -> list[int]:
    """The next `times` writes of the home's plan fail as a full disk would; the revisions that were attempted."""
    tried: list[int] = []
    store = home._building_store
    original = store.async_save

    async def failing(data: dict[str, Any]) -> None:
        tried.append(data["revision"])
        if len(tried) <= times:
            raise OSError("disk full")
        await original(data)

    store.async_save = failing  # type: ignore[method-assign]
    return tried


# ---------------------------------------------------------------------------- overlapping saves and deletes


async def test_a_save_waiting_while_its_home_is_deleted_writes_nothing(hass: HomeAssistant, hass_storage) -> None:
    """A save running when the home is deleted finishes first; one that comes after the delete is refused; no store
    is written again after the delete removed them."""
    await _setup(hass)
    data: FloorplanData = hass.data[DOMAIN]
    home = await data.async_create_home("Second")
    key = home._building_store.key
    _slow_writes(home)
    running = asyncio.ensure_future(home.async_save_building(_named("Running")))
    await asyncio.sleep(0)
    deleting = asyncio.ensure_future(home.async_delete())
    await asyncio.sleep(0)
    waiting = asyncio.ensure_future(home.async_save_building(_named("Waiting")))
    results = await asyncio.gather(running, deleting, waiting, return_exceptions=True)
    assert results[0] == 1
    assert isinstance(results[2], HomesError) and results[2].code == "home_not_found"
    assert key not in hass_storage
    # the server's own updates leave a deleted home alone too
    assert await home.async_update_building(lambda b: {**b, "settings": {}}) == 1
    assert key not in hass_storage
    with pytest.raises(HomesError):
        await home.async_restore(_named("Restored"))


async def test_deleting_a_home_waits_for_its_running_save(hass: HomeAssistant, hass_storage) -> None:
    await _setup(hass)
    data: FloorplanData = hass.data[DOMAIN]
    home = await data.async_create_home("Second")
    _slow_writes(home)
    running = asyncio.ensure_future(home.async_save_building(_named("Running")))
    await asyncio.sleep(0)
    await data.async_delete_home(home.id)
    assert await running == 1
    assert home.id not in data.homes
    assert not [key for key in hass_storage if f"home_{home.id}" in key]


async def test_a_save_to_a_deleted_home_is_refused(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    second = (await _ok(client, {"type": "home_3d/homes/create", "name": "Second"}))["home"]["id"]
    await _ok(client, {"type": "home_3d/homes/delete", "home_id": second})
    refused = await _call(client, {"type": "home_3d/building/save", "home_id": second, "building": BUILDING})
    assert refused["error"]["code"] == "home_not_found"


# ---------------------------------------------------------------------------- a write that fails halfway


async def test_a_failed_write_keeps_the_plan_and_the_revision_it_has_on_disk(hass: HomeAssistant) -> None:
    await _setup(hass)
    home: Home = hass.data[DOMAIN].active
    await home.async_save_building(_named("Saved"))
    tried = _failing_writes(home)
    events: list[int] = []
    unsub = async_dispatcher_connect(hass, SIGNAL_BUILDING_UPDATED, callback(lambda _h, rev: events.append(rev)))
    with pytest.raises(OSError, match="disk full"):
        await home.async_save_building(_named("Lost"), base_revision=1)
    assert (home.revision, _room(home.building)) == (1, "Saved")
    assert events == [], "no client is told of a plan that was not stored"
    # the editor's next try (from the same revision) goes through
    assert await home.async_save_building(_named("Again"), base_revision=1) == 2
    unsub()
    assert tried == [2, 2]
    assert events == [2]
    assert _room(home.building) == "Again"


async def test_a_failed_save_answers_with_an_error_and_changes_nothing(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await _ok(client, {"type": "home_3d/building/save", "building": _named("Saved")})
    _failing_writes(hass.data[DOMAIN].active)
    failed = await _call(client, {"type": "home_3d/building/save", "building": _named("Lost"), "base_revision": 1})
    assert not failed["success"]
    got = await _ok(client, {"type": "home_3d/building/get"})
    assert (got["revision"], _room(got["building"])) == (1, "Saved")


async def test_a_failed_restore_keeps_the_plan_and_the_restore_point(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    home: Home = hass.data[DOMAIN].active
    await _ok(client, {"type": "home_3d/building/save", "building": _named("Old")})
    await home.async_snapshot()
    point = (await _ok(client, {"type": "home_3d/history/list"}))["snapshots"][0]["id"]
    await _ok(client, {"type": "home_3d/building/save", "building": _named("Current"), "base_revision": 1})

    _failing_writes(home)
    failed = await _call(client, {"type": "home_3d/history/restore", "snapshot_id": point})
    assert not failed["success"]
    got = await _ok(client, {"type": "home_3d/building/get"})
    assert (got["revision"], _room(got["building"])) == (2, "Current")
    listed = [p["id"] for p in (await _ok(client, {"type": "home_3d/history/list"}))["snapshots"]]
    assert point in listed
    # it restores once the disk is back
    restored = await _ok(client, {"type": "home_3d/history/restore", "snapshot_id": point})
    assert restored["revision"] == 3
    assert _room(home.building) == "Old"


# ---------------------------------------------------------------------------- backups


async def test_a_backup_of_homes_without_packs_or_items_leaves_both(hass: HomeAssistant, hass_ws_client) -> None:
    """The form with homes (#53) behaves like the old one (#153): packs and custom items it lacks stay."""
    client, _pack = await _with_a_pack(hass, hass_ws_client)
    await _ok(client, {"type": "home_3d/items/save", "item": {**PAYLOAD["items"][0], "id": "own_cube"}})
    first = (await _ok(client, {"type": "home_3d/homes/list"}))["active"]
    homes = [{"id": first, "name": "Home", "building": _named("From the backup")}]
    result = await _ok(client, {"type": "home_3d/backup/import", "homes": homes})
    assert result["packs"] == 0 and "items" not in result
    assert await _imported(client) == ["test.backup"]
    assert [i["id"] for i in hass.data[DOMAIN].custom.items] == ["own_cube"]
    assert _room(hass.data[DOMAIN].homes[first].building) == "From the backup"


async def test_a_backup_failing_at_its_packs_takes_back_its_new_home_and_the_stores(
    hass: HomeAssistant, hass_ws_client, hass_storage, monkeypatch
) -> None:
    client, pack = await _with_a_pack(hass, hass_ws_client)
    data: FloorplanData = hass.data[DOMAIN]
    first = data.active_id
    await _ok(client, {"type": "home_3d/building/save", "building": _named("Before")})

    async def failing(self: FloorplanData, packs: list[dict[str, Any]]) -> None:
        raise OSError("disk full")

    other = json.loads(json.dumps(pack))
    other["id"] = other["source"]["id"] = "test.other"
    monkeypatch.setattr(FloorplanData, "async_set_packs", failing)
    homes = [
        {"id": first, "name": "Home", "building": _named("Backup")},
        {"id": "newhome", "name": "New", "building": _named("Backup new")},
    ]
    result = await _call(client, {"type": "home_3d/backup/import", "homes": homes, "packs": [other]})
    assert result["error"]["code"] == "restore_failed"
    assert sorted(data.homes) == [first]
    assert not [key for key in hass_storage if "home_newhome" in key], "the new home's stores are gone again"
    assert _room(data.homes[first].building) == "Before"
    assert await _imported(client) == ["test.backup"]


# ---------------------------------------------------------------------------- restore after pruned pictures


async def test_a_restore_point_whose_picture_was_pruned_restores_without_it(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """With pictures of restore points not kept (0 days): the old background goes at the next start; its restore
    point still restores, names the picture, says it is missing, and the home keeps working after another start."""
    entry = MockConfigEntry(domain=DOMAIN, data={}, options={"restore_picture_days": 0})
    await _setup_entry(hass, entry)
    client = await hass_ws_client(hass)
    await _ok(client, {"type": "home_3d/image/set", "image_id": "first", "data": IMAGE})
    await _ok(client, {"type": "home_3d/building/save", "building": _with_background("first")})
    await hass.data[DOMAIN].active.async_snapshot()
    await _ok(client, {"type": "home_3d/image/set", "image_id": "second", "data": IMAGE})
    await _ok(client, {"type": "home_3d/building/save", "building": _with_background("second")})

    await _restart(hass, entry)
    client = await hass_ws_client(hass)
    assert sorted(hass.data[DOMAIN].active.images) == ["second"]
    point = next(p for p in (await _ok(client, {"type": "home_3d/history/list"}))["snapshots"] if p["missing_pictures"])
    restored = await _ok(client, {"type": "home_3d/history/restore", "snapshot_id": point["id"]})
    assert restored["missing_pictures"] == 1
    got = (await _ok(client, {"type": "home_3d/building/get"}))["building"]
    assert got["floors"][0]["background"]["image_id"] == "first"
    missing = await _call(client, {"type": "home_3d/image/get", "image_id": "first"})
    assert not missing["success"]

    # another start: the plan still names it, loads, and saves
    await _restart(hass, entry)
    client = await hass_ws_client(hass)
    home: Home = hass.data[DOMAIN].active
    assert home.problem is None
    assert home.missing_images(home.building) == ["first"]
    saved = await _ok(client, {"type": "home_3d/building/save", "building": home.building})
    assert saved["revision"] == restored["revision"] + 1
