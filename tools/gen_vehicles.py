"""Writes the vehicles of the catalogue (#129) into amluto.outdoor/vehicle and the checklist docs/vehicles.md.

    python tools/gen_vehicles.py

The cars come from tools/vehicles_data.py (brand, model, body type and the real L x W x H) and are built from a few
body shapes (hatchback, saloon, estate, SUV, MPV, pickup, coupe, van) scaled to those sizes, 20 to 30 parts each,
with the body in the `paint` colour role so the item panel's paint picker works. Since #252 the lower body, the
glasshouse and the roof are curved shells (the `shell` part shape); the vans stay boxes, which they are anyway. Bikes, motorbikes, snowmobiles,
golf carts and the like are built here too, from simple shapes. No logos, no maker images, no 3D files.
Existing hand-made vehicles in the folder (the first bikes) are left alone; the Leaf comes from tools/gen_leaf.py.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from vehicles_data import BRANDS, CHECKS, car_id  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "custom_components" / "home_3d" / "bundled_packs" / "amluto.outdoor" / "vehicle"
DOC = ROOT / "docs" / "vehicles.md"
ROOMS = ["garage", "garden"]


def r4(v: float) -> float:
    return round(v + 0.0, 4)


class V:
    """A vehicle of size W x L x H metres; parts are given in metres, centred on x and z, y from the ground."""

    def __init__(self, w: float, length: float, h: float) -> None:
        self.W, self.L, self.H = w, length, h
        self.parts: list[dict] = []

    def add(self, shape: str, cx: float, cz: float, w: float, d: float, y: float, h: float, color: str, **kw) -> None:
        W, L, H = self.W, self.L, self.H
        part = {
            "shape": shape,
            "x": r4(max(-0.5, min(0.5, cx / W))),
            "z": r4(max(-0.5, min(0.5, cz / L))),
            "w": r4(max(0.001, min(1, w / W))),
            "d": r4(max(0.001, min(1, d / L))),
            "y": r4(max(0, min(1, y / H))),
            "h": r4(max(0.001, min(1, h / H))),
            "color": color,
        }
        for key, val in kw.items():
            if key in ("tx", "tw"):
                part[key] = r4(val / W)
            elif key in ("tz", "td"):
                part[key] = r4(val / L)
            else:
                part[key] = val
        self.parts.append(part)

    def box(self, *a, **k) -> None:
        self.add("box", *a, **k)

    def rbox(self, *a, round: float = 0.3, **k) -> None:  # noqa: A002
        self.add("rbox", *a, round=round, **k)

    def loft(self, cx, cz, w, d, y, h, color, tcx=None, tcz=None, tw=None, td=None) -> None:
        self.add("loft", cx, cz, w, d, y, h, color, tx=cx if tcx is None else tcx, tz=cz if tcz is None else tcz, tw=w if tw is None else tw, td=d if td is None else td)

    def shell(
        self,
        side: list[tuple[float, float, float]],
        plan: list[tuple[float, float]],
        color: str,
        round: float | None = None,  # noqa: A002
        taper: float | None = None,
        cx: float = 0.0,
    ) -> dict:
        """A curved shell (#252) written in metres: side stations (z, bottom, top) from the back to the front, plan
        points (z, half width); the part's box is what they span. Returns the part (fractions, as stored)."""
        z0, z1 = side[0][0], side[-1][0]
        y0 = min(b for _z, b, _t in side)
        y1 = max(t for _z, _b, t in side)
        half = max(hw for _z, hw in plan)
        dz, dy = z1 - z0, y1 - y0
        part_side = [[r4((z - z0) / dz), r4((b - y0) / dy), r4((t - y0) / dy)] for z, b, t in side]
        part_plan = [[r4(min(1, max(0, (z - z0) / dz))), r4(hw / half)] for z, hw in plan]
        kw: dict = {"side": part_side, "plan": part_plan}
        if round is not None:
            kw["round"] = round
        if taper is not None:
            kw["taper"] = taper
        self.add("shell", cx, (z0 + z1) / 2, 2 * half, dz, y0, dy, color, **kw)
        return self.parts[-1]

    def wheel(self, cx: float, cz: float, dia: float, width: float, y: float = 0.0, color: str = "dark") -> None:
        self.add("cyl", cx, cz, width, dia, y, dia, color, axis="x")

    def bar(self, z0: float, y0: float, z1: float, y1: float, t: float = 0.03, w: float = 0.03, color: str = "paint", cx: float = 0.0) -> None:
        """A tube from (z0, y0) to (z1, y1) in side view."""
        if y1 < y0:
            z0, y0, z1, y1 = z1, y1, z0, y0
        if abs(z1 - z0) < 0.01:
            self.box(cx, z0, w, t, y0, y1 - y0, color)
        elif y1 - y0 < 0.01:
            self.box(cx, (z0 + z1) / 2, w, abs(z1 - z0) + t, y0, t, color)
        else:
            self.loft(cx, z0, w, t, y0, y1 - y0, color, tcz=z1)

    def item(self, ident: str, name: str, tags: list[str], electric: bool = False) -> dict:
        item = {
            "id": ident,
            "name": {"en": name},
            "size": [r4(self.W), r4(self.L), r4(self.H)],
            "group": "vehicle",
            "room": ROOMS,
            "tags": tags[:12],
            "vehicle": True,
        }
        if electric:
            item["electric"] = True
        item["parts"] = self.parts
        return item


# ------------------------------------------------------------------------------------------------- shell curves


def monotone(points: list[tuple[float, float]]):
    """The curve frontend/src/viewer/shell.ts draws through a shell's stations (monotone cubic, level beyond the
    ends), so parts can be placed on a shell's surface (pillars on the glass)."""
    pts: list[list[float]] = []
    for x, y in points:
        if pts and x <= pts[-1][0] + 1e-6:
            pts[-1] = [max(x, pts[-1][0]), y]
        else:
            pts.append([x, y])
    n = len(pts)
    if n == 1:
        return lambda x: pts[0][1]
    delta = [(pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]) for i in range(n - 1)]
    m = [delta[0]] + [0.0 if delta[i - 1] * delta[i] <= 0 else (delta[i - 1] + delta[i]) / 2 for i in range(1, n - 1)] + [delta[-1]]
    for i in range(n - 1):
        if delta[i] == 0:
            m[i] = m[i + 1] = 0.0
            continue
        a, b = m[i] / delta[i], m[i + 1] / delta[i]
        if a * a + b * b > 9:
            t = 3 / (a * a + b * b) ** 0.5
            m[i], m[i + 1] = t * a * delta[i], t * b * delta[i]

    def f(x: float) -> float:
        if x <= pts[0][0]:
            return pts[0][1]
        if x >= pts[-1][0]:
            return pts[-1][1]
        i = 0
        while i + 2 < n and x > pts[i + 1][0]:
            i += 1
        h = pts[i + 1][0] - pts[i][0]
        t = (x - pts[i][0]) / h
        return (2 * t**3 - 3 * t**2 + 1) * pts[i][1] + (t**3 - 2 * t**2 + t) * h * m[i] + (-2 * t**3 + 3 * t**2) * pts[i + 1][1] + (t**3 - t**2) * h * m[i + 1]

    return f


