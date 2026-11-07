"""Setup, websocket and removal tests."""

from __future__ import annotations

import copy
import hashlib
from pathlib import Path
from unittest.mock import patch

from homeassistant import config_entries
from homeassistant.config_entries import ConfigEntryState
from homeassistant.core import HomeAssistant
from homeassistant.data_entry_flow import FlowResultType
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.home_3d.const import (
    DATA_EDITORS,
    DATA_PACK_UPDATES,
    DOMAIN,
    SIGNAL_BUILDING_UPDATED,
    STORAGE_KEY_BUILDING,
    STORAGE_KEY_HISTORY,
    STORAGE_KEY_IMAGES,
)
from custom_components.home_3d.locate.service import DATA_LOCATE, LocateService
from custom_components.home_3d.pack_updates import PackUpdates

BUILDING = {
    "version": 1,
    "settings": {"wall_exterior": 0.24, "wall_interior": 0.12, "grid": 0.05},
    "floors": [
        {
            "id": "f1",
            "name": "Ground floor",
            "elevation": 0,
            "height": 2.5,
            "cut_height": 1.15,
            "rooms": [
                {
                    "id": "r1",
                    "name": "Living",
                    "area_id": None,
                    "points": [[0, 0], [4, 0], [4, 3], [0, 3]],
                    "floor_material": "wood",
                }
            ],
            "openings": [],
            "furniture": [],
            "placements": [],
            "background": {"image_id": "img1", "x": 0, "z": 0, "width": 10, "opacity": 0.5},
        }
    ],
}
IMAGE = "data:image/png;base64,iVBORw0KGgo="


async def _setup(hass: HomeAssistant) -> MockConfigEntry:
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return entry


async def test_config_flow_creates_single_entry(hass: HomeAssistant) -> None:
    result = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert result["type"] is FlowResultType.FORM
    result = await hass.config_entries.flow.async_configure(result["flow_id"], {})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    await hass.async_block_till_done()
    again = await hass.config_entries.flow.async_init(DOMAIN, context={"source": config_entries.SOURCE_USER})
    assert again["type"] is FlowResultType.ABORT


async def test_save_and_get_building(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)

    await client.send_json_auto_id({"type": "home_3d/building/subscribe"})
    sub = await client.receive_json()
    assert sub["success"]
    # the current revision comes once at the start (#149)
    assert (await client.receive_json())["event"] == {"revision": 0, "home_id": "home"}

    await client.send_json_auto_id({"type": "home_3d/building/save", "building": BUILDING})
    event = await client.receive_json()
    result = await client.receive_json()
    if "event" in result:
        event, result = result, event
    assert result["success"]
    assert result["result"]["revision"] == 1
    assert event["event"] == {"revision": 1, "home_id": "home"}

    await client.send_json_auto_id({"type": "home_3d/building/get"})
    got = await client.receive_json()
    assert got["result"]["revision"] == 1
    assert got["result"]["building"]["floors"][0]["rooms"][0]["name"] == "Living"
    assert got["result"]["version"]


