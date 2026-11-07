"""Plan migrations (#165): a plan's `version` counts its format, and each step here turns a plan of one version into
the next.

Every plan the backend takes in goes through `migrate_plan` before it is checked (BUILDING_SCHEMA runs it first): a
stored plan when a home loads, a save from an older client, an imported file, a backup, a restore point. So the plan
the editor, voice, time travel and the sensors see is always of the current version, and a later format change has
one place to go: a new step at the end of MIGRATIONS and PLAN_VERSION one up. PLAN_VERSION also goes one up (with a
step that changes nothing) whenever the stored plan can hold a value an older Home 3D would not read, a new choice of a
field too (#379, docs/plan-format.md): that one then shows the plan read-only instead of repairing it.

Rules for a step:
- it gets the plan as stored (not yet checked: fields may be missing or of the wrong kind) and returns a new plan,
  leaving its input as it was; a part it cannot read stays as it is, for the check to report
- it is idempotent: run on its own output it changes nothing
- it never drops data the newer format can hold; Home.async_load keeps the plan as stored as a restore point before
  it writes a migrated one back

The frontend keeps reading older plans (normalizeBuilding in model.ts) for exports and older backends; new
migrations go here only.
"""

from __future__ import annotations

from collections.abc import Callable
import re
from typing import Any

import voluptuous as vol

from .const import PLAN_VERSION


class PlanTooNew(vol.Invalid):
    """A plan of a version newer than this Home 3D reads: never changed or written over by it."""


# ---------------------------------------------------------------------------- 1 -> 2: lights become lamps

# a light placed as a device pin (before lamps existed) becomes a lamp of its mount type, of the size the frontend's
# FURNITURE_SIZE gives it (model.ts); a light kept as a pin on purpose (`pin`) stays a pin
_LAMPS: dict[str, tuple[str, float, float, float]] = {
    "ceiling": ("lamp_ceiling", 0.4, 0.4, 0.08),
    "floor": ("lamp_floor", 0.4, 0.4, 1.7),
    "table": ("lamp_table", 0.28, 0.28, 0.45),
    "wall": ("lamp_wall", 0.22, 0.12, 0.2),
}
# what a device pin and a lamp both have, kept on the way (the frontend's own rule kept only the position)
_LAMP_FIELDS = (
    "rotation",
    "name",
    "aliases",
    "show_name",
    "glow_scale",
    "confirm",
    "actions",
    "marker",
    "icon",
    "holo",
    "circuit",
    "energy",
    "locked",
)
_NOT_IN_ID = re.compile(r"[^A-Za-z0-9_\-.]")


def _is_light(placement: Any) -> bool:
    if not isinstance(placement, dict) or placement.get("pin"):
        return False
    entity = placement.get("entity_id")
    return isinstance(entity, str) and entity.startswith("light.") and (placement.get("mount") or "ceiling") in _LAMPS


def _lamp_id(entity: str, taken: set[Any]) -> str:
    """The frontend's id for the lamp (`lamp_<object id>`), with a number when the floor has that id already."""
    base = f"lamp_{_NOT_IN_ID.sub('_', entity[len('light.') :])}"[:64]
    lamp_id, number = base, 1
    while lamp_id in taken:
        number += 1
        suffix = f"_{number}"
        lamp_id = f"{base[: 64 - len(suffix)]}{suffix}"
    taken.add(lamp_id)
    return lamp_id


def _lamp(placement: dict[str, Any], taken: set[Any]) -> dict[str, Any]:
    type_, w, d, h = _LAMPS[placement.get("mount") or "ceiling"]
    lamp: dict[str, Any] = {
        "id": _lamp_id(placement["entity_id"], taken),
        "type": type_,
        "x": placement.get("x"),
        "z": placement.get("z"),
        "rotation": 0,
        "w": w,
        "d": d,
        "h": h,
        "variant": None,
        "entity": placement["entity_id"],
        "power": None,
    }
    for key in _LAMP_FIELDS:
        if key in placement and placement[key] is not None:
            lamp[key] = placement[key]
    height = placement.get("y")
    if isinstance(height, (int, float)) and not isinstance(height, bool):
        # the placement's mount height (#381); the lamp's own range is 0-10 m, no `y` keeps the type's default
        lamp["mount_y"] = min(max(float(height), 0.0), 10.0)
    return lamp


