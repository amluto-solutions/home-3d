"""Show rules (#535, #538): a placed device or furniture item keeps its own icon and card rules in the plan. Each rule
is all or any of its conditions; a condition asks an entity's state (this item or one fixed entity) or the clock."""

from __future__ import annotations

import copy
from typing import Any

import pytest
import voluptuous as vol

from custom_components.home_3d.const import PLAN_VERSION
from custom_components.home_3d.migrations import PlanTooNew, migrate_plan
from custom_components.home_3d.schema import BUILDING_SCHEMA, FURNITURE_SCHEMA, PLACEMENT_SCHEMA
from tests.test_init import BUILDING

LAMP = {"id": "l1", "type": "lamp_floor", "x": 1, "z": 1, "rotation": 0, "w": 0.4, "d": 0.4, "h": 1.7, "variant": None}
PLUG = {"entity_id": "switch.kettle", "x": 1, "z": 1, "y": None}

RULES: dict[str, Any] = {
    "icon": {
        "match": "all",
        "conditions": [
            {"type": "state", "entity": "self", "when": "on"},
            {"type": "time", "start": "22:00", "end": "06:00", "days": [4, 5]},
        ],
    },
    "card": {
        "match": "any",
        "conditions": [
            {"type": "state", "entity": "sensor.pv_power", "when": "above", "value": 50, "unavailable": "hide"},
            {"type": "state", "entity": "media_player.tv", "when": "state", "state": "playing, paused"},
            {"type": "state", "entity": "self", "when": "below", "value": -2.5},
        ],
    },
}


def test_items_keep_their_rules_as_written() -> None:
    """Both item kinds keep icon and card rules; "self" stays "self" (never an entity id), numbers stay numbers."""
    for schema, item in ((FURNITURE_SCHEMA, LAMP), (PLACEMENT_SCHEMA, PLUG)):
        out = schema({**item, "show_rules": copy.deepcopy(RULES)})["show_rules"]
        assert out["icon"]["conditions"][0] == {"type": "state", "entity": "self", "when": "on"}
        assert out["icon"]["conditions"][1] == {"type": "time", "start": "22:00", "end": "06:00", "days": [4, 5]}
        assert out["card"]["match"] == "any"
        assert out["card"]["conditions"][0]["value"] == 50
        assert out["card"]["conditions"][2]["value"] == -2.5
        assert schema({**item, "show_rules": None})["show_rules"] is None
        assert "show_rules" not in schema(dict(item)), "an item without rules gets none added"
        # one of the two alone, or an empty rule
        assert schema({**item, "show_rules": {"icon": None}})["show_rules"] == {"icon": None}
        assert (
            schema({**item, "show_rules": {"card": {"match": "any", "conditions": []}}})["show_rules"]["card"][
                "conditions"
            ]
            == []
        )


def test_a_time_condition_may_leave_out_the_times_or_the_days() -> None:
    for good in ({"type": "time", "days": [0]}, {"type": "time", "start": "07:00", "end": "07:00"}, {"type": "time"}):
        rule = {"icon": {"match": "all", "conditions": [good]}}
        assert FURNITURE_SCHEMA({**LAMP, "show_rules": rule})["show_rules"]["icon"]["conditions"][0]["type"] == "time"


@pytest.mark.parametrize(
    "bad",
    [
        {"type": "state", "entity": "self", "when": "glows"},
        {"type": "state", "entity": "self"},
        {"type": "state", "when": "on"},
        {"type": "state", "entity": "Not an entity", "when": "on"},
        {"type": "state", "entity": "", "when": "on"},
        # a number condition needs its number, and only a number
        {"type": "state", "entity": "self", "when": "above"},
        {"type": "state", "entity": "self", "when": "below", "value": None},
        {"type": "state", "entity": "self", "when": "above", "value": "fifty"},
        {"type": "state", "entity": "self", "when": "above", "value": float("nan")},
        {"type": "state", "entity": "self", "when": "on", "unavailable": "maybe"},
        {"type": "state", "entity": "self", "when": "on", "extra": 1},
        # times: both ends or neither, real times, weekdays 0-6
        {"type": "time", "start": "07:00"},
        {"type": "time", "end": "07:00"},
        {"type": "time", "start": "24:00", "end": "06:00"},
        {"type": "time", "start": "7:00", "end": "08:00"},
        {"type": "time", "days": [7]},
        {"type": "time", "days": [-1]},
        {"type": "time", "days": [0, 1, 2, 3, 4, 5, 6, 0]},
        {"type": "sun", "after": "sunset"},
        {"entity": "self", "when": "on"},
    ],
)
def test_a_broken_condition_is_refused(bad: dict[str, Any]) -> None:
    with pytest.raises(vol.Invalid):
        FURNITURE_SCHEMA({**LAMP, "show_rules": {"icon": {"match": "all", "conditions": [bad]}}})