class Shell:
    """A shell written in metres (as V.shell takes it), to ask where its surface is."""

    def __init__(self, side: list[tuple[float, float, float]], plan: list[tuple[float, float]], round: float = 0.25, taper: float = 1.0) -> None:  # noqa: A002
        self.side, self.plan, self.round, self.taper = side, plan, round, taper
        self.bottom = monotone([(z, b) for z, b, _t in side])
        self.top = monotone([(z, t) for z, _b, t in side])
        self.width = monotone(plan)

    def half_width(self, z: float, y: float) -> float:
        """Half width (m) of the cross-section at z (m) and height y (m), on the outline the 3D view draws (each
        corner 2 straight segments, shell.ts section on "full")."""
        import math

        yb, yt, hw = self.bottom(z), max(self.bottom(z), self.top(z)), self.width(z)
        r = min(hw, (yt - yb) / 2, self.round * min(2 * hw, yt - yb))
        lo, hi = (1 / self.taper, 1.0) if self.taper > 1 else (1.0, self.taper)
        pts = []
        for cx, cy, a0 in ((hw - r, yb + r, -90), (hw - r, yt - r, 0), (-hw + r, yt - r, 90), (-hw + r, yb + r, 180)):
            for k in range(3):
                ang = math.radians(a0 + k * 45)
                py = cy + math.sin(ang) * r
                t = (py - yb) / (yt - yb) if yt - yb > 1e-9 else 0.0
                pts.append(((cx + math.cos(ang) * r) * (lo + (hi - lo) * t), py))
        y = min(yt, max(yb, y))
        reach = 0.0
        for i, (ax, ay) in enumerate(pts):
            bx, by = pts[(i + 1) % len(pts)]
            if (ay - y) * (by - y) > 0 or ay == by:
                continue
            reach = max(reach, abs(ax + (bx - ax) * (y - ay) / (by - ay)))
        return reach

    def band(self, za: float, zb: float, grow: float, below: float = 0.0, n: int = 3) -> tuple[list[tuple[float, float, float]], list[tuple[float, float]]]:
        """Side and plan of a slice of this shell from za to zb, `grow` metres larger all round and `below` metres
        shorter at the bottom (a pillar standing on the glass)."""
        zs = [za + (zb - za) * i / (n - 1) for i in range(n)]
        side = [(z, self.bottom(z) + below, self.top(z) + grow) for z in zs]
        plan = [(z, self.width(z) + grow) for z in zs]
        return side, plan


def arched(side: list[tuple[float, float, float]], axles: list[float], dia: float) -> list[tuple[float, float, float]]:
    """A body's side stations with a wheel arch over each axle (run 6: without arches the body hid the tyres down to
    its sill and the car looked sunk into the ground). The bottom rises from the sill 1.25 tyre radii before the axle
    to 3 cm over the tyre above it and back down; stations inside an arch keep their top and get the raised bottom."""
    shell = Shell(side, [(side[0][0], 1.0), (side[-1][0], 1.0)])
    reach, peak = 0.625 * dia, dia + 0.03

    def lift(z: float) -> float:
        for a in axles:
            t = 1 - abs(z - a) / reach
            if t > 0:
                top = min(peak, shell.top(z) - 0.15)  # a low nose keeps 15 cm of body over its arch
                return shell.bottom(z) + max(0.0, top - shell.bottom(z)) * (3 * t * t - 2 * t**3)
        return 0.0

    out = {round(z, 4): (z, max(b, lift(z)), t) for z, b, t in side}
    for a in axles:
        for z in (a - reach, a, a + reach):
            out.setdefault(round(z, 4), (z, max(shell.bottom(z), lift(z)), shell.top(z)))
    stations = [out[k] for k in sorted(out)]
    assert len(stations) <= 16, len(stations)
    return stations


def wheel_wells(v: V, axles: list[float], dia: float, inner: float, y0: float) -> None:
    """Dark wheel wells between a pair of wheels: what shows through an arch above the tyre (and under the car)."""
    for a in axles:
        v.box(0, a, inner, 1.1 * dia, y0, dia + 0.02 - y0, "dark")


# ---------------------------------------------------------------------------------------------------------- cars

# gc: ground clearance (m); belt: where the windows start (fraction of the height); wheel/tyre in m; wb: wheelbase as
# a fraction of the length; gh: greenhouse z fractions (rear bottom, rear top, front top, front bottom), rear to front.
BODY = {
    "hatch": dict(gc=0.14, belt=0.56, wheel=0.64, tyre=0.21, wb=0.64, gh=(0.10, 0.20, 0.52, 0.68), deck=(0.05, 0.03)),
    "saloon": dict(gc=0.13, belt=0.58, wheel=0.68, tyre=0.22, wb=0.60, gh=(0.27, 0.33, 0.55, 0.70), deck=(0.07, 0.07)),
    "estate": dict(gc=0.14, belt=0.57, wheel=0.67, tyre=0.22, wb=0.60, gh=(0.04, 0.07, 0.50, 0.67), deck=(0.05, 0.02), rails=True),
    "suv": dict(gc=0.20, belt=0.61, wheel=0.75, tyre=0.24, wb=0.60, gh=(0.07, 0.11, 0.52, 0.68), deck=(0.05, 0.03), rails=True, cladding=True),
    "mpv": dict(gc=0.16, belt=0.55, wheel=0.66, tyre=0.21, wb=0.62, gh=(0.04, 0.06, 0.57, 0.75), deck=(0.05, 0.02)),
    "coupe": dict(gc=0.11, belt=0.56, wheel=0.66, tyre=0.24, wb=0.60, gh=(0.20, 0.33, 0.50, 0.66), deck=(0.06, 0.05)),
    "pickup": dict(gc=0.24, belt=0.60, wheel=0.80, tyre=0.26, wb=0.58, gh=(0.36, 0.40, 0.64, 0.76), cladding=True),
    "van": dict(gc=0.18, belt=0.50, wheel=0.68, tyre=0.22, wb=0.60),
}
BODY_WORDS = {"hatch": "hatchback", "saloon": "saloon", "estate": "estate", "suv": "suv", "mpv": "mpv", "coupe": "coupe", "pickup": "pickup truck", "van": "van"}


