"""Start views of the house, a floor and a room (#206, #282)."""

import copy
import json
from pathlib import Path
import re

import pytest
import voluptuous as vol

from custom_components.home_3d.schema import (
    BUILDING_SCHEMA,
    ENERGY_SCHEMA,
    FURNITURE_SCHEMA,
    HOLOGRAM_SCHEMA,
    MATERIALS,
    OPENING_SCHEMA,
    OUTDOOR_SCHEMA,
    PLACEMENT_SCHEMA,
    ROOF_SECTION_SCHEMA,
    ROOM_SCHEMA,
    SETTINGS_SCHEMA,
    START_VIEW_SCHEMA,
    empty_building,
)
from custom_components.home_3d.storage import check_plan
from tests.test_init import BUILDING

ROOM = {"id": "r1", "name": "Bad", "area_id": None, "points": [[0, 0], [2, 0], [2, 2]], "floor_material": "tiles"}


def test_start_view_keeps_its_target() -> None:
    view = START_VIEW_SCHEMA({"theta": 1, "phi": 0.8, "radius": 9, "target": {"x": 1, "y": 0.5, "z": -2}})
    assert view["target"] == {"x": 1.0, "y": 0.5, "z": -2.0}


def test_start_view_after_several_turns() -> None:
    # a camera turned round twice saves its angle once round (#416)
    view = START_VIEW_SCHEMA({"theta": 13.214, "phi": 0.8, "radius": 9})
    assert -3.15 < view["theta"] < 3.15
    assert abs(view["theta"] - (13.214 - 4 * 3.141592653589793)) < 1e-9


def test_start_view_without_target() -> None:
    assert "target" not in START_VIEW_SCHEMA({"theta": 1, "phi": 0.8, "radius": 9})


def test_room_start_view() -> None:
    assert ROOM_SCHEMA(ROOM)["start_view"] is None
    view = {"theta": 0.5, "phi": 0.9, "radius": 4, "target": {"x": 1, "y": 0.3, "z": 1}}
    room = ROOM_SCHEMA({**ROOM, "start_view": view})
    assert room["start_view"]["radius"] == 4.0


def test_inverted_contact_and_plant_card_offsets() -> None:
    gate = {"id": "o1", "room_id": "r1", "edge": 0, "offset": 1, "type": "garage"}
    gate |= {"width": 2.5, "sill": 0, "height": 2.1}
    assert OPENING_SCHEMA(gate)["contact_invert"] is False
    assert OPENING_SCHEMA({**gate, "contact_invert": True})["contact_invert"] is True
    # window board / sill: automatic unless the plan says otherwise (#655)
    assert OPENING_SCHEMA(gate)["sill_board"] == "auto"
    assert OPENING_SCHEMA({**gate, "sill_board": "inside"})["sill_board"] == "inside"
    with pytest.raises(vol.Invalid):
        OPENING_SCHEMA({**gate, "sill_board": "both"})
    inv = {"id": "f1", "type": "inverter", "x": 0, "z": 0, "rotation": 0, "w": 0.5, "d": 0.2, "h": 0.6, "variant": None}
    assert "plant_right" not in FURNITURE_SCHEMA(inv)
    moved = FURNITURE_SCHEMA({**inv, "plant_right": 1.5, "plant_up": -2})
    assert (moved["plant_right"], moved["plant_up"]) == (1.5, -2.0)


def test_room_ceiling_height() -> None:
    """A room may have a ceiling of its own (#30); none keeps the floor height."""
    assert "ceiling_height" not in ROOM_SCHEMA(ROOM)
    assert ROOM_SCHEMA({**ROOM, "ceiling_height": 2.5})["ceiling_height"] == 2.5
    assert ROOM_SCHEMA({**ROOM, "ceiling_height": None})["ceiling_height"] is None


def test_plant_cards_in_floor_views_are_off_by_default() -> None:
    """The house balance and plant cards in floor views is a switch, off by default (#193)."""
    assert HOLOGRAM_SCHEMA({})["plant_floor"] is False
    assert HOLOGRAM_SCHEMA({"plant_floor": True})["plant_floor"] is True


def test_length_units_follow_home_assistant_unless_set() -> None:
    """Feet and inches are a display setting (#117): None follows Home Assistant, storage stays metric."""
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}
    assert SETTINGS_SCHEMA(base)["units"] is None
    assert SETTINGS_SCHEMA({**base, "units": "imperial"})["units"] == "imperial"
    assert SETTINGS_SCHEMA(base)["person_look"] is None
    assert SETTINGS_SCHEMA({**base, "person_look": "pin"})["person_look"] == "pin"


def test_easter_eggs_are_one_house_wide_switch_on_by_default() -> None:
    """The easter eggs switch (#139) belongs to the plan: on unless switched off, and only a boolean."""
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}
    assert SETTINGS_SCHEMA(base)["easter_eggs"] is True
    assert SETTINGS_SCHEMA({**base, "easter_eggs": False})["easter_eggs"] is False
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "easter_eggs": "sometimes"})


def test_seasons_switch_off_single_holidays() -> None:
    """Seasonal themes (#239): a holiday switched off is False under its id; none by default, only booleans."""
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}
    assert "seasons" not in SETTINGS_SCHEMA(base)
    assert SETTINGS_SCHEMA({**base, "seasons": {"christmas": False}})["seasons"] == {"christmas": False}
    assert SETTINGS_SCHEMA({**base, "seasons": None})["seasons"] is None
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "seasons": {"christmas": "maybe"}})


