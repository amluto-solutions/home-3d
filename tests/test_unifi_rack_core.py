"""tools/unifi_rack_core.py: the UniFi rack-core items (#145) match the generator and fit the rack rules. No network."""

from __future__ import annotations

import importlib.util
from pathlib import Path

from custom_components.home_3d.packs import ITEM_SCHEMA

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("unifi_rack_core", ROOT / "tools" / "unifi_rack_core.py")
assert _spec and _spec.loader
gen = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(gen)

ITEMS = gen.build_all()
U = 0.04445
PACKS = ROOT / "custom_components/home_3d/bundled_packs"


def test_files_match_the_generator() -> None:
    for id, item in ITEMS.items():
        path = gen.OUT / f"{id}.json"
        assert path.read_text(encoding="utf8") == gen.rg.text_of(item), f"{id}: run python tools/unifi_rack_core.py"
    # the UniFi network folder is shared with the other UniFi gear (#145): every item of ours is there
    assert set(ITEMS) <= {p.stem for p in gen.OUT.glob("*.json")}


def test_every_item_is_valid_and_light() -> None:
    assert len(ITEMS) >= 9
    for id, item in ITEMS.items():
        ITEM_SCHEMA(item)
        assert len(id) <= 40 and len(item["parts"]) <= 25, id


def test_height_matches_the_rack_units() -> None:
    for id, item in ITEMS.items():
        u = item["rack"]["u"]
        assert u >= 1, id
        assert u * U - 0.002 <= item["size"][2] <= u * U + 0.0005, id
        assert item["size"][0] == 0.4826, id


def test_electric_gear_has_watts_and_ids_are_unique() -> None:
    for id, item in ITEMS.items():
        assert item.get("electric") and item["watts"] > 0, id
    own = set(ITEMS)
    others = {p.stem for p in PACKS.glob("*/*/*.json") if gen.OUT not in p.parents}
    assert not own & others