async def test_opening_fields_get_defaults(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    building = copy.deepcopy(BUILDING)
    opening = {
        "id": "o1",
        "room_id": "r1",
        "edge": 0,
        "offset": 2,
        "width": 1.2,
        "type": "window",
        "sill": 0.9,
        "height": 1.3,
    }
    building["floors"][0]["openings"] = [
        opening,
        {**opening, "id": "o2", "hinge": "right", "cover": "cover.x", "contact": "none"},
    ]
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": building})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    got = (await client.receive_json())["result"]["building"]["floors"][0]["openings"]
    assert got[0] == {
        **opening,
        "hinge": "left",
        "leaves": 1,
        "swing": "in",
        "cover": None,
        "contact": None,
        "contact2": None,
        "tilt": None,
        "sensor": None,
        "sensor2": None,
        "tilt2": None,
        "style": None,
        "sidelight_hinge": False,
        "sidelight_width": None,
        "sidelight_width2": None,
        "position": None,
        "position_inverted": False,
        "tilt_angle": None,
        "tilt_max": None,
        "tilt_offset": None,
        "tilt_invert": False,
        "contact_invert": False,
        "rain_ignore": False,
        "well": True,
        "well_rim": None,
        "shut": False,
        "open_angle": None,
        "wall": None,
        "mark": None,
        "confirm": False,
        "sill_board": "auto",
    }
    assert got[1]["hinge"] == "right" and got[1]["cover"] == "cover.x" and got[1]["contact"] == "none"

    double = {**opening, "id": "o3", "sill": 0, "leaves": 2, "contact2": "binary_sensor.b"}
    building["floors"][0]["openings"] = [double, {**opening, "id": "o4", "type": "door", "swing": "out"}]
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": building})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    got = (await client.receive_json())["result"]["building"]["floors"][0]["openings"]
    assert got[0]["leaves"] == 2 and got[0]["contact2"] == "binary_sensor.b"
    assert got[1]["swing"] == "out"

    # an opening in a free wall keeps the wall's id
    building["floors"][0]["walls"] = [{"id": "fw1", "a": [1, 0], "b": [1, 2]}]
    building["floors"][0]["openings"] = [{**opening, "id": "o5", "type": "door", "wall": "fw1", "offset": 1}]
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": building})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    got = (await client.receive_json())["result"]["building"]["floors"][0]["openings"]
    assert got[0]["wall"] == "fw1"

    building["floors"][0]["openings"] = [{**opening, "leaves": 3}]
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": building})
    assert not (await client.receive_json())["success"]


async def test_furniture_links_default_to_automatic(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    building = copy.deepcopy(BUILDING)
    item = {
        "id": "m1",
        "type": "tv_board",
        "x": 1,
        "z": 1,
        "rotation": 0,
        "w": 1.8,
        "d": 0.4,
        "h": 0.5,
        "variant": None,
    }
    building["floors"][0]["furniture"] = [item, {**item, "id": "m2", "entity": "media_player.tv", "power": "none"}]
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": building})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    got = (await client.receive_json())["result"]["building"]["floors"][0]["furniture"]
    assert (got[0]["entity"], got[0]["power"]) == (None, None)
    assert (got[1]["entity"], got[1]["power"]) == ("media_player.tv", "none")


async def test_screen_pictures_keep_their_images(hass: HomeAssistant, hass_ws_client) -> None:
    """Images used by screen picture rules are not dropped as unused when the building is saved."""
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/image/set", "image_id": "pic1", "data": IMAGE})
    assert (await client.receive_json())["success"]
    building = copy.deepcopy(BUILDING)
    item = {
        "id": "m1",
        "type": "tv_wall",
        "x": 1,
        "z": 1,
        "rotation": 0,
        "w": 1.4,
        "d": 0.1,
        "h": 0.8,
        "variant": None,
        "pictures": [
            {"entity": "binary_sensor.cat", "state": "on", "image": "pic1"},
            {"entity": "sun.sun", "state": "*", "image": "https://x/y.png"},
        ],
    }
    building["floors"][0]["furniture"] = [item]
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": building})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/image/get", "image_id": "pic1"})
    assert (await client.receive_json())["result"]["data"] == IMAGE
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    got = (await client.receive_json())["result"]["building"]["floors"][0]["furniture"][0]
    assert [r["image"] for r in got["pictures"]] == ["pic1", "https://x/y.png"]


