"""The plan's schema version and its migrations on the server (#165): an older plan is brought up to the current
version wherever it comes in (a stored plan, a save, a backup, a restore point), every step is idempotent and loses
nothing, and a stored plan that does not validate is repaired or shown read-only instead of passed on unchanged."""

from __future__ import annotations

import copy
import json
from pathlib import Path
from typing import Any

from homeassistant.core import HomeAssistant
import pytest
import voluptuous as vol

from custom_components.home_3d.const import (
    DOMAIN,
    PLAN_VERSION,
    STORAGE_KEY_BUILDING,
    STORAGE_KEY_HISTORY,
    STORAGE_KEY_IMAGES,
)
from custom_components.home_3d.migrations import MIGRATIONS, PlanTooNew, lights_to_lamps, migrate_plan
from custom_components.home_3d.schema import BUILDING_SCHEMA, empty_building
from custom_components.home_3d.storage import PlanReadOnly, check_plan
from tests.test_init import BUILDING, IMAGE, _setup

PLANS = Path(__file__).parent / "fixtures" / "plans"
SAMPLE = Path(__file__).parent.parent / "custom_components" / "home_3d" / "sample" / "sample-home.json"


def _plan(name: str) -> dict[str, Any]:
    return json.loads((PLANS / name).read_text(encoding="utf-8"))


def _entities(plan: dict[str, Any]) -> list[str]:
    """Every entity a plan links by a placement or an item, in a fixed order."""
    linked = [p["entity_id"] for f in plan["floors"] for p in f["placements"]]
    linked += [m["entity"] for f in plan["floors"] for m in f["furniture"] if m.get("entity")]
    return sorted(linked)


def _stored(hass_storage: dict[str, Any], building: Any, revision: int = 4) -> None:
    hass_storage[STORAGE_KEY_BUILDING] = {
        "version": 1,
        "minor_version": 2,
        "key": STORAGE_KEY_BUILDING,
        "data": {"revision": revision, "building": building},
    }


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


# ---------------------------------------------------------------------------- the steps


def test_every_version_but_the_first_has_its_step() -> None:
    assert len(MIGRATIONS) == PLAN_VERSION - 1
    assert empty_building()["version"] == PLAN_VERSION


def test_lights_placed_as_devices_become_lamps_golden_file() -> None:
    """Version 1 in, version 2 out, exactly as the golden file says: lamps of their mount type with what a pin and a
    lamp share, a light kept as a pin on purpose stays, an id the floor has already is not taken twice."""
    old = _plan("v1-lights.json")
    kept = copy.deepcopy(old)
    assert migrate_plan(old) == _plan("v1-lights.migrated.json")
    assert old == kept, "the plan given is left as it was"
    # and it validates as a plan of the current version, the same as the golden file does
    assert BUILDING_SCHEMA(old) == BUILDING_SCHEMA(_plan("v1-lights.migrated.json"))


def test_a_lights_mount_height_becomes_the_lamps_mount_y() -> None:
    """#381: the placement's `y` is the lamp's `mount_y`; no height keeps the type's default (no key), a bad one is
    kept within the lamp's range."""
    plan = _plan("v1-lights.json")
    lamps = {i["entity"]: i for f in migrate_plan(plan)["floors"] for i in f["furniture"] if i.get("entity")}
    assert lamps["light.sample_wall"]["mount_y"] == 1.8
    assert "mount_y" not in lamps["light.sample_ceiling"]
    for placement in plan["floors"][0]["placements"]:
        if placement["entity_id"] == "light.sample_wall":
            placement["y"] = 25
    high = {i["entity"]: i for f in migrate_plan(plan)["floors"] for i in f["furniture"] if i.get("entity")}
    assert high["light.sample_wall"]["mount_y"] == 10.0
    assert BUILDING_SCHEMA(migrate_plan(_plan("v1-lights.json")))


