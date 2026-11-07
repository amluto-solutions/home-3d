"""Add the worktop gear (#278) and the L-shaped corner sink units (#279) to the bundled pack amluto.kitchen-bath.

    python tools/gen_kitchen_worktop.py

Our own designs from boxes, cylinders, spheres, lathes, lofts and rounded boxes, with generic names and the sizes of
the real products. The pack's other items are left alone; only the items made here are written again. Appliances
go in the `appliance` folder (they draw power, so they are electric), the rest in `kitchen`.
"""

from __future__ import annotations

import math

from pack_builder import Item, add_items

PACK = "amluto.kitchen-bath"
RELEASE = 2
NOTE = "New: worktop gear (air fryers, multi-cookers, blenders, boards, knife blocks, bread bins, spice racks) and L-shaped corner sink units."

STEEL = "#c4c8cd"
BLACK = "#25272b"
GRAPHITE = "#3a3d42"
CREAM = "#eae3cf"
items: list[Item] = []


def add(it: Item, tags: list[str], family: str, variant: str, electric: bool = False, **extra) -> Item:
    meta: dict = {"room": ["kitchen"], "tags": [t for t in tags if len(t) <= 30][:12], "family": family, "variant": {"en": variant}}
    if electric:
        meta["electric"] = True
    meta.update(extra)
    it.meta = meta
    items.append(it)
    return it


def lathe(it: Item, cx: float, cz: float, w: float, d: float, y: float, h: float, color: str, profile: list, **kw) -> None:
    it.p("lathe", cx, cz, w, d, y, h, color, profile=profile, **kw)


def rbox(it: Item, cx: float, cz: float, w: float, d: float, y: float, h: float, color: str, rnd: float = 0.2, **kw) -> None:
    it.p("rbox", cx, cz, w, d, y, h, color, round=rnd, **kw)


def appliance(item_id: str, name: str, size: tuple[float, float, float]) -> Item:
    return Item(item_id, name, size, "appliance")


def worktop(item_id: str, name: str, size: tuple[float, float, float]) -> Item:
    return Item(item_id, name, size, "kitchen")


def display(it: Item, cx: float, cz: float, w: float, y: float, h: float = 0.012) -> None:
    it.box(cx, cz, w, 0.004, y, h, "#7fe3ff", edges="faint", fix="wdh")


def feet(it: Item, inset: float = 0.03, h: float = 0.01) -> None:
    for sx in (-1, 1):
        for sz in (-1, 1):
            it.cyl(sx * (it.W / 2 - inset), sz * (it.D / 2 - inset), 0.025, 0.025, 0, h, BLACK, fix="wdh")


# ---------------------------------------------------------------- air fryers


def air_fryer(item_id: str, name: str, size: tuple[float, float, float], layout: str, variant: str, tags: list[str]) -> None:
    it = appliance(item_id, name, size)
    W, D, H = it.W, it.D, it.H
    feet(it)
    rbox(it, 0, -0.02, W, D - 0.04, 0.01, H - 0.01, BLACK, 0.12)
    front = D / 2 - 0.01
    if layout == "single":
        rbox(it, 0, front, W - 0.04, 0.03, 0.03, H * 0.58, GRAPHITE, 0.15)
        it.box(0, front + 0.02, W * 0.5, 0.025, H * 0.4, 0.03, STEEL, fix="wdh")
        it.box(0, front - 0.03, W - 0.07, 0.01, H * 0.78, H * 0.17, "#2a2c30", fix="h")
        display(it, 0, front - 0.02, W * 0.4, H * 0.82)
    elif layout == "dual":
        for sx in (-1, 1):
            rbox(it, sx * W * 0.235, front, W * 0.44, 0.03, 0.03, H * 0.52, GRAPHITE, 0.15)
            it.box(sx * W * 0.235, front + 0.02, W * 0.2, 0.025, H * 0.35, 0.025, STEEL, fix="wdh")
        it.box(0, front - 0.03, W - 0.07, 0.01, H * 0.76, H * 0.17, "#2a2c30", fix="h")
        display(it, 0, front - 0.02, W * 0.3, H * 0.8)
    else:  # stack: two drawers one above the other
        for i in range(2):
            y = 0.03 + i * H * 0.4
            rbox(it, 0, front, W - 0.04, 0.03, y, H * 0.36, GRAPHITE, 0.15)
            it.box(0, front + 0.02, W * 0.5, 0.025, y + H * 0.2, 0.025, STEEL, fix="wdh")
        it.box(0, front - 0.03, W - 0.07, 0.01, H * 0.86, H * 0.1, "#2a2c30", fix="h")
        display(it, 0, front - 0.02, W * 0.4, H * 0.88, 0.01)
    it.rect_symbol()
    add(it, ["air fryer", "airfryer", "fryer", "cooking", "countertop", "ninja", *tags], "air_fryer", variant, True, mount="surface")


# ---------------------------------------------------------------- pots: multi-cookers, slow cookers, rice cookers


def pot_cooker(item_id: str, name: str, size: tuple[float, float, float], kind: str, variant: str, tags: list[str]) -> None:
    it = appliance(item_id, name, size)
    W, D, H = it.W, it.D, it.H
    oval = kind == "slow"
    pw, pd = (W * 0.86, D) if oval else (min(W - 0.08, D), D)
    base_c = BLACK if kind != "slow" else STEEL
    lathe(it, 0, 0, pw, pd, 0, H * 0.62, base_c, [[0, 0], [0.92, 0], [1, 0.08], [1, 0.9], [0.95, 1], [0, 1]])
    lathe(it, 0, 0, pw * 0.97, pd * 0.97, H * 0.6, H * 0.36, "glass" if kind == "slow" else GRAPHITE, [[0, 0], [1, 0], [0.96, 0.5], [0.55, 0.95], [0, 1]])
    it.cyl(0, 0, 0.04, 0.04, H * 0.94, H * 0.05, BLACK, fix="wdh")
    for sx in (-1, 1):
        it.box(sx * (pw / 2 + 0.012), 0, 0.03, 0.07, H * 0.5, 0.03, BLACK, fix="wdh")
    display(it, 0, pd / 2 - 0.002, pw * 0.4, H * 0.3, 0.025)
    for sx in (-1, 1):
        it.cyl(sx * pw * 0.28, pd / 2 - 0.005, 0.03, 0.02, H * 0.3, 0.03, STEEL, axis="z", fix="wdh")
    if kind == "multi":
        it.box(-pw * 0.22, pd * 0.3, 0.05, 0.03, H * 0.97, 0.01, STEEL, fix="wdh")
    (it.circle_symbol if not oval else it.rect_symbol)()
    add(it, ["cooker", "countertop", "cooking", *tags], "slow_cooker" if oval else "multi_cooker" if kind == "multi" else "rice_cooker", variant, True, mount="surface")