def test_season_dates_change_a_holidays_days() -> None:
    """Holiday dates (#287): "MM-DD" from and an optional to under the holiday's id; none by default."""
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}
    assert "season_dates" not in SETTINGS_SCHEMA(base)
    dates = {"halloween": {"from": "10-29", "to": "11-01"}, "christmas": {"from": "12-20"}}
    assert SETTINGS_SCHEMA({**base, "season_dates": dates})["season_dates"] == dates
    assert SETTINGS_SCHEMA({**base, "season_dates": None})["season_dates"] is None
    for bad in ({"from": "13-01"}, {"from": "1-1"}, {"to": "10-31"}, {"from": "10-31", "to": "soon"}):
        with pytest.raises(vol.Invalid):
            SETTINGS_SCHEMA({**base, "season_dates": {"halloween": bad}})


def test_season_rules_give_a_holidays_days_by_rule() -> None:
    """Holiday date rules (#339): fixed day, Easter offset, n-th weekday, one-off window; each kind needs its fields."""
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}
    assert "season_rules" not in SETTINGS_SCHEMA(base)
    rules = {
        "halloween": [{"kind": "fixed", "month": 10, "day": 31, "days": 2, "start": "18:00", "end": "02:00"}],
        "easter": [{"kind": "easter", "offset": -2, "days": 4}],
        "fathers_day": [{"kind": "nth", "month": 6, "nth": -1, "weekday": 0}],
        "bonfire": [{"kind": "once", "from": "2027-11-05", "to": "2027-11-06"}],
        "chinese_new_year": [{"kind": "cny"}],
    }
    assert SETTINGS_SCHEMA({**base, "season_rules": rules})["season_rules"] == rules
    assert SETTINGS_SCHEMA({**base, "season_rules": None})["season_rules"] is None
    # old MM-DD dates still load next to rules, unchanged
    both = {**base, "season_dates": {"halloween": {"from": "10-29", "to": "11-01"}}, "season_rules": rules}
    assert SETTINGS_SCHEMA(both)["season_dates"] == both["season_dates"]
    bad_rules = (
        {"kind": "fixed", "month": 10},
        {"kind": "easter"},
        {"kind": "nth", "month": 5, "nth": 6, "weekday": 1},
        {"kind": "nth", "month": 5, "nth": 1, "weekday": 7},
        {"kind": "once", "from": "11-05"},
        {"kind": "fixed", "month": 13, "day": 1},
        {"kind": "fixed", "month": 1, "day": 1, "days": 0},
        {"kind": "fixed", "month": 1, "day": 1, "start": "25:00"},
        {"kind": "moon"},
    )
    for bad in bad_rules:
        with pytest.raises(vol.Invalid):
            SETTINGS_SCHEMA({**base, "season_rules": {"halloween": [bad]}})


def test_furniture_block() -> None:
    """Furniture blocks: items with the same group id move together; none by default."""
    item = {"id": "f1", "type": "kitchen", "x": 0, "z": 0, "rotation": 0, "w": 0.6, "d": 0.6, "h": 0.9, "variant": None}
    assert FURNITURE_SCHEMA(item)["group"] is None
    assert FURNITURE_SCHEMA({**item, "group": "block_1"})["group"] == "block_1"


def test_pool_depth_rim_and_port_depth() -> None:
    """A pool's basin depth and rim, and how deep an inlet sits below the water line."""
    from custom_components.home_3d.schema import OUTDOOR_SCHEMA, POOL_PORT_SCHEMA

    pool = {"id": "p", "type": "pool", "points": [[0, 0], [8, 0], [8, 4], [0, 4]]}
    assert OUTDOOR_SCHEMA(pool)["depth"] is None
    out = OUTDOOR_SCHEMA({**pool, "depth": 1.5, "rim": 0.2})
    assert (out["depth"], out["rim"]) == (1.5, 0.2)
    assert POOL_PORT_SCHEMA({"id": "i", "kind": "inlet", "x": 1, "z": 0, "depth": 0.3})["depth"] == 0.3


def test_household_fields_are_kept_and_checked() -> None:
    """A waste bin keeps its kind, colours and calendar; a mailbox its door; wrong values are refused."""
    base = {
        "id": "b1",
        "type": "waste_bin",
        "x": 1,
        "z": 1,
        "rotation": 0,
        "w": 0.58,
        "d": 0.73,
        "h": 1.07,
        "variant": None,
    }
    out = FURNITURE_SCHEMA(
        {
            **base,
            "bin_kind": "paper",
            "bin_color": "#1f4fa8",
            "bin_lid": None,
            "bin_source": "calendar.waste",
            "bin_match": "Papier",
        }
    )
    assert out["bin_kind"] == "paper" and out["bin_source"] == "calendar.waste"
    assert "bin_kind" not in FURNITURE_SCHEMA(base)
    mail = FURNITURE_SCHEMA({**base, "type": "mailbox", "mailbox_door": "binary_sensor.door"})
    assert mail["mailbox_door"] == "binary_sensor.door"
    extras = FURNITURE_SCHEMA(
        {
            **base,
            "type": "washer",
            "remaining": "sensor.left",
            "service": "binary_sensor.salt",
            "service_min": 5,
            "moisture": None,
            "door_alarm": 3,
        }
    )
    assert (extras["remaining"], extras["service"], extras["service_min"], extras["door_alarm"]) == (
        "sensor.left",
        "binary_sensor.salt",
        5,
        3,
    )
    out_bin = FURNITURE_SCHEMA({**base, "bin_out": "input_boolean.bin_out"})
    assert out_bin["bin_out"] == "input_boolean.bin_out" and "bin_out" not in FURNITURE_SCHEMA(base)
    robot = FURNITURE_SCHEMA({**base, "type": "robot", "service2": "sensor.dock_bag", "service2_min": 0})
    assert (robot["service2"], robot["service2_min"]) == ("sensor.dock_bag", 0)
    bads = ({"bin_kind": "nuclear"}, {"bin_color": "blue"}, {"moisture_min": 150}, {"door_alarm": 0})
    for bad in (*bads, {"service2_min": -1}):
        with pytest.raises(vol.Invalid):
            FURNITURE_SCHEMA({**base, **bad})


