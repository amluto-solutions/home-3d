#!/usr/bin/env python3
"""Writes the bundled rack-mount gear (#117) into the IT & network pack.

    python tools/rack_gear.py            write amluto.it/network/rack_*.json (UniFi gear: amluto.unifi/network/) for every item below
    python tools/rack_gear.py --check    exit 1 when a file differs from what this would write

Edit the catalogue (the `CATALOGUE` list at the end), not the JSON. Sizes and sources are in docs/rack-gear.md.
The six starter items from #113/#114 (rack_switch_24_1u, rack_patch_panel_24_1u, rack_blank_1u,
rack_switch_8_half_1u, rack_pdu_vertical_0u, rack_shelf_2u) are hand-written and not touched here.

Drawing: everything is written in millimetres and turned into the pack's fractions of the item's size. The front
face is at +z. `front()` puts a feature flush with the front face (as a flat box of the given depth); the body is a
box over the whole depth.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

NETWORK = Path(__file__).resolve().parent.parent / "custom_components/home_3d/bundled_packs/amluto.it/network"
# UniFi's own rack gear lives in the UniFi pack (#145)
UNIFI_NETWORK = NETWORK.parent.parent / "amluto.unifi/network"


def path_of(id: str) -> Path:
    """Where an item's file is written: the UniFi pack for UniFi gear, the IT & network pack for the rest."""
    return (UNIFI_NETWORK if id.startswith("rack_unifi_") else NETWORK) / f"{id}.json"


U = 44.45
PANEL = 482.6  # 19 inch panel width
GEAR_H = {1: 43.7, 2: 88.1, 3: 132.55, 4: 177.0}  # a box is built 0.8 mm short of its U
ROOMS = ["office", "utility", "loft", "hall", "garage"]
DARK = "#0a0b0d"
BODY = "#3b4048"
SILVER = "#cfd3d8"
GREY = "#2a2d33"


def r(v: float) -> float:
    return round(v, 4)