def soup_maker() -> None:
    it = appliance("soup_maker_1_6l", "Soup maker, 1.6 L", (0.2, 0.22, 0.31))
    W, D, H = it.W, it.D, it.H
    rbox(it, 0, 0, W, D, 0, H * 0.28, BLACK, 0.2)
    lathe(it, 0, 0, W * 0.8, D * 0.8, H * 0.28, H * 0.68, STEEL, [[0.7, 0], [1, 0], [1, 0.9], [0.9, 1], [0.1, 1], [0, 0.9]])
    it.box(0, 0, W * 0.5, D * 0.5, H * 0.96, H * 0.04, BLACK, fix="h")
    it.box(W / 2 + 0.012, 0, 0.03, 0.05, H * 0.34, H * 0.5, BLACK, fix="wdh")
    display(it, 0, D / 2 - 0.002, W * 0.3, H * 0.12)
    it.circle_symbol()
    add(it, ["soup maker", "soup", "blender", "countertop"], "soup_maker", "1.6 L", True, mount="surface")


# ---------------------------------------------------------------- blenders and food processors


def blender(item_id: str, name: str, size: tuple[float, float, float], variant: str, tags: list[str]) -> None:
    it = appliance(item_id, name, size)
    W, D, H = it.W, it.D, it.H
    rbox(it, 0, 0, W, D, 0, H * 0.2, BLACK, 0.25)
    it.cyl(0, D / 2 - 0.004, 0.025, 0.012, H * 0.08, 0.025, STEEL, axis="z", fix="wdh")
    lathe(it, 0, 0, W * 0.9, D * 0.9, H * 0.2, H * 0.72, "glass", [[0.55, 0], [0.8, 0], [1, 0.9], [0.95, 1], [0, 1]])
    lathe(it, 0, 0, W * 0.9, D * 0.9, H * 0.9, H * 0.1, BLACK, [[0, 0], [1, 0], [0.9, 1], [0, 1]])
    it.box(W / 2 + 0.01, 0, 0.025, 0.035, H * 0.38, H * 0.45, BLACK, fix="wdh")
    it.box(W / 2 - 0.005, 0, 0.04, 0.035, H * 0.38, 0.025, BLACK, fix="wdh")
    it.box(W / 2 - 0.005, 0, 0.04, 0.035, H * 0.8, 0.025, BLACK, fix="wdh")
    it.circle_symbol()
    add(it, ["blender", "smoothie", "countertop", *tags], "blender", variant, True, mount="surface")


def personal_blender() -> None:
    it = appliance("blender_personal_cup", "Personal blender with cup", (0.12, 0.12, 0.3))
    W, D, H = it.W, it.D, it.H
    rbox(it, 0, 0, W, D, 0, H * 0.3, BLACK, 0.25)
    lathe(it, 0, 0, W * 0.86, D * 0.86, H * 0.3, H * 0.62, "glass", [[0, 0], [1, 0], [0.9, 1], [0, 1]], )
    lathe(it, 0, 0, W * 0.86, D * 0.86, H * 0.9, H * 0.1, "accent", [[0, 0], [1, 0], [0.9, 1], [0, 1]])
    it.circle_symbol()
    add(it, ["blender", "personal blender", "smoothie", "nutri", "bullet", "countertop"], "blender", "Personal cup", True, mount="surface")


def food_processor() -> None:
    it = appliance("food_processor_3l", "Food processor, 3 L", (0.24, 0.3, 0.38))
    W, D, H = it.W, it.D, it.H
    rbox(it, 0, 0, W, D, 0, H * 0.34, BLACK, 0.12)
    lathe(it, 0, 0.0, W * 0.9, D * 0.8, H * 0.34, H * 0.46, "glass", [[0, 0], [1, 0], [1, 1], [0, 1]])
    it.box(0, 0, W * 0.5, D * 0.5, H * 0.8, H * 0.1, BLACK, fix="h")
    it.box(0, -D * 0.12, 0.05, 0.05, H * 0.9, H * 0.1, BLACK, fix="wdh")
    it.box(0, D / 2 - 0.004, W * 0.5, 0.01, H * 0.1, H * 0.1, GRAPHITE, fix="wdh")
    it.rect_symbol()
    add(it, ["food processor", "chopper", "countertop"], "food_processor", "3 L", True, mount="surface")


# ---------------------------------------------------------------- ice cream, coffee, grills, ovens


def ice_cream_pint() -> None:
    it = appliance("ice_cream_maker_pint", "Ice-cream maker, frozen dessert", (0.17, 0.22, 0.35))
    W, D, H = it.W, it.D, it.H
    rbox(it, 0, -0.02, W, D - 0.04, 0, H, BLACK, 0.12)
    it.box(0, D / 2 - 0.015, W * 0.72, 0.012, H * 0.52, H * 0.3, "glass", edges="faint")
    it.box(0, D / 2 - 0.012, W * 0.72, 0.012, H * 0.2, H * 0.18, GRAPHITE, fix="wdh")
    display(it, 0, D / 2 - 0.012, W * 0.5, H * 0.9)
    it.box(0, -D * 0.1, W * 0.5, D * 0.35, H * 0.96, H * 0.04, STEEL, fix="wdh")
    it.rect_symbol()
    add(it, ["ice cream maker", "ice-cream", "creami", "frozen dessert", "sorbet", "countertop"], "ice_cream_maker", "Frozen dessert", True, mount="surface")


