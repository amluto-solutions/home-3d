"""A backup's packs (#375): limits that fit one websocket message, and packs sent ahead in parts."""

from __future__ import annotations

import json

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from custom_components.home_3d import backup_restore, packs
from custom_components.home_3d.const import DOMAIN
from tests.test_init import BUILDING

PART = {"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 0.55, "color": "fabric"}
CHAIR = {"id": "cube_chair", "name": {"en": "Cube chair"}, "size": [0.8, 0.8, 0.75], "parts": [PART]}


def _pack_json(pack_id: str = "test.starter", **extra) -> str:
    return json.dumps(
        {"format": "home3d-pack", "version": 2, "id": pack_id, "name": "Starter", "publisher": "Test", "licence": "MIT"}
        | extra
    )


def _folder(pack_id: str = "test.starter", **extra) -> dict[str, str]:
    return {"pack.json": _pack_json(pack_id, **extra), "cube_chair.json": json.dumps(CHAIR)}


async def _client(hass: HomeAssistant, hass_ws_client, token: str | None = None):
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    return await hass_ws_client(hass, token) if token else await hass_ws_client(hass)


async def _send(client, **msg) -> dict:
    await client.send_json_auto_id(msg)
    return await client.receive_json()


# ---------------------------------------------------------------------------- the limits


def test_a_folder_must_fit_in_one_message_as_sent() -> None:
    """Within the character limit, but more bytes as sent than one message takes (non-ASCII text)."""
    files = {"pack.json": _pack_json(), **{f"f{n}.json": "é" * 40_000 for n in range(50)}}
    assert sum(len(t) for t in files.values()) <= packs.MAX_FOLDER_SIZE
    with pytest.raises(packs.PackError) as err:
        packs.verify_folder(files)
    assert err.value.code == "too_large" and "bytes as sent" in err.value.detail
    assert packs.MAX_FOLDER_BYTES < packs.MAX_MESSAGE_BYTES


def test_every_bundled_pack_fits_in_one_message() -> None:
    for root in (packs.BUNDLED_DIR, packs.BUNDLED_LANGUAGES_DIR):
        for folder in root.iterdir():
            if (folder / packs.PACK_FILE).is_file():
                files = packs.read_folder(folder)
                kept = {path: files[path] for path in packs.data_paths(list(files))}
                assert packs.folder_bytes(kept) <= packs.MAX_FOLDER_BYTES, folder.name


async def test_github_refuses_a_folder_larger_than_a_folder_import_takes(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    """The file list's sizes are checked against the same byte limit before anything is downloaded."""
    api = "https://api.github.com/repos/someone/packs"
    aioclient_mock.get(api, json={"default_branch": "main"})
    aioclient_mock.get(f"{api}/commits/main", json={"sha": "a" * 40, "commit": {"tree": {"sha": "b" * 40}}})
    tree = [{"path": "pack.json", "type": "blob", "size": 200}]
    tree += [{"path": f"i{n}.json", "type": "blob", "size": 49_000} for n in range(80)]
    aioclient_mock.get(f"{api}/git/trees/{'b' * 40}", json={"tree": tree, "truncated": False})
    client = await _client(hass, hass_ws_client)
    result = await _send(client, type="home_3d/packs/install_url", url="https://github.com/someone/packs")
    assert result["error"]["code"] == "too_large" and str(packs.MAX_FOLDER_BYTES) in result["error"]["message"]
    assert not any("raw.githubusercontent.com" in str(url) for _m, url, _d, _h in aioclient_mock.mock_calls)


# ---------------------------------------------------------------------------- packs sent ahead


def test_staged_packs_are_taken_once_and_expire(monkeypatch: pytest.MonkeyPatch) -> None:
    staged = backup_restore.StagedPacks()
    token = staged.add(None, [{"id": "a"}])
    assert token is not None and staged.add(token, [{"id": "b"}]) == token
    assert staged.take(token) == [{"id": "a"}, {"id": "b"}]
    assert staged.take(token) is None
    assert staged.add("unknown", [{"id": "a"}]) is None

    now = [1000.0]
    monkeypatch.setattr(backup_restore.time, "monotonic", lambda: now[0])
    old = staged.add(None, [{"id": "a"}])
    now[0] += backup_restore.STAGE_SECONDS + 1
    assert old is not None and staged.take(old) is None
    # too many packs for one backup
    big = staged.add(None, [{"id": "x"}] * backup_restore.MAX_STAGED_PACKS)
    assert big is not None and staged.add(big, [{"id": "y"}]) is None


async def test_a_backup_restores_packs_sent_ahead_in_parts(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    first = {"id": "test.one", "source": {"files": _folder("test.one")}}
    second = {"id": "test.two", "source": {"files": _folder("test.two")}}
    token = (await _send(client, type="home_3d/backup/stage", packs=[first]))["result"]["token"]
    again = await _send(client, type="home_3d/backup/stage", packs=[second], token=token)
    assert again["result"]["token"] == token

    restore = await _send(client, type="home_3d/backup/import", building=BUILDING, staged=token)
    assert restore["success"], restore
    assert restore["result"]["packs"] == 2
    assert sorted(p["id"] for p in hass.data[DOMAIN].packs) == ["test.one", "test.two"]
    # a token is taken by the import that names it
    gone = await _send(client, type="home_3d/backup/import", building=BUILDING, staged=token)
    assert gone["error"]["code"] == "staged_expired"


async def test_only_admins_send_packs_ahead(hass: HomeAssistant, hass_ws_client, hass_read_only_access_token) -> None:
    await _client(hass, hass_ws_client)
    viewer = await hass_ws_client(hass, hass_read_only_access_token)
    refused = await _send(viewer, type="home_3d/backup/stage", packs=[{"id": "a"}])
    assert not refused["success"]


# ---------------------------------------------------------------------------- the checks of an import (#376)

SHELF = {"id": "shelf", "name": {"en": "Shelf"}, "size": [1.0, 0.3, 1.8], "parts": [PART]}
SHELF_TYPE = "pack:household.custom:shelf"


def _plan(*types: str, name: str = "Ground floor") -> dict:
    plan = json.loads(json.dumps(BUILDING))
    plan["floors"][0]["name"] = name
    plan["floors"][0]["background"] = None
    plan["floors"][0]["furniture"] = [
        {"id": f"f{n}", "type": t, "x": 1, "z": 1, "rotation": 0, "w": 1, "d": 0.3, "h": 1.8, "variant": None}
        for n, t in enumerate(types)
    ]
    return plan


async def _restore(client, **msg) -> dict:
    result = await _send(client, type="home_3d/backup/import", **msg)
    assert result["success"], result
    return result["result"]


async def test_a_restored_pack_is_kept_as_an_import_keeps_it(hass: HomeAssistant, hass_ws_client) -> None:
    """No readme or licence text in .storage, one entry per id (the last wins), sizes checked."""
    client = await _client(hass, hass_ws_client)
    files = {**_folder(), "README.md": "x" * 500_000}
    packs_ = [
        {"id": "test.starter", "source": {"files": files}},
        {"id": "test.starter", "source": {"files": {**_folder(release=2), "LICENSE": "y" * 500_000}}},
    ]
    result = await _restore(client, building=BUILDING, packs=packs_)
    assert result["packs"] == 1
    assert result["skipped"] == [{"id": "test.starter", "reason": "duplicate"}]
    [stored] = hass.data[DOMAIN].packs
    assert stored["release"] == 2 and sorted(stored["source"]["files"]) == ["cube_chair.json", "pack.json"]
    # one too large for a folder import is too large to restore
    # quotes take two bytes as sent, also from this test's client (which escapes any non-ASCII text)
    big = {"pack.json": _pack_json("test.big"), **{f"f{n}.json": '"' * 40_000 for n in range(48)}}
    result = await _restore(client, building=BUILDING, packs=[{"id": "test.big", "source": {"files": big}}])
    assert result["skipped"] == [{"id": "test.big", "reason": "too_large"}]


async def test_a_restore_skips_what_an_import_would_ask_about_and_keeps_the_previous_release(
    hass: HomeAssistant, hass_ws_client
) -> None:
    client = await _client(hass, hass_ws_client)
    for pack_id, release in (("test.pinned", 2), ("test.newer", 3), ("test.changed", 1)):
        files = _folder(pack_id, release=release)
        assert (await _send(client, type="home_3d/packs/import", files=files))["success"]
    assert (await _send(client, type="home_3d/packs/pin", pack_id="test.pinned", pinned=True))["success"]
    bigger = json.dumps({**CHAIR, "size": [1.2, 1.0, 0.9]})
    backup = [
        {"id": "test.pinned", "source": {"files": _folder("test.pinned", release=3)}},
        {"id": "test.newer", "source": {"files": _folder("test.newer", release=1)}},
        {"id": "test.changed", "source": {"files": {**_folder("test.changed"), "cube_chair.json": bigger}}},
        {"id": "acme.living", "source": {"files": _folder("amluto.living", publisher="Amluto Solutions")}},
    ]
    result = await _restore(client, building=BUILDING, packs=backup)
    assert sorted((s["id"], s["reason"]) for s in result["skipped"]) == [
        ("acme.living", "reserved_id"),
        ("test.newer", "older_release"),
        ("test.pinned", "pinned"),
    ]
    stored = {p["id"]: p for p in hass.data[DOMAIN].packs}
    assert stored["test.pinned"]["release"] == 2 and stored["test.newer"]["release"] == 3
    assert stored["test.changed"]["items"][0]["size"] == [1.2, 1.0, 0.9]
    # the release the restore replaced can be rolled back to
    rolled = await _send(client, type="home_3d/packs/rollback", pack_id="test.changed")
    assert rolled["success"], rolled
    assert {p["id"]: p for p in hass.data[DOMAIN].packs}["test.changed"]["items"][0]["size"] == [0.8, 0.8, 0.75]


async def test_a_pack_of_another_kind_is_not_restored_over_a_bundled_one(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    origin = {
        "type": "github",
        "url": "https://github.com/amluto-solutions/home-3d-packs/tree/main/amluto.lang-de",
        "owner": "amluto-solutions",
        "repo": "home-3d-packs",
        "ref": "main",
        "default_branch": False,
        "folder": "amluto.lang-de",
        "commit": "a" * 40,
    }
    furniture = _folder("amluto.lang-de", publisher="Amluto Solutions", release=5)
    entry = {"id": "x", "source": {"files": furniture, "origin": origin}}
    result = await _restore(client, building=BUILDING, packs=[entry])
    assert result["skipped"] == [{"id": "amluto.lang-de", "reason": "other_kind"}]
    assert hass.data[DOMAIN].packs == []


async def test_a_custom_item_taken_here_comes_in_under_a_new_id(hass: HomeAssistant, hass_ws_client) -> None:
    """The local 'shelf' and the backup's 'shelf' differ: the local homes keep theirs, the restored home its own."""
    client = await _client(hass, hass_ws_client)
    assert (await _send(client, type="home_3d/items/save", item=SHELF))["success"]
    assert (await _send(client, type="home_3d/building/save", building=_plan(SHELF_TYPE)))["success"]
    data = hass.data[DOMAIN]
    local_home = data.active_id
    theirs = {**SHELF, "size": [2.0, 0.4, 2.0]}
    flat = {"id": "flat", "name": "Flat", "building": _plan(SHELF_TYPE, name="Flat floor")}

    check = await _restore(client, homes=[flat], items=[theirs], check_only=True)
    assert check["renamed"] == [{"id": "shelf", "as": "shelf_2"}]
    result = await _restore(client, homes=[flat], items=[theirs])

    assert result["renamed"] == [{"id": "shelf", "as": "shelf_2"}]
    items = {i["id"]: i for i in data.custom.items}
    assert items["shelf"]["size"] == [1.0, 0.3, 1.8]
    assert items["shelf_2"]["size"] == [2.0, 0.4, 2.0] and items["shelf_2"]["name"] == {"en": "Shelf (2)"}
    restored = data.homes["flat"].building
    assert restored["floors"][0]["furniture"][0]["type"] == "pack:household.custom:shelf_2"
    assert restored["recipes"]["pack:household.custom:shelf_2"]["recipe"]["size"] == [2.0, 0.4, 2.0]
    kept = data.homes[local_home].building
    assert kept["recipes"][SHELF_TYPE]["recipe"]["size"] == [1.0, 0.3, 1.8]

    # the same backup again: shelf_2 is the backup's shelf now, nothing new comes in
    again = await _restore(client, homes=[flat], items=[theirs])
    assert again["renamed"] == [{"id": "shelf", "as": "shelf_2"}]
    assert sorted(i["id"] for i in data.custom.items) == ["shelf", "shelf_2"]


async def test_restoring_only_items_updates_the_restored_plan(hass: HomeAssistant, hass_ws_client) -> None:
    """A plan whose copy of a custom item differs from the backup's item follows it (no pack in the backup)."""
    client = await _client(hass, hass_ws_client)
    stale = _plan(SHELF_TYPE)
    item = {**SHELF, "size": [1.5, 0.3, 1.8]}
    stale["recipes"] = {
        SHELF_TYPE: {"pack": "household.custom", "item": "shelf", "recipe": {**SHELF, "size": [1.0, 0.3, 1.8]}}
    }
    result = await _restore(client, building=stale, items=[item])
    assert "renamed" not in result and result["items"] == 1
    recipes = hass.data[DOMAIN].active.building["recipes"]
    assert recipes[SHELF_TYPE]["recipe"]["size"] == [1.5, 0.3, 1.8]


def test_items_past_the_limit_are_listed_not_cut_silently() -> None:
    local = [{**SHELF, "id": "a"}]
    items = [{**SHELF, "id": i} for i in ("a", "b", "c")]
    kept, renames, skipped = backup_restore.resolve_items(items, [], local, [], 2)
    assert [i["id"] for i in kept] == ["a", "b"] and renames == {}
    assert skipped == [{"id": "c", "reason": "too_many_items"}]
    # a placed copy in a home the backup leaves alone counts like a local item
    copy_ = {"pack": "household.custom", "item": "b", "recipe": {**SHELF, "id": "b", "size": [3.0, 1.0, 1.0]}}
    kept, renames, _ = backup_restore.resolve_items(items, [], local, [{"pack:household.custom:b": copy_}], 10)
    assert renames == {"b": "b_2"} and [i["id"] for i in kept] == ["a", "b_2", "c"]
