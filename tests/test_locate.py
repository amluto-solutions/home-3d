"""Locating: settings over the websocket, a room sensor per device, presence sensors confirming a room."""

from __future__ import annotations

import math
import random
import time

from homeassistant.core import Context, HomeAssistant, callback
from homeassistant.helpers import area_registry as ar
from homeassistant.helpers import entity_registry as er
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry, async_mock_service

from custom_components.home_3d.const import DOMAIN
from custom_components.home_3d.locate.answers import _away
from custom_components.home_3d.locate.engine import Fingerprints
from custom_components.home_3d.locate.plan import plan_doors, plan_rooms
from custom_components.home_3d.locate.service import DATA_LOCATE, SIGNAL_LOCATE, LocateService

ROOMS = [
    {"id": "kitchen", "name": "Kitchen", "floor": "Ground", "area_id": "kitchen"},
    {"id": "hall", "name": "Hall", "floor": "Ground", "area_id": "hall"},
    {"id": "living", "name": "Living", "floor": "Ground", "area_id": None},
]
WATCH = {"id": "irk_watch", "name": "Watch", "kind": "irk", "key": "00112233445566778899aabbccddeeff", "person": None}


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_config_without_bluetooth(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/locate/config"})
    res = await client.receive_json()
    assert res["success"]
    assert res["result"]["enabled"] is False
    assert res["result"]["bluetooth"] is False
    assert res["result"]["devices"] == []


async def test_a_device_gets_a_room_sensor(hass: HomeAssistant, hass_ws_client, hass_storage) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id(
        {
            "type": "home_3d/locate/configure",
            "devices": [WATCH],
            "rooms": ROOMS,
            "doors": [["kitchen", "hall"], ["hall", "living"]],
            "scanner_rooms": {"AA:BB:CC:DD:EE:01": "kitchen"},
        }
    )
    res = await client.receive_json()
    assert res["success"], res
    assert [d["id"] for d in res["result"]["devices"]] == ["irk_watch"]
    await hass.async_block_till_done()

    entity_id = er.async_get(hass).async_get_entity_id("sensor", DOMAIN, f"{DOMAIN}_locate_irk_watch")
    assert entity_id is not None
    assert hass.states.get(entity_id).state == "unknown"

    # the service found the watch in the kitchen: the sensor says so
    service: LocateService = hass.data[DATA_LOCATE]
    service.state["irk_watch"] = {
        "room": "kitchen",
        "room_name": "Kitchen",
        "floor": "Ground",
        "area_id": "kitchen",
        "probability": 0.93,
        "since": time.time(),
        "last_seen": time.time(),
    }
    async_dispatcher_send(hass, SIGNAL_LOCATE)
    await hass.async_block_till_done()
    state = hass.states.get(entity_id)
    assert state.state == "Kitchen"
    assert state.attributes["room_id"] == "kitchen"
    assert state.attributes["home3d_locate"] is True

    # settings and devices are kept (store), the room samples are not part of the reply
    await hass.async_block_till_done()


async def test_admin_only_commands(hass: HomeAssistant, hass_ws_client, hass_read_only_access_token) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass, hass_read_only_access_token)
    await client.send_json_auto_id({"type": "home_3d/locate/configure", "enabled": True})
    res = await client.receive_json()
    assert not res["success"]
    assert res["error"]["code"] == "unauthorized"
    # everyone may watch where people are (unless "admins only")
    await client.send_json_auto_id({"type": "home_3d/locate/subscribe"})
    res = await client.receive_json()
    assert res["success"]


async def test_presence_sensor_maps_to_the_plan_room(hass: HomeAssistant) -> None:
    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    await service.async_configure({"devices": [WATCH], "rooms": ROOMS, "doors": [["kitchen", "hall"]]})
    area = ar.async_get(hass).async_create("Hall")
    entry = er.async_get(hass).async_get_or_create("binary_sensor", "test", "motion_hall")
    er.async_get(hass).async_update_entity(entry.entity_id, area_id=area.id)
    # the plan room is linked by the area id
    service.rooms = [{**r, "area_id": area.id} if r["id"] == "hall" else r for r in ROOMS]
    service._sensor_rooms = {}
    assert service._sensor_room(entry.entity_id) == "hall"
    assert service._sensor_room("binary_sensor.elsewhere") is None


async def test_unload_stops_the_service(hass: HomeAssistant) -> None:
    entry = await _setup(hass)
    assert DATA_LOCATE in hass.data
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert DATA_LOCATE not in hass.data


async def test_spoken_answers_come_from_the_service(hass: HomeAssistant) -> None:
    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    keys = {**WATCH, "id": "mac_tag", "name": "Keys", "kind": "mac", "key": "C0:11:22:33:44:55"}
    await service.async_configure({"devices": [WATCH, keys], "rooms": ROOMS})
    now = time.time()
    kitchen = {"room": "kitchen", "room_name": "Kitchen", "probability": 0.9}
    service.state["irk_watch"] = {**kitchen, "since": now, "last_seen": now}

    async def ask(text: str) -> dict:
        return await hass.services.async_call(DOMAIN, "ask", {"text": text}, blocking=True, return_response=True)

    res = await ask("Where is my watch?")
    assert res == {"answered": True, "answer": "Watch is in the Kitchen.", "screen_open": False}
    assert (await ask("where are the keys"))["answer"] == "I can't hear Keys right now."
    assert (await ask("who is home"))["answer"] == "At home: Watch (Kitchen)."
    assert (await ask("ring my watch"))["answer"] == "No app to ring is set for Watch."
    # anything else still goes to the screens (none open here)
    assert (await ask("show the kitchen"))["screen_open"] is False