def ice_cream_compressor() -> None:
    it = appliance("ice_cream_maker_compressor", "Ice-cream maker, compressor, 1.5 L", (0.42, 0.33, 0.26))
    W, D, H = it.W, it.D, it.H
    rbox(it, 0, 0, W, D, 0, H * 0.56, STEEL, 0.08)
    lathe(it, -W * 0.08, 0.0, W * 0.5, D * 0.8, H * 0.56, H * 0.34, "glass", [[0, 0], [1, 0], [1, 1], [0, 1]])
    lathe(it, -W * 0.08, 0.0, W * 0.55, D * 0.85, H * 0.9, H * 0.1, BLACK, [[0, 0], [1, 0], [0.9, 1], [0, 1]])
    display(it, W * 0.33, D / 2 - 0.002, W * 0.22, H * 0.34, 0.03)
    it.cyl(W * 0.33, D / 2 - 0.006, 0.035, 0.015, H * 0.12, 0.035, BLACK, axis="z", fix="wdh")
    it.rect_symbol()
    add(it, ["ice cream maker", "ice-cream", "gelato", "sorbet", "countertop"], "ice_cream_maker", "Compressor, 1.5 L", True, mount="surface")


def dual_brew_coffee() -> None:
    it = appliance("coffee_machine_dual_brew", "Coffee machine, dual brew (pods and filter)", (0.3, 0.38, 0.4))
    W, D, H = it.W, it.D, it.H
    rbox(it, 0, 0, W, D, 0, 0.03, BLACK, 0.3, fix="h")
    it.box(0, -D * 0.34, W, D * 0.28, 0.03, H - 0.03, BLACK, fix="d")
    it.box(0, -D * 0.1, W, D * 0.2, H * 0.72, H * 0.28, BLACK, fix="d")
    lathe(it, W * 0.0, -D * 0.4, W * 0.5, D * 0.12, 0.03, H - 0.03, "glass", [[0, 0], [1, 0], [1, 1], [0, 1]], edges="faint")
    lathe(it, 0, D * 0.1, W * 0.38, D * 0.3, 0.03, H * 0.34, "glass", [[0.8, 0], [1, 0], [1, 0.9], [0.9, 1], [0, 1]])
    it.box(W * 0.17, D * 0.1, 0.02, 0.04, H * 0.14, H * 0.2, BLACK, fix="wdh")
    display(it, 0, -D * 0.0, W * 0.3, H * 0.9)
    it.rect_symbol()
    add(it, ["coffee machine", "coffee maker", "pod", "filter", "carafe", "countertop"], "coffee_machine", "Dual brew", True, mount="surface")


def grill(item_id: str, name: str, size: tuple[float, float, float], kind: str, variant: str, tags: list[str]) -> None:
    it = appliance(item_id, name, size)
    W, D, H = it.W, it.D, it.H
    if kind == "indoor":
        rbox(it, 0, 0, W, D, 0, H * 0.5, BLACK, 0.1)
        rbox(it, 0, 0, W, D * 0.95, H * 0.5, H * 0.5, GRAPHITE, 0.25)
        it.box(0, D / 2 - 0.004, W * 0.5, 0.01, H * 0.18, H * 0.16, STEEL, fix="wdh")
        display(it, 0, D / 2 - 0.003, W * 0.3, H * 0.34, 0.02)
    else:
        rbox(it, 0, 0, W, D, 0, H * 0.5, BLACK, 0.15)
        rbox(it, 0, 0, W * 0.96, D * 0.96, H * 0.5, H * 0.5, GRAPHITE if kind != "waffle" else STEEL, 0.25)
        for i in range(5):
            it.box(0, -D * 0.28 + i * D * 0.14, W * 0.7, 0.01, H * 0.5, 0.004, "#101114", fix="wdh")
        it.box(0, D / 2 + 0.01, W * 0.5, 0.025, H * 0.4, 0.02, BLACK, fix="wdh")
    it.rect_symbol()
    add(it, ["grill", "countertop", "cooking", *tags], {"indoor": "grill", "contact": "grill", "waffle": "waffle_maker", "sandwich": "sandwich_toaster"}[kind], variant, True, mount="surface")


def mini_oven() -> None:
    it = appliance("mini_oven_20l", "Mini oven, 20 L", (0.45, 0.35, 0.28))
    W, D, H = it.W, it.D, it.H
    feet(it, 0.04, 0.012)
    rbox(it, 0, 0, W, D, 0.012, H - 0.012, BLACK, 0.1)
    it.box(-W * 0.08, D / 2 - 0.004, W * 0.6, 0.01, H * 0.2, H * 0.6, "glass", edges="faint")
    it.box(-W * 0.08, D / 2 + 0.006, W * 0.5, 0.012, H * 0.76, 0.012, STEEL, fix="wdh")
    for k in (0.3, 0.55, 0.8):
        it.cyl(W * 0.4, D / 2 - 0.005, 0.03, 0.015, H * k, 0.03, STEEL, axis="z", fix="wdh")
    it.rect_symbol()
    add(it, ["mini oven", "toaster oven", "table top oven", "countertop", "cooking"], "mini_oven", "20 L", True, mount="surface")


def kettle(item_id: str, name: str, variant: str, body: str, glass: bool) -> None:
    it = appliance(item_id, name, (0.22, 0.17, 0.26))
    W, D, H = it.W, it.D, it.H
    it.cyl(-0.01, 0, 0.17, 0.17, 0, 0.03, BLACK, fix="wdh")
    lathe(it, -0.01, 0, 0.16, 0.16, 0.03, H - 0.07, "glass" if glass else body, [[0, 0], [0.95, 0], [1, 0.1], [0.9, 1], [0, 1]])
    lathe(it, -0.01, 0, 0.14, 0.14, H - 0.04, 0.04, BLACK, [[0, 0], [1, 0], [0.8, 1], [0, 1]])
    it.box(-W / 2 + 0.02, 0, 0.025, 0.025, 0.06, H - 0.1, BLACK, fix="wdh")
    it.box(W / 2 - 0.025, 0, 0.05, 0.05, H * 0.55, H * 0.2, body if not glass else STEEL, fix="wdh")
    if glass:
        it.box(0, 0, 0.1, 0.1, 0.03, 0.02, "#55b8ff", edges="glow", fix="wdh")
    it.circle_symbol()
    add(it, ["kettle", "electric kettle", "tea", "hot water", "cordless kettle", "1.7 l"], "kettle", variant, True, mount="surface")


