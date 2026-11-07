"""Add the trophies collection (#280) to the bundled pack amluto.decor.

    python tools/gen_trophies.py

Cups, figures, balls, crystal awards, shields, wall plaques, medals on stands and a podium, each in gold, silver and
bronze and in two or three sizes. Our own designs from simple shapes; the pack's other items are left alone.
"""

from __future__ import annotations

from pack_builder import Item, add_items

PACK = "amluto.decor"
RELEASE = 2
NOTE = "New: trophies (cups, figures, shields, crystal awards, plaques, medals on stands and a podium) in gold, silver and bronze."

METALS = {"gold": "#d4af37", "silver": "#c7cbd1", "bronze": "#b0763a"}
BASE = "#2a2420"
items: list[Item] = []


def add(it: Item, family: str, variant: str, metal: str, tags: list[str], **extra) -> None:
    it.meta = {
        "room": ["living", "office", "hall", "study", "games", "dining"],
        "tags": [t for t in ["trophy", "award", "prize", metal, *tags] if len(t) <= 30][:12],
        "family": family,
        "variant": {"en": variant},
        "mount": "surface",
        **extra,
    }
    items.append(it)


def lathe(it: Item, cx, cz, w, d, y, h, color, profile, **kw) -> None:
    it.p("lathe", cx, cz, w, d, y, h, color, profile=profile, **kw)


def stand(it: Item, h: float) -> float:
    """A two-step base with a small plate; returns the height it reaches."""
    W, D = it.W, it.D
    it.box(0, 0, W, D, 0, h * 0.55, BASE, fix="h")
    it.box(0, 0, W * 0.8, D * 0.8, h * 0.55, h * 0.45, "#3a312b", fix="h")
    it.box(0, D * 0.5 + 0.001, W * 0.4, 0.004, h * 0.2, h * 0.3, "#d4af37", fix="wdh")
    return h


def cup(size: str, W: float, H: float, metal: str) -> None:
    c = METALS[metal]
    it = Item(f"trophy_cup_{metal}_{size}", f"Trophy cup, {metal}, {size}", (W, W, H), "deco")
    b = H * 0.14
    stand(it, b)
    lathe(it, 0, 0, W * 0.3, W * 0.3, b, H * 0.28, c, [[0.6, 0], [1, 0], [0.4, 0.5], [0.3, 1], [0, 1]])
    lathe(it, 0, 0, W * 0.62, W * 0.62, b + H * 0.26, H * 0.5, c, [[0, 0], [0.4, 0], [0.8, 0.35], [1, 1], [0.9, 1], [0.75, 0.5], [0, 0.4]])
    lathe(it, 0, 0, W * 0.5, W * 0.5, b + H * 0.74, H * 0.26 - b, c, [[0, 0], [1, 0], [0.7, 0.6], [0.15, 0.9], [0, 1]])
    for sx in (-1, 1):
        it.box(sx * W * 0.4, 0, W * 0.05, W * 0.05, b + H * 0.5, H * 0.16, c, fix="wd")
        it.box(sx * W * 0.34, 0, W * 0.12, W * 0.05, b + H * 0.62, H * 0.04, c, fix="wd")
        it.box(sx * W * 0.34, 0, W * 0.12, W * 0.05, b + H * 0.48, H * 0.04, c, fix="wd")
    it.circle_symbol()
    add(it, f"trophy_cup_{metal}", size.capitalize(), metal, ["cup", "champion", "winner", "loving cup"])


