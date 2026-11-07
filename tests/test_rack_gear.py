"""tools/rack_gear.py: the bundled rack-mount gear (#117) matches the generator and fits the rack rules. No network."""

from __future__ import annotations

import importlib.util
from pathlib import Path

from custom_components.home_3d.packs import ITEM_SCHEMA

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("rack_gear", ROOT / "tools" / "rack_gear.py")
assert _spec and _spec.loader
rack_gear = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(rack_gear)

ITEMS = rack_gear.build_all()
U = 0.04445


def test_files_match_the_generator() -> None:
    for id, item in ITEMS.items():
        path = rack_gear.path_of(id)
        assert path.read_text(encoding="utf8") == rack_gear.text_of(item), f"{id}: run python tools/rack_gear.py"


def test_every_item_is_valid_and_light() -> None:
    assert len(ITEMS) >= 45
    for id, item in ITEMS.items():
        ITEM_SCHEMA(item)
        assert len(id) <= 40 and len(item["parts"]) <= 25, id


def test_height_matches_the_rack_units() -> None:
    for id, item in ITEMS.items():
        u = item["rack"]["u"]
        h = item["size"][2]
        if u == 0:
            assert h >= 0.3, id
        else:
            assert u * U - 0.002 <= h <= u * U + 0.0005, f"{id}: {h} m for {u}U"
            assert item["size"][0] in (0.4826, 0.22), id


def test_electric_gear_has_watts() -> None:
    for id, item in ITEMS.items():
        assert ("watts" in item) == bool(item.get("electric")), id