async def test_placement_mount_defaults_to_none(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    building = copy.deepcopy(BUILDING)
    # lights kept as device pins on purpose (others become lamps, #165)
    building["floors"][0]["placements"] = [
        {"entity_id": "light.a", "x": 1, "z": 1, "y": None, "pin": True},
        {"entity_id": "light.b", "x": 2, "z": 1, "y": None, "mount": "floor", "pin": True},
    ]
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": building})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    got = (await client.receive_json())["result"]["building"]["floors"][0]["placements"]
    assert [p["mount"] for p in got] == [None, "floor"]


async def test_energy_and_presence_get_defaults(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": BUILDING})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    got = (await client.receive_json())["result"]["building"]
    assert got["energy"]["meter"] is None and got["energy"]["grid_invert"] is False
    assert got["presence"] == []

    building = copy.deepcopy(BUILDING)
    building["energy"] = {"meter": {"floor_id": "f1", "x": 1, "z": 2}, "grid": "sensor.grid"}
    building["presence"] = [{"person": "person.mia", "sensor": "sensor.mia_area"}]
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": building})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    got = (await client.receive_json())["result"]["building"]
    assert got["energy"]["meter"] == {"floor_id": "f1", "x": 1, "z": 2}
    assert got["energy"]["grid"] == "sensor.grid" and got["energy"]["solar"] is None
    assert got["presence"] == [{"person": "person.mia", "sensor": "sensor.mia_area"}]


async def test_unknown_fields_from_newer_frontends_are_kept(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    building = copy.deepcopy(BUILDING)
    building["future_setting"] = {"a": 1}
    building["floors"][0]["rooms"][0]["ceiling_color"] = "#ffffff"
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": building})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    got = (await client.receive_json())["result"]["building"]
    assert got["future_setting"] == {"a": 1}
    assert got["floors"][0]["rooms"][0]["ceiling_color"] == "#ffffff"


async def test_restore_points(hass: HomeAssistant, hass_ws_client, hass_storage) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": BUILDING})
    assert (await client.receive_json())["success"]
    # an empty building is no restore point
    await client.send_json_auto_id({"type": "home_3d/history/list"})
    assert (await client.receive_json())["result"]["snapshots"] == []

    changed = copy.deepcopy(BUILDING)
    changed["floors"][0]["rooms"][0]["name"] = "Changed"
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": changed})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/history/list"})
    snapshots = (await client.receive_json())["result"]["snapshots"]
    assert len(snapshots) == 1 and snapshots[0]["rooms"] == 1

    await client.send_json_auto_id({"type": "home_3d/history/restore", "snapshot_id": snapshots[0]["id"]})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    got = (await client.receive_json())["result"]["building"]
    assert got["floors"][0]["rooms"][0]["name"] == "Living"
    # the state before restoring is a restore point as well
    await client.send_json_auto_id({"type": "home_3d/history/list"})
    assert len((await client.receive_json())["result"]["snapshots"]) == 2
    await hass.async_block_till_done()
    assert STORAGE_KEY_HISTORY in hass_storage


async def test_outdoor_roof_and_north_get_defaults(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    building = copy.deepcopy(BUILDING)
    building["floors"][0]["outdoor"] = [{"id": "o1", "type": "lawn", "points": [[0, 0], [1, 0], [1, 1]]}]
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": building})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    got = (await client.receive_json())["result"]["building"]
    assert got["settings"]["north"] == 0
    assert got["settings"]["roof"] == {
        "type": "none",
        "pitch": 35,
        "overhang": 0.4,
        "ridge": None,
        "sections": [],
        "solar": [],
        "strings": [],
        "windows": [],
        "hologram": None,
        "cables": [],
    }
    assert got["floors"][0]["outdoor"][0]["type"] == "lawn"
    assert got["floors"][0]["outdoor"][0]["slope"] == 0
    assert got["floors"][0]["outdoor"][0]["slope_dir"] == "x"
    assert got["floors"][0]["outdoor"][0]["cut"] is False
    assert got["floors"][0]["outdoor"][0]["above"] is False
    assert got["floors"][0]["outdoor"][0]["pool"] is None
    assert got["floors"][0]["ha_floor"] is None
    assert got["floors"][0]["rooms"][0]["panel"] == []

    # a height offset or slope set back to 0 arrives as None from the editor and still saves (#242)
    cleared = copy.deepcopy(building)
    cleared["floors"][0]["outdoor"][0].update({"type": "pergola", "offset": None, "slope": None})
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": cleared})
    assert (await client.receive_json())["success"]

    # Pool module: an above-ground pool with its entities
    pool = copy.deepcopy(building)
    pool["floors"][0]["outdoor"][0].update(
        {
            "type": "pool",
            "above": True,
            "height": 1.2,
            "pool": {"temperature": "sensor.pool_temp", "heater": "climate.pool", "cover": "none"},
        }
    )
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": pool})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    saved = (await client.receive_json())["result"]["building"]["floors"][0]["outdoor"][0]
    assert saved["above"] is True
    assert saved["pool"]["heater"] == "climate.pool"

    # Pool module: ports and pipes on the pool, the six-way valve and a closed ball valve on the devices
    plumbing = copy.deepcopy(pool)
    plumbing["floors"][0]["outdoor"][0]["pool"].update(
        {
            "ports": [{"id": "sk", "kind": "skimmer", "x": 0.5, "z": 0}, {"id": "in", "kind": "inlet", "x": 1, "z": 1}],
            "pipes": [
                {
                    "id": "p1",
                    "from": "port:sk",
                    "to": "port:in",
                    "floor_id": "ground",
                    "points": [[2, 2]],
                    "height": 0.4,
                },
                # laid on a wall: a height per point, a closed ball valve, ending at a T-piece
                {
                    "id": "p2",
                    "from": "port:sk",
                    "to": "joint:t1",
                    "floor_id": "ground",
                    "points": [[3, 0], [3, 0], [4, 0]],
                    "heights": [-0.3, 0.8, None],
                    "fittings": [{"id": "v1", "kind": "valve", "at": 1.5, "open": False}],
                },
            ],
            "joints": [
                {"id": "t1", "x": 4, "z": 0, "y": 0.8},
                {
                    "id": "h1",
                    "kind": "wall",
                    "name": "Inlet hole",
                    "x": 1,
                    "z": 0,
                    "y": 0.4,
                    "nx": 0,
                    "nz": 1,
                    "depth": 0.3,
                },
            ],
        }
    )
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": plumbing})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    got_pool = (await client.receive_json())["result"]["building"]["floors"][0]["outdoor"][0]["pool"]
    assert got_pool["pipes"][0]["points"] == [[2, 2]]
    assert got_pool["pipes"][1]["heights"] == [-0.3, 0.8, None]
    assert got_pool["pipes"][1]["fittings"][0]["open"] is False
    assert got_pool["joints"][0]["y"] == 0.8
    assert got_pool["joints"][1]["name"] == "Inlet hole"
    assert got_pool["ports"][0]["kind"] == "skimmer"

    bad = copy.deepcopy(building)
    bad["floors"][0]["outdoor"][0]["type"] = "volcano"
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": bad})
    assert not (await client.receive_json())["success"]


async def test_invalid_building_is_rejected(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    bad = copy.deepcopy(BUILDING)
    bad["floors"][0]["rooms"][0]["points"] = [[0, 0], [1, 1]]
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": bad})
    result = await client.receive_json()
    assert not result["success"]
    assert result["error"]["code"] == "invalid_format"


async def test_changes_require_admin(hass: HomeAssistant, hass_ws_client, hass_read_only_access_token) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass, hass_read_only_access_token)
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": BUILDING})
    result = await client.receive_json()
    assert not result["success"]
    assert result["error"]["code"] == "unauthorized"
    await client.send_json_auto_id({"type": "home_3d/image/set", "image_id": "img1", "data": IMAGE})
    result = await client.receive_json()
    assert result["error"]["code"] == "unauthorized"
    # reading is allowed
    await client.send_json_auto_id({"type": "home_3d/building/get"})
    result = await client.receive_json()
    assert result["success"]


async def test_images(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/image/set", "image_id": "img1", "data": IMAGE})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/image/get", "image_id": "img1"})
    assert (await client.receive_json())["result"]["data"] == IMAGE
    await client.send_json_auto_id({"type": "home_3d/image/set", "image_id": "img2", "data": "not an image"})
    assert not (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/image/delete", "image_id": "img1"})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/image/get", "image_id": "img1"})
    assert (await client.receive_json())["error"]["code"] == "not_found"


