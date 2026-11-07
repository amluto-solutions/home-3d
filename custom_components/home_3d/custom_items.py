"""The household's own items (#13), made in the item editor.

They are plain pack v2 items (docs/packs.md), checked with the same schema as a pack's item files, kept in `.storage`
and shared by everyone who uses this Home Assistant. The library gets them as one more pack, `household.custom`, so
in a plan a custom item is the furniture type `pack:household.custom:<item id>`, on every install that has it. An
exported item is an item file; it imports on another install as it is. Custom items never go into a pack folder of
this repository.
"""

from __future__ import annotations

from typing import Any

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

from .const import STORAGE_KEY_ITEMS, STORAGE_VERSION
from .off_loop import OFF_LOOP
from .packs import CUSTOM_PACK_ID, MAX_ITEMS, PACK_FORMAT_V2, PACK_VERSION_V2, PackError, verify_item


def not_reserved(pack: dict[str, Any]) -> dict[str, Any]:
    """A pack being imported, installed or restored, unless it takes the custom items' pack id; raises PackError."""
    if pack.get("id") == CUSTOM_PACK_ID:
        raise PackError("reserved", f"{CUSTOM_PACK_ID} holds this home's own items: import them in the item editor")
    return pack


def custom_pack(items: list[dict[str, Any]]) -> dict[str, Any]:
    """The custom items as a pack, as the library takes packs (`custom` marks it for the extensions page)."""
    return {
        "format": PACK_FORMAT_V2,
        "version": PACK_VERSION_V2,
        "id": CUSTOM_PACK_ID,
        "name": "Your own items",
        "publisher": "This home",
        # the household's own work: no licence is stated for it
        "licence": "NOASSERTION",
        "release": 1,
        "description": "",
        "features": [],
        "custom": True,
        "items": items,
    }


class CustomItems:
    """The custom items of one installation."""

    def __init__(self, hass: HomeAssistant) -> None:
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_ITEMS, **OFF_LOOP)
        self.items: list[dict[str, Any]] = []

    async def async_load(self) -> None:
        stored = await self._store.async_load()
        self.items = list((stored or {}).get("items", []))

    def pack(self) -> dict[str, Any] | None:
        """The pack to offer, None while there are no custom items."""
        return custom_pack(self.items) if self.items else None

    async def async_save(self, item: Any) -> dict[str, Any]:
        """Check an item and keep it; an item with the same id is replaced (so placed copies follow the change).
        Raises PackError."""
        clean = verify_item(item)
        if any(i["id"] == clean["id"] for i in self.items):
            self.items = [clean if i["id"] == clean["id"] else i for i in self.items]
        elif len(self.items) >= MAX_ITEMS:
            raise PackError("too_many_items", f"at most {MAX_ITEMS} custom items")
        else:
            self.items = [*self.items, clean]
        await self._store.async_save({"items": self.items})
        return clean

    async def async_replace(self, items: list[dict[str, Any]]) -> None:
        """Replace every custom item with checked ones (a backup being restored); the last of an id wins."""
        self.items = list({i["id"]: i for i in items}.values())[:MAX_ITEMS]
        await self._store.async_save({"items": self.items})

    async def async_remove(self, item_id: str) -> bool:
        """Remove an item (placed copies stay in the plan and keep their recipe copy)."""
        kept = [i for i in self.items if i["id"] != item_id]
        if len(kept) == len(self.items):
            return False
        self.items = kept
        await self._store.async_save({"items": self.items})
        return True
