"""Roaming pets (#337): the daily routine, the triggers, the plan migration of old static pets and the places sent to
the views, worked out on the server so every screen shows a pet in the same place."""

from __future__ import annotations

import asyncio
import copy
from datetime import datetime, timedelta
from typing import Any
from unittest.mock import patch

from freezegun.api import FrozenDateTimeFactory
from homeassistant.core import HomeAssistant, State
from homeassistant.util import dt as dt_util
import pytest
from pytest_homeassistant_custom_component.common import async_fire_time_changed
import voluptuous as vol

from custom_components.home_3d.const import DATA_PETS, PLAN_VERSION
from custom_components.home_3d.migrations import migrate_plan, pet_spots
from custom_components.home_3d.pets import in_window, pet_target, routine_spot, state_matches
from custom_components.home_3d.schema import BUILDING_SCHEMA, SETTINGS_SCHEMA
from tests.test_init import BUILDING, _setup

# Monday 3 Nov 2025 (weekday 0)
MONDAY = datetime(2025, 11, 3, 0, 0)


def at(hhmm: str, day: int = 0) -> datetime:
    h, m = map(int, hhmm.split(":"))
    return MONDAY + timedelta(days=day, hours=h, minutes=m)


def spot(sid: str, **extra: Any) -> dict[str, Any]:
    return {"id": sid, "floor_id": "f1", "x": 1.0, "z": 2.0, "pose": "sit", "rotation": None, **extra}


# ---------------------------------------------------------------------------- the routine


def test_a_window_is_open_between_its_times_on_its_days() -> None:
    day = spot("s", **{"from": "08:00", "to": "12:00", "days": [0, 1]})
    assert in_window(day, at("08:00"))
    assert in_window(day, at("11:59"))
    assert not in_window(day, at("12:00"))
    assert not in_window(day, at("07:59"))
    assert in_window(day, at("09:00", 1))
    assert not in_window(day, at("09:00", 2))
    # no times: all day; no days: every day
    assert in_window(spot("s"), at("03:00", 5))


def test_a_window_past_midnight_belongs_to_the_day_it_starts() -> None:
    night = spot("s", **{"from": "22:00", "to": "07:00", "days": [4]})  # Friday night
    assert in_window(night, at("23:00", 4))
    assert in_window(night, at("06:30", 5))  # Saturday morning, still Friday's night
    assert not in_window(night, at("06:30", 4))  # Friday morning belongs to Thursday
    assert not in_window(night, at("07:00", 5))


def test_the_routine_takes_the_open_spot_else_the_next_one() -> None:
    bed = spot("bed", **{"from": "21:00", "to": "07:00"})
    sofa = spot("sofa", **{"from": "09:00", "to": "17:00"})
    window = spot("window", **{"from": "17:00", "to": "19:00"})
    spots = [bed, sofa, window]
    assert routine_spot(spots, at("23:00"))["id"] == "bed"
    assert routine_spot(spots, at("10:00"))["id"] == "sofa"
    assert routine_spot(spots, at("18:00"))["id"] == "window"
    # between windows: on the way to (and waiting at) the next one
    assert routine_spot(spots, at("08:00"))["id"] == "sofa"
    assert routine_spot(spots, at("20:00"))["id"] == "bed"
    # a spot not yet placed in the plan is never a place
    assert routine_spot([{"id": "x", "x": None, "z": None}], at("10:00")) is None
    assert routine_spot([], at("10:00")) is None