def test_a_broken_rule_is_refused() -> None:
    cond = {"type": "state", "entity": "self", "when": "on"}
    for bad in (
        {"icon": {"match": "most", "conditions": [cond]}},
        {"icon": {"match": "all", "conditions": [cond] * 13}},
        {"icon": {"match": "all", "conditions": cond}},
        {"badge": {"match": "all", "conditions": [cond]}},
        {"icon": "on"},
    ):
        with pytest.raises(vol.Invalid):
            PLACEMENT_SCHEMA({**PLUG, "show_rules": bad})
    # match left out: all
    assert (
        PLACEMENT_SCHEMA({**PLUG, "show_rules": {"icon": {"conditions": [cond]}}})["show_rules"]["icon"]["match"]
        == "all"
    )


def test_a_version_seven_plan_loads_unchanged_as_version_eight_and_1_8_x_opens_a_new_one_read_only(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Plan version 8 (Home 3D 1.9.0): the 7 -> 8 step changes nothing. A plan can then hold show rules (#535) on its
    items; a Home 3D that reads versions up to 7 (1.8.x) refuses such a plan instead of leaving the rules out."""
    assert PLAN_VERSION == 8
    older = {**copy.deepcopy(BUILDING), "version": 7}
    kept = copy.deepcopy(older)
    migrated = migrate_plan(older)
    assert older == kept, "the stored plan is left as it was"
    assert migrated == {**kept, "version": 8}, "no key dropped, none added"
    assert migrate_plan(migrated) is migrated, "idempotent"

    newer = {**copy.deepcopy(BUILDING), "version": 8}
    monkeypatch.setattr("custom_components.home_3d.migrations.PLAN_VERSION", 7)
    with pytest.raises(PlanTooNew, match=r"made by a newer Home 3D"):
        migrate_plan(newer)


def test_a_plan_keeps_the_rules_of_its_items() -> None:
    plan = {**copy.deepcopy(BUILDING), "version": PLAN_VERSION}
    floor = plan["floors"][0]
    floor["furniture"] = [*floor.get("furniture", []), {**LAMP, "show_rules": copy.deepcopy(RULES)}]
    floor["placements"] = [*floor.get("placements", []), {**PLUG, "show_rules": copy.deepcopy(RULES)}]
    out = BUILDING_SCHEMA(plan)["floors"][0]
    assert out["furniture"][-1]["show_rules"] == RULES
    assert out["placements"][-1]["show_rules"] == RULES


def test_the_main_solar_card_and_the_household_card_keep_their_rules_in_the_settings() -> None:
    """#537: the cards that belong to no item have their card rule in their own settings."""
    plan = {**copy.deepcopy(BUILDING), "version": PLAN_VERSION}
    settings = plan.setdefault("settings", {})
    settings.setdefault("roof", {})["hologram"] = {"field": None, "card_rule": copy.deepcopy(RULES["card"])}
    settings["household"] = {"card_rule": copy.deepcopy(RULES["icon"])}
    out = BUILDING_SCHEMA(plan)["settings"]
    assert out["roof"]["hologram"]["card_rule"] == RULES["card"]
    assert out["household"]["card_rule"] == RULES["icon"]
    bad = copy.deepcopy(plan)
    half = {"match": "all", "conditions": [{"type": "time", "start": "09:00"}]}
    bad["settings"]["roof"]["hologram"]["card_rule"] = half
    with pytest.raises(vol.Invalid):
        BUILDING_SCHEMA(bad)
