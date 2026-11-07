"""Full backup: export of plan and packs, restore with a fresh content check."""

from __future__ import annotations

import json

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.home_3d.const import DATA_PACK_UPDATES, DOMAIN
from custom_components.home_3d.storage import Home
from tests.test_init import BUILDING

PAYLOAD = {
    "format": "fp3dpack",
    "version": 1,
    "id": "test.backup",
    "name": "Backup",
    "publisher": "Test",
    "items": [
        {
            "id": "cube",
            "name": {"fr": "Dé", "en": "Cube"},
            "size": [0.5, 0.5, 0.5],
            "parts": [{"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 1, "color": "body"}],
        }
    ],
}


async def test_backup_round_trip(hass: HomeAssistant, hass_ws_client) -> None:
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)

    # an imported pack keeps its source
    await client.send_json_auto_id({"type": "home_3d/packs/import", "pack": json.dumps({"payload": PAYLOAD})})
    assert (await client.receive_json())["success"]
    building = json.loads(json.dumps(BUILDING))
    building["floors"][0]["name"] = "Backup floor"
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": building})
    assert (await client.receive_json())["success"]

    await client.send_json_auto_id({"type": "home_3d/backup/export"})
    backup = (await client.receive_json())["result"]
    assert backup["format"] == "home3d-backup"
    assert backup["building"]["floors"][0]["name"] == "Backup floor"
    assert backup["packs"][0]["source"]["id"] == "test.backup"

    # a broken pack and one without its source are skipped on restore, the good one comes back
    broken = json.loads(json.dumps(backup["packs"][0]))
    broken["id"] = broken["source"]["id"] = "test.broken"
    broken["source"]["items"] = "not a list"
    sourceless = {k: v for k, v in backup["packs"][0].items() if k != "source"}
    sourceless["id"] = "test.sourceless"
    backup["building"]["floors"][0]["name"] = "Restored floor"
    restore = {"type": "home_3d/backup/import", "building": backup["building"]}
    await client.send_json_auto_id({**restore, "packs": [*backup["packs"], broken, sourceless]})
    result = await client.receive_json()
    assert result["success"], result
    assert result["result"]["packs"] == 1
    assert sorted(s["id"] for s in result["result"]["skipped"]) == ["test.broken", "test.sourceless"]
    assert result["result"]["building"]["floors"][0]["name"] == "Restored floor"

    await client.send_json_auto_id({"type": "home_3d/packs/list"})
    listed = (await client.receive_json())["result"]["packs"]
    # the restored pack, after the packs that come with Home 3D (never part of a backup)
    assert [p["id"] for p in listed if not p.get("bundled")] == ["test.backup"]

    # a broken building is refused before anything changes
    await client.send_json_auto_id({"type": "home_3d/backup/import", "building": {"version": 99}, "packs": []})
    result = await client.receive_json()
    assert not result["success"] and result["error"]["code"] == "invalid_format"


async def test_a_room_panel_layout_is_saved_and_kept_in_backups(hass: HomeAssistant, hass_ws_client) -> None:
    """What an editor chose for a room's panel (#229) is part of the plan: saved, exported and restored with it."""
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)

    layout = {"pinned": ["light.sample_lounge"], "order": ["switch.sample_fan"], "groups": ["switches", "lights"]}
    building = json.loads(json.dumps(BUILDING))
    building["floors"][0]["rooms"][0] |= {"panel_layout": layout, "hidden": ["sensor.sample_battery"]}
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": building})
    assert (await client.receive_json())["success"]

    await client.send_json_auto_id({"type": "home_3d/backup/export"})
    backup = (await client.receive_json())["result"]
    room = backup["building"]["floors"][0]["rooms"][0]
    assert room["panel_layout"] == layout and room["hidden"] == ["sensor.sample_battery"]

    room["panel_layout"] = {"pinned": ["light.sample_hall"]}
    await client.send_json_auto_id({"type": "home_3d/backup/import", "building": backup["building"], "packs": []})
    result = await client.receive_json()
    assert result["success"], result
    assert result["result"]["building"]["floors"][0]["rooms"][0]["panel_layout"] == {"pinned": ["light.sample_hall"]}


# ---------------------------------------------------------------------------- non-destructive import (#153)


