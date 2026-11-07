"""Items that moved between packs (#110).

A placed pack item's type names its pack ("pack:<pack id>:<item id>"), so moving a bundled item into another pack
changes the id that every placed copy, recipe copy (#2), pin and rollback entry (#26) refers to. `moved_items.json`
next to this module lists every move as old type -> new type and ships with the integration; a test checks that
every entry leads to an item a bundled pack has.

Plans migrate wherever they come in: when a home loads (written back once, like the recipe copies), when a plan is
saved (an imported plan or home, a backup or a restore point being restored, the sample home). An old id still
resolves through the table, so a plan exported before a move loads and renders. A pack all of whose items moved away
can be retired: nothing needs it any more.

Home 3D's own packs were renamed from theovencook.* to amluto.* (#424). That is a rule, not ~3,000 table lines: every
type is read through `renamed_type` first (packs.RENAMED_PREFIXES), then through the table, whose entries name the
new ids. So "pack:theovencook.core:air_fryer" ends up as "pack:amluto.kitchen-bath:air_fryer" in one step, and an
item a pack dropped since (kept only as the plan's recipe copy) is renamed as well.

This module only depends on the standard library, packs.py and recipes.py.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from .packs import recipe_hash, renamed_pack_id
from .recipes import PACK_TYPE_PREFIX

_LOGGER = logging.getLogger(__name__)

MOVES_FILE = Path(__file__).parent / "moved_items.json"

Moves = dict[str, str]


def _resolved(table: dict[str, str]) -> Moves:
    """Every old type -> the type it ends up as, following a chain of moves (a -> b, later b -> c); an entry that
    loops is left out."""
    moves: Moves = {}
    for old in table:
        seen = {old}
        new = table[old]
        while new in table and new not in seen:
            seen.add(new)
            new = table[new]
        if new in seen:
            _LOGGER.error("The moved-items table loops at %s", old)
            continue
        moves[old] = new
    return moves


def parse_moves(data: Any) -> Moves:
    """The table of a parsed moved-items file: {"moved": {old type: new type}}; entries that are no pack item types
    are left out."""
    table = data.get("moved") if isinstance(data, dict) else None
    if not isinstance(table, dict):
        return {}
    clean = {
        renamed_type(old): renamed_type(new)
        for old, new in table.items()
        if isinstance(old, str) and isinstance(new, str) and split_type(old) and split_type(new)
    }
    return _resolved({old: new for old, new in clean.items() if old != new})


def load_moves(path: Path | None = None) -> Moves:
    """The moved-items table that ships with the integration (an empty one when it is missing or broken)."""
    path = path or MOVES_FILE
    try:
        return parse_moves(json.loads(path.read_text(encoding="utf-8")))
    except FileNotFoundError:
        return {}
    except (OSError, ValueError) as err:
        _LOGGER.error("The moved-items table %s cannot be read: %s", path, err)
        return {}


def split_type(type_: str) -> tuple[str, str] | None:
    """(pack id, item id) of a pack item type, or None."""
    if not type_.startswith(PACK_TYPE_PREFIX):
        return None
    pack, _, item = type_[len(PACK_TYPE_PREFIX) :].partition(":")
    return (pack, item) if pack and item else None


def renamed_type(type_: str) -> str:
    """A pack item type under its pack's new id (#424: theovencook.* -> amluto.*), else itself."""
    parts = split_type(type_)
    if parts is None or (pack := renamed_pack_id(parts[0])) == parts[0]:
        return type_
    return f"{PACK_TYPE_PREFIX}{pack}:{parts[1]}"


def resolve(type_: str, moves: Moves) -> str:
    """The type an item has now: its new type when its pack was renamed (#424) or it moved, else itself."""
    renamed = renamed_type(type_)
    return moves.get(renamed, renamed)


def moved_copy(entry: Any, new_type: str) -> Any:
    """A recipe copy under the item's new pack and id. Its recipe stays (the plan keeps what it showed); the release
    and commit named the old pack's, so they go (release 1: an update check then compares the recipe only)."""
    if not isinstance(entry, dict) or not isinstance(entry.get("recipe"), dict):
        return entry
    pack, item = split_type(new_type) or ("", "")
    recipe = {**entry["recipe"], "id": item}
    moved = {k: v for k, v in entry.items() if k not in ("release", "commit")}
    return {**moved, "pack": pack, "item": item, "release": 1, "recipe": recipe, "hash": recipe_hash(recipe)}