def test_migrations_are_idempotent() -> None:
    once = migrate_plan(_plan("v1-lights.json"))
    assert migrate_plan(once) is once, "a plan of the current version is passed on as it is"
    assert lights_to_lamps(once) is once, "the step itself changes nothing on its own output"
    checked = BUILDING_SCHEMA(_plan("v1-lights.json"))
    assert BUILDING_SCHEMA(copy.deepcopy(checked)) == checked


def test_a_migration_never_loses_a_linked_entity() -> None:
    old = _plan("v1-lights.json")
    assert _entities(migrate_plan(old)) == _entities(old)
    assert _entities(BUILDING_SCHEMA(old)) == _entities(old)


@pytest.mark.parametrize(
    "plan",
    [
        # the first plans: version, floors and settings only (no energy, presence, outdoor areas, walls)
        {"version": 1, "floors": [], "settings": {"wall_exterior": 0.24, "wall_interior": 0.12, "grid": 0.05}},
        BUILDING,
        # the shipped sample home is a version-1 plan
        json.loads(SAMPLE.read_text(encoding="utf-8")),
        _plan("v1-lights.json"),
    ],
    ids=["first", "test-plan", "sample", "lights"],
)
def test_old_plan_shapes_come_up_to_the_current_version(plan: dict[str, Any]) -> None:
    checked = BUILDING_SCHEMA(copy.deepcopy(plan))
    assert checked["version"] == PLAN_VERSION
    assert "energy" in checked and "presence" in checked
    assert len(checked["floors"]) == len(plan["floors"])
    assert _entities(checked) == _entities(plan)
    assert check_plan(plan) == (checked, None)


def test_a_plan_of_a_newer_home_3d_is_refused_with_a_clear_message() -> None:
    newer = {**BUILDING, "version": PLAN_VERSION + 1}
    with pytest.raises(PlanTooNew, match=r"made by a newer Home 3D.*update Home 3D"):
        migrate_plan(newer)
    with pytest.raises(vol.Invalid):
        BUILDING_SCHEMA(newer)
    plan, problem = check_plan(newer)
    assert plan is newer
    assert problem is not None and problem["code"] == "plan_too_new"


@pytest.mark.parametrize("version", [None, 0, "1", True, 1.0])
def test_a_plan_without_a_version_number_is_invalid(version: Any) -> None:
    with pytest.raises(vol.Invalid):
        BUILDING_SCHEMA({**BUILDING, "version": version})


# ---------------------------------------------------------------------------- repair


def _with_bad_item(building: dict[str, Any]) -> dict[str, Any]:
    bad = copy.deepcopy(building)
    good = {"id": "sofa1", "type": "sofa", "x": 1, "z": 1, "rotation": 0, "w": 2, "d": 0.9, "h": 0.8, "variant": None}
    bad["floors"][0]["furniture"] = [
        good,
        # x is required and out of range: the item goes
        {**good, "id": "far", "x": 5000},
        # a label too long (an optional field): only the field goes
        {**good, "id": "named", "name": "n" * 500},
    ]
    return bad


def test_an_invalid_part_is_left_out_and_named() -> None:
    plan, problem = check_plan(_with_bad_item(BUILDING))
    assert problem is not None and problem["code"] == "plan_repaired"
    assert sorted(problem["dropped"]) == ["floors.0.furniture.1", "floors.0.furniture.2.name"]
    assert [m["id"] for m in plan["floors"][0]["furniture"]] == ["sofa1", "named"]
    assert plan["floors"][0]["furniture"][1].get("name") is None
    assert BUILDING_SCHEMA(copy.deepcopy(plan)) == plan


def test_a_plan_beyond_repair_is_kept_as_it_is() -> None:
    """Never a whole floor goes, nor a required field of the plan: that plan comes back unchanged, as invalid."""
    broken = copy.deepcopy(BUILDING)
    broken["floors"][0]["name"] = "n" * 500
    plan, problem = check_plan(broken)
    assert plan is broken
    assert problem is not None and problem["code"] == "plan_invalid"
    assert "read-only" in problem["message"]
    for nothing in ({"version": 1}, {"version": 1, "floors": "none", "settings": {}}):
        assert check_plan(nothing)[1]["code"] == "plan_invalid"  # type: ignore[index]


