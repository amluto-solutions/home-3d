"""Make more of the IKEA UK items live (run 16): desks and drawer units, day-beds and loft beds with drawers, a drawer
bookcase, the washing machines and the microwave oven (docs/packs.md, "Live parts").

    python tools/live_ikea_more.py            report what would change (nothing is written)
    python tools/live_ikea_more.py --write    rewrite the item files and bump the pack's release
    python tools/live_ikea_more.py --fixture  print the closed-look fixture (run it BEFORE --write)

The item files are the source (there is no other generator for them); this tool is the repeatable step: an item that
has `slots` already is skipped, so a second run changes nothing. It reuses the helpers of tools/live_cabinets.py
(drawer boxes, the plan symbol, the file writers) and says for every front which part it is: the items here are read
from a list (SPECS), not guessed, because desks and drawer units come in many layouts.

What an item gets:
- a **drawer** slides out with its handle (slot `drawer` or `drawer_1` ..., one Drawer contact each, named by place).
  A drawer unit with more than 8 drawers (the 9-drawer unit; the two units of a desk with two drawer units) lets its
  lowest drawers share a slot: a slot is a drawer contact, and an item has 8 at most. A drawer gets a box behind its
  front where the carcass is closed (side panels or a solid body), so it shows only while the drawer is out; where
  there is no side panel (the loft beds) the front slides alone, so no box would show from the side;
- a **washing machine's door** turns about its left edge, a dark drum opening and a cross of paddles sit behind it (the
  paddles turn while the machine runs: slot `running`, a power reading); the integrated washer-dryer's front opens as
  a door of its own; the **microwave's door** turns about its left edge and a steel liner shows behind it.
The closed item is unchanged: the parts it had keep their order and values (a `bind` apart), everything new sits behind
a front or behind a washing machine's door (inside the solid body, inside the thickness of the door); an item that gets
new parts and has no `symbol` gets one drawn from its old parts (the plan shows the old parts from above).

Not converted, and why (see the commit message): the LACK and open BESTA TV benches (shelves: no door and no drawer),
the SMASTAD loft beds with storage and with 2
shelves (open shelf boards: no drawer front and no door).

A desk's drawer unit can hold a door (spec "doors": main part, its parts, hinge) next to its drawers: one `door` slot
(`contact`). "room" names the panels around the drawer box when the generic search cannot find them (a divider).
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
import live_cabinets as lc

BUNDLED = lc.BUNDLED
PACK = "amluto.ikea-uk"
MARKER = "(run16 last)"
NOTE = (
    "Release {release}: IKEA desks (MICKE too), drawer units, beds, washers, microwave, sliding wardrobe and TV bench "
    "doors move with Home Assistant (run16 last) (run16 misc)."
)
MAX_PARTS = 60
ORDINAL = ["Top", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth"]
NUMBER = {2: "two", 3: "three"}

# one front: (main part, every part that moves with it); the item's closed carcass is `solid` (a part index) or found
# from its side panels. share: how many of the lowest drawers of a column share one slot.
Front = tuple[int, list[int]]


def _pairs(first: int, count: int, step: int = 2) -> list[Front]:
    return [(first + i * step, [first + i * step, first + i * step + 1]) for i in range(count)]


DRAWERS: dict[str, dict] = {
    # desks with a drawer under the top: the box, its front and the handle slide together (nothing is left behind)
    "office/alex_desk_100x48": {"fronts": [(5, [4, 5, 6])], "tray": False},
    "office/alex_desk_132x58": {"fronts": [(5, [4, 5, 6])], "tray": False},
    "office/alex_drawer_unit_36x70": {"fronts": _pairs(5, 5)},
    "office/alex_drawer_unit_9_drawers": {"fronts": _pairs(5, 9), "share": 2},
    "office/alex_drawer_unit_castors": {"fronts": _pairs(9, 3)},
    "office/trotten_drawer_unit_castors": {"fronts": _pairs(9, 3)},
    "office/helmer_drawer_unit_28x44x65": {"fronts": _pairs(2, 6), "solid": 0},
    "office/elloven_monitor_stand_drawer": {"fronts": [(5, [5, 6])]},
    # desks with two drawer units: five handleless drawers in each solid unit, the lowest two of a unit share a slot
    **{
        f"office/lagkapten_alex_desk_{n}x60": {
            "fronts": [(i, [i]) for i in range(2, 7)] + [(i, [i]) for i in range(8, 13)],
            "solids": {**{i: 1 for i in range(2, 7)}, **{i: 7 for i in range(8, 13)}},
            "share": 2,
        }
        for n in (120, 140, 200)
    },
    # MICKE desks (run 16 last): a drawer and a door in the drawer unit (the unit's panels enclose them, so the drawer
    # gets a box); the 142 cm desk has a second drawer under the top, between the left side and the unit (no floor
    # under it, so its front slides alone)
    "office/micke_desk_105x50": {
        "fronts": [(9, [9, 10])],
        "doors": [(6, [6, 7], "right")],
        "room": {"left": 4, "right": 3, "floor": 8, "top": 0, "back": 2},
    },
    "office/micke_desk_142x50": {
        "fronts": [(9, [9, 10]), (11, [11, 12])],
        "doors": [(6, [6, 7], "right")],
        "room": {"left": 4, "right": 3, "floor": 8, "top": 0, "back": 2},
        "loose_fronts": [11],
    },
    # loft beds: the drawers under the desk have no side panels, so their fronts slide alone
    "kids/smastad_loft_bed_3_drawers": {
        "fronts": [(i, [i, i + 1]) for i in (15, 17, 19)],
        "tray": False,
    },
    "kids/smastad_loft_bed_4_drawers": {
        "fronts": [(i, [i, i + 1]) for i in (15, 17, 19, 21)],
        "tray": False,
    },
    "kids/smastad_platsa_bookcase_6dr_60x57x181": {"fronts": _pairs(5, 6)},
    "bed/brimnes_day_bed_2_drawers": {"fronts": [(4, [4, 5]), (6, [6, 7])]},
    "bed/hemnes_day_bed_3_drawers": {
        "fronts": [(16, [16, 17, 18]), (19, [19, 20, 21]), (22, [22, 23, 24])],
        "solid": 15,
    },
}
APPLIANCES = [
    "appliance/tillreda_microwave_oven",
    "appliance/tvattad_integrated_washer_dryer",
    "appliance/uddarp_washing_machine_7kg",
    "appliance/uddarp_washing_machine_8kg",
]
# the items looked at and left as they are, with the reason (for the report)
LEFT = {
    "media/lack_tv_bench_90": "open shelves: no door and no drawer",
    "media/lack_tv_bench_120": "open shelves: no door and no drawer",
    "media/lack_tv_bench_160": "open shelves: no door and no drawer",
    "media/besta_tv_bench_120x40x48": "open: no door and no drawer",
    "media/besta_tv_bench_180x40x38": "open: no door and no drawer",
    "media/besta_tv_bench_180x40x64": "open: no door and no drawer",
    # looked at again in run 16 (last): shelf boards and a back, a ladder: no drawer front and no door
    "kids/smastad_loft_bed_storage": "open shelves under the desk: no door and no drawer",
    "kids/smastad_loft_bed_2_shelves": "open shelves under the desk: no door and no drawer",
}


def _front_ok(item: dict, main: int) -> None:
    p = item["parts"][main]
    W, D, _H = item["size"]
    if p["shape"] != "box" or p["d"] * D > 0.04 or p["w"] * W < 0.1 or p["z"] * D < 0.05:
        raise lc.Report(f"part {main} is not a front")


def _name_slots(item: dict, fronts: list[Front], share: int) -> tuple[list[dict], dict[int, str]]:
    """The item's drawer slots, and the slot of each front (by its main part): named by place, top to bottom."""
    parts = item["parts"]
    xs = sorted({round(parts[m]["x"], 2) for m, _ in fronts})
    rows = sorted({round(parts[m]["y"], 2) for m, _ in fronts}, reverse=True)
    side = {1: [""], 2: ["left", "right"], 3: ["left", "middle", "right"]}.get(len(xs))
    if side is None:
        raise lc.Report("more than 3 columns of drawers")
    order = sorted(fronts, key=lambda f: (-round(parts[f[0]]["y"], 2), parts[f[0]]["x"]))
    keep = len(rows) - share if share else len(rows)  # rows below this share a slot, per column
    slots: list[dict] = []
    slot_of: dict[int, str] = {}
    shared: dict[int, str] = {}  # column -> slot id of its shared drawers
    for m, _ in order:
        r, c = rows.index(round(parts[m]["y"], 2)), xs.index(round(parts[m]["x"], 2))
        if r >= keep:
            if c not in shared:
                shared[c] = f"drawer_{len(slots) + 1}"
                count = NUMBER[len(rows) - keep]
                place = f"{side[c]} " if side[c] else ""
                slots.append({"id": shared[c], "kind": "drawer", "name": {"en": f"Bottom {count} {place}drawers"}})
            slot_of[m] = shared[c]
            continue
        if len(fronts) == 1:
            sid, name = "drawer", None
        else:
            sid = f"drawer_{len(slots) + 1}"
            if len(rows) == 1:
                word = f"{side[c].capitalize()} drawer"
            else:
                word = ORDINAL[r] if r < len(ORDINAL) else f"No. {r + 1}"
                if r == len(rows) - 1 and not share and len(rows) >= 3:
                    word = "Bottom"
                word = f"{word} {side[c]} drawer".replace("  ", " ") if side[c] else f"{word} drawer"
            name = word
        slot = {"id": sid, "kind": "drawer"}
        if name:
            slot["name"] = {"en": name}
        slots.append(slot)
        slot_of[m] = sid
    if len(slots) > lc.MAX_SLOTS:
        raise lc.Report(f"{len(slots)} slots are more than {lc.MAX_SLOTS}")
    return slots, slot_of


