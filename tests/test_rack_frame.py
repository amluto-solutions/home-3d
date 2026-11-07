"""Rack frames (#112): a pack item with a `rack_frame` spec is an empty rack that gear can be fitted into later."""

from __future__ import annotations

import copy
import json

import pytest

from custom_components.home_3d import packs

PACK_JSON = {
    "format": "home3d-pack",
    "version": 2,
    "id": "test.racks",
    "name": "Racks",
    "publisher": "Test",
    "licence": "MIT",
}

# a 19" 9U wall cabinet: 600 wide, 450 deep, 450 tall; 9U = 400 mm of rails
CABINET = {
    "id": "wall_cabinet_9u",
    "name": {"en": "Wall cabinet 9U"},
    "size": [0.6, 0.45, 0.45],
    "mount": "wall",
    "parts": [{"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 1, "color": "dark"}],
    "rack_frame": {"u": 9, "form": "wall_cabinet", "door": "glass"},
}


def _verified(item: dict) -> dict:
    files = {"pack.json": json.dumps(PACK_JSON), f"{item['id']}.json": json.dumps(item)}
    return packs.verify_folder(files)["items"][0]


def _with(**frame) -> dict:
    item = copy.deepcopy(CABINET)
    item["rack_frame"] = {**item["rack_frame"], **frame}
    return item


def test_a_rack_frame_is_kept_as_written() -> None:
    """The spec stays as the pack wrote it (no filled-in defaults), so its recipe hash is the file's."""
    item = _verified(CABINET)
    assert item["rack_frame"] == {"u": 9, "form": "wall_cabinet", "door": "glass"}


def test_every_field_of_a_rack_frame_is_accepted() -> None:
    full = {
        "u": 9,
        "form": "wall_cabinet",
        "width": 19,
        "door": "mesh",
        "start_u": 1,
        "desc": True,
        "mount_depth": 0.35,
        "bottom": 0.02,
    }
    assert _verified(_with(**full))["rack_frame"] == full


def test_items_without_a_rack_frame_are_unchanged() -> None:
    item = copy.deepcopy(CABINET)
    del item["rack_frame"]
    assert "rack_frame" not in _verified(item)


def test_the_library_index_keeps_the_rack_frame() -> None:
    """The library knows an item is a rack before it fetches the recipe."""
    assert packs.item_index(_verified(CABINET))["rack_frame"]["u"] == 9


@pytest.mark.parametrize(
    ("frame", "why"),
    [
        ({"u": 0}, "a rack has at least one U"),
        ({"u": 61}, "at most 60U"),
        ({"u": 4.5}, "whole U only"),
        ({"u": True}, "true is not a number of U"),
        ({"start_u": 0}, "numbering starts at 1 or above"),
        ({"desc": "yes"}, "desc is true or false"),
        ({"mount_depth": 0.6}, "the mounting depth fits inside the item"),
        ({"u": 10}, "10U (444.5 mm) does not fit a 450 mm cabinet with its 20 mm bottom"),
        ({"bottom": 0.1}, "the U space must fit above the bottom"),
        ({"colour": "red"}, "no unknown fields"),
    ],
)
def test_bad_rack_frames_are_refused(frame: dict, why: str) -> None:
    item = _with(**frame)
    if frame == {"u": 10}:
        item["rack_frame"]["bottom"] = 0.02
    with pytest.raises(packs.PackError) as err:
        _verified(item)
    assert err.value.code == "invalid_content", why


def test_a_rack_narrower_than_its_panels_is_refused() -> None:
    """A 19-inch rack needs 482.6 mm across its ears; a 10-inch one 254 mm."""
    narrow = _with()
    narrow["size"] = [0.45, 0.45, 0.45]
    with pytest.raises(packs.PackError):
        _verified(narrow)
    narrow["rack_frame"]["width"] = 10
    assert _verified(narrow)["rack_frame"]["width"] == 10


def test_a_door_belongs_to_a_cabinet() -> None:
    frame = _with(form="wall_frame")
    with pytest.raises(packs.PackError):
        _verified(frame)
    frame["rack_frame"]["door"] = "none"
    assert _verified(frame)["rack_frame"]["form"] == "wall_frame"


def test_wall_racks_hang_on_a_wall_and_floor_racks_stand() -> None:
    standing = _with()
    standing["mount"] = "floor"
    with pytest.raises(packs.PackError):
        _verified(standing)
    floor = _with(form="cabinet")
    with pytest.raises(packs.PackError):
        _verified(floor)
    floor["mount"] = "floor"
    assert _verified(floor)["rack_frame"]["form"] == "cabinet"
    floor["mount"] = "surface"
    assert _verified(floor)["mount"] == "surface", "a desktop rack stands on a desk"


@pytest.mark.parametrize("frame", [{"form": "frame6"}, {"width": 23}, {"door": "curtain"}])
def test_a_rack_value_this_version_does_not_know_asks_for_an_update(frame: dict) -> None:
    """A newer rack form, width or door, as a newer pack may use."""
    with pytest.raises(packs.PackError) as err:
        _verified(_with(**frame))
    assert err.value.code == "needs_update"


def test_a_plans_copy_of_a_rack_keeps_its_frame() -> None:
    """A placed rack draws from the plan's recipe copy (#2), frame spec included, and a broken spec drops the copy."""
    from custom_components.home_3d import recipes

    item = _verified(CABINET)
    entry = {"pack": "test.racks", "item": item["id"], "release": 1, "recipe": item}
    kept = recipes.recipes_validator({"pack:test.racks:wall_cabinet_9u": entry})
    assert kept["pack:test.racks:wall_cabinet_9u"]["recipe"]["rack_frame"]["u"] == 9
    broken = {**entry, "recipe": {**item, "rack_frame": {"u": 99, "form": "wall_cabinet"}}}
    assert recipes.recipes_validator({"pack:test.racks:wall_cabinet_9u": broken}) == {}


def test_the_bundled_starter_racks_are_racks() -> None:
    """The IT & network pack ships a 10-inch 6U mini rack, a 9U glass wall cabinet and a 42U floor cabinet (#112)."""
    folder = packs.BUNDLED_DIR / "amluto.it"
    items = {i["id"]: i for i in packs.verify_folder(packs.read_folder(folder))["items"]}
    assert items["rack_mini_10in_6u"]["rack_frame"]["width"] == 10
    assert items["rack_wall_cabinet_9u"]["rack_frame"]["door"] == "glass"
    assert items["rack_floor_cabinet_42u"]["rack_frame"]["u"] == 42