def toaster(item_id: str, name: str, size: tuple[float, float, float], body: str, variant: str, slots: int) -> None:
    it = appliance(item_id, name, size)
    W, D, H = it.W, it.D, it.H
    rbox(it, 0, 0, W, D, 0, H, body, 0.25)
    for i in range(slots):
        z = (i - (slots - 1) / 2) * (D / slots) * 0.9
        it.box(0, z, W * 0.7, D / slots * 0.35, H * 0.95, H * 0.06, "#101114", fix="wdh")
    it.box(W / 2 - 0.01, D * 0.2, 0.01, 0.025, H * 0.5, 0.03, BLACK, fix="wdh")
    it.cyl(-W * 0.25, D / 2 - 0.003, 0.025, 0.012, H * 0.4, 0.025, BLACK, axis="z", fix="wdh")
    it.rect_symbol()
    add(it, ["toaster", "toast", "bread", "countertop"], "toaster", variant, True, mount="surface")


# ---------------------------------------------------------------- boards, blocks, pots, bins


def board(item_id: str, name: str, size: tuple[float, float, float], color: str, variant: str, family: str, tags: list[str], shape: str = "rect") -> None:
    it = worktop(item_id, name, size)
    W, D, H = it.W, it.D, it.H
    if shape == "round":
        it.cyl(0, 0, W, D, 0, H, color, fix="h")
        it.box(0, -D * 0.4, 0.05, 0.015, H * 0.5, H * 0.5, "#6a4a2c", fix="wdh")
        it.circle_symbol()
    elif shape == "paddle":
        bw = W * 0.7
        it.box(-W / 2 + bw / 2, 0, bw, D, 0, H, color, fix="h")
        it.box(W / 2 - (W - bw) / 2, 0, W - bw, D * 0.3, 0, H, color, fix="h")
        it.cyl(W / 2 - 0.025, 0, 0.02, 0.02, 0, H, "#101114", fix="wdh")
        it.rect_symbol()
    else:
        it.box(0, 0, W, D, 0, H, color, fix="h")
        if shape == "plastic":
            it.box(W / 2 - 0.03, D * 0.3, 0.025, 0.012, H * 0.5, H * 0.5, "#101114", fix="wdh")
        it.rect_symbol()
    add(it, ["chopping board", "cutting board", "kitchen", "worktop", *tags], family, variant, False, mount="surface")


def knife_block(item_id: str, name: str, size: tuple[float, float, float], body: str, kind: str, variant: str) -> None:
    it = worktop(item_id, name, size)
    W, D, H = it.W, it.D, it.H
    if kind == "universal":
        it.cyl(0, 0, W, D, 0, H * 0.82, body, fix="h")
        for i, (x, z) in enumerate([(-0.025, -0.02), (0.02, -0.03), (0.03, 0.02), (-0.02, 0.03), (0.0, 0.0)]):
            it.cyl(x, z, 0.012, 0.012, H * 0.82, H * 0.18, "#101114", fix="wdh")
        it.circle_symbol()
    else:
        it.box(0, 0, W, D * 0.9, 0, H * 0.35, body, fix="h")
        it.p("loft", 0, 0, W, D * 0.9, H * 0.35, H * 0.5, body, tx=0, tz=-D * 0.12, tw=W, td=D * 0.35)
        for i in range(5):
            x = -W * 0.36 + i * W * 0.18
            it.box(x, -D * 0.1, 0.014, 0.03, H * 0.85, H * 0.15, "#101114", fix="wdh")
        it.rect_symbol()
    add(it, ["knife block", "knives", "chef knives", "kitchen", "worktop"], "knife_block", variant, False, mount="surface")


def magnetic_strip() -> None:
    it = worktop("knife_strip_magnetic_40", "Magnetic knife strip, 40 cm", (0.4, 0.03, 0.22))
    W, D, H = it.W, it.D, it.H
    it.box(0, -D * 0.2, W, 0.02, H * 0.55, H * 0.1, "wood", fix="dh")
    for i in range(4):
        x = -W * 0.36 + i * W * 0.24
        it.box(x, 0.0, 0.03, 0.006, H * 0.0, H * 0.58, STEEL, fix="wdh")
        it.box(x, 0.0, 0.02, 0.012, H * 0.58, H * 0.4, "#101114", fix="wdh")
    it.rect_symbol()
    add(it, ["knife strip", "magnetic knife rack", "knives", "kitchen", "wall"], "knife_block", "Magnetic strip", False, mount="wall", wall_y=1.2)


def utensil_pot(item_id: str, name: str, color: str, variant: str, size: tuple[float, float, float] = (0.13, 0.13, 0.32)) -> None:
    it = worktop(item_id, name, size)
    W, D, H = it.W, it.D, it.H
    ph = 0.15
    lathe(it, 0, 0, W, D, 0, ph, color, [[0, 0], [0.9, 0], [1, 0.1], [1, 1], [0.92, 1], [0.85, 0.95], [0, 0.95]])
    for (x, z, kind) in [(-0.025, 0.0, "spatula"), (0.025, 0.01, "spoon"), (0.0, -0.025, "whisk"), (0.0, 0.03, "ladle")]:
        top = H * (0.97 if kind != "whisk" else 0.85)
        it.cyl(x, z, 0.014, 0.014, ph * 0.5, top - ph * 0.5, "wood" if kind in ("spoon", "spatula") else STEEL, fix="wd")
        if kind == "spatula":
            it.box(x, z, 0.05, 0.008, top - 0.07, 0.07, BLACK, fix="wdh")
        elif kind == "spoon":
            it.sphere(x, z, 0.045, 0.02, top - 0.05, 0.05, "wood", fix="wdh")
        elif kind == "whisk":
            it.sphere(x, z, 0.04, 0.04, top - 0.1, 0.12, STEEL, edges="faint", fix="wdh")
        else:
            it.cyl(x, z, 0.06, 0.06, top - 0.03, 0.03, STEEL, fix="wdh")
    it.circle_symbol()
    add(it, ["utensil pot", "utensil holder", "utensil crock", "spatula", "ladle", "whisk", "kitchen", "worktop"], "utensil_pot", variant, False, mount="surface")


