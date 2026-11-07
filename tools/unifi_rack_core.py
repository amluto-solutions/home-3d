#!/usr/bin/env python3
"""Writes the UniFi rack gateways, NVRs and storage (#145) into amluto.unifi/network.

    python tools/unifi_rack_core.py            write the files
    python tools/unifi_rack_core.py --check    exit 1 when a file differs from what this would write

Uses the drawing helpers of tools/rack_gear.py (not edited). Sizes and sources: docs/unifi/rack-core.md.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "custom_components/home_3d/bundled_packs/amluto.unifi/network"

_spec = importlib.util.spec_from_file_location("rack_gear", ROOT / "tools" / "rack_gear.py")
assert _spec and _spec.loader
rg = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rg)

PANEL, GEAR_H, SILVER = rg.PANEL, rg.GEAR_H, rg.SILVER
TAGS = ["unifi", "ubiquiti", "rack mount", "19 inch", "rack"]


def gateway(spec, *, rj45_rows, rj45_cols, sfp, sfp_rows, bays=0, small_ports=0):
    g = rg.Gear(PANEL, spec["depth"], GEAR_H[1])
    h = g.h
    g.body(PANEL - 40.4, SILVER)
    g.ears(SILVER)
    x = -PANEL / 2 + 28
    g.front(x + 15, h / 2 - 10, 30, 20, "glass", 4)  # 1.3 inch touchscreen
    x += 40
    if bays:
        g.bays(x, 8, bays, 1, 30, h - 16, 4, rg.GREY)
        x += bays * 34 + 8
    if small_ports:
        x = g.ports(x, small_ports, 1, group=2) + 8
    end = g.ports(x, rj45_cols, rj45_rows, group=4)
    g.sfp(end + 12, sfp, sfp_rows)
    g.led(PANEL / 2 - 32, h - 8)
    return g


def storage(spec, *, u, cols, rows, silver=True):
    h = GEAR_H[u]
    g = rg.Gear(PANEL, spec["depth"], h)
    g.body(PANEL - 40.4, SILVER if silver else rg.BODY)
    g.ears(SILVER if silver else rg.BODY)
    bw = (PANEL - 40.4 - 80 - (cols - 1) * 3) / cols
    bh = (h - 12 - (rows - 1) * 3) / rows
    g.bays(-PANEL / 2 + 30, 6, cols, rows, bw, bh, 3, rg.GREY)
    g.led(PANEL / 2 - 36, h - 8)
    return g


def dev(id, name, variant, family, depth, watts, tags, u, build):
    return dict(
        id=id,
        name=name,
        variant=variant,
        family=family,
        depth=depth,
        watts=watts,
        tags=tags + TAGS,
        rack={"u": u},
        build=build,
    )


GW = ["gateway", "router", "firewall", "1u"]
CATALOGUE = [
    dev(
        "rack_unifi_efg",
        "UniFi Enterprise Fortress Gateway (EFG)",
        "EFG",
        "rack_gateway",
        325,
        82,
        [*GW, "efg", "fortress", "25g"],
        1,
        lambda s: gateway(s, rj45_rows=1, rj45_cols=2, sfp=4, sfp_rows=2),
    ),
    dev(
        "rack_unifi_uxg_enterprise",
        "UniFi Gateway Enterprise (UXG-Enterprise)",
        "UXG-Enterprise",
        "rack_gateway",
        325,
        82,
        [*GW, "uxg enterprise", "25g"],
        1,
        lambda s: gateway(s, rj45_rows=1, rj45_cols=2, sfp=4, sfp_rows=2),
    ),
    dev(
        "rack_unifi_ef_core",
        "UniFi Enterprise Firewall Core (EF-Core)",
        "EF-Core",
        "rack_gateway",
        400,
        171,
        [*GW, "ef core", "100g", "25g"],
        1,
        lambda s: gateway(s, rj45_rows=2, rj45_cols=5, sfp=8, sfp_rows=2, small_ports=2),
    ),
    dev(
        "rack_unifi_udm_beast",
        "UniFi Dream Machine Beast",
        "UDM Beast",
        "rack_gateway",
        325,
        100,
        [*GW, "udm beast", "25g", "nvr"],
        1,
        lambda s: gateway(s, rj45_rows=2, rj45_cols=5, sfp=4, sfp_rows=2, bays=2, small_ports=0),
    ),
    dev(
        "rack_unifi_envr",
        "UniFi Enterprise NVR (ENVR) 16-bay",
        "ENVR 16-bay 3U",
        "rack_nvr",
        480,
        410,
        ["nvr", "protect", "envr", "enterprise", "3u"],
        3,
        lambda s: storage(s, u=3, cols=4, rows=4),
    ),
    dev(
        "rack_unifi_unas_pro_4",
        "UniFi UNAS Pro 4",
        "UNAS Pro 4 1U",
        "rack_nas",
        400,
        150,
        ["nas", "storage", "unas pro 4", "4 bay", "1u"],
        1,
        lambda s: storage(s, u=1, cols=4, rows=1),
    ),
    dev(
        "rack_unifi_unas_pro_8",
        "UniFi UNAS Pro 8",
        "UNAS Pro 8 2U",
        "rack_nas",
        480,
        250,
        ["nas", "storage", "unas pro 8", "8 bay", "2u"],
        2,
        lambda s: storage(s, u=2, cols=4, rows=2),
    ),
    dev(
        "rack_unifi_enas",
        "UniFi Enterprise NAS (ENAS) 16-bay",
        "ENAS 16-bay 3U",
        "rack_nas",
        480,
        550,
        ["nas", "storage", "enas", "enterprise", "16 bay", "3u"],
        3,
        lambda s: storage(s, u=3, cols=4, rows=4),
    ),
    dev(
        "rack_unifi_ese_16",
        "UniFi Enterprise Storage Expansion (UACC-ESE-16)",
        "ESE 16-bay 3U",
        "rack_nas",
        480,
        550,
        ["storage expansion", "jbod", "ese", "enterprise", "16 bay", "3u"],
        3,
        lambda s: storage(s, u=3, cols=4, rows=4),
    ),
]


def build_all() -> dict[str, dict]:
    out: dict[str, dict] = {}
    for c in CATALOGUE:
        c = dict(c)
        g = c["build"](c)
        out[c["id"]] = g.item(c)
    return out


def main(argv: list[str]) -> int:
    check = "--check" in argv
    bad = 0
    for id, item in build_all().items():
        path = OUT / f"{id}.json"
        text = rg.text_of(item)
        if check:
            if not path.exists() or path.read_text(encoding="utf8") != text:
                print(f"differs: {path.name}")
                bad += 1
        else:
            path.write_text(text, encoding="utf8", newline="\n")
            print(f"network/{id}.json ({len(item['parts'])} parts)")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
