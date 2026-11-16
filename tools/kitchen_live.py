"""Live parts for our own kitchen items (#467): doors, drawers and appliance doors that move with Home Assistant.

    from kitchen_live import convert
    live = convert(item)      # the item as a dict (a pack item file), or None when there is nothing to make live

The items of amluto.kitchen-bath and amluto.ikea-uk are hand-written files, so `tools/gen_kitchen_live.py` runs this
over them once and the files are the source from then on; the generator of the corner sink units
(gen_kitchen_worktop.py) calls `convert` too, so a rebuild keeps the change. Nothing here changes how an item looks
closed: the parts it had stay as they were (only a `bind` is added), and everything new (the inside of a cupboard, a
drawer box, the liner of an oven) sits behind the closed front, inside the item's own solid body.

What an item gets, by what it is:
- a door of a cupboard turns about its hinge edge (the side opposite its handle), slot `door` (a door contact);
- a drawer slides out with a drawer box behind its front, slot `drawer` (a drawer contact); a tall front with a handle
  in its middle (a pull-out larder, a bin) slides out too;
- an oven, a dishwasher and a range cooker's oven fold down about their bottom edge (90 degrees), a lift-up wall cabinet
  turns up about its top edge, a fridge or freezer door turns about its hinge, a microwave's door turns sideways;
- behind each front a dark (or, for ovens, steel; for fridges, white) liner shows when it is open, and a cupboard door
  gets a shelf or two, so an open door never shows the plain face of the solid body.
Doors that share a hinge line (two stacked doors of a larder) share a slot and turn as one piece; doors side by side
that cannot (two left-hinged doors) get a slot each, and so do drawers in different rows.
"""

from __future__ import annotations

import copy
from dataclasses import dataclass, field
import json
import sys

SHARED = ("body", "metal", "glass", "#7fe3ff")
# the item families whose fronts the generic reading below handles (everything else is explicit or left alone)
CABINET_FAMILIES = {
    "shaker_base_unit",
    "shaker_wall_unit",
    "drawer_stack",
    "larder_unit",
    "pull_out_bin",
    "oven_housing",
    "peninsula",
    "metod_base_cabinet",
    "metod_wall_cabinet",
    "enhet_base_cabinet",
    "havsen_sink",
    "knoxhult_kitchen",
    "corner_sink_inset_left",
    "corner_sink_inset_right",
    "corner_sink_belfast_left",
    "corner_sink_belfast_right",
    "built_in_oven",
    "range_cooker",
    "under_counter_fridge",
}
BLIND_CORNERS = {"blind_corner_unit_left", "blind_corner_unit_right"}
DISHWASHERS = {"rengora_integrated_dishwasher_60"}


@dataclass
class Front:
    """One front that moves: its parts (indices), its box in metres and what it does."""

    idx: list[int]
    x0: float
    x1: float
    y0: float
    y1: float
    z0: float  # the back of its slab: the face of the item's body behind it
    z1: float  # the front of its slab
    kind: str  # door, drawer, pullout, fold, lift, side (a microwave's door), fridge
    hinge: str = "left"
    liner: str = "dark"
    name: str | None = None
    fix: str = ""
    slot: str = ""
    extra: dict = field(default_factory=dict)

    @property
    def w(self) -> float:
        return self.x1 - self.x0

    @property
    def h(self) -> float:
        return self.y1 - self.y0


def _box(p: dict, W: float, D: float, H: float) -> tuple[float, float, float, float, float, float]:
    cx, cz, w, d = p["x"] * W, p["z"] * D, p["w"] * W, p["d"] * D
    return cx - w / 2, cx + w / 2, p["y"] * H, min(1.0, p["y"] + p["h"]) * H, cz - d / 2, cz + d / 2


def _is_slab(p: dict, W: float, D: float, H: float) -> bool:
    """A cupboard front: a box in the body colour 15 to 24 mm thick, in the front half of the item."""
    if p["shape"] != "box" or p["color"] != "body":
        return False
    x0, x1, y0, y1, z0, z1 = _box(p, W, D, H)
    return 0.014 <= z1 - z0 <= 0.024 and x1 - x0 >= 0.1 and y1 - y0 >= 0.1 and (z0 + z1) / 2 > -0.05