async def test_removing_a_device_removes_its_sensor(hass: HomeAssistant) -> None:
    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    await service.async_configure({"devices": [WATCH], "rooms": ROOMS})
    await hass.async_block_till_done()
    registry = er.async_get(hass)
    entity_id = registry.async_get_entity_id("sensor", DOMAIN, f"{DOMAIN}_locate_irk_watch")
    assert entity_id is not None
    await service.async_configure({"devices": []})
    await hass.async_block_till_done()
    assert registry.async_get_entity_id("sensor", DOMAIN, f"{DOMAIN}_locate_irk_watch") is None
    assert hass.states.get(entity_id) is None


async def test_a_device_without_learning_uses_the_others(hass: HomeAssistant) -> None:
    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    second = {**WATCH, "id": "irk_second", "name": "Second", "key": "ffeeddccbbaa99887766554433221100"}
    await service.async_configure({"devices": [WATCH, second], "rooms": ROOMS})
    service.fingerprints["irk_watch"] = Fingerprints({"kitchen": [{"s1": -60.0}], "hall": [{"s1": -80.0}]})
    pooled = service.pooled()
    assert pooled.rooms() == ["kitchen", "hall"]
    # an offline scanner keeps its row and room
    await service.async_configure({"scanner_rooms": {"AA:BB:CC:DD:EE:09": "hall"}})
    rows = service.config()["scanners"]
    assert any(r["source"] == "AA:BB:CC:DD:EE:09" and r.get("offline") for r in rows)


async def test_spoken_names_are_matched_tolerantly(hass: HomeAssistant) -> None:
    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    hass.states.async_set("person.alex", "home", {"friendly_name": "Admin", "user_id": "u1"})
    hass.states.async_set("person.sam", "home", {"friendly_name": "Sam", "user_id": "u2"})
    devices = [
        {**WATCH, "id": "w1", "name": "Alex Apple Watch", "person": "person.alex"},
        {**WATCH, "id": "p1", "name": "Alex Iphone", "person": "person.alex", "key": "11" * 16},
        {**WATCH, "id": "p2", "name": "Sam Iphone", "person": "person.sam", "key": "22" * 16},
    ]
    await service.async_configure({"devices": devices, "rooms": ROOMS})
    now = time.time()
    service.state["w1"] = {"room": "kitchen", "room_name": "Kitchen", "since": now, "last_seen": now}
    service.state["p1"] = {"room": "hall", "room_name": "Hall", "since": now, "last_seen": now}
    service.state["p2"] = {"room": "living", "room_name": "Living", "since": now, "last_seen": now}
    from custom_components.home_3d.locate.answers import async_locate

    async def ask(text: str, user: str | None = None) -> str | None:
        located = await async_locate(hass, service, text, "en", user)
        return located.text if located else None

    # speech recognition misspells a name or writes a possessive without the apostrophe
    assert await ask("Where is Allex Apple Watch?") == "Alex Apple Watch is in the Kitchen."
    assert await ask("Where is Alexs Apple Watch?") == "Alex Apple Watch is in the Kitchen."
    # "my iPhone" is the iPhone of the person who asks
    assert await ask("Where is my iPhone?", "u2") == "Sam Iphone is in the Living."
    assert await ask("Where is my iPhone?", "u1") == "Alex Iphone is in the Hall."
    # a first name alone means the person: the watch tells where
    assert await ask("Where is Alex?") == "Alex is in the Kitchen."
    assert await ask("Where is Sam?") == "Sam Iphone is in the Living."
    assert await ask("Where is the TV?") is None


async def test_weak_beacons_show_among_nearby_devices(hass: HomeAssistant) -> None:
    """The Android app sends its iBeacon at the lowest power by default: it is listed although weak, and first."""
    from types import SimpleNamespace

    from custom_components.home_3d.locate.scanners import Reading

    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    beacon = bytes.fromhex("0215" + "280fa872f5254bccb7b42c2843e023e0" + "0064" + "9c44" + "c5")
    phone = SimpleNamespace(local_name=None, manufacturer_data={0x004C: beacon})
    now = time.time()
    readings = [
        Reading("shelly", "AA:00:00:00:00:01", -60, now, SimpleNamespace(local_name="Lamp", manufacturer_data={})),
        Reading("shelly", "AA:00:00:00:00:02", -82, now, SimpleNamespace(local_name=None, manufacturer_data={})),
        Reading("shelly", "5B:00:00:00:00:03", -84, now, phone),
    ]
    service._reader = SimpleNamespace(read=lambda _hass: readings)
    service._nearby_until = now + 60
    service._tick(None)
    rows = service.watch_nearby()
    service.stop()
    assert [r["address"] for r in rows] == ["5B:00:00:00:00:03", "AA:00:00:00:00:01"]
    assert rows[0]["ibeacon"] == "280fa872f5254bccb7b42c2843e023e000649c44"


