"""Live parts for more of our own items (run 16): microwaves and small ovens, air fryers, chest freezers, washing
machines and tumble dryers, sliding doors, outdoor kitchen cabinets, tool chests, desk drawer units, a printer cabinet.

    python tools/live_misc.py            report what would change (nothing is written)
    python tools/live_misc.py --write    rewrite the item files and bump the packs' releases and notes
    python tools/live_misc.py --fixture [--ref HEAD]
                                         write tests/fixtures/misc-closed-look.json from the items as they are now (or in
                                         a git revision from before the conversion): it pins the closed look

It builds on tools/kitchen_live.py (fronts, liners behind a front, drawer boxes) and tools/live_cabinets.py (file
layouts, the plan symbol). The item files are the source (they are hand-written); this tool is the repeatable step: an
item that is live already is skipped, so a second run changes nothing. Nothing here changes how an item looks closed:
the parts it had stay as they were (only a `bind` is added), its size, tags and symbol are kept, and everything new
(the inside of a cupboard, a drawer box, the liner of an oven or a freezer, the drum of a washing machine) sits behind
the closed fronts, inside the item's own body or inside the thickness of the front.

What an item gets:
- a door of a microwave turns about its left edge, the door of a mini oven or an air fryer oven folds down;
- a drawer (air fryer basket, tool chest, desk drawer unit) slides out with a drawer box behind its front;
- a chest freezer's lid and a tool chest's top lid lift at the front about their back edge (hinge "back");
- a washing machine's or tumble dryer's door turns about its left edge, and its drum (a dark disc with a T of steel
  bars, seen when the door is open) turns while the machine runs (slot `running`, a power reading or a switch);
- the two sliding doors of a wardrobe or a TV bench slide past each other (bind `to`: left / right);
- the doors of the outdoor kitchen units and of the printer cabinet swing about their outer edges.
Not made live (see the report of the run): items with no door or drawer, and a corner wardrobe whose side door hinges
about the depth axis, which the format cannot do.
"""

from __future__ import annotations

import argparse
import copy
from dataclasses import dataclass, field
import hashlib
import json
from pathlib import Path
import re
import subprocess
import sys
from typing import Callable

sys.path.insert(0, str(Path(__file__).resolve().parent))

from kitchen_live import (  # noqa: E402
    MAX_PARTS,
    MAX_SLOTS,
    Front,
    _assign_slots,
    _bind_for,
    _box,
    _front_groups,
    _part,
)
from live_cabinets import Report, plan_symbol, style_of, write_a, write_b  # noqa: E402
from pack_builder import BUNDLED  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
FIXTURE = ROOT / "tests" / "fixtures" / "misc-closed-look.json"
MARKER = "run16 misc"
NOTES = {
    "amluto.kitchen-bath": "microwaves, mini oven, air fryers, chest freezers, washing machines and dryers open and turn with Home Assistant",
    "amluto.ikea-uk": "sliding wardrobe and TV bench doors, outdoor kitchen cabinet doors move with Home Assistant",
    "amluto.bedroom": "tool chest drawers and lids move with Home Assistant",
    "amluto.office": "desk drawer units slide out with Home Assistant",
    "amluto.makers": "the printer cabinet's doors open with Home Assistant",
}
LID_DEG = 75
FOLD_DEG = 90
SLIDE_DOOR = 0.21  # a sliding door's way, a share of the item's width
DRUM_RPM = 45


@dataclass
class Plan:
    """What an item becomes: its fronts (parts that move), the parts and slots added besides."""

    fronts: list[Front]
    extra_parts: list[dict] = field(default_factory=list)
    extra_slots: list[dict] = field(default_factory=list)


def _dim(item: dict) -> tuple[float, float, float]:
    W, D, H = item["size"]
    return W, D, H