async def test_unused_images_are_dropped_on_load(hass: HomeAssistant, hass_storage) -> None:
    hass_storage[STORAGE_KEY_BUILDING] = {
        "version": 1,
        "key": STORAGE_KEY_BUILDING,
        "data": {"revision": 3, "building": BUILDING},
    }
    hass_storage[STORAGE_KEY_IMAGES] = {
        "version": 1,
        "key": STORAGE_KEY_IMAGES,
        "data": {"images": {"img1": IMAGE, "old": IMAGE}},
    }
    await _setup(hass)
    data = hass.data[DOMAIN]
    assert data.revision == 3
    assert data.get_image("img1") == IMAGE
    assert data.get_image("old") is None


async def test_remove_entry_keeps_the_stores(hass: HomeAssistant, hass_ws_client, hass_storage) -> None:
    """Removing the integration must never delete the plan (re-adding it finds everything again)."""
    entry = await _setup(hass)
    client = await hass_ws_client(hass)
    await client.send_json_auto_id({"type": "home_3d/building/save", "building": BUILDING})
    await client.receive_json()
    await client.send_json_auto_id({"type": "home_3d/image/set", "image_id": "img1", "data": IMAGE})
    await client.receive_json()
    await hass.async_block_till_done()
    assert STORAGE_KEY_BUILDING in hass_storage
    assert STORAGE_KEY_IMAGES in hass_storage

    assert await hass.config_entries.async_remove(entry.entry_id)
    await hass.async_block_till_done()
    assert STORAGE_KEY_BUILDING in hass_storage
    assert STORAGE_KEY_IMAGES in hass_storage
    assert DOMAIN not in hass.data


