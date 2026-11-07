"""The pictures restore points refer to (#154): kept while a restore point younger than the setting (default 90 days)
names them, removed after that; a restore point whose picture has gone restores without it and says so."""

from __future__ import annotations

import copy
import time
from typing import Any

from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.home_3d.const import DOMAIN, STORAGE_KEY_BUILDING, STORAGE_KEY_HISTORY, STORAGE_KEY_IMAGES
from tests.test_init import BUILDING, IMAGE, _setup

DAY = 86400


def _with_background(image_id: str) -> dict[str, Any]:
    building = copy.deepcopy(BUILDING)
    building["floors"][0]["background"]["image_id"] = image_id
    return building


async def _ok(client, msg: dict) -> dict:
    await client.send_json_auto_id(msg)
    result = await client.receive_json()
    assert result["success"], result
    return result["result"]


async def _setup_entry(hass: HomeAssistant, entry: MockConfigEntry) -> None:
    await async_setup_component(hass, "http", {})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()


async def _restart(hass: HomeAssistant, entry: ConfigEntry) -> None:
    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()


def _stored(hass_storage, *, points: list[tuple[str, float]], images: list[str]) -> None:
    """A plan using `current.png`, restore points (background image, age in days) and the stored pictures."""
    now = time.time()
    hass_storage[STORAGE_KEY_BUILDING] = {
        "version": 1,
        "minor_version": 2,
        "key": STORAGE_KEY_BUILDING,
        "data": {"revision": 5, "building": _with_background("current.png")},
    }
    hass_storage[STORAGE_KEY_HISTORY] = {
        "version": 1,
        "key": STORAGE_KEY_HISTORY,
        "data": {
            "snapshots": [
                {"id": f"p{i}", "revision": i, "saved_at": now - age * DAY, "building": _with_background(image)}
                for i, (image, age) in enumerate(points)
            ]
        },
    }
    hass_storage[STORAGE_KEY_IMAGES] = {
        "version": 1,
        "key": STORAGE_KEY_IMAGES,
        "data": {"images": dict.fromkeys(images, IMAGE)},
    }


async def test_a_replaced_background_comes_back_with_its_restore_point(hass: HomeAssistant, hass_ws_client) -> None:
    """Set a background, replace it, restart, restore: the old background is there again."""
    entry = await _setup(hass)
    client = await hass_ws_client(hass)
    await _ok(client, {"type": "home_3d/image/set", "image_id": "first", "data": IMAGE})
    await _ok(client, {"type": "home_3d/building/save", "building": _with_background("first")})
    await _ok(client, {"type": "home_3d/image/set", "image_id": "second", "data": IMAGE})
    await _ok(client, {"type": "home_3d/building/save", "building": _with_background("second")})
    point = (await _ok(client, {"type": "home_3d/history/list"}))["snapshots"][0]
    assert point["missing_pictures"] == 0

    await _restart(hass, entry)
    client = await hass_ws_client(hass)
    restored = await _ok(client, {"type": "home_3d/history/restore", "snapshot_id": point["id"]})
    assert restored["missing_pictures"] == 0
    got = (await _ok(client, {"type": "home_3d/building/get"}))["building"]
    assert got["floors"][0]["background"]["image_id"] == "first"
    assert (await _ok(client, {"type": "home_3d/image/get", "image_id": "first"}))["data"] == IMAGE


async def test_pictures_only_old_restore_points_use_go_after_90_days(
    hass: HomeAssistant, hass_ws_client, hass_storage
) -> None:
    _stored(hass_storage, points=[("old.png", 91), ("recent.png", 89)], images=["current.png", "old.png", "recent.png"])
    await _setup(hass)
    home = hass.data[DOMAIN].active
    assert sorted(home.images) == ["current.png", "recent.png"]

    # the old restore point is still there; it says what it lacks and restores without it
    client = await hass_ws_client(hass)
    snapshots = (await _ok(client, {"type": "home_3d/history/list"}))["snapshots"]
    assert {p["id"]: p["missing_pictures"] for p in snapshots} == {"p0": 1, "p1": 0}
    restored = await _ok(client, {"type": "home_3d/history/restore", "snapshot_id": "p0"})
    assert restored["missing_pictures"] == 1
    got = (await _ok(client, {"type": "home_3d/building/get"}))["building"]
    assert got["floors"][0]["rooms"][0]["name"] == "Living"


async def test_the_days_are_a_setting(hass: HomeAssistant, hass_storage) -> None:
    _stored(hass_storage, points=[("week.png", 7), ("month.png", 30)], images=["current.png", "week.png", "month.png"])
    entry = MockConfigEntry(domain=DOMAIN, data={}, options={"restore_picture_days": 10})
    await _setup_entry(hass, entry)
    assert sorted(hass.data[DOMAIN].active.images) == ["current.png", "week.png"]

    # 0: a picture only a restore point uses goes at the next start
    hass.config_entries.async_update_entry(entry, options={"restore_picture_days": 0})
    await hass.async_block_till_done()
    assert hass.data[DOMAIN].picture_days == 0
    await _restart(hass, entry)
    assert sorted(hass.data[DOMAIN].active.images) == ["current.png"]


async def test_an_unreadable_restore_point_keeps_every_picture(hass: HomeAssistant, hass_storage) -> None:
    _stored(hass_storage, points=[("old.png", 400)], images=["current.png", "old.png", "spare.png"])
    hass_storage[STORAGE_KEY_HISTORY]["data"]["snapshots"].append({"id": "broken", "revision": 9})
    await _setup(hass)
    assert sorted(hass.data[DOMAIN].active.images) == ["current.png", "old.png", "spare.png"]


async def test_a_duplicated_home_takes_only_the_pictures_its_plan_uses(hass: HomeAssistant, hass_storage) -> None:
    _stored(hass_storage, points=[("recent.png", 1)], images=["current.png", "recent.png"])
    await _setup(hass)
    data = hass.data[DOMAIN]
    copy_ = await data.async_duplicate_home(data.active_id, "Copy")
    assert sorted(copy_.images) == ["current.png"]
    # the original keeps the picture its restore point needs
    assert sorted(data.active.images) == ["current.png", "recent.png"]
