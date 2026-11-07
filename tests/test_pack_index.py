"""The pack index (#336): Home Assistant fetches the curated list of packs for the Library's Browse tab.

GitHub is mocked (aioclient_mock): no test reaches the network.
"""

from __future__ import annotations

import json
import threading
from unittest.mock import patch

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from custom_components.home_3d import pack_index
from custom_components.home_3d.const import DATA_PACK_UPDATES, DOMAIN, STORAGE_KEY_PACK_UPDATES, STORAGE_VERSION
from custom_components.home_3d.pack_index import DEFAULT_INDEX_URL, index_url, read_index
from custom_components.home_3d.packs import PackError

CHAIR = {
    "id": "cube_chair",
    "name": {"en": "Cube chair"},
    "size": [0.8, 0.8, 0.75],
    "group": "seating",
    "parts": [{"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 0.55, "color": "fabric"}],
}
ENTRY = {
    "id": "test.starter",
    "name": "Starter",
    "description": "A few chairs.",
    "publisher": "Test",
    "licence": "MIT",
    "release": 3,
    "url": "https://github.com/test/home-3d-packs/tree/main/test.starter",
    "source": "community",
    "items": 2,
    "categories": {"seating": 2},
    "thumbnail": "cube_chair",
    "previews": [CHAIR],
}


def _index(*packs: dict) -> dict:
    return {"format": "home3d-pack-index", "version": 1, "packs": list(packs)}


# ---------------------------------------------------------------------------- the URL setting


def test_the_index_url_is_a_raw_github_file() -> None:
    assert index_url("") == DEFAULT_INDEX_URL
    assert index_url(None) == DEFAULT_INDEX_URL
    assert index_url(" https://raw.githubusercontent.com/me/packs/main/index.json ") == (
        "https://raw.githubusercontent.com/me/packs/main/index.json"
    )
    # a github.com file link is turned into its raw form
    assert index_url("https://github.com/me/packs/blob/dev/lists/index.json") == (
        "https://raw.githubusercontent.com/me/packs/dev/lists/index.json"
    )
    for bad in (
        "http://raw.githubusercontent.com/me/packs/main/index.json",
        "https://example.com/index.json",
        "https://raw.githubusercontent.com/me/packs/index.json",
        "https://raw.githubusercontent.com:8443/me/packs/main/index.json",
        "https://user@raw.githubusercontent.com/me/packs/main/index.json",
        "https://raw.githubusercontent.com/me/packs/main/../index.json",
        "https://raw.githubusercontent.com/me/packs/main/index.json?x=1",
        "https://github.com/me/packs",
    ):
        with pytest.raises(PackError):
            index_url(bad)


# ---------------------------------------------------------------------------- reading an index


def test_an_index_lists_the_entries_it_can_read() -> None:
    other = {**ENTRY, "id": "test.other", "previews": [], "thumbnail": "gone"}
    packs = read_index(
        json.dumps(
            _index(
                ENTRY,
                other,
                # not a GitHub URL: the install path could not take it
                {**ENTRY, "id": "test.elsewhere", "url": "https://example.com/pack"},
                # a field this version cannot read
                {**ENTRY, "id": "test.newer", "release": "three"},
                # the same id twice: the first stays
                {**ENTRY, "name": "Second"},
                "not an entry",
            )
        ).encode()
    )
    assert [p["id"] for p in packs] == ["test.starter", "test.other"]
    starter = packs[0]
    assert starter["name"] == "Starter"
    assert starter["thumbnail"] == "cube_chair"
    # the previews are checked like a pack's items (defaults filled in)
    assert starter["previews"][0]["mount"] == "floor"
    # a thumbnail that names no preview is dropped
    assert "thumbnail" not in packs[1]


def test_previews_are_checked_like_items() -> None:
    linked = {**CHAIR, "id": "linked", "name": {"en": "See https://example.com"}}
    broken = {**CHAIR, "id": "broken", "parts": []}
    packs = read_index(json.dumps(_index({**ENTRY, "previews": [linked, broken, CHAIR]})).encode())
    assert [p["id"] for p in packs[0]["previews"]] == ["cube_chair"]


def test_a_file_that_is_no_index_is_refused() -> None:
    for body in (
        b"not json",
        b"[]",
        json.dumps({"format": "other", "packs": []}).encode(),
        b'{"format": "home3d-pack-index", "packs": []}',
    ):
        with pytest.raises(PackError) as err:
            read_index(body)
        assert err.value.code == "invalid_index"


def test_entry_urls_are_kept_in_their_plain_form() -> None:
    packs = read_index(
        json.dumps(_index({**ENTRY, "url": "github.com/test/home-3d-packs/tree/main/test.starter/"})).encode()
    )
    assert packs[0]["url"] == "https://github.com/test/home-3d-packs/tree/main/test.starter"


# ---------------------------------------------------------------------------- the command


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


async def test_the_index_is_fetched_once_and_kept(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.get(DEFAULT_INDEX_URL, json=_index(ENTRY))
    client = await _client(hass, hass_ws_client)

    first = await _send(client, type="home_3d/packs/index")
    assert first["success"], first
    assert [p["id"] for p in first["result"]["packs"]] == ["test.starter"]
    assert first["result"]["url"] == DEFAULT_INDEX_URL
    second = await _send(client, type="home_3d/packs/index")
    assert second["result"]["packs"] == first["result"]["packs"]
    assert aioclient_mock.call_count == 1

    # a refresh fetches again; once the kept copy is old, so does a plain ask
    await _send(client, type="home_3d/packs/index", refresh=True)
    assert aioclient_mock.call_count == 2
    hass.data[DATA_PACK_UPDATES].index._fetched_at -= pack_index.CACHE_SECONDS + 1
    await _send(client, type="home_3d/packs/index")
    assert aioclient_mock.call_count == 3


async def test_the_index_is_read_outside_the_event_loop(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    """#374: a large index takes seconds to check, so it is read in the executor."""
    aioclient_mock.get(DEFAULT_INDEX_URL, json=_index(ENTRY))
    client = await _client(hass, hass_ws_client)
    threads: list[bool] = []
    real = pack_index.read_index

    def read(body: bytes, **kwargs) -> list:
        threads.append(threading.current_thread() is threading.main_thread())
        return real(body, **kwargs)

    with patch.object(pack_index, "read_index", read):
        answer = await _send(client, type="home_3d/packs/index")
    assert answer["success"] and threads == [False]


async def test_without_internet_the_index_fails_quietly(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.get(DEFAULT_INDEX_URL, exc=aiohttp.ClientConnectionError("no route"))
    client = await _client(hass, hass_ws_client)

    answer = await _send(client, type="home_3d/packs/index")
    assert not answer["success"]
    assert answer["error"]["code"] == "offline"
    # the bundled packs are still offered
    listed = await _send(client, type="home_3d/packs/list")
    assert listed["success"] and listed["result"]["packs"]


async def test_a_failed_refresh_keeps_the_copy_it_has(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.get(DEFAULT_INDEX_URL, json=_index(ENTRY))
    client = await _client(hass, hass_ws_client)
    assert (await _send(client, type="home_3d/packs/index"))["success"]

    aioclient_mock.clear_requests()
    aioclient_mock.get(DEFAULT_INDEX_URL, status=500)
    answer = await _send(client, type="home_3d/packs/index", refresh=True)
    assert answer["success"]
    assert answer["result"]["stale"] is True
    assert [p["id"] for p in answer["result"]["packs"]] == ["test.starter"]


async def test_the_index_url_is_a_setting(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    fork = "https://raw.githubusercontent.com/me/packs/main/index.json"
    aioclient_mock.get(fork, json=_index({**ENTRY, "id": "me.chairs"}))
    client = await _client(hass, hass_ws_client)

    bad = await _send(client, type="home_3d/packs/updates/settings", index_url="https://example.com/index.json")
    assert not bad["success"]
    ok = await _send(client, type="home_3d/packs/updates/settings", index_url=fork)
    assert ok["success"] and ok["result"]["settings"]["index_url"] == fork
    answer = await _send(client, type="home_3d/packs/index")
    assert [p["id"] for p in answer["result"]["packs"]] == ["me.chairs"]
    # back to the default with an empty setting
    ok = await _send(client, type="home_3d/packs/updates/settings", index_url="")
    assert ok["result"]["settings"]["index_url"] == ""


async def test_settings_stored_before_the_index_load_unchanged(
    hass: HomeAssistant, hass_ws_client, hass_storage
) -> None:
    """v1.0 plan format stability: update settings kept by an earlier release (no index_url) load as they were."""
    hass_storage[STORAGE_KEY_PACK_UPDATES] = {
        "version": STORAGE_VERSION,
        "key": STORAGE_KEY_PACK_UPDATES,
        "data": {
            "settings": {"auto_update": True, "frequency": "weekly", "time": "05:30", "weekday": 2},
            "pinned": [],
            "previous": {},
            "checks": {},
            "last_check": None,
        },
    }
    client = await _client(hass, hass_ws_client)
    settings = (await _send(client, type="home_3d/packs/updates"))["result"]["settings"]
    assert settings == {"auto_update": True, "frequency": "weekly", "time": "05:30", "weekday": 2, "index_url": ""}


async def test_only_editors_browse_the_index(
    hass: HomeAssistant, hass_ws_client, hass_read_only_access_token, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.get(DEFAULT_INDEX_URL, json=_index(ENTRY))
    await _client(hass, hass_ws_client)
    viewer = await hass_ws_client(hass, hass_read_only_access_token)
    answer = await _send(viewer, type="home_3d/packs/index")
    assert not answer["success"]
    assert aioclient_mock.call_count == 0
