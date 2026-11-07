"""Loading a home's plan without losing anything (#379): a repaired plan is served but not written back until an
editor saves, and its plan as stored is a restore point the others never push out; the picture clean-up keeps
pictures set lately and never runs against no plan or an empty one; a lost list of homes is found again from the
stores on disk; a damaged plan store makes its home read-only; undoing a failed backup restore keeps a read-only
home read-only."""

from __future__ import annotations

import copy
import json
import time
from typing import Any

from homeassistant.core import HomeAssistant
import pytest

from custom_components.home_3d import storage
from custom_components.home_3d.const import (
    DOMAIN,
    HISTORY_MAX,
    PLAN_VERSION,
    STORAGE_KEY_BUILDING,
    STORAGE_KEY_HISTORY,
    STORAGE_KEY_HOMES,
    STORAGE_KEY_IMAGES,
)
from custom_components.home_3d.storage import FloorplanData, Home, PlanReadOnly
from tests.test_backup import _with_a_pack
from tests.test_init import BUILDING, IMAGE, _setup
from tests.test_migrations import _call, _ok, _stored, _with_bad_item
from tests.test_restore_pictures import _restart, _with_background

DAY = 86400
DAMAGED = f"{STORAGE_KEY_BUILDING}.corrupt.2026-11-05T10:00:00.000000+00:00"


def _images(hass_storage: dict[str, Any], key: str, images: dict[str, str], added: dict[str, float] | None = None):
    data: dict[str, Any] = {"images": images, **({"added": added} if added is not None else {})}
    hass_storage[key] = {"version": 1, "key": key, "data": data}


def _files(monkeypatch, files: list[str] | None = None, hass_storage: dict[str, Any] | None = None) -> None:
    """What the storage folder holds: `files`, plus the stores of `hass_storage` (the tests keep stores there)."""

    def listed(_folder: str) -> list[str]:
        return [*(files or []), *(hass_storage or {})]

    monkeypatch.setattr(storage, "_storage_files", listed)


# ---------------------------------------------------------------------------- a repaired plan


async def test_a_repaired_plan_is_not_written_back_until_an_editor_saves(
    hass: HomeAssistant, hass_ws_client, hass_storage
) -> None:
    bad = _with_bad_item(BUILDING)
    _stored(hass_storage, bad)
    entry = await _setup(hass)
    home: Home = hass.data[DOMAIN].active
    assert home.problem is not None and home.problem["code"] == "plan_repaired" and not home.read_only
    assert [m["id"] for m in home.building["floors"][0]["furniture"]] == ["sofa1", "named"]
    # the plan as stored is left as it is, and kept apart as a restore point
    assert hass_storage[STORAGE_KEY_BUILDING]["data"] == {"revision": 4, "building": bad}
    points = hass_storage[STORAGE_KEY_HISTORY]["data"]["snapshots"]
    assert [(p["building"], p.get("kept")) for p in points] == [(bad, True)]
    assert home.history()[0]["kept"] is True

    # the server's own changes do not write it either
    assert await home.async_update_building(lambda b: {**b, "settings": {**b["settings"], "grid": 0.1}}) == 4
    await home.async_follow_custom_items()
    assert hass_storage[STORAGE_KEY_BUILDING]["data"] == {"revision": 4, "building": bad}

    # each start repairs it again, but keeps it apart once only
    await _restart(hass, entry)
    home = hass.data[DOMAIN].active
    assert home.problem is not None and home.problem["code"] == "plan_repaired"
    assert len(hass_storage[STORAGE_KEY_HISTORY]["data"]["snapshots"]) == 1

    # more restore points than are kept never push it out
    for _ in range(HISTORY_MAX + 5):
        await home.async_snapshot()
    points = hass_storage[STORAGE_KEY_HISTORY]["data"]["snapshots"]
    assert len(points) == HISTORY_MAX + 1
    assert [p["building"] for p in points if p.get("kept")] == [bad]

    # an editor's save writes the plan: the notice goes, the kept point stays
    client = await hass_ws_client(hass)
    got = await _ok(client, {"type": "home_3d/building/get"})
    await _ok(client, {"type": "home_3d/building/save", "building": got["building"], "base_revision": 4})
    stored = hass_storage[STORAGE_KEY_BUILDING]["data"]
    assert stored["revision"] == 5 and stored["building"]["version"] == PLAN_VERSION
    assert home.problem is None
    assert [p["building"] for p in hass_storage[STORAGE_KEY_HISTORY]["data"]["snapshots"] if p.get("kept")] == [bad]
    # and the server's own changes write again
    assert await home.async_update_building(lambda b: {**b, "settings": {**b["settings"], "grid": 0.1}}) == 6