def _body_face(item: dict) -> float:
    """The front face (m) of the item's biggest part: the body the fronts sit on."""
    W, D, H = _dim(item)
    big = max(item["parts"], key=lambda p: p["w"] * W * p["d"] * D * p["h"] * H)
    return _box(big, W, D, H)[5]


def _front(
    item: dict, idx: list[int], kind: str, slot: str, hinge: str = "left", name: str | None = None, **kw
) -> Front:
    """A front of the item: the parts `idx` (the first one is the slab), its box in metres, what it does."""
    W, D, H = _dim(item)
    x0, x1, y0, y1, z0, z1 = _box(item["parts"][idx[0]], W, D, H)
    f = Front(idx, x0, x1, y0, y1, z0, z1, kind, hinge, kw.pop("liner", "dark"), name, slot=slot)
    f.extra.update(kw)
    return f


def _ordinals(n: int, word: str = "drawer") -> list[tuple[str, str]]:
    """The slot ids and names of n drawers one above the other, top to bottom."""
    if n == 1:
        return [(word, word.capitalize())]
    names = ["Top", "Second", "Third", "Fourth", "Fifth", "Sixth", "Seventh", "Eighth"]
    if n == 2:
        names = ["Top", "Bottom"]
    elif n == 3:
        names = ["Top", "Middle", "Bottom"]
    else:
        names = names[: n - 1] + ["Bottom"]
    return [(f"{word}_{i + 1}", f"{names[i]} {word}") for i in range(n)]


def _drawers(item: dict, groups: list[list[int]], word: str = "drawer", slot: str | None = None, **kw) -> list[Front]:
    """Drawers in a column, listed top to bottom: one slot each (or all in `slot`)."""
    out = []
    for (sid, name), idx in zip(_ordinals(len(groups), word), groups):
        out.append(_front(item, idx, "drawer", slot or sid, name=None if slot else name, **kw))
    return out


# ---- the families -------------------------------------------------------------------------------------------------


def microwave(item: dict) -> Plan:
    """The door (dark, a steel or white top edge) with its window: it turns about its left edge, the controls beside it
    stay. Behind it, on the body's face, a steel cavity."""
    door = next(i for i, p in enumerate(item["parts"]) if "top" in p)
    idx = [door] + ([door + 1] if item["parts"][door + 1]["color"] == "glass" else [])
    return Plan([_front(item, idx, "side", "door", "left", name="Door", liner="metal", inset=0.02)])


def mini_oven(item: dict) -> Plan:
    """The glass door with the bar that is its handle folds down (there is no room for a cavity: the glass stands a
    millimetre proud of the body)."""
    return Plan([_front(item, [5, 6], "fold", "door", name="Oven door", liner="metal", inset=0.02)])


def fryer(item: dict) -> Plan | None:
    """Air fryers: the basket drawers (a front, its handle and the knob on it), or the door of the oven style."""
    parts = item["parts"]
    variant = item["variant"]["en"]
    if variant.startswith("Oven"):
        return Plan([_front(item, [7, 8, 9], "fold", "door", name="Oven door", liner="metal", inset=0.025)])
    rbox = [i for i, p in enumerate(parts) if p["shape"] == "rbox" and i > 4]
    if not rbox:
        raise Report("no basket found")
    groups = []
    for n, i in enumerate(rbox):
        end = rbox[n + 1] if n + 1 < len(rbox) else len(parts)
        groups.append(list(range(i, end)))
    # the stacked fryer: the display panel after the last drawer belongs to no drawer
    groups = [[i for i in g if _on_front(parts, g[0], i, item)] for g in groups]
    if len(groups) == 2 and abs(parts[groups[0][0]]["x"] - parts[groups[1][0]]["x"]) > 0.1:
        # two baskets side by side: left, right
        left, right = sorted(groups, key=lambda g: parts[g[0]]["x"])
        return Plan(
            [
                _front(item, left, "drawer", "left_basket", name="Left basket"),
                _front(item, right, "drawer", "right_basket", name="Right basket"),
            ]
        )
    groups.sort(key=lambda g: -parts[g[0]]["y"])
    if len(groups) == 1:
        return Plan([_front(item, groups[0], "drawer", "basket", name="Basket")])
    return Plan(_drawers(item, groups, "basket"))


