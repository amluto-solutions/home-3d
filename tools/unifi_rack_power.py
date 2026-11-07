#!/usr/bin/env python3
"""Writes the UniFi rack power and accessory items (#145) into the UniFi pack.

    python tools/unifi_rack_power.py            write amluto.unifi/network/unifi_*.json
    python tools/unifi_rack_power.py --check    exit 1 when a file differs from what this would write

Edit the catalogue in `build_all()`, not the JSON. Sizes and sources are in docs/unifi/rack-power.md. The drawing
helpers, rack constants and the JSON writer come from tools/rack_gear.py (which is not edited here).
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("rack_gear", ROOT / "tools" / "rack_gear.py")
assert _spec and _spec.loader
rg = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rg)

OUT = ROOT / "custom_components/home_3d/bundled_packs/amluto.unifi/network"
Gear, PANEL, GEAR_H, SILVER, DARK, BODY = rg.Gear, rg.PANEL, rg.GEAR_H, rg.SILVER, rg.DARK, rg.BODY
BODY_W = 442.4  # UniFi body width between the ears
COMMON = ["unifi", "ubiquiti", "rack mount", "19 inch", "rack"]


def socket_bank(g: Gear, x0: float, cols: int, rows: int, pitch: float, y_mid: float, w=30.0, h=24.0) -> None:
    gap = 4.0
    total = rows * h + (rows - 1) * gap
    for row in range(rows):
        y = y_mid - total / 2 + row * (h + gap)
        g.front(x0 + cols * pitch / 2, y - 2, cols * pitch, h + 4, DARK, 4)  # one dark strip behind the row
        for i in range(cols):
            g.front(x0 + i * pitch + pitch / 2, y, w, h, "white", 5)


def pdu_pro(spec):
    h = GEAR_H[2]
    g = Gear(PANEL, spec["depth"], h)
    g.body(BODY_W, SILVER)
    g.ears(SILVER)
    g.front(-PANEL / 2 + 70, h / 2 - 20, 70, 40, "glass", 4)  # the colour touchscreen
    for i in range(4):  # USB-C
        g.front(-PANEL / 2 + 125 + i * 10, h - 18, 7, 4, "metal", 4)
    socket_bank(g, -PANEL / 2 + 125, 8, 2, 37.0, h / 2)
    g.led(PANEL / 2 - 35, h - 10)
    return g


def pdu_hd(spec):
    g = Gear(55.0, 56.0, 1485.0)
    g.body(55.0, SILVER)
    step = (g.h - 140) / 12
    for bank in (0, 1):  # two banks of 12 along the length, one each side
        for i in range(12):
            g.front((-1 if bank == 0 else 1) * 13, 70 + i * step, 22, step * 0.7, "white", 5)
    g.front(0, g.h - 60, 30, 36, "glass", 4)
    g.led(0, 30)
    return g


def rps(spec):
    h = GEAR_H[1]
    g = Gear(PANEL, spec["depth"], h)
    g.body(BODY_W, SILVER)
    g.ears(SILVER)
    for i in range(6):  # six RPS DC ports
        g.front(-PANEL / 2 + 70 + i * 42, 10, 30, h - 20, DARK, 6)
    g.front(PANEL / 2 - 70, h / 2 - 8, 36, 16, "glass", 4)
    g.led(PANEL / 2 - 32, h - 8)
    return g


def ups(spec, *, u):
    h = GEAR_H[u]
    g = Gear(PANEL, spec["depth"], h)
    g.body(BODY_W, SILVER)
    g.ears(SILVER)
    for i in range(10):  # vents on the left
        g.front(-PANEL / 2 + 40 + i * 14, 8, 6, h - 16, "#0c0d0f", 3)
    g.front(PANEL / 2 - 110, h / 2 - 12, 56, 24, "glass", 4)  # LCD
    for i in range(2):
        g.front(PANEL / 2 - 45 + i * 14, h / 2 - 5, 9, 9, "metal", 4)
    g.led(PANEL / 2 - 30, h - 10)
    return g


def panel(spec, *, u, kind):
    h = GEAR_H[u]
    g = Gear(PANEL, spec["depth"], h)
    g.body(BODY_W, BODY)
    g.ears()
    if kind == "vented":
        rows = u * 3
        for row in range(rows):  # one long slot per row
            g.front(0, 6 + row * ((h - 12) / rows), 400, 3, "#0c0d0f", 4)
    elif kind == "brush":
        g.front(0, 8, 400, 24, "#050506", 4)
        g.front(0, 8, 400, 9, "#3b3d42", 6)
    return g


def build_all() -> dict[str, dict]:
    def dev(id, name, variant, family, depth, watts, tags, u=1, rack=None, build=None, **kw):
        return dict(
            id=id,
            name=name,
            variant=variant,
            family=family,
            depth=depth,
            watts=watts,
            tags=tags + COMMON,
            rack=rack or {"u": u},
            build=build,
            **kw,
        )

    PDU = ["pdu", "power distribution", "power strip", "sockets", "smart pdu"]
    UPS = ["ups", "uninterruptible power supply", "battery backup"]
    C = [
        dev(
            "unifi_usp_pdu_pro",
            "UniFi Power Distribution Pro",
            "Power Distribution Pro 2U",
            "unifi_rack_pdu",
            106,
            10,
            [*PDU, "usp-pdu-pro", "2u"],
            u=2,
            build=pdu_pro,
        ),
        dev(
            "unifi_usp_pdu_hd",
            "UniFi Power Distribution Hi-Density",
            "Power Distribution Hi-Density 0U",
            "unifi_rack_pdu",
            56,
            10,
            [*PDU, "usp-pdu-hd", "vertical", "0u"],
            rack={"u": 0},
            build=pdu_hd,
            mount="wall",
            wall_y=0.3,
        ),
        dev(
            "unifi_usp_rps",
            "UniFi Redundant Power",
            "Redundant Power 1U",
            "unifi_rack_power",
            325.6,
            40,
            ["rps", "usp-rps", "redundant power", "power supply", "1u"],
            build=rps,
        ),
        dev(
            "unifi_ups_2u",
            "UniFi UPS 2U",
            "UPS 2U",
            "unifi_rack_ups",
            300,
            30,
            [*UPS, "ups-2u", "2u"],
            u=2,
            build=lambda s: ups(s, u=2),
        ),
        dev(
            "unifi_ups_2u_pro",
            "UniFi UPS 2U Pro",
            "UPS 2U Pro",
            "unifi_rack_ups",
            630,
            40,
            [*UPS, "ups-2u-pro", "2u"],
            u=2,
            build=lambda s: ups(s, u=2),
        ),
        dev(
            "unifi_rack_patch_panel_24",
            "UniFi 24-port blank keystone patch panel",
            "Patch panel 24-port 1U",
            "unifi_rack_patch_panel",
            63.5,
            None,
            ["patch panel", "keystone", "cabling", "24 port", "1u"],
            build=lambda s: rg.patch_panel(s, ports=24, rows=1),
        ),
        dev(
            "unifi_rack_ocd_blank_1u",
            "UniFi rack panel blank 1U",
            "Blank 1U",
            "unifi_rack_panel",
            63.5,
            None,
            ["blanking plate", "blank panel", "ocd panel", "1u"],
            build=lambda s: panel(s, u=1, kind="blank"),
        ),
        dev(
            "unifi_rack_ocd_blank_2u",
            "UniFi rack panel blank 2U",
            "Blank 2U",
            "unifi_rack_panel",
            63.5,
            None,
            ["blanking plate", "blank panel", "ocd panel", "2u"],
            u=2,
            build=lambda s: panel(s, u=2, kind="blank"),
        ),
        dev(
            "unifi_rack_ocd_vented_1u",
            "UniFi rack panel vented 1U",
            "Vented 1U",
            "unifi_rack_panel",
            63.5,
            None,
            ["vented panel", "ocd panel", "ventilation", "1u"],
            build=lambda s: panel(s, u=1, kind="vented"),
        ),
        dev(
            "unifi_rack_ocd_vented_2u",
            "UniFi rack panel vented 2U",
            "Vented 2U",
            "unifi_rack_panel",
            63.5,
            None,
            ["vented panel", "ocd panel", "ventilation", "2u"],
            u=2,
            build=lambda s: panel(s, u=2, kind="vented"),
        ),
        dev(
            "unifi_rack_ocd_brush_1u",
            "UniFi rack panel brush 1U",
            "Brush 1U",
            "unifi_rack_panel",
            63.5,
            None,
            ["brush panel", "ocd panel", "cable management", "cable pass-through", "1u"],
            build=lambda s: panel(s, u=1, kind="brush"),
        ),
        dev(
            "unifi_rack_shelf_cantilever",
            "UniFi fixed rack shelf (cantilever)",
            "Fixed shelf 1U",
            "unifi_rack_shelf",
            250,
            None,
            ["shelf", "rack shelf", "cantilever shelf", "tray", "1u"],
            rack={"u": 1, "shelf": True},
            build=lambda s: rg.shelf(s, u=1, cantilever=True),
            shelf=True,
        ),
    ]
    out: dict[str, dict] = {}
    for c in C:
        c["rack"] = dict(c["rack"])
        g = c["build"](c)
        out[c["id"]] = g.item(c)
    return out


text_of = rg.text_of


def main(argv: list[str]) -> int:
    items = build_all()
    check = "--check" in argv
    bad = 0
    for id, item in items.items():
        path = OUT / f"{id}.json"
        text = text_of(item)
        if check:
            if not path.exists() or path.read_text(encoding="utf8") != text:
                print(f"differs: {path.name}")
                bad += 1
        else:
            OUT.mkdir(parents=True, exist_ok=True)
            path.write_text(text, encoding="utf8", newline="\n")
            print(f"network/{id}.json ({len(item['parts'])} parts)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