def _recess(item: dict, m: dict, solid: dict) -> dict | None:
    """A thin dark recess on the face of a solid carcass behind a front, so an open drawer shows an opening and not a
    flat face. It sits inside the front's thickness (None when the front is too thin to hide one)."""
    _W, D, H = item["size"]
    W = item["size"][0]
    face = solid["z"] + solid["d"] / 2
    zb, zf = m["z"] - m["d"] / 2, m["z"] + m["d"] / 2
    t = min(0.004 / D, zf - face - 0.0005 / D)
    if zb > face + 1e-6 or t < 0.001 / D:
        return None
    x0, x1, y0, y1 = lc._rect(m)
    ix, iy = 0.012 / W, 0.012 / H
    centre = min(0.5, face + t / 2)  # a face at the item's front: the recess reaches back into the body
    return {
        "shape": "box",
        "x": lc._f((x0 + x1) / 2),
        "z": lc._f(centre),
        "w": lc._f(max(0.001, x1 - x0 - 2 * ix)),
        "d": lc._f(2 * (face + t - centre)),
        "y": lc._f(y0 + iy),
        "h": lc._f(max(0.001, y1 - y0 - 2 * iy)),
        "color": "dark",
        "fix": "d",
    }


def _room(item: dict, spec: dict) -> tuple[float, float, float, float, float]:
    """The room a drawer box fits in, (x0, x1, y0, y1, back z) in fractions, from the parts that enclose it."""
    r, P = spec["room"], item["parts"]
    edge = lambda i, s: P[i]["x"] + s * P[i]["w"] / 2  # noqa: E731
    return (
        edge(r["left"], 1),
        edge(r["right"], -1),
        P[r["floor"]]["y"] + P[r["floor"]]["h"],
        P[r["top"]]["y"],
        P[r["back"]]["z"] + P[r["back"]]["d"] / 2 + 0.005,
    )


