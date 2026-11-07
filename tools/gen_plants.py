"""Generate the bundled pack amluto.outdoor-plants (#275): grass, soils and mulch, raised beds and 50 plants.

    python tools/gen_plants.py

Our own designs from boxes, cylinders, spheres, lathes, lofts and rounded boxes. Every plant comes in three sizes and,
where the plant has them, several colours; each colour is its own library card (`family`) with the sizes as its
chips. Items stay cheap to draw: plants use 10 to 30 parts, ground covers 6 to 30.
"""

from __future__ import annotations

import math
import random

from pack_builder import Item, write_pack

PACK = "amluto.outdoor-plants"
TAU = 2 * math.pi
WOOD = "#6b4c33"
SOIL = "#4a3626"


def rng(key: str) -> random.Random:
    return random.Random(key)


def ring(n: int, r: float, off: float = 0.0):
    for i in range(n):
        a = off + TAU * i / n
        yield a, r * math.cos(a), r * math.sin(a)


def thick(v: float, lo: float = 0.012) -> float:
    return max(lo, v)


# ----------------------------------------------------------------- plant archetypes (W = width, H = height, c = colours)

def shrub(it: Item, c: dict, flowers: int = 0, fr: float = 0.07, trunk: bool = True, lift: float = 0.12) -> None:
    W, H = it.W, it.H
    if trunk:
        it.cyl(0, 0, thick(W * 0.05), thick(W * 0.05), 0, H * (lift + 0.1), WOOD)
    it.sphere(0, 0, W * 0.92, W * 0.92, H * lift, H * (0.88 - lift), c["leaf"])
    for i, (a, x, z) in enumerate(ring(5, W * 0.27, 0.3)):
        it.sphere(x, z, W * 0.5, W * 0.5, H * (lift + 0.03 * (i % 2)), H * 0.5, c["leaf2"] if i % 2 else c["leaf"])
    if flowers:
        r = rng(it.id)
        for i in range(flowers):
            a = r.uniform(0, TAU)
            e = r.uniform(0.15, 1.0)  # 0 on the rim, 1 on the crown
            rad = W * 0.46 * math.sqrt(max(0.0, 1 - e * e * 0.8))
            s = max(0.035, W * fr)
            col = c["flower2"] if (i % 3 == 2 and "flower2" in c) else c["flower"]
            it.sphere(rad * math.cos(a), rad * math.sin(a), s, s, H * (lift + 0.1 + 0.62 * e), s * 0.9, col)
    it.circle_symbol()


def ball(it: Item, c: dict) -> None:
    W, H = it.W, it.H
    it.cyl(0, 0, thick(W * 0.06), thick(W * 0.06), 0, H * 0.25, WOOD)
    it.sphere(0, 0, W, W, H * 0.18, H * 0.82, c["leaf"])
    it.circle_symbol()


def tree(it: Item, c: dict, crown: float = 0.7) -> None:
    W, H = it.W, it.H
    it.p("lathe", 0, 0, thick(W * 0.12), thick(W * 0.12), 0, H * 0.55, "#5b4334", profile=[[1, 0], [0.7, 0.4], [0.55, 1], [0, 1]])
    it.sphere(0, 0, W * crown, W * crown, H * 0.42, H * 0.55, c["leaf"])
    for i, (a, x, z) in enumerate(ring(5, W * 0.28, 0.5)):
        it.sphere(x, z, W * 0.42, W * 0.42, H * (0.45 + 0.07 * (i % 2)), H * 0.35, c["leaf2"] if i % 2 else c["leaf"])
    it.circle_symbol()


def spikes(it: Item, c: dict, n: int = 5, spike: float = 0.38, wide: float = 0.14, stem_h: float = 0.35) -> None:
    W, H = it.W, it.H
    it.sphere(0, 0, W * 0.9, W * 0.9, 0, H * 0.28, c["leaf"])
    r = rng(it.id)
    for i, (a, x, z) in enumerate(ring(n, W * 0.2, 0.4)):
        top = H * (0.78 + 0.2 * r.random())
        sw = thick(W * 0.025, 0.01)
        it.cyl(x, z, sw, sw, H * 0.2, top - H * 0.2, c.get("stem", "#5f8a3c"))
        sh = H * spike * (0.8 + 0.2 * r.random())
        col = c["flower2"] if (i % 2 and "flower2" in c) else c["flower"]
        it.p("loft", x, z, thick(W * wide), thick(W * wide), top - sh, sh, col, tx=x, tz=z, tw=thick(W * wide * 0.3, 0.008), td=thick(W * wide * 0.3, 0.008))
    it.circle_symbol()


def heads(it: Item, c: dict, n: int = 5, head: float = 0.2, facing: bool = False, ball_head: bool = False, centre: str | None = None) -> None:
    """Flowers on stems over a leaf clump: flat heads, forward-facing discs (sunflower) or ball heads (dahlia)."""
    W, H = it.W, it.H
    it.sphere(0, 0, W * 0.9, W * 0.9, 0, H * 0.3, c["leaf"])
    r = rng(it.id)
    for i, (a, x, z) in enumerate(ring(n, W * 0.22, 0.2)):
        top = H * (0.62 + 0.3 * r.random())
        hd = max(0.04, W * head)
        sw = thick(W * 0.03, 0.01)
        it.cyl(x, z, sw, sw, H * 0.2, top - H * 0.2, "#5f8a3c")
        col = c["flower2"] if (i % 3 == 2 and "flower2" in c) else c["flower"]
        if facing:
            it.cyl(x, z + hd * 0.1, hd, hd * 0.3, top - hd / 2, hd, col, axis="z")
            if centre:
                it.cyl(x, z + hd * 0.3, hd * 0.55, hd * 0.2, top - hd * 0.275, hd * 0.55, centre, axis="z")
        elif ball_head:
            it.sphere(x, z, hd, hd, top - hd * 0.3, hd * 0.8, col)
        else:
            it.cyl(x, z, hd, hd, top, hd * 0.25, col)
            if centre:
                it.cyl(x, z, hd * 0.45, hd * 0.45, top + hd * 0.2, hd * 0.2, centre)
    it.circle_symbol()


