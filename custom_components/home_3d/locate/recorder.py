"""Lab recorder for the locating feasibility test.

Writes what every Bluetooth scanner heard (address, RSSI, scanner, time) plus room marks from a calibration walk and
motion/presence changes to a gzip'd JSON-lines file in the Home Assistant config folder. Nothing leaves the house.
Only reachable from the lab page; stops by itself after MAX_DURATION, and when Home 3D is unloaded or reloaded
(#368). Removing the integration deletes the recordings (async_remove_recordings): they hold the Bluetooth addresses
heard in the house and are of no use without the lab page.
"""

from __future__ import annotations

import asyncio
import binascii
from datetime import timedelta
import gzip
import json
import logging
from pathlib import Path
import shutil
import threading
import time
from typing import Any

from homeassistant.components import websocket_api
from homeassistant.const import EVENT_STATE_CHANGED
from homeassistant.core import Event, EventStateChangedData, HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_interval
import voluptuous as vol

from .service import DATA_LOCATE

_LOGGER = logging.getLogger(__name__)

DATA_RECORDER = "home_3d_locate_recorder"
FOLDER = "home_3d_locate"
POLL = timedelta(seconds=1)
FLUSH_EVERY = 5  # polls
MAX_DURATION = 6 * 3600  # seconds
SENSOR_CLASSES = {"motion", "occupancy", "presence"}
# rotating Bluetooth addresses: what is remembered per address is capped (#368)
MAX_RESOLVED = 4096  # addresses whose Private BLE Device is known (the oldest half goes at the cap)
SEEN_KEEP = 600.0  # seconds a (scanner, address) last-heard time is kept; scanners forget a device after ~3 min
PRUNE_EVERY = 60  # polls


def _irk_ciphers(hass: HomeAssistant) -> list[tuple[str, str, Any]]:
    """(id, title, cipher) for every Private BLE Device entry (iPhone, Apple Watch with a known IRK)."""
    try:
        from bluetooth_data_tools import get_cipher_for_irk
    except ImportError:
        return []
    out = []
    for i, entry in enumerate(hass.config_entries.async_entries("private_ble_device")):
        try:
            cipher = get_cipher_for_irk(binascii.unhexlify(entry.data["irk"]))
        except (KeyError, ValueError, binascii.Error):
            continue
        out.append((f"irk{i}", entry.title, cipher))
    return out


_WRITE_LOCK = threading.Lock()


def _write(path: Path, lines: list[str]) -> None:
    with _WRITE_LOCK:
        path.parent.mkdir(parents=True, exist_ok=True)
        _append(path, lines)