# ---------------------------------------------------------------------------- the stored plan


async def test_a_stored_old_plan_is_migrated_once_and_kept_as_a_restore_point(
    hass: HomeAssistant, hass_ws_client, hass_storage
) -> None:
    old = _plan("v1-lights.json")
    _stored(hass_storage, old)
    entry = await _setup(hass)
    home = hass.data[DOMAIN].active
    assert home.building["version"] == PLAN_VERSION
    lamps = [m["type"] for m in home.building["floors"][0]["furniture"]][1:]
    assert lamps == ["lamp_ceiling", "lamp_floor", "lamp_wall"]
    assert home.problem is None and not home.read_only
    # written back once, at the revision it had; the plan as stored is a restore point
    stored = hass_storage[STORAGE_KEY_BUILDING]["data"]
    assert (stored["revision"], stored["building"]["version"]) == (4, PLAN_VERSION)
    points = hass_storage[STORAGE_KEY_HISTORY]["data"]["snapshots"]
    assert [p["building"] for p in points] == [old]

    client = await hass_ws_client(hass)
    got = await _ok(client, {"type": "home_3d/building/get"})
    assert got["building"]["version"] == PLAN_VERSION and "problem" not in got

    # the next start finds a plan of the current version: nothing more is kept or written
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert len(hass_storage[STORAGE_KEY_HISTORY]["data"]["snapshots"]) == 1
    assert hass.data[DOMAIN].active.building["floors"] == home.building["floors"]


async def test_a_version_one_plan_with_nothing_to_migrate_keeps_no_extra_restore_point(
    hass: HomeAssistant, hass_storage
) -> None:
    _stored(hass_storage, copy.deepcopy(BUILDING))
    await _setup(hass)
    assert hass_storage[STORAGE_KEY_BUILDING]["data"]["building"]["version"] == PLAN_VERSION
    assert STORAGE_KEY_HISTORY not in hass_storage


async def test_a_stored_plan_with_invalid_parts_is_repaired_and_says_so(
    hass: HomeAssistant, hass_ws_client, hass_storage
) -> None:
    bad = _with_bad_item(BUILDING)
    _stored(hass_storage, bad)
    await _setup(hass)
    home = hass.data[DOMAIN].active
    assert [m["id"] for m in home.building["floors"][0]["furniture"]] == ["sofa1", "named"]
    assert [p["building"] for p in hass_storage[STORAGE_KEY_HISTORY]["data"]["snapshots"]] == [bad]
    client = await hass_ws_client(hass)
    got = await _ok(client, {"type": "home_3d/building/get"})
    assert got["problem"]["code"] == "plan_repaired"
    assert got["can_edit"] is True
    # the next save is of a valid plan: the notice goes
    await _ok(client, {"type": "home_3d/building/save", "building": got["building"], "base_revision": 4})
    assert "problem" not in await _ok(client, {"type": "home_3d/building/get"})