def _named(name: str) -> dict:
    building = json.loads(json.dumps(BUILDING))
    building["floors"][0]["rooms"][0]["name"] = name
    return building


async def _call(client, msg: dict) -> dict:
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def _ok(client, msg: dict) -> dict:
    result = await _call(client, msg)
    assert result["success"], result
    return result["result"]


async def _imported(client) -> list[str]:
    listed = (await _ok(client, {"type": "home_3d/packs/list"}))["packs"]
    return sorted(p["id"] for p in listed if not p.get("bundled") and not p.get("custom"))


def _room_of(hass: HomeAssistant, home_id: str) -> str:
    return hass.data[DOMAIN].homes[home_id].building["floors"][0]["rooms"][0]["name"]


async def _with_a_pack(hass: HomeAssistant, hass_ws_client):
    """Set up with one imported pack; the client and that pack as a backup carries it (with its source)."""
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)
    await _ok(client, {"type": "home_3d/packs/import", "pack": json.dumps({"payload": PAYLOAD})})
    pack = (await _ok(client, {"type": "home_3d/backup/export"}))["packs"][0]
    return client, pack


def _other_pack(pack: dict, pack_id: str) -> dict:
    other = json.loads(json.dumps(pack))
    other["id"] = other["source"]["id"] = pack_id
    return other


async def test_a_backup_without_packs_leaves_the_installed_ones(hass: HomeAssistant, hass_ws_client) -> None:
    """An older or trimmed backup file has no packs: restoring it must not remove any (#153)."""
    client, _pack = await _with_a_pack(hass, hass_ws_client)
    await _ok(client, {"type": "home_3d/backup/import", "building": _named("Restored")})
    assert await _imported(client) == ["test.backup"]
    # an empty list is no reason to remove them either
    result = await _ok(client, {"type": "home_3d/backup/import", "building": _named("Again"), "packs": []})
    assert result["packs"] == 0
    assert await _imported(client) == ["test.backup"]


async def test_a_backup_adds_its_packs_and_keeps_the_others(hass: HomeAssistant, hass_ws_client) -> None:
    client, pack = await _with_a_pack(hass, hass_ws_client)
    other = _other_pack(pack, "test.other")
    result = await _ok(client, {"type": "home_3d/backup/import", "building": _named("R"), "packs": [other]})
    assert result["packs"] == 1
    assert await _imported(client) == ["test.backup", "test.other"]


async def test_a_failing_restore_puts_everything_back(hass: HomeAssistant, hass_ws_client, monkeypatch) -> None:
    """A storage error on the second home of a backup: the first home, the home made for the backup and the packs
    are as they were before, and the answer says so."""
    client, pack = await _with_a_pack(hass, hass_ws_client)
    first = (await _ok(client, {"type": "home_3d/homes/list"}))["active"]
    await _ok(client, {"type": "home_3d/building/save", "building": _named("Before A")})
    second = (await _ok(client, {"type": "home_3d/homes/create", "name": "B"}))["home"]["id"]
    await _ok(client, {"type": "home_3d/building/save", "home_id": second, "building": _named("Before B")})
    await _ok(client, {"type": "home_3d/items/save", "item": {**PAYLOAD["items"][0], "id": "own_cube"}})

    restore = Home.async_restore

    async def failing(self: Home, building: dict) -> int:
        if building["floors"][0]["rooms"][0]["name"] == "Backup B":
            raise OSError("disk full")
        return await restore(self, building)

    monkeypatch.setattr(Home, "async_restore", failing)
    backup = {
        "type": "home_3d/backup/import",
        "homes": [
            {"id": first, "name": "Renamed", "building": _named("Backup A")},
            {"id": "newhome", "name": "New", "building": _named("Backup New")},
            {"id": second, "name": "B", "building": _named("Backup B")},
        ],
        "active": second,
        "packs": [_other_pack(pack, "test.other")],
        "items": [{**PAYLOAD["items"][0], "id": "backup_cube"}],
    }
    result = await _call(client, backup)
    assert not result["success"]
    assert result["error"]["code"] == "restore_failed"
    assert "disk full" in result["error"]["message"] and "put back" in result["error"]["message"]

    data = hass.data[DOMAIN]
    assert sorted(data.homes) == sorted([first, second])
    assert data.homes[first].name == "Home" and data.active_id == first
    assert _room_of(hass, first) == "Before A"
    assert _room_of(hass, second) == "Before B"
    assert await _imported(client) == ["test.backup"]
    assert [i["id"] for i in data.custom.items] == ["own_cube"]