class Gear:
    """One item under construction: size in mm, parts in mm from the item's centre (x), bottom (y), front (z)."""

    def __init__(self, w: float, d: float, h: float) -> None:
        self.w, self.d, self.h = w, d, h
        self.parts: list[dict] = []

    def box(self, x, y, w, h, color, *, d=None, z=0.0, edges=None) -> None:
        """x: centre from the middle; y: bottom; z: how far BEHIND the front face the box starts (0 = flush)."""
        d = self.d if d is None else d
        part = {
            "shape": "box",
            "x": r(x / self.w),
            "z": r(0.5 - (z + d / 2) / self.d),
            "w": r(w / self.w),
            "d": r(d / self.d),
            "y": r(y / self.h),
            "h": r(h / self.h),
            "color": color,
        }
        if edges:
            part["edges"] = edges
        self.parts.append(part)

    def body(self, width: float, color=BODY, d=None) -> None:
        # one mm behind the front so the fronts of ears, ports and LEDs stand proud of it (no flat z-fighting)
        self.box(0, 0, width, self.h, color, d=self.d - 1 if d is None else d, z=1.0, edges="faint")

    def ears(self, color=BODY, depth=4.0) -> None:
        for s in (-1, 1):
            self.box(s * (self.w / 2 - 10), 0, 20, self.h, color, d=depth)

    def front(self, x, y, w, h, color, depth=4.0) -> None:
        self.box(x, y, w, h, color, d=max(depth, 4.0))

    def ports(self, x0, cols, rows, *, group=4, pitch=None, port_h=12.0, color=DARK, y_mid=None, gap=5.0) -> float:
        """Banks of RJ45 ports, `group` ports to a block, from x0 (left edge). Returns the right edge."""
        mid = self.h / 2 if y_mid is None else y_mid
        if pitch is None:
            pitch = 16.0 if cols <= 12 else 15.0 if cols <= 16 else 12.5
        row_gap = 3.0
        total = rows * port_h + (rows - 1) * row_gap
        x = x0
        left = cols
        while left > 0:
            n = min(group, left)
            bw = n * pitch
            for row in range(rows):
                y = mid - total / 2 + row * (port_h + row_gap)
                self.front(x + bw / 2, y, bw, port_h, color)
            x += bw + gap
            left -= n
        return x - gap

    def sfp(self, x0, count, rows=1, *, w=14.0, h=9.0) -> float:
        mid = self.h / 2
        x = x0
        per_row = -(-count // rows)
        for i in range(count):
            row, col = divmod(i, per_row)
            y = mid - (rows * h + (rows - 1) * 3) / 2 + row * (h + 3)
            self.front(x + col * (w + 3) + w / 2, y, w, h, "metal", 4)
        return x + per_row * (w + 3) - 3

    def led(self, x, y, color="accent", size=4.0) -> None:
        self.front(x, y, size, size, color, 4)

    def bays(self, x0, y0, cols, rows, bw, bh, gap=3.0, color=GREY) -> None:
        for row in range(rows):
            for col in range(cols):
                self.front(x0 + bw / 2 + col * (bw + gap), y0 + row * (bh + gap), bw, bh, color, 4)

    def item(self, spec: dict) -> dict:
        out = {
            "id": spec["id"],
            "name": {"en": spec["name"]},
            "size": [r(self.w / 1000), r(self.d / 1000), r(self.h / 1000)],
            "group": "network",
            "room": ROOMS,
            "mount": spec.get("mount", "surface"),
        }
        if "wall_y" in spec:
            out["wall_y"] = spec["wall_y"]
        if spec.get("shelf"):
            out["surface"] = True
        out["tags"] = spec["tags"][:12]
        out["family"] = spec["family"]
        out["variant"] = {"en": spec["variant"]}
        if spec.get("watts") is not None:
            out["electric"] = True
            out["watts"] = spec["watts"]
        out["rack"] = spec["rack"]
        out["parts"] = self.parts
        out["symbol"] = [{"shape": "rect", "x": 0, "z": 0, "w": 1, "d": 1}]
        return out


COMMON = ["rack mount", "19 inch", "rack"]

# ---------------------------------------------------------------- builders


def switch(spec, *, rj45, rows, sfp=0, sfp_rows=1, lcd=False, silver=False, poe=False, group=4, half=False):
    h = GEAR_H[1]
    w = 220.0 if half else PANEL
    g = Gear(w, spec["depth"], h)
    colour = SILVER if silver else BODY
    if half:
        g.body(w, colour)
        x0 = -w / 2 + 8
        end = g.ports(x0, rj45 // rows, rows, group=group, pitch=11.5 if rj45 > 6 else 13.5)
        g.led(w / 2 - 10, h - 10)
        spec["rack"] = {"u": 1, "width": "half"}
        return g
    g.body(w - 40.4 if silver else w - 40.4, colour)
    g.ears(colour)
    x = -w / 2 + 28
    if lcd:
        g.front(x + 14, h / 2 - 8, 28, 16, "glass", 4)
        x += 36
    end = g.ports(x, rj45 // rows, rows, group=group)
    if sfp:
        g.sfp(max(end + 12, w / 2 - 12 - ((-(-sfp // sfp_rows)) * 17 - 3)), sfp, sfp_rows)
    g.led(w / 2 - 32, h - 8)
    if poe:
        g.led(w / 2 - 40, h - 8, "white")
    return g


def patch_panel(spec, *, ports, rows, label_rows=1):
    h = GEAR_H[spec["rack"]["u"]]
    g = Gear(PANEL, 50.0, h)
    g.body(PANEL - 40.4, BODY)
    g.ears()
    per_row = ports // rows
    group = 6
    x = -g.w / 2 + 38
    pitch = (PANEL - 76 - (per_row // group - 1) * 6) / per_row if per_row >= group else 18.0
    # rows of keystone ports with a white number strip along the top
    gap = 2.0 if h < 60 else 6.0
    port_h = min(16.0, (h - 16 - gap * (rows - 1)) / rows)
    top = h - 6
    y0 = (h - 8 - (rows * port_h + (rows - 1) * gap)) / 2 + 2
    for row in range(rows):
        y = y0 + (rows - 1 - row) * (port_h + gap)
        xr = x
        left = per_row
        while left > 0:
            n = min(group, left)
            g.front(xr + n * pitch / 2, y, n * pitch - 1, port_h, DARK, 20)
            xr += n * pitch + 6
            left -= n
    g.front(0, top - 4, PANEL - 90, 4, "white", 4)
    return g


def blank(spec, *, u):
    g = Gear(PANEL, 10.0, GEAR_H[u])
    g.body(PANEL, BODY)
    return g


def brush(spec):
    g = Gear(PANEL, 11.0, GEAR_H[1])
    g.body(PANEL, BODY)
    g.front(0, 8, 423, 27.7, "#050506", 4)
    g.front(0, 8, 423, 10, "#3b3d42", 6)
    return g


def dring(spec, *, u):
    h = GEAR_H[u]
    g = Gear(PANEL, 80.0, h)
    g.body(PANEL - 40.4, BODY)
    g.ears()
    for i in range(6):
        g.front(-190 + i * 76, 5, 24, h - 10, "metal", 22)
        g.front(-190 + i * 76, 9, 16, h - 18, "dark", 24)
    return g


def finger_duct(spec):
    h = GEAR_H[1]
    g = Gear(PANEL, 75.0, h)
    g.body(PANEL - 40.4, BODY)
    g.ears()
    for i in range(14):
        g.front(-200 + i * 31, 3, 18, h - 6, "#0c0d0f", 6)
    return g


def shelf(spec, *, u, cantilever):
    h = u * U
    g = Gear(PANEL, spec["depth"], h)
    g.box(0, 0, PANEL - 40.4, 4.0, BODY, edges="faint")
    g.ears()
    if not cantilever:  # fixed shelves are boxed: a rear lip and two side rails
        g.box(0, 0, PANEL - 40.4, 20.0, BODY, d=4.0, z=spec["depth"] - 4)
        for s in (-1, 1):
            g.box(s * (PANEL / 2 - 25), 0, 4.0, 20.0, BODY)
    else:
        g.box(0, 0, PANEL - 40.4, 0.25 * h, BODY, d=4.0, z=spec["depth"] - 4)
    for i in range(5):  # vent slots
        g.box(-140 + i * 70, 4.0, 40, 0.5, "#0c0d0f", d=spec["depth"] * 0.5, z=spec["depth"] * 0.25)
    return g


def ups(spec, *, u, brand):
    h = GEAR_H[u]
    g = Gear(PANEL, spec["depth"], h)
    g.body(spec["body_w"], BODY)
    g.ears()
    g.front(spec["body_w"] / 2 - 90, h / 2 - 9, 50, 18, "glass", 4)  # LCD
    for i in range(3):
        g.front(spec["body_w"] / 2 - 40 + i * 12, h / 2 - 4, 8, 8, "metal", 4)
    g.led(spec["body_w"] / 2 - 100 - 20, h / 2, "accent")
    for i in range(6):  # vents on the left
        g.front(-spec["body_w"] / 2 + 30 + i * 12, 6, 6, h - 12, "#0c0d0f", 3)
    if brand == "apc":
        g.front(-60, h / 2 - 4, 60, 8, "#0b3d91", 3)
    return g


def pdu_h(spec, *, ways, uk, meter=False):
    g = Gear(PANEL, 50.0, GEAR_H[1])
    g.body(PANEL - 40.4, BODY)
    g.ears()
    x = -g.w / 2 + 50
    pitch = (PANEL - 100 - (70 if meter else 0)) / ways
    for i in range(ways):
        if uk:
            g.front(x + i * pitch + pitch / 2, 6, 30, 30, "white", 6)
            g.front(x + i * pitch + pitch / 2, 11, 18, 20, DARK, 7)
        else:
            g.front(x + i * pitch + pitch / 2, 8, 28, 24, DARK, 6)
    if meter:
        g.front(g.w / 2 - 60, 8, 50, 25, "glass", 4)
    g.front(-g.w / 2 + 34, 10, 10, 22, "accent", 5)  # master switch
    return g


def pdu_v(spec, *, ways, length):
    g = Gear(52.0, 45.0, length * 1000)
    g.body(52.0, BODY)
    rows = ways // 2
    step = (g.h - 80) / rows
    for i in range(rows):  # a pair of sockets per row
        g.front(0, 40 + i * step, 32, step * 0.7, "metal", 4)
    g.front(0, g.h - 30, 20, 14, "accent", 4)
    return g


def device_1u(spec, *, ports, sfp=0, lcd=False, silver=False, bays=0, hdd=None, half=False):
    """UDM Pro / SE / Pro Max and firewalls: a port row, an optional LCD and drive bays."""
    h = GEAR_H[1]
    w = 220.0 if half else PANEL
    g = Gear(w, spec["depth"], h)
    colour = SILVER if silver else BODY
    if half:
        g.body(w, colour)
        g.ports(-w / 2 + 10, ports, 1, group=4, pitch=13.5, color=DARK)
        g.led(w / 2 - 12, h - 10)
        return g
    g.body(w - 40.4, colour)
    g.ears(colour)
    x = -w / 2 + 28
    if lcd:
        g.front(x + 15, h / 2 - 10, 30, 20, "glass", 4)
        x += 40
    if bays:
        g.bays(x, 8, bays, 1, 30, h - 16, 4, GREY)
        x += bays * 34 + 8
    end = g.ports(x, ports, 1 if ports <= 9 else 2, group=4 if ports > 4 else ports)
    if sfp:
        g.sfp(end + 12, sfp)
    g.led(w / 2 - 32, h - 8)
    return g


def nvr(spec, *, u, bays, cols):
    h = GEAR_H[u]
    g = Gear(PANEL, spec["depth"], h)
    colour = SILVER if spec.get("silver") else BODY
    g.body(PANEL - 40.4, colour)
    g.ears(colour)
    rows = bays // cols
    bw = (PANEL - 40.4 - 60 - (cols - 1) * 4) / cols
    bh = (h - 16 - (rows - 1) * 4) / rows
    g.bays(-bw * cols / 2 - (cols - 1) * 2, 8, cols, rows, bw, bh, 4, GREY)
    g.led(PANEL / 2 - 32, 4)
    return g


def server(spec, *, u, cols, rows, lff=True):
    h = GEAR_H[u]
    g = Gear(PANEL, spec["depth"], h)
    g.body(PANEL - 40.4, BODY)
    g.ears()
    bw = 102.0 if lff else 70.0
    bh = (h - 12 - (rows - 1) * 3) / rows
    g.bays(-PANEL / 2 + 30, 6, cols, rows, bw, bh, 3, GREY)
    g.front(PANEL / 2 - 70, h / 2 - 7, 14, 14, "metal", 4)  # power button
    g.led(PANEL / 2 - 45, h / 2 + 4)
    g.front(PANEL / 2 - 50, h / 2 - 8, 14, 8, "glass", 4)
    return g


def nas(spec, *, u, cols, rows):
    h = GEAR_H[u]
    g = Gear(PANEL, spec["depth"], h)
    g.body(PANEL - 40.4, BODY)
    g.ears()
    bw = (PANEL - 40.4 - 80 - (cols - 1) * 3) / cols
    bh = (h - 12 - (rows - 1) * 3) / rows
    g.bays(-PANEL / 2 + 30, 6, cols, rows, bw, bh, 3, GREY)
    g.led(PANEL / 2 - 36, h - 14)
    g.front(PANEL / 2 - 36, 6, 10, 10, "metal", 4)
    return g


# ---------------------------------------------------------------- catalogue

SW = ["switch", "network switch", "ethernet"]


def sw(id, name, variant, ports, depth, watts, poe=False, unifi=False, **kw):
    tags = SW + ([f"{ports} port"] if not unifi else []) + (["poe"] if poe else []) + (["unifi", "ubiquiti"] if unifi else []) + ["1u"] + COMMON
    return dict(id=id, name=name, variant=variant, family="rack_switch", depth=depth, watts=watts, tags=tags, rack={"u": 1}, build=lambda s, kw=kw, poe=poe: switch(s, poe=poe, **kw))


def build_all() -> dict[str, dict]:
    C: list[dict] = []

    # standard and PoE switches (generic, depth and watts typical figures)
    C += [
        sw("rack_switch_5_half_1u", "Rack switch 5-port half-width 1U", "5-port half-width 1U", 5, 160, 5, rj45=5, rows=1, half=True, group=5),
        sw("rack_switch_8_1u", "Rack switch 8-port 1U", "8-port 1U", 8, 200, 8, rj45=8, rows=1, group=4),
        sw("rack_switch_16_1u", "Rack switch 16-port 1U", "16-port 1U", 16, 250, 15, rj45=16, rows=1, group=8, sfp=2),
        sw("rack_switch_48_1u", "Rack switch 48-port 1U", "48-port 1U", 48, 300, 45, rj45=48, rows=2, group=4, sfp=4, sfp_rows=2),
        sw("rack_switch_poe_8_1u", "Rack switch 8-port PoE 1U", "8-port PoE 1U", 8, 250, 20, poe=True, rj45=8, rows=1, group=4),
        sw("rack_switch_poe_16_1u", "Rack switch 16-port PoE 1U", "16-port PoE 1U", 16, 300, 30, poe=True, rj45=16, rows=1, group=8, sfp=2),
        sw("rack_switch_poe_24_1u", "Rack switch 24-port PoE 1U", "24-port PoE 1U", 24, 330, 45, poe=True, rj45=24, rows=2, group=4, sfp=2),
        sw("rack_switch_poe_48_1u", "Rack switch 48-port PoE 1U", "48-port PoE 1U", 48, 400, 80, poe=True, rj45=48, rows=2, group=4, sfp=4, sfp_rows=2),
    ]
    # UniFi switches (techspecs.ui.com, 30 Oct 2026); watts = the maker's maximum EXCLUDING PoE output
    C += [
        sw("rack_unifi_usw_pro_24_poe", "UniFi USW Pro 24 PoE", "UniFi Pro 24 PoE", 24, 285, 50, poe=True, unifi=True, rj45=24, rows=2, sfp=2, lcd=True, silver=True),
        sw("rack_unifi_usw_pro_hd_24_poe", "UniFi USW Pro HD 24 PoE", "UniFi Pro HD 24 PoE", 24, 400, 60, poe=True, unifi=True, rj45=24, rows=2, sfp=4, sfp_rows=2, lcd=True, silver=True),
        sw("rack_unifi_usw_pro_xg_24_poe", "UniFi USW Pro XG 24 PoE", "UniFi Pro XG 24 PoE", 24, 480, 150, poe=True, unifi=True, rj45=24, rows=2, sfp=2, lcd=True, silver=True),
        sw("rack_unifi_usw_pro_max_24_poe", "UniFi USW Pro Max 24 PoE", "UniFi Pro Max 24 PoE", 24, 325, 50, poe=True, unifi=True, rj45=24, rows=2, sfp=2, lcd=True, silver=True),
        sw("rack_unifi_usw_pro_48_poe", "UniFi USW Pro 48 PoE", "UniFi Pro 48 PoE", 48, 400, 60, poe=True, unifi=True, rj45=48, rows=2, sfp=4, sfp_rows=2, lcd=True, silver=True),
        sw("rack_unifi_usw_pro_max_48_poe", "UniFi USW Pro Max 48 PoE", "UniFi Pro Max 48 PoE", 48, 400, 100, poe=True, unifi=True, rj45=48, rows=2, sfp=4, sfp_rows=2, lcd=True, silver=True),
    ]

    def dev(id, name, variant, family, depth, watts, tags, u=1, rack=None, build=None):
        return dict(id=id, name=name, variant=variant, family=family, depth=depth, watts=watts, tags=tags + COMMON, rack=rack or {"u": u}, build=build)

    GW = ["unifi", "ubiquiti", "gateway", "router", "1u"]
    C += [
        dev("rack_unifi_udm_pro", "UniFi Dream Machine Pro", "UDM Pro", "rack_gateway", 285.6, 33, GW + ["udm pro"], build=lambda s: device_1u(s, ports=9, sfp=2, lcd=True, silver=True, bays=1)),
        dev("rack_unifi_udm_se", "UniFi Dream Machine SE", "UDM SE", "rack_gateway", 285.6, 50, GW + ["udm se"], build=lambda s: device_1u(s, ports=9, sfp=2, lcd=True, silver=True, bays=1)),
        dev("rack_unifi_udm_pro_max", "UniFi Dream Machine Pro Max", "UDM Pro Max", "rack_gateway", 285.6, 60, GW + ["udm pro max"], build=lambda s: device_1u(s, ports=9, sfp=2, lcd=True, silver=True, bays=2)),
        dev("rack_unifi_unvr", "UniFi Network Video Recorder 4-bay", "UNVR 4-bay 1U", "rack_nvr", 325, 100, ["unifi", "ubiquiti", "unvr", "nvr", "protect", "1u"], build=lambda s: nvr({**s, "silver": True}, u=1, bays=4, cols=4)),
        dev("rack_unifi_unvr_pro", "UniFi Network Video Recorder Pro 7-bay", "UNVR Pro 7-bay 2U", "rack_nvr", 325, 160, ["unifi", "ubiquiti", "unvr pro", "nvr", "protect", "2u"], u=2, build=lambda s: nvr({**s, "silver": True}, u=2, bays=8, cols=4)),
    ]
    FW = ["firewall", "router", "pfsense", "opnsense", "gateway"]
    C += [
        dev("rack_firewall_1u", "Rack firewall 1U (pfSense / OPNsense)", "Firewall 1U", "rack_firewall", 300, 40, FW + ["1u"], build=lambda s: device_1u(s, ports=6, sfp=2)),
        dev("rack_firewall_1u_short", "Rack firewall 1U short-depth", "Firewall 1U short-depth", "rack_firewall", 200, 20, FW + ["1u", "short depth"], build=lambda s: device_1u(s, ports=4)),
        dev("rack_firewall_half_1u", "Rack firewall half-width 1U", "Firewall half-width 1U", "rack_firewall", 170, 15, FW + ["half width", "1u"], rack={"u": 1, "width": "half"}, build=lambda s: device_1u(s, ports=4, half=True)),
    ]

    def pp(id, ports, u, rows, depth=50.0):
        name = f"Rack patch panel {ports}-port {u}U"
        return dev(id, name, f"{ports}-port {u}U", "rack_patch_panel", depth, None, ["patch panel", "cat6", "keystone", "cabling", f"{ports} port", f"{u}u"], u=u, build=lambda s: patch_panel(s, ports=ports, rows=rows))

    C += [pp("rack_patch_panel_12_1u", 12, 1, 1), pp("rack_patch_panel_48_1u", 48, 1, 2), pp("rack_patch_panel_48_2u", 48, 2, 2)]
    C += [
        dev(f"rack_blank_{u}u", f"Rack blanking plate {u}U", f"{u}U", "rack_blank", 10, None, ["blanking plate", "blank panel", "filler panel", f"{u}u"], u=u, build=lambda s, u=u: blank(s, u=u))
        for u in (2, 3)
    ]
    C += [
        dev("rack_brush_panel_1u", "Rack brush panel 1U", "Brush panel 1U", "rack_cable_panel", 11, None, ["brush panel", "cable management", "cable pass-through", "1u"], build=brush),
        dev("rack_cable_manager_dring_1u", "Rack cable manager D-ring 1U", "D-ring 1U", "rack_cable_panel", 80, None, ["cable manager", "d-ring", "cable management", "1u"], build=lambda s: dring(s, u=1)),
        dev("rack_cable_manager_dring_2u", "Rack cable manager D-ring 2U", "D-ring 2U", "rack_cable_panel", 80, None, ["cable manager", "d-ring", "cable management", "2u"], u=2, build=lambda s: dring(s, u=2)),
        dev("rack_cable_manager_duct_1u", "Rack cable manager finger duct 1U", "Finger duct 1U", "rack_cable_panel", 75, None, ["cable manager", "finger duct", "cable management", "1u"], build=finger_duct),
    ]
    C += [
        dev("rack_shelf_fixed_1u", "Rack shelf fixed 1U", "Fixed 1U", "rack_shelf", 350, None, ["shelf", "rack shelf", "fixed shelf", "tray", "1u"], rack={"u": 1, "shelf": True}, build=lambda s: shelf(s, u=1, cantilever=False)),
        dev("rack_shelf_fixed_2u", "Rack shelf fixed 2U", "Fixed 2U", "rack_shelf", 450, None, ["shelf", "rack shelf", "fixed shelf", "tray", "2u"], rack={"u": 2, "shelf": True}, build=lambda s: shelf(s, u=2, cantilever=False)),
        dev("rack_shelf_cantilever_1u", "Rack shelf cantilever 1U", "Cantilever 1U", "rack_shelf", 250, None, ["shelf", "rack shelf", "cantilever shelf", "tray", "1u"], rack={"u": 1, "shelf": True}, build=lambda s: shelf(s, u=1, cantilever=True)),
    ]
    for c in C:
        if c["id"].startswith("rack_shelf"):
            c["shelf"] = True
    UPS = ["ups", "uninterruptible power supply", "battery backup"]
    C += [
        dev("rack_ups_1u_cyberpower", "Rack UPS 1U CyberPower style", "UPS 1U CyberPower", "rack_ups", 389, 25, UPS + ["cyberpower", "1u"], build=lambda s: ups({**s, "body_w": 433}, u=1, brand="cyberpower")),
        dev("rack_ups_1u_cyberpower_short", "Rack UPS 1U short-depth CyberPower style", "UPS 1U short-depth", "rack_ups", 230, 15, UPS + ["cyberpower", "short depth", "1u"], build=lambda s: ups({**s, "body_w": 433}, u=1, brand="cyberpower")),
        dev("rack_ups_1u_eaton", "Rack UPS 1U Eaton style", "UPS 1U Eaton", "rack_ups", 509, 25, UPS + ["eaton", "1u"], build=lambda s: ups({**s, "body_w": 438}, u=1, brand="eaton")),
        dev("rack_ups_2u_apc", "Rack UPS 2U APC style", "UPS 2U APC", "rack_ups", 457, 35, UPS + ["apc", "smart-ups", "2u"], u=2, build=lambda s: ups({**s, "body_w": 432}, u=2, brand="apc")),
    ]
    PDU = ["pdu", "power distribution unit", "power strip", "sockets"]
    C += [
        dev("rack_pdu_1u_8way_c13", "Rack PDU 1U 8-way C13", "1U 8-way C13", "rack_pdu", 50, 2, PDU + ["c13", "horizontal", "1u"], build=lambda s: pdu_h(s, ways=8, uk=False)),
        dev("rack_pdu_1u_8way_uk", "Rack PDU 1U 8-way UK sockets", "1U 8-way UK", "rack_pdu", 50, 2, PDU + ["uk sockets", "13a", "horizontal", "1u"], build=lambda s: pdu_h(s, ways=8, uk=True)),
        dev("rack_pdu_1u_metered_8way", "Rack PDU 1U 8-way metered", "1U 8-way metered", "rack_pdu", 50, 3, PDU + ["metered", "horizontal", "1u"], build=lambda s: pdu_h(s, ways=8, uk=False, meter=True)),
        dev("rack_pdu_vertical_8_0u", "Vertical PDU 8-way 0U", "Vertical 8-way 0U", "rack_pdu", 45, 2, PDU + ["vertical", "0u"], rack={"u": 0}, build=lambda s: pdu_v(s, ways=8, length=0.4)),
        dev("rack_pdu_vertical_24_0u", "Vertical PDU 24-way 0U", "Vertical 24-way 0U", "rack_pdu", 45, 3, PDU + ["vertical", "0u"], rack={"u": 0}, build=lambda s: pdu_v(s, ways=24, length=1.4)),
    ]
    for c in C:
        if c["id"].startswith("rack_pdu_vertical"):
            c["mount"], c["wall_y"] = "wall", 0.3
    SRV = ["server", "rack server"]
    C += [
        dev("rack_server_1u", "Rack server 1U", "Server 1U", "rack_server", 600, 150, SRV + ["1u"], build=lambda s: server(s, u=1, cols=4, rows=1)),
        dev("rack_server_1u_short", "Rack server 1U short-depth", "Server 1U short-depth", "rack_server", 400, 90, SRV + ["short depth", "1u"], build=lambda s: server(s, u=1, cols=2, rows=1)),
        dev("rack_server_2u", "Rack server 2U", "Server 2U", "rack_server", 650, 250, SRV + ["2u"], u=2, build=lambda s: server(s, u=2, cols=4, rows=3)),
    ]
    NAS = ["nas", "rack nas", "synology", "storage"]
    C += [
        dev("rack_nas_1u_4bay", "Rack NAS 4-bay 1U", "NAS 4-bay 1U", "rack_nas", 327.5, 38, NAS + ["4 bay", "1u"], build=lambda s: nas(s, u=1, cols=4, rows=1)),
        dev("rack_nas_2u_8bay", "Rack NAS 8-bay 2U", "NAS 8-bay 2U", "rack_nas", 306.6, 50, NAS + ["8 bay", "2u"], u=2, build=lambda s: nas(s, u=2, cols=4, rows=2)),
        dev("rack_nas_2u_12bay", "Rack NAS 12-bay 2U", "NAS 12-bay 2U", "rack_nas", 552, 120, NAS + ["12 bay", "2u"], u=2, build=lambda s: nas(s, u=2, cols=4, rows=3)),
    ]

    out: dict[str, dict] = {}
    for c in C:
        c["rack"] = dict(c["rack"])
        g = c["build"](c)
        # a builder may widen the spec (half width)
        item = g.item(c)
        if g.w < 300 and "width" not in item["rack"]:
            item["rack"]["width"] = "half"
        out[c["id"]] = item
    return out


def text_of(item: dict) -> str:
    """The JSON the way the starters are written: one part or symbol per line."""
    head = {k: v for k, v in item.items() if k not in ("parts", "symbol")}
    lines = ["{"]
    for k, v in head.items():
        lines.append(f"  {json.dumps(k)}: {json.dumps(v, ensure_ascii=False)},")
    lines.append('  "parts": [')
    lines.append(",\n".join("    " + json.dumps(p, ensure_ascii=False) for p in item["parts"]))
    lines.append("  ],")
    lines.append('  "symbol": [')
    lines.append("    " + json.dumps(item["symbol"][0]))
    lines.append("  ]")
    lines.append("}")
    return "\n".join(lines) + "\n"


def main(argv: list[str]) -> int:
    items = build_all()
    check = "--check" in argv
    bad = 0
    for id, item in items.items():
        path = path_of(id)
        text = text_of(item)
        if check:
            if not path.exists() or path.read_text(encoding="utf8") != text:
                print(f"differs: {path.name}")
                bad += 1
        else:
            path.write_text(text, encoding="utf8", newline="\n")
            print(f"{path.parent.parent.name}/network/{id}.json ({len(item['parts'])} parts)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
