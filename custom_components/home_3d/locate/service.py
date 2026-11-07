"""The locating service: reads the scanners every second, keeps a room tracker per device, learns fingerprints on
the calibration walk and tells the views and the sensors where everyone is. Runs only when switched on."""

from __future__ import annotations

from collections.abc import Callable
from datetime import timedelta
import logging
import re
import time
from typing import Any

from homeassistant.const import EVENT_COMPONENT_LOADED, EVENT_STATE_CHANGED
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.helpers import device_registry as dr
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_connect, async_dispatcher_send
from homeassistant.helpers.event import async_track_time_interval
from homeassistant.helpers.storage import Store
from homeassistant.setup import EventComponentLoaded

from ..const import SIGNAL_BUILDING_UPDATED, SIGNAL_HOMES_UPDATED
from .engine import AWAY_AFTER, OWN_SHARE, STEP, THING_AWAY_AFTER, Fingerprints, RoomTracker, evidence
from .identity import Identity, ibeacon_key
from .plan import plan_doors, plan_rooms
from .scanners import ScanReader, scanner_list

_LOGGER = logging.getLogger(__name__)

DOMAIN = "home_3d"
DATA_LOCATE = f"{DOMAIN}_locate"
SIGNAL_LOCATE = f"{DOMAIN}_locate_state"
SIGNAL_LOCATE_DEVICES = f"{DOMAIN}_locate_devices"
STORAGE_KEY_LOCATE = f"{DOMAIN}.locate"
POLL = timedelta(seconds=1)
CALIBRATE_SECONDS = 90
SAMPLE_EVERY = 2.0
NEARBY_KEEP = 30.0
MAX_SAMPLES_PER_ROOM = 120
# seconds: a device that is heard has its last_seen sent on at least this often, though its room stays (#365)
LAST_SEEN_REFRESH = 60.0
PRESENCE_CLASSES = {"motion", "occupancy", "presence"}
# worn on the body: it tells where its person is (a phone may lie somewhere)
WORN = re.compile(r"watch|uhr|band|ring|fit|garmin|wear", re.IGNORECASE)


@callback
def _is_bluetooth(data: EventComponentLoaded) -> bool:
    return data["component"] == "bluetooth"


def worn_by_name(device: dict[str, Any]) -> bool:
    return bool(WORN.search(str(device.get("name") or "")))


