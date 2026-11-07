"""Heavy work off the event loop (#176): plan checks and preparation, pack checks and large store writes.

A save from the editor arrives about every second; on a large plan its check and preparation take tens of
milliseconds, and checking a large pack takes hundreds. None of that may hold up Home Assistant's event loop. The
timing test prints what a save of a generated 500-item plan costs and fails only far above it.
"""

from __future__ import annotations

import asyncio
import json
import time
import tracemalloc
from typing import Any
from unittest.mock import patch

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.home_3d import pack_updates, websocket
from custom_components.home_3d.const import DATA_PACK_UPDATES, DOMAIN
from custom_components.home_3d.off_loop import OFF_LOOP
from custom_components.home_3d.storage import FloorplanData, Home

PACK_JSON = {
    "format": "home3d-pack",
    "version": 2,
    "id": "test.big",
    "name": "Big",
    "publisher": "Test",
    "licence": "MIT",
    "release": 1,
}
PART = {"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 0.55, "color": "fabric"}


def _pack_files(items: int = 3) -> dict[str, str]:
    files = {"pack.json": json.dumps(PACK_JSON)}
    for n in range(items):
        item = {"id": f"item_{n}", "name": {"en": f"Item {n}"}, "size": [0.8, 0.8, 0.75], "parts": [PART] * 6}
        files[f"item_{n}.json"] = json.dumps(item)
    return files


def _room(n: int) -> dict[str, Any]:
    x, z = (n % 5) * 5, (n // 5) * 5
    points = [[x, z], [x + 5, z], [x + 5, z + 5], [x, z + 5]]
    return {"id": f"r{n}", "name": f"Room {n}", "area_id": None, "points": points, "floor_material": "wood"}


def _plan(items: int, types: list[str]) -> dict[str, Any]:
    furniture = [
        {
            "id": f"f{n}",
            "type": types[n % len(types)],
            "x": (n % 25) + 0.5,
            "z": (n // 25) % 10 + 0.5,
            "rotation": 0,
            "w": 0.8,
            "d": 0.8,
            "h": 0.75,
            "variant": None,
        }
        for n in range(items)
    ]
    floor = {"id": "f1", "name": "Ground", "elevation": 0, "height": 2.5, "cut_height": 1.15}
    floor |= {"rooms": [_room(n) for n in range(10)], "openings": [], "furniture": furniture}
    floor |= {"placements": [], "background": None}
    return {"version": 1, "settings": {"wall_exterior": 0.24, "wall_interior": 0.12, "grid": 0.05}, "floors": [floor]}


async def _client(hass: HomeAssistant, hass_ws_client):
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    return await hass_ws_client(hass)


async def _call(client, **msg) -> Any:
    await client.send_json_auto_id(msg)
    result = await client.receive_json()
    assert result["success"], result
    return result["result"]


class _Where:
    """Wraps a function and notes whether each call ran in the event loop's thread."""

    def __init__(self, func: Any) -> None:
        self.func = func
        self.in_loop: list[bool] = []

    def __call__(self, *args: Any) -> Any:
        try:
            asyncio.get_running_loop()
            self.in_loop.append(True)
        except RuntimeError:
            self.in_loop.append(False)
        return self.func(*args)


async def test_a_save_is_checked_and_prepared_off_the_event_loop(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    check = _Where(websocket.BUILDING_SCHEMA)
    prepare = _Where(Home._prepared)
    with (
        patch.object(websocket, "BUILDING_SCHEMA", check),
        patch.object(Home, "_prepared", staticmethod(prepare)),
    ):
        await _call(client, type="home_3d/building/save", building=_plan(3, ["sofa"]))
    assert check.in_loop == [False]
    assert prepare.in_loop == [False]


async def test_a_plan_that_does_not_validate_is_still_refused(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    plan = _plan(1, ["sofa"])
    plan["floors"][0]["rooms"][0]["points"] = [[0, 0]]
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": plan})
    result = await client.receive_json()
    assert not result["success"]
    assert result["error"]["code"] == "invalid_format"
    assert "points" in result["error"]["message"]
    assert hass.data[DOMAIN].revision == 0


async def test_packs_are_checked_off_the_event_loop(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    folder = _Where(websocket.checked_folder)
    with patch.object(websocket, "checked_folder", folder):
        await _call(client, type="home_3d/packs/import", files=_pack_files())
    assert folder.in_loop == [False]

    # the scheduled check uses the same check
    assert pack_updates.checked_folder is websocket.checked_folder
    backup = _Where(websocket._checked_backup)
    plan = (await _call(client, type="home_3d/building/get"))["building"]
    source = hass.data[DOMAIN].packs[0]["source"]
    with patch.object(websocket, "_checked_backup", backup):
        result = await _call(
            client, type="home_3d/backup/import", building=plan, packs=[{"id": "test.big", "source": source}]
        )
    assert backup.in_loop == [False]
    assert result["packs"] == 1


async def test_large_stores_are_written_off_the_event_loop(hass: HomeAssistant, hass_ws_client) -> None:
    await _client(hass, hass_ws_client)
    if not OFF_LOOP:
        # an older Home Assistant always writes in the executor
        return
    data: FloorplanData = hass.data[DOMAIN]
    home = data.active
    stores = [
        home._building_store,
        home._image_store,
        home._history_store,
        data._pack_store,
        data.custom._store,
        hass.data[DATA_PACK_UPDATES]._store,
    ]
    assert [store._serialize_in_event_loop for store in stores] == [False] * len(stores)


async def test_the_save_of_a_500_item_plan_is_timed(hass: HomeAssistant, hass_ws_client, capsys) -> None:
    """A generated plan with 500 pack items (each with its recipe copy): save, restore point and get, and the longest
    time the event loop was held up meanwhile. Fails only far above what it takes (#176)."""
    client = await _client(hass, hass_ws_client)
    await _call(client, type="home_3d/packs/import", files=_pack_files(100))
    types = [f"pack:test.big:item_{n}" for n in range(100)]
    plan = _plan(500, types)
    await _call(client, type="home_3d/building/save", building=plan)
    # the plan as an editor sends it: with the recipe copies
    plan = (await _call(client, type="home_3d/building/get"))["building"]
    size = len(json.dumps(plan)) / 1e6
    data: FloorplanData = hass.data[DOMAIN]

    stalls: list[float] = []
    running = True

    async def watch() -> None:
        last = time.perf_counter()
        while running:
            await asyncio.sleep(0.002)
            now = time.perf_counter()
            stalls.append(now - last)
            last = now

    watcher = hass.async_create_task(watch())
    saves = []
    for n in range(5):
        moved = json.loads(json.dumps(plan))
        moved["floors"][0]["furniture"][n]["x"] += 0.1
        start = time.perf_counter()
        await _call(client, type="home_3d/building/save", building=moved)
        saves.append(time.perf_counter() - start)
    start = time.perf_counter()
    await data.async_snapshot()
    snapshot = time.perf_counter() - start
    start = time.perf_counter()
    await _call(client, type="home_3d/building/get")
    get = time.perf_counter() - start
    running = False
    await watcher

    tracemalloc.start()
    kept = json.loads(json.dumps(data.building))
    ram = tracemalloc.get_traced_memory()[0] / 1e6
    tracemalloc.stop()
    del kept

    with capsys.disabled():
        print(
            f"\n500-item plan ({size:.2f} MB): save {sum(saves) / len(saves) * 1000:.0f} ms on average,"
            f" restore point {snapshot * 1000:.0f} ms, get {get * 1000:.0f} ms,"
            f" longest event loop hold-up {max(stalls) * 1000:.0f} ms, one copy in memory {ram:.1f} MB"
        )
    # generous: the test harness itself (asyncio debug mode, the storage mock) is most of the hold-up measured here
    assert max(saves) < 3.0
    assert max(stalls) < 1.0