def test_a_person_is_where_the_surer_device_says() -> None:
    """Watch and phone heard together but in different rooms: the watch wins unless the phone is clearly surer;
    a phone that stayed put while the watch walked on was left lying there."""
    from types import SimpleNamespace

    from custom_components.home_3d.locate.answers import person_state

    now = 10_000.0
    watch = {"id": "w", "wearable": True}
    phone = {"id": "p"}

    def state(w_room, w_p, w_since, p_room, p_p, p_since, p_seen=now - 5):
        return SimpleNamespace(
            state={
                "w": {"room": w_room, "probability": w_p, "since": w_since, "last_seen": now - 5},
                "p": {"room": p_room, "probability": p_p, "since": p_since, "last_seen": p_seen},
            }
        )

    # sitting in the kitchen, the living-room plug behind the seat fools the watch: the surer phone wins
    assert (
        person_state(state("living", 0.6, now - 600, "kitchen", 0.85, now - 610), [watch, phone], now)["room"]
        == "kitchen"
    )
    # only a little surer: the watch keeps it
    assert (
        person_state(state("living", 0.7, now - 600, "kitchen", 0.8, now - 610), [watch, phone], now)["room"]
        == "living"
    )
    # the phone has lain in the kitchen for 20 minutes, the watch walked into the living room 2 minutes ago
    assert (
        person_state(state("living", 0.6, now - 120, "kitchen", 0.95, now - 1200), [watch, phone], now)["room"]
        == "living"
    )
    # the watch has lain in the bathroom for an hour, the phone walked into the kitchen a minute ago: taken off
    assert (
        person_state(state("bath", 0.9, now - 3600, "kitchen", 0.5, now - 60), [watch, phone], now)["room"] == "kitchen"
    )
    # just put down five minutes ago: not yet
    assert person_state(state("bath", 0.9, now - 300, "kitchen", 0.5, now - 60), [watch, phone], now)["room"] == "bath"
    # the phone not heard lately: the watch as before
    assert (
        person_state(state("living", 0.6, now - 600, "kitchen", 0.95, now - 610, now - 300), [watch, phone], now)[
            "room"
        ]
        == "living"
    )


async def test_located_answers_fly_the_views_into_the_room(hass: HomeAssistant) -> None:
    from homeassistant.core import callback

    from custom_components.home_3d.locate.answers import Located
    from custom_components.home_3d.voice import show_located, subscribe_view

    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    sent: list[dict] = []
    others: list[dict] = []

    @callback
    def collect(msg: dict) -> None:
        sent.append(msg)

    subscribe_view(hass, collect, None, True)
    subscribe_view(hass, others.append, None, False)
    show_located(hass, Located("Alex is in the Kitchen.", ["kitchen"], True))
    show_located(hass, Located("I can't hear Alex right now.", [], True))
    # people shown to admins only: only the views of admins get the rooms of people
    service.admins_only = True
    show_located(hass, Located("Alex is in the Kitchen.", ["kitchen"], True))
    show_located(hass, Located("The keys are in the Hall.", ["hall"], False))
    service.fly = False
    show_located(hass, Located("The keys are in the Hall.", ["hall"], False))
    await hass.async_block_till_done()
    assert [(m["show_rooms"], m["admins_only"]) for m in sent] == [
        (["kitchen"], False),
        (["kitchen"], True),
        (["hall"], False),
    ]
    # the view of a user who is no admin never gets the rooms of people shown to admins only (#367)
    assert [(m["show_rooms"], m["admins_only"]) for m in others] == [(["kitchen"], False), (["hall"], False)]


async def test_a_view_asks_locating_first(hass: HomeAssistant, hass_ws_client) -> None:
    """The Home 3D panel's own microphone gets the locating answer and its rooms (not the modules' guess)."""
    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/locate/ask", "text": "Who is home?", "language": "en"})
    assert (await client.receive_json())["result"] is None
    service.devices = [dict(WATCH, name="Alex Apple Watch")]
    service.rooms = ROOMS
    service.state = {
        "irk_watch": {"room": "kitchen", "room_name": "Kitchen", "probability": 0.9, "last_seen": time.time()}
    }
    await client.send_json_auto_id({"type": "home_3d/locate/ask", "text": "Who is home?", "language": "en"})
    res = (await client.receive_json())["result"]
    assert res == {"text": "At home: Alex Apple Watch (Kitchen).", "rooms": ["kitchen"], "admins_only": False}
    # a language without locating sentences of its own is answered in English
    await client.send_json_auto_id({"type": "home_3d/locate/ask", "text": "Who is home?", "language": "fr"})
    assert (await client.receive_json())["result"]["text"] == "At home: Alex Apple Watch (Kitchen)."
    await client.send_json_auto_id({"type": "home_3d/locate/ask", "text": "Show the kitchen", "language": "en"})
    assert (await client.receive_json())["result"] is None