def _is_oven_door(p: dict, W: float, D: float, H: float) -> bool:
    """The door of an oven or microwave: a dark box with a steel top, 20 mm or more thick."""
    if p["shape"] != "box" or p["color"] != "dark" or p.get("top") != "metal":
        return False
    x0, x1, _, _, z0, z1 = _box(p, W, D, H)
    return z1 - z0 >= 0.02 and x1 - x0 >= 0.3


def _accessory(p: dict, slab: tuple, W: float, D: float, H: float) -> bool:
    """A frame piece, a handle, a window or a display that sits on a front."""
    if p["shape"] not in ("box", "cyl") or p["color"] not in SHARED:
        return False
    sx0, sx1, sy0, sy1, sz0, _ = slab
    x0, x1, y0, y1, z0, _ = _box(p, W, D, H)
    return z0 >= sz0 - 0.001 and y0 >= sy0 - 0.01 and y1 <= sy1 + 0.01 and x0 >= sx0 - 0.03 and x1 <= sx1 + 0.03


def _front_groups(parts: list[dict], W: float, D: float, H: float) -> list[Front]:
    """The fronts of an item in the order of their parts: a slab (or an oven door) and the parts that follow it."""
    out: list[Front] = []
    i = 0
    while i < len(parts):
        p = parts[i]
        oven = _is_oven_door(p, W, D, H)
        if not (oven or _is_slab(p, W, D, H)):
            i += 1
            continue
        slab = _box(p, W, D, H)
        idx = [i]
        j = i + 1
        while j < len(parts) and not _is_slab(parts[j], W, D, H) and not _is_oven_door(parts[j], W, D, H):
            if _accessory(parts[j], slab, W, D, H):
                idx.append(j)
            j += 1
        # the handle: the last steel part of the group; its side says where the hinge is
        handle = next((parts[k] for k in reversed(idx[1:]) if parts[k]["color"] == "metal"), None)
        hinge = "left"
        centred = False
        if handle is not None:
            hx = (_box(handle, W, D, H)[0] + _box(handle, W, D, H)[1]) / 2
            cx = (slab[0] + slab[1]) / 2
            centred = abs(hx - cx) < 0.02
            hinge = "left" if hx > cx else "right"
        front = Front(idx, slab[0], slab[1], slab[2], slab[3], slab[4], slab[5], "fold" if oven else "door", hinge)
        front.fix = "".join(c for c in p.get("fix", "") if c in "dh")
        front.extra["centred"] = centred
        front.extra["oven"] = oven
        out.append(front)
        i = j
    return out


def _classify(f: Front, family: str, item_id: str) -> None:
    """Decides what a front does."""
    if f.extra["oven"]:
        f.kind = "side" if "microwave" in item_id and f.y0 > 1.4 else "fold"
        f.liner = "metal"
        return
    if family == "range_cooker" or item_id in DISHWASHERS:
        f.kind, f.liner = "fold", "metal"
    elif family == "metod_wall_cabinet" and "lift_up" in item_id:
        f.kind, f.hinge = "lift", "top"
    elif f.h < 0.4 and f.w > f.h * 1.2:
        f.kind = "drawer"
    elif f.extra["centred"] and f.h >= 0.4:
        f.kind = "pullout"
    elif family == "under_counter_fridge":
        f.liner = "white"


def _hinge_line(f: Front) -> float:
    return f.x0 if f.hinge == "left" else f.x1


ROLE = {"door": "door", "side": "microwave", "lift": "door", "drawer": "drawer", "pullout": "pullout", "fold": "oven"}
ROLE_WORD = {
    "door": "door",
    "microwave": "microwave door",
    "drawer": "drawer",
    "pullout": "pull-out",
    "oven": "oven door",
}