def bread_bin(item_id: str, name: str, size: tuple[float, float, float], body: str, kind: str, variant: str) -> None:
    it = worktop(item_id, name, size)
    W, D, H = it.W, it.D, it.H
    if kind == "roll":
        rbox(it, 0, 0, W, D, 0, H, body, 0.18)
        for i in range(7):
            it.box(0, D / 2 - 0.002, W * 0.88, 0.006, H * 0.14 + i * H * 0.085, H * 0.07, STEEL if body == STEEL else "#d9d1bb", fix="wdh")
        it.box(0, D / 2 + 0.008, 0.06, 0.016, H * 0.8, 0.012, BLACK, fix="wdh")
    elif kind == "box":
        it.box(0, 0, W, D, 0, H * 0.7, body, fix="h")
        it.p("loft", 0, 0, W, D, H * 0.7, H * 0.3, body, tx=0, tz=-D * 0.1, tw=W, td=D * 0.7)
        it.box(0, D / 2 + 0.006, 0.07, 0.012, H * 0.5, 0.012, STEEL, fix="wdh")
    else:  # enamel bin with domed lid
        lathe(it, 0, 0, W, D, 0, H * 0.7, body, [[0, 0], [1, 0], [1, 1], [0, 1]])
        it.p("loft", 0, 0, W, D, H * 0.7, H * 0.28, body, tx=0, tz=0, tw=W * 0.75, td=D * 0.75)
        it.box(0, 0, 0.05, 0.02, H * 0.98, H * 0.02, "dark", fix="wdh")
    it.rect_symbol()
    add(it, ["bread bin", "bread box", "bread", "kitchen", "worktop"], "bread_bin", variant, False, mount="surface")


def fruit(item_id: str, name: str, size: tuple[float, float, float], kind: str, variant: str) -> None:
    it = worktop(item_id, name, size)
    W, D, H = it.W, it.D, it.H
    cols = ["#c9372c", "#e8a329", "#7aa63a", "#e9d04a"]
    if kind == "basket":
        lathe(it, 0, 0, W, D, 0, H * 0.7, "dark", [[0, 0], [0.7, 0], [1, 1], [0.92, 1], [0.64, 0.08], [0, 0.08]])
        for i, (x, z) in enumerate([(-0.07, -0.03), (0.05, -0.06), (0.08, 0.05), (-0.04, 0.07), (0.0, 0.0)]):
            it.sphere(x, z, 0.07, 0.07, H * 0.38 + (i == 4) * 0.04, 0.07, cols[i % 4], fix="wdh")
        it.circle_symbol()
    elif kind == "tiers":
        it.cyl(0, 0, 0.012, 0.012, 0.02, H - 0.02, STEEL, fix="wd")
        it.cyl(0, 0, W, D, 0, 0.02, STEEL, fix="wdh")
        lathe(it, 0, 0, W, D, H * 0.12, H * 0.14, STEEL, [[0, 0], [1, 0.6], [1, 1], [0.9, 1], [0, 0.1]])
        lathe(it, 0, 0, W * 0.8, D * 0.8, H * 0.5, H * 0.12, STEEL, [[0, 0], [1, 0.6], [1, 1], [0.9, 1], [0, 0.1]])
        for i, (x, z) in enumerate([(-0.08, 0.02), (0.08, 0.05), (0.0, -0.06), (-0.04, -0.01), (0.05, 0.02)]):
            it.sphere(x, z, 0.07, 0.07, H * 0.26, 0.07, cols[i % 4], fix="wdh")
        it.sphere(0.0, 0.0, 0.06, 0.06, H * 0.62, 0.06, cols[0], fix="wdh")
        it.circle_symbol()
    else:  # banana hook stand
        it.cyl(0, 0, W * 0.9, D * 0.9, 0, 0.015, "dark", fix="wdh")
        it.cyl(0, 0, 0.01, 0.01, 0.015, H * 0.9, STEEL, fix="wd")
        it.box(0.04, 0, 0.1, 0.01, H * 0.9, 0.01, STEEL, fix="wdh")
        for i in range(3):
            it.p("loft", 0.085, 0.01 * (i - 1), 0.03, 0.025, H * 0.52, H * 0.38, "#e9d04a", tx=0.06, tz=0.01 * (i - 1), tw=0.015, td=0.015, fix="wdh")
        it.circle_symbol()
    add(it, ["fruit bowl", "fruit basket", "fruit stand", "apples", "oranges", "kitchen", "worktop"], "fruit_basket", variant, False, mount="surface")


def spice_rack(item_id: str, name: str, size: tuple[float, float, float], kind: str, variant: str) -> None:
    it = worktop(item_id, name, size)
    W, D, H = it.W, it.D, it.H
    caps = ["#c9372c", "#e8a329", "#7aa63a", "#3a3d42"]

    def jar(x: float, z: float, y: float, h: float, k: int) -> None:
        it.cyl(x, z, 0.04, 0.04, y, h, "glass", fix="wdh")
        it.cyl(x, z, 0.042, 0.042, y + h, 0.012, caps[k % 4], fix="wdh")

    if kind == "carousel":
        it.cyl(0, 0, W, D, 0, 0.015, "wood", fix="wdh")
        it.cyl(0, 0, 0.02, 0.02, 0.015, H - 0.015, STEEL, fix="wd")
        for lvl, (y, r, n) in enumerate([(0.015, 0.085, 6), (H * 0.5, 0.075, 5)]):
            it.cyl(0, 0, r * 2.9, r * 2.9, y, 0.012, "wood", fix="wdh")
            for i in range(n):
                a = i * 2 * math.pi / n
                jar(r * math.cos(a) * 1.1, r * math.sin(a) * 1.1, y + 0.012, H * 0.36, i + lvl)
        it.circle_symbol()
    elif kind == "wall":
        it.box(0, -D * 0.45, W, 0.01, 0, H, "wood", fix="d")
        for s in range(3):
            y = 0.04 + s * H * 0.32
            it.box(0, 0, W, D * 0.9, y, 0.015, "wood", fix="wdh")
            for i in range(6):
                jar(-W * 0.42 + i * W * 0.168, 0.0, y + 0.015, H * 0.2, i + s)
        it.rect_symbol()
    else:  # stepped countertop rack: three rows rising to the back
        for s in range(3):
            it.box(0, D * (0.3 - 0.3 * s), W, D * 0.34, 0, H * (0.25 + 0.17 * s) * 0.6, "wood")
            top = H * (0.25 + 0.17 * s) * 0.6
            for i in range(5):
                jar(-W * 0.4 + i * W * 0.2, D * (0.3 - 0.3 * s), top, H * 0.3, i + s)
        it.rect_symbol()
    extra = {"mount": "wall", "wall_y": 1.2} if kind == "wall" else {"mount": "surface"}
    add(it, ["spice rack", "spices", "herbs", "jars", "condiments", "kitchen", "worktop"], "spice_rack", variant, False, **extra)


