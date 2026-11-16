"""More of our own items are live (run 16, tools/live_misc.py): microwaves and small ovens, air fryers, chest
freezers, washing machines and tumble dryers, sliding doors, outdoor kitchen cabinets, tool chests, desk drawer units
and a printer cabinet. No network.

The closed look of every converted item is pinned by tests/fixtures/misc-closed-look.json, made from the items as they
were before: the parts they had are unchanged (a `bind` apart), so are all their other fields and their plan symbol.
"""

from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path
import sys

import pytest
import voluptuous as vol

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


live_misc = _load("live_misc")
live_cabinets = sys.modules["live_cabinets"]
CLOSED = json.loads((ROOT / "tests" / "fixtures" / "misc-closed-look.json").read_text(encoding="utf-8"))


def _item(key: str) -> dict:
    return json.loads((BUNDLED / f"{key}.json").read_text(encoding="utf-8"))


def _aabb(p: dict, size: list[float]) -> tuple[float, float, float, float, float, float]:
    W, D, H = size
    cx, cz, w, d = p["x"] * W, p["z"] * D, p["w"] * W, p["d"] * D
    return cx - w / 2, cx + w / 2, p["y"] * H, min(1.0, p["y"] + p["h"]) * H, cz - d / 2, cz + d / 2


def test_there_are_many_converted_items_in_five_packs() -> None:
    assert len(CLOSED) >= 28
    assert {key.split("/")[0] for key in CLOSED} == {
        "amluto.kitchen-bath",
        "amluto.ikea-uk",
        "amluto.bedroom",
        "amluto.office",
        "amluto.makers",
    }


@pytest.mark.parametrize("key", sorted(CLOSED))
def test_every_converted_item_looks_the_same_closed(key: str) -> None:
    """The parts an item had are as they were but for their `bind`; everything else it holds is unchanged."""
    was = CLOSED[key]
    item = _item(key)
    old = [{k: v for k, v in p.items() if k != "bind"} for p in item["parts"][: was["parts"]]]
    assert live_misc._digest(old) == was["look"]
    assert live_misc._digest({k: v for k, v in item.items() if k not in ("parts", "slots", "symbol")}) == was["fields"]
    if was["symbol"]:
        assert item["symbol"] == was["symbol"], "the plan symbol is kept"
    elif len(item["parts"]) > was["parts"]:
        # an item that drew its plan from its parts keeps doing so: a symbol made from the old parts
        before = {**item, "parts": old}
        assert item["symbol"] == live_cabinets.plan_symbol(before)


@pytest.mark.parametrize("key", sorted(CLOSED))
def test_what_is_new_sits_hidden_inside_the_old_parts(key: str) -> None:
    """Every part added lies inside the box of a part the item had (the body, the thickness of a front, a wheel's
    ring), so nothing of it shows while the item is closed."""
    item = _item(key)
    n = CLOSED[key]["parts"]
    olds = [_aabb(p, item["size"]) for p in item["parts"][:n]]
    for part in item["parts"][n:]:
        box = _aabb(part, item["size"])
        inside = [
            all(o[2 * a] - 1e-4 <= box[2 * a] and box[2 * a + 1] <= o[2 * a + 1] + 1e-4 for a in range(3)) for o in olds
        ]
        assert any(inside), (key, part)
        assert part["shape"] in ("box", "cyl")
        assert part["color"] in ("dark", "metal", "white")


@pytest.mark.parametrize("key", sorted(CLOSED))
def test_the_converted_items_pass_the_pack_check_and_every_slot_has_a_part(key: str) -> None:
    item = packs.ITEM_SCHEMA(_item(key))
    assert len(item["parts"]) <= packs.MAX_PARTS
    bound = {p["bind"]["slot"] for p in item["parts"] if "bind" in p}
    assert bound == {s["id"] for s in item["slots"]}
    assert 1 <= len(item["slots"]) <= packs.MAX_SLOTS
    # two slots of one kind need names that tell them apart in the picker
    names = [s.get("name", {}).get("en") or s["kind"] for s in item["slots"]]
    assert len(set(names)) == len(names), names


def test_running_the_tool_again_changes_nothing() -> None:
    """The item files are the source: a second run finds nothing left to make live."""
    assert live_misc.run(False) == {}


def test_a_chest_freezers_lid_lifts_at_the_front_about_its_back_edge() -> None:
    for size in ("100", "200", "300"):
        item = _item(f"amluto.kitchen-bath/appliance/chest_freezer_{size}")
        assert item["slots"] == [{"id": "lid", "kind": "contact", "name": {"en": "Lid"}}]
        lid = [p for p in item["parts"] if "bind" in p]
        assert len(lid) == 3 and {json.dumps(p["bind"]) for p in lid} == {
            json.dumps({"slot": "lid", "kind": "open", "hinge": "back", "amount": 75})
        }
        # the indicator light on the front stays where it is
        assert all("bind" not in p for p in item["parts"] if p["color"] == "#7fe3ff")


def test_the_drum_of_a_washing_machine_turns_while_it_runs() -> None:
    laundry = (
        "washing_machine",
        "washing_machine_graphite",
        "tumble_dryer",
        "tumble_dryer_graphite",
        "tumble_dryer_stacked",
    )
    for key in laundry:
        item = _item(f"amluto.kitchen-bath/appliance/{key}")
        assert [(s["id"], s["kind"]) for s in item["slots"]] == [("door", "contact"), ("running", "power")]
        spin = [p for p in item["parts"] if p.get("bind", {}).get("kind") == "spin"]
        assert len(spin) == 3 and all(p["bind"]["axis"] == "z" for p in spin)
        door = [p for p in item["parts"] if p.get("bind", {}).get("slot") == "door"]
        assert len(door) == 3 and all(p["bind"]["hinge"] == "left" for p in door)
        # the drum is centred on the porthole: the bars are inside the disc
        disc = next(p for p in spin if p["shape"] == "cyl")
        assert all(abs(p["x"] - disc["x"]) < 1e-3 for p in spin)
    # the machine behind a cabinet front has a door and nothing behind it (the front is flush with the machine)
    integrated = _item("amluto.kitchen-bath/appliance/washing_machine_integrated")
    assert [s["id"] for s in integrated["slots"]] == ["door"] and len(integrated["parts"]) == 8