def test_kept_restore_points_have_their_own_limit() -> None:
    points = [{"id": f"k{i}", "kept": True} for i in range(storage.KEPT_MAX + 2)]
    points += [{"id": f"p{i}"} for i in range(HISTORY_MAX + 3)]
    kept = storage._rotated(points)
    assert [p["id"] for p in kept if p.get("kept")] == [f"k{i}" for i in range(2, storage.KEPT_MAX + 2)]
    assert len([p for p in kept if not p.get("kept")]) == HISTORY_MAX


# ---------------------------------------------------------------------------- the picture clean-up


async def test_a_picture_set_lately_is_kept_though_no_plan_uses_it(hass: HomeAssistant, hass_ws_client) -> None:
    """The picture's upload worked, the plan save that would use it did not (a draft keeps it): after a restart the
    picture is still there; one set more than a week ago goes."""
    entry = await _setup(hass)
    client = await hass_ws_client(hass)
    await _ok(client, {"type": "home_3d/building/save", "building": _with_background("used")})
    await _ok(client, {"type": "home_3d/image/set", "image_id": "used", "data": IMAGE})
    await _ok(client, {"type": "home_3d/image/set", "image_id": "draft", "data": IMAGE})
    await _ok(client, {"type": "home_3d/image/set", "image_id": "old", "data": IMAGE})
    hass.data[DOMAIN].active._added["old"] = time.time() - 8 * DAY
    await hass.data[DOMAIN].active._save_images()

    await _restart(hass, entry)
    assert sorted(hass.data[DOMAIN].active.images) == ["draft", "used"]
    await hass.data[DOMAIN].active.async_delete_image("draft")
    assert "draft" not in hass.data[DOMAIN].active._added


@pytest.mark.parametrize("plan", [None, {"version": PLAN_VERSION, "floors": [], "settings": {}}], ids=["none", "empty"])
async def test_no_picture_goes_against_no_plan_or_an_empty_one(
    hass: HomeAssistant, hass_storage, plan: dict[str, Any] | None
) -> None:
    if plan is not None:
        _stored(hass_storage, plan)
    _images(hass_storage, STORAGE_KEY_IMAGES, {"a": IMAGE, "b": IMAGE})
    await _setup(hass)
    assert sorted(hass.data[DOMAIN].active.images) == ["a", "b"]


async def test_no_picture_goes_while_the_restore_points_are_lost(
    hass: HomeAssistant, hass_storage, monkeypatch
) -> None:
    _stored(hass_storage, _with_background("current"))
    _images(hass_storage, STORAGE_KEY_IMAGES, {"current": IMAGE, "older": IMAGE})
    _files(monkeypatch, [f"{STORAGE_KEY_HISTORY}.corrupt.2026-11-05T10:00:00+00:00"])
    await _setup(hass)
    assert sorted(hass.data[DOMAIN].active.images) == ["current", "older"]


# ---------------------------------------------------------------------------- lost and damaged stores


