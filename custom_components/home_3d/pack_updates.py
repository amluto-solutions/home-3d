"""Pack updates (#26): update checks, per-item updates, auto-update, pin and roll back.

A placed pack item is drawn from the plan's copy of its recipe (#2, recipes.py), so a newer release of its pack
changes nothing in the house by itself. A placed item "has an update" when the installed item differs from the copy
and is not an older release than it (an older release never silently replaces a newer one). Updating an item puts a
copy of the installed item into the plan; with the auto-update setting on, that happens without asking whenever a
newer release arrives (an import, an install, a scheduled check, a Home 3D update that brings a bundled pack).

Packs installed from GitHub (#25) are checked on the schedule the household sets (daily, weekly or monthly at a
time, or off): when the pack's own pack.json at the ref names a higher release, the check records "update available"
(#189); an editor sees what it changes (items added, changed, removed) and installs it, or, with auto-update on, the new
release is installed into the library by the check itself (placed items still keep their copies). A pack folder in a
repository with several packs is compared by its own release, so a release of the repository that changes other packs
is no update for it.

A pinned pack is left alone: no check installs a newer release of it, auto-update skips its items, and an import of
another release asks first. Rolling back puts back the release a pack had before its last update (and the placed
items that had taken that update), and pins the pack so the next check does not bring the update back.

The packs are shared by every home (#53), so are their updates (#164): an update, an auto-update and a roll back
change the placed items of every home, and the list of items with an update covers every home. Removing a pack forgets
its pin, its previous release and its last check.

The household's own items (#13, `household.custom`) are never listed: placed copies follow their edits by themselves.
Bundled packs come with Home 3D itself; their placed items follow the auto-update setting like any other.
"""

from __future__ import annotations

import asyncio
from collections import Counter
from collections.abc import Callable
from datetime import datetime, timedelta
import logging
import time
from typing import TYPE_CHECKING, Any

from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.event import async_track_time_change
from homeassistant.helpers.start import async_at_started
from homeassistant.helpers.storage import Store
from homeassistant.util import dt as dt_util
import voluptuous as vol

from .const import STORAGE_KEY_PACK_UPDATES, STORAGE_VERSION, TIME_PATTERN
from .custom_items import not_reserved
from .moves import migrate_pins, moved_copy, moved_out_of, retired_packs
from .off_loop import OFF_LOOP
from .pack_github import RateLimited, checked_origin, fetch_pack, latest_release
from .pack_index import PackIndex, checked_setting, index_url
from .pack_preview import pack_preview
from .packs import (
    CUSTOM_PACK_ID,
    ITEM_SCHEMA,
    PackError,
    checked_folder,
    is_reserved,
    kind_of,
    official_only,
    pack_hash,
    recipe_hash,
    renamed_pack,
    renamed_pack_id,
    with_bundled,
)
from .recipes import PACK_TYPE_PREFIX, installed_copies, placed_types, recipe_copy

if TYPE_CHECKING:
    from .storage import FloorplanData, Home

_LOGGER = logging.getLogger(__name__)

# how often installed packs are checked for a new release ("off": only when asked)
FREQUENCIES = ["off", "daily", "weekly", "monthly"]
DEFAULT_SETTINGS: dict[str, Any] = {
    # updates are opt-in: placed items wait for an editor until this is switched on
    "auto_update": False,
    "frequency": "daily",
    # local time of the check, "HH:MM"
    "time": "04:00",
    # the day of a weekly check, 0 = Monday (a monthly check runs on the 1st)
    "weekday": 0,
    # where the Library's Browse tab gets its list of packs (#336): "" is the default index (pack_index.py)
    "index_url": "",
}
SETTINGS_FIELDS: dict[Any, Any] = {
    vol.Optional("auto_update"): bool,
    vol.Optional("frequency"): vol.In(FREQUENCIES),
    vol.Optional("time"): vol.All(str, vol.Match(TIME_PATTERN)),
    vol.Optional("weekday"): vol.All(int, vol.Range(min=0, max=6)),
    vol.Optional("index_url"): checked_setting,
}
SETTINGS_SCHEMA = vol.Schema(SETTINGS_FIELDS)


def placed_counts(building: dict[str, Any]) -> dict[str, int]:
    """How often each furniture type is placed (a parking spot's vehicles count too)."""
    return dict(Counter(placed_types(building)))


def _current_hash(copy_: dict[str, Any]) -> str | None:
    """The hash of a plan's copy read with today's item rules (#288). A copy kept before an item field with a default
    was added has no such field, so its stored hash differs from the installed item's although nothing changed: that
    showed as an update from a release to the same release."""
    try:
        return recipe_hash(ITEM_SCHEMA(copy_["recipe"]))
    except (vol.Invalid, KeyError, TypeError):
        return None


