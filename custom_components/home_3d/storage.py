"""Persistence for Home 3D.

An install keeps several homes (#53). Each home's building (rooms, walls, furniture, placements), restore points
and background images live in separate stores so frequent saves from the editor never rewrite the large image data.
The packs, the custom items and the list of homes are shared.
"""

from __future__ import annotations

import asyncio
from collections.abc import Callable
import copy
import json
import logging
import os
import re
import time
from typing import Any
import uuid

from homeassistant.core import HomeAssistant
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.storage import STORAGE_DIR, Store
import voluptuous as vol

from .const import (
    DEFAULT_HOME_NAME,
    DEFAULT_RESTORE_PICTURE_DAYS,
    DOMAIN,
    FIRST_HOME_ID,
    HISTORY_INTERVAL,
    HISTORY_MAX,
    KEPT_MAX,
    PLAN_VERSION,
    SIGNAL_BUILDING_UPDATED,
    SIGNAL_HOMES_UPDATED,
    STORAGE_KEY_BUILDING,
    STORAGE_KEY_HISTORY,
    STORAGE_KEY_HOMES,
    STORAGE_KEY_IMAGES,
    STORAGE_KEY_PACKS,
    STORAGE_MINOR_VERSION,
    STORAGE_VERSION,
    UPLOAD_GRACE_DAYS,
)
from .custom_items import CustomItems
from .migrations import PlanTooNew, migrate_plan
from .moves import Moves, load_moves, migrate_bases, migrate_building, moved_into
from .off_loop import OFF_LOOP as _OFF_LOOP
from .packs import (
    BUNDLED_LANGUAGES_DIR,
    language_of,
    library_pack,
    load_bundled,
    renamed_installed,
    strings_hash,
    with_bundled,
)
from .racks import RackError, new_rack_problems
from .recipes import with_recipes
from .schema import BUILDING_SCHEMA, MAX_IMAGES, MAX_IMAGES_CHARS, empty_building, image_ids

_LOGGER = logging.getLogger(__name__)


# a stored plan that does not validate is repaired by leaving out at most this many invalid parts (#165)
_REPAIR_STEPS = 100
# what a plan problem (#165) means: one Home 3D cannot read is shown but never written over
PLAN_TOO_NEW = "plan_too_new"
PLAN_INVALID = "plan_invalid"
PLAN_REPAIRED = "plan_repaired"
_READ_ONLY = (PLAN_TOO_NEW, PLAN_INVALID)


class PlanReadOnly(Exception):
    """A change to a home whose stored plan this Home 3D cannot read (#165): too new, or invalid beyond repair."""


def check_plan(building: Any) -> tuple[dict[str, Any], dict[str, Any] | None]:
    """A stored plan as a home keeps it (#165): brought to the current version, checked and completed. The problem
    with it, else None: "plan_repaired" (invalid parts left out, named in `dropped`), "plan_invalid" (beyond repair:
    the plan comes back as it was) or "plan_too_new" (of a newer Home 3D: as it was)."""
    try:
        migrated = migrate_plan(building)
    except PlanTooNew as err:
        return building, {"code": PLAN_TOO_NEW, "message": f"The stored plan cannot be opened: {err.msg}"}
    except vol.Invalid as err:
        return building, _invalid(err)
    try:
        return BUILDING_SCHEMA(migrated), None
    except vol.Invalid as err:
        first: vol.Invalid = err
    # what is left out is marked first and taken out for each check, so every path named is one of the plan as stored
    plan = copy.deepcopy(migrated)
    dropped: list[str] = []
    error = first
    for _ in range(_REPAIR_STEPS):
        where = _drop_invalid(plan, error)
        if where is None:
            break
        dropped = [d for d in dropped if not d.startswith(f"{where}.")] + [where]
        try:
            repaired = BUILDING_SCHEMA(_without_dropped(plan))
        except vol.Invalid as again:
            error = again
            continue
        listed = ", ".join(dropped)
        return repaired, {
            "code": PLAN_REPAIRED,
            "message": f"Parts of the stored plan were invalid and are left out ({listed}); the plan as stored stays "
            "unchanged until the next save, and is kept as a restore point",
            "dropped": dropped,
        }
    return building, _invalid(first)


# a part check_plan leaves out (#165)
_DROPPED = object()


def _without_dropped(value: Any) -> Any:
    if isinstance(value, dict):
        return {k: _without_dropped(v) for k, v in value.items() if v is not _DROPPED}
    if isinstance(value, list):
        return [_without_dropped(v) for v in value if v is not _DROPPED]
    return value


def _drop_invalid(plan: dict[str, Any], err: vol.Invalid) -> str | None:
    """Mark the part of a plan an error names as left out (#165): an invalid field (its default applies, unless it is
    a required one or holds a list or an object), else the innermost list entry holding the error (never a whole
    floor). The path of what is left out; None when nothing can be."""
    try:
        path = _stored_path(plan, list(err.path))
        parent = _at(plan, path[:-1])
        key = path[-1] if path else None
        if (
            isinstance(key, str)
            and isinstance(parent, dict)
            and key in parent
            and not isinstance(parent[key], (dict, list))
            and parent[key] is not _DROPPED
            and "required key" not in err.msg
            and path[:1] != ["version"]
        ):
            parent[key] = _DROPPED
            return _dotted(path)
        for depth in range(len(path) - 1, 0, -1):
            index = path[depth]
            if isinstance(index, int) and path[:depth] != ["floors"]:
                _at(plan, path[:depth])[index] = _DROPPED
                return _dotted(path[: depth + 1])
    except (IndexError, KeyError, TypeError):
        return None
    return None