def bulbs(it: Item, c: dict, kind: str, n: int = 5) -> None:
    W, H = it.W, it.H
    r = rng(it.id)
    for i, (a, x, z) in enumerate(ring(n, W * 0.25, 0.7)):
        sw = thick(W * 0.03, 0.01)
        top = H * (0.62 + 0.25 * r.random())
        it.p("loft", x * 0.5, z * 0.5, thick(W * 0.08), thick(W * 0.04), 0, H * 0.5, c["leaf"], tx=x * 0.9, tz=z * 0.9, tw=thick(W * 0.02, 0.006), td=thick(W * 0.02, 0.006))
        it.cyl(x, z, sw, sw, 0, top, "#5f8a3c")
        col = c["flower2"] if (i % 3 == 2 and "flower2" in c) else c["flower"]
        s = max(0.04, W * 0.17)
        if kind == "tulip":
            it.p("lathe", x, z, s, s, top - s * 0.2, s * 1.4, col, profile=[[0.3, 0], [1, 0.4], [0.8, 0.85], [0.35, 1], [0, 1]])
        elif kind == "daffodil":
            it.cyl(x, z, s * 1.4, s * 1.4, top - s * 0.1, s * 0.12, c["flower2"])
            it.p("lathe", x, z, s * 0.8, s * 0.8, top - s * 0.05, s * 0.7, col, profile=[[0.4, 0], [0.7, 0.3], [1, 1], [0.8, 1], [0.35, 0.3]])
        elif kind == "crocus":
            it.p("lathe", x, z, s, s, top - s * 0.3, s * 1.1, col, profile=[[0.25, 0], [1, 0.35], [0.7, 0.9], [0, 1]])
        elif kind == "iris":
            it.sphere(x, z, s * 1.3, s * 1.3, top - s * 0.4, s * 0.8, col)
            it.p("lathe", x, z, s * 0.7, s * 0.7, top, s * 0.9, c["flower2"], profile=[[0.3, 0], [1, 0.5], [0.4, 1], [0, 1]])
        elif kind == "allium":
            it.sphere(x, z, s * 1.8, s * 1.8, top - s * 0.9, s * 1.8, col)
    it.circle_symbol()


def grass_tuft(it: Item, c: dict, n: int = 14, lean: float = 0.32, plume: str | None = None, blade: float = 0.04) -> None:
    W, H = it.W, it.H
    r = rng(it.id)
    for i, (a, x, z) in enumerate(ring(n, W * 0.1, 0.0)):
        hh = H * (0.6 + 0.4 * r.random()) * (0.85 if plume else 1.0)
        out = W * lean * (0.5 + 0.5 * r.random())
        col = c["leaf2"] if i % 3 == 0 else c["leaf"]
        it.p("loft", x, z, thick(W * blade, 0.01), thick(W * blade, 0.01), 0, hh, col, tx=x + out * math.cos(a), tz=z + out * math.sin(a), tw=0.008, td=0.008)
        if plume and i % 2 == 0:
            tx, tz = x + out * math.cos(a), z + out * math.sin(a)
            it.p("loft", tx, tz, thick(W * 0.07, 0.015), thick(W * 0.07, 0.015), hh, H * 0.2, plume, tx=tx, tz=tz, tw=0.01, td=0.01)
    it.circle_symbol()


def fern(it: Item, c: dict) -> None:
    W, H = it.W, it.H
    for i, (a, x, z) in enumerate(ring(9, W * 0.07, 0.0)):
        up = i % 2 == 0
        reach = W * (0.4 if up else 0.33)
        hh = H * (0.9 if up else 0.62)
        it.p("loft", x, z, thick(W * 0.07, 0.015), thick(W * 0.07, 0.015), 0, hh, c["leaf2"] if up else c["leaf"], tx=reach * math.cos(a), tz=reach * math.sin(a), tw=thick(W * 0.17, 0.02), td=thick(W * 0.17, 0.02))
    it.circle_symbol()


def hosta(it: Item, c: dict) -> None:
    W, H = it.W, it.H
    it.sphere(0, 0, W * 0.35, W * 0.35, 0, H * 0.45, c["leaf"])
    for i, (a, x, z) in enumerate(ring(8, W * 0.26, 0.2)):
        lvl = i % 2
        it.sphere(x, z, W * 0.46, W * 0.34, H * (0.1 + 0.2 * lvl), H * 0.38, c["leaf2"] if lvl else c["leaf"], rot=round(math.degrees(a), 1))
    if c.get("flower"):
        sw = thick(W * 0.025, 0.01)
        it.cyl(0, 0, sw, sw, H * 0.3, H * 0.7, "#6a8a45")
        it.p("loft", 0, 0, thick(W * 0.12), thick(W * 0.12), H * 0.7, H * 0.3, c["flower"], tx=0, tz=0, tw=0.01, td=0.01)
    it.circle_symbol()


def bamboo(it: Item, c: dict) -> None:
    W, H = it.W, it.H
    r = rng(it.id)
    for i, (a, x, z) in enumerate(ring(9, W * 0.25, 0.0)):
        hh = H * (0.8 + 0.2 * r.random())
        cw = thick(W * 0.035, 0.015)
        it.cyl(x, z, cw, cw, 0, hh, c["stem"])
        it.sphere(x, z, W * 0.34, W * 0.34, hh * 0.62, H - hh * 0.62 - (H - hh), c["leaf"] if i % 2 else c["leaf2"])
    it.circle_symbol()


def spiky(it: Item, c: dict, n: int = 12) -> None:
    """Phormium, yucca: stiff leaves fanning out from the middle."""
    W, H = it.W, it.H
    for i, (a, x, z) in enumerate(ring(n, W * 0.04, 0.0)):
        hh = H * (0.55 + 0.45 * (i % 3) / 2)
        out = W * (0.2 + 0.25 * ((i + 1) % 3) / 2)
        it.p("loft", x, z, thick(W * 0.06, 0.015), thick(W * 0.06, 0.015), 0, hh, c["leaf2"] if i % 2 else c["leaf"], tx=out * math.cos(a), tz=out * math.sin(a), tw=0.01, td=0.01)
    it.circle_symbol()


