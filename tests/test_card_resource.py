"""The card bundle is kept in the dashboard resources (#252)."""

from __future__ import annotations

from types import SimpleNamespace
from typing import Any

from custom_components.home_3d.card_resource import (
    LOADER_URL,
    async_ensure_card_resource,
    async_remove_card_resource,
    loader_source,
)


class FakeResources:
    """The parts of Lovelace's ResourceStorageCollection we use."""

    def __init__(self, items: list[dict[str, Any]]) -> None:
        self.items = items

    async def async_get_info(self) -> dict[str, int]:
        return {"resources": len(self.items)}

    def async_items(self) -> list[dict[str, Any]]:
        return self.items

    async def async_create_item(self, data: dict[str, Any]) -> dict[str, Any]:
        item = {"id": f"r{len(self.items)}", "type": data["res_type"], "url": data["url"]}
        self.items.append(item)
        return item

    async def async_update_item(self, item_id: str, updates: dict[str, Any]) -> dict[str, Any]:
        item = next(i for i in self.items if i["id"] == item_id)
        item.update({"type": updates["res_type"], "url": updates["url"]})
        return item

    async def async_delete_item(self, item_id: str) -> None:
        self.items = [i for i in self.items if i["id"] != item_id]


URL = "/api/home_3d/static/home-3d.js"


async def test_added_updated_and_removed() -> None:
    """Added once, older copies point to the current bundle, other resources stay, removal takes only ours."""
    other = {"id": "x", "type": "module", "url": "/hacsfiles/button-card/button-card.js"}
    res = FakeResources([dict(other)])
    hass = SimpleNamespace(data={"lovelace": SimpleNamespace(resources=res)})
    await async_ensure_card_resource(hass, URL)
    assert [i["url"] for i in res.items] == [other["url"], URL]
    # an update and an old hand-installed copy: both lead to the current bundle, nothing is added twice
    res.items[1]["url"] = "/home_3d_static/home-3d.js?v=1.12.3-old"
    res.items.append({"id": "old", "type": "module", "url": "/local/home-3d.js"})
    res.items.append({"id": "older", "type": "module", "url": "/home_3d_static/home-3d-loader.js?v=1.12.3-old"})
    await async_ensure_card_resource(hass, URL)
    assert [i["url"] for i in res.items] == [other["url"], URL, URL, URL]
    # one on the path before #218 is removed as well
    res.items.append({"id": "legacy", "type": "module", "url": "/home_3d_static/home-3d.js?v=1"})
    await async_remove_card_resource(hass)
    assert res.items == [other]


async def test_yaml_mode_and_old_layout() -> None:
    """YAML resources are left alone; the dict layout before HA 2025.2 works too."""
    yaml = SimpleNamespace(loaded=True, async_items=lambda: [])
    await async_ensure_card_resource(SimpleNamespace(data={"lovelace": SimpleNamespace(resources=yaml)}), URL)
    res = FakeResources([])
    await async_ensure_card_resource(SimpleNamespace(data={"lovelace": {"resources": res}}), URL)
    assert [i["url"] for i in res.items] == [URL]


async def test_loader_resource_replaces_the_bundle_and_goes_on_removal() -> None:
    """The loader takes the bundle's place in the resources (#461) and is removed with the integration."""
    res = FakeResources([{"id": "a", "type": "module", "url": URL}])
    hass = SimpleNamespace(data={"lovelace": SimpleNamespace(resources=res)})
    loader = LOADER_URL
    await async_ensure_card_resource(hass, loader)
    assert [i["url"] for i in res.items] == [loader]
    # #357: the loader under a build id (#340) goes back to the one URL for every build
    res.items[0]["url"] = f"{LOADER_URL}?v=0123456789ab"
    await async_ensure_card_resource(hass, loader)
    assert [i["url"] for i in res.items] == [loader]
    await async_remove_card_resource(hass)
    assert res.items == []


def test_loader_file() -> None:
    """The loader imports the bundle and tries again while the card is missing, only after a failed import: a bundle
    that loaded is never imported again under another URL (#218)."""
    text = loader_source(URL)
    assert f'const url = "{URL}";' in text
    assert "customElements.get(tag)" in text
    assert "let loaded = await load(0);" in text
    assert "!loaded && !customElements.get(tag)" in text


def test_loader_retries_a_new_copy_of_the_start_file() -> None:
    """#360: each retry imports the start file under a URL of its own (`?retry=<n>`), a new module the browser has not
    failed on; that copy then imports the app under a new URL too (boot-core.ts loadApp)."""
    text = loader_source(URL)
    assert "retry=${n}" in text
    assert "load(n)" in text
    assert "n <= 180" in text
