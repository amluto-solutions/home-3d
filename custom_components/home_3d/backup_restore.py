"""Restoring a backup's packs and custom items.

Packs sent ahead (#375): Home Assistant takes a websocket message of at most 4 MiB, and a backup carries every imported
pack with the files it came from. The frontend sends a backup's packs ahead in parts (`home_3d/backup/stage`, each part
one message), then `home_3d/backup/import` names the parts by their token and is checked and restored as one (#153).
Parts are kept in memory for a few minutes only and taken by the import that names them.

Custom items (#376): a custom item's id is a slug of its name ("shelf"), so a backup from another install may bring a
different "shelf". Placed copies of a custom item follow the item (#26), so taking the backup's over the local one would
change every placed shelf of the homes the backup leaves alone, and the other way round. An item whose id is taken by a
local item that looks different (or by a placed copy in a home the backup leaves alone) comes in under a free id
("shelf_2", named "Shelf (2)"), and the restored plans place it under that id. Pure functions, no event loop needed.
"""

from __future__ import annotations

import secrets
import time
from typing import Any

from .moves import migrate_building
from .packs import recipe_hash
from .recipes import CUSTOM_TYPE_PREFIX

MAX_ITEM_ID = 40
MAX_NAME = 80

# how long staged packs wait for the import that names them, and how many backups may be staged at once
STAGE_SECONDS = 15 * 60
MAX_STAGED = 4
# packs one backup may stage (a backup with more is refused)
MAX_STAGED_PACKS = 1000


class StagedPacks:
    """The packs of backups being sent in parts, by token."""

    def __init__(self) -> None:
        self._staged: dict[str, dict[str, Any]] = {}

    def _expire(self, now: float) -> None:
        for token in [t for t, entry in self._staged.items() if now - entry["at"] > STAGE_SECONDS]:
            del self._staged[token]

    def add(self, token: str | None, packs: list[dict[str, Any]]) -> str | None:
        """Keep a part of a backup's packs; the token to send the next part and the import with (a new one when
        `token` is None). None when `token` is unknown (expired) or the backup stages too many packs."""
        now = time.monotonic()
        self._expire(now)
        if token is None:
            while len(self._staged) >= MAX_STAGED:
                del self._staged[min(self._staged, key=lambda t: self._staged[t]["at"])]
            token = secrets.token_hex(16)
            self._staged[token] = {"at": now, "packs": []}
        entry = self._staged.get(token)
        if entry is None or len(entry["packs"]) + len(packs) > MAX_STAGED_PACKS:
            return None
        entry["packs"].extend(packs)
        entry["at"] = now
        return token

    def take(self, token: str) -> list[dict[str, Any]] | None:
        """The packs staged under a token, which is then forgotten; None when it is unknown (expired)."""
        self._expire(time.monotonic())
        entry = self._staged.pop(token, None)
        return None if entry is None else entry["packs"]


# ---------------------------------------------------------------------------- custom items (#376)


def _look(recipe: dict[str, Any]) -> str:
    """A fingerprint of what an item looks like and does: its recipe without its id and name."""
    return recipe_hash({k: v for k, v in recipe.items() if k not in ("id", "name")})


def _custom_copies(recipes: dict[str, Any] | None) -> dict[str, dict[str, Any]]:
    """A plan's copies of custom items, by item id."""
    return {c["item"]: c for t, c in (recipes or {}).items() if t.startswith(CUSTOM_TYPE_PREFIX)}


def _renamed(item: dict[str, Any], new_id: str, n: int) -> dict[str, Any]:
    suffix = f" ({n})"
    names = {lang: text[: MAX_NAME - len(suffix)] + suffix for lang, text in item["name"].items()}
    return {**item, "id": new_id, "name": names}