def cushion(it: Item, c: dict, flowers: int = 14, fr: float = 0.07, pad: float = 0.55) -> None:
    """Low mounds that spread: heather, sedum, pansies."""
    W, H = it.W, it.H
    it.sphere(0, 0, W * 0.95, W * 0.95, 0, H * pad * 1.6, c["leaf"])
    for i, (a, x, z) in enumerate(ring(5, W * 0.28, 0.1)):
        it.sphere(x, z, W * 0.45, W * 0.45, 0, H * pad * 1.2, c["leaf2"] if i % 2 else c["leaf"])
    r = rng(it.id)
    for i in range(flowers):
        a = r.uniform(0, TAU)
        rad = W * 0.42 * math.sqrt(r.random())
        s = max(0.025, W * fr)
        col = c["flower2"] if (i % 3 == 2 and "flower2" in c) else c["flower"]
        it.sphere(rad * math.cos(a), rad * math.sin(a), s, s, H * (0.5 + 0.35 * (1 - rad / (W * 0.45))), s * 0.8, col)
    it.circle_symbol()


def conifer(it: Item, c: dict) -> None:
    W, H = it.W, it.H
    it.cyl(0, 0, thick(W * 0.06), thick(W * 0.06), 0, H * 0.15, WOOD)
    it.p("lathe", 0, 0, W, W, H * 0.08, H * 0.92, c["leaf"], profile=[[0.9, 0], [1, 0.05], [0.55, 0.35], [0.8, 0.38], [0.4, 0.68], [0.6, 0.7], [0.15, 0.95], [0, 1]])
    it.circle_symbol()


def obelisk(it: Item, c: dict) -> None:
    W, H = it.W, it.H
    pw = thick(W * 0.05, 0.02)
    for sx in (-1, 1):
        for sz in (-1, 1):
            it.p("loft", sx * W * 0.4, sz * W * 0.4, pw, pw, 0, H * 0.92, WOOD, tx=sx * W * 0.08, tz=sz * W * 0.08, tw=pw * 0.7, td=pw * 0.7)
    for y in (0.3, 0.55, 0.78):
        span = W * (0.8 - 0.55 * y)
        it.box(0, W * 0.4 - W * 0.32 * y, span, thick(W * 0.03, 0.012), H * y, thick(W * 0.03, 0.012), WOOD)
    it.sphere(0, 0, W * 0.8, W * 0.8, H * 0.1, H * 0.35, c["leaf"])
    it.sphere(0, 0, W * 0.6, W * 0.6, H * 0.4, H * 0.4, c["leaf2"])
    it.sphere(0, 0, W * 0.3, W * 0.3, H * 0.75, H * 0.22, c["leaf"])
    r = rng(it.id)
    for i in range(14):
        a = r.uniform(0, TAU)
        e = r.uniform(0.05, 0.95)
        rad = W * 0.4 * (1 - 0.6 * e)
        s = max(0.04, W * 0.12)
        it.sphere(rad * math.cos(a), rad * math.sin(a), s, s, H * (0.12 + 0.75 * e), s, c["flower"] if i % 4 else c.get("flower2", c["flower"]))
    it.circle_symbol()


# ----------------------------------------------------------------- the species

G = {"leaf": "#3f7d3a", "leaf2": "#4e9147"}          # fresh green
DG = {"leaf": "#2f6b34", "leaf2": "#3a7a3d"}         # deep green
GREY = {"leaf": "#7f9b86", "leaf2": "#92ad97"}        # grey green
SMALL, MED, LARGE = "Small", "Medium", "Large"


def col(base: dict, **kw) -> dict:
    return {**base, **kw}


def sp(sid, name, fn, sizes, tags, cols):
    return {"id": sid, "name": name, "fn": fn, "sizes": sizes, "tags": tags, "cols": cols}