def _stored_path(plan: Any, path: list[Any]) -> list[Any]:
    """An error's path (in the plan without the parts left out) as a path in `plan`."""
    stored: list[Any] = []
    for key in path:
        if isinstance(plan, list) and isinstance(key, int):
            key = [i for i, v in enumerate(plan) if v is not _DROPPED][key]
        stored.append(key)
        if plan is _DROPPED:
            raise KeyError(key)
        plan = plan[key]
    return stored


def _at(plan: Any, path: list[Any]) -> Any:
    for key in path:
        plan = plan[key]
    return plan


def _dotted(path: list[Any]) -> str:
    return ".".join(str(key) for key in path)


def _migration_changes(plan: dict[str, Any]) -> bool:
    """Whether bringing a (readable) plan to the current version changes more than its version number."""
    return bool(migrate_plan(plan) != {**plan, "version": PLAN_VERSION})


def _invalid(err: vol.Invalid) -> dict[str, Any]:
    return {
        "code": PLAN_INVALID,
        "message": f"The stored plan is invalid ({err}); it is shown read-only: restore a restore point or a backup",
    }


def _loaded_plan(
    original: Any, packs: list[dict[str, Any]], moves: Moves
) -> tuple[Any, dict[str, Any] | None, bool, bool]:
    """A stored plan as a home loads it (no event loop needed, #176): checked and migrated (#165, check_plan), its
    moved items given their new ids (#110) and its pack items their recipe copies (#2). Also the problem with it,
    whether the plan as stored is kept as a restore point (it was repaired, or the migration changed more than its
    version) and whether the plan is written back. One this Home 3D cannot read comes back as it was, never written;
    a repaired one (#379: it may hold what a newer Home 3D wrote, after a rollback) is served repaired but never
    written back here: the plan as stored stays until an editor saves."""
    building, problem = check_plan(original)
    if problem is not None and problem["code"] in _READ_ONLY:
        return building, problem, False, False
    changed = problem is not None or original.get("version") != PLAN_VERSION
    keep_original = problem is not None or (changed and _migration_changes(original))
    moved = migrate_building(building, moves)
    completed = with_recipes(moved, moved.get("recipes"), packs)
    write = changed or moved is not building or completed.get("recipes") != building.get("recipes")
    return (completed if write else building), problem, keep_original, write and problem is None


def _started_plan(
    building: dict[str, Any], packs: list[dict[str, Any]], moves: Moves
) -> tuple[Any, dict[str, Any] | None]:
    """The first plan of a new home (no event loop needed, #176): brought to the current version (#165), else checked
    like a stored one; one it can read also gets its moved items' ids (#110) and its recipe copies (#2)."""
    problem = None
    try:
        building = migrate_plan(building)
    except vol.Invalid:
        building, problem = check_plan(building)
    if problem is not None and problem["code"] in _READ_ONLY:
        return building, problem
    building = migrate_building(building, moves)
    return with_recipes(building, building.get("recipes"), packs), problem


class _BuildingStore(Store):
    """Building store with migrations between minor versions."""

    async def _async_migrate_func(self, old_major_version: int, old_minor_version: int, old_data: dict) -> dict:
        # 1 -> 2 filled in the defaults of newer optional fields; Home.async_load now completes and migrates every
        # plan it loads (#165, the plan's own version), so the data passes as it is
        return old_data


class RevisionConflict(Exception):
    """A save from a plan that is out of date (#149): the plan changed since the revision the client started from."""

    def __init__(self, base: int, revision: int) -> None:
        """Keep both revisions."""
        super().__init__(f"The plan changed since revision {base}; it is at revision {revision} now")
        self.base = base
        self.revision = revision


def _without_recipes(building: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in building.items() if k != "recipes"}


class HomesError(Exception):
    """A change to the homes that cannot be made (`code` for the websocket error)."""

    def __init__(self, code: str, detail: str) -> None:
        """Keep the code and the message."""
        super().__init__(detail)
        self.code = code
        self.detail = detail


def _home_keys(home_id: str) -> tuple[str, str, str]:
    """The building, image and history store keys of a home: the first home keeps the stores of before #53."""
    if home_id == FIRST_HOME_ID:
        return STORAGE_KEY_BUILDING, STORAGE_KEY_IMAGES, STORAGE_KEY_HISTORY
    base = f"{DOMAIN}.home_{home_id}"
    return f"{base}.building", f"{base}.images", f"{base}.history"


# the stores of a home other than the first (#53, _home_keys)
_HOME_STORE = re.compile(rf"^{re.escape(DOMAIN)}\.home_([^.]+)\.(?:building|images|history)$")


def _storage_files(storage_dir: str) -> list[str]:
    """The files in Home Assistant's storage folder (no event loop needed); none when it cannot be listed."""
    try:
        return os.listdir(storage_dir)
    except OSError:
        return []