@pytest.mark.parametrize(
    ("change", "code"),
    [({"version": PLAN_VERSION + 1, "rooms_v3": [{"id": "x"}]}, "plan_too_new"), ({"settings": 7}, "plan_invalid")],
)
async def test_a_stored_plan_this_home_3d_cannot_read_is_shown_read_only_and_never_written_over(
    hass: HomeAssistant, hass_ws_client, hass_storage, change: dict[str, Any], code: str
) -> None:
    unreadable = {**copy.deepcopy(BUILDING), **change}
    _stored(hass_storage, unreadable)
    hass_storage[STORAGE_KEY_IMAGES] = {
        "version": 1,
        "key": STORAGE_KEY_IMAGES,
        "data": {"images": {"img1": IMAGE, "spare": IMAGE}},
    }
    await _setup(hass)
    home = hass.data[DOMAIN].active
    assert home.read_only and home.problem is not None and home.problem["code"] == code
    assert home.building == unreadable
    # no picture is removed while the plan cannot be read
    assert sorted(home.images) == ["img1", "spare"]

    client = await hass_ws_client(hass)
    got = await _ok(client, {"type": "home_3d/building/get"})
    assert got["building"] == unreadable
    assert got["problem"]["code"] == code
    assert got["can_edit"] is False
    assert (await _ok(client, {"type": "home_3d/homes/list"}))["homes"][0]["floors"] == 1

    # an editor's save and the server's own changes leave it alone
    refused = await _call(client, {"type": "home_3d/building/save", "building": BUILDING})
    assert refused["error"]["code"] == "read_only"
    with pytest.raises(PlanReadOnly):
        await home.async_save_building(copy.deepcopy(BUILDING))
    assert await home.async_update_building(lambda b: {**b, "settings": {}}) == 4
    await home.async_follow_custom_items()
    assert hass_storage[STORAGE_KEY_BUILDING]["data"] == {"revision": 4, "building": unreadable}

    # a restore replaces it, the unreadable plan kept as a restore point
    restored = await home.async_restore(BUILDING_SCHEMA(copy.deepcopy(BUILDING)))
    assert restored == 5 and not home.read_only and home.problem is None
    assert home.snapshot(home.history()[0]["id"]) == unreadable
    point = home.history()[0]
    assert point["floors"] == 1
    # restoring that point again is refused: it cannot be read
    again = await _call(client, {"type": "home_3d/history/restore", "snapshot_id": point["id"]})
    assert again["error"]["code"] == "invalid_format"


# ---------------------------------------------------------------------------- plans coming in


async def test_a_save_from_an_older_client_is_migrated(hass: HomeAssistant, hass_ws_client, hass_storage) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    result = await _ok(client, {"type": "home_3d/building/save", "building": _plan("v1-lights.json")})
    stored = hass_storage[STORAGE_KEY_BUILDING]["data"]["building"]
    assert stored["version"] == PLAN_VERSION
    assert stored["floors"] == BUILDING_SCHEMA(_plan("v1-lights.migrated.json"))["floors"]
    assert result["revision"] == 1
    newer_plan = {**BUILDING, "version": PLAN_VERSION + 1}
    newer = await _call(client, {"type": "home_3d/building/save", "building": newer_plan})
    assert newer["error"]["code"] == "invalid_format"
    assert "newer Home 3D" in newer["error"]["message"]


