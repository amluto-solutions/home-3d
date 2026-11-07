"""Generate the bundled pack amluto.outdoor-hardscape (#276): garden fences, garden walls, gates, kerbs, roads and
pavements, driveways and street lights.

    python tools/gen_hardscape.py

Our own designs from boxes, cylinders, spheres, lathes, lofts and rounded boxes. Each style comes in a few heights or
sizes and in the colours that make sense for it; every colour is its own library card (`family`) with the sizes as
its chips. Everything is cheap to draw: 5 to 36 parts per item.
"""

from __future__ import annotations

import math
import random

from pack_builder import Item, write_pack

PACK = "amluto.outdoor-hardscape"
TAU = 2 * math.pi


def rng(key: str) -> random.Random:
    return random.Random(key)


def shade(hexcol: str, f: float) -> str:
    """The colour lighter (f > 1) or darker (f < 1)."""
    r, g, b = (int(hexcol[i : i + 2], 16) for i in (1, 3, 5))
    return "#%02x%02x%02x" % tuple(max(0, min(255, round(v * f))) for v in (r, g, b))


def fm(v: float) -> str:
    return f"{v:g}"


class Maker:
    """Collects items; `add` fills in the library fields."""

    def __init__(self) -> None:
        self.items: list[Item] = []

    def add(self, it: Item, tags: list[str], family: str, variant: str, rooms: list[str] | None = None, **extra) -> Item:
        it.meta = {"room": rooms or ["garden"], "tags": [t for t in tags if len(t) <= 30][:12], "family": family, "variant": {"en": variant}, **extra}
        self.items.append(it)
        return it


M = Maker()

# ----------------------------------------------------------------- fences

TIMBER = {"natural": ("natural", "#b88a55"), "brown": ("brown", "#6b4a2e"), "grey": ("grey", "#9a9a94"), "green": ("green", "#4a6a42"),
          "white": ("white", "#f1efe6"), "black": ("black", "#26272a")}


def post(it: Item, x: float, w: float, color: str, cap: bool = True) -> None:
    it.box(x, 0, w, min(w, it.D), 0, it.H, color, fix="wd")
    if cap:
        it.box(x, 0, w * 1.0, min(w, it.D), it.H - 0.03, 0.03, shade(color, 1.15), fix="wdh")


def fence_lap(h: float, ckey: str) -> None:
    label, c = TIMBER[ckey]
    it = Item(f"fence_lap_{ckey}_{round(h * 100)}", f"Lap fence panel, {label}, {fm(h)} m high", (1.83, 0.1, h), "outdoor")
    pw = 0.09
    inner = it.W - 2 * pw
    for z in (-0.03,):
        for y in (0.12, h / 2, h - 0.15):
            it.box(0, z, inner, 0.03, y, 0.05, shade(c, 0.7))
    n = max(2, int((h - 0.1) / 0.14))
    for i in range(n):
        it.box(0, 0.015 + 0.004 * (i % 2), inner, 0.04, 0.04 + i * (h - 0.1) / n, (h - 0.1) / n + 0.01, shade(c, 1.0 + 0.06 * (i % 2)))
    post(it, -(it.W / 2 - pw / 2), pw, shade(c, 0.8))
    post(it, it.W / 2 - pw / 2, pw, shade(c, 0.8))
    it.rect_symbol()
    M.add(it, ["fence", "fence panel", "lap panel", "overlap", "garden fencing", "boundary", "timber"], f"fence_lap_{ckey}", f"{fm(h)} m high")


def fence_closeboard(h: float, ckey: str) -> None:
    label, c = TIMBER[ckey]
    it = Item(f"fence_closeboard_{ckey}_{round(h * 100)}", f"Close-board fence panel, {label}, {fm(h)} m high", (1.83, 0.1, h), "outdoor")
    pw = 0.1
    inner = it.W - 2 * pw
    it.box(0, -0.02, inner, 0.03, 0.08, h - 0.1, shade(c, 0.7))
    n = int(inner / 0.14)
    for i in range(n):
        x = -inner / 2 + (i + 0.5) * inner / n
        it.box(x, 0.015, inner / n - 0.006, 0.04, 0.17, h - 0.2, shade(c, 1.0 + 0.05 * (i % 2)))
    it.box(0, 0.0, inner, 0.08, 0, 0.17, shade(c, 0.6))  # gravel board
    it.box(0, 0.0, inner, 0.08, h - 0.06, 0.06, shade(c, 0.8))  # capping
    post(it, -(it.W / 2 - pw / 2), pw, shade(c, 0.8))
    post(it, it.W / 2 - pw / 2, pw, shade(c, 0.8))
    it.rect_symbol()
    M.add(it, ["fence", "fence panel", "close board", "featheredge", "garden fencing", "boundary", "timber"], f"fence_closeboard_{ckey}", f"{fm(h)} m high")


def fence_picket(h: float, ckey: str) -> None:
    label, c = TIMBER[ckey]
    it = Item(f"fence_picket_{ckey}_{round(h * 100)}", f"Picket fence, {label}, {fm(h)} m high", (1.83, 0.08, h), "outdoor")
    pw = 0.08
    inner = it.W - 2 * pw
    n = 16
    for y in (0.15 * h, 0.7 * h):
        it.box(0, -0.02, inner, 0.025, y, 0.05, shade(c, 0.8))
    for i in range(n):
        x = -inner / 2 + (i + 0.5) * inner / n
        it.p("loft", x, 0.015, inner / n * 0.62, 0.025, 0.03, h - 0.03, c, tx=x, tz=0.015, tw=0.006, td=0.02)
    post(it, -(it.W / 2 - pw / 2), pw, shade(c, 0.9), cap=False)
    post(it, it.W / 2 - pw / 2, pw, shade(c, 0.9), cap=False)
    it.rect_symbol()
    M.add(it, ["fence", "picket", "picket fence", "palisade", "garden fencing", "boundary", "cottage"], f"fence_picket_{ckey}", f"{fm(h)} m high")


def fence_trellis(h: float, ckey: str) -> None:
    label, c = TIMBER[ckey]
    it = Item(f"fence_trellis_{ckey}_{round(h * 100)}", f"Trellis panel, {label}, {fm(h)} m high", (1.83, 0.06, h), "outdoor")
    pw = 0.06
    inner = it.W - 2 * pw
    for x in (-inner / 2 + 0.015, inner / 2 - 0.015):
        it.box(x, 0, 0.03, 0.03, 0, h, c)
    it.box(0, 0, inner, 0.03, 0, 0.03, c)
    it.box(0, 0, inner, 0.03, h - 0.03, 0.03, c)
    for i in range(1, 8):
        it.box(-inner / 2 + i * inner / 8, 0.0, 0.02, 0.02, 0.03, h - 0.06, shade(c, 1.1))
    for j in range(1, 6):
        it.box(0, 0.02, inner, 0.02, j * h / 6, 0.02, shade(c, 0.9))
    post(it, -(it.W / 2 - pw / 2), pw, shade(c, 0.8), cap=False)
    post(it, it.W / 2 - pw / 2, pw, shade(c, 0.8), cap=False)
    it.rect_symbol()
    M.add(it, ["fence", "trellis", "trellis panel", "climbing plants", "garden screen", "boundary"], f"fence_trellis_{ckey}", f"{fm(h)} m high")


def fence_post_rail(rails: int, h: float, ckey: str) -> None:
    label, c = TIMBER[ckey]
    it = Item(f"fence_post_rail_{rails}_{ckey}", f"Post and rail fence, {rails} rail, {label}", (3.0, 0.1, h), "outdoor")
    for x in (-1.45, 0, 1.45):
        post(it, x, 0.1, shade(c, 0.85))
    for k in range(rails):
        y = h * (0.28 + 0.62 * k / max(1, rails - 1)) if rails > 1 else h * 0.6
        it.box(0, 0.0, 2.9, 0.045, y, 0.09, c, fix="h")
    it.rect_symbol()
    M.add(it, ["fence", "post and rail", "paddock fence", "rail fence", "boundary", "rural", "timber"], f"fence_post_rail_{rails}_{ckey}", f"{rails} rails, {fm(h)} m high, 3 m span")


