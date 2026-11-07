"""Rack contents (#113): the gear in a placed rack, kept on the rack item as `rack: {"slots": [...]}`.

A rack is a pack item with a `rack_frame` spec, gear a pack item with a `rack` spec (packs.py). A slot names its gear's
pack item type and its lowest rail position counted from the bottom (`u`, 1 = the lowest U, whatever the rack's
numbering). The schema checks the slots' shape on every save; `new_rack_problems` is what an editor's save is refused
for: gear that overlaps other gear, sticks out of the rack, is deeper than the rails or wider than a side lane, is no
gear or is made for the other rack width. The rules are frontend/src/rack.ts's, at the rack's placed size (#124). They
read the plan's recipe copies, so they hold for whatever the plan shows; gear whose recipe is gone is not checked, but
holds its lowest U as in the editor.

A slot may carry a column and a face (#114) and links to Home Assistant (#119: `entity`, its status entity, and
`links`, further entities of the device; frontend/src/rack-links.ts). The schema keeps unknown slot fields, like the
rest of the plan's schema. `card` (#120) holds the editor's pick of values for the rack card (rack-card.ts).
"""

from __future__ import annotations

from collections.abc import Iterator
import math
from typing import Any

import voluptuous as vol

from .packs import RACK_PANEL_WIDTH, RACK_SLACK, RACK_UNIT

# at most this many pieces of gear in one rack
RACK_MAX_SLOTS = 60
# at most this many further entities linked to one piece of gear (#119)
RACK_MAX_LINKS = 16
# at most this many values on a rack's card (#120, frontend rack-card.ts RACK_CARD_MAX)
RACK_CARD_MAX = 8
_MAX_U = 60

_SLOT_ID = vol.All(str, vol.Length(min=1, max=64), vol.Match(r"^[A-Za-z0-9_\-.]+$"))


_ENTITY_ID = vol.All(str, vol.Length(max=255), vol.Match(r"^[a-z0-9_]+\.[a-z0-9_]+$"))


def _unique(values: list[str]) -> list[str]:
    if len(set(values)) != len(values):
        raise vol.Invalid("each entity is linked once")
    return values