BUILD = "0123456789ab"


async def test_panel_and_card_are_registered_and_removed(hass: HomeAssistant, mock_frontend) -> None:
    with patch("custom_components.home_3d.read_build", return_value=BUILD):
        entry = await _setup(hass)
    mock_frontend["register"].assert_awaited_once()
    assert mock_frontend["register"].await_args.kwargs["frontend_url_path"] == "home_3d"
    url = mock_frontend["add_js"].call_args.args[1]
    # one URL for every build (#218, #357): the extra module and the panel's module_url are the start file, which picks
    # the build; a page the service worker kept from before an update names the same module
    assert url == "/api/home_3d/static/home-3d.js"
    assert mock_frontend["register"].await_args.kwargs["module_url"] == url

    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    mock_frontend["remove_panel"].assert_called_once_with(hass, "home_3d", warn_if_unknown=False)
    mock_frontend["remove_js"].assert_called_once_with(hass, url)


async def test_the_card_resource_and_the_loader_keep_one_url_for_every_build(
    hass: HomeAssistant, mock_frontend
) -> None:
    """#357 (replaces #340's versioned URLs): the dashboard resource is the loader's plain URL, with a build file and
    without one, so a dashboard opened before the resource is updated after a restart names the same loader."""
    with (
        patch("custom_components.home_3d.read_build", return_value=BUILD),
        patch("custom_components.home_3d.async_schedule_card_resource") as schedule,
    ):
        await _setup(hass)
    assert schedule.call_args.args[1] == "/api/home_3d/static/home-3d-loader.js"
    with (
        patch("custom_components.home_3d.read_build", return_value=None),
        patch("custom_components.home_3d.async_schedule_card_resource") as schedule,
    ):
        assert await hass.config_entries.async_reload(hass.config_entries.async_entries(DOMAIN)[0].entry_id)
        await hass.async_block_till_done()
    assert schedule.call_args.args[1] == "/api/home_3d/static/home-3d-loader.js"
    assert mock_frontend["register"].await_args.kwargs["module_url"] == "/api/home_3d/static/home-3d.js"


def _frontend_folder(tmp_path: Path, build: str) -> Path:
    """A frontend folder with a start file, the app of `build` and its build.json."""
    (tmp_path / "home-3d.js").write_text('await import("home-3d-app.js");', encoding="utf-8")
    (tmp_path / "home-3d-app.js").write_text(f'const FRONTEND_BUILD = "{build}";', encoding="utf-8")
    (tmp_path / "build.json").write_text(f'{{"build": "{build}"}}', encoding="utf-8")
    return tmp_path