SPECIES: list[dict] = [
    # shrubs and small trees
    sp("box_ball", "Box ball", ball, [(0.3, 0.3), (0.5, 0.5), (0.8, 0.8)], ["topiary", "buxus", "clipped"],
       {"green": ("green", DG)}),
    sp("hebe", "Hebe", lambda it, c: shrub(it, c, 10, 0.05), [(0.4, 0.4), (0.7, 0.6), (1.0, 0.9)], ["shrub", "evergreen"],
       {"purple": ("purple flowers", col(G, flower="#8a4fc4", flower2="#b184e0")), "pink": ("pink flowers", col(G, flower="#e46aa8")), "white": ("white flowers", col(G, flower="#f4f4ee"))}),
    sp("viburnum", "Viburnum", lambda it, c: shrub(it, c, 12, 0.05), [(0.7, 0.7), (1.2, 1.2), (1.8, 1.8)], ["shrub", "tinus", "hedging"],
       {"white": ("white flowers", col(DG, flower="#f6f4ee")), "pink": ("pink flowers", col(DG, flower="#f0b1c8"))}),
    sp("azalea", "Azalea", lambda it, c: shrub(it, c, 22, 0.08), [(0.4, 0.35), (0.7, 0.55), (1.1, 0.9)], ["shrub", "rhododendron", "spring"],
       {"pink": ("pink", col(DG, flower="#ee6fb0", flower2="#f7a6cf")), "red": ("red", col(DG, flower="#d8292f")), "white": ("white", col(DG, flower="#fafaf5")), "orange": ("orange", col(DG, flower="#f08a24"))}),
    sp("camellia", "Camellia", lambda it, c: shrub(it, c, 14, 0.09), [(0.6, 0.9), (1.0, 1.5), (1.5, 2.2)], ["shrub", "evergreen", "spring"],
       {"pink": ("pink", col(DG, flower="#f08cb4")), "red": ("red", col(DG, flower="#c8202c")), "white": ("white", col(DG, flower="#f8f6f0"))}),
    sp("choisya", "Choisya", lambda it, c: shrub(it, c, 14, 0.05), [(0.7, 0.7), (1.2, 1.2), (1.8, 1.7)], ["shrub", "mexican orange blossom"],
       {"white": ("white flowers", {"leaf": "#58a04a", "leaf2": "#6bb35a", "flower": "#fbfaf4"}), "gold": ("golden leaf", {"leaf": "#c9b53d", "leaf2": "#dcc94f", "flower": "#fbfaf4"})}),
    sp("berberis", "Berberis", lambda it, c: shrub(it, c, 0), [(0.5, 0.5), (0.9, 0.9), (1.4, 1.4)], ["shrub", "barberry", "foliage"],
       {"purple": ("purple", {"leaf": "#6a2e53", "leaf2": "#7f3d66"}), "gold": ("golden", {"leaf": "#d2b13a", "leaf2": "#e3c752"}), "green": ("green", G)}),
    sp("buddleja", "Buddleja", lambda it, c: shrub(it, c, 16, 0.05, lift=0.2), [(0.8, 1.0), (1.4, 1.7), (2.0, 2.5)], ["shrub", "butterfly bush"],
       {"purple": ("purple", col(GREY, flower="#8a4fb8")), "pink": ("pink", col(GREY, flower="#e07fb4")), "white": ("white", col(GREY, flower="#f4f2ee"))}),
    sp("fuchsia", "Fuchsia", lambda it, c: shrub(it, c, 14, 0.05), [(0.5, 0.6), (0.8, 0.9), (1.2, 1.3)], ["shrub", "hardy fuchsia"],
       {"red": ("red and purple", col(G, flower="#d1204f", flower2="#6b2a9a")), "pink": ("pink and white", col(G, flower="#f0679b", flower2="#fbeff3"))}),
    sp("hydrangea", "Hydrangea", lambda it, c: shrub(it, c, 11, 0.2, lift=0.1), [(0.6, 0.6), (1.0, 1.0), (1.5, 1.4)], ["shrub", "mophead", "summer"],
       {"blue": ("blue", col(G, flower="#5d86d6", flower2="#7ea0e4")), "pink": ("pink", col(G, flower="#e87fb0", flower2="#f2a7c9")), "white": ("white", col(G, flower="#f6f6f0")), "purple": ("purple", col(G, flower="#8a60b8"))}),
    sp("rose", "Rose", lambda it, c: shrub(it, c, 12, 0.07, lift=0.1), [(0.5, 0.6), (0.8, 0.9), (1.2, 1.3)], ["shrub", "bush rose", "flower", "rosa"],
       {"red": ("red", col(DG, flower="#c9162a")), "pink": ("pink", col(DG, flower="#ee7fa8")), "yellow": ("yellow", col(DG, flower="#f2d12e")), "white": ("white", col(DG, flower="#faf8f2")), "orange": ("orange", col(DG, flower="#f08a35"))}),
    sp("lavender", "Lavender", lambda it, c: spikes(it, c, 9, 0.45, 0.07, 0.4), [(0.35, 0.4), (0.6, 0.65), (0.9, 0.9)], ["herb", "perennial", "scented", "bees"],
       {"purple": ("purple", col(GREY, flower="#7b5bb5", stem="#8aa585")), "white": ("white", col(GREY, flower="#f1f1ea", stem="#8aa585")), "pink": ("pink", col(GREY, flower="#d98ab9", stem="#8aa585"))}),
    sp("rosemary", "Rosemary", lambda it, c: shrub(it, c, 10, 0.035, lift=0.1), [(0.4, 0.4), (0.7, 0.7), (1.0, 1.0)], ["herb", "shrub", "evergreen"],
       {"blue": ("blue flowers", {"leaf": "#5d7d62", "leaf2": "#6e8f72", "flower": "#6f8de0"})}),
    sp("japanese_maple", "Japanese maple", lambda it, c: tree(it, c, 0.85), [(0.9, 1.2), (1.6, 2.0), (2.6, 3.0)], ["tree", "acer", "small tree", "autumn"],
       {"red": ("red", {"leaf": "#a3262c", "leaf2": "#c0392f"}), "green": ("green", {"leaf": "#5e9a3e", "leaf2": "#74b04d"}), "orange": ("orange", {"leaf": "#d6791f", "leaf2": "#e8933a"})}),
    sp("olive_tree", "Olive tree", lambda it, c: tree(it, c, 0.75), [(0.7, 1.2), (1.2, 2.0), (2.0, 3.0)], ["tree", "mediterranean", "olea"],
       {"silver": ("silver green", {"leaf": "#7e9482", "leaf2": "#93a89a"})}),
    sp("bay_standard", "Bay standard", lambda it, c: tree(it, c, 0.55), [(0.4, 1.0), (0.6, 1.5), (0.9, 2.0)], ["tree", "topiary", "laurus", "herb", "lollipop"],
       {"green": ("green", DG)}),
    # flowers
    sp("sunflower", "Sunflower", lambda it, c: heads(it, c, 5, 0.22, facing=True, centre="#5a3a1c"), [(0.4, 1.0), (0.6, 1.8), (0.9, 2.6)], ["flower", "annual", "tall"],
       {"yellow": ("yellow", col(G, flower="#f5c518")), "orange": ("orange", col(G, flower="#ee8e1c")), "red": ("red", col(G, flower="#a8321c"))}),
    sp("dahlia", "Dahlia", lambda it, c: heads(it, c, 6, 0.17, ball_head=True), [(0.4, 0.6), (0.6, 0.95), (0.9, 1.3)], ["flower", "perennial", "tubers"],
       {"red": ("red", col(DG, flower="#b8182c")), "pink": ("pink", col(DG, flower="#ee7fb0")), "yellow": ("yellow", col(DG, flower="#f5c91f")), "orange": ("orange", col(DG, flower="#f0731a")), "purple": ("purple", col(DG, flower="#7d2f9e"))}),
    sp("tulip", "Tulip", lambda it, c: bulbs(it, c, "tulip", 6), [(0.2, 0.35), (0.3, 0.45), (0.45, 0.6)], ["flower", "bulb", "spring"],
       {"red": ("red", col(G, flower="#d4162c")), "yellow": ("yellow", col(G, flower="#f6d21f")), "pink": ("pink", col(G, flower="#f07fae")), "white": ("white", col(G, flower="#f7f5ee")), "purple": ("purple", col(G, flower="#6e2d86"))}),
    sp("daffodil", "Daffodil", lambda it, c: bulbs(it, c, "daffodil", 6), [(0.2, 0.3), (0.3, 0.4), (0.45, 0.5)], ["flower", "bulb", "spring", "narcissus"],
       {"yellow": ("yellow", col(G, flower="#f2b705", flower2="#f7d93a")), "white": ("white and orange", col(G, flower="#f19b2a", flower2="#f9f7ee"))}),
    sp("crocus", "Crocus", lambda it, c: bulbs(it, c, "crocus", 7), [(0.15, 0.12), (0.25, 0.15), (0.4, 0.18)], ["flower", "bulb", "spring"],
       {"purple": ("purple", col(G, flower="#7b49b7")), "yellow": ("yellow", col(G, flower="#f4c61a")), "white": ("white", col(G, flower="#f6f4ee"))}),
    sp("allium", "Allium", lambda it, c: bulbs(it, c, "allium", 5), [(0.25, 0.5), (0.35, 0.8), (0.5, 1.1)], ["flower", "bulb", "ornamental onion"],
       {"purple": ("purple", col(G, flower="#9a5fc9"))}),
    sp("iris", "Iris", lambda it, c: bulbs(it, c, "iris", 5), [(0.3, 0.45), (0.45, 0.7), (0.65, 0.95)], ["flower", "perennial"],
       {"purple": ("purple", col(G, flower="#6a3fa8", flower2="#f1d23a")), "yellow": ("yellow", col(G, flower="#f2cd2a", flower2="#f7f1d0")), "blue": ("blue", col(G, flower="#4a6fd2", flower2="#f1f1f1"))}),
    sp("foxglove", "Foxglove", lambda it, c: spikes(it, c, 4, 0.55, 0.18, 0.5), [(0.35, 0.9), (0.5, 1.4), (0.7, 1.9)], ["flower", "biennial", "digitalis", "cottage"],
       {"purple": ("purple", col(G, flower="#a85fb8", flower2="#c283cc")), "pink": ("pink", col(G, flower="#ec86b0")), "white": ("white", col(G, flower="#f7f4f0"))}),
    sp("delphinium", "Delphinium", lambda it, c: spikes(it, c, 4, 0.5, 0.15, 0.5), [(0.4, 1.0), (0.6, 1.5), (0.8, 2.0)], ["flower", "perennial", "cottage"],
       {"blue": ("blue", col(G, flower="#3e5fd0", flower2="#6f89e0")), "purple": ("purple", col(G, flower="#7c3fb6")), "white": ("white", col(G, flower="#f4f4f6"))}),
    sp("lupin", "Lupin", lambda it, c: spikes(it, c, 5, 0.4, 0.12, 0.45), [(0.4, 0.7), (0.6, 1.0), (0.85, 1.3)], ["flower", "perennial", "cottage"],
       {"pink": ("pink", col(G, flower="#e56fa7", flower2="#f3a9c8")), "purple": ("purple", col(G, flower="#7a3fb0", flower2="#a77fd0")), "yellow": ("yellow", col(G, flower="#f2cf3a"))}),
    sp("hollyhock", "Hollyhock", lambda it, c: spikes(it, c, 3, 0.6, 0.2, 0.55), [(0.4, 1.4), (0.6, 2.0), (0.8, 2.6)], ["flower", "biennial", "tall", "cottage"],
       {"pink": ("pink", col(G, flower="#ef8bb4")), "red": ("red", col(G, flower="#a8122a")), "yellow": ("yellow", col(G, flower="#f3d33a")), "white": ("white", col(G, flower="#f6f2ec"))}),
    sp("echinacea", "Echinacea", lambda it, c: heads(it, c, 5, 0.17, centre="#a8541a"), [(0.35, 0.6), (0.55, 0.9), (0.8, 1.2)], ["flower", "coneflower", "perennial"],
       {"pink": ("pink", col(G, flower="#e46aa6")), "white": ("white", col(G, flower="#f5f3ee")), "orange": ("orange", col(G, flower="#ee8a2c"))}),
    sp("cosmos", "Cosmos", lambda it, c: heads(it, c, 6, 0.15, centre="#f3c61e"), [(0.35, 0.6), (0.55, 1.0), (0.8, 1.4)], ["flower", "annual", "cut flower"],
       {"pink": ("pink", col(G, flower="#ee79ae")), "white": ("white", col(G, flower="#faf8f2")), "red": ("red", col(G, flower="#c8284a"))}),
    sp("marigold", "Marigold", lambda it, c: heads(it, c, 7, 0.2, ball_head=True), [(0.2, 0.25), (0.3, 0.35), (0.45, 0.5)], ["flower", "annual", "bedding", "tagetes"],
       {"orange": ("orange", col(DG, flower="#ee8a15")), "yellow": ("yellow", col(DG, flower="#f6c614"))}),
    sp("geranium", "Geranium", lambda it, c: shrub(it, c, 10, 0.12, trunk=False, lift=0.05), [(0.3, 0.3), (0.45, 0.45), (0.6, 0.6)], ["flower", "pelargonium", "bedding", "summer"],
       {"red": ("red", col(G, flower="#d4162c")), "pink": ("pink", col(G, flower="#ee6fa3")), "white": ("white", col(G, flower="#f8f6f0"))}),
    sp("lily", "Lily", lambda it, c: bulbs(it, c, "tulip", 4), [(0.3, 0.7), (0.45, 1.0), (0.6, 1.3)], ["flower", "bulb", "scented", "summer"],
       {"white": ("white", col(G, flower="#faf8f2")), "orange": ("orange", col(G, flower="#ef7a1c")), "pink": ("pink", col(G, flower="#ec6fa3"))}),
    sp("peony", "Peony", lambda it, c: shrub(it, c, 8, 0.2, trunk=False, lift=0.05), [(0.5, 0.6), (0.8, 0.85), (1.1, 1.1)], ["flower", "perennial", "paeonia"],
       {"pink": ("pink", col(DG, flower="#f090b8", flower2="#f6b8d2")), "red": ("red", col(DG, flower="#b8142e")), "white": ("white", col(DG, flower="#faf6f0"))}),
    sp("agapanthus", "Agapanthus", lambda it, c: bulbs(it, c, "allium", 6), [(0.4, 0.7), (0.6, 1.0), (0.9, 1.3)], ["flower", "perennial", "african lily"],
       {"blue": ("blue", col(G, flower="#4a63d6")), "white": ("white", col(G, flower="#f4f4f2"))}),
    sp("verbena", "Verbena bonariensis", lambda it, c: heads(it, c, 6, 0.1, ball_head=True), [(0.35, 0.9), (0.5, 1.3), (0.7, 1.7)], ["flower", "perennial", "tall", "butterflies"],
       {"purple": ("purple", col(G, flower="#8a4fc8"))}),
    sp("poppy", "Poppy", lambda it, c: heads(it, c, 6, 0.16, centre="#2a2a2a"), [(0.3, 0.5), (0.45, 0.75), (0.65, 1.0)], ["flower", "annual", "meadow"],
       {"red": ("red", col(G, flower="#d21f1f")), "orange": ("orange", col(G, flower="#f07a1a"))}),
    # foliage, grasses, climbers, ground cover
    sp("hosta", "Hosta", hosta, [(0.35, 0.3), (0.6, 0.5), (0.9, 0.75)], ["foliage", "shade", "perennial"],
       {"green": ("green", {"leaf": "#3f8a45", "leaf2": "#52a058", "flower": "#c1a3dc"}), "blue": ("blue", {"leaf": "#5f8fa0", "leaf2": "#76a5b4", "flower": "#e4e0f2"}), "variegated": ("variegated", {"leaf": "#4a9050", "leaf2": "#d9e3b4"})}),
    sp("fern", "Fern", fern, [(0.4, 0.4), (0.7, 0.7), (1.1, 1.1)], ["foliage", "shade", "woodland"],
       {"green": ("green", {"leaf": "#3a8a3c", "leaf2": "#4fa24c"}), "dark": ("dark green", {"leaf": "#2a6a34", "leaf2": "#37803f"})}),
    sp("miscanthus", "Miscanthus", lambda it, c: grass_tuft(it, c, 16, 0.3, c.get("plume")), [(0.5, 0.9), (0.9, 1.5), (1.3, 2.2)], ["grass", "ornamental grass", "silver grass"],
       {"green": ("green", {"leaf": "#6f9a4a", "leaf2": "#88b05f", "plume": "#d6c9b0"}), "silver": ("silver", {"leaf": "#a8bba0", "leaf2": "#c0cfb8", "plume": "#eee6d4"}), "red": ("red tinted", {"leaf": "#9a6a4a", "leaf2": "#b8825a", "plume": "#d9a98a"})}),
    sp("pampas_grass", "Pampas grass", lambda it, c: grass_tuft(it, c, 18, 0.34, c["plume"], 0.035), [(0.7, 1.2), (1.2, 2.0), (1.8, 3.0)], ["grass", "ornamental grass", "cortaderia"],
       {"white": ("white plumes", {"leaf": "#8ba56a", "leaf2": "#a0b87f", "plume": "#f4efe3"}), "pink": ("pink plumes", {"leaf": "#8ba56a", "leaf2": "#a0b87f", "plume": "#e6b8c4"})}),
    sp("blue_fescue", "Blue fescue", lambda it, c: grass_tuft(it, c, 18, 0.3, None, 0.02), [(0.2, 0.2), (0.3, 0.3), (0.45, 0.4)], ["grass", "ornamental grass", "festuca"],
       {"blue": ("blue", {"leaf": "#6f9ab0", "leaf2": "#88b2c6"})}),
    sp("bamboo", "Bamboo", bamboo, [(0.6, 1.5), (1.0, 2.5), (1.6, 4.0)], ["grass", "screen", "clump", "privacy"],
       {"green": ("green canes", {"stem": "#7a9a3a", "leaf": "#4f9a45", "leaf2": "#62ad54"}), "black": ("black canes", {"stem": "#2a2a26", "leaf": "#4f9a45", "leaf2": "#62ad54"}), "golden": ("golden canes", {"stem": "#d4b43a", "leaf": "#5aa24a", "leaf2": "#6cb55a"})}),
    sp("phormium", "Phormium", lambda it, c: spiky(it, c, 12), [(0.5, 0.6), (0.9, 1.1), (1.4, 1.7)], ["foliage", "new zealand flax", "architectural"],
       {"green": ("green", {"leaf": "#3f7a3a", "leaf2": "#52904a"}), "bronze": ("bronze", {"leaf": "#6a3a2a", "leaf2": "#85503a"}), "pink": ("pink striped", {"leaf": "#c06a7a", "leaf2": "#d88a98"})}),
    sp("yucca", "Yucca", lambda it, c: spiky(it, c, 14), [(0.6, 0.7), (1.0, 1.2), (1.5, 1.8)], ["foliage", "architectural", "exotic"],
       {"green": ("green", {"leaf": "#5a8a4a", "leaf2": "#6fa05a"}), "variegated": ("variegated", {"leaf": "#6a9a4a", "leaf2": "#d6d890"})}),
    sp("heather", "Heather", lambda it, c: cushion(it, c, 18, 0.05), [(0.3, 0.2), (0.5, 0.3), (0.8, 0.4)], ["ground cover", "erica", "calluna", "evergreen"],
       {"pink": ("pink", col(DG, flower="#e07aa8")), "purple": ("purple", col(DG, flower="#9a50b8")), "white": ("white", col(DG, flower="#f2f0ea"))}),
    sp("pansy", "Pansy", lambda it, c: cushion(it, c, 9, 0.12, 0.35), [(0.2, 0.12), (0.3, 0.15), (0.45, 0.2)], ["flower", "bedding", "viola", "winter"],
       {"purple": ("purple", col(G, flower="#6a2f9a", flower2="#f2d52a")), "yellow": ("yellow", col(G, flower="#f6d21f", flower2="#7a3fa0")), "mixed": ("mixed", col(G, flower="#e46aa6", flower2="#4a63d6"))}),
    sp("sedum", "Sedum", lambda it, c: cushion(it, c, 12, 0.1, 0.6), [(0.3, 0.25), (0.5, 0.4), (0.75, 0.55)], ["ground cover", "succulent", "stonecrop"],
       {"pink": ("pink", {"leaf": "#7fa57a", "leaf2": "#92b88c", "flower": "#d4609a"}), "green": ("green", {"leaf": "#7fa57a", "leaf2": "#92b88c", "flower": "#c4d58a"})}),
    sp("conifer", "Conifer", conifer, [(0.4, 0.9), (0.7, 1.6), (1.2, 2.8)], ["tree", "evergreen", "cone", "fir"],
       {"green": ("green", {"leaf": "#2d6a3a"}), "blue": ("blue", {"leaf": "#5a8aa0"}), "gold": ("golden", {"leaf": "#b9a636"})}),
    sp("clematis_obelisk", "Clematis on obelisk", obelisk, [(0.4, 1.2), (0.55, 1.8), (0.75, 2.4)], ["climber", "trellis", "flower"],
       {"purple": ("purple", col(G, flower="#7a3fb0", flower2="#a77fd0")), "pink": ("pink", col(G, flower="#ec6fa8")), "white": ("white", col(G, flower="#f8f6f0"))}),
    sp("climbing_rose_obelisk", "Climbing rose on obelisk", obelisk, [(0.4, 1.2), (0.55, 1.8), (0.75, 2.4)], ["climber", "trellis", "flower", "rose"],
       {"red": ("red", col(DG, flower="#c4162a")), "pink": ("pink", col(DG, flower="#ee7fa8"))}),
]