def _on_front(parts: list[dict], main: int, i: int, item: dict) -> bool:
    """A part that sits on the front of parts[main]: within its box, in height and across."""
    W, D, H = _dim(item)
    sx0, sx1, sy0, sy1, sz0, _ = _box(parts[main], W, D, H)
    x0, x1, y0, y1, z0, _ = _box(parts[i], W, D, H)
    return z0 >= sz0 - 0.001 and y0 >= sy0 - 0.01 and y1 <= sy1 + 0.01 and x0 >= sx0 - 0.03 and x1 <= sx1 + 0.03


def chest_freezer(item: dict) -> Plan:
    """The lid (the rounded top, its seal and handle) lifts at the front about its back edge."""
    return Plan([_front(item, [2, 3, 4], "lid", "lid", name="Lid", liner="dark", inset=0.06)])


def laundry(item: dict) -> Plan:
    """A washing machine or tumble dryer: the porthole (a steel ring, a dark ring and the glass) is the door; the drum
    behind it turns while the machine runs."""
    parts = item["parts"]
    ring = next(i for i, p in enumerate(parts) if p["shape"] == "cyl" and p.get("axis") == "z" and p["w"] > 0.5)
    W, D, H = _dim(item)
    door = _front(item, [ring, ring + 1, ring + 2], "door", "door", "left", name="Door")
    door.extra["no_liner"] = True
    x0, x1, y0, y1, _, _ = _box(parts[ring], W, D, H)
    cx, cy, r = (x0 + x1) / 2, (y0 + y1) / 2, (x1 - x0) / 2
    face = _body_face(item)
    z = face
    rim = _part(
        "cyl",
        cx - 0.94 * r,
        cx + 0.94 * r,
        cy - 0.94 * r,
        cy + 0.94 * r,
        z,
        z + 0.0015,
        W,
        D,
        H,
        "metal",
        axis="z",
        edges="faint",
    )
    bind = {"slot": "running", "kind": "spin", "axis": "z", "amount": DRUM_RPM}
    rd = 0.84 * r
    drum = [
        _part(
            "cyl",
            cx - rd,
            cx + rd,
            cy - rd,
            cy + rd,
            z + 0.0015,
            z + 0.003,
            W,
            D,
            H,
            "dark",
            axis="z",
            edges="faint",
            bind=dict(bind),
        ),
        _part(
            "box",
            cx - 0.9 * rd,
            cx + 0.9 * rd,
            cy - 0.012,
            cy + 0.012,
            z + 0.003,
            z + 0.0045,
            W,
            D,
            H,
            "metal",
            edges="faint",
            bind=dict(bind),
        ),
        _part(
            "box",
            cx - 0.012,
            cx + 0.012,
            cy,
            cy + 0.8 * rd,
            z + 0.003,
            z + 0.0045,
            W,
            D,
            H,
            "metal",
            edges="faint",
            bind=dict(bind),
        ),
    ]
    return Plan([door], [rim] + drum, [{"id": "running", "kind": "power", "name": {"en": "Running (power or switch)"}}])


def laundry_integrated(item: dict) -> Plan:
    """The washing machine behind a cabinet front: the front (slab, frame strips, handle) is the door, hinged opposite
    the handle. It lies flush with the machine's face, so there is no room for anything behind it."""
    return Plan([_front(item, [2, 3, 4, 5, 6, 7], "door", "door", "left", name="Door")])