def test_bin_kerb_spot_is_kept_and_checked() -> None:
    """A bin's kerb spot (#142) is a plan point or null; anything else is refused."""
    base = {"id": "b1", "type": "waste_bin", "x": 1, "z": 1, "rotation": 0, "w": 0.6, "d": 0.7, "h": 1.1}
    base["variant"] = None
    assert FURNITURE_SCHEMA({**base, "bin_kerb": {"x": 4.5, "z": -2}})["bin_kerb"] == {"x": 4.5, "z": -2.0}
    assert FURNITURE_SCHEMA({**base, "bin_kerb": None})["bin_kerb"] is None
    assert "bin_kerb" not in FURNITURE_SCHEMA(base)
    for bad in ({"x": 1}, {"x": 1, "z": 2, "y": 0}, {"x": 5000, "z": 0}, [1, 2]):
        with pytest.raises(vol.Invalid):
            FURNITURE_SCHEMA({**base, "bin_kerb": bad})


def test_colour_role_overrides_are_kept_and_checked() -> None:
    """An item keeps its own colour per role (#12); an unknown role or a colour that is not #rrggbb is refused."""
    base = {"id": "s1", "type": "sofa", "x": 1, "z": 1, "rotation": 0, "w": 2, "d": 0.9, "h": 0.85, "variant": None}
    out = FURNITURE_SCHEMA({**base, "colors": {"fabric": "#8a8c8f", "wood": "#5c4033"}})
    assert out["colors"] == {"fabric": "#8a8c8f", "wood": "#5c4033"}
    assert FURNITURE_SCHEMA({**base, "colors": None})["colors"] is None
    assert "colors" not in FURNITURE_SCHEMA(base)
    for bad in ({"chrome": "#ffffff"}, {"wood": "brown"}, {"wood": "#12345"}, "red"):
        with pytest.raises(vol.Invalid):
            FURNITURE_SCHEMA({**base, "colors": bad})


def test_material_per_colour_role_is_kept_and_checked() -> None:
    """An item keeps its own material per role (#40); an unknown role or material is refused."""
    base = {"id": "s1", "type": "sofa", "x": 1, "z": 1, "rotation": 0, "w": 2, "d": 0.9, "h": 0.85, "variant": None}
    out = FURNITURE_SCHEMA({**base, "materials": {"fabric": "rattan", "wood": "gloss"}})
    assert out["materials"] == {"fabric": "rattan", "wood": "gloss"}
    assert FURNITURE_SCHEMA({**base, "materials": None})["materials"] is None
    assert "materials" not in FURNITURE_SCHEMA(base)
    for m in ("matt", "gloss", "fabric", "glass", "metal", "rattan"):
        assert FURNITURE_SCHEMA({**base, "materials": {"body": m}})["materials"] == {"body": m}
    for bad in ({"chrome": "metal"}, {"wood": "velvet"}, {"wood": None}, "rattan"):
        with pytest.raises(vol.Invalid):
            FURNITURE_SCHEMA({**base, "materials": bad})


def test_materials_match_the_frontend() -> None:
    """The backend checks the same materials the item panel offers (frontend/src/role-materials.ts)."""
    src = (Path(__file__).parents[1] / "frontend" / "src" / "role-materials.ts").read_text(encoding="utf-8")
    found = re.search(r"export const MATERIALS = (\[[^\]]*\]) as const", src)
    assert found
    assert json.loads(found.group(1)) == MATERIALS


def test_household_tag_settings_are_optional() -> None:
    """The bins' tag settings: missing in old plans, kept when set, a day count out of range is refused."""
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}
    assert SETTINGS_SCHEMA({**base, "household": {"bin_from": 14}})["household"] == {"bin_from": 14}
    out = SETTINGS_SCHEMA({**base, "household": {"bin_next_only": True, "bin_days": 2}})["household"]
    assert out["bin_next_only"] is True and out["bin_days"] == 2
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "household": {"bin_days": 100}})


def test_outdoor_area_keeps_its_name_and_area() -> None:
    """An outdoor area acting as a room (#100) keeps its name and Home Assistant area; without them both are None."""
    base = {"id": "g1", "type": "lawn", "points": [[0, 0], [4, 0], [4, 3]]}
    out = OUTDOOR_SCHEMA({**base, "name": "Back garden", "area_id": "garden"})
    assert out["name"] == "Back garden" and out["area_id"] == "garden"
    plain = OUTDOOR_SCHEMA(base)
    assert plain["name"] is None and plain["area_id"] is None


def test_live_director_is_off_unless_switched_on() -> None:
    """The live director (Kamera-Cockpit): no settings, nothing on; every event is its own switch."""
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}
    assert SETTINGS_SCHEMA(base)["director"] is None
    d = SETTINGS_SCHEMA({**base, "director": {"doorbell": True}})["director"]
    assert d["doorbell"] is True
    assert d["motion"] == "off"
    assert d["appliances"] is False
    assert d["alerts"] is False
    assert d["doorbell_entity"] is None
    full = {
        "doorbell": True,
        "doorbell_entity": "event.ding",
        "doorbell_camera": "camera.door",
        "motion": "person",
        "hold": 45,
    }
    assert SETTINGS_SCHEMA({**base, "director": full})["director"]["hold"] == 45
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "director": {"motion": "cats"}})
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "director": {"hold": 2}})


def test_sloping_walls_keep_two_heights_per_edge() -> None:
    """A sloping wall (D569): two heights on an edge, or None for a plain one."""
    room = {**ROOM, "wall_slopes": [[1.0, 2.6], None, None]}
    assert ROOM_SCHEMA(room)["wall_slopes"] == [[1.0, 2.6], None, None]
    with pytest.raises(vol.Invalid):
        ROOM_SCHEMA({**ROOM, "wall_slopes": [[1.0]]})