async def test_people_answers_are_withheld_from_non_admins_on_the_server(
    hass: HomeAssistant, hass_ws_client, hass_read_only_user, hass_read_only_access_token
) -> None:
    """With "admins only" on, the server itself gives non-admins no text and no rooms about people (#152)."""
    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    service.devices = [dict(WATCH, name="Alex Apple Watch", person="person.alex")]
    service.rooms = ROOMS
    service.state = {
        "irk_watch": {"room": "kitchen", "room_name": "Kitchen", "probability": 0.9, "last_seen": time.time()}
    }
    service.admins_only = True
    admin = await hass_ws_client(hass)
    other = await hass_ws_client(hass, hass_read_only_access_token)
    for question in ("Who is home?", "Where is alex?"):
        await admin.send_json_auto_id({"type": "home_3d/locate/ask", "text": question, "language": "en"})
        res = (await admin.receive_json())["result"]
        assert "Kitchen" in res["text"] and res["rooms"] == ["kitchen"], question
        await other.send_json_auto_id({"type": "home_3d/locate/ask", "text": question, "language": "en"})
        res = (await other.receive_json())["result"]
        assert "Kitchen" not in res["text"] and "Alex" not in res["text"], question
        assert res["rooms"] == [], question
    # the same through the ask service and Assist: a user who is no admin, or nobody known, is told nothing
    ask = {"text": "who is home"}
    got = await hass.services.async_call(
        DOMAIN, "ask", ask, blocking=True, return_response=True, context=Context(user_id=hass_read_only_user.id)
    )
    assert "Kitchen" not in got["answer"]
    got = await hass.services.async_call(DOMAIN, "ask", ask, blocking=True, return_response=True)
    assert "Kitchen" not in got["answer"]
    # switched off again: everyone gets the answer
    service.admins_only = False
    await other.send_json_auto_id({"type": "home_3d/locate/ask", "text": "Who is home?", "language": "en"})
    assert "Kitchen" in (await other.receive_json())["result"]["text"]


async def test_ringing_copes_with_a_missing_notify_service(hass: HomeAssistant) -> None:
    """A device whose app was removed can't be rung: the answer says so instead of failing (#152)."""
    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    service.devices = [dict(WATCH, name="Watch", notify="notify.mobile_app_gone")]
    service.rooms = ROOMS

    async def ask() -> str:
        got = await hass.services.async_call(
            DOMAIN, "ask", {"text": "ring my watch"}, blocking=True, return_response=True
        )
        return str(got["answer"])

    assert await ask() == "No app to ring is set for Watch."
    calls = async_mock_service(hass, "notify", "mobile_app_gone")
    assert await ask() == "Watch is ringing now."
    assert len(calls) == 1


async def test_no_room_sensors_for_people_when_turned_off(hass: HomeAssistant, hass_ws_client) -> None:
    """#183: person_sensors False creates no sensor for a device of a person (default: it does); things keep theirs."""
    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    registry = er.async_get(hass)
    phone = {**WATCH, "id": "irk_phone", "name": "Phone", "person": "person.sample"}
    keys = {**WATCH, "id": "irk_keys", "name": "Keys", "key": "ffeeddccbbaa99887766554433221100"}

    def uid(device: str) -> str | None:
        return registry.async_get_entity_id("sensor", DOMAIN, f"{DOMAIN}_locate_{device}")

    assert service.person_sensors is True
    await service.async_configure({"devices": [phone, keys], "rooms": ROOMS})
    await hass.async_block_till_done()
    assert uid("irk_phone") is not None and uid("irk_keys") is not None

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/locate/configure", "person_sensors": False})
    res = await client.receive_json()
    assert res["success"], res
    assert res["result"]["person_sensors"] is False
    await hass.async_block_till_done()
    assert uid("irk_phone") is None  # the earlier sensor is removed
    assert uid("irk_keys") is not None
    assert service._data()["person_sensors"] is False

    await service.async_configure({"devices": [phone, keys, {**phone, "id": "irk_tablet"}]})
    await hass.async_block_till_done()
    assert uid("irk_tablet") is None

    await service.async_configure({"person_sensors": True})
    await hass.async_block_till_done()
    assert uid("irk_phone") is not None and uid("irk_tablet") is not None


# ---------------------------------------------------------------------------- the rooms follow the plan (#169)


def _room(room_id: str, name: str, x0: float, x1: float, area: str | None = None) -> dict:
    points = [[x0, 0], [x1, 0], [x1, 4], [x0, 4]]
    return {"id": room_id, "name": name, "area_id": area, "points": points, "floor_material": "wood"}


def _door(opening_id: str, room_id: str, edge: int, *, kind: str = "door", sill: float = 0) -> dict:
    return {
        "id": opening_id,
        "room_id": room_id,
        "edge": edge,
        "offset": 2,
        "width": 0.9,
        "type": kind,
        "sill": sill,
        "height": 2.0,
    }


def _plan(rooms: list[dict], openings: list[dict]) -> dict:
    floor = {"id": "f1", "name": "Ground", "elevation": 0, "height": 2.5, "cut_height": 1.15}
    floor |= {"rooms": rooms, "openings": openings, "furniture": [], "placements": [], "background": None}
    return {"version": 1, "settings": {"wall_exterior": 0.24, "wall_interior": 0.12, "grid": 0.05}, "floors": [floor]}


# kitchen | hall | living side by side: a door kitchen-hall (the kitchen's right edge), a door from the hall to the
# garden (its bottom edge), a high window hall-living and a window down to the floor living-hall
KITCHEN, HALL, LIVING = (
    _room("kitchen", "Kitchen", 0, 4, "kitchen"),
    _room("hall", "Hall", 4, 8),
    _room("living", "Living", 8, 12),
)
OPENINGS = [
    _door("d1", "kitchen", 1),
    _door("d2", "hall", 0),
    _door("w1", "hall", 1, kind="window", sill=0.9),
]


