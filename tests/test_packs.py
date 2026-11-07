"""Furniture packs: content check and import through the websocket (packs are not signed)."""

from __future__ import annotations

import copy
import json
import pathlib
import re
from types import SimpleNamespace

from homeassistant.core import HomeAssistant
from homeassistant.setup import async_setup_component
import pytest
from pytest_homeassistant_custom_component.common import MockConfigEntry
import voluptuous as vol

from custom_components.home_3d import packs
from custom_components.home_3d.const import DOMAIN

PAYLOAD = {
    "format": "fp3dpack",
    "version": 1,
    "id": "test.starter",
    "name": "Starter",
    "publisher": "Test",
    "items": [
        {
            "id": "cube_chair",
            "name": {"fr": "Fauteuil cube", "en": "Cube chair"},
            "size": [0.8, 0.8, 0.75],
            "parts": [
                {"shape": "box", "x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 0.55, "color": "fabric"},
                {"shape": "box", "x": 0, "z": -0.4, "w": 1, "d": 0.2, "y": 0.55, "h": 0.45, "color": "#223355"},
            ],
        }
    ],
}


def _imported(listed: list[dict]) -> list[dict]:
    """The imported packs of a pack list (it starts with the packs that come with Home 3D)."""
    return [p for p in listed if not p.get("bundled")]


def _pack(payload: dict) -> str:
    return json.dumps({"payload": payload})


def test_an_old_single_file_pack_still_imports() -> None:
    payload = packs.verify_pack(_pack(PAYLOAD))
    assert payload["items"][0]["parts"][0]["edges"] is False
    assert payload["version"] == 1
    # an old pack declares no licence
    assert payload["licence"] is None


def test_old_files_import_without_their_shop_fields() -> None:
    """A pack file may be the payload itself; the fields of the old signed shop packs are dropped."""
    assert packs.verify_pack(json.dumps(PAYLOAD))["id"] == "test.starter"
    shop = {**PAYLOAD, "licensee": "Anna", "instance": "0123456789abcdef"}
    old = json.dumps({"payload": shop, "signature": {"key": "0" * 12, "sig": "not checked"}})
    payload = packs.verify_pack(old)
    assert payload["id"] == "test.starter"
    assert not {"licensee", "instance", "signature"} & payload.keys()
    assert not {"licensee", "instance", "signature"} & packs.parts_of(old).keys()


def test_non_packs_are_rejected() -> None:
    for text in ("{}", "[]", json.dumps({"payload": {**PAYLOAD, "format": "other"}})):
        with pytest.raises(packs.PackError) as err:
            packs.verify_pack(text)
        assert err.value.code == "not_a_pack"
    with pytest.raises(packs.PackError) as err:
        packs.verify_pack("not json")
    assert err.value.code == "not_a_pack"


def test_module_packs_are_refused() -> None:
    """Module code (JavaScript in a pack) is not supported: such a pack does not validate."""
    module = {**PAYLOAD, "items": [], "module": {"api": 1, "kind": "voice", "code": "export default {};"}}
    with pytest.raises(packs.PackError):
        packs.verify_pack(_pack(module))


def test_sloped_and_lying_parts_are_accepted() -> None:
    shaped = copy.deepcopy(PAYLOAD)
    box = {"x": 0, "z": 0.2, "w": 1, "d": 0.6, "y": 0, "h": 0.5, "color": "body"}
    shaped["items"][0]["parts"] = [
        {"shape": "loft", **box, "tx": 0, "tz": 0.1, "tw": 0.9, "td": 0.2, "edges": "glow"},
        {"shape": "cyl", "axis": "x", **box, "edges": "faint"},
    ]
    payload = packs.verify_pack(_pack(shaped))
    assert payload["items"][0]["parts"][0]["edges"] == "glow"
    assert payload["items"][0]["parts"][1]["axis"] == "x"
    bad = copy.deepcopy(shaped)
    bad["items"][0]["parts"][1]["axis"] = "w"
    with pytest.raises(packs.PackError):
        packs.verify_pack(_pack(bad))


def test_spheres_lathes_and_rounded_boxes_are_accepted_in_a_v2_item() -> None:
    """Three more shapes (#4): a sphere fills its part box, a lathe turns a profile, a rounded box rounds its edges."""
    box = {"x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 1, "color": "pot"}
    vase = _item(
        "vase",
        parts=[
            {"shape": "sphere", **box, "fix": "wdh"},
            {"shape": "lathe", **box, "profile": [[0, 0], [0.6, 0], [1, 0.4], [0.35, 1]]},
            {"shape": "rbox", **box, "round": 0.3},
            {"shape": "rbox", **box},
        ],
    )
    pack = packs.verify_folder(_folder(**{"deco/vase.json": vase}))
    parts = pack["items"][0]["parts"]
    assert [p["shape"] for p in parts] == ["sphere", "lathe", "rbox", "rbox"]
    assert parts[1]["profile"] == [[0, 0], [0.6, 0], [1, 0.4], [0.35, 1]]
    assert parts[2]["round"] == 0.3
    assert parts[0]["fix"] == "wdh"


def test_a_curved_shell_is_accepted_in_a_v2_item() -> None:
    """A curved shell (#252): side stations, an optional plan, a rounding and a taper."""
    box = {"x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 1, "color": "paint"}
    side = [[0, 0.3, 0.6], [0.1, 0, 0.8], [0.9, 0, 0.7], [1, 0.3, 0.5]]
    car = _item(
        "car",
        parts=[
            {"shape": "shell", **box, "side": side, "plan": [[0, 0.8], [0.5, 1], [1, 0.7]], "round": 0.3, "taper": 0.9},
            {"shape": "shell", **box, "color": "glass", "side": [[0, 0, 0], [1, 0, 1]]},
        ],
    )
    pack = packs.verify_folder(_folder(**{"vehicle/car.json": car}))
    parts = pack["items"][0]["parts"]
    assert [p["shape"] for p in parts] == ["shell", "shell"]
    assert parts[0]["side"] == side
    assert parts[0]["plan"] == [[0, 0.8], [0.5, 1], [1, 0.7]]
    assert parts[0]["round"] == 0.3
    assert parts[0]["taper"] == 0.9
    assert "plan" not in parts[1]


def test_an_older_home_3d_asks_for_an_update_for_a_shell() -> None:
    """A version without shells refuses one as a value it does not know yet (needs_update), not as broken content."""
    shapes = packs.PART_SHAPES
    try:
        packs.PART_SHAPES = [s for s in shapes if s != "shell"]
        old = packs._PART_FIELDS.schema.copy()
        old[next(k for k in old if str(k) == "shape")] = vol.In(packs.PART_SHAPES)
        schema = vol.All(vol.Schema(old), packs._shape_fields)
        box = {"x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 1, "color": "paint"}
        part = {"shape": "shell", **box, "side": [[0, 0, 1], [1, 0, 1]]}
        with pytest.raises(packs.PackError) as err:
            packs._check(schema, "car.json", part)
        assert err.value.code == "needs_update"
    finally:
        packs.PART_SHAPES = shapes


@pytest.mark.parametrize(
    ("part", "why"),
    [
        ({"shape": "shell"}, "a shell needs its side view"),
        ({"shape": "shell", "side": [[0, 0, 1]]}, "a side has at least two stations"),
        ({"shape": "shell", "side": [[n / 16, 0, 1] for n in range(17)]}, "at most sixteen stations"),
        ({"shape": "shell", "side": [[0.5, 0, 1], [0.2, 0, 1]]}, "stations run from the back to the front"),
        ({"shape": "shell", "side": [[0, 0.8, 0.2], [1, 0, 1]]}, "the top is above the bottom"),
        ({"shape": "shell", "side": [[0, 0, 1.2], [1, 0, 1]]}, "the top stays within the part"),
        ({"shape": "shell", "side": [[0, 0], [1, 0]]}, "a station is z, bottom and top"),
        ({"shape": "shell", "side": [[0, 0, 1], [1, 0, 1]], "plan": [[1, 1], [0, 1]]}, "the plan runs back to front"),
        ({"shape": "shell", "side": [[0, 0, 1], [1, 0, 1]], "plan": [[0, 1.5], [1, 1]]}, "the plan stays in the part"),
        ({"shape": "shell", "side": [[0, 0, 1], [1, 0, 1]], "taper": 2}, "a taper is at most 1.5"),
        ({"shape": "box", "side": [[0, 0, 1], [1, 0, 1]]}, "only a shell has a side view"),
        ({"shape": "box", "plan": [[0, 1], [1, 1]]}, "only a shell has a plan"),
        ({"shape": "rbox", "taper": 0.5}, "only a shell has a taper"),
        ({"shape": "lathe"}, "a lathe needs its profile"),
        ({"shape": "lathe", "profile": [[0.5, 0]]}, "a profile has at least two points"),
        ({"shape": "lathe", "profile": [[0.5, n / 20] for n in range(13)]}, "at most twelve points"),
        ({"shape": "lathe", "profile": [[1.2, 0], [1, 1]]}, "the radius stays within the part"),
        ({"shape": "lathe", "profile": [[0.5, 0], [0.5, 1.5]]}, "the height stays within the part"),
        ({"shape": "lathe", "profile": [[0.5, 0, 1], [0.5, 1]]}, "a point is a radius and a height"),
        ({"shape": "box", "profile": [[0.5, 0], [0.5, 1]]}, "only a lathe has a profile"),
        ({"shape": "rbox", "round": 0.8}, "rounding is at most half the shortest side"),
        ({"shape": "rbox", "round": 0}, "a rounded box is rounded"),
        ({"shape": "sphere", "round": 0.2}, "only a rounded box has a rounding"),
    ],
)
def test_bad_new_shape_fields_are_refused(part: dict, why: str) -> None:
    item = _item("vase", parts=[{"x": 0, "z": 0, "w": 1, "d": 1, "y": 0, "h": 1, "color": "pot", **part}])
    with pytest.raises(packs.PackError) as err:
        packs.verify_folder(_folder(**{"vase.json": item}))
    assert err.value.code == "invalid_content", why


def test_every_item_example_in_the_pack_docs_is_valid() -> None:
    """The examples in docs/packs.md (one per shape) are what pack authors copy: they must pass the checks."""
    docs = (pathlib.Path(__file__).parent.parent / "docs" / "packs.md").read_text(encoding="utf-8")
    examples = [json.loads(block) for block in re.findall(r"```json\n(.*?)```", docs, re.DOTALL)]
    items = {e["id"]: e for e in examples if "parts" in e}
    shapes = {p["shape"] for item in items.values() for p in item["parts"]}
    assert {"sphere", "lathe", "rbox"} <= shapes
    pack = packs.verify_folder(_folder(**{f"{i}.json": item for i, item in items.items()}))
    assert len(pack["items"]) == len(items)


def test_pack_content_is_checked() -> None:
    heavy = copy.deepcopy(PAYLOAD)
    heavy["items"][0]["parts"] *= 31  # more than 60 parts
    with pytest.raises(packs.PackError) as err:
        packs.verify_pack(_pack(heavy))
    assert err.value.code == "invalid_content"
    twice = copy.deepcopy(PAYLOAD)
    twice["items"].append(copy.deepcopy(twice["items"][0]))
    with pytest.raises(packs.PackError):
        packs.verify_pack(_pack(twice))


async def test_import_list_and_remove(hass: HomeAssistant, hass_ws_client) -> None:
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    client = await hass_ws_client(hass)

    await client.send_json_auto_id({"type": "home_3d/packs/import", "pack": _pack({**PAYLOAD, "licensee": "Anna"})})
    result = await client.receive_json()
    assert result["success"]
    assert result["result"] == {
        "id": "test.starter",
        "name": "Starter",
        "publisher": "Test",
        "licence": None,
        "items": 1,
    }

    await client.send_json_auto_id({"type": "home_3d/packs/import", "pack": "{}"})
    result = await client.receive_json()
    assert not result["success"] and result["error"]["code"] == "not_a_pack"

    await client.send_json_auto_id({"type": "home_3d/packs/list"})
    listed = _imported((await client.receive_json())["result"]["packs"])
    assert [p["id"] for p in listed] == ["test.starter"]
    assert listed[0]["items"][0]["name"]["fr"] == "Fauteuil cube"

    await client.send_json_auto_id({"type": "home_3d/packs/remove", "pack_id": "test.starter"})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/packs/list"})
    assert _imported((await client.receive_json())["result"]["packs"]) == []


def test_turned_parts_and_stairs_holes_are_accepted() -> None:
    """A part may turn around its centre (rot) and a stairs item may cut the floor above (hole)."""
    item = copy.deepcopy(PAYLOAD["items"][0])
    item["hole"] = True
    item["parts"][0]["rot"] = 27.5
    clean = packs.validate_payload({**PAYLOAD, "items": [item]})
    assert clean["items"][0]["hole"] is True
    assert clean["items"][0]["parts"][0]["rot"] == 27.5
    with pytest.raises(packs.PackError):
        item["parts"][0]["rot"] = 400
        packs.validate_payload({**PAYLOAD, "items": [item]})


def test_library_fields_are_accepted_and_checked() -> None:
    """A pack may say what an item is, which rooms it is for and which variants belong together (1.23)."""
    library = {"group": "seating", "room": ["living", "kids"], "tags": ["cube", "kids"], "family": "cube_chair"}
    item = {**PAYLOAD["items"][0], **library, "variant": {"fr": "80", "en": "80"}}
    clean = packs.validate_payload({**PAYLOAD, "items": [item]})
    assert clean["items"][0]["group"] == "seating"
    assert clean["items"][0]["room"] == ["living", "kids"]
    assert clean["items"][0]["variant"] == {"fr": "80", "en": "80"}
    with pytest.raises(packs.PackError):
        packs.validate_payload({**PAYLOAD, "items": [{**item, "room": "living"}]})
    with pytest.raises(packs.PackError):
        packs.validate_payload({**PAYLOAD, "items": [{**item, "group": "Not An Id"}]})


def test_an_item_may_carry_its_ikea_name() -> None:
    """An item's IKEA product name is kept for the library's search; it is a short text (#5)."""
    item = {**PAYLOAD["items"][0], "ikea": "KALLAX"}
    clean = packs.validate_payload({**PAYLOAD, "items": [item]})
    assert clean["items"][0]["ikea"] == "KALLAX"
    assert "ikea" not in packs.validate_payload(PAYLOAD)["items"][0]
    for bad in ("", "X" * 41, ["KALLAX"], 5):
        with pytest.raises(packs.PackError):
            packs.validate_payload({**PAYLOAD, "items": [{**item, "ikea": bad}]})


def test_an_item_may_name_its_parts_by_role() -> None:
    """`role_names` names the part in a role, so the colour row reads "Panels", not "White" (#411)."""
    item = {**PAYLOAD["items"][0], "role_names": {"white": "panels", "metal": "valves"}}
    clean = packs.validate_payload({**PAYLOAD, "items": [item]})
    assert clean["items"][0]["role_names"] == {"white": "panels", "metal": "valves"}
    assert "role_names" not in packs.validate_payload(PAYLOAD)["items"][0]
    for bad in ({}, {"white": "Panels"}, {"white": "radiator"}, {"chrome": "panels"}, ["panels"]):
        with pytest.raises(packs.PackError):
            packs.validate_payload({**PAYLOAD, "items": [{**item, "role_names": bad}]})


def test_feature_packs_need_no_items_but_a_pack_needs_something() -> None:
    """A pack may list features without furniture (compatibility); an empty pack is refused."""
    pro = {**PAYLOAD, "id": "test.pro", "items": [], "features": ["camera_cockpit", "weather"]}
    assert packs.validate_payload(pro)["features"] == ["camera_cockpit", "weather"]
    with pytest.raises(packs.PackError):
        packs.validate_payload({**PAYLOAD, "items": []})
    # a feature this version does not know asks for an update (#218)
    with pytest.raises(packs.PackError) as err:
        packs.validate_payload({**pro, "features": ["some_future_addon"]})
    assert err.value.code == "needs_update"
    assert err.value.detail == "some_future_addon"


def test_a_newer_part_shape_asks_for_an_update() -> None:
    """An unknown value of a newer pack asks for an update (voluptuous and Probatio); other faults stay errors."""
    item = copy.deepcopy(PAYLOAD["items"][0])
    item["parts"][0]["shape"] = "some_future_shape"
    with pytest.raises(packs.PackError) as err:
        packs.validate_payload({**PAYLOAD, "items": [item]})
    assert err.value.code == "needs_update"
    item["parts"][0]["shape"] = "box"
    item["parts"][0]["w"] = "wide"
    with pytest.raises(packs.PackError) as err:
        packs.validate_payload({**PAYLOAD, "items": [item]})
    assert err.value.code == "invalid_content"


def test_probatio_marks_an_unknown_value_by_its_code() -> None:
    """Probatio (Home Assistant 2026.9+) words its errors its own way but gives the code "not_in_list"."""
    probatio = SimpleNamespace(errors=[SimpleNamespace(code="not_in_list")])
    assert packs._unknown_value(probatio)  # type: ignore[arg-type]
    assert not packs._unknown_value(vol.MultipleInvalid([vol.Invalid("expected float")]))


# ---------------------------------------------------------------------------- pack format v2 (a folder)

PACK_JSON = {
    "format": "home3d-pack",
    "version": 2,
    "id": "test.starter",
    "name": "Starter",
    "publisher": "Test",
    "licence": "MIT",
}


def _item(item_id: str, **extra) -> dict:
    return {**copy.deepcopy(PAYLOAD["items"][0]), "id": item_id, **extra}


def _folder(pack: dict | None = None, **items: dict) -> dict[str, str]:
    """A pack folder as the loader gets it: relative path -> file text."""
    files = {"pack.json": json.dumps(pack if pack is not None else PACK_JSON)}
    for path, item in items.items():
        files[path] = json.dumps(item)
    return files


@pytest.mark.parametrize("depth", [1_500, 24_000])
def test_deeply_nested_json_is_invalid_content(depth: int) -> None:
    """JSON nested deeper than Python recurses (within the file size limit) is invalid content, not an unknown error
    (#47)."""
    deep = "[" * depth + "]" * depth
    with pytest.raises(packs.PackError) as err:
        packs.verify_folder({**_folder(**{"cube_chair.json": _item("cube_chair")}), "deep.json": deep})
    assert err.value.code == "invalid_content"
    assert "deep.json" in str(err.value)
    # an old single-file pack: a PackError too, whichever check meets it first
    with pytest.raises(packs.PackError):
        packs.verify_pack(deep)


def test_a_v2_pack_folder_loads_with_its_items() -> None:
    files = _folder(
        **{
            "cube_chair.json": _item("cube_chair"),
            "seating/stool.json": _item("stool", group="seating"),
            "tables/side_table.json": _item("side_table"),
        }
    )
    pack = packs.verify_folder(files)
    assert pack["id"] == "test.starter"
    assert pack["licence"] == "MIT"
    assert pack["version"] == 2
    assert sorted(item["id"] for item in pack["items"]) == ["cube_chair", "side_table", "stool"]


def test_a_v2_pack_without_a_licence_is_refused() -> None:
    unlicensed = {k: v for k, v in PACK_JSON.items() if k != "licence"}
    for pack in (unlicensed, {**PACK_JSON, "licence": ""}):
        with pytest.raises(packs.PackError) as err:
            packs.verify_folder(_folder(pack, **{"cube_chair.json": _item("cube_chair")}))
        assert err.value.code == "no_licence"
        assert "pack.json" in str(err.value)
    # the American spelling is understood
    us = {**unlicensed, "license": "CC-BY-4.0"}
    assert packs.verify_folder(_folder(us, **{"cube_chair.json": _item("cube_chair")}))["licence"] == "CC-BY-4.0"


def test_a_v2_pack_with_a_bad_item_is_refused_naming_the_file() -> None:
    bad = _item("stool")
    bad["parts"][0]["w"] = "wide"
    with pytest.raises(packs.PackError) as err:
        packs.verify_folder(_folder(**{"cube_chair.json": _item("cube_chair"), "seating/stool.json": bad}))
    assert err.value.code == "invalid_content"
    assert err.value.detail.startswith("seating/stool.json: ")
    # an item file holds the item of its name, once per pack
    with pytest.raises(packs.PackError) as err:
        packs.verify_folder(_folder(**{"chair.json": _item("cube_chair")}))
    assert err.value.code == "invalid_content" and "chair.json" in err.value.detail
    with pytest.raises(packs.PackError) as err:
        packs.verify_folder(_folder(**{"a/stool.json": _item("stool"), "b/stool.json": _item("stool")}))
    assert err.value.code == "invalid_content" and "stool" in err.value.detail
    # a pack needs items
    with pytest.raises(packs.PackError) as err:
        packs.verify_folder(_folder())
    assert err.value.code == "invalid_content"


def test_a_v2_pack_holds_up_to_a_thousand_items() -> None:
    # the core pack outgrew 500; a pack takes 1000 items, the 1001st is refused
    full = _folder(**{f"i{n}.json": _item(f"i{n}") for n in range(1000)})
    assert len(packs.verify_folder(full)["items"]) == 1000
    over = _folder(**{f"i{n}.json": _item(f"i{n}") for n in range(1001)})
    with pytest.raises(packs.PackError) as err:
        packs.verify_folder(over)
    assert err.value.code == "too_many_items"


def test_a_v2_pack_over_the_limits_is_refused() -> None:
    # one file larger than a file may be
    big = _item("cube_chair", tags=["x"])
    files = _folder(**{"cube_chair.json": big})
    files["cube_chair.json"] += " " * packs.MAX_FILE_SIZE
    with pytest.raises(packs.PackError) as err:
        packs.verify_folder(files)
    assert err.value.code == "too_large" and "cube_chair.json" in err.value.detail
    # more items than a pack may hold
    many = _folder(**{f"i{n}.json": _item(f"i{n}") for n in range(packs.MAX_ITEMS + 1)})
    with pytest.raises(packs.PackError) as err:
        packs.verify_folder(many)
    assert err.value.code == "too_many_items"
    # more parts than an item may have
    heavy = _item("cube_chair")
    heavy["parts"] *= 31
    with pytest.raises(packs.PackError) as err:
        packs.verify_folder(_folder(**{"cube_chair.json": heavy}))
    assert err.value.code == "invalid_content"


def test_a_v2_pack_is_data_only() -> None:
    chair = {"cube_chair.json": _item("cube_chair")}
    # code, pictures and other files are refused
    for path in ("module.js", "pictures/chair.png", "chair.svg", "notes.txt"):
        files = {**_folder(**chair), path: "x"}
        with pytest.raises(packs.PackError) as err:
            packs.verify_folder(files)
        assert err.value.code == "not_data" and path in err.value.detail
    # a readme and the licence text may come along; they are not read
    docs = {**_folder(**chair), "README.md": "# Pack", "LICENSE": "MIT …", "LICENCE.txt": "MIT …"}
    assert len(packs.verify_folder(docs)["items"]) == 1
    # paths stay inside the folder
    for path in ("../evil.json", "/abs.json", "a/../../b.json", "A/b.json"):
        with pytest.raises(packs.PackError) as err:
            packs.verify_folder({**_folder(**chair), path: json.dumps(_item(path.rsplit("/", 1)[-1][:-5]))})
        assert err.value.code == "not_data"
    # no links in any text
    linked = _item("cube_chair", tags=["see https://example.com"])
    with pytest.raises(packs.PackError) as err:
        packs.verify_folder(_folder(**{"cube_chair.json": linked}))
    assert err.value.code == "not_data" and "cube_chair.json" in err.value.detail
    with pytest.raises(packs.PackError) as err:
        packs.verify_folder(_folder({**PACK_JSON, "description": "More at www.example.com"}, **chair))
    assert err.value.code == "not_data" and "pack.json" in err.value.detail
    # unknown keys (an old shop field, code) are refused
    for extra in ({"signature": "x"}, {"licensee": "Anna"}, {"instance": "0123456789abcdef"}, {"code": "x"}):
        with pytest.raises(packs.PackError):
            packs.verify_folder(_folder({**PACK_JSON, **extra}, **chair))


async def _client(hass: HomeAssistant, hass_ws_client):
    await async_setup_component(hass, "http", {})
    entry = MockConfigEntry(domain=DOMAIN, data={})
    entry.add_to_hass(hass)
    assert await hass.config_entries.async_setup(entry.entry_id)
    await hass.async_block_till_done()
    return await hass_ws_client(hass)


async def test_a_v2_pack_folder_imports_and_lists(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    files = _folder(**{"cube_chair.json": _item("cube_chair"), "tables/side_table.json": _item("side_table")})
    await client.send_json_auto_id({"type": "home_3d/packs/import", "files": files})
    result = await client.receive_json()
    assert result["success"], result
    assert result["result"] == {
        "id": "test.starter",
        "name": "Starter",
        "publisher": "Test",
        "licence": "MIT",
        "items": 2,
    }

    await client.send_json_auto_id({"type": "home_3d/packs/list"})
    listed = _imported((await client.receive_json())["result"]["packs"])
    assert [p["id"] for p in listed] == ["test.starter"]
    assert listed[0]["licence"] == "MIT"
    assert sorted(item["id"] for item in listed[0]["items"]) == ["cube_chair", "side_table"]

    # a refused folder says why, naming the file
    unlicensed = {k: v for k, v in PACK_JSON.items() if k != "licence"}
    await client.send_json_auto_id(
        {"type": "home_3d/packs/import", "files": _folder(unlicensed, **{"cube_chair.json": _item("cube_chair")})}
    )
    result = await client.receive_json()
    assert not result["success"]
    assert result["error"]["code"] == "no_licence" and "pack.json" in result["error"]["message"]

    # a request carries a pack file or a folder
    await client.send_json_auto_id({"type": "home_3d/packs/import"})
    assert not (await client.receive_json())["success"]


async def test_a_v2_pack_comes_back_from_a_backup(hass: HomeAssistant, hass_ws_client) -> None:
    client = await _client(hass, hass_ws_client)
    files = _folder(**{"cube_chair.json": _item("cube_chair")})
    await client.send_json_auto_id({"type": "home_3d/packs/import", "files": files})
    assert (await client.receive_json())["success"]
    await client.send_json_auto_id({"type": "home_3d/backup/export"})
    backup = (await client.receive_json())["result"]
    await client.send_json_auto_id({"type": "home_3d/packs/remove", "pack_id": "test.starter"})
    assert (await client.receive_json())["success"]

    await client.send_json_auto_id(
        {"type": "home_3d/backup/import", "building": backup["building"], "packs": backup["packs"]}
    )
    result = await client.receive_json()
    assert result["success"] and result["result"]["packs"] == 1 and result["result"]["skipped"] == []
    await client.send_json_auto_id({"type": "home_3d/packs/list"})
    listed = _imported((await client.receive_json())["result"]["packs"])
    assert listed[0]["id"] == "test.starter" and listed[0]["licence"] == "MIT"


def test_a_v2_pack_json_imported_as_a_file_asks_for_the_folder() -> None:
    with pytest.raises(packs.PackError) as err:
        packs.verify_pack(json.dumps(PACK_JSON))
    assert err.value.code == "not_a_pack" and "folder" in err.value.detail
    # every refusal says why
    with pytest.raises(packs.PackError) as err:
        packs.verify_pack("{}")
    assert err.value.detail