def test_sliding_doors_slide_toward_each_other_and_keep_apart_for_the_viewer() -> None:
    for key in ("amluto.ikea-uk/storage/kleppstad_wardrobe_sliding", "amluto.ikea-uk/media/stockholm_tv_bench"):
        item = _item(key)
        binds = [p["bind"] for p in item["parts"] if "bind" in p]
        assert {b["to"] for b in binds} == {"left", "right"}
        assert all(b["kind"] == "slide" and b["slot"] == "door" and 0 < b["amount"] < 0.5 for b in binds)
        # the left door slides right, the right door left
        for part in item["parts"]:
            if "bind" in part:
                assert (part["bind"]["to"] == "right") == (part["x"] < 0)


def test_a_part_may_slide_to_a_side_and_a_lid_hinge_is_a_hinge() -> None:
    def item(bind: dict) -> dict:
        base = copy.deepcopy(_item("amluto.makers/tech/printer_cabinet"))
        base["slots"] = [{"id": "door", "kind": "contact"}]
        for p in base["parts"]:
            p.pop("bind", None)
        base["parts"][2]["bind"] = bind
        return base

    packs.ITEM_SCHEMA(item({"slot": "door", "kind": "slide", "to": "left", "amount": 0.4}))
    packs.ITEM_SCHEMA(item({"slot": "door", "kind": "open", "hinge": "back", "amount": 70}))
    for bad in (
        {"slot": "door", "kind": "open", "to": "left"},
        {"slot": "door", "kind": "slide", "to": "front"},
        {"slot": "door", "kind": "slide", "to": "left", "amount": 1.5},
        {"slot": "door", "kind": "slide", "hinge": "back"},
    ):
        with pytest.raises(vol.Invalid):
            packs.ITEM_SCHEMA(item(bad))


def test_the_outdoor_kitchen_and_printer_cabinet_doors_hinge_on_their_outer_edges() -> None:
    sink = _item("amluto.ikea-uk/outdoor/grillskar_sink_unit_cabinet_172")
    assert [s["id"] for s in sink["slots"]] == ["sink_doors", "cabinet_doors"]
    cabinet = _item("amluto.makers/tech/printer_cabinet")
    hinges = {(p["x"] < 0, p["bind"]["hinge"]) for p in cabinet["parts"] if "bind" in p}
    assert hinges == {(True, "left"), (False, "right")}
    # a part of the plan that has no door stays as it was: the dark panel above the doors
    assert sum(1 for p in cabinet["parts"] if "bind" in p) == 4


def test_the_tool_chest_has_at_most_eight_slots_and_names_its_drawers() -> None:
    chest = _item("amluto.bedroom/storage/tool_chest")
    assert len(chest["slots"]) == 8
    assert [s["id"] for s in chest["slots"]][:2] == ["lid", "chest_drawers"]
    roller = _item("amluto.bedroom/storage/tool_chest_roller_cabinet")
    assert [s["name"]["en"] for s in roller["slots"]] == [
        "Top drawer",
        "Second drawer",
        "Third drawer",
        "Fourth drawer",
        "Fifth drawer",
        "Bottom drawer",
    ]


def test_items_with_no_door_or_drawer_are_left_alone() -> None:
    """Open bookcases and racks, the corner wardrobe (its side door hinges about the depth axis), the cooker hoods and
    the open-shelf bedside table have nothing to open that the format can move."""
    for key in (
        "amluto.ikea-uk/storage/billy_bookcase_80x28x202",
        "amluto.ikea-uk/storage/billy_bookcase_40x39x202",
        "amluto.ikea-uk/storage/pax_corner_wardrobe_110x110x201",
        "amluto.ikea-uk/storage/mackapar_shoe_rack_78x32x40",
        "amluto.ikea-uk/storage/mackapar_coat_rack_78x32x200",
        "amluto.ikea-uk/storage/ekrar_coat_stand",
        "amluto.bedroom/storage/bookcase_simple",
        "amluto.bedroom/bed/bedside_table_open_shelf",
        "amluto.kitchen-bath/appliance/chimney_cooker_hood_600",
        "amluto.kitchen-bath/appliance/box_cooker_hood_900",
    ):
        item = _item(key)
        assert "slots" not in item and not any("bind" in p for p in item["parts"]), key


@pytest.mark.parametrize(
    "pack", ["amluto.kitchen-bath", "amluto.ikea-uk", "amluto.bedroom", "amluto.office", "amluto.makers"]
)
def test_the_packs_release_was_bumped_with_a_note(pack: str) -> None:
    meta = json.loads((BUNDLED / pack / "pack.json").read_text(encoding="utf-8"))
    note = meta["release_note"]
    assert note.startswith(f"Release {meta['release']}:") and "(run16 misc)" in note and len(note) < 200


def test_the_packs_stay_held_back_from_the_packs_repository() -> None:
    """Office and Makers have live parts now, so older Home 3D versions cannot read them: they are held back too."""
    publish_packs = _load("publish_packs")
    for pack in ("amluto.office", "amluto.makers"):
        loaded = publish_packs.fp3dpack.check(BUNDLED / pack)
        assert "bind" in publish_packs.held_back(loaded), pack