def test_a_trigger_wins_over_the_routine_until_it_runs_out() -> None:
    pets = {"on": True, "roam": True}
    feeder = {"id": "t1", "kind": "state", "entity": "binary_sensor.sample_feeder", "to": "on", "floor_id": "f1"}
    feeder |= {"x": 3.0, "z": 0.5, "pose": "stand", "rotation": 90, "minutes": 5}
    pet = {"id": "p1", "spots": [spot("sofa")], "triggers": [feeder]}
    now = dt_util.as_utc(at("10:00").replace(tzinfo=dt_util.UTC))
    placed = pet_target(pets, pet, ("t1", now + timedelta(minutes=5)), now)
    assert placed is not None
    assert (placed["x"], placed["z"], placed["pose"], placed["trigger"], placed["spot"]) == (
        3.0,
        0.5,
        "stand",
        "t1",
        None,
    )
    assert placed["until"] == (now + timedelta(minutes=5)).isoformat()
    # run out: back to the routine
    back = pet_target(pets, pet, ("t1", now - timedelta(seconds=1)), now)
    assert back is not None and back["spot"] == "sofa" and back["trigger"] is None
    # roaming off (all pets, or a static one): the first spot, triggers or not
    for off_pets, off_pet in (({**pets, "roam": False}, pet), (pets, {**pet, "static": True})):
        still = pet_target(off_pets, off_pet, ("t1", now + timedelta(minutes=5)), now)
        assert still is not None and still["spot"] == "sofa"
    # nothing to go by: no place (the view lets it wander)
    assert pet_target(pets, {"id": "p2"}, None, now) is None


def test_a_state_trigger_needs_a_real_change_to_its_state() -> None:
    trigger = {"to": "open"}
    assert state_matches(trigger, State("cover.sample_bowl", "closed"), State("cover.sample_bowl", "open"))
    assert not state_matches(trigger, State("cover.sample_bowl", "open"), State("cover.sample_bowl", "open"))
    assert not state_matches(trigger, State("cover.sample_bowl", "open"), State("cover.sample_bowl", "closed"))
    assert state_matches({}, State("sensor.sample", "1"), State("sensor.sample", "2"))
    assert not state_matches({}, State("sensor.sample", "1"), None)


# ---------------------------------------------------------------------------- the plan format


def test_old_static_pets_get_their_spot_as_the_routines_first() -> None:
    plan = {
        "version": 2,
        "floors": [],
        "settings": {
            "wall_exterior": 0.24,
            "wall_interior": 0.12,
            "grid": 0.05,
            "pets": {
                "on": True,
                "list": [
                    {"id": "p1", "kind": "cat", "static": True, "pose": "curl", "x": 2.5, "z": -1, "rotation": 90},
                    {"id": "p2", "kind": "dog", "floor_id": "f2", "x": 1, "z": 1},
                    {"id": "p4", "kind": "cat", "static": True, "floor_id": "f2", "x": 3, "z": 4},
                    {"id": "p3", "kind": "rabbit"},
                ],
            },
        },
    }
    before = copy.deepcopy(plan)
    out = migrate_plan(plan)
    assert plan == before, "the input stays as it was"
    assert out["version"] == PLAN_VERSION
    p1, p2, p4, p3 = out["settings"]["pets"]["list"]
    assert p4["spots"][0]["floor_id"] == "f2"
    assert p1["spots"] == [{"id": "spot_1", "floor_id": None, "x": 2.5, "z": -1, "pose": "curl", "rotation": 90}]
    # the old fields stay (a Home 3D from before still reads them)
    assert (p1["static"], p1["x"], p1["z"], p1["pose"], p1["rotation"]) == (True, 2.5, -1, "curl", 90)
    # a roaming pet that kept a spot from before keeps roaming freely
    assert "spots" not in p2 and (p2["x"], p2["z"]) == (1, 1)
    assert "spots" not in p3
    # idempotent, and the result passes the schema
    assert pet_spots(out) == out
    checked = BUILDING_SCHEMA(out)
    assert checked["settings"]["pets"]["list"][0]["spots"][0]["pose"] == "curl"
    assert checked["settings"]["pets"]["roam"] is True