def sliding_pair(item: dict) -> Plan:
    """Two sliding doors on two tracks, the left one in front: each slides toward the middle past the other."""
    parts = item["parts"]
    doors = [
        i
        for i, p in enumerate(parts)
        if p["shape"] == "box"
        and p["color"] != "dark"
        and p["d"] < 0.06
        and p["w"] > 0.3
        and p["h"] > 0.3
        and p["z"] > 0.4
    ]
    if len(doors) != 2:
        raise Report(f"{len(doors)} sliding doors")
    out = []
    for i in sorted(doors, key=lambda i: parts[i]["x"]):
        handle = i + 1 if parts[i + 1]["color"] == "dark" else None
        out.append(
            _front(
                item,
                [i] + ([handle] if handle else []),
                "sliding",
                "door",
                name="Sliding doors",
                no_liner=True,
                to="right" if parts[i]["x"] < 0 else "left",
            )
        )
    return Plan(out)


def outdoor_cabinets(item: dict) -> Plan:
    """Pairs of doors (dark, with a handle each beside the middle), one slot for each cabinet: the cabinets are
    side by side, so each pair has its own."""
    iid = item["id"]
    if iid == "grillskar_sink_unit_cabinet_172":
        pairs = [
            ("sink_doors", "Sink cabinet doors", [[2, 4], [3, 5]]),
            ("cabinet_doors", "Cabinet doors", [[11, 13], [12, 14]]),
        ]
    elif iid == "grillskar_outdoor_kitchen_244":
        pairs = [
            ("left_doors", "Left cabinet doors", [[2, 4], [3, 5]]),
            ("barbecue_doors", "Barbecue doors", [[10], [11]]),
            ("right_doors", "Right cabinet doors", [[23, 25], [24, 26]]),
        ]
    else:
        raise Report("unknown outdoor kitchen")
    out = []
    for slot, name, doors in pairs:
        for k, idx in enumerate(doors):
            out.append(_front(item, idx, "door", slot, "left" if k == 0 else "right", name=name, no_liner=True))
    return Plan(out)


def printer_cabinet(item: dict) -> Plan:
    """The two lower doors (handles at the middle): hinged on the outer edges. The dark panel above has no handle."""
    return Plan(
        [
            _front(item, [2, 4], "door", "door", "left", name="Doors", no_liner=True),
            _front(item, [3, 5], "door", "door", "right", name="Doors", no_liner=True),
        ]
    )


def tool_chest(item: dict) -> Plan:
    """The roller cabinet's drawers (and the top chest's: three drawers and the lid); a drawer front and its handle."""
    parts = item["parts"]
    iid = item["id"]
    if iid == "tool_chest_roller_cabinet":
        return Plan(_drawers(item, [[10 + 2 * k, 11 + 2 * k] for k in range(6)]))
    if iid == "tool_chest_top_box":
        lid = _front(item, [1, 2], "lid", "lid", name="Lid", inset=0.06)
        return Plan([lid] + _drawers(item, [[3, 4], [5, 6], [7, 8]], "drawer"))
    if iid == "tool_chest":
        # more than eight slots otherwise: the top chest's three drawers share one
        top_face = _box(parts[25], *_dim(item))[5]
        lid = _front(item, [26, 27], "lid", "lid", name="Top chest lid", inset=0.06)
        chest = _drawers(item, [[28, 29], [30, 31], [32, 33]], "drawer", slot="chest_drawers", face=top_face)
        for f in chest:
            f.name = "Top chest drawers"
        roller = _drawers(item, [[10 + 2 * k, 11 + 2 * k] for k in range(6)])
        return Plan([lid] + chest + roller)
    raise Report("unknown tool chest")


def desk_drawers(item: dict) -> Plan:
    """A drawer unit: every slab in the body colour is a drawer front; its handle and lock go with it."""
    W, D, H = _dim(item)
    parts = item["parts"]
    fronts = _front_groups(parts, W, D, H)
    if not fronts:
        raise Report("no drawer fronts")
    claimed = {i for f in fronts for i in f.idx}
    slabs = [_box(parts[f.idx[0]], W, D, H) for f in fronts]
    for i, p in enumerate(parts):
        if i in claimed:
            continue
        x0, x1, y0, y1, z0, _ = _box(p, W, D, H)
        for f, slab in zip(fronts, slabs):
            if z0 >= slab[4] - 0.001 and slab[0] <= (x0 + x1) / 2 <= slab[1] and slab[2] <= (y0 + y1) / 2 <= slab[3]:
                f.idx.append(i)
    fronts.sort(key=lambda f: -f.y1)
    return Plan(_drawers(item, [f.idx for f in fronts]))