def test_the_homes_on_disk_and_the_copies_of_damaged_stores(tmp_path) -> None:
    files = [
        STORAGE_KEY_IMAGES,
        "home_3d.home_b2.history",
        "home_3d.home_a1.building",
        "home_3d.home_a1.images",
        "home_3d.home_c3.building.corrupt.2026-11-05T10:00:00",
        "home_3d.homes",
        "home_3d.packs",
        "other.home_x.building",
    ]
    assert storage._homes_on_disk(files) == ["home", "a1", "b2"]
    assert storage._homes_on_disk(["home_3d.home_a1.building"]) == ["a1"]
    assert storage._homes_on_disk([]) == []
    older, newer = f"{STORAGE_KEY_BUILDING}.corrupt.2026-11-04T10:00:00", f"{STORAGE_KEY_BUILDING}.corrupt.2026-11-05"
    assert storage._corrupt_copy([older, newer, "home_3d.home_x.building.corrupt.1"], STORAGE_KEY_BUILDING) == newer
    assert storage._corrupt_copy(files, STORAGE_KEY_BUILDING) is None
    (tmp_path / "home_3d.homes").write_text("{}")
    assert storage._storage_files(str(tmp_path)) == ["home_3d.homes"]
    assert storage._storage_files(str(tmp_path / "missing")) == []


async def test_a_lost_list_of_homes_is_found_again_from_their_stores(
    hass: HomeAssistant, hass_ws_client, hass_storage, monkeypatch
) -> None:
    _stored(hass_storage, copy.deepcopy(BUILDING))
    other: dict[str, Any] = copy.deepcopy(BUILDING)
    other["floors"][0]["rooms"][0]["name"] = "Flat"
    key = "home_3d.home_flat1.building"
    hass_storage[key] = {"version": 1, "minor_version": 2, "key": key, "data": {"revision": 3, "building": other}}
    _images(hass_storage, "home_3d.home_flat1.images", {"pic": IMAGE})
    # Home Assistant moved the damaged list of homes aside and loads nothing for it
    _files(monkeypatch, [f"{STORAGE_KEY_HOMES}.corrupt.2026-11-05T10:00:00+00:00"], hass_storage)
    await _setup(hass)
    data: FloorplanData = hass.data[DOMAIN]
    assert [(h.id, h.name) for h in data.homes.values()] == [("home", "Home"), ("flat1", "Home 2")]
    assert data.homes["flat1"].building["floors"][0]["rooms"][0]["name"] == "Flat"
    assert data.homes["flat1"].revision == 3
    # the list is written again with every home in it
    listed = hass_storage[STORAGE_KEY_HOMES]["data"]["homes"]
    assert [h["id"] for h in listed] == ["home", "flat1"]
    client = await hass_ws_client(hass)
    assert len((await _ok(client, {"type": "home_3d/homes/list"}))["homes"]) == 2


async def test_a_new_install_still_starts_with_one_home(hass: HomeAssistant, hass_storage, monkeypatch) -> None:
    _files(monkeypatch, [], hass_storage)
    await _setup(hass)
    assert list(hass.data[DOMAIN].homes) == ["home"]
    assert [h["id"] for h in hass_storage[STORAGE_KEY_HOMES]["data"]["homes"]] == ["home"]