async def test_only_the_app_under_the_current_build_is_kept(hass: HomeAssistant, hass_client, tmp_path: Path) -> None:
    """#340's proxy case with #357: the one URL a cache may keep for long is the app under the current build id, which
    only the start file names after asking which build is served. A proxy that turns no-cache into hours can then keep
    nothing that outlives an update: the start file and the loader are the same for every build, and the app's URL
    changes with it. Chunks stay immutable (test_frontend_files_named_by_their_content_are_kept)."""
    folder = _frontend_folder(tmp_path, BUILD)
    await _setup(hass)
    client = await hass_client()
    immutable = "public, max-age=31536000, immutable"
    with (
        patch("custom_components.home_3d.FRONTEND_DIR", folder),
        patch("custom_components.home_3d.read_build", return_value=BUILD),
    ):
        res = await client.get(f"/api/home_3d/static/home-3d-app.js?v={BUILD}")
        assert res.status == 200
        assert res.headers["Cache-Control"] == immutable
        # the app without the id or with an old one: the current file, checked on each load
        for other in ("/api/home_3d/static/home-3d-app.js", "/api/home_3d/static/home-3d-app.js?v=ffffffffffff"):
            res = await client.get(other)
            assert res.status == 200
            assert res.headers["Cache-Control"] == "no-cache"
        # the start file and the loader are never kept, whatever `v` an old page or resource puts on them
        for start in ("home-3d.js", f"home-3d.js?v={BUILD}", "home-3d-loader.js", f"home-3d-loader.js?v={BUILD}"):
            assert (await client.get(f"/api/home_3d/static/{start}")).headers["Cache-Control"] == "no-cache", start
        assert (await client.get(f"/home_3d_static/home-3d-app.js?v={BUILD}")).status == 200
        # #360: a failed import is tried again with `retry=<n>`: kept like the URL without it (the file is that build),
        # and checked on each load without a build id or with an old one; the start file's retry is never kept
        res = await client.get(f"/api/home_3d/static/home-3d-app.js?v={BUILD}&retry=1")
        assert res.status == 200
        assert res.headers["Cache-Control"] == immutable
        for other in ("home-3d-app.js?retry=1", "home-3d-app.js?v=ffffffffffff&retry=2", "home-3d.js?retry=3"):
            res = await client.get(f"/api/home_3d/static/{other}")
            assert res.status == 200
            assert res.headers["Cache-Control"] == "no-cache", other
        # a deploy that wrote build.json before the app: the old app is not kept under the new build's URL
        (folder / "home-3d-app.js").write_text('const FRONTEND_BUILD = "ffffffffffff";', encoding="utf-8")
        res = await client.get(f"/api/home_3d/static/home-3d-app.js?v={BUILD}")
        assert res.headers["Cache-Control"] == "no-cache"
        res = await client.get(f"/api/home_3d/static/home-3d-app.js?v={BUILD}&retry=1")
        assert res.headers["Cache-Control"] == "no-cache"


async def test_a_page_naming_the_previous_build_gets_the_current_one(
    hass: HomeAssistant, hass_client, tmp_path: Path
) -> None:
    """#357: a page Home Assistant's service worker kept, or a dashboard opened before the resource was updated, names
    the previous build's entry and loader (`?v=<old>`). Both are answered with the start file and the loader of now
    (never kept), the loader imports the start file, and build.json names the current build: so the next load imports
    `home-3d-app.js?v=<current>`, the current build's code."""
    folder = _frontend_folder(tmp_path, BUILD)
    await _setup(hass)
    client = await hass_client()
    old = "ffffffffffff"
    with (
        patch("custom_components.home_3d.FRONTEND_DIR", folder),
        patch("custom_components.home_3d.read_build", return_value=BUILD),
    ):
        entry = await client.get(f"/api/home_3d/static/home-3d.js?v={old}")
        assert entry.status == 200
        assert entry.headers["Cache-Control"] == "no-cache"
        assert await entry.text() == (folder / "home-3d.js").read_text(encoding="utf-8")
        loader = await client.get(f"/api/home_3d/static/home-3d-loader.js?v={old}")
        assert loader.headers["Cache-Control"] == "no-cache"
        assert 'const url = "/api/home_3d/static/home-3d.js";' in await loader.text()
        build = await client.get(f"/api/home_3d/static/build.json?t={old}")
        assert build.headers["Cache-Control"] == "no-cache"
        assert (await build.json())["build"] == BUILD
        app = await client.get(f"/api/home_3d/static/home-3d-app.js?v={BUILD}")
        assert f'"{BUILD}"' in await app.text()


async def test_the_bundle_keeps_its_url_across_a_reload(hass: HomeAssistant, mock_frontend) -> None:
    """A page Home Assistant's service worker kept from before names the same module as the panel (#218): the URL
    does not change with a reload, a rebuild or an update."""
    entry = await _setup(hass)
    first = mock_frontend["add_js"].call_args.args[1]
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    assert mock_frontend["add_js"].call_args.args[1] == first
    assert mock_frontend["register"].await_args.kwargs["module_url"] == first


