"""Sensors of Home 3D: the room of every device the locating feature tracks (one sensor per device)."""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from homeassistant.components.sensor import SensorEntity
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.helpers.entity_platform import AddEntitiesCallback

from .const import DOMAIN
from .locate.service import DATA_LOCATE, LAST_SEEN_REFRESH, SIGNAL_LOCATE, SIGNAL_LOCATE_DEVICES, LocateService


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry, async_add_entities: AddEntitiesCallback) -> None:
    service: LocateService | None = hass.data.get(DATA_LOCATE)
    if service is None:
        return
    known: dict[str, LocateSensor] = {}

    @callback
    def sync() -> None:
        # "no per-person room sensors" (#183): a device that belongs to a person gets none, a thing (keys) still does
        wanted = {d["id"] for d in service.devices if service.person_sensors or not d.get("person")}
        new = [LocateSensor(service, d["id"]) for d in service.devices if d["id"] in wanted and d["id"] not in known]
        for sensor in new:
            known[sensor.device_id] = sensor
        if new:
            async_add_entities(new)
        # a removed device takes its sensor along (no "unavailable" leftovers in Home Assistant)
        registry = er.async_get(hass)
        for device_id in [k for k in known if k not in wanted]:
            sensor = known.pop(device_id)
            if sensor.entity_id and registry.async_get(sensor.entity_id):
                registry.async_remove(sensor.entity_id)
        # sensors left in the registry by an earlier run (before the setting was turned off) go too
        prefix = f"{DOMAIN}_locate_"
        for reg in er.async_entries_for_config_entry(registry, entry.entry_id):
            if (
                reg.domain == "sensor"
                and reg.unique_id.startswith(prefix)
                and reg.unique_id[len(prefix) :] not in wanted
            ):
                registry.async_remove(reg.entity_id)

    sync()
    entry.async_on_unload(async_dispatcher_connect(hass, SIGNAL_LOCATE_DEVICES, sync))


class LocateSensor(SensorEntity):
    """Room of one tracked phone, watch or tag (unknown while away or not heard)."""

    _attr_has_entity_name = False
    _attr_should_poll = False
    _attr_icon = "mdi:map-marker-radius"
    # these change with nearly every estimate: kept in the state, left out of the recorder (#365)
    _unrecorded_attributes = frozenset({"probability", "since", "last_seen"})

    def __init__(self, service: LocateService, device_id: str) -> None:
        self.service = service
        self.device_id = device_id
        self._attr_unique_id = f"{DOMAIN}_locate_{device_id}"
        self._written: tuple[Any, ...] | None = None
        self._written_seen = 0.0

    def _device(self) -> dict[str, Any] | None:
        return next((d for d in self.service.devices if d["id"] == self.device_id), None)

    @property
    def available(self) -> bool:
        return self._device() is not None

    @property
    def name(self) -> str:
        device = self._device()
        return f"{device['name'] if device else self.device_id} room"

    @property
    def native_value(self) -> str | None:
        return (self.service.state.get(self.device_id) or {}).get("room_name")

    @property
    def extra_state_attributes(self) -> dict[str, Any]:
        state = self.service.state.get(self.device_id) or {}
        device = self._device() or {}

        def iso(t: float | None) -> str | None:
            return datetime.fromtimestamp(t, UTC).isoformat() if t else None

        return {
            "room_id": state.get("room"),
            "floor": state.get("floor"),
            "area_id": state.get("area_id"),
            "probability": state.get("probability"),
            "since": iso(state.get("since")),
            "last_seen": iso(state.get("last_seen")),
            "person": device.get("person"),
            "device_name": device.get("name"),
            "wearable": bool(device.get("wearable")),
            "icon_name": device.get("icon"),
            "home3d_locate": True,
        }

    def _stable(self) -> tuple[Any, ...]:
        """What a write is for: the room and the device's own settings, not the probability or the times."""
        state = self.service.state.get(self.device_id) or {}
        device = self._device() or {}
        return (
            self.available,
            self.name,
            state.get("room_name"),
            state.get("room"),
            state.get("floor"),
            state.get("area_id"),
            device.get("person"),
            device.get("name"),
            bool(device.get("wearable")),
            device.get("icon"),
        )

    def _seen(self) -> float:
        return float((self.service.state.get(self.device_id) or {}).get("last_seen") or 0.0)

    async def async_added_to_hass(self) -> None:
        # Home Assistant writes the first state right after this
        self._written, self._written_seen = self._stable(), self._seen()
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL_LOCATE, self._changed))
        self.async_on_remove(async_dispatcher_connect(self.hass, SIGNAL_LOCATE_DEVICES, self._changed))

    @callback
    def _changed(self) -> None:
        """Written only when this device's room or settings changed (any device's change sends the signal), and
        once a LAST_SEEN_REFRESH while it is heard: the views read last_seen to tell a worn watch from a phone left
        lying (presence.ts locatedPersons). Before #365 every sensor wrote a row on every change of any device."""
        stable, seen = self._stable(), self._seen()
        if stable == self._written and seen - self._written_seen < LAST_SEEN_REFRESH:
            return
        self._written, self._written_seen = stable, seen
        self.async_write_ha_state()