def car(brand_id: str, brand: str, model: str, body: str, length_mm: int, width_mm: int, height_mm: int, ev: bool) -> dict:
    L, W, H = length_mm / 1000, width_mm / 1000, height_mm / 1000
    p = BODY[body]
    v = V(W, L, H)
    gc, belt = p["gc"], p["belt"] * H
    dia = min(p["wheel"], H * 0.5)
    tyre = p["tyre"]
    body_w = W * 0.96
    zc = lambda f: (f - 0.5) * L  # noqa: E731  z of a fraction of the length (rear 0, front 1)
    front_axle = zc(1 - (1 - p["wb"]) * 0.45)
    rear_axle = zc((1 - p["wb"]) * 0.55)
    for sx in (-1, 1):
        for z in (front_axle, rear_axle):
            v.wheel(sx * (W / 2 - tyre / 2 - 0.01), z, dia, tyre)
            v.add("cyl", sx * (W / 2 - 0.007), z, 0.014, dia * 0.62, dia * 0.19, dia * 0.62, "metal", axis="x")
    if body == "van":
        top = H * 0.97
        v.rbox(0, zc(0.39), body_w, L * 0.78, gc, top - gc, "paint", round=0.15)
        v.rbox(0, zc(0.85), body_w, L * 0.3, gc, belt - gc, "paint", round=0.3)
        v.loft(0, zc(0.81), body_w * 0.9, L * 0.14, belt, top - belt, "glass", tcz=zc(0.77), td=L * 0.06)
        for sx in (-1, 1):
            v.box(sx * body_w * 0.485, zc(0.72), 0.02, L * 0.1, belt + 0.06 * H, 0.26 * H, "glass")
    else:
        # curved shells (#252): the lower body, the glasshouse on it and the roof over that, lofted through stations
        # along the length (fractions rear 0 .. front 1 of the gh and deck points above)
        rzr0, rzr1, fzf1, fzf0 = p["gh"]
        roof_t = 0.045
        rails = 0.025 if p.get("rails") else 0.0
        roof_y = H - rails - roof_t
        dh, _dtop = p.get("deck", (0.0, 0.0))
        deck = belt + dh * H
        half = body_w / 2
        lower = Shell(
            [
                (zc(0), gc + 0.1, max(belt - 0.04, deck - 0.03)),
                (zc(0.04), gc, deck),
                (zc(max(0.05, rzr0)), gc, max(belt, deck - 0.01)),
                (zc(0.5), gc, belt),
                (zc(fzf0), gc, belt - 0.01),
                (zc((fzf0 + 1) / 2), gc + 0.01, belt - 0.05 * H),
                (zc(0.965), gc + 0.03, belt - 0.11 * H),
                (zc(1), gc + 0.1, belt - 0.2 * H),
            ],
            [(zc(0), half * 0.86), (zc(0.06), half * 0.97), (zc(0.3), half), (zc(0.75), half), (zc(0.94), half * 0.95), (zc(1), half * 0.8)],
            0.25,
            0.94,
        )
        v.shell(arched(lower.side, [rear_axle, front_axle], dia), lower.plan, "paint", round=lower.round, taper=lower.taper)
        wheel_wells(v, [rear_axle, front_axle], dia, W - 2 * tyre - 0.06, gc)
        gw = body_w * 0.45
        glass = Shell(
            [
                (zc(rzr0), belt - 0.02, belt + 0.02),
                (zc(rzr1), belt - 0.02, roof_y),
                (zc(fzf1), belt - 0.03, roof_y),
                (zc(fzf0), belt - 0.03, belt + 0.01),
            ],
            [(zc(rzr0), gw * 0.9), (zc((rzr0 + rzr1) / 2 + 0.03), gw), (zc(fzf1), gw), (zc(fzf0), gw * 0.96)],
            0.3,
            0.82,
        )
        v.shell(glass.side, glass.plan, "glass", round=glass.round, taper=glass.taper)
        rw = glass.half_width(zc((rzr1 + fzf1) / 2), roof_y) + 0.01
        rz0, rz1 = zc(rzr1) - 0.04, zc(fzf1) + 0.04
        v.shell(
            [(rz0, roof_y - 0.04, roof_y), (rz0 + 0.1, roof_y - 0.03, roof_y + roof_t), (rz1 - 0.1, roof_y - 0.03, roof_y + roof_t), (rz1, roof_y - 0.04, roof_y)],
            [(rz0, rw * 0.94), (rz0 + 0.1, rw), (rz1 - 0.1, rw), (rz1, rw * 0.96)],
            "paint",
            round=0.45,
            taper=0.95,
        )
        if rails:
            for sx in (-1, 1):
                v.box(sx * body_w * 0.33, zc((rzr1 + fzf1) / 2), 0.04, (fzf1 - rzr1) * L, H - rails, rails, "metal")
        if body != "coupe":
            # the B pillar: a slice of the glasshouse just proud of the glass, its top under the roof (#242)
            bz = zc((rzr0 + rzr1 + fzf1 + fzf0) / 4)
            side, plan = glass.band(bz - 0.03, bz + 0.03, 0.01, below=0.03)
            v.shell(side, plan, "paint", round=0.3, taper=glass.taper)
        if body == "pickup":
            bed = rzr0
            for sx in (-1, 1):
                v.box(sx * (body_w / 2 - 0.05), zc(bed / 2 + 0.01), 0.06, bed * L - 0.08, belt - 0.02, 0.09 * H, "paint")
            v.box(0, -L / 2 + 0.06, body_w * 0.86, 0.05, belt - 0.02, 0.09 * H, "paint")
        if p.get("cladding"):
            for sx in (-1, 1):
                v.box(sx * (body_w / 2 - 0.02), 0, 0.03, L * 0.5, gc, 0.12, "dark")
    if body == "van":
        for sx in (-1, 1):
            v.box(sx * W * 0.33, L / 2 - 0.02, 0.26, 0.04, belt - 0.12, 0.08, "#fff3cf")
            v.box(sx * W * 0.36, -L / 2 + 0.02, 0.24, 0.04, belt - 0.15, 0.08, "#b3141b")
            v.box(sx * (W / 2 - 0.03), zc(0.8), 0.08, 0.12, belt + 0.03, 0.08, "paint")
    else:
        # lamps sit on the curved nose and tail: under the nose's top, within its width
        for sx in (-1, 1):
            ny = lower.top(zc(0.985)) - 0.03
            v.box(sx * min(W * 0.33, lower.half_width(L / 2 - 0.02, ny - 0.04) - 0.14), L / 2 - 0.035, 0.24, 0.05, ny - 0.08, 0.08, "#fff3cf")
            ty = belt - 0.07
            v.box(sx * min(W * 0.36, lower.half_width(-L / 2 + 0.02, ty - 0.04) - 0.13), -L / 2 + 0.025, 0.22, 0.04, ty - 0.08, 0.08, "#b3141b")
            v.box(sx * (W / 2 - 0.04), zc(0.69), 0.08, 0.12, belt + 0.02, 0.08, "paint")
    v.box(0, L / 2 - 0.07, body_w * (0.94 if body == "van" else 0.8), 0.14, gc, 0.16, "dark")
    v.box(0, -L / 2 + 0.07, body_w * (0.94 if body == "van" else 0.84), 0.14, gc, 0.16, "dark")
    # no "car" or "vehicle" tag: the library knows those words from the item's kind, and 195 cars with the tag would bury the
    # hand-made ones (the Leaf) in a search for "car"
    words = [brand.lower(), model.lower(), BODY_WORDS[body]]
    if ev:
        words += ["ev", "electric", "charging"]
    words += ["parking", "driveway"]
    return v.item(car_id(brand_id, model), f"{brand} {model}", list(dict.fromkeys(words)), electric=ev)