def _fits(f: Front, members: list[Front], relax: int = 0) -> bool:
    """Can `f` turn or slide as one piece with the fronts already in a slot?

    Two doors hinged on the same side at different places would turn as one piece about the first one's hinge, so
    they cannot share a slot; stacked doors (one hinge line) and a pair (two sides) can. Drawers share only a row.
    A front joins a slot only next to one of its fronts (touching or above it, in the same run of units).
    """
    # (`relax`: an item with more slots than the format takes lets far apart doors, then drawers, share one)
    far_ok = (relax >= 1 and f.kind in ("door", "side", "lift")) or (relax >= 2 and f.kind == "drawer")
    if not far_ok and not any(min(f.x1, m.x1) - max(f.x0, m.x0) >= -0.01 and abs(f.z0 - m.z0) < 0.01 for m in members):
        return False
    for m in members:
        if ROLE[m.kind] != ROLE[f.kind]:
            return False
        if f.kind in ("drawer", "pullout"):
            if abs(m.y0 - f.y0) > 0.01:
                return False
        elif f.kind in ("fold", "lift"):
            if abs(m.y0 - f.y0) > 0.01 or abs(m.x0 - f.x0) > 0.01:
                return False
        elif m.hinge == f.hinge and abs(_hinge_line(m) - _hinge_line(f)) > 0.01:
            return False
    return True


def _overlap(f: Front, members: list[Front]) -> float:
    return max(min(f.x1, m.x1) - max(f.x0, m.x0) for m in members)


def _ordinal(i: int, n: int, words: tuple[str, str]) -> str:
    """`top` / `middle` / `second` / `bottom` ... for the i-th of n, counted from the first word."""
    if i == 0:
        return words[0]
    if i == n - 1:
        return words[1]
    return "middle" if n == 3 else ["second", "third", "fourth", "fifth"][min(i - 1, 3)]


def _place_labels(slots: dict[str, list[Front]]) -> dict[str, str]:
    """Names the slots of one role by where they are: left / middle / right and top / bottom."""
    spots = {}
    for s, members in slots.items():
        spots[s] = (
            (min(m.x0 for m in members) + max(m.x1 for m in members)) / 2,
            (min(m.y0 for m in members) + max(m.y1 for m in members)) / 2,
        )
    cols: list[list[str]] = []
    for s in sorted(spots, key=lambda k: spots[k][0]):
        if cols and abs(spots[cols[-1][0]][0] - spots[s][0]) < 0.12:
            cols[-1].append(s)
        else:
            cols.append([s])
    out = {}
    if len(cols) > 3 or any(len(c) > 4 for c in cols):
        # too many to tell by place: counted from the top left
        n = 0
        for col in cols:
            for s in sorted(col, key=lambda k: -spots[k][1]):
                n += 1
                out[s] = f"#{n}"
        return out
    for ci, col in enumerate(cols):
        col.sort(key=lambda k: -spots[k][1])
        for ri, s in enumerate(col):
            label = []
            if len(cols) > 1:
                label.append(_ordinal(ci, len(cols), ("left", "right")))
            if len(col) > 1:
                label.append(_ordinal(ri, len(col), ("top", "bottom")))
            out[s] = " ".join(label)
    return out


def _assign_slots(fronts: list[Front]) -> list[dict]:
    """Gives every front its slot (see _slots) in as few slots as the format's 8 allow."""
    preset = {id(f): f.slot for f in fronts}  # the slots the caller chose
    for relax in (0, 1, 2):
        for f in fronts:
            f.slot = preset[id(f)]
        slots = _slots(fronts, relax)
        if len(slots) <= MAX_SLOTS:
            return slots
    raise ValueError(f"{len(slots)} slots")