def _family(item: dict) -> str:
    return item.get("family", "")


def recipe(item: dict) -> Plan | None:
    """The plan for an item, or None when it is not one of ours (see the module's doc)."""
    iid, fam = item["id"], _family(item)
    if fam == "microwave":
        return microwave(item)
    if iid == "mini_oven_20l":
        return mini_oven(item)
    if fam == "air_fryer":
        return fryer(item)
    if fam == "chest_freezer":
        return chest_freezer(item)
    if iid == "washing_machine_integrated":
        return laundry_integrated(item)
    if fam in ("washing_machine", "tumble_dryer"):
        return laundry(item)
    if iid in ("kleppstad_wardrobe_sliding", "stockholm_tv_bench"):
        return sliding_pair(item)
    if fam == "grillskar_outdoor_kitchen":
        return outdoor_cabinets(item) if iid != "grillskar_gas_barbecue" else None
    if fam == "tool_chest":
        return tool_chest(item)
    if fam == "desk_drawers":
        return desk_drawers(item)
    if iid == "printer_cabinet":
        return printer_cabinet(item)
    return None


# where the recipes look: <pack>/<group>/<id>
TARGETS = [
    r"^amluto\.kitchen-bath/appliance/(microwave_\w+|built_in_microwave|mini_oven_20l|air_fryer\w*|chest_freezer_\d+"
    r"|washing_machine\w*|tumble_dryer\w*)$",
    r"^amluto\.ikea-uk/storage/kleppstad_wardrobe_sliding$",
    r"^amluto\.ikea-uk/media/stockholm_tv_bench$",
    r"^amluto\.ikea-uk/outdoor/grillskar_(sink_unit_cabinet_172|outdoor_kitchen_244)$",
    r"^amluto\.bedroom/storage/tool_chest\w*$",
    r"^amluto\.office/office/desk_drawers_\w+$",
    r"^amluto\.makers/tech/printer_cabinet$",
]


# ---- building the live item ---------------------------------------------------------------------------------------


def _bind(f: Front) -> dict:
    if f.kind == "lid":
        return {"slot": f.slot, "kind": "open", "hinge": "back", "amount": LID_DEG}
    if f.kind == "sliding":
        return {"slot": f.slot, "kind": "slide", "to": f.extra["to"], "amount": SLIDE_DOOR}
    if f.kind == "fold":
        return {"slot": f.slot, "kind": "open", "hinge": "bottom", "amount": FOLD_DEG}
    return _bind_for(f)


def _liner(f: Front, face: float, W: float, D: float, H: float) -> list[dict]:
    """What shows behind an open door, on the body's face and inside the front's own thickness (so a closed front
    hides it). Nothing when the front stands less than 2 mm proud of the face: it would have no room."""
    if f.extra.get("no_liner"):
        return []
    m = f.extra.get("inset", 0.012)
    if f.kind == "lid":
        # on the body's top, under the lid (its underside is the front's y0), inside the lid's thickness
        return [_part("box", f.x0 + m, f.x1 - m, f.y0 + 0.001, f.y0 + 0.005, f.z0 + m, f.z1 - m, W, D, H, f.liner)]
    z0 = max(f.z0, face)
    room = f.z1 - 0.0008 - z0
    if room < 0.002:
        return []
    t = min(0.006, room)
    return [_part("box", f.x0 + m, f.x1 - m, f.y0 + m, f.y1 - m, z0, z0 + t, W, D, H, f.liner)]