def _fresh(item: dict) -> None:
    if "slots" in item or any("bind" in p for p in item["parts"]):
        raise lc.Report("already live")


def build_drawers(item: dict, spec: dict) -> tuple[dict, dict]:
    _fresh(item)
    W, D, H = item["size"]
    old = [dict(p) for p in item["parts"]]
    fronts: list[Front] = spec["fronts"]
    for m, _ in fronts:
        _front_ok(item, m)
    slots, slot_of = _name_slots(item, fronts, spec.get("share", 0))
    loose = spec.get("tray") is False
    parts = [dict(p) for p in old]
    bind_of: dict[int, dict] = {}
    for m, idx in fronts:
        bind = {"slot": slot_of[m], "kind": "slide"}
        bind_of[m] = bind
        for i in idx:
            parts[i]["bind"] = dict(bind)
    doors = spec.get("doors", [])
    for m, idx, hinge in doors:
        _front_ok(item, m)
        for i in idx:
            parts[i]["bind"] = {"slot": "door", "kind": "open", "hinge": hinge, "amount": 100}
    if doors:
        slots.append({"id": "door", "kind": "contact"})
    # a drawer box behind each front (and a recess in a solid carcass), as much as the 60 parts take
    added: list[dict] = []
    solids = spec.get("solids", {})
    n_box = 0 if loose else len(fronts)
    tray_parts = 3 if len(parts) + 3 * n_box + (len(fronts) if (solids or "solid" in spec) else 0) <= MAX_PARTS else 1
    for m, _ in fronts:
        fm = old[m]
        sidx = solids.get(m, spec.get("solid"))
        solid = old[sidx] if sidx is not None else None
        if not loose and m not in spec.get("loose_fronts", []):
            room = _room(item, spec) if "room" in spec else lc.interior(item, fm, solid)
            added += [
                {**t, "bind": dict(bind_of[m])} for t in lc._tray(fm, fm["z"] - fm["d"] / 2, W, D, H, tray_parts, room)
            ]
        if solid is not None:
            rec = _recess(item, fm, solid)
            if rec and len(parts) + len(added) < MAX_PARTS:
                added.append(rec)
    if len(parts) + len(added) > MAX_PARTS:
        raise lc.Report(f"{len(parts) + len(added)} parts are too many")
    if len(slots) > lc.MAX_SLOTS:
        raise lc.Report(f"{len(slots)} slots are more than {lc.MAX_SLOTS}")
    out = dict(item)
    out["slots"] = slots
    out["parts"] = parts + added
    if added and not item.get("symbol"):
        out["symbol"] = lc.plan_symbol(item)
    return out, {"slots": [s["id"] for s in slots], "parts": (len(old), len(out["parts"]))}


