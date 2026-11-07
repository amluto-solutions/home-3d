"""Roaming pets (#337): where each pet is now, worked out here so every screen shows it in the same place.

A pet has a daily routine (`spots`: a place on a floor, a pose and a facing, with a time window and days) and any
number of triggers (an entity changing to a state, an event, or a time of day) that send it to a place of their own
for some minutes before it goes back to its routine. The latest trigger wins. With roaming off (the pets' `roam`, or a
static pet) a pet stays on its first spot. A pet with neither spots nor an active trigger has no place here: the 3D
view lets it wander as before.

The places go to the open views through `home_3d/pets/subscribe` (websocket.py); the views walk the pets there. A
trigger that is active is kept in memory only: after a restart the pets are back on their routine.
"""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta
import logging
from typing import Any

from homeassistant.core import CALLBACK_TYPE, Event, EventStateChangedData, HomeAssistant, State, callback
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.event import (
    async_track_point_in_utc_time,
    async_track_state_change_event,
    async_track_time_change,
)
from homeassistant.util import dt as dt_util

from .const import (
    PET_EVENT_REFUSED,
    SIGNAL_BUILDING_UPDATED,
    SIGNAL_HOMES_UPDATED,
    SIGNAL_PETS_UPDATED,
)

_LOGGER = logging.getLogger(__name__)

_PLACE = ("floor_id", "x", "z", "pose", "rotation")
_DAY = 24 * 60


def _minutes(text: Any) -> int | None:
    """Minutes after midnight of an "HH:MM" time (None: not set or not a time)."""
    if not isinstance(text, str) or len(text) != 5 or text[2] != ":":
        return None
    try:
        hours, minutes = int(text[:2]), int(text[3:])
    except ValueError:
        return None
    return hours * 60 + minutes if 0 <= hours < 24 and 0 <= minutes < 60 else None


def _placed(place: Any) -> bool:
    return isinstance(place, dict) and all(
        isinstance(place.get(k), (int, float)) and not isinstance(place.get(k), bool) for k in ("x", "z")
    )


def _on_day(spot: dict[str, Any], day: int) -> bool:
    days = spot.get("days")
    return not days or day in days


def in_window(spot: dict[str, Any], now: datetime) -> bool:
    """Whether a routine spot's time window is open now. No times: all day. A window past midnight (22:00 to 07:00)
    belongs to the day it starts on."""
    start, end = _minutes(spot.get("from")), _minutes(spot.get("to"))
    day, t = now.weekday(), now.hour * 60 + now.minute
    start = 0 if start is None else start
    end = _DAY if end is None else end
    if start == end or (start == 0 and end == _DAY):
        return _on_day(spot, day)
    if start < end:
        return _on_day(spot, day) and start <= t < end
    return (t >= start and _on_day(spot, day)) or (t < end and _on_day(spot, (day - 1) % 7))


def _next_start(spot: dict[str, Any], now: datetime) -> float:
    """Minutes until the spot's window opens next (within a week; infinity when it never does)."""
    start = _minutes(spot.get("from")) or 0
    t = now.hour * 60 + now.minute
    for ahead in range(8):
        wait = ahead * _DAY + start - t
        if wait > 0 and _on_day(spot, (now.weekday() + ahead) % 7):
            return wait
    return float("inf")


def routine_spot(spots: list[Any], now: datetime) -> dict[str, Any] | None:
    """The spot of the routine for now: the first whose window is open, else the one whose window opens next (the
    pet goes there and waits)."""
    placed = [s for s in spots if _placed(s)]
    for spot in placed:
        if in_window(spot, now):
            return spot
    return min(placed, key=lambda s: _next_start(s, now), default=None)


def _place(src: dict[str, Any], trigger: str | None = None, until: datetime | None = None) -> dict[str, Any]:
    return {
        **{k: src.get(k) for k in _PLACE},
        "spot": None if trigger else src.get("id"),
        "trigger": trigger,
        "until": until.isoformat() if until else None,
    }