def _clean_devices(devices: list[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for d in devices:
        if not isinstance(d, dict) or not d.get("id") or d.get("kind") not in ("irk", "ibeacon", "mac"):
            continue
        out.append(
            {
                "id": str(d["id"])[:40],
                "name": str(d.get("name") or d["id"])[:60],
                "kind": d["kind"],
                "key": str(d.get("key", ""))[:64],
                "person": d.get("person") if isinstance(d.get("person"), str) else None,
                "wearable": d["wearable"] if isinstance(d.get("wearable"), bool) else worn_by_name(d),
                "icon": str(d.get("icon") or "")[:40] or None,
                "notify": d.get("notify") if isinstance(d.get("notify"), str) else None,
            }
        )
    return out


class LocateService:
    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._store: Store[dict[str, Any]] = Store(hass, 1, STORAGE_KEY_LOCATE)
        self.enabled = False
        self.admins_only = False
        self.person_sensors = True  # False: no room sensor for a device that belongs to a person (#183)
        self.fly = True  # spoken questions fly the open views into the room
        self.devices: list[dict[str, Any]] = []
        self.scanner_rooms: dict[str, str] = {}
        self.scanner_names: dict[str, str] = {}  # last known names (a scanner that is offline keeps its row)
        self._pooled: tuple[tuple[Any, ...], Fingerprints] | None = None
        # the last evidence per device: while its window and the learning are unchanged it is reused, not measured
        # again against every sample (a quiet device repeats its window second after second)
        self._pool_serial = 0
        self._evidence: dict[str, tuple[tuple[Any, ...], dict[str, float]]] = {}
        self._announced_seen: dict[str, float] = {}  # last_seen per device when SIGNAL_LOCATE was last sent
        self.rooms: list[dict[str, Any]] = []  # {id, name, floor, area_id}
        self.doors: list[tuple[str, str]] = []
        self.fingerprints: dict[str, Fingerprints] = {}
        self.state: dict[str, dict[str, Any]] = {}
        self.calibration: dict[str, Any] | None = None
        self.nearby: dict[str, dict[str, Any]] = {}
        self._reader = ScanReader()
        self._identity = Identity([])
        self._trackers: dict[str, RoomTracker] = {}
        # the rooms and doors the trackers were made for: they are kept while these stay (#169)
        self._tracker_plan: tuple[tuple[str, ...], tuple[tuple[str, str], ...]] | None = None
        self._unsub: Callable[[], None] | None = None
        self._listeners: list[Callable[[], None]] = []  # presence sensors and registry changes, while running
        self._unsub_wait: Callable[[], None] | None = None  # waiting for Bluetooth to load (#368)
        self._save_pending = False
        self._sensor_rooms: dict[str, str | None] = {}
        self._last_step = 0.0
        self._last_sample = 0.0
        self._nearby_until = 0.0

    # ------------------------------------------------------------------ storage

    async def async_load(self) -> None:
        data = await self._store.async_load() or {}
        self.enabled = bool(data.get("enabled"))
        self.admins_only = bool(data.get("admins_only"))
        self.person_sensors = data.get("person_sensors", True) is not False
        self.fly = data.get("fly", True) is not False
        self.devices = _clean_devices(data.get("devices") or [])
        self.scanner_rooms = {str(k): str(v) for k, v in (data.get("scanner_rooms") or {}).items()}
        self.scanner_names = {str(k): str(v) for k, v in (data.get("scanner_names") or {}).items()}
        self.rooms = [r for r in data.get("rooms") or [] if isinstance(r, dict) and r.get("id")]
        self.doors = [(str(a), str(b)) for a, b in data.get("doors") or []]
        self.fingerprints = {
            dev: Fingerprints({room: [dict(v) for v in vs] for room, vs in rooms.items()})
            for dev, rooms in (data.get("fingerprints") or {}).items()
        }
        self._rebuild()
        if self.enabled:
            self.start()

    def _data(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "admins_only": self.admins_only,
            "person_sensors": self.person_sensors,
            "fly": self.fly,
            "devices": self.devices,
            "scanner_rooms": self.scanner_rooms,
            "scanner_names": self.scanner_names,
            "rooms": self.rooms,
            "doors": [list(d) for d in self.doors],
            "fingerprints": {
                dev: {
                    room: [{s: round(v, 1) for s, v in vec.items()} for vec in vecs]
                    for room, vecs in fp.samples.items()
                }
                for dev, fp in self.fingerprints.items()
            },
        }

    @callback
    def _save(self) -> None:
        self._save_pending = True
        self._store.async_delay_save(self._written, 5)

    def _written(self) -> dict[str, Any]:
        """The data the delayed save writes now (it is no longer pending)."""
        self._save_pending = False
        return self._data()

    async def async_unload(self) -> None:
        """Stop, and write a save still waiting for its delay (#368): the entry loaded again right after a change
        reads it, and the old delayed save cannot land on top of the new service's."""
        self.stop()
        if self._save_pending:
            await self._store.async_save(self._written())

    def _rebuild(self) -> None:
        """Trackers for the devices, rooms and doors. A device keeps its tracker (and so its current room) while the
        rooms and doors stay the same (#169): another setting, a renamed room or a new device does not clear it."""
        self._identity = Identity(self.devices)
        self._sensor_rooms = {}
        room_ids = [r["id"] for r in self.rooms]
        shape = (tuple(room_ids), tuple(self.doors))
        kept = self._trackers if shape == self._tracker_plan else {}
        self._tracker_plan = shape
        trackers: dict[str, RoomTracker] = {}
        for d in self.devices:
            away = AWAY_AFTER if d.get("person") else THING_AWAY_AFTER
            old = kept.get(d["id"])
            trackers[d["id"]] = (
                old if old is not None and old.away_after == away else RoomTracker(room_ids, self.doors, away)
            )
        self._trackers = trackers
        self._evidence = {d: m for d, m in self._evidence.items() if d in trackers}
        self.state = {k: v for k, v in self.state.items() if k in self._trackers}

    # ------------------------------------------------------------------ the plan (#169)

    @callback
    def follow_plan(self, building: Callable[[], dict[str, Any]], active_id: Callable[[], str]) -> Callable[[], None]:
        """Keep the rooms and doors in step with the active home's plan: now, whenever that plan changes and when
        another home becomes active. Returns the function that stops it."""

        @callback
        def plan_changed(home_id: str, _revision: int) -> None:
            if home_id == active_id():
                self.set_plan(building())

        @callback
        def homes_changed() -> None:
            self.set_plan(building())

        self.set_plan(building())
        unsubs = [
            async_dispatcher_connect(self.hass, SIGNAL_BUILDING_UPDATED, plan_changed),
            async_dispatcher_connect(self.hass, SIGNAL_HOMES_UPDATED, homes_changed),
        ]

        @callback
        def stop() -> None:
            for unsub in unsubs:
                unsub()

        return stop

    @callback
    def set_plan(self, building: dict[str, Any]) -> None:
        """Take the rooms and doors of a plan (nothing happens when they are the ones known). Where a device is shown
        follows at once: a removed room is no longer shown, a renamed one under its new name."""
        rooms, doors = plan_rooms(building), plan_doors(building)
        if rooms == self.rooms and doors == self.doors:
            return
        self.rooms, self.doors = rooms, doors
        self._rebuild()
        names = {r["id"]: r for r in self.rooms}
        for dev, shown in list(self.state.items()):
            if shown.get("room") is None:
                continue
            if (room := names.get(shown["room"])) is None:
                self.state.pop(dev)
            else:
                shown.update(room_name=room["name"], floor=room.get("floor"), area_id=room.get("area_id"))
        self._save()
        async_dispatcher_send(self.hass, SIGNAL_LOCATE)

    # ------------------------------------------------------------------ config

    async def async_configure(self, changes: dict[str, Any]) -> None:
        if "devices" in changes:
            old = {d["id"] for d in self.devices}
            self.devices = _clean_devices(changes["devices"])
            new = {d["id"] for d in self.devices}
            for gone in old - new:
                self.fingerprints.pop(gone, None)
        if "scanner_rooms" in changes:
            self.scanner_rooms = {str(k): str(v) for k, v in changes["scanner_rooms"].items() if v}
        # the rooms and doors come from the active home's plan (follow_plan, #169); one sent here (by a client from
        # before) holds until the plan changes
        if "rooms" in changes:
            self.rooms = [
                {
                    "id": str(r["id"]),
                    "name": str(r.get("name") or ""),
                    "floor": r.get("floor"),
                    "area_id": r.get("area_id"),
                }
                for r in changes["rooms"]
                if isinstance(r, dict) and r.get("id")
            ]
        if "doors" in changes:
            self.doors = [(str(a), str(b)) for a, b in changes["doors"]]
        if "admins_only" in changes:
            self.admins_only = bool(changes["admins_only"])
        if "person_sensors" in changes:
            self.person_sensors = bool(changes["person_sensors"])
        if "fly" in changes:
            self.fly = bool(changes["fly"])
        self._rebuild()
        if "enabled" in changes:
            self.enabled = bool(changes["enabled"])
            if self.enabled:
                self.start()
            else:
                self.stop()
        self._save()
        async_dispatcher_send(self.hass, SIGNAL_LOCATE_DEVICES)

    def config(self) -> dict[str, Any]:
        """Settings plus what the editor shows: scanners, known IRK devices, samples per device and room."""
        private = []
        devices = dr.async_get(self.hass)
        for entry in self.hass.config_entries.async_entries("private_ble_device"):
            irk = entry.data.get("irk")
            if not isinstance(irk, str):
                continue
            # Home Assistant names these entries after the first address it saw: a name given to the device wins
            own = dr.async_entries_for_config_entry(devices, entry.entry_id)
            named = next((d.name_by_user for d in own if d.name_by_user), None)
            private.append({"title": named or entry.title, "key": irk, "named": bool(named)})
        return {
            "enabled": self.enabled,
            "admins_only": self.admins_only,
            "person_sensors": self.person_sensors,
            "fly": self.fly,
            "devices": self.devices,
            "scanner_rooms": self.scanner_rooms,
            "scanners": self._scanners(),
            "bluetooth": self._bluetooth(),
            "private_ble": private,
            "samples": {dev: {room: len(v) for room, v in fp.samples.items()} for dev, fp in self.fingerprints.items()},
            "scanner_hints": self.scanner_hints(),
        }

    def scanner_hints(self) -> dict[str, str]:
        """Where each scanner probably stands, from the calibration walk: the room in which it heard the devices
        loudest (it must have heard them in at least half of that room's samples)."""
        per: dict[str, dict[str, list[float]]] = {}
        counts: dict[str, int] = {}
        for fp in self.fingerprints.values():
            for room, vectors in fp.samples.items():
                counts[room] = counts.get(room, 0) + len(vectors)
                for vec in vectors:
                    for scanner, rssi in vec.items():
                        per.setdefault(scanner, {}).setdefault(room, []).append(rssi)
        hints: dict[str, str] = {}
        for scanner, rooms in per.items():
            heard = {r: v for r, v in rooms.items() if len(v) >= counts.get(r, 0) / 2}
            if heard:
                hints[scanner] = max(heard, key=lambda r: sum(heard[r]) / len(heard[r]))
        return hints

    def _scanners(self) -> list[dict[str, Any]]:
        """The scanners Home Assistant has now, plus placed ones that are offline (they keep their room)."""
        live = scanner_list(self.hass) if self._bluetooth() else []
        changed = False
        for s in live:
            if self.scanner_names.get(s["source"]) != s["name"]:
                self.scanner_names[s["source"]] = s["name"]
                changed = True
        if changed:
            self._save()
        seen = {s["source"] for s in live}
        offline = [
            {
                "source": src,
                "name": self.scanner_names.get(src, src),
                "kind": "other",
                "device_id": None,
                "area_id": None,
                "scanning": False,
                "offline": True,
            }
            for src in self.scanner_rooms
            if src not in seen
        ]
        return live + offline

    def pooled(self) -> Fingerprints:
        """Every device's samples together: a device that was never walked with uses what the others learned
        (two watches see the rooms alike). At most MAX_SAMPLES_PER_ROOM a room, as many as one device learns: the
        newest of each device in turn (#370; devices x 120 a room made every estimate of such a device that many
        times dearer). Cached until a sample changes."""
        key = tuple((dev, id(fp), fp.stamp()) for dev, fp in self.fingerprints.items())
        if self._pooled is None or self._pooled[0] != key:
            merged = Fingerprints()
            per_room: dict[str, list[list[dict[str, float]]]] = {}
            for fp in self.fingerprints.values():
                for room, vectors in fp.samples.items():
                    per_room.setdefault(room, []).append(vectors)
            for room, lists in per_room.items():
                merged.samples[room] = _even_share(lists, MAX_SAMPLES_PER_ROOM)
            self._pool_serial += 1
            merged.version = self._pool_serial  # a new set is never mistaken for the one it replaced
            self._pooled = (key, merged)
        return self._pooled[1]

    def _bluetooth(self) -> bool:
        return "bluetooth" in self.hass.config.components

    # ------------------------------------------------------------------ running

    @callback
    def start(self) -> None:
        if self._unsub is not None:
            return
        if not self._bluetooth():
            # Bluetooth may set up after Home 3D (at a start, or added later): start once it has loaded (#368)
            if self._unsub_wait is None:
                self._unsub_wait = self.hass.bus.async_listen(
                    EVENT_COMPONENT_LOADED, self._bluetooth_loaded, event_filter=_is_bluetooth
                )
            return
        self._unsub = async_track_time_interval(self.hass, self._tick, POLL)
        self._sensor_rooms = {}  # the areas may have changed while it was off
        self._listeners = [
            self.hass.bus.async_listen(EVENT_STATE_CHANGED, self._presence_changed),
            # a presence sensor (or its device) moved to another area confirms that area's room from now on (#368)
            self.hass.bus.async_listen(er.EVENT_ENTITY_REGISTRY_UPDATED, self._registry_changed),
            self.hass.bus.async_listen(dr.EVENT_DEVICE_REGISTRY_UPDATED, self._registry_changed),
        ]

    @callback
    def _bluetooth_loaded(self, _event: Event[EventComponentLoaded]) -> None:
        self._stop_waiting()
        # the next tick stops it again when nothing asks for it any more
        self.start()

    @callback
    def _stop_waiting(self) -> None:
        if self._unsub_wait is not None:
            self._unsub_wait()
            self._unsub_wait = None

    @callback
    def _registry_changed(self, _event: Event[Any]) -> None:
        self._sensor_rooms = {}  # looked up again on the next presence change (cheap, one registry read each)

    def _sensor_room(self, entity_id: str) -> str | None:
        """The plan room of a presence sensor: its area (or its device's) linked to a room of the plan."""
        if entity_id in self._sensor_rooms:
            return self._sensor_rooms[entity_id]
        room = None
        entry = er.async_get(self.hass).async_get(entity_id)
        area = entry.area_id if entry else None
        if entry and not area and entry.device_id:
            device = dr.async_get(self.hass).async_get(entry.device_id)
            area = device.area_id if device else None
        if area:
            room = next((r["id"] for r in self.rooms if r.get("area_id") == area), None)
        self._sensor_rooms[entity_id] = room
        return room

    @callback
    def _presence_changed(self, event: Event[EventStateChangedData]) -> None:
        """A motion/presence sensor turned on: Bluetooth says who, the sensor says when (see RoomTracker.confirm)."""
        entity_id: str = event.data["entity_id"]
        if not entity_id.startswith("binary_sensor."):
            return
        new = event.data.get("new_state")
        old = event.data.get("old_state")
        if new is None or new.state != "on" or (old is not None and old.state == "on"):
            return
        if new.attributes.get("device_class") not in PRESENCE_CLASSES:
            return
        room = self._sensor_room(entity_id)
        if room is None:
            return
        now = time.time()
        # one sensor, one person: the device that finds the room most plausible moves (the others stay)
        for tracker in sorted(self._trackers.values(), key=lambda tr: -tr.belief.get(room, 0.0)):
            if tracker.shown == room:
                return
            if tracker.confirm(room, now):
                self._estimate(now)
                return

    @callback
    def stop(self) -> None:
        self._stop_waiting()
        if self._unsub is not None:
            self._unsub()
            self._unsub = None
        for unsub in self._listeners:
            unsub()
        self._listeners = []
        self.state = {}
        self.calibration = None
        async_dispatcher_send(self.hass, SIGNAL_LOCATE)

    @property
    def running(self) -> bool:
        return self._unsub is not None

    @callback
    def watch_nearby(self) -> list[dict[str, Any]]:
        """Strong unknown devices of the last seconds (the editor polls this while the user adds a device)."""
        if not self.running:
            self.start()
        self._nearby_until = time.time() + 60
        now = time.time()
        rows = [dict(v, address=a) for a, v in self.nearby.items() if now - v["t"] < NEARBY_KEEP]
        # beacons first (an Android phone among many strong lamps and plugs), then the strongest
        rows.sort(key=lambda r: (r["ibeacon"] is None, -r["rssi"]))
        return rows[:25]

    @callback
    def _tick(self, _now: Any) -> None:
        try:
            readings = self._reader.read(self.hass)
        except (KeyError, RuntimeError):
            return
        now = time.time()
        watch_nearby = now < self._nearby_until
        for r in readings:
            dev = self._identity.resolve(r.address, r.adv)
            if dev is not None:
                tracker = self._trackers.get(dev)
                if tracker is not None:
                    tracker.add(r.t, r.source, r.rssi)
            elif watch_nearby:
                beacon = ibeacon_key(r.adv)
                # beacons also when weak: the Android app sends at the lowest power unless changed
                if r.rssi <= -75 and beacon is None:
                    continue
                prev = self.nearby.get(r.address)
                if prev is None or now - prev["t"] > 3 or r.rssi > prev["rssi"]:
                    self.nearby[r.address] = {
                        "t": now,
                        "rssi": r.rssi,
                        "name": r.adv.local_name,
                        "ibeacon": beacon,
                        "apple": 0x004C in (r.adv.manufacturer_data or {}),
                        "random": int(r.address[:2], 16) >> 6 == 0b01,
                    }
        if not watch_nearby and self.nearby:
            self.nearby = {}
        if now - self._last_sample >= SAMPLE_EVERY and self.calibration is not None:
            self._last_sample = now
            self._sample(now)
        if now - self._last_step >= STEP:
            self._last_step = now
            self._estimate(now)
        if not self.enabled and self.calibration is None and not watch_nearby:
            self.stop()

    def _sample(self, now: float) -> None:
        cal = self.calibration
        assert cal is not None
        if now > cal["until"]:
            self.calibration = None
            self._save()
            async_dispatcher_send(self.hass, SIGNAL_LOCATE)
            return
        for dev in cal["devices"]:
            tracker = self._trackers.get(dev)
            if tracker is None:
                continue
            vector = tracker.adaptive_window(now)
            if vector:
                fp = self.fingerprints.setdefault(dev, Fingerprints())
                fp.add(cal["room"], vector, MAX_SAMPLES_PER_ROOM)
                cal["count"][dev] = cal["count"].get(dev, 0) + 1

    def _evidence_for(self, dev: str, learned: Fingerprints | None, window: dict[str, float]) -> dict[str, float]:
        """The room scores of a window; the last ones again while window, learning and scanner rooms are the same."""
        key = (
            tuple(sorted(window.items())),
            id(learned),
            learned.stamp() if learned else None,
            tuple(sorted(self.scanner_rooms.items())),
        )
        memo = self._evidence.get(dev)
        if memo is not None and memo[0] == key:
            return memo[1]
        scores = evidence(learned, window, self.scanner_rooms)
        self._evidence[dev] = (key, scores)
        return scores

    def _estimate(self, now: float) -> None:
        changed = False
        names = {r["id"]: r for r in self.rooms}
        pooled = self.pooled()  # once per estimate, not per device (#370)
        for dev, tracker in self._trackers.items():
            window = tracker.adaptive_window(now)
            own = self.fingerprints.get(dev)
            # its own learning alone only when it covers most rooms (an iPhone in a pocket may have learned few)
            full = own is not None and len(own.rooms()) >= max(2, OWN_SHARE * len(pooled.rooms()))
            learned = own if full else pooled
            est = tracker.step(now, self._evidence_for(dev, learned, window))
            room = names.get(est.room) if est.room else None
            new = {
                "room": est.room,
                "room_name": room["name"] if room else None,
                "floor": room.get("floor") if room else None,
                "area_id": room.get("area_id") if room else None,
                "probability": est.probability,
                "since": est.since,
                "last_seen": est.last_seen,
            }
            old = self.state.get(dev)
            if old is None or old["room"] != new["room"] or abs(old["probability"] - new["probability"]) > 0.1:
                changed = True
            elif (est.last_seen or 0.0) - self._announced_seen.get(dev, 0.0) >= LAST_SEEN_REFRESH:
                changed = True  # heard on in the same room: the sensors refresh last_seen now and then (#365)
            self.state[dev] = new
        if changed:
            self._announced_seen = {dev: st.get("last_seen") or 0.0 for dev, st in self.state.items()}
            async_dispatcher_send(self.hass, SIGNAL_LOCATE)

    # ------------------------------------------------------------------ calibration

    @callback
    def calibrate_start(self, room: str, devices: list[str], seconds: int = CALIBRATE_SECONDS) -> None:
        devices = [d for d in devices if d in self._trackers]
        if not devices:
            raise ValueError("no devices")
        self.start()
        self.calibration = {
            "room": room,
            "devices": devices,
            "until": time.time() + seconds,
            "started": time.time(),
            "count": {},
        }

    @callback
    def calibrate_stop(self) -> None:
        if self.calibration is not None:
            self.calibration = None
            self._save()

    @callback
    def calibrate_clear(self, room: str | None) -> None:
        for fp in self.fingerprints.values():
            fp.drop(room)
        self._save()

    def calibration_status(self) -> dict[str, Any] | None:
        cal = self.calibration
        if cal is None:
            return None
        now = time.time()
        return {"room": cal["room"], "left": max(0, round(cal["until"] - now)), "count": cal["count"]}

    def snapshot(self) -> dict[str, Any]:
        return {
            "running": self.running,
            "devices": [
                {
                    "id": d["id"],
                    "name": d["name"],
                    "person": d["person"],
                    "icon": d["icon"],
                    **self.state.get(d["id"], {}),
                }
                for d in self.devices
            ],
            "calibration": self.calibration_status(),
        }


def _even_share(lists: list[list[dict[str, float]]], cap: int) -> list[dict[str, float]]:
    """All samples of the lists when they are no more than `cap`; else the newest of each list in turn up to `cap`
    (oldest first, like a device's own samples)."""
    if sum(len(vectors) for vectors in lists) <= cap:
        return [v for vectors in lists for v in vectors]
    picked: list[dict[str, float]] = []
    depth = 0
    while len(picked) < cap:
        for vectors in lists:
            if depth < len(vectors) and len(picked) < cap:
                picked.append(vectors[-1 - depth])
        depth += 1
    return picked[::-1]


def quality(samples: dict[str, dict[str, list[dict[str, float]]]]) -> dict[str, Any]:
    """Leave-one-out over the calibration samples: how often a sample's room is found from the others (run it in
    an executor, it is quadratic in the number of samples)."""
    out: dict[str, Any] = {}
    for dev, rooms in samples.items():
        per_room: dict[str, list[int]] = {}
        for room, vectors in rooms.items():
            for i, v in enumerate(vectors):
                others = Fingerprints(
                    {r: [x for j, x in enumerate(vs) if not (r == room and j == i)] for r, vs in rooms.items()}
                )
                scores = others.scores(v)
                hit = bool(scores) and max(scores, key=scores.__getitem__) == room
                counts = per_room.setdefault(room, [0, 0])
                counts[0] += hit
                counts[1] += 1
        total = sum(c[1] for c in per_room.values())
        out[dev] = {
            "overall": round(sum(c[0] for c in per_room.values()) / total, 3) if total else None,
            "rooms": {r: round(c[0] / c[1], 3) for r, c in per_room.items() if c[1]},
        }
    return out
