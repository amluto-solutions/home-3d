"""tools/unifi_rack_power.py: the UniFi rack power items (#145) match the generator and the rack rules."""

from __future__ import annotations

import importlib.util
from pathlib import Path

from custom_components.home_3d.packs import ITEM_SCHEMA

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("unifi_rack_power", ROOT / "tools" / "unifi_rack_power.py")
assert _spec and _spec.loader
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)

ITEMS = gen.build_all()
U = 0.04445


def test_files_match_the_generator() -> None:
    for id, item in ITEMS.items():
        path = gen.OUT / f"{id}.json"
        assert path.read_text(encoding="utf8") == gen.text_of(item), f"{id}: run python tools/unifi_rack_power.py"


def test_every_item_is_valid_and_light() -> None:
    assert len(ITEMS) >= 10
    for id, item in ITEMS.items():
        ITEM_SCHEMA(item)
        assert len(id) <= 40 and len(item["parts"]) <= 30, id


def test_height_matches_the_rack_units() -> None:
    for id, item in ITEMS.items():
        u = item["rack"]["u"]
        h = item["size"][2]
        if u == 0:
            assert h >= 0.3, id
        else:
            assert u * U - 0.002 <= h <= u * U + 0.0005, f"{id}: {h} m for {u}U"
            assert item["size"][0] == 0.4826, id


def test_electric_gear_has_watts() -> None:
    for id, item in ITEMS.items():
        assert ("watts" in item) == bool(item.get("electric")), id