def figure(size: str, W: float, H: float, metal: str) -> None:
    c = METALS[metal]
    it = Item(f"trophy_figure_{metal}_{size}", f"Trophy figure, {metal}, {size}", (W, W, H), "deco")
    b = H * 0.22
    stand(it, b)
    fh = H - b
    lathe(it, 0, 0, W * 0.38, W * 0.26, b, fh * 0.55, c, [[0.7, 0], [1, 0], [0.9, 0.5], [0.6, 1], [0, 1]])
    it.sphere(0, 0, W * 0.18, W * 0.18, b + fh * 0.57, fh * 0.17, c, fix="wd")
    for sx in (-1, 1):
        it.box(sx * W * 0.2, 0, W * 0.07, W * 0.07, b + fh * 0.5, fh * 0.42, c, fix="wd")
    it.sphere(0, 0, W * 0.4, W * 0.4, b + fh * 0.84, fh * 0.16, c, fix="wd")
    it.circle_symbol()
    add(it, f"trophy_figure_{metal}", size.capitalize(), metal, ["figure", "statuette", "victory", "champion"])


def ball(size: str, W: float, H: float, metal: str) -> None:
    c = METALS[metal]
    it = Item(f"trophy_ball_{metal}_{size}", f"Trophy ball on stand, {metal}, {size}", (W, W, H), "deco")
    b = H * 0.3
    stand(it, b)
    it.cyl(0, 0, W * 0.5, W * 0.5, b, H * 0.06, c, fix="wd")
    it.sphere(0, 0, W * 0.8, W * 0.8, b + H * 0.05, H - b - H * 0.05, c, fix="wd")
    it.circle_symbol()
    add(it, f"trophy_ball_{metal}", size.capitalize(), metal, ["ball", "football", "sports", "globe"])


def crystal(size: str, W: float, H: float, metal: str) -> None:
    c = METALS[metal]
    it = Item(f"trophy_crystal_{metal}_{size}", f"Crystal award, {metal} base, {size}", (W, W * 0.5, H), "deco")
    D = it.D
    it.box(0, 0, W * 0.8, D, 0, H * 0.1, c, fix="h")
    it.p("loft", 0, 0, W * 0.7, D * 0.7, H * 0.1, H * 0.9, "glass", tx=0, tz=0, tw=W * 0.3, td=D * 0.3, edges="faint")
    it.box(0, D * 0.36, W * 0.4, 0.004, H * 0.2, H * 0.05, c, fix="wdh")
    it.rect_symbol()
    add(it, f"trophy_crystal_{metal}", size.capitalize(), metal, ["crystal", "glass award", "obelisk"])


def shield(size: str, W: float, H: float, metal: str) -> None:
    c = METALS[metal]
    it = Item(f"trophy_shield_{metal}_{size}", f"Trophy shield on stand, {metal}, {size}", (W, W * 0.25, H), "deco")
    D = it.D
    it.box(0, 0, W * 0.9, D, 0, H * 0.06, BASE, fix="h")
    it.box(0, 0, W * 0.8, D * 0.35, H * 0.06, H * 0.5, "wood", fix="d")
    it.p("loft", 0, 0, W * 0.8, D * 0.35, H * 0.56, H * 0.1, "wood", tx=0, tz=0, tw=W * 0.8, td=D * 0.35)
    it.p("loft", 0, D * 0.2, W * 0.66, D * 0.12, H * 0.35, H * 0.55, c, tx=0, tz=D * 0.2, tw=W * 0.56, td=D * 0.12)
    it.box(0, D * 0.27, W * 0.4, 0.004, H * 0.2, H * 0.1, "#f4f4f0", fix="wdh")
    it.rect_symbol()
    add(it, f"trophy_shield_{metal}", size.capitalize(), metal, ["shield", "crest", "plaque"])


def plaque(size: str, W: float, H: float, metal: str) -> None:
    c = METALS[metal]
    it = Item(f"trophy_plaque_{metal}_{size}", f"Wall trophy plaque, {metal}, {size}", (W, 0.02, H), "deco")
    D = it.D
    it.box(0, 0, W, D, 0, H, "wood", fix="d")
    it.box(0, D * 0.5, W * 0.8, 0.004, H * 0.14, H * 0.72, c, fix="d")
    for k in range(3):
        it.box(0, D * 0.5 + 0.004, W * (0.6 - 0.08 * k), 0.003, H * (0.62 - 0.17 * k), H * 0.06, "#2a2420", fix="d")
    it.rect_symbol()
    add(it, f"trophy_plaque_{metal}", size.capitalize(), metal, ["plaque", "wall plaque", "engraved"], mount="wall", wall_y=1.2)