async def test_a_backup_is_checked_whole_before_anything_is_written(hass: HomeAssistant, hass_ws_client) -> None:
    client, pack = await _with_a_pack(hass, hass_ws_client)
    await _ok(client, {"type": "home_3d/building/save", "building": _named("Before")})
    first = (await _ok(client, {"type": "home_3d/homes/list"}))["active"]
    twice = [
        {"id": first, "name": "Home", "building": _named("One")},
        {"id": first, "name": "Home", "building": _named("Two")},
    ]
    result = await _call(client, {"type": "home_3d/backup/import", "homes": twice})
    assert result["error"]["code"] == "invalid_format"
    # the panel checks every part of a backup first (one home per message): nothing changes, skipped packs are named
    broken = _other_pack(pack, "test.broken")
    broken["source"]["items"] = "not a list"
    checked = await _ok(
        client,
        {"type": "home_3d/backup/import", "building": _named("Checked"), "packs": [broken], "check_only": True},
    )
    assert checked == {"checked": True, "skipped": [{"id": "test.broken", "reason": checked["skipped"][0]["reason"]}]}
    assert _room_of(hass, first) == "Before"
    assert await _imported(client) == ["test.backup"]
    assert len((await _ok(client, {"type": "home_3d/history/list"}))["snapshots"]) == 0


async def test_pins_of_packs_no_longer_installed_are_dropped(hass: HomeAssistant, hass_ws_client) -> None:
    client, pack = await _with_a_pack(hass, hass_ws_client)
    updates = hass.data[DATA_PACK_UPDATES]
    updates.pinned = {"test.backup", "test.gone"}
    updates.previous = {"test.gone": {"id": "test.gone", "release": 1}}
    updates.checks = {"test.gone": {"checked_at": 1}, "test.backup": {"checked_at": 1}}
    await _ok(client, {"type": "home_3d/backup/import", "building": _named("R"), "packs": [pack]})
    assert updates.pinned == {"test.backup"}
    assert updates.previous == {}
    assert list(updates.checks) == ["test.backup"]


async def test_an_unreadable_home_is_skipped_and_the_others_restore(hass: HomeAssistant, hass_ws_client) -> None:
    """A home of a newer Home 3D, or with an invalid plan, is listed as skipped; the other homes come back (#380)."""
    client, _pack = await _with_a_pack(hass, hass_ws_client)
    await _ok(client, {"type": "home_3d/building/save", "building": _named("Before")})
    first = (await _ok(client, {"type": "home_3d/homes/list"}))["active"]
    too_new = {**_named("New"), "version": 9999}
    invalid = {**_named("Bad"), "floors": "not a list"}
    homes = [
        {"id": first, "name": "Home", "building": _named("Good")},
        {"id": "toonew", "name": "Newer", "building": too_new},
        {"id": "broken", "name": "Broken", "building": invalid},
    ]
    skipped = [{"id": "toonew", "reason": "home_unreadable"}, {"id": "broken", "reason": "home_unreadable"}]
    checked = await _ok(client, {"type": "home_3d/backup/import", "homes": homes, "check_only": True})
    assert checked["skipped"] == skipped
    assert _room_of(hass, first) == "Before"
    result = await _ok(client, {"type": "home_3d/backup/import", "homes": homes})
    assert result["skipped"] == skipped
    assert _room_of(hass, first) == "Good"
    assert sorted(hass.data[DOMAIN].homes) == [first]
    # a part with only the unreadable home restores no plan (the frontend sends one home per part); packs still do
    only = await _ok(client, {"type": "home_3d/backup/import", "homes": homes[1:2], "packs": []})
    assert only["skipped"] == skipped[:1]
    assert _room_of(hass, first) == "Good"
    # a single plan (a backup from before several homes) that is unreadable still refuses the file
    refused = await _call(client, {"type": "home_3d/backup/import", "building": too_new})
    assert refused["error"]["code"] == "invalid_format"