async def test_frontend_files_are_served_without_caching(hass: HomeAssistant, hass_client) -> None:
    """A reload shows a new bundle: no-cache (and a 304 when unchanged); nothing outside the folder."""
    await _setup(hass)
    client = await hass_client()
    res = await client.get("/api/home_3d/static/home-3d.js")
    assert res.status == 200
    assert res.headers["Cache-Control"] == "no-cache"
    etag = res.headers.get("ETag")
    assert etag
    again = await client.get("/api/home_3d/static/home-3d.js", headers={"If-None-Match": etag})
    assert again.status == 304
    assert (await client.get("/api/home_3d/static/../manifest.json")).status in (403, 404)
    assert (await client.get("/api/home_3d/static/nothing.js")).status == 404
    # the path before #218 still works, for a page or a dashboard resource that names it
    assert (await client.get("/home_3d_static/home-3d.js?v=1")).status == 200
    assert (await client.get("/home_3d_static/nothing.js")).status == 404
    # the card loader comes from our own path, nothing is written into the user's www folder
    with patch("custom_components.home_3d.read_build", return_value=None):
        loader = await client.get("/api/home_3d/static/home-3d-loader.js")
    assert loader.status == 200
    text = await loader.text()
    assert 'const tag = "home-3d-card";' in text
    assert 'const url = "/api/home_3d/static/home-3d.js";' in text
    assert not (Path(hass.config.path("www")) / "home_3d").exists()


async def test_frontend_files_named_by_their_content_are_kept(hass: HomeAssistant, hass_client) -> None:
    """Run 6 speed: a chunk (its name holds its content hash) and a bundle asked for by its content hash are kept by
    the browser for a year; the same bundle with any other `v`, the main bundle and the loader are checked each load."""
    await _setup(hass)
    client = await hass_client()
    frontend_dir = Path(__file__).parent.parent / "custom_components" / "home_3d" / "frontend"
    chunk = next(f.name for f in sorted(frontend_dir.glob("home-3d-chunk-*.js")))
    res = await client.get(f"/api/home_3d/static/{chunk}")
    assert res.status == 200
    assert res.headers["Cache-Control"] == "public, max-age=31536000, immutable"
    bundle = frontend_dir / "home-3d-3d.js"
    content = hashlib.sha256(bundle.read_bytes()).hexdigest()[:12]
    res = await client.get(f"/api/home_3d/static/home-3d-3d.js?v={content}")
    assert res.headers["Cache-Control"] == "public, max-age=31536000, immutable"
    # an older hash (a page from before an update) gets the new file, checked again next time
    other = "0" * 12 if content != "0" * 12 else "1" * 12
    assert (await client.get(f"/api/home_3d/static/home-3d-3d.js?v={other}")).headers["Cache-Control"] == "no-cache"
    assert (await client.get("/api/home_3d/static/home-3d-3d.js")).headers["Cache-Control"] == "no-cache"
    assert (await client.get("/api/home_3d/static/home-3d.js?v=0.2.1")).headers["Cache-Control"] == "no-cache"
    assert (await client.get("/api/home_3d/static/home-3d-loader.js")).headers["Cache-Control"] == "no-cache"
    # a chunk name outside the folder is still not served
    assert (await client.get("/api/home_3d/static/home-3d-chunk-ABCDEFGH.js")).status == 404


def _sidebar(register) -> tuple[str | None, str | None]:
    kwargs = register.await_args.kwargs
    return kwargs["sidebar_title"], kwargs["sidebar_icon"]


async def test_sidebar_entry_is_shown_by_default(hass: HomeAssistant, mock_frontend) -> None:
    await _setup(hass)
    assert _sidebar(mock_frontend["register"]) == ("Home 3D", "mdi:floor-plan")


async def test_options_flow_sets_show_in_sidebar(hass: HomeAssistant, mock_frontend) -> None:
    entry = await _setup(hass)
    result = await hass.config_entries.options.async_init(entry.entry_id)
    assert result["type"] is FlowResultType.FORM
    # the form starts on the current value (on by default)
    assert result["data_schema"]({})["show_in_sidebar"] is True
    result = await hass.config_entries.options.async_configure(result["flow_id"], {"show_in_sidebar": False})
    assert result["type"] is FlowResultType.CREATE_ENTRY
    # the pictures of restore points are kept 90 days unless set otherwise (#154)
    assert entry.options == {"show_in_sidebar": False, "restore_picture_days": 90}