async def test_a_damaged_plan_store_makes_its_home_read_only(
    hass: HomeAssistant, hass_ws_client, hass_storage, monkeypatch
) -> None:
    """Home Assistant moved the damaged plan aside and loads nothing: that is no empty plan. The home is read-only
    with a problem, keeps its pictures, and a restore point brings it back."""
    _images(hass_storage, STORAGE_KEY_IMAGES, {"bg": IMAGE, "spare": IMAGE})
    hass_storage[STORAGE_KEY_HISTORY] = {
        "version": 1,
        "key": STORAGE_KEY_HISTORY,
        "data": {"snapshots": [{"id": "p1", "revision": 2, "saved_at": time.time(), "building": BUILDING}]},
    }
    _files(monkeypatch, [DAMAGED], hass_storage)
    await _setup(hass)
    home: Home = hass.data[DOMAIN].active
    assert home.read_only and home.problem is not None and home.problem["code"] == "plan_invalid"
    assert DAMAGED in home.problem["message"]
    assert sorted(home.images) == ["bg", "spare"]
    client = await hass_ws_client(hass)
    got = await _ok(client, {"type": "home_3d/building/get"})
    assert got["can_edit"] is False and got["problem"]["code"] == "plan_invalid"
    refused = await _call(client, {"type": "home_3d/building/save", "building": BUILDING})
    assert refused["error"]["code"] == "read_only"
    assert STORAGE_KEY_BUILDING not in hass_storage

    await _ok(client, {"type": "home_3d/history/restore", "snapshot_id": "p1"})
    assert not home.read_only and home.problem is None
    assert hass_storage[STORAGE_KEY_BUILDING]["data"]["building"]["floors"][0]["id"] == "f1"


# ---------------------------------------------------------------------------- undoing a failed backup restore


async def test_undoing_a_failed_backup_keeps_a_read_only_home_read_only(
    hass: HomeAssistant, hass_ws_client, hass_storage, monkeypatch
) -> None:
    unreadable = {**copy.deepcopy(BUILDING), "version": PLAN_VERSION + 1, "rooms_v3": [{"id": "x"}]}
    _stored(hass_storage, unreadable)
    client, pack = await _with_a_pack(hass, hass_ws_client)
    data: FloorplanData = hass.data[DOMAIN]
    home = data.active
    assert home.read_only

    async def failing(self: FloorplanData, packs: list[dict[str, Any]]) -> None:
        raise OSError("disk full")

    other = json.loads(json.dumps(pack))
    other["id"] = other["source"]["id"] = "test.other"
    monkeypatch.setattr(FloorplanData, "async_set_packs", failing)
    homes = [{"id": home.id, "name": home.name, "building": copy.deepcopy(BUILDING)}]
    result = await _call(client, {"type": "home_3d/backup/import", "homes": homes, "packs": [other]})
    assert result["error"]["code"] == "restore_failed"

    # the plan as stored is back as it was, and the home is still read-only
    assert home.read_only and home.problem is not None and home.problem["code"] == "plan_too_new"
    assert home.building == unreadable
    assert hass_storage[STORAGE_KEY_BUILDING]["data"]["building"] == unreadable
    with pytest.raises(PlanReadOnly):
        await home.async_save_building(copy.deepcopy(BUILDING))
    revision = home.revision
    assert await home.async_update_building(lambda b: {**b, "settings": {}}) == revision
    assert hass_storage[STORAGE_KEY_BUILDING]["data"]["building"] == unreadable


async def test_undoing_a_failed_backup_keeps_a_repaired_plan_as_stored(
    hass: HomeAssistant, hass_ws_client, hass_storage, monkeypatch
) -> None:
    bad = _with_bad_item(BUILDING)
    _stored(hass_storage, bad)
    client, pack = await _with_a_pack(hass, hass_ws_client)
    data: FloorplanData = hass.data[DOMAIN]
    home = data.active
    served = home.building

    async def failing(self: FloorplanData, packs: list[dict[str, Any]]) -> None:
        raise OSError("disk full")

    other = json.loads(json.dumps(pack))
    other["id"] = other["source"]["id"] = "test.other"
    monkeypatch.setattr(FloorplanData, "async_set_packs", failing)
    homes = [{"id": home.id, "name": home.name, "building": copy.deepcopy(BUILDING)}]
    result = await _call(client, {"type": "home_3d/backup/import", "homes": homes, "packs": [other]})
    assert result["error"]["code"] == "restore_failed"
    assert home.problem is not None and home.problem["code"] == "plan_repaired"
    assert home.building == served
    assert hass_storage[STORAGE_KEY_BUILDING]["data"]["building"] == bad