def resolve_items(
    items: list[dict[str, Any]],
    restored: list[dict[str, Any]],
    local_items: list[dict[str, Any]],
    local_recipes: list[dict[str, Any]],
    max_items: int,
) -> tuple[list[dict[str, Any]], dict[str, str], list[dict[str, str]]]:
    """A backup's checked custom items against the local ones: the items to restore (one per id, renamed where the
    id is taken by something that looks different), the renames (old id -> new id) the restored plans follow, and the
    items skipped (an earlier entry with the same id, more items than an install keeps). `restored` are the buildings
    being restored, `local_recipes` the recipe copies of the homes the backup leaves alone."""
    skipped: list[dict[str, str]] = []
    theirs_items: dict[str, dict[str, Any]] = {}
    for item in items:
        if item["id"] in theirs_items:
            skipped.append({"id": item["id"], "reason": "duplicate"})
        theirs_items[item["id"]] = item
    # what each id looks like here: the local item, and the placed copies in the homes left alone
    local: dict[str, set[str]] = {}
    for item in local_items:
        local.setdefault(item["id"], set()).add(_look(item))
    for recipes in local_recipes:
        for item_id, copy_ in _custom_copies(recipes).items():
            local.setdefault(item_id, set()).add(_look(copy_["recipe"]))
    # ... and in the backup: its item, else the copy a restored plan keeps of an item it no longer has
    theirs = {item_id: _look(item) for item_id, item in theirs_items.items()}
    for building in restored:
        for item_id, copy_ in _custom_copies(building.get("recipes")).items():
            theirs.setdefault(item_id, _look(copy_["recipe"]))
    renames: dict[str, str] = {}
    numbers: dict[str, int] = {}
    for item_id in sorted(theirs):
        look = theirs[item_id]
        if item_id not in local or local[item_id] == {look}:
            continue
        n = 2
        while True:
            new_id = f"{item_id[: MAX_ITEM_ID - len(str(n)) - 1]}_{n}"
            free = new_id not in theirs and new_id not in renames.values()
            if free and (new_id not in local or local[new_id] == {look}):
                break
            n += 1
        renames[item_id], numbers[item_id] = new_id, n
    kept = [
        _renamed(item, renames[item_id], numbers[item_id]) if item_id in renames else item
        for item_id, item in theirs_items.items()
    ]
    # an install keeps so many custom items: new ones past that are skipped, and listed
    known = {item["id"] for item in local_items}
    room = max_items - len(known)
    within: list[dict[str, Any]] = []
    for item in kept:
        if item["id"] in known:
            within.append(item)
        elif room > 0:
            within.append(item)
            room -= 1
        else:
            skipped.append({"id": item["id"], "reason": "too_many_items"})
    return within, renames, skipped


def with_renamed_items(building: dict[str, Any], renames: dict[str, str]) -> dict[str, Any]:
    """A restored plan placing the renamed custom items under their new ids (placed items, parking spots, racks and
    the recipe copies), so it shows what it showed."""
    if not renames:
        return building
    moves = {f"{CUSTOM_TYPE_PREFIX}{old}": f"{CUSTOM_TYPE_PREFIX}{new}" for old, new in renames.items()}
    return migrate_building(building, moves)


def resolve_backup_items(
    homes: list[dict[str, Any]],
    building: dict[str, Any] | None,
    items: list[dict[str, Any]],
    local_items: list[dict[str, Any]],
    local_recipes: list[dict[str, Any]],
    max_items: int,
) -> tuple[
    list[dict[str, Any]], dict[str, Any] | None, list[dict[str, Any]], list[dict[str, str]], list[dict[str, str]]
]:
    """resolve_items for a checked backup, with its plans following the renames: the homes, the single building, the
    items, the renames as [{"id", "as"}] and the skipped items."""
    restored = [h["building"] for h in homes] + ([building] if building is not None else [])
    kept, renames, skipped = resolve_items(items, restored, local_items, local_recipes, max_items)
    homes = [{**h, "building": with_renamed_items(h["building"], renames)} for h in homes]
    building = with_renamed_items(building, renames) if building is not None else None
    renamed = [{"id": old, "as": new} for old, new in sorted(renames.items())]
    return homes, building, kept, renamed, skipped