def _slots(fronts: list[Front], relax: int) -> list[dict]:
    """Gives every front its slot and returns the item's slots.

    Fronts the caller named keep their slot. Of the others, one that can move as one piece with a slot's fronts
    (_fits) joins the slot whose fronts it overlaps most (a wall cabinet's door joins the door below it), else the
    first it fits. A role with more than one slot (two doors that cannot share) is named by place: `left_door`,
    `top_drawer`, `right_bottom_oven_door`.
    """
    slots: dict[str, list[Front]] = {}
    pending: list[Front] = []
    for f in fronts:
        if f.slot:
            slots.setdefault(f.slot, []).append(f)
        else:
            pending.append(f)
    # top to bottom, left to right, so the first door found is the top left one
    pending.sort(key=lambda f: (-round(f.y1, 2), f.x0))
    roles: dict[str, dict[str, list[Front]]] = {}
    for f in pending:
        role = ROLE[f.kind]
        group = roles.setdefault(role, {})
        fitting = [s for s, members in group.items() if _fits(f, members, relax)]
        if fitting:
            target = max(fitting, key=lambda s: _overlap(f, group[s]))
            if _overlap(f, group[target]) <= 0.01:
                target = fitting[0]
        else:
            target = f"{role}#{len(group)}"
            group[target] = []
        group[target].append(f)
    out: list[dict] = []
    for s, members in slots.items():
        entry: dict = {"id": s, "kind": "drawer" if members[0].kind in ("drawer", "pullout") else "contact"}
        named = next((m.name for m in members if m.name), None)
        if named:
            entry["name"] = {"en": named}
        out.append(entry)
    for role, group in roles.items():
        labels = _place_labels(group) if len(group) > 1 else {}
        for s, members in group.items():
            word = ROLE_WORD[role]
            label = labels.get(s, "")
            text = f"{word} {label[1:]}" if label.startswith("#") else (label + " " + word).strip()
            sid = text.replace(" ", "_").replace("-", "")
            for m in members:
                m.slot = sid
            entry = {"id": sid, "kind": "drawer" if role in ("drawer", "pullout") else "contact"}
            if label or role in ("oven", "microwave", "pullout"):
                entry["name"] = {"en": text.capitalize()}
            out.append(entry)
    ids = [e["id"] for e in out]
    if len(set(ids)) != len(ids):
        raise ValueError(f"slot ids clash: {ids}")
    return out


def _part(
    shape: str,
    x0: float,
    x1: float,
    y0: float,
    y1: float,
    z0: float,
    z1: float,
    W: float,
    D: float,
    H: float,
    color: str,
    **kw,
) -> dict:
    """A part from a box in metres (relative to the item's centre on the floor), in the fractions a pack wants."""

    def f(v: float) -> float:
        return round(v, 4)

    p = {
        "shape": shape,
        "x": f(max(-0.5, min(0.5, (x0 + x1) / 2 / W))),
        "z": f(max(-0.5, min(0.5, (z0 + z1) / 2 / D))),
        "w": f(max(0.001, min(1.0, (x1 - x0) / W))),
        "d": f(max(0.001, min(1.0, (z1 - z0) / D))),
        "y": f(max(0.0, min(1.0, y0 / H))),
        "h": f(max(0.001, min(1.0, (y1 - y0) / H))),
        "color": color,
    }
    p.update(kw)
    return p


MAX_PARTS = 60  # packs.py
MAX_SLOTS = 8


def _rows(fronts: list[Front]) -> list[list[Front]]:
    """The fronts that stand side by side in one row (same height, touching): one liner serves them all."""
    rows: list[list[Front]] = []
    for f in sorted(fronts, key=lambda f: (round(f.y0, 2), round(f.y1, 2), f.x0)):
        for r in rows:
            last = r[-1]
            if (
                f.kind not in ("fold", "side")
                and last.kind not in ("fold", "side")
                and abs(last.y0 - f.y0) < 0.005
                and abs(last.y1 - f.y1) < 0.005
                and abs(last.z0 - f.z0) < 0.001
                and 0 <= f.x0 - last.x1 < 0.01
                and last.liner == f.liner
                and last.fix == f.fix
            ):
                r.append(f)
                break
        else:
            rows.append([f])
    return rows