def migrate_building(building: dict[str, Any], moves: Moves) -> dict[str, Any]:
    """The building with every moved item under its new type: placed items, the vehicles of parking spots, the gear in
    racks and the recipe copies with their keys. The same object when nothing moved. An old id of our packs is renamed
    even with no table (#424)."""
    changed = False
    floors = []
    for floor in building.get("floors") or []:
        furniture = []
        for item in floor.get("furniture") or []:
            new = _migrated_item(item, moves)
            changed |= new is not item
            furniture.append(new)
        floors.append({**floor, "furniture": furniture})
    recipes: dict[str, Any] = {}
    own: dict[str, Any] | None = building.get("recipes")
    for type_, entry in (own or {}).items():
        new_type = resolve(type_, moves)
        if new_type == type_:
            recipes.setdefault(type_, entry)
            continue
        changed = True
        # a plan that already has a copy under the new type keeps that one
        if new_type not in (own or {}):
            recipes[new_type] = moved_copy(entry, new_type)
    if not changed:
        return building
    result = {**building, "floors": floors}
    if own is not None:
        result["recipes"] = recipes
    return result


def _migrated_item(item: dict[str, Any], moves: Moves) -> dict[str, Any]:
    def moved(value: Any) -> bool:
        return isinstance(value, str) and resolve(value, moves) != value

    changes: dict[str, Any] = {}
    for key in ("type", "vehicle"):
        value = item.get(key)
        if isinstance(value, str) and moved(value):
            changes[key] = resolve(value, moves)
    types = item.get("types")
    if isinstance(types, list) and any(isinstance(t, dict) and moved(t.get("vehicle")) for t in types):
        changes["types"] = [
            {**t, "vehicle": resolve(t["vehicle"], moves)} if isinstance(t, dict) and moved(t.get("vehicle")) else t
            for t in types
        ]
    # gear in a rack is placed by slot type (#113)
    rack = item.get("rack")
    slots = rack.get("slots") if isinstance(rack, dict) else None
    if (
        isinstance(rack, dict)
        and isinstance(slots, list)
        and any(isinstance(s, dict) and moved(s.get("type")) for s in slots)
    ):
        changes["rack"] = {
            **rack,
            "slots": [
                {**s, "type": resolve(s["type"], moves)} if isinstance(s, dict) and moved(s.get("type")) else s
                for s in slots
            ],
        }
    return {**item, **changes} if changes else item


def migrate_bases(
    bases: dict[str, str] | None, sent: dict[str, Any], migrated: dict[str, Any], moves: Moves
) -> dict[str, str] | None:
    """The recipe hashes a client started from (#45) under the new types. A copy's hash changes with its move (the
    recipe names its item), so a copy the client sent as it started from it keeps counting as unchanged: its base
    becomes the moved copy's hash."""
    if not bases:
        return bases
    before = sent.get("recipes") or {}
    after = migrated.get("recipes") or {}
    out: dict[str, str] = {}
    for type_, base in bases.items():
        new_type = resolve(type_, moves)
        old, new = before.get(type_), after.get(new_type)
        if new_type != type_ and isinstance(old, dict) and isinstance(new, dict) and old.get("hash") == base:
            base = new["hash"]
        out[new_type] = base
    return out


def _pack_of(type_: str) -> str:
    return (split_type(type_) or ("", ""))[0]


def moved_out_of(pack_id: str, moves: Moves) -> dict[str, str]:
    """The items that moved out of a pack: new type -> their old item id in it."""
    return {new: (split_type(old) or ("", ""))[1] for old, new in moves.items() if _pack_of(old) == pack_id}


def moved_into(moves: Moves) -> dict[str, dict[str, str]]:
    """The old ids that lead to each pack's items: pack id -> {old type: item id} (the library lists them, so a
    browser resolves an old id as well)."""
    out: dict[str, dict[str, str]] = {}
    for old, new in moves.items():
        pack, item = split_type(new) or ("", "")
        out.setdefault(pack, {})[old] = item
    return out


def retired_packs(moves: Moves, installed: set[str]) -> set[str]:
    """The packs items moved out of that are no longer installed."""
    return {_pack_of(old) for old in moves} - installed


def migrate_pins(pinned: set[str], moves: Moves, installed: set[str]) -> set[str]:
    """The pinned packs (#26) after moves: a pinned pack's pin also holds every pack its items moved into, and a
    retired pack keeps no pin. A pin under an old id of our packs follows it to the new id (#424)."""
    pinned = {renamed_pack_id(p) for p in pinned}
    out = set(pinned) | {_pack_of(new) for old, new in moves.items() if _pack_of(old) in pinned}
    return out - retired_packs(moves, installed)
