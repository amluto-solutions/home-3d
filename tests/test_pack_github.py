"""Installing a pack from a GitHub URL (#25): Home Assistant fetches and checks it; the browser never does.

GitHub is mocked (aioclient_mock): no test reaches the network.
"""

from __future__ import annotations

import json

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
from pytest_homeassistant_custom_component.common import MockConfigEntry
from pytest_homeassistant_custom_component.test_util.aiohttp import AiohttpClientMocker

from custom_components.home_3d import packs
from custom_components.home_3d.const import DOMAIN

OWNER, REPO = "amluto-solutions", "home-3d-packs"
COMMIT = "a" * 40
TREE = "b" * 40
API = f"https://api.github.com/repos/{OWNER}/{REPO}"
RAW = f"https://raw.githubusercontent.com/{OWNER}/{REPO}/{COMMIT}"

PACK_JSON = {
    "format": "home3d-pack",
    "version": 2,
    "id": "test.starter",
    "name": "Starter",
    "publisher": "Test",
    "licence": "MIT",
    "release": 3,
}
CHAIR = {
    "id": "cube_chair",
    "name": {"en": "Cube chair"},
    "size": [0.8, 0.8, 0.75],
    "parts": [{"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 0.55, "color": "fabric"}],
}


def _stool() -> dict:
    return {**CHAIR, "id": "stool", "name": {"en": "Stool"}}


def _mock_repo(
    aioclient_mock: AiohttpClientMocker,
    files: dict[str, str],
    *,
    ref: str | None = None,
    default_branch: str = "main",
    sizes: dict[str, object] | None = None,
) -> None:
    """A public repo on GitHub: its default branch, the commit of `ref` and the files in it (`sizes`: what the file
    list says instead of the real size)."""
    aioclient_mock.get(API, json={"full_name": f"{OWNER}/{REPO}", "default_branch": default_branch})
    aioclient_mock.get(
        f"{API}/commits/{ref or default_branch}", json={"sha": COMMIT, "commit": {"tree": {"sha": TREE}}}
    )
    sizes = sizes or {}
    tree = [{"path": path, "type": "blob", "size": sizes.get(path, len(text.encode()))} for path, text in files.items()]
    folders = {path.rsplit("/", 1)[0] for path in files if "/" in path}
    tree += [{"path": folder, "type": "tree"} for folder in sorted(folders)]
    aioclient_mock.get(f"{API}/git/trees/{TREE}", json={"sha": TREE, "tree": tree, "truncated": False})
    for path, text in files.items():
        aioclient_mock.get(f"{RAW}/{path}", text=text)


def _pack_files(prefix: str = "") -> dict[str, str]:
    return {
        f"{prefix}pack.json": json.dumps(PACK_JSON),
        f"{prefix}cube_chair.json": json.dumps(CHAIR),
        f"{prefix}seating/stool.json": json.dumps(_stool()),
    }


async def _client(hass: HomeAssistant, hass_ws_client, token: str | None = None):
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return await hass_ws_client(hass, token) if token else await hass_ws_client(hass)


async def _install(client, url: str, **extra) -> dict:
    await client.send_json_auto_id({"type": "home_3d/packs/install_url", "url": url, **extra})
    return await client.receive_json()


async def _all_listed(client) -> list[dict]:
    await client.send_json_auto_id({"type": "home_3d/packs/list"})
    return (await client.receive_json())["result"]["packs"]


async def _listed(client) -> list[dict]:
    """The installed packs, without the ones that ship with Home 3D (#3)."""
    return [p for p in await _all_listed(client) if not p.get("bundled")]


async def test_a_repo_url_installs_the_pack_at_its_root(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    _mock_repo(aioclient_mock, {**_pack_files(), "README.md": "# Pack", ".github/workflows/check.yml": "on: push"})
    client = await _client(hass, hass_ws_client)

    result = await _install(client, f"https://github.com/{OWNER}/{REPO}")

    assert result["success"], result
    assert result["result"]["id"] == "test.starter"
    assert result["result"]["licence"] == "MIT"
    assert result["result"]["items"] == 2
    listed = await _listed(client)
    assert [p["id"] for p in listed] == ["test.starter"]
    assert sorted(item["id"] for item in listed[0]["items"]) == ["cube_chair", "stool"]
    # every request went to GitHub, and only for the pack's data (not its readme or hidden folders)
    hosts = {url.host for _method, url, _data, _headers in aioclient_mock.mock_calls}
    assert hosts <= {"api.github.com", "raw.githubusercontent.com"}
    fetched = {str(url) for _method, url, _data, _headers in aioclient_mock.mock_calls}
    assert f"{RAW}/README.md" not in fetched
    assert f"{RAW}/.github/workflows/check.yml" not in fetched


async def test_a_folder_url_installs_one_pack_of_a_packs_repo_and_keeps_its_origin(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    other = {f"test.other/{p}": t for p, t in _pack_files().items()}
    _mock_repo(aioclient_mock, {**_pack_files("test.starter/"), **other}, ref="main")
    client = await _client(hass, hass_ws_client)

    result = await _install(client, f"https://github.com/{OWNER}/{REPO}/tree/main/test.starter")

    assert result["success"], result
    origin = {
        "type": "github",
        "url": f"https://github.com/{OWNER}/{REPO}/tree/main/test.starter",
        "owner": OWNER,
        "repo": REPO,
        "ref": "main",
        "default_branch": False,
        "folder": "test.starter",
        "commit": COMMIT,
        "release": 3,
    }
    assert {k: v for k, v in result["result"]["origin"].items() if k != "fetched_at"} == origin
    listed = await _listed(client)
    assert {k: v for k, v in listed[0]["source"]["origin"].items() if k != "fetched_at"} == origin
    assert listed[0]["source"]["origin"]["fetched_at"] > 0
    # only the linked folder was fetched
    fetched = {str(url) for _method, url, _data, _headers in aioclient_mock.mock_calls}
    assert not any("/test.other/" in url for url in fetched)


async def test_a_repo_url_without_a_ref_follows_the_default_branch(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    _mock_repo(aioclient_mock, _pack_files(), default_branch="trunk")
    client = await _client(hass, hass_ws_client)

    result = await _install(client, f"github.com/{OWNER}/{REPO}.git/")

    assert result["success"], result
    origin = result["result"]["origin"]
    assert origin["url"] == f"https://github.com/{OWNER}/{REPO}"
    assert (origin["ref"], origin["default_branch"], origin["folder"]) == ("trunk", True, "")


async def test_a_release_url_installs_that_tag(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    _mock_repo(aioclient_mock, _pack_files(), ref="v3")
    client = await _client(hass, hass_ws_client)

    result = await _install(client, f"https://github.com/{OWNER}/{REPO}/releases/tag/v3")

    assert result["success"], result
    assert result["result"]["origin"]["ref"] == "v3"
    assert result["result"]["origin"]["commit"] == COMMIT


async def test_urls_that_are_not_a_github_repo_are_refused_without_a_fetch(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    client = await _client(hass, hass_ws_client)
    for url in (
        "https://gitlab.com/someone/packs",
        "https://example.com/amluto-solutions/home-3d-packs",
        "https://raw.githubusercontent.com/amluto-solutions/home-3d-packs/main/pack.json",
        "https://github.com/amluto-solutions",
        "https://github.com/amluto-solutions/home-3d-packs/blob/main/pack.json",
        "https://github.com/amluto-solutions/home-3d-packs/tree/main/../secrets",
        "https://user:pw@github.com/amluto-solutions/home-3d-packs",
        "ftp://github.com/amluto-solutions/home-3d-packs",
        # a port that is no port (#47)
        "github.com:99999/amluto-solutions/home-3d-packs",
        "https://github.com:abc/amluto-solutions/home-3d-packs",
        "not a url",
    ):
        result = await _install(client, url)
        assert not result["success"], url
        assert result["error"]["code"] == "bad_url", url
        assert "github.com/<owner>/<repo>" in result["error"]["message"], url
    assert aioclient_mock.call_count == 0


async def test_a_repo_or_folder_that_does_not_exist_is_refused_clearly(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.get(f"https://api.github.com/repos/{OWNER}/missing", status=404, json={"message": "Not Found"})
    _mock_repo(aioclient_mock, _pack_files("test.starter/"), ref="main")
    client = await _client(hass, hass_ws_client)

    result = await _install(client, f"https://github.com/{OWNER}/missing")
    assert result["error"]["code"] == "not_found"
    assert f"{OWNER}/missing" in result["error"]["message"]

    result = await _install(client, f"https://github.com/{OWNER}/{REPO}/tree/main/test.nothing")
    assert result["error"]["code"] == "not_found"
    assert "test.nothing" in result["error"]["message"]
    assert await _listed(client) == []


async def test_a_packs_repo_root_names_its_pack_folders(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    other = {f"test.other/{p}": t for p, t in _pack_files().items()}
    _mock_repo(aioclient_mock, {**_pack_files("test.starter/"), **other, "README.md": "# Packs"})
    client = await _client(hass, hass_ws_client)

    result = await _install(client, f"https://github.com/{OWNER}/{REPO}")

    assert result["error"]["code"] == "not_a_pack"
    message = result["error"]["message"]
    assert "test.other" in message and "test.starter" in message
    assert f"https://github.com/{OWNER}/{REPO}/tree/main/test.other" in message


async def test_an_invalid_pack_is_refused_like_a_folder_import(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    unlicensed = {k: v for k, v in PACK_JSON.items() if k != "licence"}
    _mock_repo(aioclient_mock, {**_pack_files(), "pack.json": json.dumps(unlicensed)})
    client = await _client(hass, hass_ws_client)

    result = await _install(client, f"https://github.com/{OWNER}/{REPO}")

    assert result["error"]["code"] == "no_licence"
    assert "pack.json" in result["error"]["message"]
    assert await _listed(client) == []


async def test_a_bad_item_is_refused_naming_the_file(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    bad = {**_stool(), "parts": [{**CHAIR["parts"][0], "w": "wide"}]}
    _mock_repo(aioclient_mock, {**_pack_files(), "seating/stool.json": json.dumps(bad)})
    client = await _client(hass, hass_ws_client)

    result = await _install(client, f"https://github.com/{OWNER}/{REPO}")

    assert result["error"]["code"] == "invalid_content"
    assert result["error"]["message"].startswith("seating/stool.json")


def _raw_fetched(aioclient_mock: AiohttpClientMocker) -> bool:
    return any(url.host == "raw.githubusercontent.com" for _m, url, _d, _h in aioclient_mock.mock_calls)


async def test_code_and_oversized_files_are_refused_before_anything_is_downloaded(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    client = await _client(hass, hass_ws_client)

    _mock_repo(aioclient_mock, {**_pack_files(), "install.py": "print(1)"})
    result = await _install(client, f"https://github.com/{OWNER}/{REPO}")
    assert result["error"]["code"] == "not_data" and "install.py" in result["error"]["message"]
    assert not _raw_fetched(aioclient_mock)

    aioclient_mock.clear_requests()
    _mock_repo(aioclient_mock, {**_pack_files(), "big.json": " " * 200_001})
    result = await _install(client, f"https://github.com/{OWNER}/{REPO}")
    assert result["error"]["code"] == "too_large" and "big.json" in result["error"]["message"]
    assert not _raw_fetched(aioclient_mock)

    aioclient_mock.clear_requests()
    _mock_repo(aioclient_mock, {**_pack_files(), **{f"i{n}.json": "{}" for n in range(1100)}})
    result = await _install(client, f"https://github.com/{OWNER}/{REPO}")
    assert result["error"]["code"] == "too_many_items"
    assert not _raw_fetched(aioclient_mock)


async def test_a_file_list_with_a_malformed_size_is_refused_clearly(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    """A size GitHub sends that is no number is refused as a bad answer, not an unknown error (#47)."""
    client = await _client(hass, hass_ws_client)
    for size in ("abc", -5, [1], 1.5):
        aioclient_mock.clear_requests()
        _mock_repo(aioclient_mock, _pack_files(), sizes={"cube_chair.json": size})
        result = await _install(client, f"https://github.com/{OWNER}/{REPO}")
        assert not result["success"], size
        assert result["error"]["code"] == "fetch_failed", (size, result)
        assert "cube_chair.json" in result["error"]["message"], size
        assert not _raw_fetched(aioclient_mock)


async def test_a_redirect_away_from_github_is_not_followed(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.get(API, status=301, headers={"Location": "https://evil.example.com/repos/x/y"})
    client = await _client(hass, hass_ws_client)

    result = await _install(client, f"https://github.com/{OWNER}/{REPO}")

    assert result["error"]["code"] == "fetch_failed"
    assert "evil.example.com" in result["error"]["message"]
    assert all(url.host == "api.github.com" for _m, url, _d, _h in aioclient_mock.mock_calls)


async def test_a_rate_limit_says_try_again_later(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    aioclient_mock.get(API, status=403, json={"message": "API rate limit exceeded"})
    client = await _client(hass, hass_ws_client)

    result = await _install(client, f"https://github.com/{OWNER}/{REPO}")

    assert result["error"]["code"] == "fetch_failed"
    assert "later" in result["error"]["message"]

    aioclient_mock.clear_requests()
    aioclient_mock.get(API, exc=aiohttp.ClientConnectionError("no route to host"))
    result = await _install(client, f"https://github.com/{OWNER}/{REPO}")
    assert result["error"]["code"] == "fetch_failed"
    assert "no route to host" in result["error"]["message"]


async def test_only_editors_may_install(
    hass: HomeAssistant, hass_ws_client, hass_read_only_access_token, aioclient_mock: AiohttpClientMocker
) -> None:
    _mock_repo(aioclient_mock, _pack_files())
    viewer = await _client(hass, hass_ws_client, hass_read_only_access_token)

    result = await _install(viewer, f"https://github.com/{OWNER}/{REPO}")

    assert result["error"]["code"] == "unauthorized"
    assert aioclient_mock.call_count == 0


async def test_the_origin_comes_back_from_a_backup_and_a_forged_one_is_dropped(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    _mock_repo(aioclient_mock, _pack_files())
    client = await _client(hass, hass_ws_client)
    assert (await _install(client, f"https://github.com/{OWNER}/{REPO}"))["success"]
    await client.send_json_auto_id({"type": "home_3d/backup/export"})
    backup = (await client.receive_json())["result"]
    entry = backup["packs"][0]
    origin = entry["source"]["origin"]

    await client.send_json_auto_id({"type": "home_3d/backup/import", "building": backup["building"], "packs": [entry]})
    assert (await client.receive_json())["success"]
    assert (await _listed(client))[0]["source"]["origin"] == origin

    forged_origin = {**origin, "url": "https://evil.example.com/x/y"}
    forged = {**entry, "source": {**entry["source"], "origin": forged_origin}}
    await client.send_json_auto_id({"type": "home_3d/backup/import", "building": backup["building"], "packs": [forged]})
    result = await client.receive_json()
    assert result["success"] and result["result"]["packs"] == 1
    # the list carries a pack's source only for its origin (#44)
    assert "origin" not in ((await _listed(client))[0].get("source") or {})


async def test_a_url_install_of_a_bundled_pack_follows_the_import_rule(
    hass: HomeAssistant, hass_ws_client, aioclient_mock: AiohttpClientMocker
) -> None:
    """amluto.living from the packs repository: an older copy leaves the bundled one in place (listed first), a
    copy with at least its release takes its place with its origin, removing that copy brings the bundled one back."""
    core = packs.read_folder(packs.BUNDLED_DIR / "amluto.living")
    meta = json.loads(core["pack.json"])
    url = f"https://github.com/{OWNER}/{REPO}/tree/main/amluto.living"

    def repo_at(release: int) -> None:
        aioclient_mock.clear_requests()
        files = {**core, "pack.json": json.dumps({**meta, "release": release, "name": f"Core release {release}"})}
        _mock_repo(aioclient_mock, {f"amluto.living/{p}": t for p, t in files.items()}, ref="main")

    client = await _client(hass, hass_ws_client)
    data = hass.data[DOMAIN]
    bundled_release = meta["release"] + 1
    data.bundled = [{**p, "release": bundled_release} for p in data.bundled]

    repo_at(bundled_release - 1)
    assert (await _install(client, url))["success"]
    listed = await _all_listed(client)
    living = next(p for p in listed if p["id"] == "amluto.living")
    assert living["bundled"] is True
    assert [p["id"] for p in listed].count("amluto.living") == 1

    repo_at(bundled_release)
    # it takes the bundled one's place: that asks first, naming it (#372)
    asked = await _install(client, url)
    assert asked["error"]["code"] == "replaces_bundled" and "amluto.living" in asked["error"]["message"]
    repo_at(bundled_release)
    assert (await _install(client, url, confirm=True))["success"]
    cores = [p for p in await _all_listed(client) if p["id"] == "amluto.living"]
    assert [(p["name"], p.get("bundled", False)) for p in cores] == [(f"Core release {bundled_release}", False)]
    assert cores[0]["source"]["origin"]["folder"] == "amluto.living"
    assert cores[0]["source"]["origin"]["release"] == bundled_release

    await client.send_json_auto_id({"type": "home_3d/packs/remove", "pack_id": "amluto.living"})
    assert (await client.receive_json())["success"]
    listed = await _all_listed(client)
    living = next(p for p in listed if p["id"] == "amluto.living")
    assert living["bundled"] is True