def canisters() -> None:
    it = worktop("canister_set_3", "Kitchen canisters, set of 3 (tea, coffee, sugar)", (0.36, 0.12, 0.19))
    W, D, H = it.W, it.D, it.H
    for i, (c, lid) in enumerate([("#f2efe6", "wood"), ("#f2efe6", "wood"), ("#f2efe6", "wood")]):
        x = (i - 1) * 0.12
        lathe(it, x, 0, 0.11, 0.11, 0, H * 0.88, c, [[0, 0], [1, 0], [1, 1], [0, 1]])
        it.cyl(x, 0, 0.115, 0.115, H * 0.88, H * 0.12, lid, fix="wdh")
        it.box(x, D / 2 - 0.004, 0.05, 0.004, H * 0.4, H * 0.14, "accent", fix="wdh")
    it.rect_symbol()
    add(it, ["canisters", "tea coffee sugar", "storage jars", "kitchen", "worktop"], "canister_set", "Set of 3", False, mount="surface")


def roll_holder() -> None:
    it = worktop("kitchen_roll_holder", "Kitchen roll holder", (0.15, 0.15, 0.32))
    W, D, H = it.W, it.D, it.H
    it.cyl(0, 0, W, D, 0, 0.015, "wood", fix="wdh")
    it.cyl(0, 0, 0.012, 0.012, 0.015, H - 0.015, STEEL, fix="wd")
    it.cyl(0, 0, 0.12, 0.12, 0.03, H * 0.8, "white", fix="wdh")
    it.circle_symbol()
    add(it, ["kitchen roll", "paper towel", "kitchen", "worktop"], "kitchen_roll_holder", "Standing", False, mount="surface")


def tap(item_id: str, name: str, pull_out: bool, variant: str) -> None:
    it = worktop(item_id, name, (0.05, 0.2, 0.28) if pull_out else (0.05, 0.19, 0.26))
    W, D, H = it.W, it.D, it.H
    it.cyl(0, -D * 0.42, 0.05, 0.05, 0, 0.012, STEEL, fix="wdh")
    it.cyl(0, -D * 0.42, 0.032, 0.032, 0.012, H * 0.7, STEEL, fix="wdh")
    it.cyl(0, -D * 0.12, 0.028, 0.028, H * 0.66, H * 0.1, STEEL, fix="wdh") if not pull_out else it.cyl(0, -D * 0.2, 0.026, 0.026, H * 0.55, H * 0.45, STEEL, fix="wdh")
    it.box(0, -D * 0.12, 0.028, D * 0.55, H * 0.88, 0.028, STEEL, fix="wdh")
    it.cyl(0, D * 0.14, 0.03, 0.03, H * 0.76, H * 0.12, STEEL, fix="wdh")
    it.box(0.035, -D * 0.42, 0.04, 0.01, H * 0.5, 0.01, STEEL, fix="wdh")
    it.rect_symbol()
    add(it, ["tap", "mixer tap", "kitchen tap", "faucet", "sink", "worktop"], "kitchen_tap", variant, False, mount="surface")


# ---------------------------------------------------------------- L-shaped corner base units with a sink on top


