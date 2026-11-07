"""Saves refuse stale writes (#149): a save carries the revision its plan started from and is refused when someone
else changed the plan since; saves, restores and the server's own updates of one home run one at a time."""

from __future__ import annotations

import asyncio
import contextlib
import copy
from typing import Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect

from custom_components.home_3d.const import DOMAIN, SIGNAL_BUILDING_UPDATED
from custom_components.home_3d.storage import Home, RevisionConflict
from tests.test_custom_items import SHELF
from tests.test_init import BUILDING, _setup

SHELF_TYPE = "pack:household.custom:wall_shelf"


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


async def test_a_save_from_an_out_of_date_plan_is_refused(hass: HomeAssistant, hass_ws_client) -> None:
    """Phone and desktop both open revision 1; the phone saves first, the desktop's save is refused, not lost."""
    await _setup(hass)
    client = await hass_ws_client(hass)
    assert (await _ok(client, {"type": "home_3d/building/save", "building": _named("Start")}))["revision"] == 1
    base = (await _ok(client, {"type": "home_3d/building/get"}))["revision"]

    phone = await _ok(client, {"type": "home_3d/building/save", "building": _named("Phone"), "base_revision": base})
    assert phone["revision"] == 2
    desktop = await _call(
        client, {"type": "home_3d/building/save", "building": _named("Desktop"), "base_revision": base}
    )
    assert not desktop["success"]
    assert desktop["error"]["code"] == "conflict"
    assert "revision 2" in desktop["error"]["message"]

    got = await _ok(client, {"type": "home_3d/building/get"})
    assert (got["revision"], _room(got["building"])) == (2, "Phone")
    # from the current plan it saves again
    again = await _ok(client, {"type": "home_3d/building/save", "building": _named("Desktop"), "base_revision": 2})
    assert again["revision"] == 3
    # a revision from the future (a client of another install's history) is no base either
    future = await _call(client, {"type": "home_3d/building/save", "building": _named("X"), "base_revision": 9})
    assert future["error"]["code"] == "conflict"
    # an older client without a base revision saves as before
    assert (await _ok(client, {"type": "home_3d/building/save", "building": _named("Old client")}))["revision"] == 4