def test_live_director_triggers_and_live_picture() -> None:
    """Own triggers with a camera each (D615) and the live picture switch (D589)."""
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}
    d = SETTINGS_SCHEMA(
        {
            **base,
            "director": {
                "triggers": [{"entity": "cover.garage", "camera": "camera.yard"}, {"entity": "event.doorbell_2"}],
                "live": True,
            },
        }
    )["director"]
    assert d["triggers"] == [
        {"entity": "cover.garage", "camera": "camera.yard"},
        {"entity": "event.doorbell_2", "camera": None},
    ]
    assert d["live"] is True


def test_access_point_and_water_heater_keep_their_sensors() -> None:
    """An access point keeps its clients sensor, a water heater its temperature sensor (D582)."""
    ap = {"id": "a1", "type": "wifi_ap", "x": 2, "z": 2, "rotation": 0, "w": 0.2, "d": 0.2, "h": 0.04, "variant": None}
    assert FURNITURE_SCHEMA({**ap, "clients": "sensor.ap_clients"})["clients"] == "sensor.ap_clients"
    heater = {**ap, "id": "h1", "type": "water_heater", "variant": "wall", "water_temp": "sensor.boiler_temp"}
    assert FURNITURE_SCHEMA(heater)["water_temp"] == "sensor.boiler_temp"


def test_ceiling_fan_keeps_its_fan() -> None:
    """A ceiling fan with light keeps its fan entity next to its light (D606)."""
    fan = {
        "id": "f1",
        "type": "lamp_fan",
        "x": 2,
        "z": 2,
        "rotation": 0,
        "w": 1.3,
        "d": 1.3,
        "h": 0.45,
        "variant": None,
    }
    out = FURNITURE_SCHEMA({**fan, "entity": "light.ceiling", "fan": "fan.ceiling"})
    assert out["fan"] == "fan.ceiling"
    assert "fan" not in FURNITURE_SCHEMA(fan)


def test_stairs_keep_their_options_and_check_them() -> None:
    """Open treads, a turn, bottom landing steps, a flat top and a start height are known fields (#16)."""
    stairs = {"id": "s1", "type": "stairs", "x": 2, "z": 2, "rotation": 0, "w": 1, "d": 3.2, "h": 2.75, "variant": None}
    out = FURNITURE_SCHEMA(
        {**stairs, "stair_open": True, "stair_turn": "left", "stair_landing": 3, "stair_top": 0.5, "mount_y": 0.54}
    )
    assert out["stair_open"] is True
    assert out["stair_turn"] == "left"
    assert out["stair_landing"] == 3
    assert out["stair_top"] == 0.5
    assert out["mount_y"] == 0.54
    # a plain stair stays plain, and the editor may send nulls to clear an option
    assert not any(k.startswith("stair_") for k in FURNITURE_SCHEMA(stairs))
    cleared = FURNITURE_SCHEMA(
        {**stairs, "stair_open": None, "stair_turn": None, "stair_landing": None, "stair_top": None}
    )
    assert cleared["stair_turn"] is None and cleared["stair_landing"] is None
    for bad in (
        {"stair_open": "yes"},
        {"stair_turn": "up"},
        {"stair_landing": -1},
        {"stair_landing": 1.5},
        {"stair_top": -0.1},
        {"stair_top": 50},
    ):
        with pytest.raises(vol.Invalid):
            FURNITURE_SCHEMA({**stairs, **bad})


def test_wall_socket_keeps_its_gangs() -> None:
    """A socket keeps up to four gangs, the same entity on two of them (#593); a fifth is refused."""
    base = {
        "id": "s1",
        "type": "wall_socket",
        "x": 1,
        "z": 0.05,
        "rotation": 0,
        "w": 0.156,
        "d": 0.014,
        "h": 0.085,
        "variant": "outdoor",
    }
    gangs = [{"entity": "switch.relais", "power": "sensor.relais_power"}, {"entity": "switch.relais"}]
    out = FURNITURE_SCHEMA({**base, "gangs": gangs})
    assert out["gangs"] == [
        {"entity": "switch.relais", "power": "sensor.relais_power"},
        {"entity": "switch.relais", "power": None},
    ]
    assert FURNITURE_SCHEMA({**base, "gangs": None})["gangs"] is None
    with pytest.raises(vol.Invalid):
        FURNITURE_SCHEMA({**base, "gangs": [{"entity": None}] * 5})


def test_room_hides_hundreds_of_segment_lights() -> None:
    # Govee2MQTT creates a light per LED strip segment: hiding them all must still save (#645)
    many = [f"light.strip_segment_{i:03d}" for i in range(600)]
    room = ROOM_SCHEMA({**ROOM, "hidden": many, "no_state": many})
    assert len(room["hidden"]) == 600
    area = OUTDOOR_SCHEMA({"id": "o1", "type": "lawn", "points": [[0, 0], [2, 0], [2, 2]], "hidden": many})
    assert len(area["hidden"]) == 600


def test_room_panel_layout_is_kept_and_checked() -> None:
    """Pinned rows, row order and group order of a room's panel, chosen by an editor (#229)."""
    assert "panel_layout" not in ROOM_SCHEMA(ROOM)
    layout = {
        "pinned": ["light.sample_lounge"],
        "order": ["switch.sample_fan", "light.sample_lounge"],
        "groups": ["covers", "lights"],
    }
    assert ROOM_SCHEMA({**ROOM, "panel_layout": layout})["panel_layout"] == layout
    assert ROOM_SCHEMA({**ROOM, "panel_layout": None})["panel_layout"] is None
    area = {"id": "o1", "type": "lawn", "points": [[0, 0], [2, 0], [2, 2]], "area_id": "garden"}
    assert OUTDOOR_SCHEMA({**area, "panel_layout": layout})["panel_layout"] == layout
    # a field a newer Home 3D adds is kept, like everywhere in the plan (the schema allows extra keys)
    assert ROOM_SCHEMA({**ROOM, "panel_layout": {"later": 1}})["panel_layout"] == {"later": 1}
    # ids of entities that are gone stay in the list: the panel ignores them
    stale = {"order": [f"light.sample_gone_{i}" for i in range(600)]}
    assert len(ROOM_SCHEMA({**ROOM, "panel_layout": stale})["panel_layout"]["order"]) == 600
    for bad in (
        {"pinned": "light.sample_lounge"},
        {"pinned": ["x"] * 101},
        {"groups": ["lights"] * 17},
    ):
        with pytest.raises(vol.Invalid):
            ROOM_SCHEMA({**ROOM, "panel_layout": bad})


