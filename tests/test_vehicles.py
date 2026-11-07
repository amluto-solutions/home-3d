"""The vehicles catalogue (#129): ~200 cars for 20 brands plus bikes, snowmobiles, golf carts and the like."""

from __future__ import annotations

from collections import Counter
import colorsys
import importlib.util
import json
from pathlib import Path

import voluptuous as vol

from custom_components.home_3d import packs

ROOT = Path(__file__).resolve().parent.parent
VEHICLES = ROOT / "custom_components" / "home_3d" / "bundled_packs" / "amluto.outdoor" / "vehicle"
DOC = ROOT / "docs" / "vehicles.md"


def _items() -> dict[str, dict]:
    return {f.stem: json.loads(f.read_text(encoding="utf-8")) for f in sorted(VEHICLES.glob("*.json"))}


def _data():
    spec = importlib.util.spec_from_file_location("vehicles_data", ROOT / "tools" / "vehicles_data.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def _car_ids() -> dict[str, tuple]:
    data = _data()
    return {data.car_id(b, m[0]): (b, *m) for b, _name, _site, models in data.BRANDS for m in models}


def test_the_pack_has_about_two_hundred_cars_from_twenty_brands() -> None:
    data = _data()
    assert len(data.BRANDS) == 20
    ids = _car_ids()
    assert 190 <= len(ids) <= 210
    assert len(set(ids)) == sum(len(m) for *_x, m in data.BRANDS), "no two cars share an id"
    items = _items()
    assert not [i for i in ids if i not in items]
    for brand, _name, _site, models in data.BRANDS:
        assert 7 <= len(models) <= 10, brand


def test_every_car_is_a_vehicle_for_parking_spots_painted_in_the_paint_role() -> None:
    items = _items()
    for i in _car_ids():
        item = items[i]
        assert item["vehicle"] is True, i
        assert any(p["color"] == "paint" for p in item["parts"]), i
        assert len(item["parts"]) <= 40, i
        assert 3.4 <= item["size"][1] <= 6.0 and 1.5 <= item["size"][0] <= 2.2 and 1.2 <= item["size"][2] <= 2.0, i
        packs.ITEM_SCHEMA(item)


def test_a_car_has_the_real_outer_size_and_the_checklist_lists_it() -> None:
    puma = _items()["ford_puma"]
    assert puma["size"] == [1.805, 4.186, 1.55]
    doc = DOC.read_text(encoding="utf-8")
    assert "Ford Puma" in doc and "4186" in doc
    items = _items()
    for i in _car_ids():
        assert items[i]["name"]["en"] in doc, i


def test_every_car_has_a_checked_status_and_a_source() -> None:
    data = _data()
    ids = _car_ids()
    assert set(data.CHECKS) == set(ids), "CHECKS lists exactly the cars"
    doc = DOC.read_text(encoding="utf-8")
    for i, (status, source) in data.CHECKS.items():
        assert status in {"verified", "single source", "unverified"}, i
        assert source.strip(), i
        if status == "verified":
            assert "Auto Express" in source and "auto-data.net" in source, i
        assert f"`{i}` | {status} |" in doc, i


def test_the_other_vehicles_are_there_and_use_the_paint_role() -> None:
    items = _items()
    kinds = {
        "snowmobile": 3,
        "bicycle": 8,
        "motorbike": 5,
        "golf_cart": 3,
        "scooter": 4,
        "quad": 1,
        "mobility_scooter": 1,
    }
    for prefix, least in kinds.items():
        found = [i for i in items if i.startswith(prefix)]
        assert len(found) >= least, (prefix, found)
    for i in items:
        if i.startswith(("snowmobile", "golf_cart", "mobility_scooter", "quad")):
            assert any(p["color"] == "paint" for p in items[i]["parts"]), i


def _striking(hex_: str) -> bool:
    """A fixed colour that reads as a body colour: a strong hue or a light one (white, cream), not a grey or black
    trim, tyre or engine."""
    r, g, b = (int(hex_[i : i + 2], 16) / 255 for i in (1, 3, 5))
    _hue, sat, val = colorsys.rgb_to_hsv(r, g, b)
    return (sat >= 0.25 and val >= 0.15) or val >= 0.8


def test_every_vehicle_has_its_body_in_the_paint_role() -> None:
    """#404: the item panel's car colours change a vehicle's body, so every vehicle paints its body in `paint`: the
    paint parts are bigger than the parts in any fixed body-like colour (wheels, lying along an axis, aside)."""
    vehicles = {i: item for i, item in _items().items() if item.get("vehicle")}
    assert len(vehicles) >= 241
    for i, item in vehicles.items():
        volume: Counter[str] = Counter()
        for p in item["parts"]:
            if not p.get("axis"):
                volume[p["color"]] += p["w"] * p["d"] * p["h"]
        assert volume["paint"] > 0, f"{i} has no part in the paint role"
        fixed = [v for colour, v in volume.items() if colour.startswith("#") and _striking(colour)]
        assert volume["paint"] > max(fixed, default=0), f"{i} has a bigger part in a fixed colour than its paint"


def test_a_colourway_keeps_its_colour_as_the_items_own_paint() -> None:
    """#404: the Leaf's colourways and the first bikes, mopeds and scooters were drawn in fixed colours; their body is
    now in `paint`, with the colourway's colour as the item's own one, so each looks as before until repainted."""
    items = _items()
    expected = {
        "nissan_leaf": "#e9ebee",
        "nissan_leaf_black": "#1d1e21",
        "nissan_leaf_blue": "#1f4f8f",
        "nissan_leaf_grey": "#6f757b",
        "nissan_leaf_red": "#a51c2c",
        "nissan_leaf_red_black_roof": "#a51c2c",
        "bicycle": "#2f5d8a",
        "bicycle_child": "#c0392b",
        "bicycle_electric": "#4a4f55",
        "moped_cream": "#e8dfc4",
        "moped_red": "#b72a2a",
        "motorbike_roadster": "#c1272d",
        "motorbike_sport": "#1f4f9a",
        "scooter_electric": "#2c2f33",
        "scooter_kick_adult": "#25262a",
        "scooter_kids_3_wheel": "#2f8fd0",
    }
    for i, paint in expected.items():
        item = items[i]
        assert item["colors"] == {"paint": paint}, i
        # tyres and bars (cylinders) may share a dark paint's colour; no box-like body part keeps it
        body = [p for p in item["parts"] if p["shape"] != "cyl"]
        assert all(p["color"] != paint for p in body), f"{i} still has a body part in the fixed colour"
        packs.ITEM_SCHEMA(item)
    # the two-tone Leaf keeps its black roof and mirrors as fixed parts
    assert sum(p["color"] == "#1d1e21" for p in items["nissan_leaf_red_black_roof"]["parts"]) == 3


def test_an_items_own_role_colours_are_hex_colours_of_known_roles() -> None:
    item = {**_items()["nissan_leaf"]}
    assert packs.ITEM_SCHEMA(item)["colors"] == {"paint": "#e9ebee"}
    for bad in ({"paint": "red"}, {"roof": "#000000"}, {}):
        try:
            packs.ITEM_SCHEMA({**item, "colors": bad})
        except vol.Invalid:
            continue
        raise AssertionError(bad)


def test_the_existing_vehicles_are_untouched() -> None:
    items = _items()
    for i in (
        "nissan_leaf",
        "nissan_leaf_black",
        "bicycle",
        "bicycle_child",
        "bicycle_electric",
        "moped_red",
        "scooter_kick_adult",
    ):
        assert i in items
    assert items["nissan_leaf"]["electric"] is True


def test_the_pack_stays_under_the_item_limit_with_room_to_spare() -> None:
    folder = ROOT / "custom_components" / "home_3d" / "bundled_packs" / "amluto.outdoor"
    count = len([f for f in folder.rglob("*.json") if f.name != packs.PACK_FILE])
    assert count <= 600 < packs.MAX_ITEMS