def plant_items() -> list[Item]:
    items: list[Item] = []
    for s in SPECIES:
        multi = len(s["cols"]) > 1
        for ckey, (clabel, colours) in s["cols"].items():
            family = f"{s['id']}_{ckey}" if multi else s["id"]
            for label, (w, h) in zip((SMALL, MED, LARGE), s["sizes"], strict=True):
                name = f"{s['name']}, {clabel}, {label.lower()}" if multi else f"{s['name']}, {label.lower()}"
                it = Item(f"{family}_{label.lower()}", name, (w, w, h), "plant")
                s["fn"](it, colours)
                it.meta = {
                    "room": ["garden"],
                    "tags": [t for t in [s["name"].lower(), *s["tags"], clabel.split()[0]] if len(t) <= 30][:12],
                    "family": family,
                    "variant": {"en": f"{label} ({w:g} × {h:g} m)"},
                }
                items.append(it)
    return items


# ----------------------------------------------------------------- ground: grass, soils, raised beds

def grass_items() -> list[Item]:
    items: list[Item] = []
    kinds = [
        ("lawn_short", "Lawn, short", 0.03, "#58a23e", "#6cb84c", 0, ["lawn", "turf", "mown", "grass"]),
        ("lawn_medium", "Lawn, medium", 0.08, "#4f9a3a", "#62ae48", 12, ["lawn", "turf", "grass", "unmown"]),
        ("grass_long", "Grass, long", 0.25, "#6f9a3c", "#87b24c", 26, ["long grass", "rough", "unmown", "grass"]),
        ("meadow", "Meadow grass", 0.5, "#8aa23c", "#b4b95a", 30, ["meadow", "hay", "rewilding", "grass"]),
        ("wildflower_meadow", "Wildflower meadow", 0.55, "#7aa03c", "#9db84c", 30, ["meadow", "wildflower", "flowers", "grass"]),
    ]
    for kid, kname, hgt, c1, c2, tufts, tags in kinds:
        for side in (1.0, 2.0, 4.0):
            it = Item(f"{kid}_{int(side)}x{int(side)}", f"{kname}, {side:g} × {side:g} m", (side, side, hgt), "outdoor")
            W = side
            it.box(0, 0, W, W, 0, min(hgt, 0.04), SOIL)
            it.box(0, 0, W, W, 0.005, hgt * (0.6 if tufts else 1.0), c1, top=c2)
            r = rng(it.id)
            for i in range(tufts):
                x, z = r.uniform(-0.45, 0.45) * W, r.uniform(-0.45, 0.45) * W
                bw = 0.05 + 0.04 * (side / 2)
                a = r.uniform(0, TAU)
                if kid == "wildflower_meadow" and i % 3 == 0:
                    fc = ["#e8c63a", "#e05a7a", "#f2f0e6", "#7a6ad0"][i // 3 % 4]
                    it.cyl(x, z, 0.012, 0.012, hgt * 0.4, hgt * 0.5, "#6a9a3a")
                    it.sphere(x, z, 0.05, 0.05, hgt * 0.85, 0.05, fc)
                else:
                    it.p("loft", x, z, bw, bw, hgt * 0.5, hgt * 0.5, c2 if i % 2 else c1, tx=x + bw * 1.5 * math.cos(a), tz=z + bw * 1.5 * math.sin(a), tw=0.01, td=0.01)
            it.rect_symbol()
            it.meta = {"room": ["garden"], "tags": tags, "family": kid, "variant": {"en": f"{side:g} × {side:g} m"}}
            items.append(it)
    return items


def surface_items() -> list[Item]:
    items: list[Item] = []
    kinds = [
        ("topsoil", "Topsoil", "#4a3626", "#5a4331", "#3c2b1e", 0.06, 0, "chunk", ["soil", "earth", "dirt", "border"]),
        ("compost", "Compost", "#2f241a", "#3b2d20", "#241a12", 0.06, 0, "chunk", ["soil", "compost", "mulch", "peat"]),
        ("bark_mulch", "Bark mulch", "#6b4428", "#7d5230", "#573520", 0.07, 22, "chip", ["mulch", "bark", "wood chip", "border"]),
        ("wood_chip", "Wood chip", "#a87a4c", "#bd8f5e", "#8e6538", 0.07, 22, "chip", ["mulch", "woodchip", "path", "play area"]),
        ("cocoa_shell", "Cocoa shell mulch", "#3e2a1e", "#4d352a", "#2f1f16", 0.05, 12, "chip", ["mulch", "cocoa", "border"]),
        ("gravel", "Gravel", "#b8b2a2", "#cbc5b4", "#9d978a", 0.05, 26, "pebble", ["gravel", "chippings", "path", "drive"]),
        ("slate_chippings", "Slate chippings", "#4c5258", "#5d646b", "#3b4046", 0.05, 22, "chip", ["slate", "gravel", "chippings", "border"]),
        ("pebbles_white", "White pebbles", "#ece9df", "#fbf9f2", "#d6d2c5", 0.06, 20, "pebble", ["pebbles", "cobbles", "decorative stone"]),
        ("sand", "Sand", "#d9c58f", "#e6d3a0", "#c8b37d", 0.04, 0, "chunk", ["sand", "play area", "sandpit"]),
        ("play_bark", "Play bark", "#8c5a34", "#a06b40", "#704526", 0.08, 24, "chip", ["play area", "bark", "safety surface"]),
    ]
    for kid, kname, base, hi, lo, hgt, n, style, tags in kinds:
        for side in (1.0, 2.0, 4.0):
            it = Item(f"{kid}_{int(side)}x{int(side)}", f"{kname}, {side:g} × {side:g} m", (side, side, hgt), "outdoor")
            it.box(0, 0, side, side, 0, hgt, base, top=hi)
            r = rng(it.id)
            for i in range(n):
                x, z = r.uniform(-0.46, 0.46) * side, r.uniform(-0.46, 0.46) * side
                s = r.uniform(0.04, 0.09)
                c = hi if i % 2 else lo
                if style == "pebble":
                    it.sphere(x, z, s, s * 0.8, hgt * 0.7, hgt * 0.5, c)
                else:
                    it.p("rbox", x, z, s * 1.5, s, hgt * 0.7, hgt * 0.4, c, rot=round(r.uniform(0, 180), 0), round=0.3)
            it.rect_symbol()
            it.meta = {"room": ["garden"], "tags": tags, "family": kid, "variant": {"en": f"{side:g} × {side:g} m"}}
            items.append(it)
    return items


def bed_items() -> list[Item]:
    items: list[Item] = []
    mats = [
        ("sleeper", "Timber sleeper", "#7a5a3a", "#8c6a46", True),
        ("softwood", "Softwood", "#b98c58", "#cb9d68", True),
        ("cedar", "Cedar", "#a8643c", "#bc7648", False),
        ("corten", "Corten steel", "#8a4a28", "#9e5a34", False),
        ("galvanised", "Galvanised steel", "#a9b0b4", "#bdc4c8", False),
        ("brick", "Brick", "#a8553a", "#bb694c", False),
        ("composite", "Composite", "#5a5e5a", "#6b706b", False),
    ]
    sizes = [(1.2, 0.9), (1.8, 0.9), (2.4, 1.2)]
    for mid, mname, c1, c2, two_heights in mats:
        for (w, d) in sizes:
            for hgt, hname in ((0.3, "low"), (0.6, "tall")) if two_heights else ((0.45, ""),):
                suffix = f"_{hname}" if hname else ""
                label = f"{w:g} × {d:g} m" + (f", {hname}" if hname else "")
                it = Item(f"raised_bed_{mid}_{round(w * 100)}x{round(d * 100)}{suffix}", f"Raised bed, {mname.lower()}, {label}", (w, d, hgt), "outdoor")
                t = {"corten": 0.02, "galvanised": 0.02, "brick": 0.11}.get(mid, 0.05)
                it.box(0, 0, w - 2 * t, d - 2 * t, 0, hgt * 0.88, SOIL, top="#52392a")
                it.box(0, -d / 2 + t / 2, w, t, 0, hgt, c1, top=c2)
                it.box(0, d / 2 - t / 2, w, t, 0, hgt, c1, top=c2)
                it.box(-w / 2 + t / 2, 0, t, d - 2 * t, 0, hgt, c1, top=c2)
                it.box(w / 2 - t / 2, 0, t, d - 2 * t, 0, hgt, c1, top=c2)
                if mid in ("sleeper", "softwood", "cedar"):
                    for k in range(1, (2 if hgt > 0.4 else 1) + 1):
                        y = hgt * k / ((2 if hgt > 0.4 else 1) + 1)
                        it.box(0, d / 2 - t * 0.02, w, 0.006, y, 0.012, "#5d4329", fix="d")
                        it.box(0, -d / 2 + t * 0.02, w, 0.006, y, 0.012, "#5d4329", fix="d")
                if mid in ("sleeper", "softwood", "cedar", "composite"):
                    for cx, cz in ((-1, -1), (1, -1), (-1, 1), (1, 1)):
                        it.box(cx * (w / 2 - t * 0.6), cz * (d / 2 - t * 0.6), t * 1.2, t * 1.2, 0, hgt, c2, fix="wd")
                it.rect_symbol(False)
                it.meta = {
                    "room": ["garden"],
                    "tags": ["raised bed", "vegetable bed", "planter", "grow bed", mname.lower()],
                    "family": f"raised_bed_{mid}",
                    "variant": {"en": label},
                }
                items.append(it)
    # planted vegetable bed in timber
    for (w, d) in sizes:
        it = Item(f"raised_bed_veg_{round(w * 100)}x{round(d * 100)}", f"Raised bed, planted with vegetables, {w:g} × {d:g} m", (w, d, 0.6), "outdoor")
        t = 0.05
        it.box(0, 0, w - 2 * t, d - 2 * t, 0, 0.3, SOIL, top="#52392a")
        for cx, cz, sw, sd in ((0, -d / 2 + t / 2, w, t), (0, d / 2 - t / 2, w, t), (-w / 2 + t / 2, 0, t, d - 2 * t), (w / 2 - t / 2, 0, t, d - 2 * t)):
            it.box(cx, cz, sw, sd, 0, 0.3, "#b98c58", top="#cb9d68")
        r = rng(it.id)
        cols = ["#4f9a3a", "#6cb84c", "#8a2f3a", "#3f7d3a", "#c9a33a"]
        for i in range(10):
            x, z = r.uniform(-0.4, 0.4) * w, r.uniform(-0.38, 0.38) * d
            s = r.uniform(0.15, 0.25)
            it.sphere(x, z, s, s, 0.28, s * 0.9, cols[i % len(cols)])
        it.rect_symbol(False)
        it.meta = {"room": ["garden"], "tags": ["raised bed", "vegetable bed", "allotment", "planted"], "family": "raised_bed_veg", "variant": {"en": f"{w:g} × {d:g} m"}}
        items.append(it)
    return items


def main() -> None:
    items = grass_items() + surface_items() + bed_items() + plant_items()
    write_pack(
        PACK,
        "Garden plants & ground",
        "Grass in several lengths, soils and mulches, raised beds and 50 garden plants in sizes and colours, modelled for Home 3D from simple shapes. Ships with the app and works offline.",
        items,
    )


if __name__ == "__main__":
    main()