def _position(value: Any) -> int:
    """A whole rail position (not true or false, which Python counts as numbers)."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise vol.Invalid("expected a whole number of U")
    return value


RACK_SLOT_SCHEMA = vol.Schema(
    {
        vol.Required("id"): _SLOT_ID,
        # the gear's pack item type
        vol.Required("type"): vol.All(str, vol.Length(min=1, max=96)),
        # its lowest rail position, 1 = the lowest U
        vol.Required("u"): vol.All(_position, vol.Range(min=1, max=_MAX_U)),
        # its own name; None = the item's name
        vol.Optional("name"): vol.Any(None, vol.All(str, vol.Length(max=60))),
        # #114: its column (half / third width 0-1 / 0-2; 0U gear its side lane, 0 left, 1 right), its face, and
        # for loose gear the shelf slot it stands on (its `u` is then the shelf's)
        vol.Optional("col"): vol.All(_position, vol.Range(min=0, max=2)),
        vol.Optional("face"): vol.Any(None, vol.In(["front", "rear"])),
        vol.Optional("on"): vol.Any(None, _SLOT_ID),
        # #119: its status entity (its LED) and further entities of the same device
        vol.Optional("entity"): vol.Any(None, _ENTITY_ID),
        vol.Optional("links"): vol.Any(None, vol.All([_ENTITY_ID], vol.Length(max=RACK_MAX_LINKS), _unique)),
    },
    extra=vol.ALLOW_EXTRA,
)


def _unique_ids(slots: list[dict[str, Any]]) -> list[dict[str, Any]]:
    ids = [s["id"] for s in slots]
    if len(set(ids)) != len(ids):
        raise vol.Invalid("every slot of a rack has its own id")
    return slots


# a value on the rack card: an entity, or a figure over the whole rack (rack-card.ts RACK_HOTTEST / RACK_ONLINE)
_CARD_METRIC = vol.Any(_ENTITY_ID, vol.In(["@hottest", "@online"]))

# #120: the card over the rack; `metrics` is the editor's pick (None: the default set, []: no card)
RACK_CARD_SCHEMA = vol.Schema(
    {vol.Optional("metrics"): vol.Any(None, vol.All([_CARD_METRIC], vol.Length(max=RACK_CARD_MAX), _unique))},
    extra=vol.ALLOW_EXTRA,
)

RACK_CONTENTS_SCHEMA = vol.Schema(
    {
        vol.Required("slots"): vol.All([RACK_SLOT_SCHEMA], vol.Length(max=RACK_MAX_SLOTS), _unique_ids),
        vol.Optional("card"): vol.Any(None, RACK_CARD_SCHEMA),
    },
    extra=vol.ALLOW_EXTRA,
)

# (rack item id, slot id, why): why is "overlap", "outside", "not_gear", "wrong_width", "no_rear", "no_lane",
# "too_deep", "no_shelf", "not_loose", "too_tall" or "shelf_full" (rack.ts RackRefusal)
RackProblem = tuple[str, str, str]


def _recipe(recipes: dict[str, Any], type_: str) -> dict[str, Any] | None:
    copy_ = recipes.get(type_)
    recipe = copy_.get("recipe") if isinstance(copy_, dict) else None
    return recipe if isinstance(recipe, dict) else None


def _rack_items(building: dict[str, Any]) -> Iterator[dict[str, Any]]:
    for floor in building.get("floors") or []:
        for item in floor.get("furniture") or []:
            if isinstance(item.get("rack"), dict):
                yield item


# the clear opening between the rails a shelf gives loose gear, by rack width (rack-frame.ts RACK_OPENING)
_OPENING = {19: 0.45085, 10: 0.22225}
_COLUMNS = {"full": 1, "half": 2, "third": 3}
# 0U gear: a lane down the left (col 0) and one down the right (col 1)
_LANES = 2
# a shelf's tray: loose gear stands this high above the bottom of its lowest U (rack.ts SHELF_TRAY)
SHELF_TRAY = 0.004


def _lane_units(height: float) -> int:
    """How many U a 0U item standing in a side lane is long (rack.ts laneUnits)."""
    return max(1, math.ceil(height / RACK_UNIT - 0.02))


def _size(recipe: dict[str, Any]) -> list[float]:
    size = recipe.get("size")
    return size if isinstance(size, list) and len(size) == 3 else [0.0, 0.0, 0.0]


def _faces(slot: dict[str, Any], gear: dict[str, Any]) -> set[str]:
    """Full-depth gear takes both faces, other gear the one it is on."""
    if gear.get("depth") == "full":
        return {"front", "rear"}
    return {"rear" if slot.get("face") == "rear" else "front"}


def _columns(gear: dict[str, Any]) -> int:
    return _COLUMNS.get(gear.get("width", "full"), 1)


def _beside(a: dict[str, Any], b: dict[str, Any]) -> bool:
    """Whether two placed pieces of the same kind (U gear, or 0U gear) take some of the same width or lane."""
    if a["lane"]:
        return a["col"] == b["col"]
    na, nb = _columns(a["gear"]), _columns(b["gear"])
    return a["col"] / na < (b["col"] + 1) / nb - 1e-9 and b["col"] / nb < (a["col"] + 1) / na - 1e-9


def _whole_col(col: Any, cols: int) -> bool:
    return isinstance(col, int) and not isinstance(col, bool) and 0 <= col < cols


# how far the rails sit in from the front and the back of the item, by form (rack-frame.ts FRONT_INSET / REAR_INSET)
RACK_FRONT_INSET = {"frame2": 0, "frame4": 0, "cabinet": 0.08, "wall_frame": 0.02, "wall_cabinet": 0.06}
RACK_REAR_INSET = {"frame2": 0, "frame4": 0.02, "cabinet": 0.05, "wall_frame": 0.01, "wall_cabinet": 0.04}


def _space(frame: dict[str, Any], item: dict[str, Any], recipe: dict[str, Any]) -> dict[str, float]:
    """How deep gear may be and how wide the side lanes are in a rack placed at its size (rack-frame.ts rackLayout,
    the editor's rackOf)."""
    size = _size(recipe)

    def dim(key: str, i: int) -> float:
        value = item.get(key)
        if isinstance(value, (int, float)) and not isinstance(value, bool):
            return max(0.05, float(value))
        return max(0.05, size[i])

    w, d = dim("w", 0), dim("d", 1)
    form = frame.get("form", "frame4")
    front, rear = RACK_FRONT_INSET.get(form, 0), RACK_REAR_INSET.get(form, 0)
    two_post = form == "frame2"
    room = d if two_post else max(0.01, d - front - rear)
    own = frame.get("mount_depth")
    mount = min(own if isinstance(own, (int, float)) else room, d if two_post else d - front)
    panel = min(w, RACK_PANEL_WIDTH.get(frame.get("width", 19), RACK_PANEL_WIDTH[19]))
    return {"mount": mount, "lane": max(0.0, (w - panel) / 2)}


def _gear_problem(
    slot: dict[str, Any], gear: dict[str, Any], recipe: dict[str, Any], frame: dict[str, Any], space: dict[str, float]
) -> tuple[str | None, int]:
    """Why a slot's gear does not fit the rack on its own (None: it does), and how many U it takes (rack.ts checkSlot,
    in its order)."""
    lane = gear.get("u", 0) < 1
    n = _lane_units(_size(recipe)[2]) if lane else gear["u"]
    if gear.get("inch", 19) != frame.get("width", 19):
        return "wrong_width", n
    low = slot.get("u", 0)
    if low < 1 or low + n - 1 > frame.get("u", 0):
        return "outside", n
    if not _whole_col(slot.get("col", 0), _LANES if lane else _columns(gear)):
        return "outside", n
    if slot.get("face") == "rear" and frame.get("form") == "frame2":
        return "no_rear", n
    width, depth, _ = _size(recipe)
    if lane and width > space["lane"] + RACK_SLACK:
        return "no_lane", n
    if depth > space["mount"] + RACK_SLACK:
        return "too_deep", n
    return None, n


def _rack_slot_problems(
    item: dict[str, Any], frame: dict[str, Any], frame_recipe: dict[str, Any], recipes: dict[str, Any]
) -> set[RackProblem]:
    """The rule breaks of one rack's slots: each slot checked against all the others, as rack.ts rackMisfits does.
    A slot whose recipe is gone is not checked; it and anything that is no gear hold their lowest U."""
    rack_id = item["id"]
    slots = [s for s in item["rack"].get("slots") or [] if isinstance(s, dict)]
    space = _space(frame, item, frame_recipe)
    problems: set[RackProblem] = set()
    pieces: list[dict[str, Any]] = []
    shelves: dict[str, dict[str, float]] = {}
    for slot in slots:
        if slot.get("on"):
            continue
        recipe = _recipe(recipes, slot.get("type", ""))
        gear = recipe.get("rack") if recipe is not None else None
        low = slot.get("u", 0)
        if recipe is None or not isinstance(gear, dict):
            # unknown, or no gear: it holds its one U, on both faces, across the whole width
            pieces.append({"slot": slot, "gear": None, "why": None if recipe is None else "not_gear", "units": {low}})
            continue
        why, n = _gear_problem(slot, gear, recipe, frame, space)
        pieces.append(
            {
                "slot": slot,
                "gear": gear,
                "why": why,
                "lane": gear["u"] < 1,
                "col": slot.get("col", 0),
                "units": set(range(low, low + n)),
                "faces": _faces(slot, gear),
            }
        )
        if gear.get("shelf"):
            width = _OPENING.get(frame.get("width", 19), _OPENING[19]) / _columns(gear)
            shelves[slot["id"]] = {"w": width, "d": _size(recipe)[1], "h": gear["u"] * RACK_UNIT - SHELF_TRAY}
    for me in pieces:
        why = me["why"]
        if why is None and me["gear"] is not None and any(o is not me and _hits(me, o) for o in pieces):
            why = "overlap"
        if why:
            problems.add((rack_id, me["slot"]["id"], why))
    loose = [s for s in slots if s.get("on")]
    for slot in loose:
        recipe = _recipe(recipes, slot.get("type", ""))
        if recipe is None:
            continue
        beside = [_recipe(recipes, o.get("type", "")) for o in loose if o is not slot and o.get("on") == slot["on"]]
        why = _loose_problem(shelves.get(slot["on"]), recipe, [r for r in beside if r is not None])
        if why:
            problems.add((rack_id, slot["id"], why))
    return problems


def _hits(me: dict[str, Any], other: dict[str, Any]) -> bool:
    """Whether a piece of gear shares a place with another slot (rack.ts checkSlot's `hits`)."""
    if other["gear"] is None:
        return not me["lane"] and bool(me["units"] & other["units"])
    return (
        other["lane"] == me["lane"]
        and bool(me["units"] & other["units"])
        and bool(me["faces"] & other["faces"])
        and _beside(me, other)
    )


def _loose_problem(shelf: dict[str, float] | None, recipe: dict[str, Any], beside: list[dict[str, Any]]) -> str | None:
    """Why loose gear can't stand on its shelf beside the other loose gear there (None: it can; rack.ts checkLoose)."""
    if shelf is None:
        return "no_shelf"
    if "rack_frame" in recipe:
        return "not_loose"
    width, depth, height = _size(recipe)
    if height > shelf["h"] + RACK_SLACK:
        return "too_tall"
    if depth > shelf["d"] + RACK_SLACK:
        return "too_deep"
    used = sum(_size(r)[0] for r in beside if "rack_frame" not in r)
    if used + width > shelf["w"] + RACK_SLACK:
        return "shelf_full"
    return None


def rack_problems(building: dict[str, Any]) -> set[RackProblem]:
    """Every slot of every rack in the plan that breaks a placement rule."""
    recipes = building.get("recipes") or {}
    problems: set[RackProblem] = set()
    for item in _rack_items(building):
        frame_recipe = _recipe(recipes, item.get("type", "")) or {}
        frame = frame_recipe.get("rack_frame")
        if isinstance(frame, dict):
            problems |= _rack_slot_problems(item, frame, frame_recipe, recipes)
    return problems


def _frames(building: dict[str, Any]) -> dict[str, tuple[Any, ...]]:
    """Each rack's frame as placed: its type and size (a change of either may leave gear outside it)."""
    return {
        item["id"]: (item.get("type"), item.get("w"), item.get("d"), item.get("h")) for item in _rack_items(building)
    }


def _slots(building: dict[str, Any]) -> dict[tuple[str, Any], Any]:
    """Every slot of every rack, by (rack item id, slot id)."""
    return {
        (item["id"], slot.get("id")): slot
        for item in _rack_items(building)
        for slot in item["rack"].get("slots") or []
        if isinstance(slot, dict)
    }


def new_rack_problems(before: dict[str, Any], after: dict[str, Any]) -> set[RackProblem]:
    """The rule breaks `after` has that `before` had not: a plan that broke them already (a pack update made a box
    taller) still saves while that stays as it was. A rack whose frame changed in this save (another rack type, or
    resized, #114) keeps the gear it had and saves too: the editor names what no longer fits. Gear added or moved in
    the same save is checked against the new frame (#124)."""
    new = rack_problems(after) - rack_problems(before)
    old = _frames(before)
    changed = {rack for rack, frame in _frames(after).items() if rack in old and old[rack] != frame}
    if not changed or not new:
        return new
    old_slots, new_slots = _slots(before), _slots(after)

    def excused(problem: RackProblem) -> bool:
        key = (problem[0], problem[1])
        return problem[0] in changed and key in old_slots and old_slots[key] == new_slots.get(key)

    return {p for p in new if not excused(p)}


class RackError(ValueError):
    """A save refused for rack gear that does not fit; `problems` says which and why."""

    def __init__(self, problems: set[RackProblem]) -> None:
        self.problems = problems
        super().__init__(
            "; ".join(f"{slot} in {item}: {why}" for item, slot, why in sorted(problems)) or "rack gear does not fit"
        )