def test_roof_section_keeps_its_end_shapes() -> None:
    """A hip at one end only (#466): each end may differ from the shape, None = as the shape."""
    sec = {"id": "s", "x0": 0, "z0": 0, "x1": 10, "z1": 8, "eave_a": 3, "eave_b": 3, "base": 3}
    plain = ROOF_SECTION_SCHEMA(sec)
    assert plain["end_u0"] is None and plain["end_u1"] is None
    one = ROOF_SECTION_SCHEMA({**sec, "end_u0": "hip", "end_u1": "gable"})
    assert (one["end_u0"], one["end_u1"]) == ("hip", "gable")
    with pytest.raises(vol.Invalid):
        ROOF_SECTION_SCHEMA({**sec, "end_u0": "pyramid"})


def test_roof_section_keeps_its_turn() -> None:
    """A section turned about a pivot (#634, #724); not turned = None, as every roof drawn so far."""
    sec = {"id": "s", "x0": 0, "z0": 0, "x1": 10, "z1": 8, "eave_a": 3, "eave_b": 3, "base": 3}
    plain = ROOF_SECTION_SCHEMA(sec)
    assert plain["rotation"] is None and plain["pivot"] is None
    turned = ROOF_SECTION_SCHEMA({**sec, "rotation": 30, "pivot": [5, 4]})
    assert (turned["rotation"], turned["pivot"]) == (30, [5, 4])
    with pytest.raises(vol.Invalid):
        ROOF_SECTION_SCHEMA({**sec, "rotation": 400})


def test_module_data_on_furniture_and_areas() -> None:
    """A module keeps its own data on an item of the plan, by its id; anything else is refused."""
    item = {"id": "f1", "type": "radiator", "x": 0, "z": 0, "rotation": 0, "w": 1, "d": 0.1, "h": 0.6, "variant": None}
    assert "mods" not in FURNITURE_SCHEMA(item)
    data = {"test.example": {"source": "ground", "links": {"supply": "sensor.flow"}}}
    assert FURNITURE_SCHEMA({**item, "mods": data})["mods"] == data
    with pytest.raises(vol.Invalid):
        FURNITURE_SCHEMA({**item, "mods": {"test.example": 3}})
    lawn = {"id": "a1", "type": "lawn", "points": [[0, 0], [4, 0], [4, 4]]}
    mods = {"test.example": {"collector": "loop"}}
    assert OUTDOOR_SCHEMA({**lawn, "mods": mods})["mods"] == mods


def test_door_keeps_its_opening_angle() -> None:
    """A door's own opening angle (None = as before: half open without a sensor, fully open with one)."""
    door = {"id": "o1", "room_id": "r1", "edge": 0, "offset": 1, "type": "door", "width": 0.9, "sill": 0, "height": 2.0}
    assert OPENING_SCHEMA(door)["open_angle"] is None
    assert OPENING_SCHEMA({**door, "open_angle": 15})["open_angle"] == 15
    with pytest.raises(vol.Invalid):
        OPENING_SCHEMA({**door, "open_angle": 200})


def test_garage_door_keeps_its_style() -> None:
    """A garage door is sectional (the default) or up-and-over (#24)."""
    garage = {"id": "o1", "room_id": "r1", "edge": 0, "offset": 1, "type": "garage", "width": 2.3}
    garage |= {"sill": 0, "height": 2.1}
    assert OPENING_SCHEMA({**garage, "style": "up_and_over"})["style"] == "up_and_over"
    assert OPENING_SCHEMA({**garage, "style": "sectional"})["style"] == "sectional"
    with pytest.raises(vol.Invalid):
        OPENING_SCHEMA({**garage, "style": "roller"})


def test_item_keeps_when_it_shows() -> None:
    """An item keeps its entity and intervals (#15); malformed days or times are refused."""
    tree = {"id": "t1", "type": "plant", "x": 2, "z": 2, "rotation": 0, "w": 1, "d": 1, "h": 2, "variant": None}
    rule = {
        "entity": "switch.tree",
        "intervals": [{"from": "12-01", "to": "01-06"}, {"start": "18:00", "end": "23:30"}],
    }
    out = FURNITURE_SCHEMA({**tree, "show_when": rule})["show_when"]
    assert out["entity"] == "switch.tree"
    assert out["intervals"][0]["from"] == "12-01"
    assert out["intervals"][1]["end"] == "23:30"
    assert FURNITURE_SCHEMA({**tree, "show_when": None})["show_when"] is None
    for bad in (
        {"from": "13-01", "to": "12-31"},
        {"from": "12-32", "to": "12-31"},
        {"start": "24:00", "end": "06:00"},
        {"start": "7:00"},
        # half-open: only one end of the days or of the times (#46)
        {"from": "12-01"},
        {"to": "12-31"},
        {"start": "18:00"},
        {"end": "06:00"},
        {"from": "12-01", "to": "12-31", "start": "18:00"},
    ):
        with pytest.raises(vol.Invalid):
            FURNITURE_SCHEMA({**tree, "show_when": {"intervals": [bad]}})
    with pytest.raises(vol.Invalid):
        FURNITURE_SCHEMA({**tree, "show_when": {"intervals": [{"from": "01-01", "to": "01-02"}] * 25}})