# ----- appliances: a door, a drum opening and paddles that turn ------------------------------------------------------


def _box(
    shape: str,
    W: float,
    D: float,
    H: float,
    x: float,
    y0: float,
    y1: float,
    z0: float,
    z1: float,
    w: float,
    color: str,
    **kw,
) -> dict:
    """A part from metres: x the middle, y0..y1 up, z0..z1 front to back (z of the item's middle = 0), w the width."""
    if (z0 + z1) / 2 > D / 2:  # a part's middle is at most the item's front: keep the front, reach back into the body
        z0 = D - z1
    p = {
        "shape": shape,
        "x": lc._f(x / W),
        "z": lc._f((z0 + z1) / 2 / D),
        "w": lc._f(w / W),
        "d": lc._f((z1 - z0) / D),
        "y": lc._f(y0 / H),
        "h": lc._f((y1 - y0) / H),
        "color": color,
    }
    p.update(kw)
    return p


def _paddles(W: float, D: float, H: float, cx: float, cy: float, dia: float, z0: float, z1: float) -> list[dict]:
    """Two paddles across a drum opening (a cross): they turn about its middle while the machine runs."""
    spin = {"slot": "running", "kind": "spin", "axis": "z", "amount": 45}
    bar = {"fix": "wdh", "bind": spin}
    return [
        _box("box", W, D, H, cx, cy - 0.0125, cy + 0.0125, z0, z1, 0.9 * dia, "metal", **bar),
        _box("box", W, D, H, cx, cy - 0.45 * dia, cy + 0.45 * dia, z0, z1, 0.025, "metal", **bar),
    ]


