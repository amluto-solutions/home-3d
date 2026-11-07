"""The shared contract with the frontend (#166): one plan with every field, and the list of websocket commands.

tests/fixtures/contract/plan.json is written by the frontend (contract.test.ts, from plan-contract.fixture.ts, which
must hold every field model.ts has); here it must pass the schema with no field schema.py does not know and hold every
field schema.py knows. tests/fixtures/contract/websocket.json is written here from the registered commands; the
frontend checks every message it sends against it. UPDATE_CONTRACT=1 rewrites websocket.json instead of comparing:
any change to the commands needs const.PROTOCOL (and api.ts PROTOCOL) one up first.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import types
from typing import Any

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant
import voluptuous as vol

from custom_components.home_3d.const import PLAN_VERSION, PROTOCOL
from custom_components.home_3d.schema import BUILDING_FIELDS, BUILDING_SCHEMA
from tests.test_init import _setup

CONTRACT = Path(__file__).parent / "fixtures" / "contract"
PLAN = CONTRACT / "plan.json"
WEBSOCKET = CONTRACT / "websocket.json"

# fields of the TypeScript model that are never stored, so the schema rightly has none (the fixture has them, as
# Complete<Building> asks for every field)
FRONTEND_ONLY = {
    # an outdoor area acting as a room: made by outdoorZones while drawing, never stored among the rooms
    "floors[].rooms[].outdoor": "made at runtime, never stored",
}


# ---------------------------------------------------------------------------- the fields schema.py knows


def _schema_paths(schema: Any) -> tuple[set[str], set[str]]:
    """Every field path the schema knows ("floors[].furniture[].x"; ".*" for any key of a mapping) and the paths
    below which anything goes (a plain `dict`, or a function such as the recipe check, with no fields given)."""
    known: set[str] = set()
    free: set[str] = set()
    structured: set[str] = set()

    def walk(value: Any, path: str) -> None:
        if isinstance(value, vol.Schema):
            walk(value.schema, path)
        elif isinstance(value, (vol.All, vol.Any)):
            for validator in value.validators:
                walk(validator, path)
        elif isinstance(value, dict):
            structured.add(path)
            for key, inner in value.items():
                name = key.schema if isinstance(key, vol.Marker) else key
                field = f"{path}.{name}" if isinstance(name, str) else f"{path}.*"
                field = field.lstrip(".")
                known.add(field)
                walk(inner, field)
        elif isinstance(value, list):
            structured.add(path)
            for inner in value:
                walk(inner, f"{path}[]")
        elif value is dict or isinstance(value, types.FunctionType):
            free.add(path)

    walk(schema, "")
    return known, free - structured


KNOWN, FREE = _schema_paths(BUILDING_FIELDS)


def _plan_paths(plan: Any) -> tuple[set[str], set[str]]:
    """The field paths a plan has, in the schema's terms, and those the schema does not know."""
    found: set[str] = set()
    unknown: set[str] = set()

    def walk(value: Any, path: str) -> None:
        if path in FREE:
            return
        if isinstance(value, dict):
            for key, inner in value.items():
                field = f"{path}.{key}".lstrip(".")
                if field not in KNOWN and f"{path}.*".lstrip(".") in KNOWN:
                    field = f"{path}.*".lstrip(".")
                if field in KNOWN:
                    found.add(field)
                    walk(inner, field)
                else:
                    unknown.add(field)
        elif isinstance(value, list):
            for inner in value:
                walk(inner, f"{path}[]")

    walk(plan, "")
    return found, unknown


def _plan() -> dict[str, Any]:
    return json.loads(PLAN.read_text(encoding="utf-8"))


def test_the_schema_walk_sees_the_plan() -> None:
    assert {"version", "floors", "floors[].furniture[].x", "settings.roof.solar[].id", "energy.grid"} <= KNOWN
    assert "recipes" in FREE
    assert len(KNOWN) > 500


def test_the_contract_plan_passes_the_schema() -> None:
    plan = _plan()
    assert plan["version"] == PLAN_VERSION
    BUILDING_SCHEMA(plan)


def test_every_field_of_the_frontend_model_is_known_to_the_schema() -> None:
    """A field added to model.ts (and so to the contract fixture) but not to schema.py: it would pass unchecked."""
    _found, unknown = _plan_paths(_plan())
    assert sorted(unknown - set(FRONTEND_ONLY)) == []
    assert set(FRONTEND_ONLY) <= unknown, "a frontend-only field is in the schema now: drop it from FRONTEND_ONLY"


def test_every_field_the_schema_knows_is_in_the_frontend_model() -> None:
    """A field schema.py knows but the contract plan lacks: model.ts has no such field (the fixture holds every one
    of its fields), or it was renamed on one side only."""
    found, _unknown = _plan_paths(_plan())
    assert sorted(KNOWN - found) == []


# ---------------------------------------------------------------------------- the websocket commands


def _commands(hass: HomeAssistant) -> dict[str, dict[str, list[str]]]:
    commands: dict[str, dict[str, list[str]]] = {}
    for name, (_handler, schema) in hass.data[websocket_api.DOMAIN].items():
        if not name.startswith("home_3d/"):
            continue
        fields = schema.schema if isinstance(schema, vol.Schema) else {}
        required = sorted(k.schema for k in fields if isinstance(k, vol.Required) and k.schema not in ("id", "type"))
        optional = sorted(k.schema for k in fields if isinstance(k, vol.Optional) and not isinstance(k, vol.Required))
        commands[name] = {"required": required, "optional": [k for k in optional if k not in ("id", "type")]}
    return dict(sorted(commands.items()))


async def test_websocket_json_lists_the_registered_commands(hass: HomeAssistant) -> None:
    await _setup(hass)
    current = {"protocol": PROTOCOL, "plan_version": PLAN_VERSION, "commands": _commands(hass)}
    assert len(current["commands"]) > 40
    stored = json.loads(WEBSOCKET.read_text(encoding="utf-8")) if WEBSOCKET.exists() else None
    if stored is not None and stored["commands"] != current["commands"]:
        assert stored["protocol"] < PROTOCOL, (
            "the websocket commands changed: raise const.PROTOCOL and api.ts PROTOCOL by one, then "
            "UPDATE_CONTRACT=1 pytest tests/test_contract.py"
        )
    if os.environ.get("UPDATE_CONTRACT"):
        WEBSOCKET.write_text(json.dumps(current, indent=2) + "\n", encoding="utf-8")
        return
    assert stored == current, "websocket.json is out of date: UPDATE_CONTRACT=1 pytest tests/test_contract.py"


async def test_the_backend_says_its_protocol(hass: HomeAssistant, hass_ws_client) -> None:
    await _setup(hass)
    client = await hass_ws_client(hass)
    for command in ("home_3d/building/get", "home_3d/version"):
        await client.send_json_auto_id({"type": command})
        result = await client.receive_json()
        assert result["success"], result
        assert result["result"]["protocol"] == PROTOCOL