def _tray(f: Front, face: float, W: float, D: float, H: float, solid: bool) -> list[dict]:
    """A drawer box behind a drawer front, inside the body: it starts at the body's face and slides out with the front."""
    length = 0.42 * D
    x0, x1 = f.x0 + 0.04, f.x1 - 0.04
    y0 = f.y0 + 0.03
    top = min(f.y1 - 0.02, y0 + 0.11)
    z1 = min(f.z0, face) - 0.002
    z0 = z1 - length
    kw = {"edges": "faint", "bind": {"slot": f.slot, "kind": "slide"}}
    if solid:
        return [_part("box", x0, x1, y0, max(y0 + 0.01, min(y0 + 0.05, f.y1 - 0.02)), z0, z1, W, D, H, "white", **kw)]
    t = 0.012
    return [
        _part("box", x0, x1, y0, y0 + t, z0, z1, W, D, H, "white", **kw),
        _part("box", x0, x0 + t, y0 + t, top, z0, z1, W, D, H, "white", **kw),
        _part("box", x1 - t, x1, y0 + t, top, z0, z1, W, D, H, "white", **kw),
        _part("box", x0 + t, x1 - t, y0 + t, top, z0, z0 + t, W, D, H, "white", **kw),
    ]


def _owns_symbol(item: dict) -> bool:
    return bool(item.get("symbol"))


def build(item: dict) -> dict:
    """The item with live parts; raises Report when it cannot be made live (and says why)."""
    if "slots" in item or any("bind" in p for p in item["parts"]):
        raise Report("already live")
    plan = recipe(item)
    if plan is None or not plan.fronts:
        raise Report("nothing opens")
    W, D, H = _dim(item)
    out = copy.deepcopy(item)
    fronts = plan.fronts
    slots = _assign_slots(fronts) + plan.extra_slots
    if len(slots) > MAX_SLOTS:
        raise Report(f"{len(slots)} slots")
    for f in fronts:
        bind = _bind(f)
        for i in f.idx:
            out["parts"][i]["bind"] = dict(bind)
    face = _body_face(item)
    added: list[dict] = []
    for trays in ("box", "solid", "none"):
        added = list(plan.extra_parts)
        for f in fronts:
            added += _liner(f, f.extra.get("face", face), W, D, H)
        if trays != "none":
            for f in fronts:
                if f.kind == "drawer":
                    added += _tray(f, f.extra.get("face", face), W, D, H, trays == "solid")
        if len(out["parts"]) + len(added) <= MAX_PARTS:
            break
    else:
        raise Report(f"{len(out['parts'])} parts and no room for the inside")
    out["parts"] += added
    out["slots"] = slots
    if added and not _owns_symbol(item):
        out["symbol"] = plan_symbol(item)  # the plan keeps drawing the old parts
    return out


def closed_look_kept(before: dict, after: dict) -> bool:
    """The parts the item had are unchanged but for their `bind`, in order; its other fields are as they were
    (only `slots` and, for an item that had none, its plan symbol are new)."""
    n = len(before["parts"])
    old = [{k: v for k, v in p.items() if k != "bind"} for p in after["parts"][:n]]
    keys = set(before) | {k for k in after if k not in ("slots", "symbol")}
    same = all(before.get(k) == after.get(k) for k in keys if k != "parts")
    symbol = after.get("symbol") == before.get("symbol") if before.get("symbol") else True
    return old == before["parts"] and same and symbol and len(after["parts"]) >= n


# ---- files --------------------------------------------------------------------------------------------------------


def _dump_indented(data: dict) -> str:
    """The layout of the IKEA pack's files without a symbol: indented fields, one line a part."""
    head = {k: v for k, v in data.items() if k != "parts"}
    text = json.dumps(head, indent=2, ensure_ascii=False)[:-2]
    parts = ",\n".join("    " + json.dumps(p, separators=(", ", ": "), ensure_ascii=False) for p in data["parts"])
    return text + ',\n  "parts": [\n' + parts + "\n  ]\n}\n"