METAL = {"black": ("black", "#232427"), "green": ("green", "#2f4a3a"), "white": ("white", "#eeeeea"), "grey": ("galvanised", "#a3a8ac")}


def fence_railing(h: float, ckey: str) -> None:
    label, c = METAL[ckey]
    it = Item(f"fence_railing_{ckey}_{round(h * 100)}", f"Metal railing panel, {label}, {fm(h)} m high", (1.83, 0.06, h), "outdoor")
    pw = 0.07
    inner = it.W - 2 * pw
    it.box(0, 0, inner, 0.03, h * 0.12, 0.035, c)
    it.box(0, 0, inner, 0.03, h - 0.1, 0.035, c)
    n = 14
    for i in range(n):
        x = -inner / 2 + (i + 0.5) * inner / n
        it.cyl(x, 0, 0.016, 0.016, 0.02, h - 0.1, c)
        if i % 2 == 0:
            it.p("loft", x, 0, 0.03, 0.03, h - 0.1, 0.1, c, tx=x, tz=0, tw=0.004, td=0.004)
    for sx in (-1, 1):
        it.box(sx * (it.W / 2 - pw / 2), 0, pw, pw, 0, h, c, fix="wd")
        it.sphere(sx * (it.W / 2 - pw / 2), 0, pw * 1.1, pw * 1.1, h - 0.04, 0.06, shade(c, 1.2), fix="wdh")
    it.rect_symbol()
    M.add(it, ["fence", "railings", "metal fence", "wrought iron", "spear top", "boundary", "steel"], f"fence_railing_{ckey}", f"{fm(h)} m high")


def fence_mesh(h: float, ckey: str) -> None:
    label, c = METAL[ckey]
    it = Item(f"fence_mesh_{ckey}_{round(h * 100)}", f"Welded mesh fence panel, {label}, {fm(h)} m high", (2.5, 0.06, h), "outdoor")
    pw = 0.06
    inner = it.W - 2 * pw
    for sx in (-1, 1):
        it.box(sx * (it.W / 2 - pw / 2), 0, pw, pw, 0, h, shade(c, 0.9), fix="wd")
    for i in range(1, 8):
        it.box(-inner / 2 + i * inner / 8, 0, 0.012, 0.012, 0.03, h - 0.06, shade(c, 1.1))
    for j in range(0, 6):
        it.box(0, 0, inner, 0.012, 0.03 + j * (h - 0.08) / 5, 0.012, shade(c, 1.1))
    it.rect_symbol()
    M.add(it, ["fence", "mesh fence", "welded mesh", "security fence", "wire", "boundary"], f"fence_mesh_{ckey}", f"{fm(h)} m high")


def fence_hit_and_miss(h: float, ckey: str) -> None:
    label, c = TIMBER[ckey]
    it = Item(f"fence_hit_miss_{ckey}_{round(h * 100)}", f"Hit-and-miss fence panel, {label}, {fm(h)} m high", (1.83, 0.1, h), "outdoor")
    pw = 0.1
    inner = it.W - 2 * pw
    it.box(0, 0, inner, 0.03, 0.1, 0.05, shade(c, 0.7))
    it.box(0, 0, inner, 0.03, h - 0.15, 0.05, shade(c, 0.7))
    n = 8
    for i in range(n):
        x = -inner / 2 + (i + 0.5) * inner / n
        it.box(x, 0.03, inner / n * 0.9, 0.025, 0.04, h - 0.1, c)
        it.box(x + inner / n * 0.5, -0.03, inner / n * 0.9, 0.025, 0.04, h - 0.1, shade(c, 0.9))
    post(it, -(it.W / 2 - pw / 2), pw, shade(c, 0.8))
    post(it, it.W / 2 - pw / 2, pw, shade(c, 0.8))
    it.rect_symbol()
    M.add(it, ["fence", "hit and miss", "ventilated fence", "alternate board", "boundary", "timber"], f"fence_hit_miss_{ckey}", f"{fm(h)} m high")


SLAT = {"anthracite": ("anthracite", "#3b3e42"), "oak": ("oak", "#a8794a"), "grey": ("grey", "#8f9290")}


def fence_slatted(h: float, ckey: str) -> None:
    label, c = SLAT[ckey]
    it = Item(f"fence_slatted_{ckey}_{round(h * 100)}", f"Horizontal slatted fence, {label}, {fm(h)} m high", (1.83, 0.1, h), "outdoor")
    pw = 0.1
    inner = it.W - 2 * pw
    n = int(h / 0.15)
    for i in range(n):
        it.box(0, 0.0, inner, 0.05, 0.03 + i * (h - 0.03) / n, (h - 0.03) / n - 0.012, shade(c, 1.0 + 0.04 * (i % 2)))
    for sx in (-1, 1):
        post(it, sx * (it.W / 2 - pw / 2), pw, shade(c, 0.7))
    it.rect_symbol()
    M.add(it, ["fence", "slatted", "contemporary fence", "composite", "horizontal", "boundary", "modern"], f"fence_slatted_{ckey}", f"{fm(h)} m high")


def fence_hurdle(h: float) -> None:
    it = Item(f"fence_hurdle_{round(h * 100)}", f"Woven hazel hurdle, {fm(h)} m high", (1.83, 0.06, h), "outdoor")
    c = "#9a7a4a"
    for sx in (-1, 1):
        it.box(sx * 0.88, 0, 0.05, 0.05, 0, h, shade(c, 0.8))
    for x in (-0.55, -0.18, 0.18, 0.55):
        it.box(x, 0, 0.03, 0.03, 0, h * 0.95, shade(c, 0.8))
    n = int(h / 0.1)
    for i in range(n):
        it.box(0, 0.012 * (1 if i % 2 else -1), 1.78, 0.03, 0.03 + i * (h - 0.06) / n, (h - 0.06) / n, shade(c, 1.0 + 0.08 * (i % 3)))
    it.rect_symbol()
    M.add(it, ["fence", "hurdle", "hazel", "woven", "wattle", "willow", "rustic"], "fence_hurdle", f"{fm(h)} m high")


def fence_stock() -> None:
    it = Item("fence_stock_wire_100", "Stock fence on timber posts, 1 m high", (3.0, 0.1, 1.0), "outdoor")
    c = "#7a5a3a"
    for x in (-1.45, 0, 1.45):
        post(it, x, 0.1, c)
    for i in range(8):
        it.box(0, 0, 2.9, 0.012, 0.1 + i * 0.1, 0.012, "#a3a8ac")
    for i in range(1, 12):
        it.box(-1.45 + i * 2.9 / 12, 0, 0.01, 0.012, 0.1, 0.7, "#a3a8ac")
    it.rect_symbol()
    M.add(it, ["fence", "stock fence", "field fence", "wire", "rural", "boundary", "sheep"], "fence_stock_wire", "1 m high, 3 m span")


# ----------------------------------------------------------------- walls

BRICK = {"red": ("red brick", "#a8553a"), "buff": ("buff brick", "#cdb98a"), "blue": ("blue brick", "#4a525e"), "grey": ("grey brick", "#8e8e8a")}
STONE = {"cotswold": ("Cotswold stone", "#c9b48a"), "granite": ("granite", "#8a8c8e"), "slate": ("slate", "#5a6068"), "sandstone": ("red sandstone", "#b0704a")}
RENDER = {"white": ("white render", "#f1efe8"), "cream": ("cream render", "#ebdfc2"), "grey": ("grey render", "#a7a8a4"), "terracotta": ("terracotta render", "#c47a56")}
HNAME = {0.45: "low", 0.9: "half height", 1.8: "full height"}


