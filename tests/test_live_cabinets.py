"""tools/live_cabinets.py: our wardrobes, chests of drawers, bedside tables, sideboards, TV benches and hall and
bathroom cabinets have doors and drawers that open with their contacts (#468). No network."""

from __future__ import annotations

import copy
import importlib.util
import json
from pathlib import Path
import re

import pytest

from custom_components.home_3d import packs

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("live_cabinets", ROOT / "tools" / "live_cabinets.py")
assert _spec and _spec.loader
live_cabinets = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(live_cabinets)

BUNDLED = ROOT / "custom_components" / "home_3d" / "bundled_packs"
# the kitchen's are the kitchen ticket's (#467): only the groups our cabinets are in
WHERE = {
    "amluto.bedroom": ("bed", "storage"),
    "amluto.ikea-uk": ("storage", "bed", "bath", "media", "kids"),
    "amluto.kitchen-bath": ("bath",),
}


def _live_items() -> list[Path]:
    out = []
    for pack, groups in WHERE.items():
        for group in groups:
            for path in sorted((BUNDLED / pack / group).glob("*.json")):
                if "slots" in json.loads(path.read_text(encoding="utf-8")):
                    out.append(path)
    return out


# an old-style item: a hollow chest with two drawers; a solid cabinet with two doors
CHEST = {
    "id": "t_chest",
    "name": {"en": "Test chest"},
    "size": [0.8, 0.5, 0.8],
    "group": "storage",
    "parts": [
        {"shape": "box", "x": -0.49, "z": 0, "w": 0.02, "d": 1, "y": 0, "h": 1, "color": "wood", "fix": "w"},
        {"shape": "box", "x": 0.49, "z": 0, "w": 0.02, "d": 1, "y": 0, "h": 1, "color": "wood", "fix": "w"},
        {"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0.97, "h": 0.03, "color": "wood", "fix": "h"},
        {"shape": "box", "x": 0, "z": 0, "w": 0.96, "d": 1, "y": 0, "h": 0.03, "color": "wood", "fix": "h"},
        {"shape": "box", "x": 0, "z": -0.49, "w": 0.96, "d": 0.02, "y": 0.03, "h": 0.94, "color": "wood", "fix": "d"},
        {"shape": "box", "x": 0, "z": 0.48, "w": 0.96, "d": 0.04, "y": 0.6, "h": 0.3, "color": "white"},
        {"shape": "box", "x": 0, "z": 0.5, "w": 0.2, "d": 0.02, "y": 0.74, "h": 0.04, "color": "metal", "fix": "wdh"},
        {"shape": "box", "x": 0, "z": 0.48, "w": 0.96, "d": 0.04, "y": 0.2, "h": 0.3, "color": "white"},
        {"shape": "box", "x": 0, "z": 0.5, "w": 0.2, "d": 0.02, "y": 0.34, "h": 0.04, "color": "metal", "fix": "wdh"},
    ],
}
CABINET = {
    "id": "t_cabinet",
    "name": {"en": "Test cabinet"},
    "size": [0.8, 0.4, 0.9],
    "group": "storage",
    "parts": [
        {"shape": "box", "x": 0, "z": 0, "w": 1, "d": 0.95, "y": 0, "h": 1, "color": "white"},
        {"shape": "box", "x": -0.25, "z": 0.48, "w": 0.49, "d": 0.06, "y": 0.02, "h": 0.95, "color": "white"},
        {"shape": "box", "x": -0.05, "z": 0.5, "w": 0.02, "d": 0.06, "y": 0.5, "h": 0.2, "color": "metal"},
        {"shape": "box", "x": 0.25, "z": 0.48, "w": 0.49, "d": 0.06, "y": 0.02, "h": 0.95, "color": "white"},
        {"shape": "box", "x": 0.05, "z": 0.5, "w": 0.02, "d": 0.06, "y": 0.5, "h": 0.2, "color": "metal"},
    ],
}


def test_a_chest_gets_a_slot_a_slide_and_a_tray_for_each_drawer() -> None:
    new, info = live_cabinets.build(copy.deepcopy(CHEST))
    packs.ITEM_SCHEMA(new)
    assert [s["id"] for s in new["slots"]] == ["drawer_1", "drawer_2"]
    assert [s["name"]["en"] for s in new["slots"]] == ["Top drawer", "Second drawer"]
    assert all(s["kind"] == "drawer" for s in new["slots"])
    # the old parts come first and are unchanged but for the bind of the fronts and their handles
    old = CHEST["parts"]
    for i, part in enumerate(old):
        bound = {k: v for k, v in new["parts"][i].items() if k != "bind"}
        assert bound == part
    assert [("bind" in p) for p in new["parts"][: len(old)]] == [False] * 5 + [True] * 4
    assert {p["bind"]["slot"] for p in new["parts"][5:]} == {"drawer_1", "drawer_2"}
    assert all(p["bind"]["kind"] == "slide" for p in new["parts"] if "bind" in p)
    # a tray (a bottom and two sides) behind each front, moving with it, inside the carcass
    tray = new["parts"][len(old) :]
    assert len(tray) == 6 and all("bind" in p for p in tray)
    assert all(p["x"] - p["w"] / 2 >= -0.5 and p["x"] + p["w"] / 2 <= 0.5 for p in tray)
    assert all(p["z"] + p["d"] / 2 < 0.46 for p in tray), "behind the front"
    assert info["solid"] is False


def test_a_solid_cabinet_gets_a_door_slot_hinges_outwards_and_a_recess_behind_each_door() -> None:
    new, info = live_cabinets.build(copy.deepcopy(CABINET))
    packs.ITEM_SCHEMA(new)
    assert new["slots"] == [{"id": "door", "kind": "contact"}]
    hinges = [p["bind"]["hinge"] for p in new["parts"] if "bind" in p]
    assert hinges == ["left", "left", "right", "right"]
    # the two columns keep apart for the viewer: a hinge each, so a model each
    assert len({(p["bind"]["hinge"], p["bind"]["amount"]) for p in new["parts"] if "bind" in p}) == 2
    recesses = [p for p in new["parts"][len(CABINET["parts"]) :] if p["color"] == "dark"]
    assert len(recesses) == 2 and all("bind" not in p for p in recesses)
    assert info["solid"] is True
    # the top view stays as it was: the old parts seen from above, nothing of the recesses
    assert len(new["symbol"]) == len(CABINET["parts"])
    assert [s["w"] for s in new["symbol"] if s["shape"] == "rect"] == [p["w"] for p in CABINET["parts"]]


def test_an_item_that_is_live_already_is_left_alone() -> None:
    new, _ = live_cabinets.build(copy.deepcopy(CABINET))
    with pytest.raises(live_cabinets.Report):
        live_cabinets.build(new)


def test_the_cabinets_are_converted_and_a_second_run_changes_nothing() -> None:
    assert len(_live_items()) >= 90
    # idempotent: every selected item is live already, so nothing is written or bumped
    assert live_cabinets.run(False) == {}


@pytest.mark.parametrize("path", _live_items(), ids=lambda p: p.relative_to(BUNDLED).as_posix())
def test_a_live_cabinet_checks_and_keeps_its_name_size_and_a_top_view(path: Path) -> None:
    item = json.loads(path.read_text(encoding="utf-8"))
    packs.ITEM_SCHEMA(item)
    assert len(item["parts"]) <= packs.MAX_PARTS
    assert 1 <= len(item["slots"]) <= packs.MAX_SLOTS
    # every slot is a contact or a drawer contact: a door or a drawer is what it opens
    assert {s["kind"] for s in item["slots"]} <= {"contact", "drawer"}
    # several slots of one kind are named, so the item panel tells them apart (a door and a drawer differ by kind)
    for kind in ("contact", "drawer"):
        same = [s for s in item["slots"] if s["kind"] == kind]
        if len(same) > 1:
            assert all("name" in s for s in same)
    # the top view has no more than the old parts' shapes and no part of the inside
    assert len(item.get("symbol", [])) <= 40
    kinds = {p["bind"]["kind"] for p in item["parts"] if "bind" in p}
    assert kinds <= {"open", "slide"}
    for part in item["parts"]:
        if "bind" in part and part["bind"]["kind"] == "slide":
            assert part["bind"].get("amount") is None
    assert re.search(r"[a-z]", item["name"]["en"])


@pytest.mark.parametrize("pack", sorted(WHERE))
def test_the_packs_release_was_bumped_with_a_note(pack: str) -> None:
    meta = json.loads((BUNDLED / pack / "pack.json").read_text(encoding="utf-8"))
    assert "(#468)" in meta["release_note"] and meta["release_note"].startswith(f"Release {meta['release']}:")
