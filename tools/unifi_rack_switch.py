#!/usr/bin/env python3
"""Writes the UniFi rack switches (#145) into the UniFi pack, folder network.

    python tools/unifi_rack_switch.py            write amluto.unifi/network/<id>.json for every switch below
    python tools/unifi_rack_switch.py --check    exit 1 when a file differs from what this would write

Edit the catalogue (`build_all`), not the JSON. Sizes and sources are in docs/unifi/rack-switch.md.
Drawing helpers and the JSON layout come from tools/rack_gear.py (the same rack rules apply: 19 inch panel, height
= U less 0.8 mm, front face at +z).
"""

from __future__ import annotations

import importlib.util
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "custom_components/home_3d/bundled_packs/amluto.unifi/network"

_spec = importlib.util.spec_from_file_location("rack_gear", ROOT / "tools" / "rack_gear.py")
assert _spec and _spec.loader
rack_gear = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rack_gear)

Gear = rack_gear.Gear
text_of = rack_gear.text_of
PANEL = rack_gear.PANEL
SILVER = rack_gear.SILVER
H = rack_gear.GEAR_H[1]
BODY_W = 442.4  # the maker's body width; the ears make up the 482.6 panel


def cage_width(count: int, rows: int, pitch: float, group: int) -> float:
    per_row = -(-count // rows)
    blocks = -(-per_row // group)
    return per_row * pitch + (blocks - 1) * 4.0 - 1.0


def cages(g: Gear, x0: float, count: int, rows: int, pitch: float, group: int, color: str = "metal") -> float:
    """SFP / QSFP cages as one flat bar per block of `group` cages. Returns the right edge."""
    per_row = -(-count // rows)
    ch = 9.0 if rows > 1 else 12.0
    total = rows * ch + (rows - 1) * 3
    for row in range(rows):
        y = H / 2 - total / 2 + row * (ch + 3)
        x = x0
        left = per_row
        while left > 0:
            n = min(group, left)
            g.front(x + (n * pitch - 1) / 2, y, n * pitch - 1, ch, color, 4)
            x += n * pitch + 4
            left -= n
    return x0 + cage_width(count, rows, pitch, group)


def unifi_switch(spec: dict, *, rj45=0, rows=2, group=4, cage_groups=(), poe=False) -> Gear:
    """cage_groups: (count, rows, pitch, group) tuples, drawn left to right at the right end of the panel."""
    g = Gear(PANEL, spec["depth"], H)
    g.body(BODY_W, SILVER)
    g.ears(SILVER)
    x = -PANEL / 2 + 28
    g.front(x + 14, H / 2 - 8, 28, 16, "glass", 4)  # the touchscreen
    x += 36
    end = x
    if rj45:
        end = g.ports(x, rj45 // rows, rows, group=group)
    widths = [cage_width(*c) for c in cage_groups]
    total = sum(widths) + 8.0 * max(len(widths) - 1, 0)
    cx = max(end + 12, PANEL / 2 - 30 - total) if rj45 else x
    for c, w in zip(cage_groups, widths, strict=True):
        cages(g, cx, *c)
        cx += w + 8.0
    g.led(PANEL / 2 - 32, H - 8)
    if poe:
        g.led(PANEL / 2 - 40, H - 8, "white")
    return g


def build_all() -> dict[str, dict]:
    C: list[dict] = []

    def add(key, name, variant, depth, watts, *, poe=False, extra=(), **kw):
        tags = ["switch", "network switch", "unifi", "ubiquiti", "1u", "rack mount", "19 inch", "rack", *extra]
        if poe:
            tags.insert(2, "poe")
        C.append(
            dict(
                id=f"rack_unifi_{key}",
                name=f"UniFi {name}",
                variant=f"UniFi {variant}",
                family="rack_switch",
                depth=depth,
                watts=watts,
                tags=tags,
                rack={"u": 1},
                build=lambda s, kw=kw, poe=poe: unifi_switch(s, poe=poe, **kw),
            )
        )

    two = (2, 1, 17.0, 2)  # two SFP / SFP+ cages in a row
    four = (4, 2, 17.0, 2)  # four in two rows
    eth = ("ethernet",)
    # Sizes and watts: techspecs.ui.com, 30 Oct 2026; watts = the maker's maximum EXCLUDING PoE output.
    # Standard
    add("usw_24", "USW 24", "Standard 24", 200, 25, rj45=24, cage_groups=[two], extra=eth)
    add("usw_24_poe", "USW 24 PoE", "Standard 24 PoE", 200, 25, poe=True, rj45=24, cage_groups=[two], extra=eth)
    add("usw_16_poe", "USW 16 PoE", "Standard 16 PoE", 200, 18, poe=True, rj45=16, cage_groups=[two], extra=eth)
    add("usw_48", "USW 48", "Standard 48", 285, 40, rj45=48, cage_groups=[four], extra=eth)
    add("usw_48_poe", "USW 48 PoE", "Standard 48 PoE", 285, 45, poe=True, rj45=48, cage_groups=[four], extra=eth)
    # Pro, Pro Max, Pro HD
    add("usw_pro_24", "USW Pro 24", "Pro 24", 285, 30, rj45=24, cage_groups=[two], extra=eth)
    add("usw_pro_48", "USW Pro 48", "Pro 48", 285, 60, rj45=48, cage_groups=[four], extra=eth)
    add("usw_pro_max_24", "USW Pro Max 24", "Pro Max 24", 325, 50, rj45=24, cage_groups=[two], extra=("2.5g",))
    add("usw_pro_max_48", "USW Pro Max 48", "Pro Max 48", 325, 100, rj45=48, cage_groups=[four], extra=("2.5g",))
    add("usw_pro_hd_24", "USW Pro HD 24", "Pro HD 24", 285, 60, rj45=24, cage_groups=[four], extra=("2.5g", "10g"))
    # Pro XG
    add(
        "usw_pro_xg_10_poe",
        "USW Pro XG 10 PoE",
        "Pro XG 10 PoE",
        285,
        65,
        poe=True,
        rj45=10,
        rows=1,
        group=5,
        cage_groups=[two],
        extra=("10g",),
    )
    add("usw_pro_xg_24", "USW Pro XG 24", "Pro XG 24", 480, 150, rj45=24, cage_groups=[two], extra=("10g", "25g"))
    add("usw_pro_xg_48", "USW Pro XG 48", "Pro XG 48", 480, 250, rj45=48, cage_groups=[four], extra=("10g", "25g"))
    add(
        "usw_pro_xg_48_poe",
        "USW Pro XG 48 PoE",
        "Pro XG 48 PoE",
        480,
        200,
        poe=True,
        rj45=48,
        cage_groups=[four],
        extra=("10g", "25g"),
    )
    # Aggregation (cages only)
    add(
        "usw_aggregation",
        "USW Aggregation",
        "Aggregation",
        120,
        36,
        cage_groups=[(8, 2, 17.0, 4)],
        extra=("aggregation", "sfp+"),
    )
    add(
        "usw_pro_aggregation",
        "USW Pro Aggregation",
        "Pro Aggregation",
        325,
        100,
        cage_groups=[(28, 2, 14.0, 4), four],
        extra=("aggregation", "sfp+"),
    )
    add(
        "usw_pro_xg_aggregation",
        "USW Pro XG Aggregation",
        "Pro XG Aggregation",
        480,
        200,
        cage_groups=[(32, 2, 14.0, 4)],
        extra=("aggregation", "sfp28"),
    )
    # Enterprise Campus: 24 = 8 x 2.5G + 16 x 10G, 48 = 32 x 2.5G + 16 x 10G; the S models add 100G QSFP28 uplinks
    ecs = ("enterprise campus", "10g")
    add(
        "ecs_24_poe",
        "ECS 24 PoE",
        "Enterprise Campus 24 PoE",
        496,
        150,
        poe=True,
        rj45=24,
        cage_groups=[two],
        extra=ecs,
    )
    add(
        "ecs_48_poe",
        "ECS 48 PoE",
        "Enterprise Campus 48 PoE",
        496,
        250,
        poe=True,
        rj45=48,
        cage_groups=[four],
        extra=ecs,
    )
    up = (6, 2, 14.0, 3)  # 4 x SFP28 and 2 x QSFP28
    add("ecs_24s", "ECS 24S", "Enterprise Campus 24S", 496, 150, rj45=24, cage_groups=[up], extra=ecs)
    add("ecs_48s", "ECS 48S", "Enterprise Campus 48S", 496, 250, rj45=48, cage_groups=[up], extra=ecs)
    add(
        "ecs_24s_poe",
        "ECS 24S PoE",
        "Enterprise Campus 24S PoE",
        496,
        150,
        poe=True,
        rj45=24,
        cage_groups=[up],
        extra=ecs,
    )
    add(
        "ecs_48s_poe",
        "ECS 48S PoE",
        "Enterprise Campus 48S PoE",
        496,
        250,
        poe=True,
        rj45=48,
        cage_groups=[up],
        extra=ecs,
    )
    add(
        "ecs_aggregation",
        "ECS Aggregation",
        "Enterprise Campus Aggregation",
        496,
        340,
        cage_groups=[(48, 2, 12.0, 6), up],
        extra=("enterprise campus", "sfp28"),
    )
    add(
        "ecs_core",
        "ECS Core",
        "Enterprise Campus Core",
        480,
        360,
        cage_groups=[(32, 2, 17.0, 4)],
        extra=("enterprise campus", "qsfp28"),
    )
    # Enterprise Audio/Video
    add(
        "eav_xg_24_poe",
        "EAV XG 24 PoE",
        "Enterprise A/V XG 24 PoE",
        480,
        150,
        poe=True,
        rj45=24,
        cage_groups=[four],
        extra=("enterprise a/v", "10g"),
    )
    add(
        "eav_fiber",
        "EAV Fiber",
        "Enterprise A/V Fiber",
        480,
        150,
        cage_groups=[(20, 2, 14.0, 5), two],
        extra=("enterprise a/v", "sfp+"),
    )

    out: dict[str, dict] = {}
    for c in C:
        c["rack"] = dict(c["rack"])
        c["tags"] = c["tags"][:12]
        out[c["id"]] = c["build"](c).item(c)
    return out


def main(argv: list[str]) -> int:
    items = build_all()
    check = "--check" in argv
    bad = 0
    OUT.mkdir(parents=True, exist_ok=True)
    for id, item in items.items():
        path = OUT / f"{id}.json"
        text = text_of(item)
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
