"""Make our own wardrobes, chests, bedside tables, sideboards, TV units, hall and bathroom cabinets live (#468).

    python tools/live_cabinets.py            report what would change (nothing is written)
    python tools/live_cabinets.py --write    rewrite the item files and bump the packs' releases

Live parts (docs/packs.md, "Live parts"): each door and each drawer front becomes a part of its own with a `bind` to a
slot of the item, so it swings or slides with the contact the placed item is linked to. The item's size, tags, rooms and
its CLOSED look stay as they are: the fronts, their handles (and a mirror's glass) only gain a `bind`; what is added
sits hidden inside the closed item (a drawer's tray behind its front, a dark recess behind a door of a solid cabinet)
and shows only while a door or drawer is open. The plan symbol (the top view) is kept as it was: an item without a
symbol gets one drawn from its old parts, so the added parts do not show in it.

The pack JSON files are the source of the items (there is no other generator for them); this tool is the repeatable
step: it skips an item that already has `slots`, so running it again after the old items were rebuilt converts them
again, and a second run changes nothing. The kitchen units, ovens, dishwashers and fridges are not touched here.

Slots: `door` (one contact for every door of the item: they open together), `drawer` or `drawer_1` ... `drawer_8`
(one Drawer contact per drawer, named by its place) and `flap_1` ... (tip-out compartments of shoe cabinets). Doors
that open together share a slot; each column of doors has its own hinge and a slightly different opening angle, so the
viewer keeps them apart as separate models.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parent.parent
BUNDLED = ROOT / "custom_components" / "home_3d" / "bundled_packs"
NOTE = (
    "Release {release}: the doors and drawers of our wardrobes, chests of drawers, bedside tables, sideboards, TV "
    "benches and hall and bathroom cabinets open and slide with their contacts (#468)."
)

# the items converted, as regular expressions on "<pack>/<group>/<id>" (kitchen units, ovens, dishwashers and
# fridges are the kitchen ticket's, #467)
SELECT = [
    r"^amluto\.bedroom/bed/bedside_table_[123]_drawer$",
    r"^amluto\.bedroom/storage/(chest_of_drawers_\w+|display_cabinet\w*|shoe_cabinet\w*)$",
    r"^amluto\.ikea-uk/storage/(pax_wardrobe_\w+|kleppstad_wardrobe_[23]_doors|brimnes_wardrobe_\w+|rakkestad_wardrobe_\w+"
    r"|nordkisa_wardrobe_\w+|\w+_chest_of_\d_drawers\w*|besta_storage_doors_\w+|bissa_shoe_cabinet_\d|brusali_shoe_cabinet_\d"
    r"|stall_shoe_cabinet_\w+|ivar_cabinet_\w+|stockholm_sideboard|hemnes_glass_door_cabinet_3_drawers)$",
    r"^amluto\.ikea-uk/bed/hemnes_bedside_table$",
    r"^amluto\.ikea-uk/kids/smastad_platsa_wardrobe_\w+$",
    r"^amluto\.ikea-uk/bath/(enhet_mirror_cabinet_\w+|hemnes_mirror_cabinet_\w+|nysjon_\w+_cabinet\w*|tannforsen_\w+)$",
    r"^amluto\.ikea-uk/media/(besta_tv_bench_\w+_doors|besta_tv_combination_\w+|hemnes_tv_bench|hemnes_tv_combination)$",
    r"^amluto\.kitchen-bath/bath/(mirror_cabinet_\w+|vanity_unit_\w+)$",
]

# doors made of a frame, a pane and a handle: every thin part at the front (above the given height, a share of the
# item's) belongs to a door, split by the item's middle into this many columns
FRAMED = {
    "display_cabinet": (2, 0.0),
    "display_cabinet_low": (2, 0.0),
    "display_cabinet_narrow": (1, 0.0),
    "hemnes_glass_door_cabinet_3_drawers": (2, 0.13),
}
# drawers sit below the doors in these (their fronts are no wider than tall)
DRAWERS_BELOW = {"hemnes_glass_door_cabinet_3_drawers": 0.5}
# every front is a drawer
ALL_DRAWERS = re.compile(r"chest_of_|bedside_table_\d_drawer|hemnes_bedside_table|wash_stand_drawers|wall_hung")

OPEN_DEG = 100
STEP_DEG = 4
FLAP_DEG = 70
ORDINAL = ["Top", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth"]
MAX_PARTS = 60
MAX_SLOTS = 8
ROUND = 4


def _comp(o: object) -> str:
    return json.dumps(o, separators=(", ", ": "), ensure_ascii=False)


def write_a(d: dict) -> str:
    """The compact header style of the generated packs (tools/pack_builder.py dump_item)."""
    lines = ["{"]
    for k in (k for k in d if k not in ("parts", "symbol")):
        lines.append(f'  "{k}": {_comp(d[k])},')
    lines.append('  "parts": [')
    lines.append(",\n".join("    " + _comp(p) for p in d["parts"]))
    lines.append("  ]" + ("," if d.get("symbol") else ""))
    if d.get("symbol"):
        lines.append('  "symbol": [')
        lines.append(",\n".join("    " + _comp(s) for s in d["symbol"]))
        lines.append("  ]")
    lines.append("}")
    return "\n".join(lines) + "\n"


def write_b(d: dict) -> str:
    """The indented header style of the other items."""
    head = json.dumps({k: d[k] for k in d if k not in ("parts", "symbol")}, indent=2, ensure_ascii=False)
    out = head[:-2] + ',\n  "parts": [\n' + ",\n".join("    " + _comp(p) for p in d["parts"]) + "\n  ]"
    if d.get("symbol"):
        out += ',\n  "symbol": [\n' + ",\n".join("    " + _comp(p) for p in d["symbol"]) + "\n  ]"
    return out + "\n}\n"


def style_of(raw: str, d: dict) -> str | None:
    """ "a" or "b" when that writer reproduces the file byte for byte, else None."""
    if write_a(d) == raw:
        return "a"
    if write_b(d) == raw:
        return "b"
    return None


def _f(v: float) -> float:
    return round(v, ROUND)


class Unit:
    """One door, flap or drawer: its front parts (indices into the item's parts) and the box they cover (fractions)."""

    def __init__(self, main: int, parts: list[int]) -> None:
        self.main = main
        self.parts = parts
        self.kind = "door"
        self.slot = ""
        self.bind: dict = {}


class Report(Exception):
    """An item that cannot be converted: the reason."""


def _rect(p: dict) -> tuple[float, float, float, float]:
    return p["x"] - p["w"] / 2, p["x"] + p["w"] / 2, p["y"], p["y"] + p["h"]


def _hidden_gap(p: dict, W: float, D: float, H: float) -> bool:
    return False


def find_units(item: dict) -> tuple[list[Unit], set[int]]:
    """The fronts of an item (doors, flaps, drawers) with the parts that go with them, and the indices of its feet."""
    W, D, H = item["size"]
    parts = item["parts"]
    iid = item["id"]
    thin: list[int] = []
    for i, p in enumerate(parts):
        if p["shape"] not in ("box", "loft", "cyl", "sphere"):
            continue
        if p["z"] < -0.3 or p["d"] * D > 0.055 or p["z"] + p["d"] / 2 < 0.05:
            continue
        # feet and legs stand on the floor and are narrow
        if p["y"] * H < 0.003 and p["w"] * W < 0.1:
            continue
        thin.append(i)
    units: list[Unit] = []
    if iid in FRAMED:
        cols, min_y = FRAMED[iid]
        parts_by_col: dict[int, list[int]] = {}
        for i in list(thin):
            p = parts[i]
            if p["y"] < min_y:
                continue
            thin.remove(i)
            if p["w"] > 0.9 and p["h"] * H < 0.1:
                continue  # a rail or plinth across the whole front
            col = 0 if cols == 1 or p["x"] < -0.002 else 1
            parts_by_col.setdefault(col, []).append(i)
        for col in sorted(parts_by_col):
            idx = parts_by_col[col]
            main = max(idx, key=lambda i: parts[i]["w"] * parts[i]["h"])
            units.append(Unit(main, idx))
    mains = [
        i
        for i in thin
        if parts[i]["w"] * W >= 0.12 and parts[i]["h"] * H >= 0.1 and parts[i]["shape"] in ("box", "loft")
    ]
    # a main inside a bigger one (a mirror's glass in its frame) goes with the bigger
    inner: set[int] = set()
    for i in mains:
        for j in mains:
            if i == j:
                continue
            a, b = parts[i], parts[j]
            if a["w"] * a["h"] < b["w"] * b["h"] and _inside(a, b, 0.004):
                inner.add(i)
    mains = [i for i in mains if i not in inner]
    framed_mains = {u.main for u in units}
    units += [Unit(i, [i]) for i in mains]
    for i in thin:
        if i in mains:
            continue
        p = parts[i]
        # the part goes with the smallest front its centre lies in; a plinth or kick strip beside it stays
        best = None
        for u in units:
            m = parts[u.main]
            if u.main in framed_mains:
                continue
            if _inside(p, m, 0.004) and (
                best is None or m["w"] * m["h"] < parts[best.main]["w"] * parts[best.main]["h"]
            ):
                best = u
        if best is not None:
            best.parts.append(i)
    return units, set()


def _inside(a: dict, b: dict, tol: float) -> bool:
    """Whether a lies inside the front rectangle of b: its width across, its middle in height."""
    cy = a["y"] + a["h"] / 2
    ax0, ax1, _, _ = _rect(a)
    x0, x1, y0, y1 = _rect(b)
    return x0 - tol <= ax0 and ax1 <= x1 + tol and y0 - tol <= cy <= y1 + tol and a["z"] >= b["z"] - 0.02


def classify(item: dict, units: list[Unit]) -> None:
    W, D, H = item["size"]
    iid = item["id"]
    parts = item["parts"]
    for u in units:
        m = parts[u.main]
        w_m, h_m = m["w"] * W, m["h"] * H
        if "shoe" in iid and D <= 0.35:
            u.kind = "flap"
        elif ALL_DRAWERS.search(iid):
            u.kind = "drawer"
        elif iid in DRAWERS_BELOW:
            u.kind = "drawer" if (m["y"] + m["h"]) <= DRAWERS_BELOW[iid] * 0.4 else "door"
        elif h_m <= 0.30 and w_m / h_m >= 1.9:
            u.kind = "drawer"
        else:
            u.kind = "door"


def _is_solid(item: dict) -> dict | None:
    """The part that makes the carcass solid (one big box), None for a hollow carcass of panels."""
    for p in item["parts"]:
        if p["shape"] == "box" and p["w"] >= 0.85 and p["d"] >= 0.7 and p["h"] >= 0.4 and p["color"] != "glass":
            return p
    return None


def _ord(i: int, n: int, prefix: str = "") -> str:
    if i == n - 1 and n >= 3:
        return f"{prefix}Bottom"
    return f"{prefix}{ORDINAL[i] if i < len(ORDINAL) else f'No. {i + 1}'}"


def assign_slots(item: dict, units: list[Unit]) -> list[dict]:
    """Slots, binds for each unit; the item's `slots` list."""
    parts = item["parts"]
    slots: list[dict] = []
    doors = [u for u in units if u.kind == "door"]
    drawers = [u for u in units if u.kind == "drawer"]
    flaps = [u for u in units if u.kind == "flap"]

    if doors:
        slots.append({"id": "door", "kind": "contact"})
        # columns of doors by their x centre: hinges outwards, each column an angle of its own
        cols: dict[tuple[float, float], list[Unit]] = {}
        for u in doors:
            m = parts[u.main]
            cols.setdefault((round(m["x"], 2), round(m["z"], 1)), []).append(u)
        xs = sorted(cols)
        if len(xs) == 1:
            u0 = cols[xs[0]]
            m = parts[u0[0].main]
            # the handle is the smallest part that goes with the door: the hinge is on the other side
            handles = sorted((parts[i] for i in u0[0].parts if i != u0[0].main), key=lambda q: q["w"] * q["h"])
            hinge = "left"
            if handles and handles[0]["x"] < m["x"]:
                hinge = "right"
            for u in u0:
                u.bind = {"slot": "door", "kind": "open", "hinge": hinge, "amount": OPEN_DEG}
        else:
            left = [x for x in xs if x[0] < 0.05]
            right = [x for x in xs if x[0] >= 0.05]
            for rank, x in enumerate(left):
                for u in cols[x]:
                    u.bind = {"slot": "door", "kind": "open", "hinge": "left", "amount": OPEN_DEG - STEP_DEG * rank}
            for rank, x in enumerate(reversed(right)):
                for u in cols[x]:
                    u.bind = {"slot": "door", "kind": "open", "hinge": "right", "amount": OPEN_DEG - STEP_DEG * rank}

    # one slot per drawer, named by its place (top to bottom, left to right)
    if drawers:
        if len(slots) + len(drawers) > MAX_SLOTS:
            raise Report(f"{len(drawers)} drawers and {len(slots)} other slots are more than {MAX_SLOTS} slots")
        rows = sorted({round(parts[u.main]["y"], 2) for u in drawers}, reverse=True)
        xs = sorted({round(parts[u.main]["x"], 2) for u in drawers})
        order = sorted(drawers, key=lambda u: (-round(parts[u.main]["y"], 2), parts[u.main]["x"]))
        for n, u in enumerate(order):
            r = rows.index(round(parts[u.main]["y"], 2))
            c = xs.index(round(parts[u.main]["x"], 2))
            side = ""
            if len(xs) == 2:
                side = ("left ", "right ")[c]
            elif len(xs) == 3:
                side = ("left ", "middle ", "right ")[c]
            if len(drawers) == 1:
                sid, name = "drawer", None
            else:
                sid = f"drawer_{n + 1}"
                word = _ord(r, len(rows)).lower() if side else _ord(r, len(rows))
                name = f"{word} {side}drawer".strip() if side else f"{word} drawer"
                name = name[0].upper() + name[1:]
            slot = {"id": sid, "kind": "drawer"}
            if name:
                slot["name"] = {"en": name}
            slots.append(slot)
            u.bind = {"slot": sid, "kind": "slide"}

    if flaps:
        if len(slots) + len(flaps) > MAX_SLOTS:
            raise Report(f"{len(flaps)} flaps are too many slots")
        order = sorted(flaps, key=lambda u: -parts[u.main]["y"])
        for n, u in enumerate(order):
            sid = "flap" if len(flaps) == 1 else f"flap_{n + 1}"
            slot = {"id": sid, "kind": "contact"}
            if len(flaps) > 1:
                slot["name"] = {"en": f"{_ord(n, len(order))} compartment"}
            slots.append(slot)
            u.bind = {"slot": sid, "kind": "open", "hinge": "bottom", "amount": FLAP_DEG}
    return slots


def build(item: dict) -> tuple[dict, dict]:
    """The converted item and a few facts about it for the report; raises Report when it cannot be converted."""
    W, D, H = item["size"]
    if any("bind" in p or "spin" in p for p in item["parts"]) or "slots" in item:
        raise Report("already live")
    units, _ = find_units(item)
    units = [u for u in units if parts_ok(item, u)]
    if not units:
        raise Report("no door or drawer found")
    classify(item, units)
    slots = assign_slots(item, units)
    old_parts = [dict(p) for p in item["parts"]]
    parts = [dict(p) for p in item["parts"]]
    for u in units:
        for i in u.parts:
            parts[i]["bind"] = dict(u.bind)
    solid = _is_solid(item)
    n_drawers = sum(1 for u in units if u.kind == "drawer")
    n_cavities = len(units) if solid is not None else 0
    # trays of three parts when the item has room for them, else one box; the recesses give way last
    base = len(parts)
    tray_parts = 3 if base + 3 * n_drawers + n_cavities <= MAX_PARTS else 1
    cavities = base + tray_parts * n_drawers + n_cavities <= MAX_PARTS
    added: list[dict] = []
    # what shows inside while a door or drawer is open
    for u in units:
        m = old_parts[u.main]
        x0, x1, y0, y1 = _rect(m)
        zb = m["z"] - m["d"] / 2
        zf = m["z"] + m["d"] / 2
        if u.kind == "drawer":
            added += [{**t, "bind": dict(u.bind)} for t in _tray(m, zb, W, D, H, tray_parts, interior(item, m, solid))]
        if solid is not None and cavities:
            face = solid["z"] + solid["d"] / 2
            t = 0.004 / D
            inset_x, inset_y = 0.012 / W, 0.012 / H
            # hidden by the front while it is closed: the front reaches back to the carcass' face and past the recess
            if zb <= face + 1e-6 and zf >= face + t:
                added.append(
                    {
                        "shape": "box",
                        "x": _f((x0 + x1) / 2),
                        "z": _f(min(0.5, face + t / 2)),
                        "w": _f(max(0.001, x1 - x0 - 2 * inset_x)),
                        "d": _f(t),
                        "y": _f(y0 + inset_y),
                        "h": _f(max(0.001, y1 - y0 - 2 * inset_y)),
                        "color": "dark",
                        "fix": "d",
                    }
                )
    if len(parts) + len(added) > MAX_PARTS:
        raise Report(f"{len(parts) + len(added)} parts are too many")
    out = dict(item)
    out["slots"] = slots
    out["parts"] = parts + added
    # the top view stays as it was: parts added inside would show in it
    if added and not item.get("symbol"):
        out["symbol"] = plan_symbol(item)
    info = {
        "units": [
            (u.kind, u.bind.get("slot"), u.bind.get("hinge", ""), u.bind.get("amount", ""), len(u.parts)) for u in units
        ],
        "solid": solid is not None,
        "parts": (len(item["parts"]), len(out["parts"])),
        "slots": len(slots),
    }
    return out, info


def parts_ok(item: dict, u: Unit) -> bool:
    W, _D, H = item["size"]
    m = item["parts"][u.main]
    return m["w"] * W >= 0.12 and m["h"] * H >= 0.1


def interior(item: dict, m: dict, solid: dict | None) -> tuple[float, float, float, float, float] | None:
    """The room behind a front, (x0, x1, y0, y1, back z) in fractions: between the side panels, the boards below
    and above it and the back. None when the item has no side panels (an open frame): a drawer box there would show
    from the side."""
    W, _D, H = item["size"]
    if solid is not None:
        return (
            -solid["w"] / 2 + solid["x"],
            solid["x"] + solid["w"] / 2,
            solid["y"],
            solid["y"] + solid["h"],
            solid["z"] - solid["d"] / 2 + 0.01,
        )
    parts = item["parts"]
    mid = m["y"] + m["h"] / 2
    lefts, rights = [], []
    for p in parts:
        if p["shape"] != "box" or p["d"] < 0.7 or p["w"] * W > 0.12 or abs(p["x"]) < 0.3:
            continue
        if p["y"] > m["y"] + 0.02 or p["y"] + p["h"] < m["y"] + m["h"] - 0.02:
            continue
        (lefts if p["x"] < 0 else rights).append(p)
    if not lefts or not rights:
        return None
    x0 = max(p["x"] + p["w"] / 2 for p in lefts)
    x1 = min(p["x"] - p["w"] / 2 for p in rights)
    y0, y1, zb = 0.0, 1.0, -0.46
    for p in parts:
        if p["shape"] != "box":
            continue
        if p["h"] * H <= 0.06 and p["w"] >= 0.8 and p["d"] >= 0.7:  # a board: the bottom, a shelf, the top
            if p["y"] + p["h"] <= mid:
                y0 = max(y0, p["y"] + p["h"])
            elif p["y"] >= mid:
                y1 = min(y1, p["y"])
        if p["z"] + p["d"] / 2 <= -0.3 and p["w"] >= 0.8:  # the back
            zb = max(zb, p["z"] + p["d"] / 2)
    return x0, x1, y0, y1, zb + 0.005


def _tray(
    m: dict, zb: float, W: float, D: float, H: float, count: int, room: tuple[float, float, float, float, float] | None
) -> list[dict]:
    """A drawer's box behind its front: a bottom and two sides (a single box when the item has no room for more);
    nothing when the room behind the front is not enclosed."""
    if room is None:
        return []
    rx0, rx1, ry0, ry1, rzb = room
    length = 0.8 * (zb - rzb)
    if length * D < 0.1:
        return []
    zc = zb - length / 2 - 0.002
    t = 0.012
    x0 = max(m["x"] - m["w"] / 2 + 0.02 / W, rx0 + 0.005 / W)
    x1 = min(m["x"] + m["w"] / 2 - 0.02 / W, rx1 - 0.005 / W)
    y0 = max(m["y"] + 0.1 * m["h"], ry0 + 0.004 / H)
    y1 = min(y0 + 0.62 * m["h"], ry1 - 0.004 / H)
    if x1 - x0 < 0.06 / W or y1 - y0 < 0.04 / H:
        return []
    xc, tw, h = (x0 + x1) / 2, x1 - x0, y1 - y0
    color = m["color"] if m["color"] not in ("glass", "metal", "dark") else "white"
    if count == 3:
        return [
            {
                "shape": "box",
                "x": _f(xc),
                "z": _f(zc),
                "w": _f(tw),
                "d": _f(length),
                "y": _f(y0),
                "h": _f(max(0.001, t / H)),
                "color": color,
                "fix": "h",
            },
            {
                "shape": "box",
                "x": _f(x0 + t / W / 2),
                "z": _f(zc),
                "w": _f(t / W),
                "d": _f(length),
                "y": _f(y0),
                "h": _f(h),
                "color": color,
                "fix": "w",
            },
            {
                "shape": "box",
                "x": _f(x1 - t / W / 2),
                "z": _f(zc),
                "w": _f(t / W),
                "d": _f(length),
                "y": _f(y0),
                "h": _f(h),
                "color": color,
                "fix": "w",
            },
        ]
    return [
        {
            "shape": "box",
            "x": _f(xc),
            "z": _f(zc),
            "w": _f(tw),
            "d": _f(length),
            "y": _f(y0),
            "h": _f(h),
            "color": color,
        }
    ]


def plan_symbol(item: dict) -> list[dict]:
    """What the plan draws of an item without a symbol (frontend components/furniture2d.ts ownSymbol), as a symbol."""
    W, D, _H = item["size"]
    out: list[dict] = []
    for p in item["parts"]:
        if not (p["w"] < 0.98 or p["d"] < 0.98):
            continue
        if p["shape"] == "cyl" and p.get("axis", "y") == "y":
            out.append(
                {
                    "shape": "circle",
                    "x": _f(p["x"]),
                    "z": _f(p["z"]),
                    "r": _f(min(p["w"] * W, p["d"] * D) / 2 / min(W, D)),
                }
            )
        elif p["shape"] in ("sphere", "lathe"):
            raise Report("a round part has no symbol shape")
        else:
            out.append({"shape": "rect", "x": p["x"], "z": p["z"], "w": p["w"], "d": p["d"]})
    if len(out) > 40:
        raise Report(f"{len(out)} symbol shapes are too many")
    return out


def run(write: bool) -> dict[str, int]:
    changed: dict[str, int] = {}
    rows: list[str] = []
    skipped: list[str] = []
    for path in sorted(BUNDLED.glob("*/*/*.json")):
        rel = path.relative_to(BUNDLED).as_posix()[: -len(".json")]
        if not any(re.search(s, rel) for s in SELECT):
            continue
        raw = path.read_bytes().decode("utf-8")
        item = json.loads(raw)
        style = style_of(raw, item)
        try:
            if style is None:
                raise Report("file style not reproducible")
            new, info = build(item)
        except Report as err:
            skipped.append(f"{rel}: {err}")
            continue
        before, after = info["parts"]
        rows.append(f"{rel}: {before} -> {after} parts, solid={info['solid']}, slots={info['slots']}, {info['units']}")
        if write:
            text = (write_a if style == "a" else write_b)(new)
            path.write_bytes(text.encode("utf-8"))
        changed[rel.split("/")[0]] = changed.get(rel.split("/")[0], 0) + 1
    print("\n".join(rows))
    print("\nskipped:\n" + "\n".join(skipped))
    print("\nconverted per pack:", changed)
    if write:
        for pack_id in changed:
            pj = BUNDLED / pack_id / "pack.json"
            meta = json.loads(pj.read_text(encoding="utf-8"))
            if not str(meta.get("release_note", "")).endswith("(#468)."):
                meta["release"] = int(meta["release"]) + 1
            meta["release_note"] = NOTE.format(release=meta["release"])
            pj.write_bytes((json.dumps(meta, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
            print(f"{pack_id}: release {meta['release']}")
    return changed


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--write", action="store_true")
    run(ap.parse_args().write)
    sys.exit(0)