def pet_target(
    pets: dict[str, Any], pet: dict[str, Any], active: tuple[str, datetime] | None, now: datetime
) -> dict[str, Any] | None:
    """Where a pet is now: its first spot with roaming off, else the place of its active trigger, else its routine's
    spot; None when it has none (the view lets it wander)."""
    spots = [s for s in pet.get("spots") or [] if _placed(s)]
    if pets.get("roam") is False or pet.get("static"):
        return _place(spots[0]) if spots else None
    if active is not None and active[1] > now:
        trigger = next((t for t in pet.get("triggers") or [] if t.get("id") == active[0]), None)
        if trigger is not None and _placed(trigger):
            return _place(trigger, active[0], active[1])
    spot = routine_spot(spots, now)
    return _place(spot) if spot else None


def state_matches(trigger: dict[str, Any], old: State | None, new: State | None) -> bool:
    """Whether a state change sets a state trigger off: its entity changed state (not just an attribute) to the
    trigger's state, or to any state when it names none."""
    if new is None or (old is not None and old.state == new.state):
        return False
    wanted = trigger.get("to")
    return not wanted or new.state == wanted


def _pets_of(building: Any) -> tuple[dict[str, Any], list[dict[str, Any]]]:
    settings = building.get("settings") if isinstance(building, dict) else None
    pets = settings.get("pets") if isinstance(settings, dict) else None
    if not isinstance(pets, dict) or pets.get("on") is False:
        return {}, []
    return pets, [p for p in pets.get("list") or [] if isinstance(p, dict) and isinstance(p.get("id"), str)]


Key = tuple[str, str]
Fired = tuple[str, str, dict[str, Any]]