def _interior(row: list[Front], W: float, D: float, H: float, shelves: bool) -> list[dict]:
    """What shows behind an open front, in the thickness of the front itself (so a closed front hides it)."""
    f = row[0]
    extra: dict = {"edges": "faint"}
    if f.fix:
        extra["fix"] = f.fix
    m = 0.012 if f.kind not in ("fold", "side") else 0.02
    ft = min(f.z1 - f.z0, 0.004 if f.kind == "fold" else 0.006)
    x0, x1, y0, y1 = row[0].x0 + m, row[-1].x1 - m, f.y0 + m, f.y1 - m
    out = [_part("box", x0, x1, y0, y1, f.z0, f.z0 + ft, W, D, H, f.liner, **extra)]
    if shelves and f.kind in ("door", "lift") and f.liner == "dark" and f.h > 0.4:
        # shelves: a thin white board across the opening
        n = 1 if f.h < 1.0 else 2 if f.h < 1.8 else 3
        for k in range(1, n + 1):
            y = y0 + (y1 - y0) * k / (n + 1)
            out.append(
                _part(
                    "box",
                    x0,
                    x1,
                    y - 0.008,
                    y + 0.008,
                    f.z0,
                    f.z0 + min(0.012, f.z1 - f.z0 - 0.003),
                    W,
                    D,
                    H,
                    "white",
                    **extra,
                )
            )
    return out


def _tray(f: Front, W: float, D: float, H: float, solid: bool) -> list[dict]:
    """A drawer box behind a drawer front: it starts inside the solid body and slides out with the front."""
    length = 0.42 * D
    x0, x1 = f.x0 + 0.04, f.x1 - 0.04
    y0 = f.y0 + 0.03
    top = min(f.y1 - 0.02, y0 + 0.11)
    z1, z0 = f.z0 - 0.002, f.z0 - 0.002 - length
    kw = {"edges": "faint", "bind": {"slot": f.slot, "kind": "slide"}}
    if solid:  # one part: for an item that is short of parts
        return [_part("box", x0, x1, y0, y0 + 0.05, z0, z1, W, D, H, "white", **kw)]
    t = 0.012
    return [
        _part("box", x0, x1, y0, y0 + t, z0, z1, W, D, H, "white", **kw),
        _part("box", x0, x0 + t, y0 + t, top, z0, z1, W, D, H, "white", **kw),
        _part("box", x1 - t, x1, y0 + t, top, z0, z1, W, D, H, "white", **kw),
        _part("box", x0 + t, x1 - t, y0 + t, top, z0, z0 + t, W, D, H, "white", **kw),
    ]


def _additions(fronts: list[Front], W: float, D: float, H: float, shelves: bool, trays: str) -> list[dict]:
    added: list[dict] = []
    for row in _rows(fronts):
        added += _interior(row, W, D, H, shelves)
    if trays != "none":
        for f in fronts:
            if f.kind == "drawer":
                added += _tray(f, W, D, H, trays == "solid")
    return added


def _bind_for(f: Front) -> dict:
    if f.kind in ("door", "side"):
        return {"slot": f.slot, "kind": "open", "hinge": f.hinge}
    if f.kind == "lift":
        return {"slot": f.slot, "kind": "open", "hinge": "top"}
    if f.kind == "fold":
        return {"slot": f.slot, "kind": "open", "hinge": "bottom", "amount": 90}
    return {"slot": f.slot, "kind": "slide"}


def _front_item(item: dict) -> list[Front] | None:
    """The fronts of a cabinet-like item, or None when its family is not read here."""
    family, item_id = item.get("family", ""), item["id"]
    if (
        family not in CABINET_FAMILIES
        and not (family == "corner_unit" and item_id in BLIND_CORNERS)
        and item_id not in DISHWASHERS
    ):
        return None
    W, D, H = item["size"]
    fronts = _front_groups(item["parts"], W, D, H)
    for f in fronts:
        _classify(f, family, item_id)
        if item_id in DISHWASHERS:
            f.slot = "door"
    return fronts or None