# ------------------------------------------------------------------------------------------------------- two wheels


def bicycle(ident: str, name: str, length: float, width: float, height: float, radius: float, tyre: float, kind: str, tags: list[str], electric: bool = False) -> dict:
    v = V(width, length, height)
    zr = -length / 2 + radius + 0.02
    zf = length / 2 - radius - 0.02
    for z in (zr, zf):
        v.wheel(0, z, radius * 2, tyre)
        v.wheel(0, z, radius * 1.7, tyre * 0.55, y=radius * 0.15, color="metal")
    wb = zf - zr
    zb, yb = zr + 0.46 * wb, radius * 0.7
    zs, ys = zb - 0.1, height - 0.13
    zh, yh = zf - 0.1, height - 0.1
    v.bar(zr, radius, zb, yb, 0.025, 0.03)  # chain stays
    v.bar(zr, radius, zs, ys, 0.025, 0.03)  # seat stays
    v.bar(zb, yb, zs, ys, 0.03, 0.035)  # seat tube
    v.bar(zs, ys - 0.05, zh, yh, 0.03, 0.035)  # top tube
    v.bar(zb, yb, zh, yh - 0.04, 0.04, 0.04)  # down tube
    v.bar(zf, radius, zh, yh, 0.03, 0.03, color="metal")  # fork
    v.bar(zh, yh, zh - 0.05, height - 0.04, 0.03, 0.03, color="metal")  # stem
    bw = 0.42 if kind != "bmx" else 0.6
    v.box(0, zh - 0.05, min(bw, width), 0.03, height - 0.04, 0.03, "metal")  # handlebar
    v.rbox(0, zs - 0.02, 0.15, 0.25, ys, 0.05, "dark", round=0.4)  # saddle
    v.add("cyl", 0, zb, 0.1, 0.1, yb - 0.05, 0.1, "metal", axis="x")  # chainset
    if kind == "cargo":
        v.rbox(0, zf - 0.1 - 0.35, width * 0.95, 0.9, radius * 0.55, 0.38, "paint", round=0.2)
    if kind in ("ebike", "ebike_mtb"):
        v.rbox(0, zb + 0.03, 0.08, 0.2, yb + 0.02, 0.1, "dark", round=0.3)
        v.rbox(0, (zs + zh) / 2 - 0.1, 0.06, 0.3, yb + 0.15, 0.1, "accent", round=0.3)
    if kind == "mtb":
        v.bar(zs, ys - 0.05, zh, yh - 0.1, 0.03, 0.03, color="metal", cx=0.0)
    return v.item(ident, name, ["bike", "bicycle", "cycle", *tags], electric=electric)