def test_pets_roam_unless_set_static() -> None:
    """Static pets (#17): a pet roams unless switched to static; a static one keeps its spot, turn and pose."""
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}
    roaming = SETTINGS_SCHEMA({**base, "pets": {"list": [{"id": "p1", "kind": "cat"}]}})["pets"]["list"][0]
    assert roaming["static"] is False
    assert roaming["pose"] is None
    assert roaming["x"] is None and roaming["z"] is None and roaming["rotation"] is None
    pet = {"id": "p2", "kind": "dog", "static": True, "pose": "curl", "x": 2.5, "z": -1, "rotation": 90}
    still = SETTINGS_SCHEMA({**base, "pets": {"list": [pet]}})["pets"]["list"][0]
    assert still["static"] is True
    assert still["pose"] == "curl"
    assert (still["x"], still["z"], still["rotation"]) == (2.5, -1.0, 90.0)
    for pose in ("sit", "lie", "curl"):
        SETTINGS_SCHEMA({**base, "pets": {"list": [{**pet, "pose": pose}]}})
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "pets": {"list": [{**pet, "pose": "fly"}]}})


def test_vacuum_maps() -> None:
    """Robot vacuum maps (#350): optional; a map keeps its camera, floor and up to three alignment pairs."""
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}
    assert SETTINGS_SCHEMA(base)["vacuum_maps"] is None
    vm = {
        "id": "vm",
        "camera": "camera.sample_vacuum_map",
        "floor_id": "f1",
        "points": [{"v": [25500, -300], "p": [1.5, 2]}],
    }
    out = SETTINGS_SCHEMA({**base, "vacuum_maps": [vm]})["vacuum_maps"][0]
    assert out["points"] == [{"v": [25500.0, -300.0], "p": [1.5, 2.0]}]
    assert out["vacuum"] is None and out["opacity"] is None and out["show"] is None
    pair = {"v": [0, 0], "p": [0, 0]}
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "vacuum_maps": [{**vm, "points": [pair] * 4}]})
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "vacuum_maps": [{**vm, "opacity": 0}]})
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "vacuum_maps": [{**vm, "camera": ""}]})


def test_pet_coats_and_eye_colours() -> None:
    """Pet coats and eye colours (#42): the new coats are kept, eyes are dark unless set to a known colour."""
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}

    def pet(**extra: object) -> dict:
        return SETTINGS_SCHEMA({**base, "pets": {"list": [{"id": "p1", "kind": "cat", **extra}]}})["pets"]["list"][0]

    assert pet()["eyes"] == "dark"
    for fur in ("dilute_calico", "blue_grey"):
        assert pet(fur=fur)["fur"] == fur
    for eyes in ("dark", "copper", "green", "yellow", "blue"):
        assert pet(eyes=eyes)["eyes"] == eyes
    with pytest.raises(vol.Invalid):
        pet(eyes="purple")


def test_item_actions() -> None:
    """Own tap, hold and double-tap actions of a placed device or a furniture item (#6)."""
    from custom_components.home_3d.schema import PLACEMENT_SCHEMA

    dev = {"entity_id": "switch.gate", "x": 0, "z": 0, "y": None}
    assert "actions" not in PLACEMENT_SCHEMA(dev)
    actions = {
        "tap": {
            "action": "perform_action",
            "target": "rest_command.gate",
            "data": {"seconds": 5},
            "confirm": True,
            "confirm_text": "Open the gate?",
        },
        "hold": {"action": "more_info"},
        "double_tap": None,
    }
    assert PLACEMENT_SCHEMA({**dev, "actions": actions})["actions"]["tap"]["data"] == {"seconds": 5}
    sofa = {"id": "f1", "type": "sofa", "x": 0, "z": 0, "rotation": 0, "w": 2, "d": 1, "h": 0.8, "variant": None}
    assert (
        FURNITURE_SCHEMA({**sofa, "actions": {"tap": {"action": "navigate", "target": "/lovelace/0"}}})["actions"][
            "tap"
        ]["target"]
        == "/lovelace/0"
    )
    with pytest.raises(vol.Invalid):
        PLACEMENT_SCHEMA({**dev, "actions": {"tap": {"action": "javascript"}}})
    with pytest.raises(vol.Invalid):
        FURNITURE_SCHEMA({**sofa, "actions": {"tap": {"action": "toggle", "confirm_text": "x" * 301}}})


def test_url_actions_are_web_addresses_only() -> None:
    """A url action opens http(s) or a path on this Home Assistant, never javascript: or another scheme (#51)."""
    dev = {"entity_id": "switch.gate", "x": 0, "z": 0, "y": None}
    for ok in ("https://example.com/a?b=1", "http://192.168.1.10:8123/", "/lovelace/0", "/local/x.pdf"):
        tap = PLACEMENT_SCHEMA({**dev, "actions": {"tap": {"action": "url", "target": ok}}})["actions"]["tap"]
        assert tap["target"] == ok
    backslashed = ("/\\evil.example", "/\\/evil.example", "/\\")  # #384
    for bad in (
        "javascript:alert(1)",
        " JavaScript:alert(1)",
        "data:text/html,x",
        "//evil.example",
        *backslashed,
        "ftp://x",
        "x",
    ):
        with pytest.raises(vol.Invalid):
            PLACEMENT_SCHEMA({**dev, "actions": {"tap": {"action": "url", "target": bad}}})