def test_the_schema_keeps_spots_and_any_number_of_triggers() -> None:
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}
    triggers = [{"id": f"t{i}", "kind": "time", "at": "07:30", "x": 1, "z": 1, "minutes": 2} for i in range(60)]
    pet = {"id": "p1", "kind": "cat", "spots": [spot("s", **{"from": "22:00", "to": "07:00", "days": [5, 6]})]}
    got = SETTINGS_SCHEMA({**base, "pets": {"roam": False, "list": [{**pet, "triggers": triggers}]}})["pets"]
    assert got["roam"] is False
    assert len(got["list"][0]["triggers"]) == 60
    assert got["list"][0]["triggers"][0]["entity"] is None
    assert got["list"][0]["spots"][0]["days"] == [5, 6]
    for pose in ("stand", "groom"):
        SETTINGS_SCHEMA({**base, "pets": {"list": [{**pet, "pose": pose}]}})
    for bad in ({"from": "25:00"}, {"days": [7]}, {"pose": "fly"}):
        with pytest.raises(vol.Invalid):
            SETTINGS_SCHEMA({**base, "pets": {"list": [{**pet, "spots": [spot("s", **bad)]}]}})
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "pets": {"list": [{**pet, "triggers": [{"id": "t", "kind": "sometimes"}]}]}})


# ---------------------------------------------------------------------------- live, through Home Assistant


def _plan_with_pet(**pet: Any) -> dict[str, Any]:
    plan = copy.deepcopy(BUILDING)
    plan["settings"]["pets"] = {"on": True, "list": [{"id": "p1", "kind": "cat", **pet}]}
    return plan


_SEEN: dict[int, list[dict[str, Any]]] = {}


async def _save(client, plan: dict[str, Any]) -> None:
    """Save the plan; the pets' places sent meanwhile are kept for _next_pets."""
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": plan})
    while True:
        msg = await client.receive_json()
        if msg.get("type") == "result":
            assert msg["success"], msg
            return
        if msg.get("type") == "event" and "pets" in msg["event"]:
            _SEEN.setdefault(id(client), []).append(msg["event"])


async def _next_pets(client) -> dict[str, Any]:
    if _SEEN.get(id(client)):
        return _SEEN[id(client)].pop(0)
    while True:
        msg = await asyncio.wait_for(client.receive_json(), 10)
        if msg.get("type") == "event" and "pets" in msg["event"]:
            return msg["event"]


async def test_a_state_trigger_sends_the_pet_and_it_comes_back(
    hass: HomeAssistant, hass_ws_client, freezer: FrozenDateTimeFactory
) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/pets/subscribe"})
    assert (await client.receive_json())["success"]
    assert await _next_pets(client) == {"home_id": "home", "pets": {}}

    bowl = {"id": "t1", "kind": "state", "entity": "cover.sample_bowl", "to": "open", "minutes": 3}
    bowl |= {"floor_id": "f1", "x": 3.5, "z": 0.5, "pose": "stand", "rotation": 180}
    await _save(client, _plan_with_pet(spots=[spot("sofa", pose="curl")], triggers=[bowl]))
    first = await _next_pets(client)
    assert first["pets"]["p1"]["spot"] == "sofa" and first["pets"]["p1"]["pose"] == "curl"

    hass.states.async_set("cover.sample_bowl", "closed")
    await hass.async_block_till_done()
    hass.states.async_set("cover.sample_bowl", "open")
    await hass.async_block_till_done()
    fed = await _next_pets(client)
    assert fed["pets"]["p1"]["trigger"] == "t1"
    assert (fed["pets"]["p1"]["x"], fed["pets"]["p1"]["pose"]) == (3.5, "stand")
    assert hass.data[DATA_PETS].active("home", "p1")[0] == "t1"

    freezer.tick(timedelta(minutes=3, seconds=1))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    back = await _next_pets(client)
    assert back["pets"]["p1"]["spot"] == "sofa" and back["pets"]["p1"]["trigger"] is None