def pending_items(building: dict[str, Any], packs: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """The placed pack items with an update, sorted by type: the installed item differs from the plan's copy and is
    not an older release. The household's own items follow their edits by themselves and are never listed."""
    installed = installed_copies(packs)
    counts = placed_counts(building)
    found: list[dict[str, Any]] = []
    for type_, copy_ in sorted((building.get("recipes") or {}).items()):
        if copy_["pack"] == CUSTOM_PACK_ID or type_ not in installed:
            continue
        pack, item = installed[type_]
        new = recipe_copy(pack, item)
        # the stored hash first: the copy is read with today's item rules (ITEM_SCHEMA) only when it differs (#374)
        if new["hash"] == copy_.get("hash") or new["release"] < copy_.get("release", 1):
            continue
        if new["hash"] == _current_hash(copy_):
            continue
        found.append(
            {
                "type": type_,
                "pack": copy_["pack"],
                "item": copy_["item"],
                "name": item["name"],
                "release": copy_.get("release", 1),
                "new_release": new["release"],
                # the pack's one line on what this release changed (#288), when it gave one
                **({"note": pack["release_note"]} if pack.get("release_note") else {}),
                "placed": counts.get(type_, 0),
            }
        )
    return found


# one pack's result in a check round: the pack as it was asked about, its check, the release to install
_Found = tuple[dict[str, Any], dict[str, Any], tuple[dict[str, Any], dict[str, Any]] | None]


def _origin_url(pack: dict[str, Any]) -> str | None:
    """The GitHub URL a pack was installed from, None for one imported from files (or bundled)."""
    origin = (pack.get("source") or {}).get("origin")
    return origin.get("url") if isinstance(origin, dict) else None


def _differs(current: dict[str, Any], payload: dict[str, Any], origin: dict[str, Any] | None) -> str | None:
    """How a pack differs from the installed one beyond its release (#373): other items or texts, or another place
    it comes from (a GitHub URL, or files); None when it is the same."""
    if pack_hash(current) != pack_hash(payload):
        return "this one has other content"
    if not current.get("bundled") and _origin_url(current) != (origin or {}).get("url"):
        here = (origin or {}).get("url") or "files"
        return f"this one comes from {here}, the installed one from {_origin_url(current) or 'files'}"
    return None


def last_due(settings: dict[str, Any], now: datetime) -> datetime | None:
    """The last time a scheduled check was due up to `now` (None when checks are off)."""
    frequency = settings["frequency"]
    if frequency == "off":
        return None
    hour, minute = (int(x) for x in settings["time"].split(":"))
    due = now.replace(hour=hour, minute=minute, second=0, microsecond=0)
    if due > now:
        due -= timedelta(days=1)
    if frequency == "weekly":
        due -= timedelta(days=(due.weekday() - settings["weekday"]) % 7)
    elif frequency == "monthly":
        due -= timedelta(days=due.day - 1)
    return due


def with_updates(
    building: dict[str, Any], packs: list[dict[str, Any]], types: list[str] | None
) -> tuple[dict[str, Any], list[str]]:
    """The building with the named placed items (None: every one with an update) updated to the installed item, and
    the types that were updated."""
    wanted = [p["type"] for p in pending_items(building, packs) if types is None or p["type"] in types]
    if not wanted:
        return building, []
    installed = installed_copies(packs)
    recipes = dict(building.get("recipes") or {})
    for type_ in wanted:
        recipes[type_] = recipe_copy(*installed[type_])
    return {**building, "recipes": recipes}, wanted


class PackUpdates:
    """The update settings, pins and previous releases of one installation, and the scheduled check."""

    def __init__(self, hass: HomeAssistant, data: FloorplanData) -> None:
        self.hass = hass
        self.data = data
        # the previous releases are whole packs: written in the executor (#176)
        self._store: Store = Store(hass, STORAGE_VERSION, STORAGE_KEY_PACK_UPDATES, **OFF_LOOP)
        self.settings: dict[str, Any] = dict(DEFAULT_SETTINGS)
        self.pinned: set[str] = set()
        # pack id -> the pack entry its last update replaced ({"id", "release", "bundled": True} for a bundled one)
        self.previous: dict[str, dict[str, Any]] = {}
        # pack id -> the result of its last check: {"checked_at", "latest_release"} or {"checked_at", "error"}
        self.checks: dict[str, dict[str, Any]] = {}
        self.last_check: float | None = None
        self._unsub: Callable[[], None] | None = None
        self._unsub_started: Callable[[], None] | None = None
        self._lock = asyncio.Lock()
        # one check round at a time; it holds `_lock` only to apply its results (#377)
        self._round = asyncio.Lock()
        # no check asks GitHub before this time (a rate limit, #377); None: no wait
        self.backoff_until: float | None = None
        # the pack index the Browse tab shows (#336), kept in memory for a while
        self.index = PackIndex(hass)

    async def async_load(self) -> None:
        stored = await self._store.async_load() or {}
        try:
            self.settings = {**DEFAULT_SETTINGS, **SETTINGS_SCHEMA(stored.get("settings") or {})}
        except vol.Invalid:
            self.settings = dict(DEFAULT_SETTINGS)
        self.pinned = {str(p) for p in stored.get("pinned") or []}
        self.previous = dict(stored.get("previous") or {})
        self.checks = dict(stored.get("checks") or {})
        self.last_check = stored.get("last_check")
        backoff = stored.get("backoff_until")
        self.backoff_until = float(backoff) if isinstance(backoff, (int, float)) else None
        if self._follow_moves():
            await self._async_save()

    def _follow_moves(self) -> bool:
        """Pins and rollback entries after items moved between packs (#110): a pin follows the items into their new
        packs; a retired pack (every item moved out, no longer installed) keeps no pin, rollback entry or check. Pins,
        rollback entries and checks under our packs' old ids (theovencook.*) go to the new ids (#424). Whether
        anything changed."""
        moves = self.data.moves
        installed = {p["id"] for p in with_bundled(self.data.bundled, self.data.packs)}
        retired = retired_packs(moves, installed)
        pinned = migrate_pins(self.pinned, moves, installed)
        previous = {
            renamed_pack_id(k): renamed_pack(v) if isinstance(v, dict) else v
            for k, v in self.previous.items()
            if renamed_pack_id(k) not in retired
        }
        checks = {renamed_pack_id(k): v for k, v in self.checks.items() if renamed_pack_id(k) not in retired}
        if (pinned, previous, checks) == (self.pinned, self.previous, self.checks):
            return False
        self.pinned, self.previous, self.checks = pinned, previous, checks
        return True

    async def async_forget_uninstalled(self) -> None:
        """After the packs were replaced (a backup, #153): pins, previous releases and checks of packs that are no
        longer installed go."""
        installed = {p["id"] for p in with_bundled(self.data.bundled, self.data.packs)}
        pinned = {p for p in self.pinned if p in installed}
        previous = {k: v for k, v in self.previous.items() if k in installed}
        checks = {k: v for k, v in self.checks.items() if k in installed}
        if (pinned, previous, checks) == (self.pinned, self.previous, self.checks):
            return
        self.pinned, self.previous, self.checks = pinned, previous, checks
        await self._async_save()

    async def _async_save(self) -> None:
        await self._store.async_save(
            {
                "settings": self.settings,
                "pinned": sorted(self.pinned),
                # copies: the JSON is written in the executor while a check may add to these (#176)
                "previous": dict(self.previous),
                "checks": dict(self.checks),
                "last_check": self.last_check,
                "backoff_until": self.backoff_until,
            }
        )

    # ------------------------------------------------------------------------ status and settings

    def _installed(self, pack_id: str) -> dict[str, Any] | None:
        """The pack the library offers under an id (an imported copy or the bundled one), not the custom items."""
        return next((p for p in with_bundled(self.data.bundled, self.data.packs) if p["id"] == pack_id), None)

    def status(self) -> dict[str, Any]:
        """The settings, every installed pack with its pin, previous release and last check, and the placed items
        with an update."""
        packs = []
        for pack in with_bundled(self.data.bundled, self.data.packs):
            previous = self.previous.get(pack["id"])
            packs.append(
                {
                    "id": pack["id"],
                    "release": pack.get("release", 1),
                    **({"note": pack["release_note"]} if pack.get("release_note") else {}),
                    "bundled": bool(pack.get("bundled")),
                    "pinned": pack["id"] in self.pinned,
                    # whether a check looks for new releases (installed from GitHub)
                    "checked": isinstance((pack.get("source") or {}).get("origin"), dict),
                    "previous_release": previous.get("release", 1) if previous else None,
                    **self.checks.get(pack["id"], {}),
                }
            )
        items = [{**item, "pinned": item["pack"] in self.pinned} for item in self._pending_everywhere()]
        backoff = self.backoff_until if (self.backoff_until or 0) > time.time() else None
        return {
            "settings": dict(self.settings),
            "last_check": self.last_check,
            # a rate limit: no check asks GitHub before then (#377)
            "backoff_until": backoff,
            "packs": packs,
            "items": items,
        }

    def _pending_everywhere(self) -> list[dict[str, Any]]:
        """The placed items with an update in any home (#164: the packs are shared, so an update is too): one entry
        per type, `placed` counted over every home, `release` the oldest copy and `homes` the homes that have one."""
        packs = self.data.offered_packs
        merged: dict[str, dict[str, Any]] = {}
        for home in self.data.homes.values():
            # a plan this Home 3D cannot read (#165) is never updated, so it lists nothing
            if home.read_only:
                continue
            for item in pending_items(home.building, packs):
                if (seen := merged.get(item["type"])) is None:
                    merged[item["type"]] = {**item, "homes": [home.id]}
                    continue
                seen["placed"] += item["placed"]
                seen["release"] = min(seen["release"], item["release"])
                seen["homes"].append(home.id)
        return [merged[type_] for type_ in sorted(merged)]

    async def async_set(self, changes: dict[str, Any]) -> None:
        """Change settings (checked by SETTINGS_SCHEMA); switching auto-update on applies the waiting updates."""
        self.settings = {**self.settings, **SETTINGS_SCHEMA(changes)}
        await self._async_save()
        self.schedule()
        await self.async_auto_update()

    async def async_index(self, *, refresh: bool = False) -> dict[str, Any]:
        """The pack index at the set URL (#336), fresh or kept; raises PackError ("offline" with nothing kept)."""
        return await self.index.async_get(index_url(self.settings["index_url"]), refresh=refresh)

    # ------------------------------------------------------------------------ placed items

    async def async_apply(self, types: list[str] | None, *, skip_pinned: bool = False) -> tuple[list[str], int]:
        """Update placed items (None: every one with an update) to the installed release in every home (#164); the
        updated types and the active plan's revision. Each home's change is worked out from its plan as it is once no
        save runs there (#149), so none is overwritten."""
        updated: set[str] = set()
        for home in list(self.data.homes.values()):
            updated.update(await self._async_apply_home(home, types, skip_pinned))
        return sorted(updated), self.data.revision

    async def _async_apply_home(self, home: Home, types: list[str] | None, skip_pinned: bool) -> list[str]:
        """Update one home's placed items (see async_apply); the types updated there."""
        updated: list[str] = []

        def change(building: dict[str, Any]) -> dict[str, Any] | None:
            nonlocal updated
            packs = self.data.offered_packs
            wanted = types
            if skip_pinned:
                wanted = [
                    p["type"]
                    for p in pending_items(building, packs)
                    if p["pack"] not in self.pinned and (types is None or p["type"] in types)
                ]
            new, updated = with_updates(building, packs, wanted)
            return new if updated else None

        await home.async_update_building(change)
        return updated

    async def async_auto_update(self) -> list[str]:
        """With auto-update on, update every placed item of a pack that is not pinned; the updated types."""
        if not self.settings["auto_update"]:
            return []
        updated, _revision = await self.async_apply(None, skip_pinned=True)
        return updated

    # ------------------------------------------------------------------------ installing

    async def async_install(self, payload: dict[str, Any], source: dict[str, Any], *, confirm: bool = False) -> None:
        """Install a checked pack (an import, a URL install or a check). When the library would then offer an older
        release than now, or another release of a pinned pack, it asks first: PackError("older_release" / "pinned")
        unless `confirm`. (An older copy of a bundled pack changes nothing: the bundled release stays offered.)"""
        # never in the middle of a check, which could put its release over this one (#47)
        async with self._lock:
            self._refuse_other_kind(payload)
            if not confirm and (asked := self._asks_first(payload, source.get("origin"))) is not None:
                raise asked
            await self._async_add(payload, source)
            # an install of the release a check found (or a later one) answers its "update available"
            check = self.checks.get(payload["id"])
            if check and check.get("available", {}).get("release", 0) <= payload.get("release", 1):
                del check["available"]
                check.pop("held", None)
                await self._async_save()
        await self.async_auto_update()

    def _refuse_other_kind(self, payload: dict[str, Any]) -> None:
        """Raises PackError("other_kind") when the library offers a pack of another kind under the payload's id: no
        confirmation lets a furniture pack replace a language pack, or the other way round (#372)."""
        current = self._installed(payload["id"])
        if current is not None and kind_of(current) != kind_of(payload):
            raise PackError(
                "other_kind",
                f'{payload["id"]} is installed as a {kind_of(current)} pack ("{current.get("name")}"), this is a '
                f"{kind_of(payload)} pack",
            )

    def _questions(self, payload: dict[str, Any], origin: dict[str, Any] | None) -> list[tuple[str, str]]:
        """What an install of this pack from `origin` (None: files) must be confirmed against, as (code, detail)."""
        current = self._installed(payload["id"])
        if current is None:
            return []
        asked: list[tuple[str, str]] = []
        installed = current.get("release", 1)
        after = self._offered_after(payload)
        new = after.get("release", 1)
        if new < installed:
            asked.append(
                (
                    "older_release",
                    f"release {payload.get('release', 1)} is older than the installed release {installed}",
                )
            )
        # the same release with other content, or from another place (#373): never in silently
        other = _differs(current, payload, origin) if after is payload and new == installed else None
        if payload["id"] in self.pinned and (new != installed or other):
            asked.append(
                ("pinned", f"{payload['id']} is pinned to release {installed}" + (f" ({other})" if other else ""))
            )
        # it takes the place of one of Home 3D's own packs (#372): the question names the pack it replaces
        what = f'"{current.get("name")}" ({current["id"]} release {installed} by {current.get("publisher")})'
        elsewhere = _origin_url(current) != (origin or {}).get("url")
        if after is payload and current.get("bundled"):
            asked.append(("replaces_bundled", f"it replaces {what}, which comes with Home 3D"))
        elif after is payload and is_reserved(current) and elsewhere:
            asked.append(("replaces_official", f"it replaces {what}, installed from {_origin_url(current) or 'files'}"))
        elif other and payload["id"] not in self.pinned:
            asked.append(("same_release", f"release {installed} of {payload['id']} is installed; {other}"))
        return asked

    def _asks_first(self, payload: dict[str, Any], origin: dict[str, Any] | None = None) -> PackError | None:
        """The question an install of this pack must be confirmed against (its detail names every reason), or None."""
        asked = self._questions(payload, origin)
        if not asked:
            return None
        return PackError(asked[0][0], "; ".join(detail for _code, detail in asked))

    def preview(self, payload: dict[str, Any], origin: dict[str, Any]) -> dict[str, Any]:
        """What installing this checked pack from GitHub would change (#189); nothing is written. Raises PackError for
        a pack no confirmation installs (#372)."""
        self._refuse_other_kind(payload)
        current = self._installed(payload["id"])
        warnings = [code for code, _detail in self._questions(payload, origin)]
        if current is not None and current.get("bundled") and current.get("publisher") != payload["publisher"]:
            # the id of a pack that ships with Home 3D, from another publisher
            warnings.append("bundled_publisher")
        return pack_preview(payload, origin, current, pinned=payload["id"] in self.pinned, warnings=warnings)

    async def _async_add(self, payload: dict[str, Any], source: dict[str, Any]) -> None:
        """Install a pack, keeping the release the library offered so far for a roll back."""
        current = self._installed(payload["id"])
        after = self._offered_after(payload)
        # another release, or the same one with other content or from another place (#373), can be rolled back
        if (
            current is not None
            and after is payload
            and (
                current.get("release", 1) != payload.get("release", 1)
                or _differs(current, payload, source.get("origin"))
            )
        ):
            if current.get("bundled"):
                self.previous[payload["id"]] = {
                    "id": current["id"],
                    "release": current.get("release", 1),
                    "bundled": True,
                }
            else:
                self.previous[payload["id"]] = current
            await self._async_save()
        await self.data.async_add_pack(payload, source)

    # ------------------------------------------------------------------------ restoring a backup (#376)

    def restore_plan(
        self, packs: list[dict[str, Any]]
    ) -> tuple[list[dict[str, Any]], dict[str, dict[str, Any]], list[dict[str, str]]]:
        """The checks an import makes, for a backup's checked packs (one per id): the packs to restore, the entries
        their restore replaces (kept for a roll back) and the packs skipped. A restore asks nothing, so what an
        import would ask about is skipped and listed instead: an older release than the library offers, or another
        release (or other content) of a pinned pack; so is a pack of another kind under the id. Nothing is written."""
        kept: list[dict[str, Any]] = []
        replaced: dict[str, dict[str, Any]] = {}
        skipped: list[dict[str, str]] = []
        for pack in packs:
            current = self._installed(pack["id"])
            if current is None:
                kept.append(pack)
                continue
            installed, after = current.get("release", 1), self._offered_after(pack)
            new = after.get("release", 1)
            origin = (pack.get("source") or {}).get("origin")
            differs = after is pack and (new != installed or _differs(current, pack, origin) is not None)
            if kind_of(current) != kind_of(pack):
                skipped.append({"id": pack["id"], "reason": "other_kind"})
            elif new < installed:
                skipped.append({"id": pack["id"], "reason": "older_release"})
            elif pack["id"] in self.pinned and differs:
                skipped.append({"id": pack["id"], "reason": "pinned"})
            else:
                kept.append(pack)
                if differs:
                    bundled = {"id": current["id"], "release": installed, "bundled": True}
                    replaced[pack["id"]] = bundled if current.get("bundled") else current
        return kept, replaced, skipped

    async def async_restored(self, replaced: dict[str, dict[str, Any]]) -> None:
        """After a backup's packs were restored (#376): the entries they replaced are kept for a roll back, and the
        last check of a replaced pack goes (it was about the release before)."""
        if not replaced:
            return
        for pack_id, entry in replaced.items():
            self.previous[pack_id] = entry
            self.checks.pop(pack_id, None)
        await self._async_save()

    def _offered_after(self, payload: dict[str, Any]) -> dict[str, Any]:
        """The pack the library would offer under the payload's id once it is installed."""
        imported = [p for p in self.data.packs if p["id"] != payload["id"]] + [payload]
        return next(p for p in with_bundled(self.data.bundled, imported) if p["id"] == payload["id"])

    # ------------------------------------------------------------------------ schedule

    def schedule(self) -> None:
        """(Re)start the scheduled check from the settings."""
        if self._unsub is not None:
            self._unsub()
            self._unsub = None
        if self.settings["frequency"] == "off":
            return
        hour, minute = (int(x) for x in self.settings["time"].split(":"))
        self._unsub = async_track_time_change(self.hass, self._scheduled, hour=hour, minute=minute, second=0)

    def start(self) -> None:
        """Start the scheduled check, and run a check missed while Home Assistant was down once it has started
        (#47): one was due since the last check, or none has run yet for a pack installed from GitHub."""
        self.stop()  # a second start never leaves the first one's catch-up listener behind (#190)
        self.schedule()

        @callback
        def catch_up(_hass: HomeAssistant) -> None:
            self._unsub_started = None
            due = last_due(self.settings, dt_util.now())
            if due is None:
                return
            if self.last_check is None:
                overdue = any(checked_origin((p.get("source") or {}).get("origin")) for p in self.data.packs)
            else:
                overdue = self.last_check < due.timestamp()
            if overdue:
                self.hass.async_create_background_task(self._async_scheduled_check(), "home_3d missed pack check")

        self._unsub_started = async_at_started(self.hass, catch_up)

    def stop(self) -> None:
        """Stop the scheduled check (unloading)."""
        if self._unsub is not None:
            self._unsub()
            self._unsub = None
        if self._unsub_started is not None:
            self._unsub_started()
            self._unsub_started = None

    @callback
    def _scheduled(self, now: datetime) -> None:
        """The time of the check: daily, weekly on the set day, monthly on the 1st."""
        frequency = self.settings["frequency"]
        if (frequency == "weekly" and now.weekday() != self.settings["weekday"]) or (
            frequency == "monthly" and now.day != 1
        ):
            return
        self.hass.async_create_background_task(self._async_scheduled_check(), "home_3d pack update check")

    async def _async_scheduled_check(self) -> None:
        try:
            await self.async_check()
        except Exception:
            _LOGGER.exception("The scheduled pack update check failed")

    # ------------------------------------------------------------------------ checking

    async def async_check(self) -> dict[str, Any]:
        """Check every pack installed from GitHub that is not pinned: a higher release of the pack at its ref is
        installed into the library (placed items follow only with auto-update on). The answer names the packs that
        were installed and the placed items auto-update updated.

        GitHub is asked without the lock (#377): an import, a removal or a roll back never waits for the network. The
        lock is taken only to apply the results, and a pack that changed meanwhile (an import, a roll back, a pin)
        keeps what it got. A rate limit (403 / 429) ends the round: the rest are not asked, and no check runs until
        the time GitHub names (or an hour). A pack whose check fails unexpectedly is logged and reported; the
        round's results are saved either way."""
        async with self._round:
            if self.backoff_until is not None and time.time() < self.backoff_until:
                _LOGGER.info("Pack update check skipped: GitHub asked to wait until %s", self.backoff_until)
                return {"installed": [], "updated": [], "backoff_until": self.backoff_until}
            todo = [
                (pack, origin)
                for pack in list(self.data.packs)
                if (origin := checked_origin((pack.get("source") or {}).get("origin"))) is not None
                and pack["id"] not in self.pinned
            ]
            found: list[_Found] = []
            for pack, origin in todo:
                result: dict[str, Any] = {"checked_at": time.time()}
                new: tuple[dict[str, Any], dict[str, Any]] | None = None
                try:
                    new = await self._async_check_pack(pack, origin, result)
                except RateLimited as err:
                    _LOGGER.warning("GitHub rate limit: pack update checks wait until %s", err.retry_at)
                    result["error"] = f"{err.code}: {err.detail}"
                    self.backoff_until = err.retry_at
                    found.append((pack, result, None))
                    break
                except PackError as err:
                    _LOGGER.info("Update check of pack %s failed: %s", pack["id"], err)
                    result["error"] = f"{err.code}: {err.detail}" if err.detail else err.code
                except Exception as err:
                    _LOGGER.exception("Update check of pack %s failed unexpectedly", pack["id"])
                    result["error"] = f"unexpected: {type(err).__name__}"
                found.append((pack, result, new))
            installed = await self._async_apply_round(found)
        updated = await self.async_auto_update()
        return {"installed": installed, "updated": updated}

    async def _async_apply_round(self, found: list[_Found]) -> list[str]:
        """Apply a round's results under the lock (#377): record each check, install the releases found unless the
        pack changed meanwhile, and save; the ids installed."""
        installed: list[str] = []
        async with self._lock:
            try:
                for pack, result, new in found:
                    current = next((p for p in self.data.packs if p["id"] == pack["id"]), None)
                    if current is None:
                        # removed meanwhile: its check goes with it
                        continue
                    # an import, a roll back or a pin that came first stays: nothing found is applied over it
                    if new is not None and current is pack and pack["id"] not in self.pinned:
                        try:
                            await self._async_add(*new)
                            installed.append(pack["id"])
                        except Exception as err:
                            _LOGGER.exception("Installing release %s of pack %s failed", new[0]["release"], pack["id"])
                            result["error"] = f"unexpected: {type(err).__name__}"
                    self.checks[pack["id"]] = result
            finally:
                # the checks of packs removed since are dropped (#47); what the round found is kept either way
                self.checks = {k: v for k, v in self.checks.items() if any(p["id"] == k for p in self.data.packs)}
                self.last_check = time.time()
                await self._async_save()
        return installed

    async def _async_check_pack(
        self, pack: dict[str, Any], origin: dict[str, Any], result: dict[str, Any]
    ) -> tuple[dict[str, Any], dict[str, Any]] | None:
        """Check one pack (network only, nothing is written): the newer release to install with its source, or None
        (with auto-update off it is only recorded as available). Raises PackError."""
        release = pack.get("release", 1)
        commit, pack_json = await latest_release(self.hass, origin)
        # a pack installed from the old account still says theovencook.* in its pack.json (#424)
        if pack_json is not None and renamed_pack_id(str(pack_json["id"])) != pack["id"]:
            raise PackError("not_a_pack", f"the folder now holds the pack {pack_json['id']}")
        latest = pack_json["release"] if pack_json is not None else release
        result["latest_release"] = latest
        if latest <= release:
            # nothing newer for this pack (a check never installs an older release)
            return None
        if not self.settings["auto_update"]:
            # updates are opt-in (#189): the check only records that one is waiting; an editor looks at what it
            # changes and installs it (nothing is downloaded here, only the pack.json was read)
            note = pack_json.get("release_note") if pack_json is not None else None
            result["available"] = {"release": latest, "commit": commit, **({"note": note} if note else {})}
            return None
        files, new_origin = await fetch_pack(self.hass, origin["url"])
        # a large pack takes a while to check: not in the event loop (#176)
        payload, source = await self.hass.async_add_executor_job(checked_folder, files)
        official_only(not_reserved(payload), new_origin)
        if payload["id"] != pack["id"] or payload["release"] <= release:
            return None
        if (held := self._held(pack, payload)) is not None:
            # a release that changes what the pack is, or takes away placed items, waits for an editor (#373)
            note = payload.get("release_note")
            result["available"] = {"release": payload["release"], "commit": new_origin["commit"]}
            result["available"].update({"note": note} if note else {})
            result["held"] = held
            _LOGGER.info("Release %s of pack %s waits for an editor: %s", payload["release"], pack["id"], held)
            return None
        result["latest_release"] = payload["release"]
        return payload, {**source, "origin": {**new_origin, "release": payload["release"]}}

    def _held(self, pack: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any] | None:
        """Why auto-update leaves a new release of an installed pack to an editor, or None (#373): it changes the
        pack's kind or publisher, or removes items that are placed in a home."""
        if kind_of(payload) != kind_of(pack):
            return {"reason": "kind", "from": kind_of(pack), "to": kind_of(payload)}
        if payload.get("publisher") != pack.get("publisher"):
            return {"reason": "publisher", "from": pack.get("publisher"), "to": payload.get("publisher")}
        kept = {item["id"] for item in payload.get("items", [])}
        prefix = f"{PACK_TYPE_PREFIX}{pack['id']}:"
        placed = {type_ for home in self.data.homes.values() for type_ in placed_types(home.building)}
        removed = sorted(
            item["id"] for item in pack.get("items", []) if item["id"] not in kept and prefix + item["id"] in placed
        )
        return {"reason": "removes_placed", "items": removed} if removed else None

    async def async_pin(self, pack_id: str, pinned: bool) -> None:
        """Pin a pack to its installed release, or unpin it (auto-update then catches up); raises PackError."""
        if self._installed(pack_id) is None:
            raise PackError("not_found", f"{pack_id} is not installed")
        if pinned:
            self.pinned.add(pack_id)
        else:
            self.pinned.discard(pack_id)
        await self._async_save()
        if not pinned:
            await self.async_auto_update()

    async def async_remove(self, pack_id: str) -> bool:
        """Remove an imported pack and forget its pin, its previous release and its last check (#164), so the same
        pack installed again starts afresh; whether a pack was removed. Removing an imported copy of a bundled pack
        brings the bundled release back, which auto-update then applies like any other new release."""
        # never in the middle of a check, which could install the pack again
        async with self._lock:
            if not await self.data.async_remove_pack(pack_id):
                return False
            if pack_id in self.pinned or pack_id in self.previous or pack_id in self.checks:
                self.pinned.discard(pack_id)
                self.previous.pop(pack_id, None)
                self.checks.pop(pack_id, None)
                await self._async_save()
        await self.async_auto_update()
        return True

    async def async_rollback(self, pack_id: str) -> dict[str, Any]:
        """Put back the release a pack had before its last update, with the placed items that had taken that update
        in every home (#164), and pin the pack to it; raises PackError. The answer names the release now installed."""
        # never in the middle of a check, which could install over the release put back (#47)
        async with self._lock:
            current = self._installed(pack_id)
            previous = self.previous.get(pack_id)
            if current is None or previous is None:
                raise PackError("no_previous", f"{pack_id} has no earlier release to go back to")
            # the copies that show the release being rolled back: of its own items, by item id (worked out once for
            # the items placed in some home) ...
            current_items = {i["id"]: i for i in current["items"]}
            took_hashes: dict[str, str] = {}

            def shows_current(item_id: str, hash_: str | None) -> bool:
                if item_id not in current_items:
                    return False
                if item_id not in took_hashes:
                    took_hashes[item_id] = recipe_copy(current, current_items[item_id])["hash"]
                return took_hashes[item_id] == hash_

            # ... and of the items that moved out of the pack since (#110), by their new type
            moved_hashes = {
                type_: (item_id, moved_copy(recipe_copy(current, current_items[item_id]), type_)["hash"])
                for type_, item_id in moved_out_of(pack_id, self.data.moves).items()
                if item_id in current_items
            }
            if previous.get("bundled"):
                # the bundled release comes back once the imported copy is gone
                await self.data.async_remove_pack(pack_id)
            else:
                payload = {k: v for k, v in previous.items() if k not in ("imported_at", "source")}
                await self.data.async_add_pack(payload, previous.get("source"))
            del self.previous[pack_id]
            self.pinned.add(pack_id)
            await self._async_save()
            restored = self._installed(pack_id)
            release = restored.get("release", 1) if restored else previous.get("release", 1)
            if restored is not None:
                installed = installed_copies([restored])
                restored_items = {i["id"]: i for i in restored["items"]}

                # on each home's plan as it is once no save runs there (#149)
                def change(building: dict[str, Any]) -> dict[str, Any] | None:
                    recipes = building.get("recipes") or {}
                    new = dict(recipes)
                    for type_, copy_ in recipes.items():
                        took = copy_["pack"] == pack_id and shows_current(copy_["item"], copy_.get("hash"))
                        if took and type_ in installed:
                            new[type_] = recipe_copy(*installed[type_])
                        moved = moved_hashes.get(type_)
                        if moved is not None and moved[1] == copy_.get("hash") and moved[0] in restored_items:
                            new[type_] = moved_copy(recipe_copy(restored, restored_items[moved[0]]), type_)
                    return {**building, "recipes": new} if new != recipes else None

                for home in list(self.data.homes.values()):
                    await home.async_update_building(change)
        return {"release": release}