def test_plug_keeps_the_circuit_it_hangs_on() -> None:
    """A placed device and an item keep the circuit they are inside, so its watts aren't counted twice (#43)."""
    plug = {"entity_id": "switch.kettle", "x": 1, "z": 1, "y": None, "circuit": "sensor.kitchen_power"}
    assert PLACEMENT_SCHEMA(plug)["circuit"] == "sensor.kitchen_power"
    item = {"id": "p1", "type": "washer", "x": 2, "z": 2, "rotation": 0, "w": 0.6, "d": 0.6, "h": 0.85, "variant": None}
    assert FURNITURE_SCHEMA({**item, "circuit": "sensor.kitchen_power"})["circuit"] == "sensor.kitchen_power"
    assert "circuit" not in FURNITURE_SCHEMA(item)
    with pytest.raises(vol.Invalid):
        PLACEMENT_SCHEMA({**plug, "circuit": 5})
    with pytest.raises(vol.Invalid):
        FURNITURE_SCHEMA({**item, "circuit": "x" * 256})


def test_cheap_rate_and_wire_end_energy_sensor() -> None:
    """The cheap rate is an entity or a daily window; an item keeps the energy sensor of its wire end (#29)."""
    energy = ENERGY_SCHEMA({"cheap_rate": "binary_sensor.off_peak", "cheap_from": "23:30", "cheap_to": "05:30"})
    assert energy["cheap_rate"] == "binary_sensor.off_peak"
    assert (energy["cheap_from"], energy["cheap_to"]) == ("23:30", "05:30")
    assert ENERGY_SCHEMA({})["cheap_rate"] is None
    with pytest.raises(vol.Invalid):
        ENERGY_SCHEMA({"cheap_from": "25:00"})
    plug = {"entity_id": "switch.kettle", "x": 1, "z": 1, "y": None, "energy": "sensor.kettle_energy"}
    assert PLACEMENT_SCHEMA(plug)["energy"] == "sensor.kettle_energy"
    item = {"id": "p1", "type": "washer", "x": 2, "z": 2, "rotation": 0, "w": 0.6, "d": 0.6, "h": 0.85, "variant": None}
    assert FURNITURE_SCHEMA({**item, "energy": "sensor.washer_energy"})["energy"] == "sensor.washer_energy"
    with pytest.raises(vol.Invalid):
        PLACEMENT_SCHEMA({**plug, "energy": 5})


def test_live_room_effects_are_kept_and_checked() -> None:
    """Leak and motion sensors per room, a radiator's temperature and the effect settings (#10)."""
    assert ROOM_SCHEMA(ROOM)["live"] is None
    room = ROOM_SCHEMA({**ROOM, "live": {"leak": "binary_sensor.sink_leak", "motion": "none"}})
    assert room["live"] == {"leak": "binary_sensor.sink_leak", "motion": "none"}
    item = {"id": "f1", "type": "radiator", "x": 0, "z": 0, "rotation": 0, "w": 1, "d": 0.1, "h": 0.6, "variant": None}
    assert FURNITURE_SCHEMA(item)["temp_sensor"] is None
    trv = "sensor.trv_temperature"
    assert FURNITURE_SCHEMA({**item, "temp_sensor": trv})["temp_sensor"] == trv
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}
    assert SETTINGS_SCHEMA(base)["effects"] is None
    chosen = {"motion_seconds": 45, "radiator_cold": 20, "tank_hot": 60}
    effects = SETTINGS_SCHEMA({**base, "effects": chosen})["effects"]
    assert effects["motion_seconds"] == 45
    assert effects["tank_hot"] == 60.0
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "effects": {"motion_seconds": -5}})
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "effects": {"radiator_hot": 500}})


def test_unplaced_hidden_entities_are_kept_and_checked() -> None:
    """Entities hidden from the editor's unplaced list (#83)."""
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}
    assert SETTINGS_SCHEMA(base)["unplaced_hidden"] == []
    hidden = ["switch.sample_plug", "sensor.sample_power"]
    assert SETTINGS_SCHEMA({**base, "unplaced_hidden": hidden})["unplaced_hidden"] == hidden
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "unplaced_hidden": "switch.sample_plug"})
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "unplaced_hidden": ["x" * 300]})


def test_tablet_users_and_idle_return_are_kept_and_checked() -> None:
    """Users whose panel opens in locked tablet mode, and its idle return (#92)."""
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}
    out = SETTINGS_SCHEMA(base)
    assert out["tablet_users"] == []
    assert out["tablet_idle"] is None
    out = SETTINGS_SCHEMA({**base, "tablet_users": ["abc123"], "tablet_idle": "90"})
    assert out["tablet_users"] == ["abc123"]
    assert out["tablet_idle"] == 90
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "tablet_users": "abc123"})
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "tablet_idle": -1})
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "tablet_idle": 100000})


def test_dismissed_warnings_are_kept_and_checked() -> None:
    """Warnings dismissed for now or for good from the 3D view's banner (#138)."""
    base = {"wall_exterior": 0.3, "wall_interior": 0.12, "grid": 0.05}
    out = SETTINGS_SCHEMA(base)
    assert out["alert_snoozed"] == []
    assert out["alert_ignored"] == []
    snoozed = [{"kind": "smoke", "entity": "binary_sensor.sample_smoke", "at": 1761800000000}]
    ignored = [
        {"kind": "contact_unavailable", "entity": "binary_sensor.sample_window"},
        {"kind": "pool_ph", "entity": "sensor.sample_ph"},
    ]
    out = SETTINGS_SCHEMA({**base, "alert_snoozed": snoozed, "alert_ignored": ignored})
    assert out["alert_snoozed"] == snoozed
    assert out["alert_ignored"] == ignored
    # a safety warning is never ignored for good: such an entry is dropped, the others stay
    smoke = {"kind": "smoke", "entity": "binary_sensor.sample_smoke"}
    out = SETTINGS_SCHEMA(
        {**base, "alert_ignored": [smoke, *ignored, {"kind": "alarm", "entity": "alarm_control_panel.sample"}]}
    )
    assert out["alert_ignored"] == ignored
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "alert_snoozed": [{"kind": "smoke", "entity": "binary_sensor.sample_smoke"}]})
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "alert_ignored": [{"kind": "", "entity": "binary_sensor.sample_window"}]})
    with pytest.raises(vol.Invalid):
        SETTINGS_SCHEMA({**base, "alert_ignored": [{"kind": "window_rain", "entity": "x" * 300}]})