async def _save(client, building: dict, home_id: str | None = None) -> None:
    msg = {"type": "home_3d/building/save", "building": building, **({"home_id": home_id} if home_id else {})}
    await client.send_json_auto_id(msg)
    res = await client.receive_json()
    assert res["success"], res


def test_the_door_graph_is_read_from_the_plan() -> None:
    plan = _plan([KITCHEN, HALL, LIVING], OPENINGS)
    assert plan_doors(plan) == [("kitchen", "hall")]
    # a window down to the floor is a way through, like a passage
    plan = _plan([KITCHEN, HALL, LIVING], [*OPENINGS, _door("w2", "living", 3, kind="window", sill=0.05)])
    assert plan_doors(plan) == [("kitchen", "hall"), ("living", "hall")]
    assert plan_rooms(plan)[0] == {"id": "kitchen", "name": "Kitchen", "floor": "Ground", "area_id": "kitchen"}


async def test_the_rooms_follow_the_active_plan(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    await service.async_configure({"devices": [WATCH]})

    await _save(client, _plan([KITCHEN, HALL], OPENINGS))
    assert [r["id"] for r in service.rooms] == ["kitchen", "hall"]
    assert service.doors == [("kitchen", "hall")]
    assert service._trackers["irk_watch"].neighbours["kitchen"] == {"hall"}

    # the watch is in the hall; the hall is renamed, then removed
    service.state["irk_watch"] = {
        "room": "hall",
        "room_name": "Hall",
        "floor": "Ground",
        "area_id": None,
        "probability": 0.9,
    }
    await _save(client, _plan([KITCHEN, {**HALL, "name": "Entrance"}], OPENINGS))
    assert service.state["irk_watch"]["room_name"] == "Entrance"
    await _save(client, _plan([KITCHEN, LIVING], []))
    assert [r["id"] for r in service.rooms] == ["kitchen", "living"]
    assert service.doors == []
    assert "irk_watch" not in service.state
    assert service._trackers["irk_watch"].rooms == ["kitchen", "living"]


async def test_another_home_made_active_brings_its_rooms(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    await _save(client, _plan([KITCHEN, HALL], OPENINGS))
    await client.send_json_auto_id({"type": "home_3d/homes/create", "name": "Flat"})
    flat = (await client.receive_json())["result"]["home"]["id"]

    # a home that is not active changes nothing
    await _save(client, _plan([LIVING], []), home_id=flat)
    assert [r["id"] for r in service.rooms] == ["kitchen", "hall"]

    await client.send_json_auto_id({"type": "home_3d/homes/set_active", "home_id": flat})
    assert (await client.receive_json())["success"]
    assert [r["id"] for r in service.rooms] == ["living"]


async def test_a_setting_keeps_where_everyone_is(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    await service.async_configure({"devices": [WATCH]})
    await _save(client, _plan([KITCHEN, HALL], OPENINGS))
    tracker = service._trackers["irk_watch"]

    # another setting, a renamed room or furniture moved: the tracker (and the room it shows) stays
    await service.async_configure({"fly": False})
    await _save(client, _plan([{**KITCHEN, "name": "Cook room"}, HALL], OPENINGS))
    assert service._trackers["irk_watch"] is tracker
    # a room more: the trackers start again with it
    await _save(client, _plan([KITCHEN, HALL, LIVING], OPENINGS))
    assert service._trackers["irk_watch"] is not tracker


async def test_an_unchanged_window_is_not_measured_again(hass: HomeAssistant, monkeypatch) -> None:
    from custom_components.home_3d.locate import service as service_module

    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    fp = Fingerprints({"kitchen": [{"s1": -60.0}] * 3, "hall": [{"s1": -80.0}] * 3})
    calls = 0
    real = service_module.evidence

    def counting(*args):
        nonlocal calls
        calls += 1
        return real(*args)

    monkeypatch.setattr(service_module, "evidence", counting)
    window = {"s1": -61.0}
    first = service._evidence_for("irk_watch", fp, window)
    assert service._evidence_for("irk_watch", fp, dict(window)) is first
    assert calls == 1
    # a new reading, a sample learned, or a scanner moved to another room: measured again
    service._evidence_for("irk_watch", fp, {"s1": -70.0})
    fp.add("hall", {"s1": -79.0})
    service._evidence_for("irk_watch", fp, {"s1": -70.0})
    service.scanner_rooms = {"s1": "hall"}
    service._evidence_for("irk_watch", fp, {"s1": -70.0})
    assert calls == 4


async def test_pooled_samples_follow_calibration_at_the_cap(hass: HomeAssistant) -> None:
    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    service.fingerprints["a"] = Fingerprints()
    service.fingerprints["a"].add("kitchen", {"s1": -60.0}, keep=1)
    service.fingerprints["a"].add("hall", {"s1": -80.0}, keep=1)
    first = service.pooled()
    service.fingerprints["a"].add("kitchen", {"s1": -50.0}, keep=1)  # same count, newer sample
    assert service.pooled() is not first
    assert service.pooled().samples["kitchen"] == [{"s1": -50.0}]
    assert service.pooled() is service.pooled()


async def test_a_room_sensor_writes_only_its_own_changes(hass: HomeAssistant) -> None:
    """#365: another device's change, a new probability or a fresher last_seen write nothing (and are not
    recorded); a new room does, and last_seen is sent on once a LAST_SEEN_REFRESH."""
    from custom_components.home_3d.locate.service import LAST_SEEN_REFRESH

    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    second = {**WATCH, "id": "irk_second", "name": "Second", "key": "ffeeddccbbaa99887766554433221100"}
    await service.async_configure({"devices": [WATCH, second], "rooms": ROOMS})
    await hass.async_block_till_done()
    entity_id = er.async_get(hass).async_get_entity_id("sensor", DOMAIN, f"{DOMAIN}_locate_irk_watch")
    writes: list[str] = []

    @callback
    def written(event) -> None:
        if event.data["entity_id"] == entity_id:
            writes.append(event.data["new_state"].state)

    hass.bus.async_listen("state_changed", written)
    now = time.time()
    kitchen = {"room": "kitchen", "room_name": "Kitchen", "floor": "Ground", "area_id": "kitchen"}

    def where(dev: str, room: dict, probability: float, seen: float) -> None:
        service.state[dev] = {**room, "probability": probability, "since": now, "last_seen": seen}
        async_dispatcher_send(hass, SIGNAL_LOCATE)

    where("irk_watch", kitchen, 0.9, now)
    await hass.async_block_till_done()
    assert writes == ["Kitchen"]
    where("irk_second", kitchen, 0.5, now)  # another device
    where("irk_watch", kitchen, 0.6, now + 5)  # only probability and last_seen
    await hass.async_block_till_done()
    assert writes == ["Kitchen"]
    state = hass.states.get(entity_id)
    assert state.attributes["probability"] == 0.9 and state.attributes["last_seen"]
    assert {"probability", "since", "last_seen"} <= state.state_info["unrecorded_attributes"]
    assert "room_id" not in state.state_info["unrecorded_attributes"]
    where("irk_watch", kitchen, 0.6, now + LAST_SEEN_REFRESH)  # heard on: last_seen is sent on
    await hass.async_block_till_done()
    assert writes == ["Kitchen", "Kitchen"]
    assert hass.states.get(entity_id).attributes["probability"] == 0.6
    where("irk_watch", {**kitchen, "room": "hall", "room_name": "Hall"}, 0.8, now + LAST_SEEN_REFRESH + 1)
    await hass.async_block_till_done()
    assert writes == ["Kitchen", "Kitchen", "Hall"]


async def test_last_seen_is_sent_on_while_the_room_stays(hass: HomeAssistant) -> None:
    """The service signals a device heard on in the same room once a LAST_SEEN_REFRESH (#365)."""
    from custom_components.home_3d.locate.service import LAST_SEEN_REFRESH

    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    await service.async_configure({"devices": [WATCH], "rooms": ROOMS})
    signals = []
    from homeassistant.core import callback
    from homeassistant.helpers.dispatcher import async_dispatcher_connect

    # a callback runs at once; a plain lambda would go to the executor and could be counted after the assert
    async_dispatcher_connect(hass, SIGNAL_LOCATE, callback(lambda: signals.append(1)))
    tracker = service._trackers["irk_watch"]
    now = time.time()
    for second in range(int(LAST_SEEN_REFRESH) + 2):
        tracker.add(now + second, "s1", -60.0)
        service._estimate(now + second)
    await hass.async_block_till_done()
    # the first estimate, then once more a minute later: not every second
    assert len(signals) == 2


async def test_a_subscription_follows_the_service_after_a_reload(hass: HomeAssistant, hass_ws_client) -> None:
    """#368: an open view gets the new service's devices after a reload, and a change made just before the reload
    (its save still waiting for the delay) is what the new service loads."""
    entry = await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/locate/subscribe"})
    assert (await client.receive_json())["success"]
    assert (await client.receive_json())["event"]["devices"] == []
    old: LocateService = hass.data[DATA_LOCATE]
    await old.async_configure({"devices": [WATCH], "rooms": ROOMS})

    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    new: LocateService = hass.data[DATA_LOCATE]
    assert new is not old
    assert [d["id"] for d in new.devices] == ["irk_watch"]
    events = []
    while True:
        msg = await client.receive_json()
        events.append(msg["event"])
        if msg["event"]["devices"]:
            break
    assert [d["id"] for d in events[-1]["devices"]] == ["irk_watch"]
    # from now on the new service answers
    new.state["irk_watch"] = {"room": "kitchen", "room_name": "Kitchen", "probability": 0.9}
    async_dispatcher_send(hass, SIGNAL_LOCATE)
    for _ in range(5):  # after the events of the reload still on their way
        devices = (await client.receive_json())["event"]["devices"]
        if devices and "room" in devices[0]:
            break
    assert devices[0]["room"] == "kitchen"


async def test_the_lab_recorder_stops_with_the_entry_and_goes_on_removal(
    hass: HomeAssistant, hass_ws_client, tmp_path
) -> None:
    """#368: a recording running at unload stops (timer and listener) and writes its last lines; the recorder is
    dropped; no new recording starts while Home 3D is unloaded; removing Home 3D deletes the recordings."""
    import gzip
    from pathlib import Path

    from custom_components.home_3d.locate.recorder import DATA_RECORDER, FOLDER, get_recorder

    hass.config.config_dir = str(tmp_path)
    entry = await _setup(hass)
    recorder = get_recorder(hass)
    stopped = []
    recorder.path = Path(hass.config.path(FOLDER, "rec-test.jsonl.gz"))
    recorder.started = time.time()
    recorder._unsubs = [lambda: stopped.append("timer"), lambda: stopped.append("listener")]
    recorder.set_mark("kitchen", "Kitchen")

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert stopped == ["timer", "listener"]
    assert DATA_RECORDER not in hass.data and not recorder.running
    with gzip.open(tmp_path / FOLDER / "rec-test.jsonl.gz", "rt", encoding="utf-8") as f:
        assert [line.split(",")[0] for line in f.read().split()] == ['{"type":"mark"', '{"type":"stop"']

    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/locate/rec", "action": "status"})
    res = await client.receive_json()
    assert res["error"]["code"] == "not_loaded"
    assert DATA_RECORDER not in hass.data

    assert await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert not (tmp_path / FOLDER).exists()


async def test_the_lab_recorder_forgets_old_addresses(hass: HomeAssistant, monkeypatch) -> None:
    """#368: rotating Bluetooth addresses do not grow the recorder's memory for six hours."""
    import sys
    from types import SimpleNamespace

    from custom_components.home_3d.locate import recorder as rec_module

    await _setup(hass)
    recorder = rec_module.get_recorder(hass)
    for n in range(rec_module.MAX_RESOLVED):
        recorder._resolved[f"addr{n}"] = None
    recorder._who("AA:BB:CC:DD:EE:FF")
    assert len(recorder._resolved) <= rec_module.MAX_RESOLVED
    assert "AA:BB:CC:DD:EE:FF" in recorder._resolved and "addr0" not in recorder._resolved

    monkeypatch.setitem(
        sys.modules, "homeassistant.components.bluetooth", SimpleNamespace(async_current_scanners=lambda _hass: [])
    )
    mono = time.monotonic()
    recorder.started = time.time()
    recorder._seen = {("s1", "old"): mono - rec_module.SEEN_KEEP - 1, ("s1", "new"): mono - 1}
    recorder._polls = rec_module.PRUNE_EVERY - 1
    recorder._poll(None)
    assert list(recorder._seen) == [("s1", "new")]


async def test_a_moved_presence_sensor_confirms_its_new_room(hass: HomeAssistant) -> None:
    """#368: the room of a presence sensor follows its area (the registry), not the one it had at the first look."""
    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    areas = ar.async_get(hass)
    hall, kitchen = areas.async_create("Hall"), areas.async_create("Kitchen")
    rooms = [{**ROOMS[0], "area_id": kitchen.id}, {**ROOMS[1], "area_id": hall.id}, ROOMS[2]]
    await service.async_configure({"devices": [WATCH], "rooms": rooms})
    registry = er.async_get(hass)
    entry = registry.async_get_or_create("binary_sensor", "test", "motion_1")
    registry.async_update_entity(entry.entity_id, area_id=hall.id)
    hass.config.components.add("bluetooth")  # running (the timer is not reached in this test)
    service.start()
    try:
        assert service._sensor_room(entry.entity_id) == "hall"
        registry.async_update_entity(entry.entity_id, area_id=kitchen.id)
        await hass.async_block_till_done()
        assert service._sensor_room(entry.entity_id) == "kitchen"
    finally:
        service.stop()


async def test_locating_starts_once_bluetooth_has_loaded(hass: HomeAssistant) -> None:
    """#368: switched on before Bluetooth is set up, it waits for it instead of giving up silently."""
    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    assert "bluetooth" not in hass.config.components
    await service.async_configure({"devices": [WATCH], "rooms": ROOMS, "enabled": True})
    assert not service.running
    hass.config.components.add("bluetooth")
    hass.bus.async_fire("component_loaded", {"component": "bluetooth"})
    await hass.async_block_till_done()
    try:
        assert service.running
    finally:
        service.stop()
    # switched off while waiting: Bluetooth loading later starts nothing
    hass.config.components.remove("bluetooth")
    service.start()
    service.stop()
    hass.config.components.add("bluetooth")
    hass.bus.async_fire("component_loaded", {"component": "bluetooth"})
    await hass.async_block_till_done()
    assert not service.running


def _busy_house(service: LocateService) -> tuple[list[str], dict[str, tuple[float, float]], random.Random]:
    """The example of #370: 12 rooms with a scanner each, 4 devices that learned every room (120 samples a room)
    and 5 never walked with. Returns the device ids, the scanner spots and the random source."""
    rng = random.Random(370)
    rooms = [f"room{n}" for n in range(12)]
    spots = {f"s{n}": (4.0 * (n % 4) + 2, 4.0 * (n // 4) + 2) for n in range(12)}

    def heard(x: float, y: float) -> dict[str, float]:
        out = {}
        for scanner, (sx, sy) in spots.items():
            rssi = -45 - 25 * math.log10(max(1.0, math.hypot(x - sx, y - sy))) + rng.gauss(0, 4)
            if rssi > -92 and rng.random() > 0.15:
                out[scanner] = round(rssi, 1)
        return out

    devices = [
        {"id": f"mac_{n}", "name": f"Tag {n}", "kind": "mac", "key": f"C0:00:00:00:00:{n:02X}"} for n in range(9)
    ]
    service.devices = devices
    service.rooms = [{"id": r, "name": r, "floor": None, "area_id": None} for r in rooms]
    service.scanner_rooms = {s: rooms[n] for n, s in enumerate(spots)}
    service._rebuild()
    for d in devices[:4]:
        service.fingerprints[d["id"]] = Fingerprints(
            {
                room: [heard(*(c + rng.uniform(-1.5, 1.5) for c in spots[f"s{n}"])) for _ in range(120)]
                for n, room in enumerate(rooms)
            }
        )
    return [d["id"] for d in devices], spots, rng


def _hear_everyone(service: LocateService, ids: list[str], spots: dict, rng: random.Random, now: float) -> None:
    """A second of readings: every device somewhere in the house, heard by the scanners near it (new windows)."""
    for dev in ids:
        x, y = rng.uniform(0, 16), rng.uniform(0, 12)
        for scanner, (sx, sy) in spots.items():
            rssi = -45 - 25 * math.log10(max(1.0, math.hypot(x - sx, y - sy))) + rng.gauss(0, 4)
            if rssi > -92 and rng.random() > 0.15:
                service._trackers[dev].add(now, scanner, round(rssi))


async def test_the_room_estimate_of_a_busy_house_is_timed(hass: HomeAssistant, capsys) -> None:
    """#370: 4 learned devices x 12 rooms x 120 samples and 5 devices that use the pooled samples, every window new.
    Prints the time per estimate; fails only far above it (the test harness is slow and shared)."""
    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    ids, spots, rng = _busy_house(service)
    now = time.time()
    took = []
    for tick in range(21):
        _hear_everyone(service, ids, spots, rng, now + tick)
        start = time.perf_counter()
        service._estimate(now + tick)
        took.append(time.perf_counter() - start)
    # the first estimate also builds the pool and the room middles (again only when the learning changes)
    first, took = took[0], sorted(took[1:])
    with capsys.disabled():
        print(
            f"\nroom estimate, 9 devices (4 learned x 12 rooms x 120 samples, 5 on the pool): first {first * 1000:.1f}"
            f" ms, then median {took[10] * 1000:.1f} ms, slowest {took[-1] * 1000:.1f} ms per tick"
        )
    assert all(service.state[d]["room"] for d in ids)
    # 93 ms a tick before #370 on the machine it was written on; generous for a slow, shared test runner
    assert took[10] < 0.05


async def test_the_pool_is_built_once_per_estimate_and_capped(hass: HomeAssistant, monkeypatch) -> None:
    """#370: the devices that use the pooled samples share one build per estimate; a room keeps at most
    MAX_SAMPLES_PER_ROOM of them, the newest of each device in turn."""
    from custom_components.home_3d.locate.service import MAX_SAMPLES_PER_ROOM

    await _setup(hass)
    service: LocateService = hass.data[DATA_LOCATE]
    ids, _spots, _rng = _busy_house(service)
    pooled = service.pooled()
    assert all(len(v) == MAX_SAMPLES_PER_ROOM for v in pooled.samples.values())
    newest = [service.fingerprints[d].samples["room0"][-1] for d in ids[:4]]
    assert all(any(v is n for v in pooled.samples["room0"]) for n in newest)
    oldest = [service.fingerprints[d].samples["room0"][0] for d in ids[:4]]
    assert not any(any(v is o for v in pooled.samples["room0"]) for o in oldest)
    # a small pool is all the samples, in order
    service.fingerprints = {
        "a": Fingerprints({"kitchen": [{"s1": -60.0}]}),
        "b": Fingerprints({"kitchen": [{"s1": -61.0}]}),
    }
    assert service.pooled().samples["kitchen"] == [{"s1": -60.0}, {"s1": -61.0}]

    service.fingerprints = {}
    ids, spots, rng = _busy_house(service)
    builds = 0
    real = LocateService.pooled

    def counting(self):
        nonlocal builds
        builds += 1
        return real(self)

    monkeypatch.setattr(LocateService, "pooled", counting)
    now = time.time()
    _hear_everyone(service, ids, spots, rng, now)
    service._estimate(now)
    assert builds == 1


async def test_a_zone_of_their_own_at_the_house_counts_as_home(hass: HomeAssistant) -> None:
    """A person in a zone that touches zone.home (a "Garden") is home; one in a far zone or not_home is away (#445)."""
    hass.states.async_set("zone.home", "0", {"latitude": 52.5, "longitude": 13.4, "radius": 100})
    hass.states.async_set(
        "zone.garden", "1", {"friendly_name": "Garden", "latitude": 52.5003, "longitude": 13.4002, "radius": 15}
    )
    hass.states.async_set(
        "zone.work", "0", {"friendly_name": "Work", "latitude": 52.6, "longitude": 13.5, "radius": 100}
    )
    assert not _away(hass, "home")
    assert not _away(hass, "unknown")
    assert not _away(hass, "Garden")
    assert _away(hass, "Work")
    assert _away(hass, "not_home")
    assert _away(hass, "Nowhere")