def motorbike(ident: str, name: str, length: float, width: float, height: float, kind: str, tags: list[str]) -> dict:
    v = V(width, length, height)
    R = {"cruiser": 0.33, "adventure": 0.4, "scooter": 0.2, "touring": 0.34, "trail": 0.4}[kind]
    tyre = {"cruiser": 0.15, "adventure": 0.12, "scooter": 0.12, "touring": 0.18, "trail": 0.09}[kind]
    zr, zf = -length / 2 + R + 0.05, length / 2 - R - 0.05
    for z in (zr, zf):
        v.wheel(0, z, 2 * R, tyre)
        v.wheel(0, z, 1.5 * R, tyre * 0.6, y=R * 0.25, color="metal")
    seat_y = {"cruiser": 0.7, "adventure": 0.85, "scooter": 0.78, "touring": 0.8, "trail": 0.85}[kind]
    if kind == "scooter":
        v.rbox(0, zr + 0.15, 0.4, 0.75, 0.25, seat_y - 0.2, "paint", round=0.3)  # rear body
        v.rbox(0, zr + 0.1, 0.3, 0.55, seat_y, 0.1, "dark", round=0.4)  # seat
        v.box(0, (zr + zf) / 2 + 0.05, 0.5, 0.55, 0.22, 0.05, "dark")  # floorboard
        v.loft(0, zf - 0.1, 0.3, 0.5, 0.22, 0.85, "paint", tcz=zf - 0.28, tw=0.3, td=0.3)  # leg shield
        v.bar(zf, R, zf - 0.05, 1.05, 0.05, 0.05, color="metal")
        v.box(0, zf - 0.08, 0.7, 0.04, 1.0, 0.04, "metal")
        v.loft(0, zf - 0.1, 0.4, 0.2, 1.05, 0.38, "glass", tcz=zf - 0.2, td=0.05)
    else:
        v.box(0, (zr + zf) / 2, 0.22, length * 0.3, R * 0.5, 0.42, "dark")  # engine
        v.add("cyl", 0, (zr + zf) / 2 + 0.1, 0.24, 0.24, R + 0.1, 0.24, "metal", axis="x")
        v.rbox(0, (zr + zf) / 2 + 0.2, 0.28, 0.5, seat_y - 0.05 + {"cruiser": 0.0, "adventure": 0.08, "touring": 0.05, "trail": 0.0}[kind], 0.25, "paint", round=0.4)  # tank
        v.rbox(0, zr + 0.2, 0.3, 0.75, seat_y, 0.1, "dark", round=0.4)  # seat
        v.bar(zf, R, zf - 0.18, seat_y + 0.4, 0.05, 0.06, color="metal")  # fork
        v.box(0, zf - 0.18, 0.78 if kind != "cruiser" else 0.9, 0.04, seat_y + 0.4, 0.04, "metal")  # bars
        v.add("sphere", 0, zf + 0.0, 0.2, 0.2, seat_y + 0.2, 0.2, "#fff3cf")  # headlight
        v.add("cyl", 0.17, zr, 0.12, 0.9 * length * 0.4, R * 0.5, 0.12, "metal", axis="z")  # exhaust
        v.box(0, zr - 0.1, 0.18, 0.3, seat_y + 0.02, 0.2, "paint")  # tail
        v.box(0, -length / 2 + 0.02, 0.14, 0.03, seat_y + 0.05, 0.06, "#b3141b")
        if kind in ("adventure", "touring"):
            v.loft(0, zf - 0.2, 0.4, 0.2, seat_y + 0.5, 0.3 if kind == "adventure" else 0.4, "glass", tcz=zf - 0.35, td=0.05)
            for sx in (-1, 1):
                v.box(sx * (width / 2 - 0.12), zr - 0.05, 0.24, 0.5, seat_y - 0.1, 0.4, "paint")
        if kind == "touring":
            v.rbox(0, zr - 0.2, 0.4, 0.4, seat_y + 0.1, 0.35, "paint", round=0.3)
        if kind == "trail":
            v.loft(0, (zr + zf) / 2, 0.2, 1.3, R + 0.35, 0.1, "paint", tcz=(zr + zf) / 2 - 0.25, td=0.7)  # fender / plate
    return v.item(ident, name, ["motorbike", "motorcycle", "bike", "motor", *tags])


def kick_scooter(ident: str, name: str, length: float, width: float, height: float, wheel: float, tags: list[str]) -> dict:
    v = V(width, length, height)
    zr, zf = -length / 2 + wheel / 2, length / 2 - wheel / 2
    v.wheel(0, zr, wheel, 0.03)
    v.wheel(0, zf, wheel, 0.03)
    v.rbox(0, 0, 0.12, length - wheel * 0.8, wheel * 0.7, 0.03, "paint", round=0.3)
    v.bar(zf, wheel * 0.5, zf - 0.03, height - 0.05, 0.03, 0.03, color="metal")
    v.box(0, zf - 0.03, width, 0.03, height - 0.05, 0.03, "dark")
    return v.item(ident, name, ["scooter", "kick scooter", "stunt scooter", *tags])


# ----------------------------------------------------------------------------------------------------------- others


def snowmobile(ident: str, name: str, length: float, width: float, height: float, kind: str, tags: list[str]) -> dict:
    v = V(width, length, height)
    v.box(0, -length * 0.08, width * 0.34, length * 0.52, 0.0, 0.3, "dark")  # track
    for sx in (-1, 1):
        v.loft(sx * width * 0.38, length * 0.36, 0.16, length * 0.3, 0.0, 0.1, "dark", tcz=length * 0.45)  # skis
        v.bar(length * 0.34, 0.1, length * 0.28, 0.45, 0.04, 0.04, cx=sx * width * 0.38, color="metal")
    v.rbox(0, 0, width * 0.62, length * 0.58, 0.28, 0.32, "dark", round=0.2)  # tunnel and engine
    v.loft(0, length * 0.2, width * 0.66, length * 0.38, 0.4, 0.28, "paint", tcz=length * 0.27, tw=width * 0.5, td=length * 0.26)  # hood
    v.loft(0, length * 0.12, width * 0.42, length * 0.1, 0.62, height * 0.32 if kind != "touring" else height * 0.38, "glass", tcz=length * 0.05, td=length * 0.03)
    seat = length * (0.34 if kind in ("touring", "utility") else 0.24)
    v.rbox(0, -length * 0.14 - (seat - length * 0.24) / 2, width * 0.42, seat, 0.58, 0.14, "dark", round=0.3)
    v.box(0, length * 0.07, width * 0.55, 0.04, 0.78, 0.04, "metal")  # bars
    v.box(0, length * 0.4, width * 0.4, 0.04, 0.48, 0.1, "#fff3cf")
    v.box(0, -length / 2 + 0.03, width * 0.34, 0.05, 0.4, 0.06, "#b3141b")
    if kind == "utility":
        v.box(0, -length * 0.4, width * 0.5, length * 0.18, 0.62, 0.05, "metal")  # rear rack
    if kind == "mountain":
        v.loft(0, -length * 0.36, width * 0.35, length * 0.2, 0.45, 0.12, "paint", tcz=-length * 0.42, td=length * 0.06)
    return v.item(ident, name, ["snowmobile", "snow machine", "skidoo", "snow", "winter", *tags])