def wall_brick(h: float, ckey: str) -> None:
    label, c = BRICK[ckey]
    it = Item(f"wall_brick_{ckey}_{round(h * 100)}", f"Brick garden wall, {label}, {HNAME[h]}", (2.0, 0.215, h), "outdoor")
    it.box(0, 0, 1.99, 0.205, 0, h - 0.05, c)
    n = int((h - 0.05) / 0.15)
    for i in range(1, n + 1):
        it.box(0, 0, 2.0, 0.215, i * 0.15 - 0.012, 0.012, "#c4bfae")
    it.box(0, 0, 2.0, 0.215, h - 0.05, 0.05, shade(c, 0.78) if ckey != "blue" else "#6a6f78")
    if h > 1.0:
        for sx in (-1, 1):
            it.box(sx * 0.84, 0, 0.33, 0.215, 0, h, shade(c, 0.92), fix="wd")
            it.box(sx * 0.84, 0, 0.33, 0.215, h - 0.06, 0.06, shade(c, 0.7), fix="wdh")
    it.rect_symbol()
    M.add(it, ["wall", "garden wall", "brick wall", "boundary", "brickwork", "masonry"], f"wall_brick_{ckey}", f"{HNAME[h].capitalize()} ({fm(h)} m)")


def wall_stone(h: float, ckey: str) -> None:
    label, c = STONE[ckey]
    it = Item(f"wall_stone_{ckey}_{round(h * 100)}", f"Stone garden wall, {label}, {HNAME[h]}", (2.0, 0.3, h), "outdoor")
    r = rng(it.id)
    rows = max(2, round((h - 0.06) / 0.3))
    rh = (h - 0.06) / rows
    it.box(0, 0, 1.96, 0.26, 0, h - 0.06, shade(c, 0.6))
    for j in range(rows):
        widths = [0.55, 0.45, 0.5, 0.5] if j % 2 == 0 else [0.3, 0.55, 0.5, 0.45, 0.2]
        x = -1.0
        for k, wd in enumerate(widths):
            wd = wd * 2.0 / sum(widths)
            it.p("rbox", x + wd / 2, 0, wd - 0.012, 0.3, j * rh + 0.006, rh - 0.012, shade(c, r.uniform(0.88, 1.08)), round=0.12)
            x += wd
    it.box(0, 0, 2.0, 0.3, h - 0.06, 0.06, shade(c, 0.85))
    it.rect_symbol()
    M.add(it, ["wall", "garden wall", "stone wall", "boundary", "masonry", "dressed stone"], f"wall_stone_{ckey}", f"{HNAME[h].capitalize()} ({fm(h)} m)")


