"""Writes the Nissan Leaf and its colourways (amluto.outdoor/vehicle/nissan_leaf*.json), #242, #252, #345.

    python tools/gen_leaf.py

The second-generation Leaf (ZE1, 2018 on) at 4490 x 1790 x 1540 mm, wheelbase 2700 mm: a rounded hatchback with a short
bonnet sloping down to the nose, a steeply raked windscreen, a high rear with a kick in the window line, black pillars
under a body-coloured roof (the "floating roof") ending in a spoiler, slim LED headlights swept back round the
corners to a blue-tinted V-motion grille, and at the back dark tailgate glass reaching down between boomerang tail
lights. The body, glasshouse and roof are curved shells (#252) traced from photos of the car; the lamps are strips of
turned lofts lying on the curved corners (#345); the rest are simple shapes. Modelled by us; no logos, no maker
images, no 3D files. The other cars come from tools/gen_vehicles.py.

The body, the body-coloured roof and the mirrors are in the colour role "paint" (#404) with the colourway's colour as
the item's own colour for it (`"colors": {"paint": …}`), so the item panel's car colours repaint every Leaf; a two-tone
roof keeps its own fixed colour. Windows are in the palette role "glass" and the lamps in the colours the viewer lights for a linked car (headlights
#e8f4ff, tail lights #ff3b4f): the car feature's lights and cabin glow show on it. Every part above the waist sits inside the
glasshouse or just proud of it, so nothing stands out of the body.
"""

from __future__ import annotations

import itertools
import json
import math
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent))
from gen_vehicles import OUT, Shell, V, arched, dump, wheel_wells

W, L, H = 1.79, 4.49, 1.54
HEAD = "#e8f4ff"
TAIL = "#ff3b4f"
CHROME = "#c9ced6"
GRILLE = "#1f3d63"

# id, variant name, body colour (the item's own "paint" colour), roof and mirror colour (None: the paint's)
COLOURWAYS = [
    ("nissan_leaf", "Pearl white", "#e9ebee", None),
    ("nissan_leaf_black", "Black", "#1d1e21", None),
    ("nissan_leaf_blue", "Vivid blue", "#1f4f8f", None),
    ("nissan_leaf_grey", "Grey", "#6f757b", None),
    ("nissan_leaf_red", "Flame red", "#a51c2c", None),
    ("nissan_leaf_red_black_roof", "Red, black roof", "#a51c2c", "#1d1e21"),
]

FRONT, REAR = L / 2, -L / 2
FRONT_AXLE = FRONT - 0.95
REAR_AXLE = FRONT_AXLE - 2.70
WHEEL, TYRE = 0.65, 0.215

# The body (#252): curved shells lofted through side-view stations (z, bottom, top) and plan-view half widths (z, half
# width), in metres, rear (-z) to front (+z). Traced from photos of a 2018-on Leaf: a flat tail, a waist that rises
# to the rear, a short bonnet that rounds down to the nose, a long raked windscreen, a roof that falls gently to an
# upright hatch, and the glasshouse narrowing to the rear (tumblehome).
BODY_SIDE = [
    (REAR, 0.30, 0.88),
    (-2.18, 0.20, 0.95),
    (-1.95, 0.17, 1.045),
    (-1.0, 0.17, 1.02),
    (0.0, 0.17, 0.99),
    (0.85, 0.17, 0.965),
    (1.40, 0.18, 0.90),
    (1.85, 0.20, 0.85),
    (2.10, 0.24, 0.79),
    (FRONT, 0.33, 0.66),
]
BODY_PLAN = [(REAR, 0.76), (-2.10, 0.855), (-1.60, 0.885), (-0.60, 0.87), (0.60, 0.875), (1.30, 0.88), (1.90, 0.84), (2.15, 0.78), (FRONT, 0.70)]
BODY_ROUND, BODY_TAPER = 0.28, 0.93
# the glasshouse, its top under the roof
GLASS_SIDE = [
    (-2.235, 0.86, 0.92),
    (-2.15, 0.93, 1.08),
    (-1.95, 1.0, 1.24),
    (-1.72, 0.995, 1.38),
    (-1.45, 0.99, 1.455),
    (-0.90, 0.975, 1.50),
    (-0.30, 0.965, 1.505),
    (0.10, 0.96, 1.47),
    (0.45, 0.955, 1.30),
    (0.95, 0.945, 0.965),
]
GLASS_PLAN = [(-2.235, 0.62), (-2.15, 0.70), (-1.80, 0.80), (-1.20, 0.83), (0.30, 0.83), (0.95, 0.80)]
GLASS_ROUND, GLASS_TAPER = 0.3, 0.8
# the floating roof over it
ROOF_SIDE = [
    (-1.92, 1.25, 1.30),
    (-1.80, 1.31, 1.38),
    (-1.66, 1.40, 1.45),
    (-1.40, 1.445, 1.495),
    (-0.90, 1.475, 1.53),
    (-0.30, 1.48, 1.54),
    (0.05, 1.46, 1.515),
    (0.14, 1.44, 1.47),
]
ROOF_PLAN = [(-1.92, 0.54), (-1.80, 0.60), (-1.50, 0.655), (-0.60, 0.675), (0.14, 0.665)]
GLASS = Shell(GLASS_SIDE, GLASS_PLAN, GLASS_ROUND, GLASS_TAPER)