def _dump_full(data: dict) -> str:
    """Plain indented JSON, every value on its own line (the layout of the printer cabinet)."""
    return json.dumps(data, indent=2, ensure_ascii=False) + "\n"


def _writer(raw: str, item: dict) -> Callable[[dict], str]:
    """The function that writes an item in the layout its file has now, so the diff holds only the change."""
    for dump in (write_a, write_b, _dump_indented, _dump_full):
        if dump(item) == raw:
            return dump
    style = style_of(raw, item)
    raise Report(f"file layout not reproducible ({style})")


def items() -> list[tuple[str, Path]]:
    out = []
    for path in sorted(BUNDLED.glob("*/*/*.json")):
        rel = path.relative_to(BUNDLED).as_posix()[: -len(".json")]
        if any(re.search(t, rel) for t in TARGETS):
            out.append((rel, path))
    return out


def _digest(value: object) -> str:
    text = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def fixture(ref: str | None = None) -> dict:
    """The closed look of every target item as it is (or as it is in git `ref`, once they are live): its parts (a
    digest), its other fields but the symbol (a digest) and its symbol."""
    out = {}
    for rel, path in items():
        if ref:
            git_path = path.relative_to(ROOT).as_posix()
            text = subprocess.run(
                ["git", "show", f"{ref}:{git_path}"], cwd=ROOT, capture_output=True, check=True
            ).stdout.decode("utf-8")
            item = json.loads(text)
        else:
            item = json.loads(path.read_text(encoding="utf-8"))
        if "slots" in item:
            raise SystemExit(f"{rel} is live already: write the fixture before converting (or give --ref)")
        out[rel] = {
            "parts": len(item["parts"]),
            "look": _digest(item["parts"]),
            "fields": _digest({k: v for k, v in item.items() if k not in ("parts", "slots", "symbol")}),
            "symbol": item.get("symbol"),
        }
    return out


def run(write: bool) -> dict[str, int]:
    changed: dict[str, int] = {}
    rows, skipped = [], []
    for rel, path in items():
        raw = path.read_bytes().decode("utf-8")
        item = json.loads(raw)
        try:
            new = build(item)
            if not closed_look_kept(item, new):
                raise Report("the closed look would change")
            dump = _writer(raw, item)
        except Report as err:
            skipped.append(f"{rel}: {err}")
            continue
        rows.append(
            f"{rel}: {len(item['parts'])} -> {len(new['parts'])} parts, slots {[s['id'] for s in new['slots']]}"
        )
        if write:
            path.write_bytes(dump(new).encode("utf-8"))
        pack = rel.split("/")[0]
        changed[pack] = changed.get(pack, 0) + 1
    print("\n".join(rows))
    print("\nskipped:\n" + "\n".join(skipped))
    print("\nconverted per pack:", changed)
    if write:
        for pack in changed:
            pj = BUNDLED / pack / "pack.json"
            meta = json.loads(pj.read_text(encoding="utf-8"))
            if f"({MARKER})" not in str(meta.get("release_note", "")):
                meta["release"] = int(meta["release"]) + 1
            meta["release_note"] = f"Release {meta['release']}: {NOTES[pack]} ({MARKER})."
            assert len(meta["release_note"]) < 200, pack
            pj.write_bytes((json.dumps(meta, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
            print(f"{pack}: release {meta['release']}")
    return changed


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--fixture", action="store_true")
    ap.add_argument("--ref", help="with --fixture: read the items from this git revision")
    args = ap.parse_args()
    if args.fixture:
        FIXTURE.write_bytes(
            (json.dumps(fixture(args.ref), indent=1, ensure_ascii=False, sort_keys=True) + "\n").encode("utf-8")
        )
        print("wrote", FIXTURE)
    else:
        run(args.write)
    sys.exit(0)