def corner_sink(size: int, depth: int, sink: str, hand: str) -> None:
    """A 90 degree corner base unit: back run W wide and 600 deep, return run 600 wide along one side down to D.

    Built for the left-hand unit (the return run on the left as you face it) and mirrored for the right-hand one.
    """
    W, D = size / 1000, depth / 1000
    H, A = 0.91, 0.6
    m = -1 if hand == "right" else 1  # mirror x
    kind = "inset" if sink == "inset" else "belfast"
    it = Item(f"corner_sink_{kind}_{hand}_{size}_{depth}", "", (W, D, H), "kitchen")

    def rect(x0: float, x1: float, z0: float, z1: float, y: float, h: float, color: str, shape: str = "box", **kw) -> None:
        cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
        it.p(shape, m * cx, cz, x1 - x0, z1 - z0, y, h, color, **kw)

    xl, xr = -W / 2, W / 2  # left run end and long run end
    xi = xl + A  # inner side of the return run
    zb = -D / 2
    zf = zb + A  # front of the back run
    zz = D / 2  # front of the return run
    top, tk = 0.87, 0.04
    belfast = kind == "belfast"
    rect(xi, xr, zb, zf - 0.07, 0, 0.15, "dark", fix="h")
    rect(xl, xi, zb, zz - 0.07, 0, 0.15, "dark", fix="h")
    rect(xi, xr, zb, zf - 0.02, 0.15, top - 0.15, "white")
    rect(xl, xi, zb, zz - 0.02, 0.15, top - 0.15, "white")
    # doors
    n = 2 if (xr - xi) > 0.7 else 1
    seg = (xr - xi) / n
    for i in range(n):
        x0 = xi + i * seg + 0.002
        dh = 0.52 if (belfast and x0 < xi + 0.6) else 0.66
        rect(x0, x0 + seg - 0.004, zf - 0.02, zf, 0.17, dh, "body")
        hx = x0 + 0.04 if (n > 1 and i == 1) else x0 + seg - 0.04
        rect(hx - 0.008, hx + 0.008, zf, zf + 0.014, 0.17 + dh - 0.16, 0.14, "metal", fix="wdh")
    rect(xl + 0.002, xi - 0.002, zz - 0.02, zz, 0.17, 0.66, "body")
    rect(xi - 0.05, xi - 0.034, zz, zz + 0.014, 0.17 + 0.5, 0.14, "metal", fix="wdh")
    wt = "#cfc9bb"
    if kind == "inset":
        bx0, bx1 = xl + 0.05, xl + 0.55
        bz0, bz1 = zb + 0.1, zb + 0.5
        dx1 = min(xr, xi + 0.05 + min(0.55, xr - xi - 0.05))
        rect(xl, xr, zb, zb + 0.1, top, tk, wt, fix="h")
        rect(xl, xr, bz1, zf, top, tk, wt, fix="h")
        rect(xl, bx0, bz0, bz1, top, tk, wt, fix="h")
        rect(bx1, xi + 0.05, bz0, bz1, top, tk, wt, fix="h")
        rect(xi + 0.05, dx1, bz0, bz1, top, tk, STEEL, fix="h")
        if dx1 < xr:
            rect(dx1, xr, bz0, bz1, top, tk, wt, fix="h")
        rect(xl, xi, zf, zz, top, tk, wt, fix="h")
        # bowl
        rect(bx0, bx1, bz0, bz1, top - 0.14, 0.01, "#9aa0a6", fix="wdh")
        for (a, b, c2, d2) in [(bx0, bx0 + 0.01, bz0, bz1), (bx1 - 0.01, bx1, bz0, bz1), (bx0, bx1, bz0, bz0 + 0.01), (bx0, bx1, bz1 - 0.01, bz1)]:
            rect(a, b, c2, d2, top - 0.13, 0.17, STEEL, fix="h")
        rect((bx0 + bx1) / 2 - 0.025, (bx0 + bx1) / 2 + 0.025, (bz0 + bz1) / 2 - 0.025, (bz0 + bz1) / 2 + 0.025, top - 0.135, 0.01, "dark", "cyl", fix="wdh")
        sym_sink = (bx0, bx1, bz0, bz1)
        label = "Inset sink"
    else:
        sx0, sx1 = xi, xi + 0.6
        sz1 = zf + 0.02
        sz0 = sz1 - 0.46
        rect(xl, xr, zb, sz0, top, tk, wt, fix="h")
        rect(xl, xi, sz0, zf, top, tk, wt, fix="h")
        if sx1 < xr:
            rect(sx1, xr, sz0, zf, top, tk, wt, fix="h")
        rect(xl, xi, zf, zz, top, tk, wt, fix="h")
        # belfast sink: apron 22 cm high, flush with the worktop, hollow inside
        rect(sx0, sx1, sz1 - 0.04, sz1, 0.69, 0.22, "white", fix="h")
        rect(sx0, sx1, sz0, sz1 - 0.04, 0.69, 0.04, "white", fix="h")
        rect(sx0, sx0 + 0.04, sz0, sz1 - 0.04, 0.69, 0.22, "white", fix="wh")
        rect(sx1 - 0.04, sx1, sz0, sz1 - 0.04, 0.69, 0.22, "white", fix="wh")
        rect(sx0 + 0.04, sx1 - 0.04, sz0, sz0 + 0.04, 0.69, 0.22, "white", fix="dh")
        rect(sx0 + 0.04, sx1 - 0.04, sz0 + 0.04, sz1 - 0.04, 0.72, 0.01, "#e4e6e8", fix="wdh")
        rect((sx0 + sx1) / 2 - 0.025, (sx0 + sx1) / 2 + 0.025, (sz0 + sz1) / 2 - 0.025, (sz0 + sz1) / 2 + 0.025, 0.725, 0.006, "metal", "cyl", fix="wdh")
        sym_sink = (sx0 + 0.04, sx1 - 0.04, sz0 + 0.04, sz1 - 0.04)
        label = "Belfast sink"
    # plan symbol: the two runs, the sink and the door line of the back run
    def frac(x0: float, x1: float, z0: float, z1: float) -> dict:
        return {"shape": "rect", "x": round(m * (x0 + x1) / 2 / W, 4), "z": round((z0 + z1) / 2 / D, 4), "w": round((x1 - x0) / W, 4), "d": round((z1 - z0) / D, 4)}

    it.symbol = [frac(xi, xr, zb, zf), frac(xl, xi, zb, zz), {**frac(*sym_sink), "fill": False}]
    it.name = f"Corner base unit with {label.lower()}, {hand}-hand, {size} × {depth}"
    add(
        it,
        ["sink", "corner sink", "corner unit", "l-shaped", "90 degree", f"{hand}-hand", "kitchen cupboard", "fitted kitchen", "cabinet", "stainless" if kind == "inset" else "belfast sink", "butler sink" if belfast else "drainer"],
        f"corner_sink_{kind}_{hand}",
        f"{size} × {depth}",
        False,
        surface=True,
    )
    it.meta["room"] = ["kitchen", "utility"]


