"""Language packs (#196): a language's texts as a pack folder, checked, installed, listed and removed like a furniture
pack; English stays in the page and is the fallback for every key a pack lacks."""

from __future__ import annotations

import json

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.home_3d import pack_github, packs
from custom_components.home_3d.const import DOMAIN

PACK_JSON = {
    "format": "home3d-pack",
    "version": 2,
    "kind": "language",
    "language": "uk",
    "id": "community.lang-uk",
    "name": "Français",
    "publisher": "Community",
    "licence": "CC-BY-4.0",
}
STRINGS = {"view": "Vue 3D", "editor": "Éditeur", "bg_url_hint": "https://… ou un chemin comme /local/fond.jpg"}


def _folder(pack: dict | None = None, strings: dict | None = None, **extra: str) -> dict[str, str]:
    texts = STRINGS if strings is None else strings
    return {"pack.json": json.dumps(pack or PACK_JSON), "strings.json": json.dumps(texts)} | extra


def test_a_language_pack_folder_checks_like_a_pack() -> None:
    pack = packs.verify_folder(_folder(README="Merci"))
    assert pack["kind"] == "language" and pack["language"] == "uk"
    assert pack["strings"] == STRINGS
    assert pack["items"] == [] and pack["release"] == 1
    # a backup carries the files and checks them again on restore
    assert packs.verify_source(packs.source_of_folder(_folder()))["strings"] == STRINGS
    # the list counts the texts but does not send them; its hash follows them
    light = packs.library_pack(pack)
    assert "strings" not in light and light["texts"] == 3 and light["items"] == []
    changed = packs.library_pack(packs.verify_folder(_folder(strings={**STRINGS, "view": "3D"})))
    assert light["hash"] != changed["hash"]


@pytest.mark.parametrize(
    ("files", "code"),
    [
        (_folder(pack={k: v for k, v in PACK_JSON.items() if k != "language"}), "invalid_content"),
        (_folder(pack={**PACK_JSON, "language": "de-AT"}), "invalid_content"),
        (_folder(pack={**PACK_JSON, "kind": "theme"}), "needs_update"),
        (_folder(**{"chair.json": "{}"}), "not_data"),
        ({"pack.json": json.dumps(PACK_JSON)}, "invalid_content"),
        (_folder(strings={}), "invalid_content"),
        (_folder(strings={"View": "Vue"}), "invalid_content"),
        (_folder(strings={"view": 3}), "invalid_content"),
        (_folder(strings={"view": ""}), "invalid_content"),
        (_folder(strings={"view": "x" * 2001}), "invalid_content"),
        (_folder(strings={"view": "Voir https://example.org"}), "not_data"),
        (_folder(strings={"view": "Voir www.example.org"}), "not_data"),
        (_folder(strings={"view": "javascript:alert(1)"}), "not_data"),
        (_folder(strings={f"k{i}": "x" for i in range(packs.MAX_STRINGS + 1)}), "too_many_items"),
        ({**_folder(), "strings.json": json.dumps({"view": "x" * 1000}) * 401}, "too_large"),
    ],
)
def test_a_bad_language_pack_is_refused(files: dict[str, str], code: str) -> None:
    with pytest.raises(packs.PackError) as err:
        packs.verify_folder(files)
    assert err.value.code == code


def test_a_furniture_pack_keeps_its_own_limits() -> None:
    furniture = {k: v for k, v in PACK_JSON.items() if k not in ("kind", "language")}
    with pytest.raises(packs.PackError, match="language pack"):
        packs.verify_folder({"pack.json": json.dumps({**furniture, "language": "fr"})})
    # an item that happens to be called "strings" still has the item limit
    big = {"id": "strings", "name": {"en": "x" * 70_000}}
    with pytest.raises(packs.PackError) as err:
        packs.verify_folder({"pack.json": json.dumps(furniture), "strings.json": json.dumps(big)})
    assert err.value.code == "too_large"


def test_github_fetches_allow_a_larger_strings_file() -> None:
    assert pack_github._byte_limit("strings.json") == packs.MAX_STRINGS_SIZE * 4
    assert pack_github._byte_limit("seating/strings.json") == pack_github.MAX_FILE_BYTES


def test_the_bundled_german_pack_is_complete_and_checks() -> None:
    bundled = packs.load_bundled(packs.BUNDLED_LANGUAGES_DIR)
    german = next(p for p in bundled if p["id"] == "amluto.lang-de")
    assert german["bundled"] and german["language"] == "de" and german["licence"] == "MIT"
    assert len(german["strings"]) > 2000


LANGUAGES = ["de", "fr", "es", "nl", "it", "hu", "da", "sv", "nb", "nn", "fi", "cs", "pl", "ro", "sl", "zh", "pt"]


def test_every_language_ships_as_a_bundled_pack_that_checks() -> None:
    """#217: German and the 16 partial languages are bundled packs (no lang/*.json next to the bundles any more)."""
    bundled = packs.load_bundled(packs.BUNDLED_LANGUAGES_DIR)
    by_language = {p["language"]: p for p in bundled}
    assert sorted(by_language) == sorted(LANGUAGES)
    for code, pack in by_language.items():
        assert pack["id"] == f"amluto.lang-{code}" and pack["bundled"] and pack["licence"] == "MIT"
        assert len(pack["strings"]) > 500, code
        # every pack carries the locating setup and the item editor texts: those pages are not English-only any more
        assert "loc_title" in pack["strings"], code
    assert "ie_title" in by_language["de"]["strings"] and "st_title" in by_language["de"]["strings"]
    strings, ids = packs.language_of(bundled, "fr")
    assert ids == ["amluto.lang-fr"] and strings["editor"] == "Éditeur"


