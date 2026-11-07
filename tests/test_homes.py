"""Several homes per install (#53): each home keeps its own plan, revision, restore points and pictures."""

from __future__ import annotations

import copy

from homeassistant.core import HomeAssistant

from custom_components.home_3d.const import DOMAIN, STORAGE_KEY_BUILDING, STORAGE_KEY_HISTORY, STORAGE_KEY_IMAGES
from tests.test_init import BUILDING, IMAGE, _setup


async def _call(client, msg: dict) -> dict:
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def _ok(client, msg: dict) -> dict:
    result = await _call(client, msg)
    assert result["success"], result
    return result["result"]


def _named(name: str) -> dict:
    building = copy.deepcopy(BUILDING)
    building["floors"][0]["rooms"][0]["name"] = name
    return building


def _room(result: dict) -> str:
    return result["building"]["floors"][0]["rooms"][0]["name"]


async def test_an_install_from_before_homes_keeps_everything_as_its_first_home(
    hass: HomeAssistant, hass_ws_client, hass_storage
) -> None:
    """The stores as Home 3D wrote them before #53: one building, its restore points and pictures."""
    hass_storage[STORAGE_KEY_BUILDING] = {
        "version": 1,
        "minor_version": 2,
        "key": STORAGE_KEY_BUILDING,
        "data": {"revision": 49, "building": _named("Living")},
    }
    hass_storage[STORAGE_KEY_HISTORY] = {
        "version": 1,
        "key": STORAGE_KEY_HISTORY,
        "data": {
            "snapshots": [{"id": "snap1", "revision": 48, "saved_at": 1700000000.0, "building": _named("Earlier")}]
        },
    }
    hass_storage[STORAGE_KEY_IMAGES] = {"version": 1, "key": STORAGE_KEY_IMAGES, "data": {"images": {"img1": IMAGE}}}
    await _setup(hass)
    client = await hass_ws_client(hass)

    homes = await _ok(client, {"type": "home_3d/homes/list"})
    assert len(homes["homes"]) == 1
    first = homes["homes"][0]
    assert homes["active"] == first["id"]
    assert first["revision"] == 49

    for msg in ({}, {"home_id": first["id"]}):
        got = await _ok(client, {"type": "home_3d/building/get", **msg})
        assert got["revision"] == 49
        assert got["home_id"] == first["id"]
        assert _room(got) == "Living"
        history = await _ok(client, {"type": "home_3d/history/list", **msg})
        assert [s["id"] for s in history["snapshots"]] == ["snap1"]
        image = await _ok(client, {"type": "home_3d/image/get", "image_id": "img1", **msg})
        assert image["data"] == IMAGE

    # the old stores stay where they were: nothing is copied or rewritten on the way
    await hass.async_block_till_done()
    assert hass_storage[STORAGE_KEY_BUILDING]["data"]["revision"] == 49
    assert hass_storage[STORAGE_KEY_HISTORY]["data"]["snapshots"][0]["id"] == "snap1"
    assert hass_storage[STORAGE_KEY_IMAGES]["data"]["images"] == {"img1": IMAGE}
    assert hass.data[DOMAIN].revision == 49


