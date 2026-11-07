"""Each restore point says how big its saved plan is (#240)."""

from __future__ import annotations

import copy
import json

from homeassistant.core import HomeAssistant

from tests.test_init import BUILDING, _setup


async def _ok(client, msg: dict) -> dict:
    await client.send_json_auto_id(msg)
    result = await client.receive_json()
    assert result["success"], result
    return result["result"]


async def test_restore_points_carry_the_size_of_their_plan(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await _ok(client, {"type": "home_3d/building/save", "building": BUILDING})
    home = hass.data["home_3d"].active
    await home.async_snapshot()
    bigger = copy.deepcopy(BUILDING)
    bigger["floors"][0]["rooms"] = bigger["floors"][0]["rooms"] * 20
    await _ok(client, {"type": "home_3d/building/save", "building": bigger})
    await home.async_snapshot()

    points = (await _ok(client, {"type": "home_3d/history/list"}))["snapshots"]
    assert len(points) >= 2
    for point in points:
        assert isinstance(point["size"], int) and point["size"] > 0
        stored = home.snapshot(point["id"])
        assert point["size"] == len(json.dumps(stored, separators=(",", ":")).encode())
    # newest first: the second point holds the plan with twenty times the rooms
    assert points[0]["size"] > points[-1]["size"]
    # asking again gives the same numbers (they are kept, not worked out again)
    again = (await _ok(client, {"type": "home_3d/history/list"}))["snapshots"]
    assert [p["size"] for p in again] == [p["size"] for p in points]
