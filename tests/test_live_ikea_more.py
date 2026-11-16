"""tools/live_ikea_more.py: more IKEA UK items are live (run 16): desks and drawer units, day-beds and loft beds with
drawers, a drawer bookcase, the washing machines, the washer-dryer and the microwave oven. No network.

The closed look of every converted item is pinned by a fixture made from the items as they were before: the parts they
had are unchanged (a `bind` apart), and so are all their other fields (size, tags, family, ...) and their plan symbol.
"""

from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path
import sys

import pytest

from custom_components.home_3d import packs

ROOT = Path(__file__).resolve().parent.parent
BUNDLED = ROOT / "custom_components" / "home_3d" / "bundled_packs"
sys.path.insert(0, str(ROOT / "tools"))


def _load(name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "tools" / f"{name}.py")
    assert spec and spec.loader
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


live_cabinets = _load("live_cabinets")
live_ikea_more = _load("live_ikea_more")
publish_packs = _load("publish_packs")
CLOSED = json.loads((ROOT / "tests" / "fixtures" / "ikea-more-closed-look.json").read_text(encoding="utf-8"))
KEYS = sorted(CLOSED)


def _item(key: str) -> dict:
    return json.loads((BUNDLED / f"{key}.json").read_text(encoding="utf-8"))


def test_the_fixture_names_the_items_the_tool_converts() -> None:
    assert sorted(f"amluto.ikea-uk/{k}" for k in live_ikea_more.item_keys()) == KEYS
    assert len(KEYS) == 22


@pytest.mark.parametrize("key", KEYS)
def test_a_converted_item_looks_the_same_closed(key: str) -> None:
    """The parts the item had are as they were but for their `bind`; everything else it holds is unchanged."""
    item, was = _item(key), CLOSED[key]
    old = [{k: v for k, v in p.items() if k != "bind"} for p in item["parts"][: was["parts"]]]
    assert live_ikea_more._digest(old) == was["look"]
    other = {k: v for k, v in item.items() if k not in ("parts", "slots", "symbol")}
    assert live_ikea_more._digest(other) == was["fields"]
    # the plan: the item's own symbol as it was, or one drawn from the old parts (what the plan drew until now)
    if was["symbol"] is not None:
        assert item["symbol"] == was["symbol"]
    elif len(item["parts"]) > was["parts"]:
        assert item["symbol"] == live_cabinets.plan_symbol({**item, "parts": old})
    else:
        assert "symbol" not in item
    assert len(item["parts"]) <= packs.MAX_PARTS


@pytest.mark.parametrize("key", KEYS)
def test_what_was_added_hides_behind_the_closed_fronts(key: str) -> None:
    """Every part added lies inside the item's box and no further out than the front of the parts that move away, so
    a closed front (or a closed door) hides it."""
    item, was = _item(key), CLOSED[key]["parts"]
    _W, D, _H = item["size"]
    moving = [p for p in item["parts"][:was] if "bind" in p]
    front = max((p["z"] + p["d"] / 2) * D for p in moving)
    for part in item["parts"][was:]:
        assert (part["z"] + part["d"] / 2) * D <= front + 1e-6
        assert abs(part["x"]) + part["w"] / 2 <= 0.5 + 1e-6
        assert part["y"] >= 0 and part["y"] + part["h"] <= 1 + 1e-6


@pytest.mark.parametrize("key", KEYS)
def test_the_item_passes_the_pack_check_and_every_slot_has_a_part(key: str) -> None:
    item = packs.ITEM_SCHEMA(_item(key))
    bound = {p["bind"]["slot"] for p in item["parts"] if "bind" in p}
    assert bound == {s["id"] for s in item["slots"]}
    assert 1 <= len(item["slots"]) <= packs.MAX_SLOTS
    # two slots of one kind need names that tell them apart in the picker
    names = [s.get("name", {}).get("en") or s["kind"] for s in item["slots"]]
    assert len(set(names)) == len(names), names
    # drawers slide, doors open, paddles spin: nothing else is used here
    assert {p["bind"]["kind"] for p in item["parts"] if "bind" in p} <= {"slide", "open", "spin"}


def test_a_second_run_changes_nothing() -> None:
    assert live_ikea_more.run(False) == []


def test_a_live_item_is_left_alone() -> None:
    for key in live_ikea_more.item_keys():
        with pytest.raises(live_cabinets.Report):
            live_ikea_more.convert(key, _item(f"amluto.ikea-uk/{key}"))


def test_the_nine_drawer_unit_and_the_desks_share_a_slot_for_their_lowest_drawers() -> None:
    nine = _item("amluto.ikea-uk/office/alex_drawer_unit_9_drawers")
    assert [s["id"] for s in nine["slots"]] == [f"drawer_{i}" for i in range(1, 9)]
    assert nine["slots"][0]["name"]["en"] == "Top drawer"
    assert nine["slots"][-1]["name"]["en"] == "Bottom two drawers"
    low = [i for i, p in enumerate(nine["parts"][:23]) if p.get("bind", {}).get("slot") == "drawer_8"]
    assert low == [5, 6, 7, 8]  # the two lowest fronts and their handles slide together
    desk = _item("amluto.ikea-uk/office/lagkapten_alex_desk_140x60")
    names = [s["name"]["en"] for s in desk["slots"]]
    assert names[:2] == ["Top left drawer", "Top right drawer"]
    assert names[-2:] == ["Bottom two left drawers", "Bottom two right drawers"]
    assert len(set(names)) == 8