def build_washer(item: dict) -> tuple[dict, dict]:
    """The door (ring and glass) turns about its left edge; behind it a dark drum opening with two paddles."""
    _fresh(item)
    W, D, H = item["size"]
    old = [dict(p) for p in item["parts"]]
    ring, glass = old[5], old[6]
    if not (ring["shape"] == "cyl" == glass["shape"] and ring.get("axis") == "z" and glass.get("axis") == "z"):
        raise lc.Report("the door is not the two cylinders at 5 and 6")
    parts = [dict(p) for p in old]
    door = {"slot": "door", "kind": "open", "hinge": "left", "amount": 100}
    for i in (5, 6):
        parts[i]["bind"] = dict(door)
    face = old[0]["z"] * D + old[0]["d"] * D / 2  # the front of the body, in metres
    cx, dia = glass["x"] * W, glass["w"] * W
    cy = (glass["y"] + glass["h"] / 2) * H
    t1, t2 = 0.004, 0.003  # the opening and the paddles in front of it: both inside the thickness of the ring
    opening = _box("cyl", W, D, H, cx, glass["y"] * H, (glass["y"] + glass["h"]) * H, face, face + t1, dia, "dark")
    opening.update(axis="z", fix="wdh")
    added = [opening, *_paddles(W, D, H, cx, cy, dia, face + t1, face + t1 + t2)]
    return _live(item, old, parts, added, [{"id": "door", "kind": "contact"}, {"id": "running", "kind": "power"}])


def build_washer_dryer(item: dict) -> tuple[dict, dict]:
    """An integrated washer-dryer: its front is a door of its own (the slab and the handle) hinged on the left."""
    _fresh(item)
    W, D, H = item["size"]
    old = [dict(p) for p in item["parts"]]
    body, slab = old[1], old[2]
    if body["color"] != "metal" or slab["color"] != "body" or len(old) != 4:
        raise lc.Report("not the layout of the integrated washer-dryer")
    parts = [dict(p) for p in old]
    for i in (2, 3):
        parts[i]["bind"] = {"slot": "door", "kind": "open", "hinge": "left", "amount": 100}
    face = (body["z"] + body["d"] / 2) * D  # the front of the metal body
    dia, cy = 0.40, 0.5 * H
    t1, t2 = 0.006, 0.0035  # behind the front slab (18 mm), which hides both while it is closed
    opening = _box("cyl", W, D, H, 0, cy - dia / 2, cy + dia / 2, face, face + t1, dia, "dark", axis="z", fix="wdh")
    added = [opening, *_paddles(W, D, H, 0, cy, dia, face + t1, face + t1 + t2)]
    # the opening's circle must lie behind the slab's front face
    slab_front = (slab["z"] + slab["d"] / 2) * D
    if face + t1 + t2 >= slab_front:
        raise lc.Report("the paddles would show in front of the closed slab")
    return _live(item, old, parts, added, [{"id": "door", "kind": "contact"}, {"id": "running", "kind": "power"}])


def build_microwave(item: dict) -> tuple[dict, dict]:
    """The door (its dark panel and the window) turns about its left edge; a steel liner shows behind it."""
    _fresh(item)
    W, D, H = item["size"]
    old = [dict(p) for p in item["parts"]]
    door, window = old[1], old[2]
    if door["color"] != "dark" or window["color"] != "glass":
        raise lc.Report("not the layout of the microwave")
    parts = [dict(p) for p in old]
    for i in (1, 2):
        parts[i]["bind"] = {"slot": "door", "kind": "open", "hinge": "left", "amount": 100}
    face = old[0]["z"] * D + old[0]["d"] * D / 2
    x0, x1 = (door["x"] - door["w"] / 2) * W, (door["x"] + door["w"] / 2) * W
    y0, y1 = door["y"] * H, (door["y"] + door["h"]) * H
    ins = 0.012
    liner = _box(
        "box", W, D, H, (x0 + x1) / 2, y0 + ins, y1 - ins, face, face + 0.002, x1 - x0 - 2 * ins, "metal", fix="d"
    )
    return _live(item, old, parts, [liner], [{"id": "door", "kind": "contact"}])