def medal(metal: str) -> None:
    c = METALS[metal]
    it = Item(f"medal_stand_{metal}", f"Medal on stand, {metal}", (0.1, 0.1, 0.16), "deco")
    W, H = it.W, it.H
    it.cyl(0, 0, W, W, 0, H * 0.06, BASE, fix="wdh")
    it.box(0, -0.02, 0.012, 0.012, H * 0.06, H * 0.9, "wood", fix="wd")
    it.box(0, 0.0, 0.03, 0.004, H * 0.5, H * 0.45, "accent", fix="wdh")
    it.cyl(0, 0.01, 0.055, 0.055, H * 0.2, 0.008, c, axis="z", fix="wdh")
    it.circle_symbol()
    add(it, f"medal_stand_{metal}", "Single", metal, ["medal", "ribbon", "stand"])


def medal_display() -> None:
    it = Item("medal_display_stand_5", "Medal display stand, 5 medals", (0.3, 0.1, 0.32), "deco")
    W, D, H = it.W, it.D, it.H
    it.box(0, 0, W, D, 0, H * 0.06, BASE, fix="h")
    it.box(0, -D * 0.2, W * 0.92, 0.015, H * 0.06, H * 0.92, "wood", fix="d")
    it.box(0, -D * 0.1, W * 0.92, 0.01, H * 0.82, 0.012, "metal", fix="wdh")
    for i, m in enumerate(["gold", "silver", "bronze", "gold", "silver"]):
        x = -W * 0.38 + i * W * 0.19
        it.box(x, -D * 0.05, 0.03, 0.004, H * 0.45, H * 0.4, ["#c0392b", "#2c5aa0", "#f4f4f0"][i % 3], fix="wdh")
        it.cyl(x, -D * 0.04, 0.05, 0.05, H * 0.34, 0.008, METALS[m], axis="z", fix="wdh")
    it.rect_symbol()
    add(it, "medal_display", "5 medals", "gold", ["medals", "silver", "bronze", "medal rack", "display"])


def podium() -> None:
    it = Item("trophy_podium_3_step", "Winners podium, 3 step", (0.36, 0.12, 0.16), "deco")
    W, D, H = it.W, it.D, it.H
    for x, h, m in [(-W / 3, H * 0.65, "silver"), (0.0, H, "gold"), (W / 3, H * 0.45, "bronze")]:
        it.box(x, 0, W / 3, D, 0, h, "#e9e4d6", fix="wd")
        it.box(x, D * 0.5, W * 0.18, 0.004, h * 0.45, h * 0.3, METALS[m], fix="wdh")
    it.rect_symbol()
    add(it, "trophy_podium", "3 step", "gold", ["podium", "winners", "first second third", "silver", "bronze"])


def build() -> None:
    for m in METALS:
        for size, W, H in (("small", 0.12, 0.2), ("medium", 0.16, 0.3), ("large", 0.22, 0.42)):
            cup(size, W, H, m)
        for size, W, H in (("small", 0.1, 0.22), ("medium", 0.13, 0.32), ("large", 0.17, 0.46)):
            figure(size, W, H, m)
        for size, W, H in (("small", 0.1, 0.17), ("large", 0.15, 0.26)):
            ball(size, W, H, m)
        for size, W, H in (("small", 0.08, 0.2), ("large", 0.12, 0.3)):
            crystal(size, W, H, m)
        for size, W, H in (("small", 0.18, 0.22), ("large", 0.26, 0.3)):
            shield(size, W, H, m)
        for size, W, H in (("small", 0.15, 0.2), ("medium", 0.2, 0.25), ("large", 0.25, 0.3)):
            plaque(size, W, H, m)
        medal(m)
    medal_display()
    podium()


def main() -> None:
    build()
    add_items(PACK, items, RELEASE, NOTE)


if __name__ == "__main__":
    main()