def golf_cart(ident: str, name: str, length: float, width: float, height: float, seats: int, bed: bool, tags: list[str]) -> dict:
    v = V(width, length, height)
    dia = 0.5
    for sx in (-1, 1):
        for z in (length * 0.32, -length * 0.3):
            v.wheel(sx * (width / 2 - 0.1), z, dia, 0.2)
            v.add("cyl", sx * (width / 2 - 0.005), z, 0.012, dia * 0.6, dia * 0.2, dia * 0.6, "metal", axis="x")
    v.rbox(0, 0, width * 0.9, length * 0.98, 0.2, 0.2, "paint", round=0.2)  # floor and sills
    v.loft(0, length * 0.38, width * 0.88, length * 0.2, 0.4, 0.45, "paint", tcz=length * 0.34, tw=width * 0.8, td=length * 0.1)  # cowl
    v.rbox(0, length * 0.08, width * 0.72, length * 0.16, 0.4, 0.12, "cushion", round=0.3)  # seat
    v.rbox(0, length * 0.0, width * 0.72, 0.08, 0.48, 0.38, "cushion", round=0.3)  # back
    if seats == 4:
        v.rbox(0, -length * 0.22, width * 0.72, length * 0.12, 0.4, 0.12, "cushion", round=0.3)
        v.rbox(0, -length * 0.3, width * 0.72, 0.08, 0.48, 0.38, "cushion", round=0.3)
    if bed:
        v.box(0, -length * 0.3, width * 0.9, length * 0.34, 0.42, 0.04, "dark")
        for sx in (-1, 1):
            v.box(sx * width * 0.44, -length * 0.3, 0.04, length * 0.34, 0.42, 0.2, "paint")
    for sx in (-1, 1):
        for z in (length * 0.3, -length * 0.46 if seats == 4 or bed else -length * 0.2):
            v.add("cyl", sx * width * 0.44, z, 0.04, 0.04, 0.4, height - 0.4 - 0.05, "metal")
    v.box(0, length * 0.05 if not (seats == 4 or bed) else -length * 0.08, width * 0.98, length * (0.62 if not (seats == 4 or bed) else 0.92), height - 0.05, 0.05, "paint")  # roof
    v.loft(0, length * 0.28, width * 0.82, 0.06, 0.62, height - 0.67, "glass", tcz=length * 0.27, td=0.03)
    v.box(0, length / 2 - 0.02, width * 0.45, 0.04, 0.45, 0.1, "#fff3cf")
    return v.item(ident, name, ["golf cart", "golf buggy", "buggy", "electric", "cart", *tags], electric=True)


def quad(ident: str, name: str, length: float, width: float, height: float, side_by_side: bool, tags: list[str]) -> dict:
    v = V(width, length, height)
    dia = 0.6 if not side_by_side else 0.72
    tyre = 0.22 if not side_by_side else 0.26
    for sx in (-1, 1):
        for z in (length * 0.3, -length * 0.3):
            v.wheel(sx * (width / 2 - tyre / 2), z, dia, tyre)
            v.add("cyl", sx * (width / 2 - 0.005), z, 0.012, dia * 0.5, dia * 0.25, dia * 0.5, "metal", axis="x")
    if side_by_side:
        v.rbox(0, 0, width * 0.8, length * 0.92, 0.3, 0.5, "paint", round=0.2)
        v.rbox(0, -0.1, width * 0.6, 0.5, 0.75, 0.2, "dark", round=0.3)
        v.rbox(0, -0.35, width * 0.6, 0.1, 0.9, 0.5, "dark", round=0.3)
        for sx in (-1, 1):
            for z in (length * 0.1, -length * 0.35):
                v.add("cyl", sx * width * 0.4, z, 0.05, 0.05, 0.8, height - 0.8, "metal")
            v.bar(length * 0.1, height - 0.05, -length * 0.35, height - 0.05, 0.05, 0.05, color="metal", cx=sx * width * 0.4)
        v.box(0, -length * 0.4, width * 0.7, length * 0.2, 0.8, 0.04, "dark")
        v.box(0, length / 2 - 0.02, width * 0.5, 0.04, 0.55, 0.12, "#fff3cf")
    else:
        v.rbox(0, 0, width * 0.55, length * 0.6, 0.3, 0.3, "paint", round=0.3)
        v.rbox(0, -0.1, 0.3, 0.6, 0.6, 0.12, "dark", round=0.4)
        v.loft(0, length * 0.3, width * 0.7, length * 0.3, 0.45, 0.2, "paint", tcz=length * 0.28, td=length * 0.18)
        v.box(0, length * 0.2, width * 0.75, 0.04, height - 0.05, 0.04, "metal")
        v.bar(length * 0.3, 0.45, length * 0.2, height - 0.05, 0.04, 0.04, color="metal")
        v.box(0, length * 0.42, 0.35, 0.04, 0.65, 0.12, "#fff3cf")
        v.box(0, length * 0.38, width * 0.7, length * 0.1, 0.62, 0.04, "metal")
        v.box(0, -length * 0.38, width * 0.7, length * 0.1, 0.62, 0.04, "metal")
    return v.item(ident, name, ["quad bike", "atv", "all terrain", "farm", *tags])


def mobility(ident: str, name: str, length: float, width: float, height: float, wheels: int, tags: list[str]) -> dict:
    v = V(width, length, height)
    dia = 0.26
    zr = -length / 2 + dia / 2 + 0.03
    zf = length / 2 - dia / 2 - 0.03
    for sx in (-1, 1):
        v.wheel(sx * (width / 2 - 0.05), zr, dia, 0.09)
    if wheels == 4:
        for sx in (-1, 1):
            v.wheel(sx * (width / 2 - 0.05), zf, dia, 0.09)
    else:
        v.wheel(0, zf, dia, 0.09)
    v.rbox(0, 0, width * 0.7, length * 0.8, 0.12, 0.12, "paint", round=0.3)
    v.loft(0, length * 0.25, width * 0.65, length * 0.3, 0.24, 0.35, "paint", tcz=length * 0.25 + 0.05, tw=width * 0.5, td=length * 0.1)
    v.rbox(0, -length * 0.15, width * 0.65, length * 0.28, 0.4, 0.1, "fabric", round=0.3)
    v.rbox(0, -length * 0.3, width * 0.6, 0.08, 0.48, 0.36, "fabric", round=0.3)
    for sx in (-1, 1):
        v.box(sx * width * 0.36, -length * 0.15, 0.04, length * 0.25, 0.55, 0.04, "dark")
    v.box(0, length * 0.3, width * 0.6, 0.05, height - 0.06, 0.05, "dark")
    v.rbox(0, -length * 0.4, width * 0.5, 0.2, 0.3, 0.25, "dark", round=0.2)
    return v.item(ident, name, ["mobility scooter", "disability", "powered", "scooter", *tags], electric=True)