async def test_event_and_time_triggers_and_the_roaming_switch(
    hass: HomeAssistant, hass_ws_client, freezer: FrozenDateTimeFactory
) -> None:
    await _setup(hass)
    # signed in first: time only moves on once the connection is open; then tomorrow 09:00:30
    client = await hass_ws_client(hass)
    nine = dt_util.now().replace(hour=9, minute=0, second=30, microsecond=0) + timedelta(days=1)
    freezer.move_to(nine)
    await client.send_json_auto_id({"type": "home_3d/pets/subscribe", "home_id": "home"})
    assert (await client.receive_json())["success"]
    await _next_pets(client)

    place = {"floor_id": "f1", "z": 1.0, "pose": "groom", "rotation": None, "minutes": 10}
    triggers = [
        {"id": "e1", "kind": "event", "event": "sample_feed", "x": 1.0, **place},
        {"id": "m1", "kind": "time", "at": "09:01", "x": 2.0, **place},
    ]
    plan = _plan_with_pet(spots=[spot("sofa")], triggers=triggers)
    await _save(client, plan)
    assert (await _next_pets(client))["pets"]["p1"]["spot"] == "sofa"

    hass.bus.async_fire("sample_feed", {})
    await hass.async_block_till_done()
    assert (await _next_pets(client))["pets"]["p1"]["trigger"] == "e1"

    # a later trigger takes over from the earlier one
    freezer.move_to(nine.replace(minute=1, second=0))
    async_fire_time_changed(hass)
    await hass.async_block_till_done()
    assert (await _next_pets(client))["pets"]["p1"]["trigger"] == "m1"

    # roaming off: the first spot, and the trigger is dropped
    plan["settings"]["pets"]["roam"] = False
    await _save(client, plan)
    off = await _next_pets(client)
    assert off["pets"]["p1"]["spot"] == "sofa" and off["pets"]["p1"]["trigger"] is None
    assert hass.data[DATA_PETS].active("home", "p1") is None


async def test_the_subscription_refuses_an_unknown_home(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/pets/subscribe", "home_id": "nowhere"})
    result = await client.receive_json()
    assert not result["success"] and result["error"]["code"] == "home_not_found"


# ---------------------------------------------------------------------------- refused event triggers (#359)


def _event_trigger(tid: str, event: str) -> dict[str, Any]:
    return {"id": tid, "kind": "event", "event": event, "floor_id": "f1", "x": 1.0, "z": 1.0, "pose": "sit"}


@pytest.mark.parametrize("event", ["*", "state_changed", "call_service", "component_loaded", " state_changed "])
def test_the_schema_refuses_match_all_and_frequent_core_events(event: str) -> None:
    plan = _plan_with_pet(triggers=[_event_trigger("e1", event)])
    with pytest.raises(vol.Invalid):
        BUILDING_SCHEMA(plan)
    # a state or time trigger never has the event type checked, and a quiet event is fine
    ok = _plan_with_pet(triggers=[_event_trigger("e1", "sample_feed"), {**_event_trigger("t1", event), "kind": "time"}])
    assert len(BUILDING_SCHEMA(ok)["settings"]["pets"]["list"][0]["triggers"]) == 2


def test_a_stored_plan_with_a_refused_trigger_loads_without_that_trigger() -> None:
    from custom_components.home_3d.storage import check_plan

    plan = _plan_with_pet(
        triggers=[_event_trigger("e1", "sample_feed"), _event_trigger("bad", "*"), _event_trigger("e2", "sample_ring")]
    )
    checked, problem = check_plan(plan)
    assert problem is not None and problem["code"] == "plan_repaired"
    assert problem["dropped"] == ["settings.pets.list.0.triggers.1"]
    assert [t["id"] for t in checked["settings"]["pets"]["list"][0]["triggers"]] == ["e1", "e2"]


async def test_pets_ignores_a_refused_event_type_even_when_it_is_stored(hass: HomeAssistant) -> None:
    await _setup(hass)
    manager = hass.data[DATA_PETS]
    bad = _plan_with_pet(
        spots=[spot("sofa")],
        triggers=[
            _event_trigger("e1", "*"),
            _event_trigger("e2", "state_changed"),
            _event_trigger("e3", "sample_feed"),
        ],
    )
    heard: list[str] = []
    real = type(hass.bus).async_listen

    def spy(self, event_type, *args, **kwargs):
        heard.append(event_type)
        return real(self, event_type, *args, **kwargs)

    manager._buildings = lambda: {"home": bad}
    with patch.object(type(hass.bus), "async_listen", spy):
        manager.plans_changed()
    assert heard == ["sample_feed"]