def test_the_opening_links_mark_is_an_optional_flag_apart_from_the_version() -> None:
    # #203: the frontend's one-off marks the plan; a plan without the mark keeps none (so the one-off still runs)
    plan = empty_building()
    assert "opening_links_saved" not in BUILDING_SCHEMA(plan)
    marked = BUILDING_SCHEMA({**plan, "opening_links_saved": True})
    assert marked["opening_links_saved"] is True
    assert marked["version"] == plan["version"]
    # a version-1 plan keeps its mark through the migration (#165)
    assert BUILDING_SCHEMA({**plan, "version": 1, "opening_links_saved": True})["opening_links_saved"] is True
    with pytest.raises(vol.Invalid):
        BUILDING_SCHEMA({**plan, "opening_links_saved": "yes"})


def test_energy_systems_default_and_old_plan_untouched() -> None:
    """A plan with one inverter keeps its sensors and gains an empty list of further setups (#285)."""
    old = ENERGY_SCHEMA(
        {"solar": "sensor.pv", "battery": "sensor.bat", "battery_soc": "sensor.soc", "grid": "sensor.grid"}
    )
    assert old["systems"] == []
    assert (old["solar"], old["battery"], old["battery_soc"], old["grid"]) == (
        "sensor.pv",
        "sensor.bat",
        "sensor.soc",
        "sensor.grid",
    )
    more = ENERGY_SCHEMA({"systems": [{"id": "sys2", "name": "Garage", "solar": "sensor.pv2", "inverter": "inv1"}]})
    assert more["systems"][0]["battery"] is None
    assert more["systems"][0]["inverter"] == "inv1"
    with pytest.raises(vol.Invalid):
        ENERGY_SCHEMA({"systems": [{"name": "no id"}]})


def test_rates_from_existing_sensors_default_and_old_plan_untouched() -> None:
    """A plan from before #323 keeps its cheap rate and tariff and sets its rates up itself ("here"); a plan using
    existing sensors keeps its tariff entity, cheap states, fixed price and cost and earning sources."""
    old_energy = {
        "tariff": "sensor.sample_price",
        "cheap_rate": "binary_sensor.sample_off_peak",
        "cheap_from": "23:00",
        "cheap_to": "06:00",
    }
    plan = {**empty_building(), "energy": old_energy}
    loaded = BUILDING_SCHEMA(plan)
    assert loaded["version"] == plan["version"]
    energy = loaded["energy"]
    assert {key: energy[key] for key in old_energy} == old_energy
    assert energy["rates_from"] == "here"
    assert (energy["rate_entity"], energy["cheap_states"], energy["price_fixed"]) == (None, [], None)
    assert (energy["cost_sensors"], energy["earning_sensors"]) == ([], [])
    # loading again changes nothing (a stored plan reads the same after a save)
    assert BUILDING_SCHEMA(loaded)["energy"] == energy

    sensors = ENERGY_SCHEMA(
        {
            "rates_from": "sensors",
            "rate_entity": "select.sample_tariff",
            "cheap_states": ["offpeak"],
            "price_fixed": "0.245",
            "cost_sensors": ["sensor.sample_import_cost", "external:sample_cost"],
            "earning_sensors": ["sensor.sample_export_compensation"],
        }
    )
    assert sensors["rates_from"] == "sensors"
    assert sensors["cheap_states"] == ["offpeak"]
    assert sensors["price_fixed"] == 0.245
    assert sensors["cost_sensors"] == ["sensor.sample_import_cost", "external:sample_cost"]
    for bad in (
        {"rates_from": "elsewhere"},
        {"cost_sensors": "sensor.sample_import_cost"},
        {"cost_sensors": [""]},
        {"cheap_states": ["x"] * 21},
        {"price_fixed": "cheap"},
    ):
        with pytest.raises(vol.Invalid):
            ENERGY_SCHEMA(bad)


def test_price_from_one_sensor_or_peak_and_cheap() -> None:
    """With existing sensors the price is one sensor or a peak and a cheap price, each an entity or a number (#323)."""
    assert (ENERGY_SCHEMA({})["price_mode"], ENERGY_SCHEMA({})["price_peak"]) == ("one", None)
    split = ENERGY_SCHEMA({"price_mode": "split", "price_peak": "input_number.sample_peak", "price_cheap": 0.07})
    assert (split["price_mode"], split["price_peak"], split["price_cheap"]) == (
        "split",
        "input_number.sample_peak",
        0.07,
    )
    for bad in ({"price_mode": "three"}, {"price_peak": ""}, {"price_cheap": 5000}, {"price_peak": ["x"]}):
        with pytest.raises(vol.Invalid):
            ENERGY_SCHEMA(bad)


def test_a_stored_link_to_a_backslash_path_loads_with_the_target_left_out() -> None:
    """A plan stored with a backslash path as a url target (it passed before #384) still loads: the bad target is
    dropped by the repair of check_plan and the plan is marked as repaired; the rest of the item stays."""
    plan = copy.deepcopy(BUILDING)
    tap = {"action": "url", "target": "/\\evil.example"}
    placement = {"entity_id": "switch.gate", "x": 0, "z": 0, "y": None, "actions": {"tap": tap}}
    plan["floors"][0]["placements"] = [placement]
    fixed, problem = check_plan(plan)
    assert problem is not None and problem["code"] == "plan_repaired"
    assert problem["dropped"] == ["floors.0.placements.0.actions.tap.target"]
    kept = fixed["floors"][0]["placements"][0]
    assert kept["entity_id"] == "switch.gate"
    assert kept["actions"]["tap"].get("target") is None