def _append(path: Path, lines: list[str]) -> None:
    with gzip.open(path, "at", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def _remove(folder: Path) -> None:
    with _WRITE_LOCK:
        shutil.rmtree(folder, ignore_errors=True)


class LocateRecorder:
    """One recording at a time."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self.path: Path | None = None
        self.started = 0.0
        self.lines = 0
        self.mark: dict[str, Any] | None = None
        self._buffer: list[str] = []
        self._seen: dict[tuple[str, str], float] = {}
        self._resolved: dict[str, str | None] = {}
        self._ciphers: list[tuple[str, str, Any]] = []
        self._recent: dict[str, dict[str, Any]] = {}
        self._polls = 0
        self._unsubs: list[Any] = []
        self._writes: set[asyncio.Future[None]] = set()

    @property
    def running(self) -> bool:
        return self.path is not None

    def _emit(self, row: dict[str, Any]) -> None:
        self._buffer.append(json.dumps(row, separators=(",", ":")))
        self.lines += 1

    def _who(self, address: str) -> str | None:
        """The Private BLE Device id an address resolves to (cached per address), or None."""
        if address in self._resolved:
            return self._resolved[address]
        who = None
        if self._ciphers:
            from bluetooth_data_tools import resolve_private_address

            for key, _title, cipher in self._ciphers:
                try:
                    if resolve_private_address(cipher, address):
                        who = key
                        break
                except ValueError:
                    break
        if len(self._resolved) >= MAX_RESOLVED:
            for old in list(self._resolved)[: MAX_RESOLVED // 2]:
                del self._resolved[old]
        self._resolved[address] = who
        return who

    @callback
    def start(self, note: str) -> dict[str, Any]:
        if self.running:
            return self.status()
        from homeassistant.components import bluetooth

        stamp = time.strftime("%Y%m%d-%H%M%S")
        self.path = Path(self.hass.config.path(FOLDER, f"rec-{stamp}.jsonl.gz"))
        self.started = time.time()
        self.lines = 0
        self.mark = None
        self._buffer = []
        self._seen = {}
        self._resolved = {}
        self._recent = {}
        self._ciphers = _irk_ciphers(self.hass)
        self._emit({"type": "start", "t": self.started, "note": note[:200]})
        for key, title, _cipher in self._ciphers:
            self._emit({"type": "device", "id": key, "title": title})
        for scanner in bluetooth.async_current_scanners(self.hass):
            self._emit({"type": "scanner", "s": scanner.source, "name": scanner.name, "kind": type(scanner).__name__})
        self._unsubs = [
            async_track_time_interval(self.hass, self._poll, POLL),
            self.hass.bus.async_listen(EVENT_STATE_CHANGED, self._state_changed),
        ]
        _LOGGER.info("Locate recorder started: %s", self.path)
        return self.status()

    @callback
    def stop(self) -> dict[str, Any]:
        if not self.running:
            return self.status()
        self._emit({"type": "stop", "t": time.time()})
        for unsub in self._unsubs:
            unsub()
        self._unsubs = []
        self._flush()
        status = self.status()
        self.path = None
        return status

    @callback
    def set_mark(self, room: str | None, name: str | None) -> dict[str, Any]:
        """The walker says where they are now (None: walking between rooms / mark ended)."""
        self.mark = {"room": room, "name": name, "t": time.time()} if room else None
        if self.running:
            self._emit({"type": "mark", "t": time.time(), "room": room, "name": name})
        return self.status()

    @callback
    def status(self) -> dict[str, Any]:
        now = time.time()
        return {
            "running": self.running,
            "file": self.path.name if self.path else None,
            "seconds": round(now - self.started) if self.running else 0,
            "lines": self.lines,
            "mark": self.mark,
            "devices": [
                {"id": key, "title": title, **self._recent.get(key, {})} for key, title, _cipher in self._ciphers
            ],
        }

    @callback
    def _state_changed(self, event: Event[EventStateChangedData]) -> None:
        entity_id: str = event.data["entity_id"]
        if not entity_id.startswith("binary_sensor."):
            return
        new = event.data.get("new_state")
        if new is None or new.attributes.get("device_class") not in SENSOR_CLASSES:
            return
        self._emit({"type": "sensor", "t": time.time(), "e": entity_id, "on": new.state == "on"})

    @callback
    def _poll(self, _now: Any) -> None:
        from homeassistant.components import bluetooth

        if time.time() - self.started > MAX_DURATION:
            self.stop()
            return
        wall = time.time()
        mono = time.monotonic()
        for scanner in bluetooth.async_current_scanners(self.hass):
            stamps = getattr(scanner, "discovered_device_timestamps", None)
            if stamps is None:
                stamps = getattr(scanner, "_discovered_device_timestamps", {})
            source = scanner.source
            for address, (_device, adv) in scanner.discovered_devices_and_advertisement_data.items():
                seen = stamps.get(address)
                if seen is None or adv.rssi is None or adv.rssi <= -127:
                    continue
                key = (source, address)
                if seen <= self._seen.get(key, 0.0):
                    continue
                self._seen[key] = seen
                row: dict[str, Any] = {"t": round(wall - (mono - seen), 2), "s": source, "a": address, "r": adv.rssi}
                if adv.tx_power is not None:
                    row["tx"] = adv.tx_power
                if adv.manufacturer_data:
                    company, payload = next(iter(adv.manufacturer_data.items()))
                    row["m"] = company
                    if payload:
                        row["m0"] = payload[0]
                    # iBeacon (Apple 0x004C, type 0x02): uuid/major/minor identify the beacon, not its address
                    if company == 0x004C and len(payload) >= 23 and payload[0] == 0x02:
                        row["ib"] = payload[2:22].hex()
                who = self._who(address)
                if who:
                    row["p"] = who
                    best = self._recent.get(who)
                    if best is None or wall - best["t"] > 5 or adv.rssi > best["rssi"]:
                        self._recent[who] = {"t": wall, "rssi": adv.rssi, "scanner": scanner.name}
                self._emit(row)
        self._polls += 1
        if self._polls % FLUSH_EVERY == 0:
            self._flush()
        if self._polls % PRUNE_EVERY == 0:
            self._seen = {k: t for k, t in self._seen.items() if mono - t < SEEN_KEEP}

    def _flush(self) -> None:
        if not self._buffer or self.path is None:
            return
        lines, self._buffer = self._buffer, []
        write = self.hass.async_add_executor_job(_write, self.path, lines)
        self._writes.add(write)
        write.add_done_callback(self._writes.discard)

    async def async_written(self) -> None:
        """Wait for the writes on their way to the file."""
        if self._writes:
            await asyncio.wait(list(self._writes))


async def async_unload_recorder(hass: HomeAssistant) -> None:
    """Stop a recording and drop the recorder with the entry (#368): its timer and listener must not outlive an
    unload or reload, and the last lines are written before the entry counts as unloaded."""
    recorder: LocateRecorder | None = hass.data.pop(DATA_RECORDER, None)
    if recorder is not None:
        recorder.stop()
        await recorder.async_written()


async def async_remove_recordings(hass: HomeAssistant) -> None:
    """Delete the recordings folder (on removal of the integration, see the module docstring)."""
    await hass.async_add_executor_job(_remove, Path(hass.config.path(FOLDER)))


def get_recorder(hass: HomeAssistant) -> LocateRecorder:
    recorder: LocateRecorder | None = hass.data.get(DATA_RECORDER)
    if recorder is None:
        recorder = hass.data[DATA_RECORDER] = LocateRecorder(hass)
    return recorder


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/locate/rec",
        vol.Required("action"): vol.In(["start", "stop", "status", "mark"]),
        vol.Optional("room"): vol.Any(None, vol.All(str, vol.Length(max=64))),
        vol.Optional("name"): vol.Any(None, vol.All(str, vol.Length(max=120))),
        vol.Optional("note", default=""): vol.All(str, vol.Length(max=200)),
    }
)
@websocket_api.require_admin
@callback
def ws_locate_rec(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Lab only: start/stop the locating recorder, set the walker's room mark, or read its status."""
    if DATA_LOCATE not in hass.data:  # Home 3D unloaded: a recorder started now would never be stopped
        connection.send_error(msg["id"], "not_loaded", "Home 3D is not set up")
        return
    recorder = get_recorder(hass)
    action = msg["action"]
    try:
        if action == "start":
            result = recorder.start(msg["note"])
        elif action == "stop":
            result = recorder.stop()
        elif action == "mark":
            result = recorder.set_mark(msg.get("room"), msg.get("name"))
        else:
            result = recorder.status()
    except (KeyError, RuntimeError) as err:  # Bluetooth not set up
        connection.send_error(msg["id"], "no_bluetooth", str(err))
        return
    connection.send_result(msg["id"], result)
