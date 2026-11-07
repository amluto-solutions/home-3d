"""The choices a stored plan can hold, per plan version (#379). A plan an older Home 3D loads is checked by its
schema, and a value it does not know there (a new choice of a field, a new key where no other keys are let in) is left
out as invalid. So a release that lets the stored plan hold such a value must also bump PLAN_VERSION (with a step in
migrations.py, a step that changes nothing when nothing needs to): an older Home 3D then shows that plan read-only
("plan_too_new") instead of repairing it. tests/fixtures/plan-choices.json keeps the choices of each version; an
entry is never changed once released, a new version gets a new entry."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import voluptuous as vol

from custom_components.home_3d.const import PLAN_VERSION
from custom_components.home_3d.schema import BUILDING_FIELDS

CHOICES = Path(__file__).parent / "fixtures" / "plan-choices.json"


def _key(value: Any) -> str:
    return json.dumps(value)


def plan_choices() -> dict[str, list[Any]]:
    """Every closed set of values in the plan's schema, by where it is: the choices of a field (vol.In, the fixed
    values of a vol.Any) and the keys of an object that lets in no others."""
    found: dict[str, dict[str, Any]] = {}

    def add(path: str, values: Any) -> None:
        for value in values:
            found.setdefault(path, {})[_key(value)] = value

    def walk(node: Any, path: str, extra: Any = vol.PREVENT_EXTRA) -> None:
        # a plain dict in a schema lets in other keys as the schema around it does
        if isinstance(node, vol.Schema):
            walk(node.schema, path, node.extra)
        elif isinstance(node, dict):
            names: list[str] = []
            for marker, value in node.items():
                key = marker.schema if isinstance(marker, vol.Marker) else marker
                if isinstance(key, vol.In):
                    add(f"{path}{{keys}}", key.container)
                    name = "*"
                elif isinstance(key, str):
                    names.append(key)
                    name = key
                else:
                    name = "*"
                walk(value, f"{path}.{name}", extra)
            if (
                extra == vol.PREVENT_EXTRA
                and names
                and not any(not isinstance(m.schema if isinstance(m, vol.Marker) else m, str) for m in node)
            ):
                add(f"{path}{{keys}}", names)
        elif isinstance(node, list):
            for value in node:
                walk(value, f"{path}[]", extra)
        elif isinstance(node, vol.In):
            add(path, node.container)
        elif isinstance(node, (vol.All, vol.Any)):
            for value in node.validators:
                if isinstance(value, (str, int, float)) and not isinstance(value, bool):
                    add(path, [value])
                else:
                    walk(value, path, extra)

    walk(BUILDING_FIELDS, "plan")
    return {path: sorted(values.values(), key=_key) for path, values in sorted(found.items())}


def test_the_plan_choices_are_those_of_this_plan_version() -> None:
    kept: dict[str, dict[str, list[Any]]] = json.loads(CHOICES.read_text(encoding="utf-8"))
    assert max(int(v) for v in kept) == PLAN_VERSION, "plan-choices.json needs an entry for this PLAN_VERSION"
    now = plan_choices()
    before = kept[str(PLAN_VERSION)]
    added = {p: [v for v in values if v not in before.get(p, [])] for p, values in now.items()}
    added = {p: v for p, v in added.items() if v}
    assert not added, (
        f"The stored plan can hold values plan version {PLAN_VERSION} did not have: {added}. An older Home 3D would "
        "leave them out as invalid: bump PLAN_VERSION (const.py) with a step in migrations.py, and add an entry for "
        "the new version to tests/fixtures/plan-choices.json (never change a released one)"
    )
    assert now == before, (
        "Choices of the stored plan were taken away; a plan that holds one still loads (a step in migrations.py "
        "changes it), then add an entry for the new version to tests/fixtures/plan-choices.json"
    )