def test_several_packs_for_one_language_add_up_the_later_one_wins() -> None:
    first = {**packs.verify_folder(_folder()), "id": "a.uk"}
    second = {**packs.verify_folder(_folder(strings={"view": "Vue", "floor": "Étage"})), "id": "b.uk"}
    strings, ids = packs.language_of([first, second], "uk")
    assert ids == ["a.uk", "b.uk"]
    assert strings == {**STRINGS, "view": "Vue", "floor": "Étage"}
    assert packs.language_of([first], "de") == ({}, [])


async def _client(hass: HomeAssistant, hass_ws_client, token: str | None = None):
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return await hass_ws_client(hass, token) if token else await hass_ws_client(hass)


async def _call(client, **msg) -> dict:
    await client.send_json_auto_id(msg)
    return await client.receive_json()


async def test_german_comes_with_home_3d_and_is_sent_by_hash(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    got = (await _call(client, type="home_3d/languages/get", language="de"))["result"]
    assert got["packs"] == ["amluto.lang-de"]
    assert got["strings"]["no_persons"] == "In Home Assistant gibt es keine Personen."
    # the page has them already: only the hash comes back
    again = (await _call(client, type="home_3d/languages/get", language="de", hash=got["hash"]))["result"]
    assert again == {"language": "de", "packs": ["amluto.lang-de"], "hash": got["hash"]}
    # no pack for the language: no texts (English is in the page)
    none = (await _call(client, type="home_3d/languages/get", language="ja"))["result"]
    assert none["strings"] == {} and none["packs"] == []
    assert not (await _call(client, type="home_3d/languages/get", language="de-AT"))["success"]
    # the bundled pack is listed (with its count, not its texts) and cannot be removed
    listed = {p["id"]: p for p in (await _call(client, type="home_3d/packs/list"))["result"]["packs"]}
    assert listed["amluto.lang-de"]["kind"] == "language" and "strings" not in listed["amluto.lang-de"]
    removed = await _call(client, type="home_3d/packs/remove", pack_id="amluto.lang-de")
    assert removed["error"]["code"] == "bundled"


async def test_anyone_who_sees_home_3d_gets_the_texts(
    hass: HomeAssistant, hass_ws_client, hass_read_only_access_token: str
) -> None:
    client = await _client(hass, hass_ws_client, hass_read_only_access_token)
    got = await _call(client, type="home_3d/languages/get", language="de")
    assert got["success"] and got["result"]["strings"]


async def test_install_list_use_and_remove_a_language_pack(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    imported = await _call(client, type="home_3d/packs/import", files=_folder())
    assert imported["success"], imported
    assert imported["result"] == {
        "id": "community.lang-uk",
        "name": "Français",
        "publisher": "Community",
        "licence": "CC-BY-4.0",
        "items": 0,
        "kind": "language",
        "language": "uk",
        "texts": 3,
    }
    listed = {p["id"]: p for p in (await _call(client, type="home_3d/packs/list"))["result"]["packs"]}
    assert listed["community.lang-uk"]["texts"] == 3
    got = (await _call(client, type="home_3d/languages/get", language="uk"))["result"]
    assert got["strings"] == STRINGS and got["packs"] == ["community.lang-uk"]

    # a pack for German on top of the bundled one: its keys win, the rest stays German
    de = {**PACK_JSON, "language": "de", "id": "community.lang-de"}
    files = _folder(pack=de, strings={"view": "Ansicht"})
    assert (await _call(client, type="home_3d/packs/import", files=files))["success"]
    got = (await _call(client, type="home_3d/languages/get", language="de"))["result"]
    assert got["packs"] == ["amluto.lang-de", "community.lang-de"]
    assert got["strings"]["view"] == "Ansicht" and got["strings"]["no_persons"].startswith("In Home")

    assert (await _call(client, type="home_3d/packs/remove", pack_id="community.lang-uk"))["success"]
    got = (await _call(client, type="home_3d/languages/get", language="uk"))["result"]
    assert got["strings"] == {} and got["packs"] == []


async def test_a_newer_copy_of_the_bundled_german_replaces_it(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    newer = {**PACK_JSON, "language": "de", "id": "amluto.lang-de", "release": 3}
    files = _folder(pack=newer, strings={"view": "Neu"})
    # from files it is refused: only the packs repository may carry our ids (#372)
    refused = await _call(client, type="home_3d/packs/import", files=files, confirm=True)
    assert refused["error"]["code"] == "reserved_id"
    payload, source = packs.checked_folder(files)
    await hass.data[DOMAIN].async_add_pack(
        payload, {**source, "origin": {"type": "github", "owner": "amluto-solutions"}}
    )
    got = (await _call(client, type="home_3d/languages/get", language="de"))["result"]
    assert got["packs"] == ["amluto.lang-de"] and got["strings"] == {"view": "Neu"}
    # removing the copy brings the bundled one back
    assert (await _call(client, type="home_3d/packs/remove", pack_id="amluto.lang-de"))["success"]
    got = (await _call(client, type="home_3d/languages/get", language="de"))["result"]
    assert len(got["strings"]) > 2000