def pillar_band(v: V, za: float, zb: float) -> None:
    """A black pillar across the glasshouse from za to zb, standing just proud of the glass (the roof hides its top)."""
    grow = 0.012
    side, plan = GLASS.band(za, zb, grow, below=0.035)
    zm = (za + zb) / 2
    hw = GLASS.width(zm)
    height = GLASS.top(zm) - GLASS.bottom(zm)
    r = GLASS_ROUND * min(2 * hw, height)
    band_h = side[1][2] - side[1][1]
    v.shell(side, plan, "dark", round=round(min(0.5, (r + grow) / min(2 * (hw + grow), band_h)), 3), taper=GLASS_TAPER)


def strip(
    v: V, sx: int, pts: list[tuple[float, float]], y: float, h: float, thick: float, color: str, top_in: float = 0.0
) -> None:
    """A lamp as a strip along a line of plan points (x on the right side, z), one turned loft per segment, `thick`
    deep, its top `top_in` metres further in (lying back on the curved body); sx -1 mirrors it to the left side."""
    for (xa, za), (xb, zb) in itertools.pairwise(pts):
        length = math.hypot(xb - xa, zb - za)
        # turned to run along the segment; the top moves in towards the middle of the car (front or back)
        rot = round(sx * math.degrees(math.atan2(zb - za, xb - xa)), 2)
        inward = -1 if za > 0 else 1
        cx, cz = sx * (xa + xb) / 2, (za + zb) / 2
        tz, td = cz + inward * top_in, thick - top_in
        v.add("loft", cx, cz, length + 0.01, thick, y, h, color, tx=cx, tz=tz, tw=length, td=td, rot=rot)