async def test_a_restore_makes_an_open_editor_out_of_date(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await _ok(client, {"type": "home_3d/building/save", "building": _named("One")})
    await _ok(client, {"type": "home_3d/building/save", "building": _named("Two"), "base_revision": 1})
    point = (await _ok(client, {"type": "home_3d/history/list"}))["snapshots"][0]["id"]
    restored = await _ok(client, {"type": "home_3d/history/restore", "snapshot_id": point})
    stale = await _call(client, {"type": "home_3d/building/save", "building": _named("Edit"), "base_revision": 2})
    assert stale["error"]["code"] == "conflict"
    got = await _ok(client, {"type": "home_3d/building/get"})
    assert (got["revision"], _room(got["building"])) == (restored["revision"], "One")


async def test_a_recipe_only_change_by_the_server_does_not_make_a_save_stale(
    hass: HomeAssistant, hass_ws_client
) -> None:
    """A custom item edit updates the placed copies (#26): an editor's save from the plan before it still goes
    through, and the newer copy stays (recipe_bases, #45)."""
    await _setup(hass)
    client = await hass_ws_client(hass)
    await _ok(client, {"type": "home_3d/items/save", "item": SHELF})
    building = _named("Living")
    building["floors"][0]["furniture"] = [
        {"id": "s1", "type": SHELF_TYPE, "x": 1, "z": 1, "rotation": 0, "w": 0.8, "d": 0.25, "h": 0.3, "variant": None}
    ]
    saved = await _ok(client, {"type": "home_3d/building/save", "building": building})
    bases = {t: c["hash"] for t, c in saved["recipes"].items()}
    building["recipes"] = saved["recipes"]

    await _ok(client, {"type": "home_3d/items/save", "item": {**SHELF, "size": [1.2, 0.25, 0.3]}})
    after = await _ok(client, {"type": "home_3d/building/get"})
    assert after["revision"] == saved["revision"] + 1
    assert after["building"]["recipes"][SHELF_TYPE]["recipe"]["size"] == [1.2, 0.25, 0.3]

    edited = copy.deepcopy(building)
    edited["floors"][0]["rooms"][0]["name"] = "Lounge"
    msg = {"type": "home_3d/building/save", "building": edited, "recipe_bases": bases}
    result = await _ok(client, {**msg, "base_revision": saved["revision"]})
    assert result["recipes"][SHELF_TYPE]["recipe"]["size"] == [1.2, 0.25, 0.3]
    got = (await _ok(client, {"type": "home_3d/building/get"}))["building"]
    assert _room(got) == "Lounge"
    assert got["recipes"][SHELF_TYPE]["recipe"]["size"] == [1.2, 0.25, 0.3]


async def test_a_server_change_of_more_than_recipes_makes_a_save_stale(hass: HomeAssistant) -> None:
    await _setup(hass)
    home: Home = hass.data[DOMAIN].active
    await home.async_save_building(_named("One"))
    await home.async_update_building(lambda b: {**b, "settings": {**b["settings"], "grid": 0.1}})
    try:
        await home.async_save_building(_named("Two"), base_revision=1)
    except RevisionConflict as err:
        assert (err.base, err.revision) == (1, 2)
    else:
        raise AssertionError("the save from revision 1 went through")
    assert home.building["settings"]["grid"] == 0.1
    # nothing to change: no new revision
    assert await home.async_update_building(lambda b: None) == 2


def _slow_writes(home: Home) -> list[int]:
    """Make the home's building writes take a moment, as on a slow disk; the revisions written, in order."""
    written: list[int] = []
    store = home._building_store
    original = store.async_save

    async def slow(data: dict[str, Any]) -> None:
        await asyncio.sleep(0.01)
        written.append(data["revision"])
        await original(data)

    store.async_save = slow  # type: ignore[method-assign]
    return written


async def test_overlapping_saves_get_their_own_revisions_and_events(hass: HomeAssistant) -> None:
    """Two saves landing together: each answers with its own revision and each change is announced."""
    await _setup(hass)
    home: Home = hass.data[DOMAIN].active
    written = _slow_writes(home)
    events: list[int] = []
    unsub = async_dispatcher_connect(hass, SIGNAL_BUILDING_UPDATED, callback(lambda _h, rev: events.append(rev)))
    first, second = await asyncio.gather(home.async_save_building(_named("A")), home.async_save_building(_named("B")))
    unsub()
    assert sorted([first, second]) == [1, 2]
    assert sorted(events) == [1, 2]
    assert written == [1, 2]
    assert home.revision == 2


async def test_two_editors_saving_from_the_same_revision_at_once(hass: HomeAssistant) -> None:
    """Both started from revision 1 and save at the same moment: one wins, the other is refused, none is lost."""
    await _setup(hass)
    home: Home = hass.data[DOMAIN].active
    await home.async_save_building(_named("Start"))
    _slow_writes(home)
    results = await asyncio.gather(
        home.async_save_building(_named("Phone"), base_revision=1),
        home.async_save_building(_named("Desktop"), base_revision=1),
        return_exceptions=True,
    )
    assert results[0] == 2
    assert isinstance(results[1], RevisionConflict)
    assert _room(home.building) == "Phone"


async def test_a_pack_update_never_overwrites_a_save_that_lands_meanwhile(hass: HomeAssistant) -> None:
    """A server-side change works on the plan as it is once the running save is done, not on an older copy."""
    await _setup(hass)
    home: Home = hass.data[DOMAIN].active
    await home.async_save_building(_named("Start"))
    _slow_writes(home)
    save = asyncio.ensure_future(home.async_save_building(_named("Saved meanwhile")))
    await asyncio.sleep(0)
    update = asyncio.ensure_future(
        home.async_update_building(lambda b: {**b, "settings": {**b["settings"], "grid": 0.2}})
    )
    await asyncio.gather(save, update)
    assert _room(home.building) == "Saved meanwhile"
    assert home.building["settings"]["grid"] == 0.2
    assert home.revision == 3


async def test_a_restore_waits_for_a_running_save(hass: HomeAssistant) -> None:
    """The restore point it keeps is the plan that save wrote, so the save is not lost by the restore either."""
    await _setup(hass)
    home: Home = hass.data[DOMAIN].active
    await home.async_save_building(_named("Start"))
    _slow_writes(home)
    save = asyncio.ensure_future(home.async_save_building(_named("Saved meanwhile")))
    await asyncio.sleep(0)
    restore = asyncio.ensure_future(home.async_restore(_named("Restored")))
    await asyncio.gather(save, restore)
    assert _room(home.building) == "Restored"
    newest = home.history()[0]["id"]
    assert _room(home.snapshot(newest) or {}) == "Saved meanwhile"


async def test_a_save_from_someone_no_admin_is_checked_against_the_plan_it_replaces(
    hass: HomeAssistant,
) -> None:
    """The perform-action check (#51) sees the plan as it is when the save runs (the guard), not an older one."""
    await _setup(hass)
    home: Home = hass.data[DOMAIN].active
    seen: list[str] = []
    await home.async_save_building(_named("Start"))
    await home.async_save_building(_named("Next"), guard=lambda current: seen.append(_room(current)))
    assert seen == ["Start"]

    def refuse(_current: dict[str, Any]) -> None:
        raise ValueError("refused")

    with contextlib.suppress(ValueError):
        await home.async_save_building(_named("Refused"), guard=refuse)
    assert (_room(home.building), home.revision) == ("Next", 2)
