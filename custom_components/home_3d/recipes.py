"""The plan's copies of the recipes of its pack items (#2).

A placed pack item is stored with its type "pack:<pack id>:<item id>"; the plan keeps one copy of that item's recipe
under `building["recipes"][type]`, one per type however often it is placed. The copy is what the views draw, so
removing a pack or installing a newer release of it never changes a placed item; an update replaces the copy on
purpose (#26).

A copy is {"pack", "item", "release", "hash", "recipe"} and, for a pack installed from GitHub, the "commit" its files
came from. `hash` is recipe_hash() of the recipe, so an update check compares it with the installed item.

This module only depends on voluptuous (through packs.py).
"""

from __future__ import annotations

from collections.abc import Iterator
import logging
from typing import Any

import voluptuous as vol

from .packs import CUSTOM_PACK_ID, ITEM_SCHEMA, PackError, no_links, recipe_hash

_LOGGER = logging.getLogger(__name__)

PACK_TYPE_PREFIX = "pack:"
# the household's own items (#13)
CUSTOM_TYPE_PREFIX = f"{PACK_TYPE_PREFIX}{CUSTOM_PACK_ID}:"
# one copy per pack item type in use; a plan has at most 20 floors of 1000 items
MAX_RECIPES = 2000

RECIPE_COPY_SCHEMA = vol.Schema(
    {
        vol.Required("pack"): vol.All(str, vol.Length(min=1, max=64)),
        vol.Required("item"): vol.All(str, vol.Length(min=1, max=40)),
        vol.Optional("release", default=1): vol.All(int, vol.Range(min=1, max=100000)),
        vol.Optional("hash"): str,
        vol.Optional("commit"): vol.Any(None, vol.All(str, vol.Match(r"^[0-9a-f]{7,64}$"))),
        vol.Required("recipe"): ITEM_SCHEMA,
    }
)


def _checked_copy(type_: str, entry: Any) -> dict[str, Any] | None:
    """A recipe copy as the plan keeps it (its hash computed again), or None when it does not check: a copy this
    version cannot read is dropped rather than refusing the whole plan."""
    try:
        clean = RECIPE_COPY_SCHEMA(entry)
        no_links(type_, clean["recipe"])
    except (vol.Invalid, PackError) as err:
        _LOGGER.warning("Dropping the plan's copy of %s: %s", type_, err)
        return None
    if f"{PACK_TYPE_PREFIX}{clean['pack']}:{clean['item']}" != type_ or clean["recipe"]["id"] != clean["item"]:
        _LOGGER.warning("Dropping the plan's copy of %s: it names another item", type_)
        return None
    clean["hash"] = recipe_hash(clean["recipe"])
    return clean


def recipes_validator(value: Any) -> dict[str, dict[str, Any]]:
    """The `recipes` of a building: pack item type -> recipe copy; copies that do not check are left out."""
    if not isinstance(value, dict):
        raise vol.Invalid("recipes must be a mapping of pack item types to recipe copies")
    if len(value) > MAX_RECIPES:
        raise vol.Invalid(f"at most {MAX_RECIPES} recipes")
    kept: dict[str, dict[str, Any]] = {}
    for type_, entry in value.items():
        if not isinstance(type_, str) or not type_.startswith(PACK_TYPE_PREFIX):
            raise vol.Invalid(f"not a pack item type: {type_!r}")
        if (clean := _checked_copy(type_, entry)) is not None:
            kept[type_] = clean
    return kept


def placed_types(building: dict[str, Any]) -> Iterator[str]:
    """The furniture types a building shows, once per placed item: its own type, the vehicles of a parking spot and
    the gear in a rack (#113) (frontend pack-recipes.ts packTypesIn walks the same way)."""
    for floor in building.get("floors", []):
        for item in floor.get("furniture", []):
            types = {item.get("type"), item.get("vehicle"), *(t.get("vehicle") for t in item.get("types") or [])}
            types.update(s.get("type") for s in ((item.get("rack") or {}).get("slots") or []))
            yield from (type_ for type_ in types if isinstance(type_, str))


def used_pack_types(building: dict[str, Any]) -> set[str]:
    """The pack item types a building shows: its furniture and the vehicles of its parking spots."""
    return {type_ for type_ in placed_types(building) if type_.startswith(PACK_TYPE_PREFIX)}


def recipe_copy(pack: dict[str, Any], item: dict[str, Any]) -> dict[str, Any]:
    """The plan's copy of an installed pack item."""
    entry: dict[str, Any] = {
        "pack": pack["id"],
        "item": item["id"],
        "release": pack.get("release", 1),
        "hash": recipe_hash(item),
        "recipe": item,
    }
    origin = (pack.get("source") or {}).get("origin")
    if isinstance(origin, dict) and origin.get("commit"):
        entry["commit"] = origin["commit"]
    return entry


def installed_copies(packs: list[dict[str, Any]]) -> dict[str, tuple[dict[str, Any], dict[str, Any]]]:
    """Every installed pack item by its type, with its pack."""
    return {f"{PACK_TYPE_PREFIX}{p['id']}:{i['id']}": (p, i) for p in packs for i in p.get("items", [])}


def _unchanged_but_stale(sent: dict[str, Any], kept: dict[str, Any] | None, base: str | None) -> bool:
    """The client sends the copy it started from while the plan's copy has changed since."""
    return base is not None and kept is not None and sent["hash"] == base and kept.get("hash") != base


def with_recipes(
    building: dict[str, Any],
    kept: dict[str, Any] | None,
    packs: list[dict[str, Any]],
    bases: dict[str, str] | None = None,
) -> dict[str, Any]:
    """The building with a recipe copy for every pack item type it uses, and no others.

    A type keeps the copy the building brings, else the one the plan kept before (`kept`: a client that does not know
    recipes, or an older frontend, sends none), else gets a copy of the installed item. A type whose pack is gone and
    that has no copy stays without one (it shows as a plain box, as before). The household's own items (#13) are the
    exception: their copies follow the item as it is now (#26), and keep the last copy only once the item is gone.

    `bases` are the hashes of the copies the client started from (#45): a copy it sends unchanged while the kept one
    has changed since (an update, a rollback or a custom item followed on the server meanwhile) gives way to the kept
    one.
    """
    own = building.get("recipes") or {}
    kept = kept or {}
    installed: dict[str, tuple[dict[str, Any], dict[str, Any]]] | None = None
    recipes: dict[str, dict[str, Any]] = {}
    for type_ in sorted(used_pack_types(building)):
        if type_.startswith(CUSTOM_TYPE_PREFIX):
            if installed is None:
                installed = installed_copies(packs)
            if type_ in installed:
                recipes[type_] = recipe_copy(*installed[type_])
                continue
        if type_ in own and not _unchanged_but_stale(own[type_], kept.get(type_), (bases or {}).get(type_)):
            recipes[type_] = own[type_]
        elif type_ in kept:
            recipes[type_] = kept[type_]
        else:
            if installed is None:
                installed = installed_copies(packs)
            if type_ in installed:
                recipes[type_] = recipe_copy(*installed[type_])
    return {**building, "recipes": recipes}