async def test_panel_registers_without_sidebar_entry_when_option_is_off(hass: HomeAssistant, mock_frontend) -> None:
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={}, options={"show_in_sidebar": False})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    register = mock_frontend["register"]
    register.assert_awaited_once()
    # still a registered panel (the URL works), just without a sidebar title and icon
    assert register.await_args.kwargs["frontend_url_path"] == "home_3d"
    assert _sidebar(register) == (None, None)


async def test_sidebar_entry_toggles_without_a_restart(hass: HomeAssistant, mock_frontend) -> None:
    entry = await _setup(hass)
    register, remove_panel = mock_frontend["register"], mock_frontend["remove_panel"]
    assert register.await_count == 1

    hass.config_entries.async_update_entry(entry, options={"show_in_sidebar": False})
    await hass.async_block_till_done()
    # the panel is replaced in place: same URL, no sidebar entry; the entry is not reloaded
    remove_panel.assert_called_once_with(hass, "home_3d", warn_if_unknown=False)
    assert register.await_count == 2
    assert register.await_args.kwargs["frontend_url_path"] == "home_3d"
    assert _sidebar(register) == (None, None)
    mock_frontend["add_js"].assert_called_once()
    mock_frontend["remove_js"].assert_not_called()
    assert hass.data[DOMAIN] is not None

    hass.config_entries.async_update_entry(entry, options={"show_in_sidebar": True})
    await hass.async_block_till_done()
    assert register.await_count == 3
    assert _sidebar(register) == ("Home 3D", "mdi:floor-plan")
    mock_frontend["add_js"].assert_called_once()


async def test_card_and_static_files_work_with_sidebar_entry_off(
    hass: HomeAssistant, hass_client, mock_frontend
) -> None:
    entry = await _setup(hass)
    hass.config_entries.async_update_entry(entry, options={"show_in_sidebar": False})
    await hass.async_block_till_done()
    client = await hass_client()
    assert (await client.get("/api/home_3d/static/home-3d.js")).status == 200
    # the dashboard card's resource loader is still served
    assert (await client.get("/api/home_3d/static/home-3d-loader.js")).status == 200


async def test_a_failed_setup_stops_what_it_started(hass: HomeAssistant, mock_frontend) -> None:
    """When a later step fails, the timers, listeners and data of the earlier ones are cleaned up (#190)."""
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    stopped: list[str] = []
    real_updates_stop, real_locate_stop = PackUpdates.stop, LocateService.stop

    def updates_stop(self) -> None:
        stopped.append("updates")
        real_updates_stop(self)

    def locate_stop(self) -> None:
        stopped.append("locate")
        real_locate_stop(self)

    with (
        patch("custom_components.home_3d.async_setup_voice", side_effect=RuntimeError("boom")),
        patch.object(PackUpdates, "stop", updates_stop),
        patch.object(LocateService, "stop", locate_stop),
    ):
        assert not await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()
    assert entry.state is ConfigEntryState.SETUP_ERROR
    assert set(stopped) == {"locate", "updates"}
    for key in (DOMAIN, DATA_PACK_UPDATES, DATA_EDITORS, DATA_LOCATE):
        assert key not in hass.data


async def test_reload_does_not_double_the_plan_listeners(hass: HomeAssistant, mock_frontend) -> None:
    """Each reload leaves exactly one listener for plan changes, and the old pack-check timer is gone (#190)."""
    entry = await _setup(hass)
    for _ in range(2):
        assert await hass.config_entries.async_reload(entry.entry_id)
        await hass.async_block_till_done()
    updates = hass.data[DATA_PACK_UPDATES]
    assert updates._unsub is not None or updates.settings["frequency"] == "off"
    locate = hass.data[DATA_LOCATE]
    calls: list[int] = []
    with patch.object(locate, "set_plan", lambda building: calls.append(1)):
        async_dispatcher_send(hass, SIGNAL_BUILDING_UPDATED, hass.data[DOMAIN].active_id, 99)
        await hass.async_block_till_done()
    assert calls == [1]
    # and after an unload nothing listens any more
    assert await hass.config_entries.async_unload(entry.entry_id)
    await hass.async_block_till_done()
    with patch.object(locate, "set_plan", lambda building: calls.append(1)):
        async_dispatcher_send(hass, SIGNAL_BUILDING_UPDATED, "default", 100)
        await hass.async_block_till_done()
    assert calls == [1]
    assert updates._unsub is None and updates._unsub_started is None