def _live(item: dict, old: list[dict], parts: list[dict], added: list[dict], slots: list[dict]) -> tuple[dict, dict]:
    if len(parts) + len(added) > MAX_PARTS:
        raise lc.Report("too many parts")
    out = dict(item)
    out["slots"] = slots
    out["parts"] = parts + added
    if added and not item.get("symbol"):
        out["symbol"] = lc.plan_symbol(item)
    return out, {"slots": [s["id"] for s in slots], "parts": (len(old), len(out["parts"]))}


BUILDERS = {
    "appliance/tillreda_microwave_oven": build_microwave,
    "appliance/tvattad_integrated_washer_dryer": build_washer_dryer,
    "appliance/uddarp_washing_machine_7kg": build_washer,
    "appliance/uddarp_washing_machine_8kg": build_washer,
}


def convert(key: str, item: dict) -> tuple[dict, dict]:
    """The live item for `key` ("<group>/<id>" in amluto.ikea-uk), or lc.Report."""
    if key in BUILDERS:
        return BUILDERS[key](item)
    return build_drawers(item, DRAWERS[key])


def item_keys() -> list[str]:
    return [*DRAWERS, *APPLIANCES]


def _path(key: str) -> Path:
    return BUNDLED / PACK / f"{key}.json"


def _digest(value: object) -> str:
    text = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def closed_fixture() -> dict:
    """What pins the closed look: the number of parts, a digest of them and a digest of every other field (the symbol
    apart: it is checked on its own). Made from the items as they are BEFORE the conversion."""
    out = {}
    for key in item_keys():
        item = json.loads(_path(key).read_text(encoding="utf-8"))
        if "slots" in item:  # converted already: its entry is in the committed fixture (tests/fixtures)
            continue
        out[f"{PACK}/{key}"] = {
            "parts": len(item["parts"]),
            "look": _digest(item["parts"]),
            "fields": _digest({k: v for k, v in item.items() if k not in ("parts", "slots", "symbol")}),
            "symbol": item.get("symbol"),
        }
    return out


def run(write: bool) -> list[str]:
    changed: list[str] = []
    for key in item_keys():
        path = _path(key)
        raw = path.read_bytes().decode("utf-8")
        item = json.loads(raw)
        if "slots" in item:
            continue
        style = lc.style_of(raw, item)
        if style is None:
            raise SystemExit(f"{key}: file style not reproducible")
        new, info = convert(key, item)
        print(f"{key}: {info['parts'][0]} -> {info['parts'][1]} parts, slots {info['slots']}")
        changed.append(key)
        if write:
            path.write_bytes((lc.write_a if style == "a" else lc.write_b)(new).encode("utf-8"))
    for key, why in LEFT.items():
        print(f"left as it is: {key}: {why}")
    if write and changed:
        pj = BUNDLED / PACK / "pack.json"
        meta = json.loads(pj.read_text(encoding="utf-8"))
        if MARKER not in str(meta.get("release_note", "")):
            meta["release"] = int(meta["release"]) + 1
        meta["release_note"] = NOTE.format(release=meta["release"])
        pj.write_bytes((json.dumps(meta, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
        print(f"{PACK}: release {meta['release']}")
    return changed


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--fixture", action="store_true")
    args = ap.parse_args()
    if args.fixture:
        print(json.dumps(closed_fixture(), indent=1, sort_keys=True))
    else:
        run(args.write)
