"""Whose pack it is (#372): a pack can't take another kind's place, Home 3D's own ids and publisher come only from an
official source, replacing one of its own packs asks first, and the index can't vouch for itself.

GitHub is mocked (aioclient_mock): no test reaches the network.
"""

from __future__ import annotations

import json

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from custom_components.home_3d import packs
from custom_components.home_3d.const import DOMAIN
from custom_components.home_3d.pack_index import DEFAULT_INDEX_URL, read_index
from custom_components.home_3d.packs import PackError

PART = {"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 0.55, "color": "fabric"}
CHAIR = {"id": "cube_chair", "name": {"en": "Cube chair"}, "size": [0.8, 0.8, 0.75], "parts": [PART]}


def _pack(pack_id: str, *, publisher: str = "Test", release: int = 1, **extra) -> dict:
    return {
        "format": "home3d-pack",
        "version": 2,
        "id": pack_id,
        "name": "A pack",
        "publisher": publisher,
        "licence": "MIT",
        "release": release,
        **extra,
    }


def _furniture(pack: dict) -> dict[str, str]:
    return {"pack.json": json.dumps(pack), "cube_chair.json": json.dumps(CHAIR)}


def _language(pack: dict) -> dict[str, str]:
    return {"pack.json": json.dumps({**pack, "kind": "language"}), "strings.json": json.dumps({"view": "Vue"})}


def _sha(n: int) -> str:
    return f"{n:040x}"


def _github(
    aioclient_mock: AiohttpClientMocker, owner: str, folder: str, files: dict[str, str], commit: int = 1
) -> str:
    """A public repo `owner`/packs with the pack in `folder`; the URL to install it from."""
    api = f"https://api.github.com/repos/{owner}/packs"
    sha, tree = _sha(commit), _sha(commit + 1000)
    aioclient_mock.get(f"{api}/commits/main", json={"sha": sha, "commit": {"tree": {"sha": tree}}})
    entries = [{"path": f"{folder}/{p}", "type": "blob", "size": len(t.encode())} for p, t in files.items()]
    entries.append({"path": folder, "type": "tree"})
    aioclient_mock.get(f"{api}/git/trees/{tree}", json={"sha": tree, "tree": entries, "truncated": False})
    for path, text in files.items():
        aioclient_mock.get(f"https://raw.githubusercontent.com/{owner}/packs/{sha}/{folder}/{path}", text=text)
    return f"https://github.com/{owner}/packs/tree/main/{folder}"


async def _client(hass: HomeAssistant, hass_ws_client):
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done(wait_background_tasks=True)
    return await hass_ws_client(hass)


async def _send(client, **msg) -> dict:
    await client.send_json_auto_id(msg)
    return await client.receive_json()


def _offered(hass: HomeAssistant, pack_id: str) -> dict:
    return next(p for p in hass.data[DOMAIN].offered_packs if p["id"] == pack_id)


# ---------------------------------------------------------------------------- the rules


def test_the_reserved_id_and_publisher_need_an_official_origin() -> None:
    official = {"type": "github", "owner": "TheOvenCook", "repo": "home-3d-packs"}
    for pack in (
        _pack("amluto.living"),
        _pack("acme.chairs", publisher="Amluto Solutions"),
        _pack("acme.chairs", publisher="The Oven-Cook"),
    ):
        assert packs.is_reserved(pack)
        assert packs.official_only(pack, official) is pack
        for origin in (None, {"type": "github", "owner": "acme", "repo": "amluto-solutions"}):
            with pytest.raises(PackError) as err:
                packs.official_only(pack, origin)
            assert err.value.code == "reserved_id"
    ours = _pack("acme.chairs", publisher="Acme")
    assert not packs.is_reserved(ours) and packs.official_only(ours, None) is ours


def test_an_imported_pack_of_another_kind_never_hides_a_bundled_one() -> None:
    """Stored before 1.0.1: a furniture pack named like the bundled German texts stays stored, but is not offered."""
    german = {**_pack("amluto.lang-de"), "kind": "language", "bundled": True}
    furniture = {**_pack("amluto.lang-de", release=2), "items": [CHAIR]}
    assert packs.with_bundled([german], [furniture]) == [german]
    newer = {**_pack("amluto.lang-de", release=2), "kind": "language"}
    assert packs.with_bundled([german], [newer]) == [newer]


def test_only_the_default_index_marks_an_entry_official() -> None:
    entry = {
        "id": "amluto.garden",
        "name": "Garden",
        "publisher": "Amluto Solutions",
        "licence": "MIT",
        "release": 1,
        "url": "https://github.com/amluto-solutions/home-3d-packs/tree/main/amluto.garden",
        "source": "official",
    }
    other = {**entry, "id": "acme.chairs", "url": "https://github.com/acme/packs/tree/main/acme.chairs"}
    body = json.dumps({"format": "home3d-pack-index", "version": 1, "packs": [entry, other]}).encode()
    assert [p["source"] for p in read_index(body, official=True)] == ["official", "community"]
    assert [p["source"] for p in read_index(body)] == ["community", "community"]


# ---------------------------------------------------------------------------- imports and installs


async def test_a_file_can_not_use_the_reserved_id_or_publisher(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    before = _offered(hass, "amluto.living")
    for pack in (
        _pack("amluto.living", release=99, publisher="Amluto Solutions"),
        _pack("acme.x", publisher="Amluto Solutions"),
    ):
        refused = await _send(client, type="home_3d/packs/import", files=_furniture(pack), confirm=True)
        assert refused["error"]["code"] == "reserved_id"
    assert hass.data[DOMAIN].packs == [] and _offered(hass, "amluto.living") is before


async def test_a_pack_can_not_replace_one_of_another_kind(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    client = await _client(hass, hass_ws_client)
    assert (await _send(client, type="home_3d/packs/import", files=_language(_pack("acme.lang-uk", language="uk"))))[
        "success"
    ]
    refused = await _send(
        client, type="home_3d/packs/import", files=_furniture(_pack("acme.lang-uk", release=2)), confirm=True
    )
    assert refused["error"]["code"] == "other_kind"
    assert _offered(hass, "acme.lang-uk")["kind"] == "language"

    # not even from the official account, for a bundled pack
    url = _github(aioclient_mock, "amluto-solutions", "amluto.lang-de", _furniture(_pack("amluto.lang-de", release=2)))
    for kind in ("home_3d/packs/preview_url", "home_3d/packs/install_url"):
        refused = await _send(client, type=kind, url=url, **({"confirm": True} if kind.endswith("install_url") else {}))
        assert refused["error"]["code"] == "other_kind"
    assert _offered(hass, "amluto.lang-de")["bundled"] is True


async def test_replacing_a_bundled_pack_asks_first_naming_it(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    client = await _client(hass, hass_ws_client)
    living = _offered(hass, "amluto.living")
    files = packs.read_folder(packs.BUNDLED_DIR / "amluto.living")
    files["pack.json"] = json.dumps({**json.loads(files["pack.json"]), "release": living["release"] + 1})
    url = _github(aioclient_mock, "amluto-solutions", "amluto.living", files)

    preview = (await _send(client, type="home_3d/packs/preview_url", url=url))["result"]
    assert "replaces_bundled" in preview["warnings"]
    asked = await _send(client, type="home_3d/packs/install_url", url=url)
    assert asked["error"]["code"] == "replaces_bundled"
    assert living["name"] in asked["error"]["message"] and f"release {living['release']}" in asked["error"]["message"]
    assert _offered(hass, "amluto.living")["bundled"] is True

    assert (await _send(client, type="home_3d/packs/install_url", url=url, confirm=True))["success"]
    assert _offered(hass, "amluto.living")["release"] == living["release"] + 1
    # an update from the same place asks nothing more
    files["pack.json"] = json.dumps({**json.loads(files["pack.json"]), "release": living["release"] + 2})
    aioclient_mock.clear_requests()
    url = _github(aioclient_mock, "amluto-solutions", "amluto.living", files, commit=2)
    assert (await _send(client, type="home_3d/packs/install_url", url=url))["success"]


async def test_another_account_can_not_install_a_reserved_id(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    client = await _client(hass, hass_ws_client)
    url = _github(aioclient_mock, "acme", "amluto.living", _furniture(_pack("amluto.living", release=99)))
    for kind in ("home_3d/packs/preview_url", "home_3d/packs/install_url"):
        refused = await _send(client, type=kind, url=url)
        assert refused["error"]["code"] == "reserved_id"
    assert _offered(hass, "amluto.living")["bundled"] is True


async def test_replacing_an_official_pack_from_elsewhere_asks_first(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    client = await _client(hass, hass_ws_client)
    garden = _furniture(_pack("amluto.garden", publisher="Amluto Solutions"))
    first = _github(aioclient_mock, "amluto-solutions", "amluto.garden", garden)
    assert (await _send(client, type="home_3d/packs/install_url", url=first))["success"]
    aioclient_mock.clear_requests()
    # another folder of the official account: an official source, but not the one it came from
    newer = _furniture(_pack("amluto.garden", publisher="Amluto Solutions", release=2))
    second = _github(aioclient_mock, "amluto-solutions", "garden-copy", newer, commit=2)
    asked = await _send(client, type="home_3d/packs/install_url", url=second)
    assert asked["error"]["code"] == "replaces_official" and first in asked["error"]["message"]
    assert (await _send(client, type="home_3d/packs/install_url", url=second, confirm=True))["success"]


async def test_an_index_entry_installs_only_the_pack_it_names(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    """An 'Acme chairs' entry whose URL holds another pack installs nothing."""
    client = await _client(hass, hass_ws_client)
    url = _github(aioclient_mock, "acme", "chairs", _furniture(_pack("acme.other")))
    for kind in ("home_3d/packs/preview_url", "home_3d/packs/install_url"):
        refused = await _send(client, type=kind, url=url, pack_id="acme.chairs")
        assert refused["error"]["code"] == "id_mismatch"
    assert hass.data[DOMAIN].packs == []
    assert (await _send(client, type="home_3d/packs/install_url", url=url, pack_id="acme.other"))["success"]


async def test_the_default_index_alone_lists_official_packs(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    entry = {
        "id": "amluto.garden",
        "name": "Garden",
        "publisher": "Amluto Solutions",
        "licence": "MIT",
        "release": 1,
        "url": "https://github.com/amluto-solutions/home-3d-packs/tree/main/amluto.garden",
        "source": "official",
    }
    index = {"format": "home3d-pack-index", "version": 1, "packs": [entry]}
    fork = "https://raw.githubusercontent.com/acme/packs/main/index.json"
    aioclient_mock.get(DEFAULT_INDEX_URL, json=index)
    aioclient_mock.get(fork, json=index)
    client = await _client(hass, hass_ws_client)
    answer = await _send(client, type="home_3d/packs/index")
    assert answer["result"]["packs"][0]["source"] == "official"
    assert (await _send(client, type="home_3d/packs/updates/settings", index_url=fork))["success"]
    answer = await _send(client, type="home_3d/packs/index")
    assert answer["result"]["packs"][0]["source"] == "community"


async def test_an_official_pack_at_the_same_release_with_other_content_asks_first(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    """#373 for our own packs too: the same URL and release, but other items (the publisher forgot the release)."""
    client = await _client(hass, hass_ws_client)
    garden = _furniture(_pack("amluto.garden", publisher="Amluto Solutions"))
    url = _github(aioclient_mock, "amluto-solutions", "amluto.garden", garden)
    assert (await _send(client, type="home_3d/packs/install_url", url=url))["success"]
    aioclient_mock.clear_requests()
    changed = {**garden, "cube_chair.json": json.dumps({**CHAIR, "size": [1.0, 1.0, 1.0]})}
    url = _github(aioclient_mock, "amluto-solutions", "amluto.garden", changed, commit=2)
    asked = await _send(client, type="home_3d/packs/install_url", url=url)
    assert asked["error"]["code"] == "same_release"