def build() -> None:
    # air fryers (the 4 L single, the XL dual and the double stack; the 6 L single and the dual exist already)
    air_fryer("air_fryer_3_8l", "Air fryer, 3.8 L", (0.26, 0.33, 0.28), "single", "3.8 L", ["compact"])
    air_fryer("air_fryer_dual_xl", "Air fryer, dual basket XL (10 L)", (0.43, 0.4, 0.34), "dual", "Dual XL", ["dual zone", "two baskets"])
    air_fryer("air_fryer_double_stack", "Air fryer, double stack (two drawers)", (0.3, 0.4, 0.4), "stack", "Double stack", ["two drawers", "stacked"])
    pot_cooker("multi_cooker_6l", "Multi-cooker, 6 L", (0.37, 0.36, 0.34), "multi", "6 L", ["multi cooker", "pressure cooker", "ninja", "foodi", "steamer"])
    pot_cooker("multi_cooker_8l", "Multi-cooker, 8 L", (0.41, 0.4, 0.37), "multi", "8 L", ["multi cooker", "pressure cooker", "ninja", "foodi", "steamer"])
    pot_cooker("slow_cooker_3_5l", "Slow cooker, 3.5 L", (0.33, 0.25, 0.23), "slow", "3.5 L", ["slow cooker", "crock pot", "casserole"])
    pot_cooker("slow_cooker_6_5l", "Slow cooker, 6.5 L", (0.43, 0.3, 0.28), "slow", "6.5 L", ["slow cooker", "crock pot", "casserole"])
    pot_cooker("rice_cooker_1_8l", "Rice cooker, 1.8 L", (0.28, 0.25, 0.24), "rice", "1.8 L", ["rice cooker", "steamer"])
    soup_maker()
    blender("blender_jug_1_7l", "Blender, 1.7 L jug", (0.2, 0.21, 0.44), "1.7 L jug", ["smoothie", "jug blender"])
    blender("blender_jug_2l_xl", "Blender, 2.1 L jug (high power)", (0.23, 0.23, 0.47), "2.1 L jug", ["power blender", "jug blender", "ninja"])
    personal_blender()
    food_processor()
    ice_cream_pint()
    ice_cream_compressor()
    dual_brew_coffee()
    grill("contact_grill_4_portion", "Contact grill, 4 portion", (0.4, 0.34, 0.15), "contact", "Contact, 4 portion", ["contact grill", "health grill", "panini", "george foreman"])
    grill("indoor_grill_air_fryer", "Indoor grill and air fryer", (0.4, 0.38, 0.3), "indoor", "Indoor grill with air fryer", ["indoor grill", "bbq", "air fryer", "ninja foodi grill"])
    grill("sandwich_toaster", "Sandwich toaster", (0.27, 0.25, 0.11), "sandwich", "Sandwich toaster", ["sandwich maker", "toastie", "toasted sandwich"])
    grill("waffle_maker", "Waffle maker", (0.27, 0.27, 0.12), "waffle", "Waffle maker", ["waffle iron", "waffles"])
    mini_oven()
    kettle("kettle_steel_1_7l", "Kettle, stainless steel, 1.7 L", "Stainless steel", STEEL, False)
    kettle("kettle_glass_1_7l", "Kettle, glass with light, 1.7 L", "Glass", GRAPHITE, True)
    toaster("toaster_2_slice_steel", "Toaster, 2 slice, stainless steel", (0.28, 0.17, 0.19), STEEL, "2 slice, steel", 1)
    toaster("toaster_2_slice_cream", "Toaster, 2 slice, cream", (0.28, 0.17, 0.19), CREAM, "2 slice, cream", 1)

    # chopping boards: three woods or plastics in three sizes, plus the odd shapes
    for label, key, col in (("wood", "wood", "#b88a55"), ("bamboo", "bamboo", "#d3b87a"), ("white plastic", "plastic", "#f3f3ef")):
        for sz, dims in (("small", (0.3, 0.2, 0.02)), ("medium", (0.4, 0.28, 0.02)), ("large", (0.5, 0.35, 0.03))):
            board(f"chopping_board_{key}_{sz}", f"Chopping board, {label}, {sz}", dims, col, f"{sz.capitalize()} {round(dims[0] * 100)}×{round(dims[1] * 100)}", f"chopping_board_{key}", [label], "plastic" if key == "plastic" else "rect")
    board("chopping_board_round_30", "Chopping board, round, 30 cm", (0.3, 0.3, 0.02), "#a87a48", "Round 30 cm", "chopping_board_round", ["round", "serving board"], "round")
    board("butcher_block_45", "Butcher block, 45 × 35 cm", (0.45, 0.35, 0.05), "#9b6b3a", "Butcher block", "butcher_block", ["butchers block", "thick"])
    board("serving_paddle_board", "Serving paddle board, 50 cm", (0.5, 0.2, 0.02), "#b88a55", "Paddle", "serving_board", ["paddle", "pizza peel", "cheese board"], "paddle")
    board("glass_worktop_saver", "Glass worktop saver, 38 × 28 cm", (0.38, 0.28, 0.01), "#bfe0e6", "Glass", "glass_board", ["glass board", "worktop saver", "trivet"])

    knife_block("knife_block_wood", "Knife block, wood", (0.11, 0.23, 0.3), "wood", "slot", "Wood")
    knife_block("knife_block_black", "Knife block, black", (0.11, 0.23, 0.3), BLACK, "slot", "Black")
    knife_block("knife_block_universal", "Knife block, universal (bristles)", (0.11, 0.11, 0.24), "wood", "universal", "Universal")
    magnetic_strip()

    utensil_pot("utensil_pot_ceramic", "Utensil pot, ceramic, with utensils", "#f2efe6", "Ceramic")
    utensil_pot("utensil_pot_steel", "Utensil pot, stainless steel, with utensils", STEEL, "Steel", (0.12, 0.12, 0.3))
    utensil_pot("utensil_pot_wood", "Utensil pot, wood, with utensils", "#a87a48", "Wood", (0.14, 0.14, 0.32))
    utensil_pot("utensil_pot_black", "Utensil pot, black, with utensils", BLACK, "Black")

    bread_bin("bread_bin_roll_top_steel", "Bread bin, roll top, stainless steel", (0.39, 0.27, 0.19), STEEL, "roll", "Roll top, steel")
    bread_bin("bread_bin_roll_top_cream", "Bread bin, roll top, cream", (0.39, 0.27, 0.19), CREAM, "roll", "Roll top, cream")
    bread_bin("bread_bin_bamboo", "Bread bin, bamboo", (0.38, 0.25, 0.19), "#d3b87a", "box", "Bamboo")
    bread_bin("bread_bin_enamel", "Bread bin, enamel", (0.37, 0.24, 0.2), "#f3f3ef", "enamel", "Enamel")

    fruit("fruit_basket_wire", "Fruit basket, wire, with fruit", (0.3, 0.3, 0.16), "basket", "Wire basket")
    fruit("fruit_stand_2_tier", "Fruit stand, 2 tier, with fruit", (0.28, 0.28, 0.38), "tiers", "2 tier")
    fruit("banana_stand", "Banana stand with bananas", (0.2, 0.2, 0.36), "banana", "Banana stand")

    spice_rack("spice_rack_countertop", "Spice rack, 3 tier, countertop", (0.36, 0.14, 0.2), "steps", "3 tier countertop")
    spice_rack("spice_carousel", "Spice carousel, revolving", (0.24, 0.24, 0.27), "carousel", "Carousel")
    spice_rack("spice_rack_wall", "Spice rack, wall mounted", (0.4, 0.1, 0.45), "wall", "Wall mounted")
    canisters()
    roll_holder()
    tap("kitchen_tap_mixer", "Kitchen mixer tap", False, "Mixer")
    tap("kitchen_tap_pull_out", "Kitchen tap, pull-out spray", True, "Pull-out")

    # #279: 90 degree corner base unit with a sink on top, left- and right-hand
    for hand in ("left", "right"):
        for size, depth in ((1000, 1000), (1200, 1200), (1500, 1200)):
            corner_sink(size, depth, "inset", hand)
        for size, depth in ((1200, 1200), (1500, 1200)):
            corner_sink(size, depth, "belfast", hand)


def main() -> None:
    build()
    add_items(PACK, items, RELEASE, NOTE)


if __name__ == "__main__":
    main()