def test_drawer_names_follow_their_place() -> None:
    units = _item("amluto.ikea-uk/office/alex_drawer_unit_36x70")
    assert [s["name"]["en"] for s in units["slots"]] == [
        "Top drawer",
        "Second drawer",
        "Third drawer",
        "Fourth drawer",
        "Bottom drawer",
    ]
    day_bed = _item("amluto.ikea-uk/bed/hemnes_day_bed_3_drawers")
    assert [s["name"]["en"] for s in day_bed["slots"]] == ["Left drawer", "Middle drawer", "Right drawer"]
    desk = _item("amluto.ikea-uk/office/alex_desk_100x48")
    assert desk["slots"] == [{"id": "drawer", "kind": "drawer"}]
    # the box, the front and the handle of a desk drawer slide as one, and nothing is added
    assert len(desk["parts"]) == 7 and [i for i, p in enumerate(desk["parts"]) if "bind" in p] == [4, 5, 6]


def test_the_loft_beds_slide_their_fronts_alone() -> None:
    for key in ("kids/smastad_loft_bed_3_drawers", "kids/smastad_loft_bed_4_drawers"):
        item = _item(f"amluto.ikea-uk/{key}")
        assert len(item["parts"]) == CLOSED[f"amluto.ikea-uk/{key}"]["parts"]  # no drawer box: no side panel hides it


def test_the_micke_desks_have_a_door_and_drawers_in_their_unit() -> None:
    small = _item("amluto.ikea-uk/office/micke_desk_105x50")
    assert small["slots"] == [{"id": "drawer", "kind": "drawer"}, {"id": "door", "kind": "contact"}]
    wide = _item("amluto.ikea-uk/office/micke_desk_142x50")
    assert [s["id"] for s in wide["slots"]] == ["drawer_1", "drawer_2", "door"]
    assert [s["name"]["en"] for s in wide["slots"][:2]] == ["Left drawer", "Right drawer"]
    for item in (small, wide):
        door = [p for p in item["parts"] if p.get("bind", {}).get("kind") == "open"]
        assert len(door) == 2 and {p["bind"]["hinge"] for p in door} == {"right"}
        # the unit's drawer has a box (a bottom and two sides) behind its front; the drawer under the top has none
        box = [p for p in item["parts"][CLOSED[f"amluto.ikea-uk/office/{item['id']}"]["parts"] :] if "bind" in p]
        assert len(box) == 3 and {p["bind"]["slot"] for p in box} == {"drawer" if item is small else "drawer_2"}


def test_a_washing_machine_has_a_door_and_paddles_that_turn_while_it_runs() -> None:
    for key in ("uddarp_washing_machine_7kg", "uddarp_washing_machine_8kg"):
        item = _item(f"amluto.ikea-uk/appliance/{key}")
        assert item["slots"] == [{"id": "door", "kind": "contact"}, {"id": "running", "kind": "power"}]
        door = [p for p in item["parts"] if p.get("bind", {}).get("kind") == "open"]
        assert [p["shape"] for p in door] == ["cyl", "cyl"]
        assert {p["bind"]["hinge"] for p in door} == {"left"}
        spin = [p for p in item["parts"] if p.get("bind", {}).get("kind") == "spin"]
        assert len(spin) == 2 and {p["bind"]["axis"] for p in spin} == {"z"}
        # the paddles turn about one middle: the middle of the drum opening
        cx = {round(p["x"], 3) for p in spin}
        assert cx == {item["parts"][6]["x"]}
        opening = item["parts"][CLOSED[f"amluto.ikea-uk/appliance/{key}"]["parts"]]
        assert opening["color"] == "dark" and opening["shape"] == "cyl" and "bind" not in opening


def test_the_washer_dryer_front_and_the_microwave_door_open_to_the_left() -> None:
    dryer = _item("amluto.ikea-uk/appliance/tvattad_integrated_washer_dryer")
    assert {p["bind"]["hinge"] for p in dryer["parts"] if p.get("bind", {}).get("kind") == "open"} == {"left"}
    assert [s["id"] for s in dryer["slots"]] == ["door", "running"]
    micro = _item("amluto.ikea-uk/appliance/tillreda_microwave_oven")
    assert micro["slots"] == [{"id": "door", "kind": "contact"}]
    assert [i for i, p in enumerate(micro["parts"]) if "bind" in p] == [1, 2]
    assert micro["parts"][-1]["color"] == "metal"


def test_the_items_with_no_door_and_no_drawer_are_left_as_they_are() -> None:
    for key in live_ikea_more.LEFT:
        assert "slots" not in _item(f"amluto.ikea-uk/{key}"), key


def test_a_tool_input_that_is_not_a_front_is_refused() -> None:
    item = copy.deepcopy(_item("amluto.ikea-uk/office/alex_drawer_unit_36x70"))
    for p in item["parts"]:
        p.pop("bind", None)
    item.pop("slots", None)
    item["parts"] = item["parts"][:15]
    with pytest.raises(live_cabinets.Report):
        live_ikea_more.build_drawers(item, {"fronts": [(0, [0])]})


def test_the_pack_is_held_back_from_the_packs_repository() -> None:
    loaded = publish_packs.fp3dpack.check(BUNDLED / "amluto.ikea-uk")
    assert publish_packs.held_back(loaded) == ["bind", "slots"]


def test_the_release_was_bumped_with_a_short_note_that_names_the_ticket() -> None:
    meta = json.loads((BUNDLED / "amluto.ikea-uk" / "pack.json").read_text(encoding="utf-8"))
    assert meta["release_note"].startswith(f"Release {meta['release']}:")
    assert live_ikea_more.MARKER in meta["release_note"] and len(meta["release_note"]) < 200