def leaf(body: str, roof: str, mirror: str) -> list[dict]:
    v = V(W, L, H)
    # wheels and rims
    for sx in (-1, 1):
        for z in (FRONT_AXLE, REAR_AXLE):
            v.wheel(sx * (W / 2 - TYRE / 2 - 0.005), z, WHEEL, TYRE)
            v.add("cyl", sx * (W / 2 - 0.009), z, 0.014, 0.44, (WHEEL - 0.44) / 2, 0.44, "metal", axis="x")
    v.shell(arched(BODY_SIDE, [REAR_AXLE, FRONT_AXLE], WHEEL), BODY_PLAN, body, round=BODY_ROUND, taper=BODY_TAPER)
    wheel_wells(v, [REAR_AXLE, FRONT_AXLE], WHEEL, W - 2 * TYRE - 0.06, 0.17)
    v.shell(GLASS_SIDE, GLASS_PLAN, "glass", round=GLASS_ROUND, taper=GLASS_TAPER)
    v.shell(ROOF_SIDE, ROOF_PLAN, roof, round=0.45, taper=0.95)
    # black pillars: B, and the wide C pillar that lets the roof float
    pillar_band(v, -0.40, -0.31)
    pillar_band(v, -1.62, -1.25)
    # A pillars along the windscreen's edges, from the waist to the roof, just proud of the glass
    for sx in (-1, 1):
        za, ya = 0.86, GLASS.bottom(0.86) + 0.03
        zb, yb = 0.10, 1.45
        xa, xb = GLASS.half_width(za, ya) + 0.004, GLASS.half_width(zb, yb) + 0.004
        v.loft(sx * (xa - 0.02), za, 0.04, 0.10, ya, yb - ya, "dark", tcx=sx * (xb - 0.02), tcz=zb, td=0.08)
    # door mirrors on the door, just behind the A pillar
    for sx in (-1, 1):
        v.rbox(sx * (W / 2 - 0.07), 0.80, 0.13, 0.09, 0.93, 0.10, mirror, round=0.4)
    # slim LED headlights along the top of the nose, swept back round the corners into the wings; their inner ends
    # meet the top of the V-motion grille
    for sx in (-1, 1):
        housing = [(0.29, 2.246), (0.52, 2.232), (0.66, 2.172), (0.745, 2.06)]
        strip(v, sx, housing, 0.60, 0.13, 0.05, "dark", top_in=0.02)
        led = [(0.31, 2.250), (0.52, 2.238), (0.665, 2.177), (0.75, 2.065)]
        strip(v, sx, led, 0.655, 0.055, 0.05, HEAD, top_in=0.01)
    # V-motion grille: a blue-tinted panel (the charging lid) narrowing downwards, a chrome V round it
    v.loft(0, FRONT - 0.005, 0.22, 0.03, 0.36, 0.26, GRILLE, tw=0.58)
    for sx in (-1, 1):
        v.loft(sx * 0.125, FRONT - 0.003, 0.035, 0.026, 0.34, 0.28, CHROME, tcx=sx * 0.31)
    # front plate on the bumper, a wide dark intake below it
    v.box(0, FRONT + 0.0, 0.52, 0.016, 0.24, 0.10, "white")
    v.box(0, FRONT - 0.04, 1.24, 0.08, 0.19, 0.10, "dark")
    # boomerang tail lights: an arm along the bottom of the tailgate glass wrapping round the corner into the side,
    # and a leg down the corner
    for sx in (-1, 1):
        arm = [(0.40, -2.246), (0.64, -2.244), (0.76, -2.15), (0.80, -2.00)]
        strip(v, sx, arm, 0.835, 0.065, 0.05, TAIL, top_in=0.015)
        strip(v, sx, [(0.64, -2.244), (0.735, -2.21), (0.79, -2.15)], 0.71, 0.13, 0.05, TAIL, top_in=0.03)
    # a dark interior behind the glass: in the realistic look the glass is see-through and shows it
    v.box(0, -0.62, 1.30, 2.30, 0.95, 0.24, "dark")
    # rear plate on the tailgate, dark diffuser below the bumper
    v.box(0, REAR + 0.0, 0.52, 0.016, 0.62, 0.10, "#e9c645")
    v.box(0, REAR + 0.03, 1.40, 0.08, 0.19, 0.14, "dark")
    # dark sills between the wheels
    for sx in (-1, 1):
        v.box(sx * 0.845, (FRONT_AXLE + REAR_AXLE) / 2, 0.03, FRONT_AXLE - REAR_AXLE - WHEEL - 0.1, 0.17, 0.08, "dark")
    return v.parts


def symbol() -> list[dict]:
    r = lambda v: round(v + 0.0, 4)  # noqa: E731
    return [
        {"shape": "rect", "x": 0.0, "z": 0.0, "w": r(1.76 / W), "d": 0.99},
        {"shape": "line", "x1": r(-0.8 / W), "z1": r(0.95 / L), "x2": r(0.8 / W), "z2": r(0.95 / L)},
        {"shape": "line", "x1": r(-0.7 / W), "z1": r(-2.02 / L), "x2": r(0.7 / W), "z2": r(-2.02 / L)},
    ]


def main() -> None:
    for ident, variant, body, roof in COLOURWAYS:
        v = V(W, L, H)
        # the body is painted (#404); a two-tone roof and its mirrors keep their own colour
        v.parts = leaf("paint", roof or "paint", roof or "paint")
        item = {
            "id": ident,
            "name": {"en": "Nissan Leaf"},
            "size": [W, L, H],
            "group": "vehicle",
            "room": ["garage"],
            "tags": [
                "electric car",
                "ev",
                "car",
                "hatchback",
                "nissan",
                "leaf",
                "electric vehicle",
                "charging",
                "plug-in",
            ],
            "family": "nissan_leaf",
            "variant": {"en": variant},
            "electric": True,
            "vehicle": True,
            "colors": {"paint": body},
            "parts": v.parts,
        }
        assert len(item["parts"]) <= 60, len(item["parts"])
        text = dump(item)
        # the symbol goes after the parts, like the hand-made items
        text = (
            text.rstrip()[:-1].rstrip()
            + ',\n  "symbol": [\n'
            + ",\n".join("    " + json.dumps(s, separators=(", ", ": ")) for s in symbol())
            + "\n  ]\n}\n"
        )
        (OUT / f"{ident}.json").write_text(text, encoding="utf-8", newline="\n")
    print(f"{len(COLOURWAYS)} Leaf colourways written")


if __name__ == "__main__":
    main()