def _homes_on_disk(files: list[str]) -> list[str]:
    """The ids of the homes whose stores are on disk (#379), the first home first: the homes a lost list of homes
    named. A copy Home Assistant kept of a damaged store (`<key>.corrupt.<time>`) is no store."""
    first = any(name in (STORAGE_KEY_BUILDING, STORAGE_KEY_IMAGES, STORAGE_KEY_HISTORY) for name in files)
    others = sorted({m.group(1) for name in files if (m := _HOME_STORE.match(name))} - {FIRST_HOME_ID})
    return ([FIRST_HOME_ID] if first else []) + others


def _corrupt_copy(files: list[str], key: str) -> str | None:
    """The newest copy Home Assistant kept of a store it could not read (#379: it renames a damaged file to
    `<key>.corrupt.<time>` and loads nothing), else None."""
    return max((name for name in files if name.startswith(f"{key}.corrupt.")), default=None)


def _rotated(history: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The restore points kept: the last HISTORY_MAX, and apart from them the last KEPT_MAX ones marked `kept` (#379:
    a stored plan as it was before a repair), which the others never push out."""
    kept = {id(p) for p in [p for p in history if p.get("kept")][-KEPT_MAX:]}
    kept |= {id(p) for p in [p for p in history if not p.get("kept")][-HISTORY_MAX:]}
    return [p for p in history if id(p) in kept]


def _summary(building: dict[str, Any]) -> dict[str, int]:
    # also of a plan that does not validate (#165): what is no list counts as none
    def count(value: Any) -> int:
        return len(value) if isinstance(value, list) else 0

    floors = [f for f in building.get("floors") or [] if isinstance(f, dict)] if isinstance(building, dict) else []
    return {
        "floors": len(floors),
        "rooms": sum(count(f.get("rooms")) for f in floors),
        "furniture": sum(count(f.get("furniture")) for f in floors),
    }


class Home:
    """One home (#53): its building, revision, restore points and background images, each in its own store."""

    def __init__(
        self,
        hass: HomeAssistant,
        home_id: str,
        name: str,
        packs: Callable[[], list[dict[str, Any]]],
        moves: Callable[[], Moves] = dict,
        picture_days: Callable[[], int] = lambda: DEFAULT_RESTORE_PICTURE_DAYS,
    ) -> None:
        """Make the stores; `packs` gives the packs on offer (for the plan's recipe copies), `moves` the items that
        moved between packs (#110), `picture_days` how long the pictures of restore points are kept (#154)."""
        self.hass = hass
        self.id = home_id
        self.name = name
        self._packs = packs
        self._moves = moves
        self._picture_days = picture_days
        building_key, image_key, history_key = _home_keys(home_id)
        self._building_store = _BuildingStore(
            hass, STORAGE_VERSION, building_key, minor_version=STORAGE_MINOR_VERSION, **_OFF_LOOP
        )
        self._image_store: Store[Any] = Store(hass, STORAGE_VERSION, image_key, **_OFF_LOOP)
        self._history_store: Store[Any] = Store(hass, STORAGE_VERSION, history_key, **_OFF_LOOP)
        self.building: dict[str, Any] = empty_building()
        self.revision = 0
        # the last revision that changed more than the recipe copies (#149): a save from a plan at this revision or
        # later is not out of date, as the server's own recipe-only writes merge with it (recipe_bases, #45)
        self._content_revision = 0
        # saves, restores and the server's own updates of this home run one at a time (#149), so the revision check,
        # the plan they start from and the write are one step
        self._lock = asyncio.Lock()
        self._images: dict[str, str] = {}
        # when each picture was set (#379), so the clean-up on load keeps the ones set lately (a draft may use one
        # whose plan save failed); a picture stored before this has none
        self._added: dict[str, float] = {}
        # the plan as stored while it is served repaired (#379): it stays on disk as it is until the next write
        self._stored: Any = None
        self._history: list[dict[str, Any]] = []
        # a restore point never changes: its size in bytes is worked out once (#240)
        self._sizes: dict[str, int] = {}
        # what is wrong with the stored plan (#165, see check_plan): None when nothing is
        self.problem: dict[str, Any] | None = None
        # deleted (#167): a save or restore that waited for the lock while the home was deleted writes nothing
        self.deleted = False

    @property
    def read_only(self) -> bool:
        """Whether the stored plan is one this Home 3D cannot read (#165): it is shown, never written over; only a
        restore (a restore point, a backup) replaces it."""
        return self.problem is not None and self.problem["code"] in _READ_ONLY

    def info(self) -> dict[str, Any]:
        """The home as the homes list shows it."""
        return {"id": self.id, "name": self.name, "revision": self.revision, **_summary(self.building)}

    async def async_load(self) -> None:
        """Load the stores and drop the images neither the plan nor a recent restore point uses (#154).

        The plan is brought to the current version and checked (#165, check_plan). A migrated plan is written back
        once, the plan as stored kept as a restore point first; a repaired one is served repaired but stays on disk as
        it is until the next write, and is kept as a restore point the others never push out (#379); one that cannot
        be read (also a store Home Assistant found damaged, #379) is kept as it is and the home is read-only."""
        # under the lock like every other change of the plan (#149), the check and the migration in the executor (#176)
        async with self._lock:
            history = await self._history_store.async_load()
            self._history = list((history or {}).get("snapshots", []))
            stored = await self._building_store.async_load()
            # a store Home Assistant could not read it renamed and loaded as nothing (#379): looked up only then
            files = await self._async_storage_files() if stored is None or history is None else []
            if stored:
                original = stored.get("building") or empty_building()
                self.revision = int(stored.get("revision", 0))
                self._content_revision = self.revision
                building, self.problem, keep_original, write = await self.hass.async_add_executor_job(
                    _loaded_plan, original, self._packs(), self._moves()
                )
                if self.problem is not None:
                    _LOGGER.warning("Home %s: %s", self.id, self.problem["message"])
                repaired = self.problem is not None and not self.read_only
                if keep_original and not (repaired and self._has_kept(original)):
                    # nothing the migration or the repair leaves out is lost: the plan as stored stays a restore point
                    await self._async_snapshot(original, kept=repaired)
                self.building = building
                self._stored = original if repaired else None
                if write:
                    await self._save_building()
            elif (damaged := _corrupt_copy(files, self._building_store.key)) is not None:
                # a damaged plan is no empty one (#379): the home is read-only until a restore point or a backup
                self.problem = {
                    "code": PLAN_INVALID,
                    "message": f"The stored plan could not be read; Home Assistant kept the damaged file as {damaged}",
                }
                _LOGGER.warning("Home %s: %s", self.id, self.problem["message"])
            # pictures go only while the plan and the restore points are known (#379): never against no plan, an
            # empty one or lost restore points
            known = bool(stored) and bool(self.building.get("floors"))
            known = known and _corrupt_copy(files, self._history_store.key) is None
        images = await self._image_store.async_load()
        # the clean-up is one step with picture changes (#364): under the lock, so a picture set meanwhile is kept
        async with self._lock:
            self._images = dict((images or {}).get("images", {}))
            added = (images or {}).get("added") or {}
            self._added = {k: float(v) for k, v in added.items() if k in self._images and isinstance(v, (int, float))}
            used = self._images_in_use() if known else None
            # a picture set lately stays (#379: a draft may use it, its plan save failed), for at most the days the
            # pictures of restore points are kept
            since = time.time() - min(UPLOAD_GRACE_DAYS, self._picture_days()) * 86400
            unused = (
                {i for i in set(self._images) - used if self._added.get(i, 0) < since} if used is not None else set()
            )
            if unused:
                _LOGGER.debug("Removing %d unused background images", len(unused))
                for image_id in unused:
                    self._images.pop(image_id)
                    self._added.pop(image_id, None)
                await self._save_images()

    async def _async_storage_files(self) -> list[str]:
        return await self.hass.async_add_executor_job(_storage_files, self.hass.config.path(STORAGE_DIR))

    def _has_kept(self, original: Any) -> bool:
        """Whether the plan as stored is a kept restore point already (#379): a repaired plan is not written back, so
        it is repaired again at every start."""
        return any(
            p.get("kept") and p["revision"] == self.revision and p["building"] == original for p in self._history
        )

    async def async_start(self, building: dict[str, Any] | None, images: dict[str, str] | None) -> None:
        """Fill a new home: its first plan (revision 1) and pictures, or an empty plan at revision 0."""
        if images:
            self._images = dict(images)
            self._added = dict.fromkeys(self._images, time.time())
            await self._save_images()
        if building is not None:
            # a plan given here is checked already (a backup, the sample, a copy of a home); one of an older version
            # is brought up to date (#165), one this Home 3D cannot read stays as it is and the home read-only; in the
            # executor (#176)
            self.building, self.problem = await self.hass.async_add_executor_job(
                _started_plan, building, self._packs(), self._moves()
            )
            self.revision = 1
            self._content_revision = 1
        await self._save_building()

    async def async_save_building(
        self,
        building: dict[str, Any],
        recipe_bases: dict[str, str] | None = None,
        *,
        check_racks: bool = False,
        base_revision: int | None = None,
        guard: Callable[[dict[str, Any]], None] | None = None,
    ) -> int:
        """Store a validated building, bump the revision and notify subscribers.

        The state before the save becomes a restore point when the last one is older than
        HISTORY_INTERVAL, so a long editing session leaves a trail without saving every step.

        `base_revision` (#149) is the revision the client's plan started from: when the plan changed since (more than
        its recipe copies), the save is refused with RevisionConflict and nothing changes. Without it (an older
        client) the save replaces the plan as before. `guard` sees the current plan first and may raise to refuse.
        """
        async with self._lock:
            self._check_not_deleted()
            if self.read_only and self.problem is not None:
                raise PlanReadOnly(self.problem["message"])
            if base_revision is not None and not self._content_revision <= base_revision <= self.revision:
                raise RevisionConflict(base_revision, self.revision)
            if guard is not None:
                guard(self.building)
            return await self._async_store(building, recipe_bases, check_racks=check_racks)

    async def async_update_building(self, change: Callable[[dict[str, Any]], dict[str, Any] | None]) -> int:
        """A change the server makes itself (#149: a pack update, a rollback, a custom item edit): `change` gets the
        current plan once no other save runs and returns the new one (None: nothing to change), so a save that
        landed meanwhile is never overwritten. The revision after it."""
        async with self._lock:
            # a plan this Home 3D cannot read is never written over (#165), nor a deleted home's (#167), nor one
            # served repaired (#379): the plan as stored stays until an editor saves
            if self.read_only or self.deleted or self._stored is not None:
                return self.revision
            building = change(self.building)
            if building is None:
                return self.revision
            return await self._async_store(building, content=None)

    async def _async_store(
        self,
        building: dict[str, Any],
        recipe_bases: dict[str, str] | None = None,
        *,
        check_racks: bool = False,
        content: bool | None = True,
    ) -> int:
        """Store a building while the lock is held. `content`: whether more than the recipe copies changed (None:
        compare)."""
        last = self._history[-1]["saved_at"] if self._history else 0
        if self.building.get("floors") and time.time() - last > HISTORY_INTERVAL:
            await self._async_snapshot()
        # in the executor (#176): on a large plan this is tens of milliseconds the event loop need not wait for; a plan
        # this Home 3D cannot read (#165) has no recipe copies to keep
        kept = None if self.read_only else self.building.get("recipes")
        building = await self.hass.async_add_executor_job(
            self._prepared, building, recipe_bases, kept, self._packs(), self._moves()
        )
        # an editor's save that puts rack gear where it does not fit is refused (#113); what broke the rules before
        # (a pack update) stays
        if check_racks and (problems := new_rack_problems(self.building, building)):
            raise RackError(problems)
        if content is None:
            content = _without_recipes(building) != _without_recipes(self.building)
        # written first (#167): when the write fails the home keeps the plan and the revision it has on disk, and the
        # error goes to the caller (an editor keeps its edits as a draft)
        revision = self.revision + 1
        await self._building_store.async_save({"revision": revision, "building": building})
        self.building = building
        self.revision = revision
        if content:
            self._content_revision = revision
        # a plan replaced by a valid one has no problem any more (#165), and it is the plan as stored (#379)
        self.problem = None
        self._stored = None
        async_dispatcher_send(self.hass, SIGNAL_BUILDING_UPDATED, self.id, revision)
        return revision

    @staticmethod
    def _prepared(
        building: dict[str, Any],
        recipe_bases: dict[str, str] | None,
        kept: dict[str, Any] | None,
        packs: list[dict[str, Any]],
        moves: Moves,
    ) -> dict[str, Any]:
        """A building as it is stored (no event loop needed): items that moved to another pack take their new ids
        (#110: an imported plan, a backup, a restore point), and every pack item type keeps its recipe copy (#2): the
        one sent, else the one kept so far, else a copy of the installed item; one the client sends as it started from
        it gives way to a newer kept one (#45)."""
        sent, building = building, migrate_building(building, moves)
        recipe_bases = migrate_bases(recipe_bases, sent, building, moves)
        return with_recipes(building, kept, packs, recipe_bases)

    async def async_follow_custom_items(self) -> None:
        """After a custom item changed (#13): placed copies of it follow the change at once (#26)."""

        def follow(current: dict[str, Any]) -> dict[str, Any] | None:
            building = with_recipes(current, current.get("recipes"), self._packs())
            return building if building.get("recipes") != current.get("recipes") else None

        await self.async_update_building(follow)

    async def async_restore(self, building: dict[str, Any]) -> int:
        """Replace the plan (a restore point or a backup); the state before becomes a restore point."""
        async with self._lock:
            self._check_not_deleted()
            await self._async_snapshot()
            return await self._async_store(building)

    def state(self) -> tuple[dict[str, Any], dict[str, Any] | None, Any]:
        """The plan as served, the problem with it and the plan as stored (#379), for async_put_back."""
        return self.building, self.problem, self.building if self._stored is None else self._stored

    async def async_put_back(self, state: tuple[dict[str, Any], dict[str, Any] | None, Any]) -> int:
        """Put back a state from `state()` (#379: undoing a failed backup restore). A home without a problem gets its
        plan back as from a restore point; one with a problem (read-only, or served repaired) gets its plan as stored
        back unchanged and keeps the problem: a read-only home stays read-only."""
        building, problem, stored = state
        if problem is None:
            return await self.async_restore(building)
        async with self._lock:
            self._check_not_deleted()
            await self._async_snapshot()
            revision = self.revision + 1
            await self._building_store.async_save({"revision": revision, "building": stored})
            self.building, self.revision, self._content_revision = building, revision, revision
            self.problem = problem
            self._stored = None if stored is building else stored
            async_dispatcher_send(self.hass, SIGNAL_BUILDING_UPDATED, self.id, revision)
            return revision

    async def async_snapshot(self) -> None:
        """Keep the current building as a restore point."""
        async with self._lock:
            self._check_not_deleted()
            await self._async_snapshot()

    def _check_not_deleted(self) -> None:
        if self.deleted:
            raise HomesError("home_not_found", f"The home {self.id} was deleted")

    async def _async_snapshot(self, building: dict[str, Any] | None = None, *, kept: bool = False) -> None:
        """Keep the current building (or `building`, the plan as stored before a migration, #165) as a restore
        point; `kept` (#379: the plan as stored before a repair): one the other restore points never push out."""
        self._history.append(
            {
                "id": uuid.uuid4().hex[:12],
                "revision": self.revision,
                "saved_at": time.time(),
                "building": self.building if building is None else building,
                **({"kept": True} if kept else {}),
            }
        )
        self._history = _rotated(self._history)
        # copies: the JSON is written in the executor while the loop may change the originals
        await self._history_store.async_save({"snapshots": list(self._history)})

    def _images_in_use(self) -> set[str] | None:
        """The images the plan uses and those of the restore points made in the last `picture_days` days (#154) or
        kept apart (#379); a picture only an older restore point names is removed. None (remove nothing) when the plan
        (#165) or a restore point cannot be read."""
        if self.read_only:
            return None
        since = time.time() - self._picture_days() * 86400
        try:
            used = image_ids(self.building)
            for point in self._history:
                if point["saved_at"] >= since or point.get("kept"):
                    used |= image_ids(point["building"])
        except (KeyError, TypeError, AttributeError) as err:
            _LOGGER.warning("A restore point of home %s cannot be read (%s); keeping every picture", self.id, err)
            return None
        return used

    def missing_images(self, building: dict[str, Any]) -> list[str]:
        """The stored pictures a plan names that this home no longer has (#154: removed after `picture_days`)."""
        try:
            return sorted(image_ids(building) - set(self._images))
        except (KeyError, TypeError, AttributeError):
            return []

    def history(self) -> list[dict[str, Any]]:
        """Restore points, newest first, without their buildings; `size`: the bytes of the saved plan (#240; the
        pictures are kept apart and shared); `missing_pictures`: how many of the pictures a restore point names are
        gone (#154), so it restores without them."""
        return [
            {
                "id": h["id"],
                "revision": h["revision"],
                "saved_at": h["saved_at"],
                **_summary(h["building"]),
                "size": self._size(h),
                "missing_pictures": len(self.missing_images(h["building"])),
                **({"kept": True} if h.get("kept") else {}),
            }
            for h in reversed(self._history)
        ]

    def _size(self, point: dict[str, Any]) -> int:
        """The size of a restore point's plan as stored, in bytes."""
        if (size := self._sizes.get(point["id"])) is None:
            size = self._sizes[point["id"]] = len(json.dumps(point["building"], separators=(",", ":")).encode())
        return size

    def snapshot(self, snapshot_id: str) -> dict[str, Any] | None:
        """Building of a restore point."""
        return next((h["building"] for h in self._history if h["id"] == snapshot_id), None)

    @property
    def images(self) -> dict[str, str]:
        """All stored images (id -> data URL)."""
        return dict(self._images)

    def get_image(self, image_id: str) -> str | None:
        """Return an image as data URL."""
        return self._images.get(image_id)

    async def async_set_image(self, image_id: str, data: str) -> None:
        """Store an image (#364), under the home's lock like every other change. Refused with "images_full" when it
        would be a new picture beyond MAX_IMAGES or would take the pictures past MAX_IMAGES_CHARS; replacing a picture
        is never a new one, and a home that holds more than the limits from before them (an old install) keeps what it
        has and may still replace pictures with ones no bigger."""
        async with self._lock:
            self._check_not_deleted()
            old = self._images.get(image_id)
            if old is None and len(self._images) >= MAX_IMAGES:
                raise HomesError("images_full", f"A home keeps at most {MAX_IMAGES} pictures; remove some first")
            total = sum(len(v) for v in self._images.values())
            grown = len(data) - (len(old) if old is not None else 0)
            if grown > 0 and total + grown > MAX_IMAGES_CHARS:
                raise HomesError("images_full", "The pictures of this home are too big together; remove some first")
            self._images[image_id] = data
            self._added[image_id] = time.time()
            await self._save_images()

    async def async_delete_image(self, image_id: str) -> None:
        """Remove an image (#364, under the lock)."""
        async with self._lock:
            self._check_not_deleted()
            if self._images.pop(image_id, None) is not None:
                self._added.pop(image_id, None)
                await self._save_images()

    async def async_remove(self) -> None:
        """Delete the home's stores."""
        for store in (self._building_store, self._image_store, self._history_store):
            await store.async_remove()

    async def async_delete(self) -> None:
        """Delete the home for good (#167): once a save or restore running now is done, so none writes its stores
        again after they are gone; one still waiting is refused with "home_not_found"."""
        async with self._lock:
            self.deleted = True
            await self.async_remove()

    async def _save_building(self) -> None:
        await self._building_store.async_save({"revision": self.revision, "building": self.building})

    async def _save_images(self) -> None:
        await self._image_store.async_save({"images": dict(self._images), "added": dict(self._added)})


class FloorplanData:
    """The homes of one installation (#53) and what they share: the packs, the custom items and the library.

    `building`, `revision`, the restore points and the images without a home are those of the active home: the one
    the panel opens, cards show by default and voice, locating and time travel use.
    """

    def __init__(self, hass: HomeAssistant, picture_days: int = DEFAULT_RESTORE_PICTURE_DAYS) -> None:
        """Initialise the stores; `picture_days`: how long a picture only a restore point uses is kept (#154)."""
        self.hass = hass
        self.picture_days = picture_days
        self._pack_store: Store[Any] = Store(hass, STORAGE_VERSION, STORAGE_KEY_PACKS, **_OFF_LOOP)
        self._homes_store: Store[Any] = Store(hass, STORAGE_VERSION, STORAGE_KEY_HOMES)
        self.homes: dict[str, Home] = {}
        self.active_id = FIRST_HOME_ID
        # imported furniture packs (checked payloads, see packs.py)
        self.packs: list[dict[str, Any]] = []
        # the packs that ship with Home 3D (bundled_packs/, read from the disk; never stored or backed up)
        self.bundled: list[dict[str, Any]] = []
        # the household's own items (#13), offered as one more pack
        self.custom = CustomItems(hass)
        # bundled items that moved to another pack: old type -> new type (#110, moved_items.json)
        self.moves: Moves = {}
        # the light form of each offered pack (#44), kept while the pack (the same object) stays
        self._library: dict[str, tuple[Any, dict[str, Any]]] = {}

    async def async_load(self) -> None:
        """Load the shared stores, then every home. An install from before #53 has no list of homes: its plan
        becomes the first home, read from the stores it always had (nothing is copied). A list of homes that is lost
        or damaged is made again from the homes' stores on disk (#379)."""
        packs = await self._pack_store.async_load()
        installed = list((packs or {}).get("packs", []))
        # packs installed under our old ids (theovencook.*) are kept under the new ones (#424), written back once
        self.packs = renamed_installed(installed)
        if self.packs is not installed:
            await self._pack_store.async_save({"packs": self.packs})
        # the bundled furniture packs, then the bundled language packs (#196)
        self.bundled = await self.hass.async_add_executor_job(load_bundled)
        self.bundled += await self.hass.async_add_executor_job(load_bundled, BUNDLED_LANGUAGES_DIR)
        self.moves = await self.hass.async_add_executor_job(load_moves)
        await self.custom.async_load()
        stored = await self._homes_store.async_load()
        listed = list((stored or {}).get("homes") or [])
        if not listed:
            # a lost (or damaged) list of homes (#379): the homes are those whose stores are on disk, by placeholder
            # names; none (a new install, one from before #53): the first home
            files = await self.hass.async_add_executor_job(_storage_files, self.hass.config.path(STORAGE_DIR))
            found = _homes_on_disk(files) or [FIRST_HOME_ID]
            listed = [
                {"id": home_id, "name": DEFAULT_HOME_NAME if n == 1 else f"{DEFAULT_HOME_NAME} {n}"}
                for n, home_id in enumerate(found, 1)
            ]
            if found != [FIRST_HOME_ID]:
                _LOGGER.warning("The list of homes was lost; the %d homes found on disk are listed again", len(found))
        self.homes = {}
        for entry in listed:
            home = self._new_home(entry["id"], entry.get("name") or DEFAULT_HOME_NAME)
            await home.async_load()
            self.homes[home.id] = home
        active = (stored or {}).get("active")
        self.active_id = active if active in self.homes else next(iter(self.homes))
        if not (stored or {}).get("homes"):
            await self._save_homes()

    def _new_home(self, home_id: str, name: str) -> Home:
        return Home(self.hass, home_id, name, lambda: self.offered_packs, lambda: self.moves, lambda: self.picture_days)

    async def _save_homes(self) -> None:
        homes = [{"id": h.id, "name": h.name} for h in self.homes.values()]
        await self._homes_store.async_save({"homes": homes, "active": self.active_id})

    # ------------------------------------------------------------------------ homes (#53)

    @property
    def active(self) -> Home:
        """The active home."""
        return self.homes[self.active_id]

    def home(self, home_id: str | None) -> Home | None:
        """A home by its id (None: the active one); None when there is no such home."""
        return self.active if home_id is None else self.homes.get(home_id)

    def homes_list(self) -> list[dict[str, Any]]:
        """Every home in its order, as the switcher lists them."""
        return [home.info() for home in self.homes.values()]

    def _get(self, home_id: str) -> Home:
        if (home := self.homes.get(home_id)) is None:
            raise HomesError("home_not_found", f"There is no home {home_id}")
        return home

    async def async_create_home(
        self,
        name: str,
        building: dict[str, Any] | None = None,
        images: dict[str, str] | None = None,
        home_id: str | None = None,
        *,
        area_import: bool = True,
        demo: bool = False,
    ) -> Home:
        """Add a home: empty, or with a given (checked, completed) building and its pictures. The new home is not
        made active. #54 loads a sample home with this; a sample or template passes `area_import=False` (#61) so the
        editor never offers to fill it with this install's own Home Assistant areas. `demo=True` marks it as a demo
        (#100): the viewer then shows fixed demo states for linked entities this install does not have."""
        if not area_import or demo:
            building = copy.deepcopy(building) if building is not None else empty_building()
            marks = {**({"area_import": False} if not area_import else {}), **({"demo": True} if demo else {})}
            building["settings"] = {**building.get("settings", {}), **marks}
        if home_id is None:
            home_id = uuid.uuid4().hex[:8]
        if home_id in self.homes:
            raise HomesError("home_exists", f"There is a home {home_id} already")
        home = self._new_home(home_id, name)
        # a home made again under the id of one removed earlier never finds that one's stores
        await home.async_remove()
        await home.async_start(building, images)
        self.homes[home.id] = home
        await self._save_homes()
        async_dispatcher_send(self.hass, SIGNAL_HOMES_UPDATED)
        return home

    async def async_rename_home(self, home_id: str, name: str) -> Home:
        """Give a home another name."""
        home = self._get(home_id)
        home.name = name
        await self._save_homes()
        async_dispatcher_send(self.hass, SIGNAL_HOMES_UPDATED)
        return home

    async def async_duplicate_home(self, home_id: str, name: str) -> Home:
        """A new home with a copy of another's plan and the pictures it uses (the restore points stay with the
        original, and so do the pictures only they use, #154)."""
        source = self._get(home_id)
        used = image_ids(source.building)
        images = {k: v for k, v in source.images.items() if k in used}
        return await self.async_create_home(name, copy.deepcopy(source.building), images)

    async def async_delete_home(self, home_id: str) -> None:
        """Remove a home with its stores; the last one stays. If it was active, the first one left becomes so."""
        home = self._get(home_id)
        if len(self.homes) == 1:
            raise HomesError("last_home", "The last home cannot be deleted")
        del self.homes[home_id]
        if self.active_id == home_id:
            self.active_id = next(iter(self.homes))
        await self._save_homes()
        await home.async_delete()
        async_dispatcher_send(self.hass, SIGNAL_HOMES_UPDATED)

    async def async_set_active(self, home_id: str) -> Home:
        """Make a home the active one."""
        home = self._get(home_id)
        self.active_id = home.id
        await self._save_homes()
        async_dispatcher_send(self.hass, SIGNAL_HOMES_UPDATED)
        return home

    # ------------------------------------------------------------------------ the active home's plan

    @property
    def building(self) -> dict[str, Any]:
        """The active home's building."""
        return self.active.building

    @building.setter
    def building(self, building: dict[str, Any]) -> None:
        self.active.building = building

    @property
    def revision(self) -> int:
        """The active home's revision."""
        return self.active.revision

    @property
    def images(self) -> dict[str, str]:
        """The active home's images (id -> data URL)."""
        return self.active.images

    def get_image(self, image_id: str) -> str | None:
        """One of the active home's images as data URL."""
        return self.active.get_image(image_id)

    async def async_save_building(
        self, building: dict[str, Any], recipe_bases: dict[str, str] | None = None, *, check_racks: bool = False
    ) -> int:
        """Store the active home's building (see Home.async_save_building)."""
        return await self.active.async_save_building(building, recipe_bases, check_racks=check_racks)

    async def async_update_building(self, change: Callable[[dict[str, Any]], dict[str, Any] | None]) -> int:
        """Change the active home's building from the plan it has then (see Home.async_update_building)."""
        return await self.active.async_update_building(change)

    async def async_snapshot(self) -> None:
        """Keep the active home's building as a restore point."""
        await self.active.async_snapshot()

    def history(self) -> list[dict[str, Any]]:
        """The active home's restore points, newest first."""
        return self.active.history()

    def snapshot(self, snapshot_id: str) -> dict[str, Any] | None:
        """Building of one of the active home's restore points."""
        return self.active.snapshot(snapshot_id)

    async def async_follow_custom_items(self) -> None:
        """After a custom item changed (#13): placed copies of it follow the change at once (#26), in every home."""
        for home in list(self.homes.values()):
            await home.async_follow_custom_items()

    # ------------------------------------------------------------------------ packs (shared by every home)

    @property
    def offered_packs(self) -> list[dict[str, Any]]:
        """The bundled packs, the imported ones and the custom items, as the library offers them."""
        custom = self.custom.pack()
        return with_bundled(self.bundled, self.packs) + ([custom] if custom else [])

    @property
    def library(self) -> list[dict[str, Any]]:
        """The offered packs as the library lists them (#44): an index of their items without the recipes. The
        household's own items come whole: they are few, and the item editor works on them."""
        listed: list[dict[str, Any]] = []
        kept: dict[str, tuple[Any, dict[str, Any]]] = {}
        aliases = moved_into(self.moves) if self.moves else {}
        for pack in self.offered_packs:
            custom = bool(pack.get("custom"))
            # the custom items' pack is made anew on every call: it stays the same while its item list does
            key = pack["items"] if custom else pack
            cached = self._library.get(pack["id"])
            if cached is not None and cached[0] is key:
                light = cached[1]
            else:
                light = library_pack(pack, whole=custom)
                # the old ids of items that moved into the pack (#110)
                if moved := aliases.get(pack["id"]):
                    light["aliases"] = moved
            kept[pack["id"]] = (key, light)
            listed.append(light)
        self._library = kept
        return listed

    def language(self, code: str) -> dict[str, Any]:
        """A language's texts from the offered language packs (#196): the bundled one, then installed ones (a key in
        a later pack wins), with their hash and the ids of the packs; no packs: no texts (English is in the page)."""
        strings, ids = language_of(self.offered_packs, code)
        return {"language": code, "packs": ids, "hash": strings_hash(strings), "strings": strings}

    async def async_add_pack(self, payload: dict[str, Any], source: dict[str, Any] | None = None) -> None:
        """Keep an imported pack; a newer release of the same pack replaces the old one. Its source (the files of a
        v2 folder, the payload of an old pack) stays with it, so a backup can carry the pack and a restore can check
        it again."""
        entry: dict[str, Any] = {**payload, "imported_at": time.time()}
        if source is not None:
            entry["source"] = source
        self.packs = [p for p in self.packs if p["id"] != payload["id"]] + [entry]
        await self._pack_store.async_save({"packs": self.packs})

    async def async_set_packs(self, packs: list[dict[str, Any]]) -> None:
        """Replace the imported packs (from a backup)."""
        self.packs = packs
        await self._pack_store.async_save({"packs": self.packs})

    async def async_remove_pack(self, pack_id: str) -> bool:
        """Remove a pack (furniture using it stays in the plan and keeps its recipe copy)."""
        kept = [p for p in self.packs if p["id"] != pack_id]
        if len(kept) == len(self.packs):
            return False
        self.packs = kept
        await self._pack_store.async_save({"packs": self.packs})
        return True