class PetRoutines:
    """The pets' places of every home, kept up to date: each minute (the routines' windows), when a trigger goes off or
    runs out, and when a plan changes. A change is sent as SIGNAL_PETS_UPDATED (home id, places by pet id)."""

    def __init__(self, hass: HomeAssistant, buildings: Callable[[], dict[str, dict[str, Any]]]) -> None:
        """`buildings` gives the plan of each home by its id."""
        self.hass = hass
        self._buildings = buildings
        self._active: dict[Key, tuple[str, datetime]] = {}
        self._ends: dict[Key, CALLBACK_TYPE] = {}
        self._targets: dict[str, dict[str, dict[str, Any]]] = {}
        self._listeners: list[CALLBACK_TYPE] = []

    def targets(self, home_id: str) -> dict[str, dict[str, Any]]:
        """The places of a home's pets now (by pet id; a pet without one is left out)."""
        return self._targets.get(home_id, {})

    def active(self, home_id: str, pet_id: str) -> tuple[str, datetime] | None:
        return self._active.get((home_id, pet_id))

    @callback
    def start(self) -> CALLBACK_TYPE:
        """Follow the plans and the clock; returns the function that stops it all."""
        self.plans_changed()

        @callback
        def plan_saved(_home_id: str, _revision: int) -> None:
            self.plans_changed()

        unsubs = [
            async_track_time_change(self.hass, self._tick, second=0),
            async_dispatcher_connect(self.hass, SIGNAL_BUILDING_UPDATED, plan_saved),
            async_dispatcher_connect(self.hass, SIGNAL_HOMES_UPDATED, self.plans_changed),
        ]

        @callback
        def stop() -> None:
            for unsub in [*unsubs, *self._listeners, *self._ends.values()]:
                unsub()
            self._listeners, self._ends = [], {}

        return stop

    @callback
    def plans_changed(self) -> None:
        """A plan changed: listen for its triggers anew, forget triggers that are gone, place every pet again."""
        for unsub in self._listeners:
            unsub()
        self._listeners = []
        by_entity: dict[str, list[Fired]] = {}
        by_event: dict[str, list[Fired]] = {}
        by_time: dict[tuple[int, int], list[Fired]] = {}
        kept: set[Key] = set()
        buildings = self._buildings()
        for home_id, building in buildings.items():
            pets, pet_list = _pets_of(building)
            if pets.get("roam") is False:
                continue
            for pet in pet_list:
                for trigger in pet.get("triggers") or []:
                    if not isinstance(trigger, dict) or not isinstance(trigger.get("id"), str):
                        continue
                    fired: Fired = (home_id, pet["id"], trigger)
                    if self._active.get((home_id, pet["id"]), ("",))[0] == trigger["id"]:
                        kept.add((home_id, pet["id"]))
                    kind = trigger.get("kind") or "state"
                    if kind == "state" and isinstance(trigger.get("entity"), str) and trigger["entity"]:
                        by_entity.setdefault(trigger["entity"], []).append(fired)
                    elif kind == "event" and isinstance(trigger.get("event"), str) and trigger["event"]:
                        if trigger["event"].strip() in PET_EVENT_REFUSED:
                            continue  # never listen to `*` or a very frequent core event (#359)
                        by_event.setdefault(trigger["event"], []).append(fired)
                    elif kind == "time" and (at := _minutes(trigger.get("at"))) is not None:
                        by_time.setdefault(divmod(at, 60), []).append(fired)
        for key in [k for k in self._active if k not in kept]:
            self._active.pop(key)
            if (end := self._ends.pop(key, None)) is not None:
                end()
        if by_entity:
            self._listeners.append(
                async_track_state_change_event(self.hass, list(by_entity), self._state_listener(by_entity))
            )
        for event_type, fired_list in by_event.items():
            self._listeners.append(self.hass.bus.async_listen(event_type, self._event_listener(fired_list)))
        for (hour, minute), fired_list in by_time.items():
            self._listeners.append(
                async_track_time_change(self.hass, self._time_listener(fired_list), hour=hour, minute=minute, second=0)
            )
        for home_id in [h for h in self._targets if h not in buildings]:
            self._targets.pop(home_id)
        for home_id in buildings:
            self._update(home_id)

    def _state_listener(self, by_entity: dict[str, list[Fired]]) -> Callable[[Event[EventStateChangedData]], None]:
        @callback
        def changed(event: Event[EventStateChangedData]) -> None:
            for home_id, pet_id, trigger in by_entity.get(event.data["entity_id"], []):
                if state_matches(trigger, event.data["old_state"], event.data["new_state"]):
                    self.fire(home_id, pet_id, trigger)

        return changed

    def _event_listener(self, fired_list: list[Fired]) -> Callable[[Event], None]:
        @callback
        def happened(event: Event) -> None:
            for home_id, pet_id, trigger in fired_list:
                # a trigger that names an entity reacts to that entity's events only
                if not trigger.get("entity") or event.data.get("entity_id") == trigger["entity"]:
                    self.fire(home_id, pet_id, trigger)

        return happened

    def _time_listener(self, fired_list: list[Fired]) -> Callable[[datetime], None]:
        @callback
        def struck(_now: datetime) -> None:
            for home_id, pet_id, trigger in fired_list:
                self.fire(home_id, pet_id, trigger)

        return struck

    @callback
    def fire(self, home_id: str, pet_id: str, trigger: dict[str, Any]) -> None:
        """A trigger went off: the pet goes to its place for its minutes (a later trigger takes over from it)."""
        key = (home_id, pet_id)
        minutes = trigger.get("minutes")
        until = dt_util.utcnow() + timedelta(minutes=minutes if isinstance(minutes, (int, float)) else 10)
        self._active[key] = (trigger["id"], until)
        if (end := self._ends.pop(key, None)) is not None:
            end()

        @callback
        def ended(_now: datetime) -> None:
            self._ends.pop(key, None)
            if self._active.get(key, ("",))[0] == trigger["id"]:
                self._active.pop(key, None)
            self._update(home_id)

        self._ends[key] = async_track_point_in_utc_time(self.hass, ended, until)
        _LOGGER.debug("pet %s of home %s: trigger %s until %s", pet_id, home_id, trigger["id"], until)
        self._update(home_id)

    @callback
    def _tick(self, _now: datetime) -> None:
        for home_id in self._buildings():
            self._update(home_id)

    @callback
    def _update(self, home_id: str) -> None:
        """Place a home's pets for now; tell the views when a place changed."""
        pets, pet_list = _pets_of(self._buildings().get(home_id))
        now = dt_util.now()
        targets: dict[str, dict[str, Any]] = {}
        for pet in pet_list:
            target = pet_target(pets, pet, self._active.get((home_id, pet["id"])), now)
            if target is not None:
                targets[pet["id"]] = target
        if targets != self._targets.get(home_id, {}):
            self._targets[home_id] = targets
            async_dispatcher_send(self.hass, SIGNAL_PETS_UPDATED, home_id, targets)
