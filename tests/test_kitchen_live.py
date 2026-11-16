"""Our kitchen items are live (#467): doors, drawers and appliance doors move with Home Assistant. No network.

The closed look of every converted item is pinned by a fixture made from the items as they were before: the parts they
had are unchanged (a `bind` apart), and so are all their other fields (size, tags, family, price info, symbol).
"""

from __future__ import annotations

import copy
import hashlib
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


kitchen_live = _load("kitchen_live")
gen_kitchen_live = _load("gen_kitchen_live")
publish_packs = _load("publish_packs")
CLOSED = json.loads((ROOT / "tests" / "fixtures" / "kitchen-closed-look.json").read_text(encoding="utf-8"))


def _digest(value: object) -> str:
    text = json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(text.encode("utf-8")).hexdigest()[:16]


def _item(key: str) -> dict:
    return json.loads((BUNDLED / f"{key}.json").read_text(encoding="utf-8"))


def test_every_converted_item_looks_the_same_closed() -> None:
    """The parts an item had are as they were but for their `bind`; everything else it holds is unchanged."""
    assert len(CLOSED) >= 70
    for key, was in CLOSED.items():
        item = _item(key)
        old = [{k: v for k, v in p.items() if k != "bind"} for p in item["parts"][: was["parts"]]]
        assert _digest(old) == was["look"], key
        assert _digest({k: v for k, v in item.items() if k not in ("parts", "slots")}) == was["fields"], key
        # what came after is behind the closed fronts: only liners and drawer boxes (bound ones slide with their front)
        assert len(item["parts"]) <= packs.MAX_PARTS, key
        for part in item["parts"][was["parts"] :]:
            assert part["color"] in ("dark", "metal", "white"), key
            assert part["shape"] == "box", key


def test_the_converted_items_pass_the_pack_check_and_every_slot_has_a_part() -> None:
    for key in CLOSED:
        item = packs.ITEM_SCHEMA(_item(key))
        bound = {p["bind"]["slot"] for p in item["parts"] if "bind" in p}
        assert bound == {s["id"] for s in item["slots"]}, key
        assert 1 <= len(item["slots"]) <= 8, key
        # two slots of one kind need names that tell them apart in the picker
        names = [s.get("name", {}).get("en") or s["kind"] for s in item["slots"]]
        assert len(set(names)) == len(names), (key, names)


def test_running_the_conversion_again_changes_nothing() -> None:
    """The item files are the source: a second run finds nothing to make live (exit 0 of `--check`)."""
    assert gen_kitchen_live.run(check=True) == 0


def test_the_corner_sinks_from_the_generator_have_the_same_slots_as_their_files() -> None:
    """tools/gen_kitchen_worktop.py calls the same code, so a rebuild keeps the live parts."""
    gen = _load("gen_kitchen_worktop")
    gen.build()
    sinks = [it for it in gen.items if it.id.startswith("corner_sink_")]
    assert len(sinks) == 10
    for it in sinks:
        data = it.data()
        assert data == _item(f"amluto.kitchen-bath/kitchen/{it.id}"), it.id
        assert data["slots"], it.id


def test_the_two_packs_are_held_back_from_the_packs_repository() -> None:
    """Older Home 3D versions refuse slots and binds, so publish_packs leaves the packs out until they read them."""
    for pack in ("amluto.kitchen-bath", "amluto.ikea-uk"):
        loaded = publish_packs.fp3dpack.check(BUNDLED / pack)
        assert publish_packs.held_back(loaded) == ["bind", "slots"], pack


# the layouts the conversion reads, as small items of their own
def _fronts() -> dict:
    """A 60 cm base unit: a drawer over a door, handle on the right, in the layout of the shaker units."""

    def part(x: float, z: float, w: float, d: float, y: float, h: float, color: str, **kw) -> dict:
        return {"shape": "box", "x": x, "z": z, "w": w, "d": d, "y": y, "h": h, "color": color, **kw}

    return {
        "id": "test_base",
        "name": {"en": "Test base unit"},
        "size": [0.6, 0.6, 0.91],
        "group": "kitchen",
        "family": "shaker_base_unit",
        "tags": ["test"],
        "parts": [
            part(0, -0.022, 1, 0.926, 0.165, 0.79, "white"),
            part(0, 0.4417, 0.99, 0.03, 0.8055, 0.1473, "body"),
            part(0.445, 0.4817, 0.02, 0.03, 0.9277, 0.0132, "metal", fix="wdh"),
            part(0, 0.4417, 0.99, 0.03, 0.1681, 0.6308, "body"),
            part(0.445, 0.4817, 0.02, 0.03, 0.5791, 0.1429, "metal", fix="wdh"),
        ],
    }


def test_a_drawer_slides_and_a_door_hinges_away_from_its_handle() -> None:
    before = _fronts()
    live = kitchen_live.convert(before)
    assert live is not None and kitchen_live.closed_look_kept(before, live)
    assert {slot["id"] for slot in live["slots"]} == {"door", "drawer"}
    binds = [p["bind"] for p in live["parts"] if "bind" in p]
    assert {"slot": "door", "kind": "open", "hinge": "left"} in binds  # the handle is on the right
    assert {"slot": "drawer", "kind": "slide"} in binds
    # the drawer gets a box that slides with it; the open door shows a dark liner and a shelf
    assert sum(1 for p in live["parts"][5:] if p.get("bind", {}).get("slot") == "drawer") == 4
    assert any(p["color"] == "dark" for p in live["parts"][5:])
    packs.ITEM_SCHEMA(live)
    assert kitchen_live.convert(live) is None  # already live


def test_an_item_that_is_not_a_kitchen_front_is_left_alone() -> None:
    chair = {"id": "c", "name": {"en": "C"}, "size": [0.5, 0.5, 0.8], "parts": [_fronts()["parts"][0]]}
    assert kitchen_live.convert(copy.deepcopy(chair)) is None


def test_an_oven_door_folds_down_and_a_fridge_has_a_slot_for_each_door() -> None:
    oven = _item("amluto.kitchen-bath/appliance/built_in_double_oven")
    binds = {p["bind"]["slot"]: p["bind"] for p in oven["parts"] if "bind" in p}
    assert binds["top_oven_door"] == {"slot": "top_oven_door", "kind": "open", "hinge": "bottom", "amount": 90}
    assert set(binds) == {"top_oven_door", "bottom_oven_door"}
    fridge = _item("amluto.kitchen-bath/appliance/american_fridge_freezer")
    assert [s["id"] for s in fridge["slots"]] == ["freezer_door", "fridge_door"]
    dishwasher = _item("amluto.ikea-uk/appliance/rengora_integrated_dishwasher_60")
    assert next(p["bind"] for p in dishwasher["parts"] if "bind" in p)["hinge"] == "bottom"


@pytest.mark.parametrize("key", sorted(CLOSED))
def test_the_liners_sit_behind_the_closed_fronts(key: str) -> None:
    """Every part added behind a front lies inside its front's thickness or inside the item's solid body, so a closed
    front hides it: its front face is no further out than the front of the bound parts of the same row."""
    item = _item(key)
    D = item["size"][1]
    was = CLOSED[key]["parts"]
    bound = [p for p in item["parts"][:was] if "bind" in p]
    front = max((p["z"] + p["d"] / 2) * D for p in bound)
    for part in item["parts"][was:]:
        assert (part["z"] + part["d"] / 2) * D <= front + 1e-6, key