def _fridge_fronts(item: dict) -> list[Front] | None:
    """The doors of the side-by-side and French-door fridge freezers, read from their known layouts."""
    if item.get("family") != "american_fridge_freezer":
        return None
    W, D, H = item["size"]
    parts = item["parts"]
    boxes = [_box(p, W, D, H) for p in parts]

    def front(idx: list[int], door: int, name: str, slot: str, kind: str, hinge: str) -> Front:
        x0, x1, y0, y1, z0, z1 = boxes[door]
        f = Front(idx, x0, x1, y0, y1, z0, z1, kind, hinge, "white", name, slot=slot)
        return f

    if len(parts) == 8 and item["variant"]["en"].startswith("Side-by-side"):
        # parts: 2 the freezer door (left), 3 the fridge door (right), 4 and 5 their handles, 6 and 7 the display
        return [
            front([2, 4, 6, 7], 2, "Freezer door", "freezer_door", "door", "left"),
            front([3, 5], 3, "Fridge door", "fridge_door", "door", "right"),
        ]
    if len(parts) == 9 and item["variant"]["en"].startswith("French door"):
        # parts: 2 and 3 the upper doors, 4 the freezer drawer, 5 and 6 their handles, 7 the drawer's, 8 the display
        return [
            front([2, 5], 2, "Fridge door", "fridge_door", "door", "left"),
            front([3, 6, 8], 3, "Fridge door", "fridge_door", "door", "right"),
            front([4, 7], 4, "Freezer drawer", "freezer_drawer", "drawer", "left"),
        ]
    return None


def _under_counter(item: dict) -> list[Front] | None:
    """The door of an under-counter fridge or freezer: the rounded front and what sits on it."""
    if item.get("family") != "under_counter_fridge" or item["id"] == "under_counter_fridge_integrated":
        return None
    W, D, H = item["size"]
    parts = item["parts"]
    door = next(
        (i for i, p in enumerate(parts) if p["shape"] == "rbox" and p["h"] * H > 0.7 and p["z"] * D > 0.2), None
    )
    if door is None:
        return None
    x0, x1, y0, y1, z0, z1 = _box(parts[door], W, D, H)
    idx = [door] + [i for i in range(door + 1, len(parts))]
    return [Front(idx, x0, x1, y0, y1, z0, z1, "door", "left", "white", None)]


def convert(item: dict) -> dict | None:
    """The item with live parts, or None: not a kitchen front, or already live. The closed look is unchanged."""
    if "slots" in item or any("bind" in p for p in item["parts"]):
        return None
    fronts = _fridge_fronts(item) or _under_counter(item) or _front_item(item)
    if not fronts:
        return None
    W, D, H = item["size"]
    out = copy.deepcopy(item)
    slots = _assign_slots(fronts)
    for f in fronts:
        bind = _bind_for(f)
        for i in f.idx:
            out["parts"][i]["bind"] = dict(bind)
    # the inside of the fronts, as much as the item's 60 parts take: shelves and drawer boxes go first when short
    for shelves, trays in (("yes", "box"), ("", "box"), ("", "solid"), ("", "none")):
        added = _additions(fronts, W, D, H, bool(shelves), trays)
        if len(out["parts"]) + len(added) <= MAX_PARTS:
            break
    else:
        raise ValueError(f"{item['id']}: {len(out['parts'])} parts and no room for the inside of the fronts")
    out["parts"] += added
    out["slots"] = slots
    return out


def closed_look_kept(before: dict, after: dict) -> bool:
    """True when the parts the item had are unchanged but for their `bind`, in the same order, and its other
    fields (size, tags, price info, symbol ...) are as they were; only parts and slots may be new."""
    n = len(before["parts"])
    old = [{k: v for k, v in p.items() if k != "bind"} for p in after["parts"][:n]]
    keys = {k for k in before} | {k for k in after if k not in ("slots",)}
    same = all(before.get(k) == after.get(k) for k in keys if k != "parts")
    return old == before["parts"] and same and len(after["parts"]) >= n


if __name__ == "__main__":  # a look at one item: python kitchen_live.py path/to/item.json
    with open(sys.argv[1], encoding="utf-8") as fh:
        made = convert(json.load(fh))
    print(json.dumps(made, indent=1) if made else "nothing to make live")