def tractor(ident: str, name: str, length: float, width: float, height: float, tags: list[str]) -> dict:
    v = V(width, length, height)
    for sx in (-1, 1):
        v.wheel(sx * (width / 2 - 0.17), -length * 0.28, 1.1, 0.34)
        v.wheel(sx * (width / 2 - 0.12), length * 0.33, 0.7, 0.22)
    v.rbox(0, length * 0.28, width * 0.45, length * 0.42, 0.5, 0.65, "paint", round=0.2)  # bonnet
    v.rbox(0, -length * 0.08, width * 0.55, length * 0.4, 0.45, 0.35, "paint", round=0.2)
    v.rbox(0, -length * 0.18, width * 0.6, 0.4, 0.95, 0.1, "dark", round=0.4)  # seat
    for sx in (-1, 1):
        for z in (-length * 0.02, -length * 0.34):
            v.add("cyl", sx * width * 0.3, z, 0.05, 0.05, 1.0, height - 1.05, "metal")
    v.box(0, -length * 0.18, width * 0.7, length * 0.42, height - 0.05, 0.05, "paint")
    v.add("cyl", width * 0.15, length * 0.12, 0.06, 0.06, 1.15, 0.5, "metal")  # exhaust
    v.box(0, length / 2 - 0.02, width * 0.4, 0.04, 0.85, 0.1, "#fff3cf")
    return v.item(ident, name, ["tractor", "compact tractor", "farm", "smallholding", *tags])


def trailer(ident: str, name: str, length: float, width: float, height: float, kind: str, tags: list[str]) -> dict:
    v = V(width, length, height)
    wheel = 0.6 if kind != "utility" else 0.5
    for sx in (-1, 1):
        v.wheel(sx * (width / 2 - 0.1), -length * 0.12, wheel, 0.18)
    if kind == "caravan":
        v.rbox(0, 0, width * 0.98, length * 0.82, 0.4, height - 0.4, "paint", round=0.08)
        v.box(0, length * 0.46, 0.1, length * 0.14, 0.4, 0.12, "metal")  # drawbar
        for sx in (-1, 1):
            v.box(sx * width * 0.49, 0, 0.02, 1.0, 1.1, 0.7, "glass")
        v.box(width * 0.49, length * 0.1, 0.02, 0.7, 0.4, 1.6, "white")
        v.box(0, -length * 0.41, width * 0.5, 0.03, 0.6, 0.15, "#b3141b")
    else:
        v.box(0, 0, width * 0.95, length * 0.85, 0.4, 0.08, "metal")
        for sx in (-1, 1):
            v.box(sx * width * 0.47, 0, 0.05, length * 0.85, 0.48, 0.3 if kind == "utility" else 0.04, "paint")
        v.box(0, -length * 0.42, width * 0.95, 0.05, 0.48, 0.3 if kind == "utility" else 0.04, "paint")
        v.box(0, length * 0.4, width * 0.95, 0.05, 0.48, 0.3 if kind == "utility" else 0.1, "paint")
        v.bar(0, 0.4, length * 0.5, 0.4, 0.05, 0.05, color="metal")
        v.bar(0, 0.4, length * 0.5, 0.4, 0.05, 0.05, color="metal", cx=0.3)
        v.bar(0, 0.4, length * 0.5, 0.4, 0.05, 0.05, color="metal", cx=-0.3)
        if kind == "car":
            v.box(0, -length * 0.4, width * 0.8, length * 0.15, 0.48, 0.03, "dark")
    return v.item(ident, name, ["trailer", "towing", *tags])


def others() -> list[dict]:
    out = [
        bicycle("bicycle_road", "Road bike", 1.72, 0.44, 1.05, 0.34, 0.025, "road", ["road bike", "racing bike", "drop bars"]),
        bicycle("bicycle_mountain", "Mountain bike", 1.75, 0.68, 1.1, 0.36, 0.06, "mtb", ["mountain bike", "mtb", "off road"]),
        bicycle("bicycle_ebike_mountain", "Electric mountain bike", 1.78, 0.68, 1.1, 0.36, 0.065, "ebike_mtb", ["e-bike", "emtb", "electric bike", "mountain bike"], electric=True),
        bicycle("bicycle_folding", "Folding bike", 1.25, 0.55, 1.0, 0.2, 0.04, "folding", ["folding bike", "commuter", "brompton style"]),
        bicycle("bicycle_bmx", "BMX bike", 1.1, 0.6, 0.9, 0.25, 0.05, "bmx", ["bmx", "stunt bike", "kids bike"]),
        bicycle("bicycle_cargo", "Cargo bike", 2.5, 0.85, 1.2, 0.33, 0.05, "cargo", ["cargo bike", "bakfiets", "family bike"]),
        bicycle("bicycle_kids_balance", "Kids balance bike", 0.85, 0.4, 0.55, 0.15, 0.04, "balance", ["balance bike", "kids bike", "toddler", "run bike"]),
        bicycle("bicycle_gravel", "Gravel bike", 1.74, 0.5, 1.07, 0.35, 0.04, "road", ["gravel bike", "touring bike", "adventure bike"]),
        motorbike("motorbike_cruiser", "Cruiser motorbike", 2.4, 0.9, 1.1, "cruiser", ["cruiser", "custom", "chopper"]),
        motorbike("motorbike_adventure", "Adventure motorbike", 2.25, 0.95, 1.45, "adventure", ["adventure", "trail", "touring", "gs style"]),
        motorbike("motorbike_touring", "Touring motorbike", 2.5, 1.0, 1.5, "touring", ["touring", "tourer", "panniers", "gold wing style"]),
        motorbike("motorbike_trail", "Trail motorbike", 2.1, 0.85, 1.25, "trail", ["trail bike", "enduro", "dirt bike", "off road"]),
        motorbike("motorbike_scooter_maxi", "Maxi scooter", 2.2, 0.8, 1.45, "scooter", ["maxi scooter", "scooter", "tmax style", "commuter"]),
        kick_scooter("scooter_kids_2_wheel", "Kids kick scooter", 0.65, 0.3, 0.85, 0.12, ["kids scooter", "child"]),
        kick_scooter("scooter_stunt", "Stunt scooter", 0.6, 0.5, 0.85, 0.11, ["stunt", "trick", "skatepark"]),
        snowmobile("snowmobile_sport", "Snowmobile, sport", 2.9, 1.2, 1.25, "sport", ["sport", "trail"]),
        snowmobile("snowmobile_touring", "Snowmobile, touring (two-up)", 3.2, 1.25, 1.35, "touring", ["touring", "two seater"]),
        snowmobile("snowmobile_utility", "Snowmobile, utility", 3.1, 1.25, 1.3, "utility", ["utility", "work", "rack"]),
        snowmobile("snowmobile_mountain", "Snowmobile, mountain", 3.1, 1.15, 1.3, "mountain", ["mountain", "deep snow", "powder"]),
        golf_cart("golf_cart_2_seat", "Golf cart, 2 seats", 2.4, 1.2, 1.8, 2, False, ["2 seater", "buggy"]),
        golf_cart("golf_cart_4_seat", "Golf cart, 4 seats", 3.0, 1.2, 1.8, 4, False, ["4 seater", "buggy"]),
        golf_cart("golf_cart_utility", "Golf cart, utility with bed", 2.8, 1.2, 1.8, 2, True, ["utility", "work", "flatbed"]),
        quad("quad_bike_atv", "Quad bike", 1.8, 1.15, 1.15, False, ["quad", "atv", "four wheeler"]),
        quad("quad_utv_side_by_side", "Side-by-side utility vehicle", 3.0, 1.5, 1.9, True, ["utv", "side by side", "buggy", "roll cage"]),
        mobility("mobility_scooter_3_wheel", "Mobility scooter, 3 wheels", 1.2, 0.58, 1.0, 3, ["3 wheel", "disabled"]),
        mobility("mobility_scooter_4_wheel", "Mobility scooter, 4 wheels", 1.35, 0.62, 1.05, 4, ["4 wheel", "road legal"]),
        tractor("tractor_compact", "Compact tractor", 3.0, 1.4, 2.2, ["small", "grounds"]),
        trailer("caravan_touring", "Touring caravan", 7.0, 2.3, 2.6, "caravan", ["caravan", "camping", "holiday"]),
        trailer("trailer_utility", "Utility trailer", 2.6, 1.5, 0.8, "utility", ["box trailer", "garden"]),
        trailer("trailer_car", "Car trailer", 5.5, 2.1, 0.7, "car", ["car transporter", "flatbed", "recovery"]),
    ]
    return out