def lights_to_lamps(plan: dict[str, Any]) -> dict[str, Any]:
    """Version 1 -> 2: lights placed as device pins become lamps (the rule model.ts normalizeBuilding applied in
    every browser, now made once on the server)."""
    floors = plan.get("floors")
    if not isinstance(floors, list):
        return plan
    changed = False
    migrated: list[Any] = []
    for floor in floors:
        placements = floor.get("placements") if isinstance(floor, dict) else None
        furniture = floor.get("furniture", []) if isinstance(floor, dict) else None
        if not isinstance(placements, list) or not isinstance(furniture, list) or not any(map(_is_light, placements)):
            migrated.append(floor)
            continue
        taken = {item.get("id") for item in furniture if isinstance(item, dict)}
        lamps = [_lamp(p, taken) for p in placements if _is_light(p)]
        migrated.append(
            {**floor, "placements": [p for p in placements if not _is_light(p)], "furniture": [*furniture, *lamps]}
        )
        changed = True
    return {**plan, "floors": migrated} if changed else plan


# ---------------------------------------------------------------------------- 2 -> 3: a pet's spot becomes its routine

# roaming pets (#337): a pet's places are a list (`spots`, its daily routine); a static pet (#17) gets its spot as the
# first (with roaming off, or static, a pet stays on its first spot). A roaming pet that kept a spot from before keeps
# roaming freely: its spot stays in the old fields only. The old fields stay as they were (a Home 3D from before reads
# them).
_PET_PLACE = ("floor_id", "x", "z", "pose", "rotation")


def _has_spot(pet: Any) -> bool:
    if not isinstance(pet, dict) or pet.get("spots") is not None or pet.get("static") is not True:
        return False
    return all(isinstance(pet.get(k), (int, float)) and not isinstance(pet.get(k), bool) for k in ("x", "z"))


def pet_spots(plan: dict[str, Any]) -> dict[str, Any]:
    """Version 2 -> 3: a pet's own spot (x, z, pose, facing) becomes the first spot of its routine."""
    settings = plan.get("settings")
    pets = settings.get("pets") if isinstance(settings, dict) else None
    pet_list = pets.get("list") if isinstance(pets, dict) else None
    if not isinstance(settings, dict) or not isinstance(pets, dict) or not isinstance(pet_list, list):
        return plan
    if not any(map(_has_spot, pet_list)):
        return plan
    moved = [
        {**pet, "spots": [{"id": "spot_1", **{k: pet.get(k) for k in _PET_PLACE}}]} if _has_spot(pet) else pet
        for pet in pet_list
    ]
    return {**plan, "settings": {**settings, "pets": {**pets, "list": moved}}}


# MIGRATIONS[n - 1] turns a plan of version n into one of version n + 1
MIGRATIONS: tuple[Callable[[dict[str, Any]], dict[str, Any]], ...] = (lights_to_lamps, pet_spots)
assert len(MIGRATIONS) == PLAN_VERSION - 1, "every plan version but the first has its migration"


def plan_version(plan: Any) -> int:
    """The version a plan says it has; vol.Invalid when it names none (a version newer than this one included)."""
    version = plan.get("version") if isinstance(plan, dict) else None
    if isinstance(version, bool) or not isinstance(version, int) or version < 1:
        raise vol.Invalid("the plan has no version number (1 or more)", path=["version"])
    return version


def migrate_plan(plan: Any) -> Any:
    """The plan brought to PLAN_VERSION (the same object when it is at that version already, or is no plan at all:
    the check then says what is wrong). PlanTooNew for a plan of a newer Home 3D, vol.Invalid when a step cannot
    read it."""
    if not isinstance(plan, dict):
        return plan
    version = plan_version(plan)
    if version > PLAN_VERSION:
        raise PlanTooNew(
            f"the plan is of version {version}, made by a newer Home 3D; this one reads plans up to version "
            f"{PLAN_VERSION}: update Home 3D to open it",
            path=["version"],
        )
    for number in range(version, PLAN_VERSION):
        try:
            plan = MIGRATIONS[number - 1](plan)
        except (AttributeError, KeyError, TypeError, ValueError) as err:
            raise vol.Invalid(f"the plan cannot be brought from version {number} to {number + 1} ({err})") from err
        plan = {**plan, "version": number + 1}
    return plan