async def test_an_editor_keeps_two_homes_apart(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    await _ok(client, {"type": "home_3d/building/save", "building": _named("Own living")})
    first = (await _ok(client, {"type": "home_3d/homes/list"}))["active"]

    created = await _ok(client, {"type": "home_3d/homes/create", "name": "Sample"})
    second = created["home"]["id"]
    assert created["home"]["name"] == "Sample" and created["home"]["revision"] == 0
    # a new home starts empty and does not become active
    assert created["active"] == first
    assert (await _ok(client, {"type": "home_3d/building/get", "home_id": second}))["building"]["floors"] == []

    for name in ("Sample living", "Sample lounge"):
        saved = await _ok(client, {"type": "home_3d/building/save", "home_id": second, "building": _named(name)})
    assert saved["revision"] == 2 and saved["home_id"] == second
    # the first home did not move
    got = await _ok(client, {"type": "home_3d/building/get"})
    assert (got["home_id"], got["revision"], _room(got)) == (first, 1, "Own living")

    # switch: the plain commands follow the active home, each home keeps its revision and history
    await _ok(client, {"type": "home_3d/homes/set_active", "home_id": second})
    got = await _ok(client, {"type": "home_3d/building/get"})
    assert (got["home_id"], got["revision"], _room(got)) == (second, 2, "Sample lounge")
    assert len((await _ok(client, {"type": "home_3d/history/list"}))["snapshots"]) == 1
    assert (await _ok(client, {"type": "home_3d/history/list", "home_id": first}))["snapshots"] == []
    await _ok(client, {"type": "home_3d/homes/set_active", "home_id": first})
    assert (await _ok(client, {"type": "home_3d/building/get"}))["revision"] == 1

    homes = await _ok(client, {"type": "home_3d/homes/list"})
    assert [(h["id"], h["revision"]) for h in homes["homes"]] == [(first, 1), (second, 2)]


async def test_a_named_home_is_shown_whichever_is_active(hass: HomeAssistant, hass_ws_client) -> None:
    """A card configured with a home id asks for that home; images are kept per home."""
    await _setup(hass)
    client = await hass_ws_client(hass)
    second = (await _ok(client, {"type": "home_3d/homes/create", "name": "Flat"}))["home"]["id"]
    await _ok(client, {"type": "home_3d/building/save", "home_id": second, "building": _named("Flat living")})
    await _ok(client, {"type": "home_3d/image/set", "home_id": second, "image_id": "img1", "data": IMAGE})

    got = await _ok(client, {"type": "home_3d/building/get", "home_id": second})
    assert _room(got) == "Flat living" and got["home_name"] == "Flat"
    assert (await _ok(client, {"type": "home_3d/image/get", "home_id": second, "image_id": "img1"}))["data"] == IMAGE
    # the active home has no such picture
    missing = await _call(client, {"type": "home_3d/image/get", "image_id": "img1"})
    assert missing["error"]["code"] == "not_found"
    unknown = await _call(client, {"type": "home_3d/building/get", "home_id": "nosuchhome"})
    assert unknown["error"]["code"] == "home_not_found"


async def test_a_subscription_follows_its_home(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    second = (await _ok(client, {"type": "home_3d/homes/create", "name": "Flat"}))["home"]["id"]
    watcher = await hass_ws_client(hass)
    await _ok(watcher, {"type": "home_3d/building/subscribe", "home_id": second})
    # the current revision comes once at the start (#149)
    assert (await watcher.receive_json())["event"] == {"revision": 0, "home_id": second}
    active = await hass_ws_client(hass)
    await _ok(active, {"type": "home_3d/building/subscribe"})
    assert (await active.receive_json())["event"]["revision"] == 0

    await _ok(client, {"type": "home_3d/building/save", "home_id": second, "building": _named("Flat")})
    assert (await watcher.receive_json())["event"] == {"revision": 1, "home_id": second}
    # another home becoming active is news for a view following the active home
    await _ok(client, {"type": "home_3d/homes/set_active", "home_id": second})
    assert (await active.receive_json())["event"] == {"revision": 1, "home_id": second}


async def test_homes_can_be_renamed_duplicated_and_deleted_but_not_the_last(
    hass: HomeAssistant, hass_ws_client, hass_storage
) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    first = (await _ok(client, {"type": "home_3d/homes/list"}))["active"]
    await _ok(client, {"type": "home_3d/building/save", "building": _named("Living")})
    await _ok(client, {"type": "home_3d/image/set", "image_id": "img1", "data": IMAGE})

    renamed = await _ok(client, {"type": "home_3d/homes/rename", "home_id": first, "name": "  Our house "})
    assert renamed["homes"][0]["name"] == "Our house"
    copy_ = (await _ok(client, {"type": "home_3d/homes/duplicate", "home_id": first, "name": "Trial"}))["home"]
    assert copy_["id"] != first and copy_["rooms"] == 1
    got = await _ok(client, {"type": "home_3d/building/get", "home_id": copy_["id"]})
    assert _room(got) == "Living"
    assert (await _ok(client, {"type": "home_3d/image/get", "home_id": copy_["id"], "image_id": "img1"}))["data"]

    # deleting the active home makes the one left active, and the last one stays
    left = await _ok(client, {"type": "home_3d/homes/delete", "home_id": first})
    assert left["active"] == copy_["id"] and len(left["homes"]) == 1
    await hass.async_block_till_done()
    assert STORAGE_KEY_BUILDING not in hass_storage
    last = await _call(client, {"type": "home_3d/homes/delete", "home_id": copy_["id"]})
    assert last["error"]["code"] == "last_home"
    gone = await _call(client, {"type": "home_3d/homes/rename", "home_id": first, "name": "x"})
    assert gone["error"]["code"] == "home_not_found"


async def test_homes_survive_a_restart(hass: HomeAssistant, hass_ws_client) -> None:
    entry = await _setup(hass)
    client = await hass_ws_client(hass)
    second = (await _ok(client, {"type": "home_3d/homes/create", "name": "Flat"}))["home"]["id"]
    await _ok(client, {"type": "home_3d/building/save", "home_id": second, "building": _named("Flat living")})
    await _ok(client, {"type": "home_3d/homes/set_active", "home_id": second})

    assert await hass.config_entries.async_reload(entry.entry_id)
    await hass.async_block_till_done()
    homes = await _ok(client, {"type": "home_3d/homes/list"})
    assert homes["active"] == second
    assert [h["name"] for h in homes["homes"]] == ["Home", "Flat"]
    got = await _ok(client, {"type": "home_3d/building/get"})
    assert (got["revision"], _room(got)) == (1, "Flat living")


async def test_a_home_can_be_made_from_a_given_building(hass: HomeAssistant) -> None:
    """The internal step a sample home (#54) is loaded with."""
    await _setup(hass)
    data = hass.data[DOMAIN]
    home = await data.async_create_home("Sample", _named("Sample living"), {"img1": IMAGE})
    assert home.revision == 1
    assert home.building["floors"][0]["rooms"][0]["name"] == "Sample living"
    assert home.get_image("img1") == IMAGE
    assert data.active_id != home.id


async def test_only_editors_change_homes(hass: HomeAssistant, hass_ws_client, hass_read_only_access_token) -> None:
    await _setup(hass)
    admin = await hass_ws_client(hass)
    second = (await _ok(admin, {"type": "home_3d/homes/create", "name": "Flat"}))["home"]["id"]
    viewer = await hass_ws_client(hass, hass_read_only_access_token)
    for msg in (
        {"type": "home_3d/homes/list"},
        {"type": "home_3d/homes/create", "name": "Mine"},
        {"type": "home_3d/homes/rename", "home_id": second, "name": "Mine"},
        {"type": "home_3d/homes/duplicate", "home_id": second, "name": "Mine"},
        {"type": "home_3d/homes/delete", "home_id": second},
        {"type": "home_3d/homes/set_active", "home_id": second},
        {"type": "home_3d/building/save", "home_id": second, "building": BUILDING},
        {"type": "home_3d/image/set", "home_id": second, "image_id": "img1", "data": IMAGE},
        {"type": "home_3d/history/list", "home_id": second},
    ):
        result = await _call(viewer, msg)
        assert not result["success"], msg
        assert result["error"]["code"] == "unauthorized", msg
    # nothing changed, and a viewer still sees a card's named home
    homes = await _ok(admin, {"type": "home_3d/homes/list"})
    assert [h["name"] for h in homes["homes"]] == ["Home", "Flat"] and homes["active"] != second
    assert (await _ok(viewer, {"type": "home_3d/building/get", "home_id": second}))["home_id"] == second


async def test_a_backup_carries_every_home(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    first = (await _ok(client, {"type": "home_3d/homes/list"}))["active"]
    await _ok(client, {"type": "home_3d/building/save", "building": _named("Own living")})
    second = (await _ok(client, {"type": "home_3d/homes/create", "name": "Flat"}))["home"]["id"]
    await _ok(client, {"type": "home_3d/building/save", "home_id": second, "building": _named("Flat living")})

    backup = await _ok(client, {"type": "home_3d/backup/export"})
    assert backup["active"] == first
    assert [(h["id"], h["name"], _room(h)) for h in backup["homes"]] == [
        (first, "Home", "Own living"),
        (second, "Flat", "Flat living"),
    ]
    # the plan of the active home stays at the top, for older versions reading the file
    assert _room(backup) == "Own living"

    # change one, remove the other, then restore: both come back as they were
    await _ok(client, {"type": "home_3d/building/save", "home_id": second, "building": _named("Changed")})
    await _ok(client, {"type": "home_3d/homes/set_active", "home_id": second})
    await _ok(client, {"type": "home_3d/homes/delete", "home_id": first})
    restore = {"type": "home_3d/backup/import", "building": backup["building"], "packs": [], "homes": backup["homes"]}
    restored = await _ok(client, {**restore, "active": backup["active"]})
    assert {h["id"] for h in restored["homes"]} == {first, second}
    homes = await _ok(client, {"type": "home_3d/homes/list"})
    assert homes["active"] == first
    assert _room(await _ok(client, {"type": "home_3d/building/get", "home_id": first})) == "Own living"
    assert _room(await _ok(client, {"type": "home_3d/building/get", "home_id": second})) == "Flat living"
    # a home that was there keeps its history: the state before the restore is a restore point
    assert (await _ok(client, {"type": "home_3d/history/list", "home_id": second}))["snapshots"]

    # one broken home is skipped and listed; the other homes still restore (#380)
    broken = [*backup["homes"], {"id": "bad", "name": "Bad", "building": {"version": 99}}]
    result = await _ok(client, {**restore, "homes": broken})
    assert result["skipped"] == [{"id": "bad", "reason": "home_unreadable"}]
    assert {h["id"] for h in (await _ok(client, {"type": "home_3d/homes/list"}))["homes"]} == {first, second}

    # one home at a time and without the plan at the top: how the panel keeps each message small
    await _ok(client, {"type": "home_3d/building/save", "home_id": second, "building": _named("Changed")})
    one = await _ok(client, {"type": "home_3d/backup/import", "packs": [], "homes": [backup["homes"][1]]})
    assert one["home_id"] == first
    assert _room(await _ok(client, {"type": "home_3d/building/get", "home_id": second})) == "Flat living"
    empty = await _call(client, {"type": "home_3d/backup/import", "packs": []})
    assert empty["error"]["code"] == "invalid_format"


def settings(got: dict) -> dict:
    return got["building"]["settings"]


async def test_a_sample_home_can_be_made_without_the_area_import(hass: HomeAssistant, hass_ws_client) -> None:
    """#61: a sample or template must not offer to import this install's own Home Assistant areas."""
    await _setup(hass)
    client = await hass_ws_client(hass)
    real = (await _ok(client, {"type": "home_3d/homes/create", "name": "Flat"}))["home"]["id"]
    sample = (await _ok(client, {"type": "home_3d/homes/create", "name": "Trial", "area_import": False}))["home"]["id"]
    # a plan without the setting (every plan from before #61) offers the import
    got = await _ok(client, {"type": "home_3d/building/get", "home_id": real})
    assert settings(got).get("area_import", True) is True
    assert settings(await _ok(client, {"type": "home_3d/building/get", "home_id": sample}))["area_import"] is False
    # a copy of the sample is a sample too
    copy_ = (await _ok(client, {"type": "home_3d/homes/duplicate", "home_id": sample, "name": "Trial 2"}))["home"]["id"]
    assert settings(await _ok(client, {"type": "home_3d/building/get", "home_id": copy_}))["area_import"] is False

    # the internal step a sample loader (#54) creates its home with
    data = hass.data[DOMAIN]
    loaded = await data.async_create_home("Sample", _named("Sample living"), area_import=False)
    assert loaded.building["settings"]["area_import"] is False
    assert loaded.building["floors"][0]["rooms"][0]["name"] == "Sample living"


async def test_a_sample_home_can_be_marked_as_a_demo(hass: HomeAssistant, hass_ws_client) -> None:
    """#100: a sample home is marked `demo`, so its devices show fixed demo states where this install lacks them;
    the mark survives a save and a copy, and an ordinary home is no demo."""
    await _setup(hass)
    client = await hass_ws_client(hass)
    data = hass.data[DOMAIN]
    sample = await data.async_create_home("Sample", _named("Sample living"), area_import=False, demo=True)
    assert sample.building["settings"]["demo"] is True
    assert sample.building["settings"]["area_import"] is False
    got = await _ok(client, {"type": "home_3d/building/get", "home_id": sample.id})
    assert settings(got)["demo"] is True
    # an editor's save keeps the mark (the schema knows it)
    building = got["building"]
    await _ok(client, {"type": "home_3d/building/save", "home_id": sample.id, "building": building})
    assert settings(await _ok(client, {"type": "home_3d/building/get", "home_id": sample.id}))["demo"] is True
    duplicate = {"type": "home_3d/homes/duplicate", "home_id": sample.id, "name": "Sample 2"}
    copy_ = (await _ok(client, duplicate))["home"]["id"]
    assert settings(await _ok(client, {"type": "home_3d/building/get", "home_id": copy_}))["demo"] is True
    real = (await _ok(client, {"type": "home_3d/homes/create", "name": "Flat"}))["home"]["id"]
    assert settings(await _ok(client, {"type": "home_3d/building/get", "home_id": real})).get("demo", False) is False