def wall_dry_stone(h: float, ckey: str) -> None:
    label, c = {"grey": ("grey limestone", "#9b9a92"), "cotswold": ("Cotswold stone", "#c4ae82")}[ckey]
    it = Item(f"wall_dry_stone_{ckey}_{round(h * 100)}", f"Dry stone wall, {label}, {fm(h)} m high", (2.0, 0.6, h), "outdoor")
    r = rng(it.id)
    it.p("loft", 0, 0, 1.98, 0.58, 0, h - 0.06, shade(c, 0.7), tx=0, tz=0, tw=1.9, td=0.36)
    for i in range(16):
        z = 0.31 if i % 2 else -0.31
        x = -0.9 + 1.8 * (i // 2) / 7
        y = r.uniform(0.02, h - 0.3)
        k = 1 - (y / h) * 0.45
        it.p("rbox", x, z * k, r.uniform(0.3, 0.45), 0.16, y, r.uniform(0.18, 0.3), shade(c, r.uniform(0.85, 1.1)), round=0.35)
    it.p("rbox", 0, 0, 1.9, 0.34, h - 0.12, 0.12, shade(c, 1.05), round=0.3)
    it.rect_symbol()
    M.add(it, ["wall", "dry stone wall", "drystone", "field wall", "rural", "boundary", "stone"], f"wall_dry_stone_{ckey}", f"{fm(h)} m high")


def wall_render(h: float, ckey: str) -> None:
    label, c = RENDER[ckey]
    it = Item(f"wall_render_{ckey}_{round(h * 100)}", f"Rendered garden wall, {label}, {HNAME[h]}", (2.0, 0.215, h), "outdoor")
    it.box(0, 0, 1.99, 0.205, 0.15, h - 0.2, c)
    it.box(0, 0, 2.0, 0.215, 0, 0.15, shade(c, 0.72))
    it.box(0, 0, 2.0, 0.215, h - 0.05, 0.05, "#d6d3ca" if ckey != "grey" else "#888a86")
    if h > 1.0:
        for sx in (-1, 1):
            it.box(sx * 0.9, 0, 0.2, 0.215, 0, h - 0.05, shade(c, 0.96), fix="wd")
            it.box(sx * 0.9, 0, 0.2, 0.215, h - 0.1, 0.04, shade(c, 0.8), fix="wdh")
    it.rect_symbol()
    M.add(it, ["wall", "garden wall", "rendered wall", "painted wall", "boundary", "plaster", "stucco"], f"wall_render_{ckey}", f"{HNAME[h].capitalize()} ({fm(h)} m)")


def wall_retaining(h: float) -> None:
    it = Item(f"wall_retaining_block_{round(h * 100)}", f"Concrete block retaining wall, {fm(h)} m high", (2.0, 0.3, h), "outdoor")
    c = "#9a9a96"
    it.box(0, 0, 1.99, 0.29, 0, h, c)
    n = int(h / 0.2)
    for i in range(1, n):
        it.box(0, 0, 2.0, 0.3, i * h / n - 0.006, 0.012, "#7e7e7a")
    for i in range(n):
        for k in range(1, 4):
            it.box(-1.0 + (k * 0.5 + (0.25 if i % 2 else 0)) * 1.0, 0.0, 0.012, 0.3, i * h / n, h / n, "#7e7e7a")
    it.rect_symbol()
    M.add(it, ["wall", "retaining wall", "concrete block", "garden wall", "landscaping", "terrace"], "wall_retaining_block", f"{fm(h)} m high")


def wall_gabion(h: float) -> None:
    it = Item(f"wall_gabion_{round(h * 100)}", f"Gabion wall, {fm(h)} m high", (2.0, 0.5, h), "outdoor")
    r = rng(it.id)
    it.box(0, 0, 1.96, 0.46, 0, h, "#8b8a84")
    for i in range(14):
        z = 0.25 if i % 2 else -0.25
        w = r.uniform(0.2, 0.35)
        it.p("rbox", -0.9 + 1.8 * (i // 2) / 6, z, w, 0.06, r.uniform(0.05, h - 0.2), r.uniform(0.12, 0.2), shade("#a29f95", r.uniform(0.8, 1.1)), round=0.4)
    for sx in (-1, 1):
        for sz in (-1, 1):
            it.box(sx * 0.98, sz * 0.24, 0.04, 0.04, 0, h, "#2c2e30", fix="wd")
    for k in range(1, 3):
        it.box(0, 0.25, 2.0, 0.012, k * h / 3, 0.015, "#2c2e30")
        it.box(0, -0.25, 2.0, 0.012, k * h / 3, 0.015, "#2c2e30")
    it.rect_symbol()
    M.add(it, ["wall", "gabion", "stone cage", "retaining wall", "landscaping", "modern"], "wall_gabion", f"{fm(h)} m high")


# ----------------------------------------------------------------- gates

def timber_leaf(it: Item, x0: float, x1: float, h: float, c: str, picket: bool = False) -> None:
    w = x1 - x0
    cx = (x0 + x1) / 2
    y0 = 0.08
    if picket:
        n = max(4, int(w / 0.1))
        for i in range(n):
            x = x0 + (i + 0.5) * w / n
            it.p("loft", x, 0.015, w / n * 0.65, 0.025, y0, h - y0, c, tx=x, tz=0.015, tw=0.006, td=0.02)
        for y in (0.2 * h, 0.7 * h):
            it.box(cx, -0.02, w, 0.025, y, 0.06, shade(c, 0.8))
        it.p("loft", x0 + 0.08, -0.04, 0.07, 0.02, 0.2 * h, 0.01, shade(c, 0.7), tx=x1 - 0.08, tz=-0.04, tw=0.07, td=0.02)
        return
    n = max(4, int(w / 0.12))
    for i in range(n):
        x = x0 + (i + 0.5) * w / n
        it.box(x, 0.012, w / n - 0.008, 0.035, y0, h - y0 - 0.02, shade(c, 1.0 + 0.05 * (i % 2)))
    for y in (0.15 * h, 0.8 * h):
        it.box(cx, -0.02, w, 0.03, y, 0.12, shade(c, 0.78))
    it.p("loft", x0 + 0.08, -0.02, 0.1, 0.03, 0.2 * h, 0.58 * h, shade(c, 0.7), tx=x1 - 0.1, tz=-0.02, tw=0.1, td=0.03)


def gate_timber_side(w: float, ckey: str) -> None:
    label, c = TIMBER[ckey]
    h = 1.8
    it = Item(f"gate_side_timber_{ckey}_{round(w * 100)}", f"Side gate, timber, {label}, {fm(w)} m wide", (w + 0.2, 0.1, h), "outdoor")
    for sx in (-1, 1):
        post(it, sx * (w / 2 + 0.05), 0.1, shade(c, 0.75))
    timber_leaf(it, -w / 2, w / 2, h - 0.05, c)
    it.box(w / 2 - 0.1, 0.04, 0.12, 0.03, h * 0.5, 0.025, "#26272a")
    it.rect_symbol()
    M.add(it, ["gate", "side gate", "garden gate", "timber gate", "ledged and braced", "entrance"], f"gate_side_timber_{ckey}", f"{fm(w)} m wide")


def gate_picket(ckey: str) -> None:
    label, c = TIMBER[ckey]
    h = 1.0
    it = Item(f"gate_picket_{ckey}", f"Picket garden gate, {label}", (1.1, 0.1, h), "outdoor")
    for sx in (-1, 1):
        post(it, sx * 0.5, 0.1, shade(c, 0.85), cap=False)
    timber_leaf(it, -0.43, 0.43, h - 0.05, c, picket=True)
    it.rect_symbol()
    M.add(it, ["gate", "picket gate", "garden gate", "front gate", "cottage", "entrance"], f"gate_picket_{ckey}", "0.9 m wide")


def gate_metal_ped(h: float, ckey: str) -> None:
    label, c = METAL[ckey]
    it = Item(f"gate_metal_pedestrian_{ckey}_{round(h * 100)}", f"Metal pedestrian gate, {label}, {fm(h)} m high", (1.1, 0.08, h), "outdoor")
    for sx in (-1, 1):
        it.box(sx * 0.52, 0, 0.07, 0.07, 0, h, shade(c, 0.9), fix="wd")
        it.sphere(sx * 0.52, 0, 0.09, 0.09, h - 0.05, 0.08, shade(c, 1.2), fix="wdh")
    it.box(0, 0, 0.94, 0.03, 0.12, 0.04, c)
    it.box(0, 0, 0.94, 0.03, h - 0.14, 0.04, c)
    for i in range(7):
        x = -0.4 + i * 0.8 / 6
        it.cyl(x, 0, 0.016, 0.016, 0.1, h - 0.2, c)
        it.p("loft", x, 0, 0.03, 0.03, h - 0.14, 0.12, c, tx=x, tz=0, tw=0.004, td=0.004)
    it.box(0.36, 0.03, 0.08, 0.025, h * 0.5, 0.05, "#c9a84a")
    it.rect_symbol()
    M.add(it, ["gate", "metal gate", "iron gate", "pedestrian gate", "wrought iron", "entrance"], f"gate_metal_pedestrian_{ckey}", f"{fm(h)} m high")


def gate_drive_pair(w: float, kind: str, ckey: str) -> None:
    h = 1.5 if kind == "metal" else 1.8
    c = (METAL if kind == "metal" else TIMBER)[ckey][1]
    label = (METAL if kind == "metal" else TIMBER)[ckey][0]
    it = Item(f"gate_drive_{kind}_{ckey}_{round(w * 100)}", f"Driveway gates, {kind}, {label}, {fm(w)} m wide", (w + 0.4, 0.15, h), "outdoor")
    for sx in (-1, 1):
        it.box(sx * (w / 2 + 0.1), 0, 0.3, 0.15, 0, h + 0.0, "#a8553a" if kind == "metal" else shade(c, 0.75), fix="wd")
    for x0, x1 in ((-w / 2, -0.02), (0.02, w / 2)):
        if kind == "timber":
            timber_leaf(it, x0, x1, h - 0.05, c)
        else:
            cx = (x0 + x1) / 2
            it.box(cx, 0, x1 - x0, 0.04, 0.12, 0.05, c)
            it.box(cx, 0, x1 - x0, 0.04, h - 0.12, 0.05, c)
            n = int((x1 - x0) / 0.14)
            for i in range(n):
                x = x0 + (i + 0.5) * (x1 - x0) / n
                it.cyl(x, 0, 0.018, 0.018, 0.15, h - 0.3, c)
                if i % 2 == 0:
                    it.p("loft", x, 0, 0.035, 0.035, h - 0.14, 0.12, c, tx=x, tz=0, tw=0.004, td=0.004)
    it.rect_symbol()
    M.add(it, ["gate", "driveway gate", "double gate", "entrance gates", "swing gates", "drive"], f"gate_drive_{kind}_{ckey}", f"{fm(w)} m opening")


def gate_sliding(ckey: str) -> None:
    label, c = METAL[ckey]
    it = Item(f"gate_sliding_metal_{ckey}", f"Sliding driveway gate, {label}", (4.0, 0.12, 1.8), "outdoor")
    it.box(-0.9, 0, 3.2, 0.06, 0.12, 0.06, c)
    it.box(-0.9, 0, 3.2, 0.06, 1.62, 0.06, c)
    for i in range(18):
        it.cyl(-2.4 + i * 3.1 / 17 + 0.0, 0, 0.022, 0.022, 0.18, 1.45, c)
    it.box(-0.9, 0, 3.2, 0.04, 0.0, 0.06, "#6b6f73")
    it.box(1.85, 0, 0.18, 0.12, 0, 1.8, shade(c, 0.9), fix="wd")
    it.box(-1.95, 0, 0.1, 0.1, 0, 1.8, shade(c, 0.9), fix="wd")
    it.rect_symbol()
    M.add(it, ["gate", "sliding gate", "driveway gate", "electric gate", "automatic gate", "security"], f"gate_sliding_metal_{ckey}", "4 m wide", electric=True)


# ----------------------------------------------------------------- kerbs and edging

KERB = {"concrete": ("concrete", "#b4b4ae"), "granite": ("granite", "#8c8e91"), "sandstone": ("sandstone", "#b99a78")}


def kerb_straight(length: float, ckey: str) -> None:
    label, c = KERB[ckey]
    it = Item(f"kerb_straight_{ckey}_{round(length * 100)}", f"Kerb, {label}, {fm(length)} m", (length, 0.15, 0.25), "outdoor")
    it.p("loft", 0, 0, length - 0.004, 0.125, 0, 0.25, c, tx=0.0, tz=-0.012, tw=length - 0.004, td=0.098)
    n = int(length / 0.5)
    for i in range(1, n + 1):
        it.box(-length / 2 + i * length / (n + 1) * 1.0, 0, 0.008, 0.13, 0, 0.255, shade(c, 0.7))
    it.rect_symbol()
    M.add(it, ["kerb", "curb", "kerbstone", "pavement edge", "road edge", "edging"], f"kerb_straight_{ckey}", f"{fm(length)} m long", ["garden"])


def kerb_dropped(ckey: str) -> None:
    label, c = KERB[ckey]
    it = Item(f"kerb_dropped_{ckey}", f"Dropped kerb (driveway crossover), {label}", (3.0, 0.4, 0.25), "outdoor")
    it.box(-1.1, -0.1, 0.8, 0.15, 0, 0.25, c)
    it.box(1.1, -0.1, 0.8, 0.15, 0, 0.25, c)
    it.p("loft", -0.55, -0.05, 0.3, 0.25, 0, 0.17, c, tx=-0.55, tz=-0.05, tw=0.3, td=0.25)
    it.p("loft", 0.55, -0.05, 0.3, 0.25, 0, 0.17, c, tx=0.55, tz=-0.05, tw=0.3, td=0.25)
    it.box(0, -0.05, 0.8, 0.15, 0, 0.04, c)
    it.box(0, 0.12, 0.8, 0.16, 0, 0.02, shade(c, 0.9))
    it.box(0, 0.0, 0.8, 0.2, 0.0, 0.025, "#a85a46")
    it.rect_symbol()
    M.add(it, ["kerb", "dropped kerb", "crossover", "driveway entrance", "pavement"], f"kerb_dropped_{ckey}", "3 m wide")


def kerb_radius(r: float, ckey: str) -> None:
    label, c = KERB[ckey]
    s = r + 0.15
    it = Item(f"kerb_corner_{ckey}_{round(r * 100)}", f"Corner kerb, {label}, {fm(r)} m radius", (s, s, 0.25), "outdoor")
    cx, cz = -s / 2 + 0.075, s / 2 - 0.075
    steps = 6
    for k in range(steps):
        t = (k + 0.5) * (math.pi / 2) / steps
        x, z = cx + r * math.cos(t), cz - r * math.sin(t)
        dx, dz = -math.sin(t), -math.cos(t)
        ang = math.degrees(math.atan2(dz, dx))
        it.box(x, z, r * (math.pi / 2) / steps * 1.06, 0.15, 0, 0.25, shade(c, 1.0 + 0.03 * (k % 2)), rot=round(ang, 1))
    it.rect_symbol(False)
    M.add(it, ["kerb", "corner kerb", "radius kerb", "junction", "curved kerb", "pavement edge"], f"kerb_corner_{ckey}", f"{fm(r)} m radius")


EDGE = {"red": ("red", "#a8553a"), "charcoal": ("charcoal", "#44474a"), "buff": ("buff", "#cdbf9c")}


def edging_setts(ckey: str) -> None:
    label, c = EDGE[ckey]
    it = Item(f"edging_block_{ckey}", f"Block edging, {label}, 1 m", (1.0, 0.1, 0.1), "outdoor")
    for i in range(10):
        it.box(-0.45 + i * 0.1, 0, 0.096, 0.1, 0, 0.1 if i % 2 else 0.09, shade(c, 1.0 + 0.06 * (i % 3 - 1)))
    it.rect_symbol()
    M.add(it, ["edging", "block edging", "path edging", "setts", "border", "driveway edging"], f"edging_block_{ckey}", "1 m")


# ----------------------------------------------------------------- roads and pavements

ASPHALT = "#3a3c3f"


def road_two_lane(length: float, kind: str) -> None:
    names = {"marked": ("centre line", "dashed"), "plain": ("no markings", "unmarked"), "yellow": ("double yellow lines", "restricted")}
    w = 6.0
    it = Item(f"road_two_lane_{kind}_{round(length)}", f"Road, two lanes, {names[kind][0]}, {fm(length)} m", (length, w, 0.03), "outdoor")
    it.box(0, 0, length, w, 0, 0.03, ASPHALT, top="#43464a")
    if kind == "marked":
        n = int(length / 2)
        for i in range(n):
            it.box(-length / 2 + (i + 0.5) * length / n, 0, length / n * 0.5, 0.1, 0.03 - 0.004, 0.004, "#e8e8e0")
        for sz in (-1, 1):
            it.box(0, sz * 2.8, length, 0.08, 0.03 - 0.004, 0.004, "#e8e8e0")
    elif kind == "yellow":
        for sz in (-1, 1):
            for dz in (0.0, 0.1):
                it.box(0, sz * (2.8 - dz), length, 0.07, 0.03 - 0.004, 0.004, "#e9c928")
    it.rect_symbol()
    M.add(it, ["road", "street", "tarmac", "asphalt", "highway"], f"road_two_lane_{kind}", f"{fm(length)} m long, {names[kind][1]}", ["garden"])


def road_single_lane(length: float) -> None:
    it = Item(f"road_single_lane_{round(length)}", f"Single-track lane, {fm(length)} m", (length, 3.2, 0.03), "outdoor")
    it.box(0, 0, length, 3.2, 0, 0.03, ASPHALT, top="#43464a")
    for sz in (-1, 1):
        it.box(0, sz * 1.5, length, 0.2, 0, 0.032, "#6a7a45")
    it.rect_symbol()
    M.add(it, ["road", "lane", "single track", "country lane", "tarmac", "street"], "road_single_lane", f"{fm(length)} m long", ["garden"])


def road_with_pavements(length: float) -> None:
    it = Item(f"road_with_pavements_{round(length)}", f"Road with pavements, {fm(length)} m", (length, 9.4, 0.15), "outdoor")
    it.box(0, 0, length, 5.8, 0, 0.03, ASPHALT)
    for i in range(int(length / 2)):
        it.box(-length / 2 + (i + 0.5) * length / int(length / 2), 0, length / int(length / 2) * 0.5, 0.1, 0.03 - 0.004, 0.004, "#e8e8e0")
    for sz in (-1, 1):
        it.box(0, sz * 2.95, length, 0.15, 0, 0.15, "#b4b4ae")
        it.box(0, sz * 3.9, length, 1.65, 0, 0.14, "#b5b3ad")
        for i in range(1, int(length / 0.6)):
            it.box(-length / 2 + i * 0.6, sz * 3.9, 0.012, 1.65, 0.138, 0.004, "#8e8c86")
    it.rect_symbol()
    M.add(it, ["road", "street", "pavement", "footpath", "kerb", "highway", "residential"], "road_with_pavements", f"{fm(length)} m long", ["garden"])


def junction(kind: str) -> None:
    s = 10.0
    arm = (s - 5.8) / 2
    it = Item(f"road_junction_{kind}", f"Road junction, {'T' if kind == 't' else 'crossroads'}", (s, s, 0.15), "outdoor")
    it.box(0, 0, s, 5.8, 0, 0.03, ASPHALT)
    it.box(0, -(2.9 + arm / 2), 5.8, arm, 0, 0.03, ASPHALT)
    if kind == "cross":
        it.box(0, 2.9 + arm / 2, 5.8, arm, 0, 0.03, ASPHALT)
    for sx in (-1, 1):
        it.box(sx * (2.9 + arm / 2), -(2.9 + arm / 2), arm, arm, 0, 0.15, "#b5b3ad")
        if kind == "cross":
            it.box(sx * (2.9 + arm / 2), 2.9 + arm / 2, arm, arm, 0, 0.15, "#b5b3ad")
    if kind == "t":
        it.box(0, 2.9 + arm / 2, s, arm, 0, 0.15, "#b5b3ad")
    it.rect_symbol()
    M.add(it, ["road", "junction", "crossroads", "intersection", "t junction", "street", "tarmac"], f"road_junction_{kind}", "10 × 10 m", ["garden"])


PAVE = {"grey": ("grey", "#b5b3ad", "#8e8c86"), "buff": ("buff", "#cdbf9c", "#a89a78"), "red": ("red", "#a85a46", "#7e4030"), "charcoal": ("charcoal", "#55585b", "#3a3c3e")}


def pavement_flags(w: float, ckey: str) -> None:
    label, c, j = PAVE[ckey]
    it = Item(f"pavement_flags_{ckey}_{round(w * 100)}", f"Paving slabs, {label}, {fm(w)} m wide", (w, 5.0, 0.05), "outdoor")
    it.box(0, 0, w, 5.0, 0, 0.05, c)
    for i in range(1, 8):
        it.box(0, -2.5 + i * 5.0 / 8, w, 0.015, 0.048, 0.004, j)
    for i in range(1, int(w / 0.6)):
        it.box(-w / 2 + i * w / int(w / 0.6), 0, 0.015, 5.0, 0.048, 0.004, j)
    it.rect_symbol()
    M.add(it, ["pavement", "paving", "slabs", "flags", "patio", "footpath", "paving slabs"], f"pavement_flags_{ckey}", f"{fm(w)} × 5 m")


def pavement_blocks(w: float, ckey: str) -> None:
    label, c, j = PAVE[ckey]
    it = Item(f"pavement_blocks_{ckey}_{round(w * 100)}", f"Block paving, {label}, {fm(w)} m wide", (w, 5.0, 0.06), "outdoor")
    it.box(0, 0, w, 5.0, 0, 0.06, c)
    it.box(0, 0, w - 0.3, 4.7, 0.055, 0.006, shade(c, 0.9))
    for i in range(1, 12):
        it.box(0, -2.5 + i * 5.0 / 12, w, 0.012, 0.058, 0.003, j)
    for i in range(1, 6):
        it.box(-w / 2 + i * w / 6 + (0.1 if i % 2 else 0), 0, 0.012, 5.0, 0.058, 0.003, shade(j, 1.1))
    it.rect_symbol()
    M.add(it, ["pavement", "block paving", "driveway", "paviours", "footpath", "setts"], f"pavement_blocks_{ckey}", f"{fm(w)} × 5 m")


def tarmac_path() -> None:
    it = Item("path_tarmac_150", "Tarmac path, 1.5 m", (1.5, 5.0, 0.03), "outdoor")
    it.box(0, 0, 1.5, 5.0, 0, 0.03, "#3e4043", top="#484b4e")
    it.rect_symbol()
    M.add(it, ["path", "tarmac", "footpath", "asphalt", "walkway"], "path_tarmac", "1.5 × 5 m")


def tactile(ckey: str) -> None:
    label, c = {"buff": ("blister, buff", "#d9c27a"), "red": ("blister, red", "#b8392c")}[ckey]
    it = Item(f"pavement_tactile_{ckey}", f"Tactile paving, {label}", (1.2, 0.9, 0.05), "outdoor")
    it.box(0, 0, 1.2, 0.9, 0, 0.05, c)
    for i in range(6):
        for j in range(4):
            it.cyl(-0.5 + i * 0.2, -0.3 + j * 0.2, 0.05, 0.05, 0.05, 0.012, shade(c, 1.1))
    it.rect_symbol()
    M.add(it, ["pavement", "tactile paving", "dropped crossing", "blister paving", "accessibility", "crossing"], f"pavement_tactile_{ckey}", "1.2 × 0.9 m")


def zebra() -> None:
    it = Item("road_zebra_crossing", "Zebra crossing", (4.0, 6.0, 0.03), "outdoor")
    it.box(0, 0, 4.0, 6.0, 0, 0.03, ASPHALT, top="#43464a")
    for i in range(9):
        it.box(-1.8 + i * 0.45, 0, 0.25, 4.0, 0.03 - 0.004, 0.004, "#eeeeea")
    for sz in (-1, 1):
        it.box(0, sz * 2.9, 4.0, 0.1, 0.03 - 0.004, 0.004, "#e8e8e0")
    it.rect_symbol()
    M.add(it, ["road", "zebra crossing", "pedestrian crossing", "crossing", "road marking", "street"], "road_zebra_crossing", "4 × 6 m", ["garden"])


def speed_hump() -> None:
    it = Item("road_speed_hump", "Speed hump", (6.0, 3.5, 0.08), "outdoor")
    it.box(0, 0, 6.0, 3.5, 0, 0.02, ASPHALT)
    it.p("loft", 0, 0, 6.0, 3.5, 0.02, 0.06, ASPHALT, tx=0, tz=0, tw=6.0, td=2.0)
    for i in range(6):
        it.box(-2.5 + i, 0, 0.3, 1.9, 0.078, 0.003, "#eeeeea" if i % 2 else ASPHALT)
    it.rect_symbol()
    M.add(it, ["road", "speed hump", "speed bump", "traffic calming", "street"], "road_speed_hump", "6 × 3.5 m", ["garden"])


def manhole() -> None:
    it = Item("manhole_cover_60", "Manhole cover", (0.6, 0.6, 0.03), "outdoor")
    it.cyl(0, 0, 0.6, 0.6, 0, 0.02, "#44474a")
    it.cyl(0, 0, 0.45, 0.45, 0.02, 0.01, "#2c2e30")
    it.circle_symbol()
    M.add(it, ["manhole", "inspection cover", "drain cover", "access chamber", "drainage"], "manhole_cover", "60 cm")


def gully() -> None:
    it = Item("drain_gully_grid", "Drain gully grid", (0.45, 0.3, 0.03), "outdoor")
    it.box(0, 0, 0.45, 0.3, 0, 0.03, "#2c2e30")
    for i in range(1, 6):
        it.box(-0.225 + i * 0.075, 0, 0.012, 0.26, 0.03 - 0.004, 0.004, "#5a5d60")
    it.rect_symbol()
    M.add(it, ["drain", "gully", "grating", "road gully", "drainage"], "drain_gully", "45 × 30 cm")


# ----------------------------------------------------------------- driveways

DRIVE = {"red": ("red", "#a8553a"), "charcoal": ("charcoal", "#4a4d50"), "buff": ("buff", "#cdbf9c"), "brindle": ("brindle", "#8a6f5a")}


def drive_blocks(w: float, d: float, ckey: str) -> None:
    label, c = DRIVE[ckey]
    it = Item(f"drive_block_{ckey}_{round(w)}x{round(d)}", f"Block-paved driveway, {label}, {fm(w)} × {fm(d)} m", (w, d, 0.06), "outdoor")
    it.box(0, 0, w, d, 0, 0.06, c)
    border = shade(c, 0.7)
    it.box(0, -d / 2 + 0.1, w, 0.2, 0.058, 0.004, border)
    it.box(0, d / 2 - 0.1, w, 0.2, 0.058, 0.004, border)
    it.box(-w / 2 + 0.1, 0, 0.2, d, 0.058, 0.004, border)
    it.box(w / 2 - 0.1, 0, 0.2, d, 0.058, 0.004, border)
    for i in range(1, int(d / 0.5)):
        it.box(0, -d / 2 + i * 0.5, w, 0.012, 0.059, 0.003, shade(c, 0.8))
    for i in range(1, int(w / 0.5)):
        it.box(-w / 2 + i * 0.5, 0, 0.012, d, 0.059, 0.003, shade(c, 0.85))
    it.rect_symbol()
    M.add(it, ["driveway", "drive", "block paving", "paving", "hardstanding"], f"drive_block_{ckey}", f"{fm(w)} × {fm(d)} m")


def drive_simple(kind: str, w: float, d: float) -> None:
    spec = {
        "gravel_grey": ("Gravel driveway, grey", "#a9a498", "#8b8679", 0.05, ["gravel", "chippings", "driveway", "drive"]),
        "gravel_golden": ("Gravel driveway, golden", "#c8ab6c", "#a98c52", 0.05, ["gravel", "chippings", "driveway", "drive"]),
        "tarmac": ("Tarmac driveway", "#3e4043", "#4a4d50", 0.03, ["tarmac", "asphalt", "driveway", "drive"]),
        "concrete": ("Concrete driveway", "#aeaca6", "#8e8c86", 0.05, ["concrete", "driveway", "drive", "hardstanding"]),
        "resin": ("Resin-bound driveway", "#cbbd9a", "#b5a67f", 0.04, ["resin", "driveway", "drive", "permeable"]),
        "setts": ("Cobble setts driveway", "#7d7b75", "#5f5d58", 0.07, ["setts", "cobbles", "driveway", "granite", "drive"]),
    }[kind]
    name, c, j, hgt, tags = spec
    it = Item(f"drive_{kind}_{round(w)}x{round(d)}", f"{name}, {fm(w)} × {fm(d)} m", (w, d, hgt), "outdoor")
    it.box(0, 0, w, d, 0, hgt, c)
    if kind.startswith("gravel"):
        r = rng(it.id)
        for i in range(16):
            s = r.uniform(0.06, 0.12)
            it.p("rbox", r.uniform(-0.47, 0.47) * w, r.uniform(-0.47, 0.47) * d, s * 1.4, s, hgt * 0.8, hgt * 0.4, shade(j, r.uniform(0.9, 1.15)), round=0.4, rot=round(r.uniform(0, 180)))
    elif kind == "concrete":
        for i in range(1, int(d / 2.5) + 1):
            it.box(0, -d / 2 + i * d / (int(d / 2.5) + 1), w, 0.02, hgt - 0.004, 0.004, j)
        it.box(0, 0, 0.02, d, hgt - 0.004, 0.004, j)
    elif kind == "setts":
        for i in range(1, int(d / 0.4)):
            it.box(0, -d / 2 + i * 0.4, w, 0.012, hgt - 0.004, 0.004, j)
        for i in range(1, int(w / 0.4)):
            it.box(-w / 2 + i * 0.4, 0, 0.012, d, hgt - 0.004, 0.004, j)
    it.rect_symbol()
    M.add(it, [*tags, "hardstanding", "parking"], f"drive_{kind}", f"{fm(w)} × {fm(d)} m")


def drive_ribbon(w: float, d: float) -> None:
    it = Item(f"drive_ribbon_{round(w)}x{round(d)}", f"Ribbon driveway, concrete strips with grass, {fm(w)} × {fm(d)} m", (w, d, 0.05), "outdoor")
    it.box(0, 0, w, d, 0, 0.02, "#58a23e")
    for sx in (-1, 1):
        it.box(sx * w * 0.3, 0, w * 0.25, d, 0, 0.05, "#aeaca6")
    it.rect_symbol()
    M.add(it, ["driveway", "drive", "ribbon drive", "wheel tracks", "concrete strips", "grass"], "drive_ribbon", f"{fm(w)} × {fm(d)} m")


# ----------------------------------------------------------------- street lights

LIGHT = {"black": ("black", "#1f2124"), "green": ("green", "#2f4a3a"), "bronze": ("bronze", "#5a4630")}
LAMP = {"galvanised": ("galvanised", "#9ea3a8"), "black": ("black", "#26272a"), "green": ("green", "#2f4a3a"), "grey": ("grey", "#6e7377")}
WARM = "#fff1c9"


def victorian(h: float, ckey: str) -> None:
    label, c = LIGHT[ckey]
    it = Item(f"street_light_victorian_{ckey}_{round(h * 100)}", f"Victorian street lamp, {label}, {fm(h)} m", (0.5, 0.5, h), "lamp")
    W = it.W
    it.p("lathe", 0, 0, W * 0.8, W * 0.8, 0, h * 0.22, c, profile=[[1, 0], [1, 0.08], [0.6, 0.14], [0.55, 0.3], [0.7, 0.4], [0.5, 0.55], [0.4, 1], [0, 1]])
    it.p("lathe", 0, 0, W * 0.3, W * 0.3, h * 0.22, h * 0.6, c, profile=[[1, 0], [0.6, 0.1], [0.5, 0.6], [0.8, 0.75], [0.5, 0.82], [0.5, 1], [0, 1]])
    it.box(0, 0, W * 0.9, 0.025, h * 0.74, 0.03, c)  # ladder bar
    it.sphere(0.2, 0, 0.03, 0.03, h * 0.74, 0.03, shade(c, 1.2))
    it.sphere(-0.2, 0, 0.03, 0.03, h * 0.74, 0.03, shade(c, 1.2))
    it.box(0, 0, W * 0.5, W * 0.5, h * 0.83, h * 0.03, c)
    it.box(0, 0, W * 0.42, W * 0.42, h * 0.86, h * 0.09, WARM, glow=True)
    for sx in (-1, 1):
        for sz in (-1, 1):
            it.box(sx * W * 0.22, sz * W * 0.22, 0.02, 0.02, h * 0.86, h * 0.09, c, fix="wd")
    it.p("loft", 0, 0, W * 0.6, W * 0.6, h * 0.95, h * 0.04, c, tx=0, tz=0, tw=W * 0.12, td=W * 0.12)
    it.sphere(0, 0, 0.06, 0.06, h - 0.07, 0.07, shade(c, 1.2))
    it.circle_symbol()
    M.add(it, ["street light", "lamp post", "victorian", "cast iron", "street lamp", "lantern", "lighting"], f"street_light_victorian_{ckey}", f"{fm(h)} m", electric=True, light="garden")


def modern_led(h: float, ckey: str, arms: int) -> None:
    label, c = LAMP[ckey]
    reach = 1.2
    wdt = reach * 2 + 0.2 if arms == 2 else reach + 0.3
    it = Item(f"street_light_led_{arms}arm_{ckey}_{round(h)}m", f"{'Double-arm' if arms == 2 else 'Modern LED'} street light, {label}, {fm(h)} m", (wdt, 0.45, h), "lamp")
    ox = 0.0 if arms == 2 else -wdt / 2 + 0.15
    it.p("lathe", ox, 0, 0.3, 0.3, 0, 0.25, c, profile=[[1, 0], [1, 0.1], [0.45, 0.2], [0.4, 1], [0, 1]])
    it.p("lathe", ox, 0, 0.16, 0.16, 0.25, h - 0.25, c, profile=[[1, 0], [0.75, 0.4], [0.5, 1], [0, 1]])
    for sd in ((1,) if arms == 1 else (-1, 1)):
        it.p("loft", ox + sd * 0.1, 0, 0.12, 0.12, h - 0.35, 0.45, c, tx=ox + sd * reach * 0.75, tz=0, tw=0.07, td=0.07)
        it.box(ox + sd * (reach * 0.85), 0, 0.62, 0.26, h - 0.12, 0.07, shade(c, 0.9))
        it.box(ox + sd * (reach * 0.85), 0, 0.56, 0.22, h - 0.14, 0.03, WARM, glow=True)
    it.circle_symbol(0.35)
    M.add(it, ["street light", "lamp post", "LED", "streetlight", "road lighting", "column", "lighting"], f"street_light_led_{arms}arm_{ckey}", f"{fm(h)} m", electric=True, light="garden")


def bollard_light(h: float, ckey: str) -> None:
    label, c = {"black": ("black", "#26272a"), "steel": ("stainless steel", "#b8bdc1"), "grey": ("grey", "#6e7377")}[ckey]
    it = Item(f"bollard_light_{ckey}_{round(h * 100)}", f"Bollard light, {label}, {fm(h)} m", (0.16, 0.16, h), "lamp")
    it.cyl(0, 0, 0.14, 0.14, 0, h * 0.78, c)
    it.cyl(0, 0, 0.145, 0.145, h * 0.78, h * 0.12, WARM, glow=True)
    it.p("lathe", 0, 0, 0.16, 0.16, h * 0.9, h * 0.1, shade(c, 0.9), profile=[[1, 0], [1, 0.4], [0.6, 0.9], [0, 1]])
    it.circle_symbol()
    M.add(it, ["bollard", "bollard light", "path light", "post light", "garden light", "lighting", "driveway"], f"bollard_light_{ckey}", f"{fm(h)} m", electric=True, light="bollard")


def lamp_sign(kind: str, ckey: str) -> None:
    label, c = LAMP[ckey]
    h = 5.0
    name = "street name sign" if kind == "name" else "30 mph speed sign"
    it = Item(f"street_light_{kind}_sign_{ckey}", f"Street light with {name}, {label}", (0.9, 0.5, h), "lamp")
    ox = -0.2
    it.p("lathe", ox, 0, 0.3, 0.3, 0, 0.2, c, profile=[[1, 0], [1, 0.1], [0.45, 0.2], [0.4, 1], [0, 1]])
    it.p("lathe", ox, 0, 0.16, 0.16, 0.2, h - 0.2, c, profile=[[1, 0], [0.75, 0.4], [0.5, 1], [0, 1]])
    it.p("loft", ox + 0.1, 0, 0.12, 0.12, h - 0.4, 0.4, c, tx=0.3, tz=0, tw=0.07, td=0.07)
    it.box(0.3, 0, 0.5, 0.22, h - 0.14, 0.07, shade(c, 0.9))
    it.box(0.3, 0, 0.44, 0.18, h - 0.16, 0.03, WARM, glow=True)
    if kind == "name":
        it.box(ox, 0.15, 0.7, 0.03, 3.3, 0.22, "#1f4a8c")
        it.box(ox, 0.17, 0.62, 0.012, 3.37, 0.07, "#f3f3ee")
        it.box(ox, 0.17, 0.4, 0.012, 3.28, 0.05, "#f3f3ee")
    else:
        it.cyl(ox, 0.17, 0.5, 0.03, 3.0, 0.5, "#c8202c", axis="z")
        it.cyl(ox, 0.185, 0.4, 0.03, 3.05, 0.4, "#f6f6f2", axis="z")
        it.box(ox - 0.06, 0.2, 0.04, 0.012, 3.14, 0.18, "#26272a")
        it.box(ox + 0.06, 0.2, 0.06, 0.012, 3.14, 0.18, "#26272a")
    it.circle_symbol(0.3)
    M.add(it, ["street light", "lamp post", "road sign", "street sign", "sign", "lighting", "street name" if kind == "name" else "speed limit"], f"street_light_{kind}_sign_{ckey}", "5 m", electric=True, light="garden")


def post_top_lantern(ckey: str) -> None:
    label, c = LIGHT[ckey]
    it = Item(f"post_top_lantern_{ckey}", f"Post-top park lantern, {label}, 3 m", (0.4, 0.4, 3.0), "lamp")
    it.p("lathe", 0, 0, 0.3, 0.3, 0, 0.5, c, profile=[[1, 0], [1, 0.15], [0.55, 0.3], [0.45, 1], [0, 1]])
    it.cyl(0, 0, 0.12, 0.12, 0.5, 2.1, c)
    it.p("lathe", 0, 0, 0.16, 0.16, 2.4, 0.08, c, profile=[[0.5, 0], [1, 0.4], [1, 0.7], [0.4, 1], [0, 1]])
    it.sphere(0, 0, 0.34, 0.34, 2.5, 0.4, WARM, glow=True)
    it.p("loft", 0, 0, 0.38, 0.38, 2.88, 0.08, c, tx=0, tz=0, tw=0.05, td=0.05)
    it.sphere(0, 0, 0.05, 0.05, 2.95, 0.05, shade(c, 1.2))
    it.circle_symbol()
    M.add(it, ["street light", "lamp post", "park lamp", "globe lantern", "path light", "lighting", "garden"], f"post_top_lantern_{ckey}", "3 m", electric=True, light="garden")


def wall_lantern(ckey: str) -> None:
    label, c = LIGHT[ckey]
    it = Item(f"wall_lantern_victorian_{ckey}", f"Victorian wall lantern, {label}", (0.3, 0.35, 0.5), "lamp")
    it.box(0, -0.15, 0.1, 0.04, 0.2, 0.28, c)
    it.box(0, -0.03, 0.04, 0.22, 0.38, 0.04, c)
    it.box(0, 0.04, 0.2, 0.2, 0.0, 0.03, c)
    it.box(0, 0.04, 0.17, 0.17, 0.03, 0.3, WARM, glow=True)
    it.p("loft", 0, 0.04, 0.22, 0.22, 0.33, 0.1, c, tx=0, tz=0.04, tw=0.05, td=0.05)
    it.rect_symbol(False)
    M.add(it, ["wall light", "lantern", "victorian", "outdoor light", "wall lantern", "porch light", "lighting"], f"wall_lantern_victorian_{ckey}", "wall mounted", electric=True, light="wall", mount="wall", wall_y=2.0)


# ----------------------------------------------------------------- build everything

def build() -> None:
    for h in (0.9, 1.2, 1.5, 1.8):
        for ck in ("natural", "brown", "grey", "green"):
            fence_lap(h, ck)
    for h in (1.2, 1.8):
        for ck in ("natural", "brown", "grey"):
            fence_closeboard(h, ck)
    for h in (0.6, 0.9, 1.2):
        for ck in ("white", "natural", "green", "black"):
            fence_picket(h, ck)
    for h in (0.9, 1.8):
        for ck in ("natural", "brown", "white"):
            fence_trellis(h, ck)
    for rails, h in ((2, 1.0), (3, 1.2), (4, 1.3)):
        for ck in ("natural", "brown", "white"):
            fence_post_rail(rails, h, ck)
    for h in (0.9, 1.2, 1.8):
        for ck in ("black", "green", "white", "grey"):
            fence_railing(h, ck)
    for h in (1.2, 1.8):
        for ck in ("green", "black", "grey"):
            fence_mesh(h, ck)
    for h in (1.2, 1.8):
        for ck in ("natural", "brown", "grey"):
            fence_hit_and_miss(h, ck)
    for h in (1.2, 1.8):
        for ck in ("anthracite", "oak", "grey"):
            fence_slatted(h, ck)
    for h in (0.9, 1.8):
        fence_hurdle(h)
    fence_stock()
    for h in (0.45, 0.9, 1.8):
        for ck in BRICK:
            wall_brick(h, ck)
        for ck in STONE:
            wall_stone(h, ck)
        for ck in RENDER:
            wall_render(h, ck)
    for h in (0.9, 1.2):
        for ck in ("grey", "cotswold"):
            wall_dry_stone(h, ck)
    for h in (0.6, 1.2):
        wall_retaining(h)
    for h in (0.5, 1.0):
        wall_gabion(h)
    for w in (0.9, 1.2):
        for ck in ("natural", "brown", "green"):
            gate_timber_side(w, ck)
    for ck in ("white", "natural", "green"):
        gate_picket(ck)
    for h in (1.2, 1.8):
        for ck in ("black", "green", "white"):
            gate_metal_ped(h, ck)
    for w in (3.0, 3.6):
        for ck in ("natural", "brown"):
            gate_drive_pair(w, "timber", ck)
        for ck in ("black", "green", "white"):
            gate_drive_pair(w, "metal", ck)
    for ck in ("black", "grey"):
        gate_sliding(ck)
    for ck in KERB:
        for ln in (1.0, 3.0):
            kerb_straight(ln, ck)
    for ck in ("concrete", "granite"):
        kerb_dropped(ck)
        for r in (1.5, 3.0):
            kerb_radius(r, ck)
    for ck in EDGE:
        edging_setts(ck)
    for ln in (5.0, 10.0):
        for kind in ("marked", "plain", "yellow"):
            road_two_lane(ln, kind)
    for ln in (5.0, 10.0):
        road_single_lane(ln)
        road_with_pavements(ln)
    junction("t")
    junction("cross")
    for w in (1.2, 1.8, 3.0):
        for ck in ("grey", "buff", "red"):
            pavement_flags(w, ck)
    for w in (1.8, 3.0):
        for ck in PAVE:
            pavement_blocks(w, ck)
    tarmac_path()
    for ck in ("buff", "red"):
        tactile(ck)
    zebra()
    speed_hump()
    manhole()
    gully()
    for (w, d) in ((3.0, 5.0), (5.0, 6.0)):
        for ck in DRIVE:
            drive_blocks(w, d, ck)
        for kind in ("gravel_grey", "gravel_golden", "tarmac", "concrete", "resin", "setts"):
            drive_simple(kind, w, d)
        drive_ribbon(w, d)
    for h in (3.0, 4.2):
        for ck in LIGHT:
            victorian(h, ck)
    for h in (6.0, 8.0):
        for ck in LAMP:
            modern_led(h, ck, 1)
    for h in (8.0, 10.0):
        for ck in ("galvanised", "grey"):
            modern_led(h, ck, 2)
    for h in (0.5, 1.0):
        for ck in ("black", "steel", "grey"):
            bollard_light(h, ck)
    for kind in ("name", "speed"):
        for ck in ("galvanised", "black", "grey"):
            lamp_sign(kind, ck)
    for ck in LIGHT:
        post_top_lantern(ck)
        wall_lantern(ck)


def main() -> None:
    build()
    write_pack(
        PACK,
        "Garden hardscape & street",
        "Garden fences, walls and gates, kerbs, roads and pavements, driveways and street lights in sizes and colours, modelled for Home 3D from simple shapes. Ships with the app and works offline.",
        M.items,
    )


if __name__ == "__main__":
    main()