# ------------------------------------------------------------------------------------------------------- writing


def dump(item: dict) -> str:
    head = {k: v for k, v in item.items() if k != "parts"}
    lines = ["{"]
    for key, val in head.items():
        lines.append(f"  {json.dumps(key)}: {json.dumps(val, ensure_ascii=False)},")
    lines.append('  "parts": [')
    lines.append(",\n".join("    " + json.dumps(p, separators=(", ", ": ")) for p in item["parts"]))
    lines.append("  ]")
    lines.append("}")
    return "\n".join(lines) + "\n"


def checklist() -> str:
    rows = [
        "# Vehicles catalogue (#129)",
        "",
        "Cars: the most popular current UK models of 20 brands (by UK and European registrations; pick the latest generation",
        "sold), about 200 in all. Each is built by `tools/gen_vehicles.py` from curved shells (body, glasshouse and roof, #252;",
        "the vans from boxes) and simple shapes, scaled to the outer size below (length x width without mirrors x height, in",
        "mm). No logos, no maker pictures, no 3D files. The body is in the",
        "`paint` colour role: ten base colours and a hex value in the item panel.",
        "",
        "**Sizes were checked in #135.** The maker sites (ford.co.uk, bmw.co.uk and the rest) refuse automated fetches, so each",
        "row was compared with two other sources: the Auto Express model page (UK figures) and the generation table on",
        "auto-data.net. Width is without mirrors; where a source gave it with mirrors, the other source's figure was used.",
        "Status: **verified** = the two sources agree (length within 20 mm, width within 8 mm, height within 35 mm; the Auto Express",
        "figure is used and the Source column says where they differ); **single source** = only one source covered that car or",
        "the other one was for a different body or market (the value shown is the one source's, the Source column says which and",
        "what the other said); **unverified** = left as written from memory, with the reason. A few cars were swapped for a",
        "model that is on sale now; the Source column starts the reason with \"Swap\".",
        f"Totals: {sum(1 for c in CHECKS.values() if c[0] == 'verified')} verified, {sum(1 for c in CHECKS.values() if c[0] == 'single source')} single source, {sum(1 for c in CHECKS.values() if c[0] == 'unverified')} unverified, out of {len(CHECKS)} cars.",
        "Brands with fewer than ten rows (Tesla sells seven different shapes, MG eight) are listed as they are.",
        "",
        "The Nissan Leaf (second generation, 2018 on) and its colourways come from `tools/gen_leaf.py` (#242); they and the first",
        "bicycles, mopeds and scooters are not part of this table. Their bodies are in the `paint` role too (#404), with the",
        "colourway's colour as the item's own paint (`\"colors\": {\"paint\": …}`); the two-tone Leaf keeps its black roof.",
        "",
    ]
    for brand_id, brand, site, models in BRANDS:
        rows += [f"## {brand}", "", f"Maker site: {site}", "", "| Model | Body | L x W x H (mm) | Electric | Item id | Status | Source |", "| --- | --- | --- | --- | --- | --- | --- |"]
        for name, body, length, width, height, ev in models:
            rows.append(f"| {brand} {name} | {BODY_WORDS[body]} | {length} x {width} x {height} | {'yes' if ev else 'no'} | `{car_id(brand_id, name)}` | {CHECKS[car_id(brand_id, name)][0]} | {CHECKS[car_id(brand_id, name)][1]} |")
        rows.append("")
    rows += [
        "## Other vehicles",
        "",
        "Modelled from simple shapes at typical sizes (no single maker): road, gravel, mountain, e-mountain, folding, BMX,",
        "cargo and kids' balance bikes; cruiser, adventure, touring, trail and maxi-scooter motorbikes; snowmobiles (sport,",
        "touring, utility, mountain); golf carts (2 seat, 4 seat, utility); quad bike and side-by-side; mobility scooters;",
        "kids' and stunt kick scooters; a compact tractor; a touring caravan and two trailers. Sizes are typical, not a",
        "particular model's: none of them names a real product (the \"style\" words in some tags are only search hints), so there",
        "is no maker page to check them against (#135). A ride-on mower, the electric and adult kick scooters, the moped and the first bicycles were",
        "already in the pack.",
        "",
    ]
    return "\n".join(rows)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    items = [car(b, name, *m) for b, name, _site, models in BRANDS for m in models]
    items += others()
    ids = [i["id"] for i in items]
    assert len(ids) == len(set(ids)), "duplicate ids"
    for item in items:
        assert len(item["id"]) <= 40 and len(item["parts"]) <= 60, item["id"]
        (OUT / f"{item['id']}.json").write_text(dump(item), encoding="utf-8", newline="\n")
    DOC.write_text(checklist(), encoding="utf-8", newline="\n")
    print(f"{len(items)} vehicles written")


if __name__ == "__main__":
    main()