async def test_a_backup_and_a_restore_point_of_an_older_plan_are_migrated(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    home = hass.data[DOMAIN].active
    await _ok(client, {"type": "home_3d/backup/import", "building": _plan("v1-lights.json")})
    assert home.building["version"] == PLAN_VERSION
    assert {m["type"] for m in home.building["floors"][0]["furniture"]} >= {"lamp_ceiling", "lamp_wall"}
    homes = [{"id": "second", "name": "Second", "building": _plan("v1-lights.json")}]
    await _ok(client, {"type": "home_3d/backup/import", "homes": homes})
    assert hass.data[DOMAIN].homes["second"].building["version"] == PLAN_VERSION

    # a restore point written before the migration (an older version's history store) comes back migrated
    home._history.append({"id": "old", "revision": 1, "saved_at": 0, "building": _plan("v1-lights.json")})
    await _ok(client, {"type": "home_3d/history/restore", "snapshot_id": "old"})
    assert home.building["version"] == PLAN_VERSION
    assert not [p for p in home.building["floors"][0]["placements"] if p["entity_id"] == "light.sample_wall"]


async def test_a_new_home_from_an_older_plan_is_migrated(hass: HomeAssistant) -> None:
    await _setup(hass)
    home = await hass.data[DOMAIN].async_create_home("Copy", _plan("v1-lights.json"))
    assert home.building["version"] == PLAN_VERSION and home.problem is None
    assert home.building["floors"] == migrate_plan(_plan("v1-lights.json"))["floors"]
    # a copy of a plan this Home 3D cannot read is just as read-only
    newer = {**BUILDING, "version": PLAN_VERSION + 1}
    copied = await hass.data[DOMAIN].async_create_home("Newer", copy.deepcopy(newer))
    assert copied.read_only and copied.building == newer


def test_a_plan_from_before_existing_rate_sensors_needs_no_migration() -> None:
    """#323 adds optional energy fields only: a stored plan without them is passed on as it is (no new version) and
    loads with its rates set up here, as before; its stored energy keys keep their values."""
    stored = {
        **empty_building(),
        "energy": {"tariff": "sensor.sample_price", "cheap_from": "23:00", "cheap_to": "06:00", "gas": None},
    }
    kept = copy.deepcopy(stored)
    assert migrate_plan(stored) is stored
    loaded = BUILDING_SCHEMA(stored)
    assert stored == kept, "the stored plan is left as it was"
    assert loaded["version"] == PLAN_VERSION
    assert all(loaded["energy"][key] == value for key, value in kept["energy"].items())
    assert loaded["energy"]["rates_from"] == "here"
    # a version-1 plan gets the same on its way up
    assert BUILDING_SCHEMA(_plan("v1-lights.json"))["energy"]["rates_from"] == "here"


def test_a_plan_with_a_house_style_plan_is_version_four_and_an_older_home_3d_opens_it_read_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """#440: `style_switch` ("sun" or "time") is a new choice, so plan version 4. The 3 -> 4 step changes nothing, the
    keys are kept as they are, and a Home 3D that reads versions up to 3 shows such a plan read-only instead of
    repairing it (docs/plan-format.md)."""
    assert PLAN_VERSION >= 4
    style = {
        "style_day": "cozy",
        "style_evening": "evening",
        "style_night": "focus",
        "style_switch": "time",
        "style_morning_at": "07:30",
        "style_evening_at": "18:00",
        "style_night_at": "23:00",
        "style_entity": "input_select.sample_style",
    }
    older = {**copy.deepcopy(BUILDING), "version": 3}
    older["settings"] = {**older.get("settings", {}), **style}
    migrated = migrate_plan(older)
    assert migrated["version"] == PLAN_VERSION and migrated["settings"] == older["settings"]
    assert older["version"] == 3, "the stored plan is left as it was"
    assert BUILDING_SCHEMA(older)["settings"]["style_switch"] == "time"
    assert migrate_plan(migrated) is migrated, "idempotent"
    with pytest.raises(vol.Invalid):
        BUILDING_SCHEMA({**older, "settings": {**older["settings"], "style_switch": "moon"}})
    with pytest.raises(vol.Invalid):
        BUILDING_SCHEMA({**older, "settings": {**older["settings"], "style_night_at": "25:00"}})

    # the release before this one reads versions up to 3: a version-4 plan is refused, never repaired
    monkeypatch.setattr("custom_components.home_3d.migrations.PLAN_VERSION", 3)
    with pytest.raises(PlanTooNew, match=r"made by a newer Home 3D"):
        migrate_plan(migrated)


def _surroundings() -> dict[str, Any]:
    """A small neighbourhood as the frontend stores it (invented map metres around an invented point)."""
    return {
        "on": True,
        "lat": 45.5,
        "lon": 7.25,
        "at": 1763164800,
        "radius": 150,
        "x": 6.0,
        "z": 4.0,
        "own": 0,
        "hide": [2],
        "show": [],
        "flat": False,
        "buildings": [
            {"p": [[-6, -4], [6, -4], [6, 4], [-6, 4]], "h": 7.5},
            {"p": [[20, -5], [30, -5], [30, 5], [20, 5]], "h": 9.5},
            {"p": [[-25, 10], [-19, 10], [-19, 16]], "h": 3},
        ],
        "ways": [{"p": [[-172.5, -15], [172.5, -15]], "w": 6, "k": "road"}],
        "areas": [{"p": [[-60, 20], [-30, 20], [-30, 50], [-60, 50]], "k": "green"}],
        "trees": [[10, 10]],
    }


def test_a_plan_with_surroundings_is_version_five_and_an_older_home_3d_opens_it_read_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """#462: the neighbourhood from OpenStreetMap (`settings.surroundings`, its way and area kinds new choices) is plan
    version 5. The 4 -> 5 step changes nothing; a version-4 plan loads unchanged, keeps every key, and gets no map.
    A Home 3D that reads versions up to 4 (1.5.x) shows a plan with surroundings read-only instead of repairing it."""
    assert PLAN_VERSION >= 5
    older = {**copy.deepcopy(BUILDING), "version": 4}
    kept = copy.deepcopy(older)
    migrated = migrate_plan(older)
    assert older == kept, "the stored plan is left as it was"
    assert migrated == {**kept, "version": PLAN_VERSION}, "no key dropped, none added"
    assert migrate_plan(migrated) is migrated, "idempotent"
    assert "surroundings" not in BUILDING_SCHEMA(older)["settings"], "an older plan gets no map"

    with_map = {**copy.deepcopy(BUILDING), "version": 5}
    with_map["settings"] = {**with_map.get("settings", {}), "surroundings": _surroundings()}
    loaded = BUILDING_SCHEMA(with_map)["settings"]["surroundings"]
    assert loaded == _surroundings(), "every key kept as stored (numbers as floats)"
    # switched off, or removed (None): both are a plan of version 5 still
    assert BUILDING_SCHEMA({**with_map, "settings": {**with_map["settings"], "surroundings": None}})
    for broken in (
        {"ways": [{"p": [[0, 0], [1, 1]], "w": 6, "k": "motorway"}]},
        {"areas": [{"p": [[0, 0], [1, 1], [1, 0]], "k": "desert"}]},
        {"buildings": [{"p": [[0, 0], [1, 1], [1, 0]], "h": 500}]},
        {"buildings": [{"p": [[0, 0]] * 201, "h": 7}]},
        {"radius": 5000},
        {"lat": 91},
        {"extra": 1},
    ):
        with pytest.raises(vol.Invalid):
            surroundings = {**_surroundings(), **broken}
            BUILDING_SCHEMA({**with_map, "settings": {**with_map["settings"], "surroundings": surroundings}})

    # the release before this one (1.5.x) reads versions up to 4: a version-5 plan is refused, never repaired
    monkeypatch.setattr("custom_components.home_3d.migrations.PLAN_VERSION", 4)
    with pytest.raises(PlanTooNew, match=r"made by a newer Home 3D"):
        migrate_plan(with_map)


def test_the_sample_home_has_no_surroundings() -> None:
    """#462: the Sample Home ships without a map of any real place."""
    sample = json.loads(SAMPLE.read_text(encoding="utf-8"))
    plans = [sample, *(h.get("building", {}) for h in sample.get("homes", []) if isinstance(h, dict))]
    assert all(not (p.get("settings") or {}).get("surroundings") for p in plans if isinstance(p, dict))


def test_the_height_of_the_surroundings_is_an_optional_settings_key() -> None:
    """#482: `settings.surroundings_y` (the whole map up or down, m) is optional and sits beside the map. A plan saved
    without it loads unchanged (no key added), one with it keeps it, a value beyond 30 m either way is refused, and the
    map is the same with or without it. It came with plan version 6."""
    assert PLAN_VERSION >= 6
    plain = {**copy.deepcopy(BUILDING), "version": 5}
    plain["settings"] = {**plain.get("settings", {}), "surroundings": _surroundings()}
    loaded = BUILDING_SCHEMA(plain)["settings"]
    assert "surroundings_y" not in loaded, "an older plan gets no height added"
    assert loaded["surroundings"] == _surroundings()
    for good in (-30, -1.25, 0, 0.5, 30):
        raised = {**plain, "settings": {**plain["settings"], "surroundings_y": good}}
        kept = BUILDING_SCHEMA(raised)["settings"]
        assert kept["surroundings_y"] == good
        assert kept["surroundings"] == _surroundings(), "the map is as stored"
    for bad in (-31, 30.5, "high"):
        broken = {**plain, "settings": {**plain["settings"], "surroundings_y": bad}}
        with pytest.raises(vol.Invalid):
            BUILDING_SCHEMA(broken)
    # a plan with a height but no map (the map was removed by hand in the file) is still a plan
    assert BUILDING_SCHEMA({**plain, "settings": {**plain["settings"], "surroundings": None, "surroundings_y": 2}})


def test_the_gable_roof_choice_of_the_surroundings_is_an_optional_key() -> None:
    """#491: `settings.surroundings.roofs` (the neighbours' houses with a gable roof) is optional, sits beside `flat`,
    must be a boolean, and a plan without it loads unchanged (no key added). The key is why the plan version is 7."""
    plain = {**copy.deepcopy(BUILDING), "version": 7}
    plain["settings"] = {**plain.get("settings", {}), "surroundings": _surroundings()}
    assert "roofs" not in BUILDING_SCHEMA(plain)["settings"]["surroundings"]
    for good in (True, False):
        with_roofs = {**plain, "settings": {**plain["settings"], "surroundings": {**_surroundings(), "roofs": good}}}
        assert BUILDING_SCHEMA(with_roofs)["settings"]["surroundings"]["roofs"] is good
    broken = {**plain, "settings": {**plain["settings"], "surroundings": {**_surroundings(), "roofs": "yes"}}}
    with pytest.raises(vol.Invalid):
        BUILDING_SCHEMA(broken)


def test_a_version_six_plan_loads_unchanged_as_version_seven_and_1_7_x_opens_a_new_one_read_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Plan version 7 (Home 3D 1.8.0): the 6 -> 7 step changes nothing. A plan can then hold the gable roof choice of
    the neighbours (`settings.surroundings.roofs`, #491) and `card_templates` (#495). A Home 3D that reads versions
    up to 6 (1.7.x) refuses such a plan instead of repairing it."""
    assert PLAN_VERSION >= 7
    older = {**copy.deepcopy(BUILDING), "version": 6}
    kept = copy.deepcopy(older)
    migrated = migrate_plan(older)
    assert older == kept, "the stored plan is left as it was"
    assert migrated == {**kept, "version": PLAN_VERSION}, "no key dropped, none added"
    assert migrate_plan(migrated) is migrated, "idempotent"

    newer = {**copy.deepcopy(BUILDING), "version": 7}
    monkeypatch.setattr("custom_components.home_3d.migrations.PLAN_VERSION", 6)
    with pytest.raises(PlanTooNew, match=r"made by a newer Home 3D"):
        migrate_plan(newer)


def test_a_version_five_plan_loads_unchanged_as_version_six_and_1_6_x_opens_a_new_one_read_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Plan version 6 (Home 3D 1.7.0): the 5 -> 6 step changes nothing. A plan can then hold the front colour and
    material of an item (`front`, #478), the height of the surroundings and the upper pitch of a mansard roof. A
    Home 3D that reads versions up to 5 (1.6.x) refuses such a plan instead of repairing it."""
    assert PLAN_VERSION >= 6
    older = {**copy.deepcopy(BUILDING), "version": 5}
    kept = copy.deepcopy(older)
    migrated = migrate_plan(older)
    assert older == kept, "the stored plan is left as it was"
    assert migrated == {**kept, "version": PLAN_VERSION}, "no key dropped, none added"
    assert migrate_plan(migrated) is migrated, "idempotent"

    newer = {**copy.deepcopy(BUILDING), "version": 6}
    monkeypatch.setattr("custom_components.home_3d.migrations.PLAN_VERSION", 5)
    with pytest.raises(PlanTooNew, match=r"made by a newer Home 3D"):
        migrate_plan(newer)
