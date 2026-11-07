"""Websocket commands used by the panel, the card and the editor."""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from functools import partial, wraps
import logging
import time
from typing import Any

from homeassistant.components import websocket_api
from homeassistant.core import HomeAssistant, callback
from homeassistant.exceptions import Unauthorized
from homeassistant.helpers.dispatcher import async_dispatcher_connect
from homeassistant.loader import async_get_integration
import voluptuous as vol
from voluptuous.humanize import humanize_error

from . import frontend_build
from .backup_restore import StagedPacks, resolve_backup_items
from .const import (
    DATA_ASK,
    DATA_EDITORS,
    DATA_PACK_UPDATES,
    DATA_PETS,
    DATA_VOICE,
    DOMAIN,
    PROTOCOL,
    SIGNAL_BUILDING_UPDATED,
    SIGNAL_HOMES_UPDATED,
    SIGNAL_PETS_UPDATED,
)
from .custom_items import not_reserved
from .editors import Editors, EditorsError, action_owner, can_edit, performed_actions
from .locate.recorder import ws_locate_rec
from .locate.ws import COMMANDS as LOCATE_COMMANDS
from .pack_github import checked_origin, fetch_pack
from .pack_updates import SETTINGS_FIELDS, PackUpdates
from .packs import (
    MAX_ITEMS,
    MAX_PACK_SIZE,
    PackError,
    checked_file,
    checked_folder,
    checked_source,
    is_bundled,
    is_language_pack,
    official_only,
    verify_item,
)
from .racks import RackError
from .sample import SAMPLE_NAME, load_sample
from .schema import BUILDING_SCHEMA, IMAGE_DATA
from .storage import FloorplanData, Home, HomesError, PlanReadOnly, RevisionConflict, check_plan
from .timetravel import ws_timetravel_history
from .voice import SENTENCE_MODES, AskBroker, VoiceSettings, subscribe_view

_LOGGER = logging.getLogger(__name__)

_IMAGE_ID = vol.All(str, vol.Length(min=1, max=64), vol.Match(r"^[A-Za-z0-9_\-.]+$"))
# a home (#53): commands about one plan take it optionally; without it they work on the active home
_HOME_ID = vol.All(str, vol.Length(min=1, max=32), vol.Match(r"^[A-Za-z0-9_]+$"))
_HOME: dict[Any, Any] = {vol.Optional("home_id"): _HOME_ID}
_HOME_NAME = vol.All(str, vol.Strip, vol.Length(min=1, max=60))


@callback
def async_register_commands(hass: HomeAssistant) -> None:
    """Register all websocket commands."""
    for command in (
        ws_get_building,
        ws_version,
        ws_save_building,
        ws_subscribe_building,
        ws_get_image,
        ws_set_image,
        ws_delete_image,
        ws_history_list,
        ws_history_snapshot,
        ws_history_restore,
        ws_packs_list,
        ws_packs_items,
        ws_packs_import,
        ws_packs_install_url,
        ws_packs_preview_url,
        ws_packs_remove,
        ws_packs_updates,
        ws_packs_updates_settings,
        ws_packs_update_items,
        ws_packs_check,
        ws_packs_pin,
        ws_packs_rollback,
        ws_packs_index,
        ws_languages_get,
        ws_items_save,
        ws_items_remove,
        ws_backup_export,
        ws_backup_stage,
        ws_backup_import,
        ws_timetravel_history,
        ws_voice_subscribe,
        ws_voice_answer,
        ws_voice_settings,
        ws_voice_settings_set,
        ws_locate_rec,
        ws_editors_get,
        ws_editors_set,
        ws_homes_list,
        ws_homes_create,
        ws_homes_load_sample,
        ws_homes_rename,
        ws_homes_duplicate,
        ws_homes_delete,
        ws_homes_set_active,
        ws_pets_subscribe,
    ):
        websocket_api.async_register_command(hass, command)
    for command in LOCATE_COMMANDS:
        websocket_api.async_register_command(hass, command)


# editors' commands sent over and over while editing: logged at debug, the rest at info (#188)
_FREQUENT = frozenset({"home_3d/building/save", "home_3d/image/set", "home_3d/image/delete"})
# what a command names, to say what it changed in the log (never the plan, an item or an image itself)
_NAMED = ("home_id", "pack_id", "item_id", "snapshot_id", "image_id", "url")


def audit(
    connection: websocket_api.ActiveConnection, msg: dict[str, Any], what: str | None = None, level: int | None = None
) -> None:
    """Log who changed what (#188): the user's name and id, the command and what it names."""
    user = connection.user
    named = ", ".join(f"{key} {msg[key]}" for key in _NAMED if isinstance(msg.get(key), str))
    detail = f" ({named})" if named else ""
    if level is None:
        level = logging.DEBUG if what is None and msg["type"] in _FREQUENT else logging.INFO
    _LOGGER.log(level, "%s (%s) %s%s", user.name or "unknown user", user.id, what or msg["type"], detail)


def require_editor(func: Callable[..., Any]) -> Callable[..., Any]:
    """Like `require_admin`, for the editors list (#7): anyone else is refused with "unauthorized".

    Every call by an editor is logged with the user (#188); a refused one is logged as a warning."""

    @wraps(func)
    def with_editor(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
        if not can_edit(hass, connection.user):
            audit(connection, msg, f"was refused {msg['type']}, not an editor", logging.WARNING)
            raise Unauthorized
        audit(connection, msg)
        func(hass, connection, msg)

    return with_editor


class _NeedsAdmin(Exception):
    """A save that adds or changes an item's perform action, from someone who is no admin (#51)."""

    def __init__(self, owner: str = "") -> None:
        super().__init__(owner)
        self.owner = owner


def _data(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> FloorplanData | None:
    data: FloorplanData | None = hass.data.get(DOMAIN)
    if data is None:
        connection.send_error(msg["id"], "not_loaded", "Home 3D is not set up")
    return data


def _home(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> Home | None:
    """The home a command names (`home_id`), else the active one; an unknown id is answered with an error."""
    if (data := _data(hass, connection, msg)) is None:
        return None
    home = data.home(msg.get("home_id"))
    if home is None:
        connection.send_error(msg["id"], "home_not_found", "There is no such home")
    return home


@websocket_api.websocket_command({vol.Required("type"): "home_3d/building/get", **_HOME})
@websocket_api.async_response
async def ws_get_building(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Return the building, its revision, the running integration version and whether the user may edit.

    The frontend compares the version with its own: after an update the new frontend files are served
    at once, but the backend (and its validation) only changes with a restart.
    """
    if (home := _home(hass, connection, msg)) is None:
        return
    integration = await async_get_integration(hass, DOMAIN)
    # what is wrong with the stored plan (#165): one this Home 3D cannot read is shown read-only
    problem = {"problem": home.problem} if home.problem is not None else {}
    connection.send_result(
        msg["id"],
        {
            "building": home.building,
            "revision": home.revision,
            # which home this is (#53): a client saves back to it, whichever home is active by then
            "home_id": home.id,
            "home_name": home.name,
            "version": str(integration.version),
            # which commands it understands (#166, const.PROTOCOL)
            "protocol": PROTOCOL,
            # whether this user is on the editors list (#7); the backend checks every change again
            "can_edit": can_edit(hass, connection.user) and not home.read_only,
            **problem,
            **await _async_build(hass),
        },
    )


async def _async_build(hass: HomeAssistant) -> dict[str, str]:
    """`{"build": id}` of the frontend files served now (#60), empty without a build file."""
    build = await hass.async_add_executor_job(frontend_build.read_build)
    return {"build": build} if build else {}


@websocket_api.websocket_command({vol.Required("type"): "home_3d/version"})
@websocket_api.async_response
async def ws_version(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """The running integration version and the frontend build on disk (#60): an open page asks again when its
    websocket reconnects and offers a reload when it runs older JavaScript."""
    integration = await async_get_integration(hass, DOMAIN)
    connection.send_result(
        msg["id"], {"version": str(integration.version), "protocol": PROTOCOL, **await _async_build(hass)}
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/building/save",
        **_HOME,
        # checked against BUILDING_SCHEMA in the handler, in the executor (#176): on a large plan that takes tens of
        # milliseconds, and an editor saves about every second
        vol.Required("building"): dict,
        # the hashes of the recipe copies the client started from (#45), by pack item type
        vol.Optional("recipe_bases"): vol.All({str: vol.All(str, vol.Length(max=100))}, vol.Length(max=2000)),
        # the revision the client's plan started from (#149): a save from an out-of-date plan is refused
        vol.Optional("base_revision"): vol.All(int, vol.Range(min=0)),
    }
)
@require_editor
@websocket_api.async_response
async def ws_save_building(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Replace the building. A new or changed `perform_action` item action or service/event menu button needs
    an admin (#51, #151). With `base_revision` (#149) a save from a plan that someone else changed since is refused
    with "conflict" and changes nothing: the client then fetches the current plan (building/get) to merge or offer a
    reload."""
    if (home := _home(hass, connection, msg)) is None:
        return
    try:
        building = await hass.async_add_executor_job(BUILDING_SCHEMA, msg["building"])
    except vol.Invalid as err:
        connection.send_error(
            msg["id"],
            websocket_api.ERR_INVALID_FORMAT,
            f"Message incorrectly formatted: {humanize_error(msg['building'], err)} for building",
        )
        return

    changed_actions: list[bool] = []

    def guard(current: dict[str, Any]) -> None:
        # checked against the plan as it is when the save runs, not as it was when the message came
        added = performed_actions(building) - performed_actions(current)
        changed_actions[:] = [bool(added or performed_actions(current) - performed_actions(building))]
        if not connection.user.is_admin and added:
            raise _NeedsAdmin(action_owner(building, min(added)))

    try:
        revision = await home.async_save_building(
            building,
            msg.get("recipe_bases"),
            check_racks=True,
            base_revision=msg.get("base_revision"),
            guard=guard,
        )
    except _NeedsAdmin as err:
        # names the first such item (#383), so the editor can find and fix it
        connection.send_error(
            msg["id"],
            "unauthorized",
            "Only an admin adds or changes a perform action or a service/event button"
            + (f": {err.owner}" if err.owner else ""),
        )
        return
    except RevisionConflict as err:
        connection.send_error(msg["id"], "conflict", str(err))
        return
    except PlanReadOnly as err:
        # the stored plan is one this Home 3D cannot read (#165): never written over by a save
        connection.send_error(msg["id"], "read_only", str(err))
        return
    except HomesError as err:
        # the home was deleted while the save waited (#167)
        connection.send_error(msg["id"], err.code, err.detail)
        return
    except RackError as err:
        # rack gear where it does not fit (#113): the editor refuses it too, so only an outdated or foreign client
        connection.send_error(msg["id"], "invalid_rack", str(err))
        return
    if any(changed_actions):
        # a button or action that runs any Home Assistant action changed (#188): saves are too frequent to log
        # each, but this one says who
        audit(connection, msg, f"changed the actions or buttons of home {home.id}, revision {revision}, in")
    # the plan's recipe copies as stored (#2): an open editor keeps them with its plan
    connection.send_result(
        msg["id"], {"revision": revision, "home_id": home.id, "recipes": home.building.get("recipes", {})}
    )


@websocket_api.websocket_command({vol.Required("type"): "home_3d/building/subscribe", **_HOME})
@callback
def ws_subscribe_building(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Send the new revision (and the home's id) whenever the building changes. Without a home this follows the
    active home: when another home becomes active, its revision is sent at once. The current revision also comes once
    right after subscribing (#149), so a view whose websocket reconnects learns whether it is behind."""
    if (home := _home(hass, connection, msg)) is None:
        return
    named = msg.get("home_id")
    followed = [home.id]

    def send(home_id: str, revision: int) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], {"revision": revision, "home_id": home_id}))

    @callback
    def forward(home_id: str, revision: int) -> None:
        if home_id == followed[0]:
            send(home_id, revision)

    @callback
    def homes_changed() -> None:
        # looked up each time: the subscription outlives a reload of the integration (#190)
        if (data := hass.data.get(DOMAIN)) is None:
            return
        if named is None and data.active_id != followed[0] and data.active_id in data.homes:
            followed[0] = data.active_id
            send(data.active_id, data.active.revision)

    unsubs = [
        async_dispatcher_connect(hass, SIGNAL_BUILDING_UPDATED, forward),
        async_dispatcher_connect(hass, SIGNAL_HOMES_UPDATED, homes_changed),
    ]

    @callback
    def unsubscribe() -> None:
        for unsub in unsubs:
            unsub()

    connection.subscriptions[msg["id"]] = unsubscribe
    connection.send_result(msg["id"])
    send(home.id, home.revision)


@websocket_api.websocket_command(
    {vol.Required("type"): "home_3d/image/get", **_HOME, vol.Required("image_id"): _IMAGE_ID}
)
@callback
def ws_get_image(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Return a background image as data URL."""
    if (home := _home(hass, connection, msg)) is None:
        return
    image = home.get_image(msg["image_id"])
    if image is None:
        connection.send_error(msg["id"], "not_found", "Image not found")
        return
    connection.send_result(msg["id"], {"data": image})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/image/set",
        **_HOME,
        vol.Required("image_id"): _IMAGE_ID,
        vol.Required("data"): IMAGE_DATA,
    }
)
@require_editor
@websocket_api.async_response
async def ws_set_image(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Store a background image."""
    if (home := _home(hass, connection, msg)) is None:
        return
    try:
        await home.async_set_image(msg["image_id"], msg["data"])
    except HomesError as err:
        # the home was deleted meanwhile, or it holds as many pictures as it may (#364)
        connection.send_error(msg["id"], err.code, err.detail)
        return
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {vol.Required("type"): "home_3d/image/delete", **_HOME, vol.Required("image_id"): _IMAGE_ID}
)
@require_editor
@websocket_api.async_response
async def ws_delete_image(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Remove a background image."""
    if (home := _home(hass, connection, msg)) is None:
        return
    try:
        await home.async_delete_image(msg["image_id"])
    except HomesError as err:
        # the home was deleted meanwhile, or it holds as many pictures as it may (#364)
        connection.send_error(msg["id"], err.code, err.detail)
        return
    connection.send_result(msg["id"])


@websocket_api.websocket_command({vol.Required("type"): "home_3d/history/list", **_HOME})
@require_editor
@callback
def ws_history_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """List the restore points (newest first)."""
    if (home := _home(hass, connection, msg)) is None:
        return
    connection.send_result(msg["id"], {"snapshots": home.history()})


@websocket_api.websocket_command({vol.Required("type"): "home_3d/history/snapshot", **_HOME})
@require_editor
@websocket_api.async_response
async def ws_history_snapshot(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Keep the current building as a restore point (e.g. before an import)."""
    if (home := _home(hass, connection, msg)) is None:
        return
    await home.async_snapshot()
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {vol.Required("type"): "home_3d/history/restore", **_HOME, vol.Required("snapshot_id"): _IMAGE_ID}
)
@websocket_api.require_admin
@require_editor
@websocket_api.async_response
async def ws_history_restore(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Go back to a restore point; the current state becomes a restore point itself. A picture the restore point
    names that is no longer kept (#154) stays named in the plan but shows nothing: `missing_pictures` counts them."""
    if (home := _home(hass, connection, msg)) is None:
        return
    point = home.snapshot(msg["snapshot_id"])
    if point is None:
        connection.send_error(msg["id"], "not_found", "Restore point not found")
        return
    # a restore point holds an older plan: brought to the current version and checked like a stored one (#165), in
    # the executor (#176)
    checked: tuple[dict[str, Any], dict[str, Any] | None] = await hass.async_add_executor_job(check_plan, point)
    building, problem = checked
    if problem is not None and problem["code"] != "plan_repaired":
        connection.send_error(msg["id"], "invalid_format", problem["message"])
        return
    missing = home.missing_images(building)
    try:
        revision = await home.async_restore(building)
    except HomesError as err:
        connection.send_error(msg["id"], err.code, err.detail)
        return
    connection.send_result(msg["id"], {"revision": revision, "missing_pictures": len(missing)})


@websocket_api.websocket_command({vol.Required("type"): "home_3d/packs/list"})
@callback
def ws_packs_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Return the bundled and the imported furniture packs in their light form (#44): an index of the items, enough to
    browse and search the library. The recipes come with `packs/items`; placed items draw from the plan's copies."""
    if (data := _data(hass, connection, msg)) is None:
        return
    connection.send_result(msg["id"], {"packs": data.library})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/packs/items",
        vol.Required("pack_id"): vol.All(str, vol.Length(max=64)),
        # the ids of the items wanted; without them every item of the pack
        vol.Optional("items"): vol.All([vol.All(str, vol.Length(max=40))], vol.Length(max=MAX_ITEMS)),
    }
)
@callback
def ws_packs_items(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """The recipes of a pack's items, on demand (#44), with the pack's hash and release: a browser keeps them while
    the hash stays. Ids the pack does not have are left out."""
    if (data := _data(hass, connection, msg)) is None:
        return
    pack = next((p for p in data.offered_packs if p["id"] == msg["pack_id"]), None)
    if pack is None:
        connection.send_error(msg["id"], "not_found", "Pack not found")
        return
    listed = next(p for p in data.library if p["id"] == pack["id"])
    wanted = set(msg["items"]) if "items" in msg else None
    items = [item for item in pack["items"] if wanted is None or item["id"] in wanted]
    result = {"pack_id": pack["id"], "release": pack.get("release", 1), "hash": listed["hash"], "items": items}
    connection.send_result(msg["id"], result)


def _language_fields(payload: dict[str, Any]) -> dict[str, Any]:
    """What an import result says of a language pack (#196): its language and how many texts it has."""
    if not is_language_pack(payload):
        return {}
    return {"kind": "language", "language": payload["language"], "texts": len(payload["strings"])}


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/packs/import",
        # an old single-file pack ...
        vol.Exclusive("pack", "source"): vol.All(str, vol.Length(max=MAX_PACK_SIZE)),
        # ... or a v2 pack folder: relative path -> file text (packs.py checks names, count and sizes)
        vol.Exclusive("files", "source"): {str: str},
        # an older release than the installed one, or another release of a pinned pack, was confirmed (#26)
        vol.Optional("confirm", default=False): bool,
    }
)
@require_editor
@websocket_api.async_response
async def ws_packs_import(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Check a pack's content, then keep it with its source (a backup carries the source and checks it again)."""
    if _data(hass, connection, msg) is None or (updates := _updates(hass, connection, msg)) is None:
        return
    try:
        # a large pack takes a while to check: not in the event loop (#176)
        if "files" in msg:
            payload, source = await hass.async_add_executor_job(checked_folder, msg["files"])
        elif "pack" in msg:
            payload, source = await hass.async_add_executor_job(checked_file, msg["pack"])
        else:
            raise PackError("not_a_pack", "send a pack file or a pack folder")
        # files are no official source: Home 3D's own ids and publisher come only from its GitHub account (#372)
        official_only(not_reserved(payload), None)
        await updates.async_install(payload, source, confirm=msg["confirm"])
    except PackError as err:
        connection.send_error(msg["id"], err.code, err.detail or err.code)
        return
    result = {
        "id": payload["id"],
        "name": payload["name"],
        "publisher": payload["publisher"],
        "licence": payload["licence"],
        "items": len(payload["items"]),
        **_language_fields(payload),
    }
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/packs/install_url",
        vol.Required("url"): vol.All(str, vol.Length(min=1, max=500)),
        vol.Optional("confirm", default=False): bool,
        # the commit a preview showed (#189): installed only if the ref still points there
        vol.Optional("commit"): vol.All(str, vol.Match(r"^[0-9a-f]{40}$")),
        # the pack id the index lists for this URL (#372): installed only if the URL holds that pack
        vol.Optional("pack_id"): vol.All(str, vol.Length(max=64)),
    }
)
@require_editor
@websocket_api.async_response
async def ws_packs_install_url(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Install a pack from a GitHub URL (#25): Home Assistant fetches it, checks it like a folder import and keeps
    where it came from (`source.origin`) for update checks."""
    if _data(hass, connection, msg) is None or (updates := _updates(hass, connection, msg)) is None:
        return
    try:
        files, origin = await fetch_pack(hass, msg["url"])
        if "commit" in msg and origin["commit"] != msg["commit"]:
            raise PackError("changed_since_preview", "the pack changed since the preview; look at the changes again")
        # checked in the executor (#176)
        payload, source = await hass.async_add_executor_job(checked_folder, files)
        _listed_as(official_only(not_reserved(payload), origin), msg.get("pack_id"))
        source = {**source, "origin": {**origin, "release": payload["release"]}}
        await updates.async_install(payload, source, confirm=msg["confirm"])
    except PackError as err:
        connection.send_error(msg["id"], err.code, err.detail or err.code)
        return
    result = {
        "id": payload["id"],
        "name": payload["name"],
        "publisher": payload["publisher"],
        "licence": payload["licence"],
        "items": len(payload["items"]),
        **_language_fields(payload),
        "origin": source["origin"],
    }
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/packs/preview_url",
        vol.Required("url"): vol.All(str, vol.Length(min=1, max=500)),
        vol.Optional("pack_id"): vol.All(str, vol.Length(max=64)),
    }
)
@require_editor
@websocket_api.async_response
async def ws_packs_preview_url(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """What installing (or updating to) the pack at a GitHub URL would change (#189): the repository and commit, the
    installed release and the items added, changed and removed. Nothing is installed; `install_url` with the
    previewed `commit` installs exactly this."""
    if _data(hass, connection, msg) is None or (updates := _updates(hass, connection, msg)) is None:
        return
    try:
        files, origin = await fetch_pack(hass, msg["url"])
        payload, _source = await hass.async_add_executor_job(checked_folder, files)
        _listed_as(official_only(not_reserved(payload), origin), msg.get("pack_id"))
        preview = updates.preview(payload, origin)
    except PackError as err:
        connection.send_error(msg["id"], err.code, err.detail or err.code)
        return
    connection.send_result(msg["id"], preview)


def _listed_as(payload: dict[str, Any], pack_id: str | None) -> None:
    """Raises PackError("id_mismatch") when the pack at an index entry's URL is not the pack the entry names (#372)."""
    if pack_id is not None and payload["id"] != pack_id:
        raise PackError("id_mismatch", f"the list names {pack_id}, the URL holds {payload['id']}")


@websocket_api.websocket_command(
    {vol.Required("type"): "home_3d/packs/remove", vol.Required("pack_id"): vol.All(str, vol.Length(max=64))}
)
@require_editor
@websocket_api.async_response
async def ws_packs_remove(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Remove an imported pack (a bundled pack comes with Home 3D and stays; removing an imported copy of it brings
    the bundled one back). Its pin, previous release and last check go with it (#164)."""
    if (data := _data(hass, connection, msg)) is None or (updates := _updates(hass, connection, msg)) is None:
        return
    if not await updates.async_remove(msg["pack_id"]):
        if is_bundled(data.bundled, msg["pack_id"]):
            connection.send_error(msg["id"], "bundled", "This pack comes with Home 3D and cannot be removed")
            return
        connection.send_error(msg["id"], "not_found", "Pack not found")
        return
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/languages/get",
        # a base language code, as Home Assistant's language starts ("de" of "de-AT")
        vol.Required("language"): vol.All(str, vol.Match(r"^[a-z]{2,3}$")),
        # the hash of the texts the page already has: when they are still the same, they are not sent again
        vol.Optional("hash"): vol.All(str, vol.Length(max=80)),
    }
)
@callback
def ws_languages_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """The texts of a language from the language packs (#196), for anyone who sees Home 3D (a wall tablet, a card).
    The page keeps them by their hash; a key no pack has shows in English."""
    if (data := _data(hass, connection, msg)) is None:
        return
    result = data.language(msg["language"])
    if msg.get("hash") == result["hash"]:
        result = {key: value for key, value in result.items() if key != "strings"}
    connection.send_result(msg["id"], result)


# ---------------------------------------------------------------------------- pack updates (#26)


def _updates(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> PackUpdates | None:
    updates: PackUpdates | None = hass.data.get(DATA_PACK_UPDATES)
    if updates is None:
        connection.send_error(msg["id"], "not_loaded", "Home 3D is not set up")
    return updates


@websocket_api.websocket_command({vol.Required("type"): "home_3d/packs/updates"})
@callback
def ws_packs_updates(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """The update settings, the installed packs (pinned, previous release, last check) and the placed items with an
    update."""
    if (updates := _updates(hass, connection, msg)) is not None:
        connection.send_result(msg["id"], updates.status())


@websocket_api.websocket_command({vol.Required("type"): "home_3d/packs/updates/settings", **SETTINGS_FIELDS})
@require_editor
@websocket_api.async_response
async def ws_packs_updates_settings(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Change the update settings: auto-update, and how often and when packs are checked."""
    if (updates := _updates(hass, connection, msg)) is None:
        return
    await updates.async_set({k: v for k, v in msg.items() if k not in ("id", "type")})
    connection.send_result(msg["id"], updates.status())


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/packs/update_items",
        # the furniture types to update; left out: every placed item with an update
        vol.Optional("types"): vol.All([vol.All(str, vol.Length(max=200))], vol.Length(max=2000)),
    }
)
@require_editor
@websocket_api.async_response
async def ws_packs_update_items(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Update placed items to the installed release of their pack (their recipe copies in the plans), in every home
    (#164: the packs are shared); `revision` is the active home's."""
    if (updates := _updates(hass, connection, msg)) is None:
        return
    updated, revision = await updates.async_apply(msg.get("types"))
    connection.send_result(msg["id"], {"updated": updated, "revision": revision})


@websocket_api.websocket_command({vol.Required("type"): "home_3d/packs/check"})
@require_editor
@websocket_api.async_response
async def ws_packs_check(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Check the packs installed from GitHub for a new release now."""
    if (updates := _updates(hass, connection, msg)) is None:
        return
    result = await updates.async_check()
    connection.send_result(msg["id"], {**updates.status(), **result})


@websocket_api.websocket_command(
    {vol.Required("type"): "home_3d/packs/index", vol.Optional("refresh", default=False): bool}
)
@require_editor
@websocket_api.async_response
async def ws_packs_index(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """The pack index for the Library's Browse tab (#336): fetched by Home Assistant from GitHub and kept for a few
    hours (`refresh` fetches it now). Without internet it answers "offline"; the installed packs are not touched."""
    if (updates := _updates(hass, connection, msg)) is None:
        return
    try:
        result = await updates.async_index(refresh=msg["refresh"])
    except PackError as err:
        connection.send_error(msg["id"], err.code, err.detail or err.code)
        return
    connection.send_result(msg["id"], result)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/packs/pin",
        vol.Required("pack_id"): vol.All(str, vol.Length(max=64)),
        vol.Required("pinned"): bool,
    }
)
@require_editor
@websocket_api.async_response
async def ws_packs_pin(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Pin a pack to its installed release (or unpin it)."""
    if (updates := _updates(hass, connection, msg)) is None:
        return
    try:
        await updates.async_pin(msg["pack_id"], msg["pinned"])
    except PackError as err:
        connection.send_error(msg["id"], err.code, err.detail or err.code)
        return
    connection.send_result(msg["id"], updates.status())


@websocket_api.websocket_command(
    {vol.Required("type"): "home_3d/packs/rollback", vol.Required("pack_id"): vol.All(str, vol.Length(max=64))}
)
@require_editor
@websocket_api.async_response
async def ws_packs_rollback(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Put back the release a pack had before its last update; the pack is pinned to it."""
    if (updates := _updates(hass, connection, msg)) is None:
        return
    try:
        result = await updates.async_rollback(msg["pack_id"])
    except PackError as err:
        connection.send_error(msg["id"], err.code, err.detail or err.code)
        return
    connection.send_result(msg["id"], {**updates.status(), **result})


# ---------------------------------------------------------------------------- custom items (#13)


@websocket_api.websocket_command({vol.Required("type"): "home_3d/items/save", vol.Required("item"): dict})
@require_editor
@websocket_api.async_response
async def ws_items_save(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Keep an item made in the item editor (or imported from an item file); it is checked like a pack's item and
    replaces a custom item with the same id, and placed copies of it change with it."""
    if (data := _data(hass, connection, msg)) is None:
        return
    try:
        item = await data.custom.async_save(msg["item"])
    except PackError as err:
        connection.send_error(msg["id"], err.code, err.detail or err.code)
        return
    # placed copies of the item follow the change (#26)
    await data.async_follow_custom_items()
    connection.send_result(msg["id"], {"item": item})


@websocket_api.websocket_command(
    {vol.Required("type"): "home_3d/items/remove", vol.Required("item_id"): vol.All(str, vol.Length(max=64))}
)
@require_editor
@websocket_api.async_response
async def ws_items_remove(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Remove a custom item (placed copies stay in the plan and keep their recipe copy)."""
    if (data := _data(hass, connection, msg)) is None:
        return
    if not await data.custom.async_remove(msg["item_id"]):
        connection.send_error(msg["id"], "not_found", "Item not found")
        return
    connection.send_result(msg["id"])


# ---------------------------------------------------------------------------- backup

BACKUP_FORMAT = "home3d-backup"
# the packs of backups sent in parts (#375)
_STAGED = "home_3d_backup_staged"


@websocket_api.websocket_command({vol.Required("type"): "home_3d/backup/export"})
@require_editor
@callback
def ws_backup_export(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Every home's plan and the packs for a backup file (the frontend adds the images one by one). The active
    home's plan is also `building`, so a version from before several homes (#53) can still restore the file."""
    if (data := _data(hass, connection, msg)) is None:
        return
    connection.send_result(
        msg["id"],
        {
            "format": BACKUP_FORMAT,
            "version": 1,
            "building": data.building,
            "homes": [{"id": h.id, "name": h.name, "building": h.building} for h in data.homes.values()],
            "active": data.active_id,
            "packs": data.packs,
            # the household's own items (#13)
            "items": data.custom.items,
        },
    )


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/backup/stage",
        # a part of a backup's packs, sent ahead because they don't fit in one message with the rest (#375)
        vol.Required("packs"): [dict],
        # the token the first part got: the next parts go with it
        vol.Optional("token"): vol.All(str, vol.Length(max=64)),
    }
)
@websocket_api.require_admin
@require_editor
@callback
def ws_backup_stage(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Keep a part of a backup's packs for the `backup/import` that names its token (#375); nothing is checked or
    written yet."""
    staged: StagedPacks = hass.data.setdefault(_STAGED, StagedPacks())
    if (token := staged.add(msg.get("token"), msg["packs"])) is None:
        connection.send_error(msg["id"], "staged_expired", "The packs sent ahead are gone or too many: send them again")
        return
    connection.send_result(msg["id"], {"token": token})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/backup/import",
        vol.Optional("building"): dict,
        # the packs: restored onto the installed pack with the same id, or added; packs not in the backup stay, so an
        # older or trimmed backup without them never removes any (#153)
        vol.Optional("packs"): [dict],
        # the custom items (#13), likewise by id; a backup from before them leaves the current ones as they are
        vol.Optional("items"): [dict],
        # every home (#53): restored onto the home with the same id, or added; homes not in the backup stay.
        # Without them (a backup from before #53) `building` replaces the plan of `home_id` (default: the active one)
        vol.Optional("homes"): [
            vol.Schema(
                {vol.Required("id"): _HOME_ID, vol.Required("name"): _HOME_NAME, vol.Required("building"): dict},
                extra=vol.ALLOW_EXTRA,
            )
        ],
        vol.Optional("active"): _HOME_ID,
        **_HOME,
        # only check the backup (#153): the answer says what a restore would skip; nothing changes
        vol.Optional("check_only", default=False): bool,
        # the packs sent ahead with backup/stage (#375), restored with `packs`
        vol.Optional("staged"): vol.All(str, vol.Length(max=64)),
    }
)
@websocket_api.require_admin
@require_editor
@websocket_api.async_response
async def ws_backup_import(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Restore the plans, the packs and the custom items of a backup. Packs are checked again: only ones whose content
    validates come back; the rest are reported as skipped. The state before becomes a restore point.

    Non-destructive (#153): the whole message is checked before anything is written; homes, packs and custom items
    the backup does not name stay as they are; the homes are restored first and the packs and items last, and when a
    step fails the steps done so far are undone and the answer is the error "restore_failed"."""
    if (data := _data(hass, connection, msg)) is None:
        return
    if "staged" in msg:
        staged: StagedPacks = hass.data.setdefault(_STAGED, StagedPacks())
        if (ahead := staged.take(msg["staged"])) is None:
            connection.send_error(
                msg["id"], "staged_expired", "The packs sent ahead are gone: restore the backup again"
            )
            return
        msg = {**msg, "packs": [*ahead, *msg.get("packs", [])]}
    try:
        # every plan, pack and item of a backup is checked in the executor (#176): megabytes of work
        homes, building, checked, items, skipped = await hass.async_add_executor_job(_checked_backup, msg)
    except vol.Invalid as err:
        connection.send_error(msg["id"], "invalid_format", str(err))
        return
    target = None
    # a backup of homes whose plans were all unreadable restores none of them (#380): no home to restore onto
    if not homes and not msg.get("homes") and (target := _home(hass, connection, msg)) is None:
        return
    # the checks an import makes (#376): packs an import would ask about are skipped and listed
    replaced: dict[str, dict[str, Any]] = {}
    if (updates := hass.data.get(DATA_PACK_UPDATES)) is not None:
        # the packs' fingerprints take a while for large packs: not in the event loop (it only reads)
        checked, replaced, held = await hass.async_add_executor_job(updates.restore_plan, checked)
        skipped += held
    # custom items whose id is taken here by another look come in renamed, and the restored plans follow (#376)
    restoring = {h["id"] for h in homes} if homes or msg.get("homes") else {target.id if target else ""}
    local = [h.building.get("recipes") or {} for h in data.homes.values() if h.id not in restoring]
    homes, building, items, renamed, more = await hass.async_add_executor_job(
        resolve_backup_items, homes, building, items, list(data.custom.items), local, MAX_ITEMS
    )
    skipped += more
    if msg["check_only"]:
        connection.send_result(
            msg["id"], {"checked": True, "skipped": skipped, **({"renamed": renamed} if renamed else {})}
        )
        return
    try:
        await _async_restore_backup(hass, data, target, building, homes, msg.get("active"), checked, items, replaced)
    except _RestoreFailed as err:
        connection.send_error(msg["id"], "restore_failed", str(err))
        return
    shown = target or data.active
    result: dict[str, Any] = {
        "revision": shown.revision,
        "building": shown.building,
        "home_id": shown.id,
        "homes": data.homes_list(),
        "active": data.active_id,
        "packs": len(checked),
        "skipped": skipped,
        # custom items that came in under a new id (#376)
        **({"renamed": renamed} if renamed else {}),
    }
    if "items" in msg:
        result["items"] = len(items)
    connection.send_result(msg["id"], result)


def _checked_backup(
    msg: dict[str, Any],
) -> tuple[
    list[dict[str, Any]], dict[str, Any] | None, list[dict[str, Any]], list[dict[str, Any]], list[dict[str, str]]
]:
    """Check a backup without the event loop (#176): its homes, its single building (a backup from before #53), the
    packs whose content validates, the custom items that do, and what was skipped. A home whose plan is unreadable (of
    a newer Home 3D, or invalid) is skipped and listed with the reason "home_unreadable" (#380), so the other homes
    still restore; it is not restored read-only, as nothing in a backup could make its plan safe to keep. Raises
    vol.Invalid for a single plan that does not validate."""
    skipped: list[dict[str, str]] = []
    if not msg.get("homes") and "building" not in msg:
        raise vol.Invalid("a backup has a building or homes")
    if len({h["id"] for h in msg.get("homes", [])}) != len(msg.get("homes", [])):
        raise vol.Invalid("a backup names each home once")
    homes = []
    for h in msg.get("homes", []):
        try:
            # an older plan is brought to the current version first (#165, BUILDING_SCHEMA migrates)
            homes.append({**h, "building": BUILDING_SCHEMA(h["building"])})
        except vol.Invalid:
            skipped.append({"id": h["id"], "reason": "home_unreadable"})
    # with homes the building at the top is the active home's again (for older versions): not needed
    building = BUILDING_SCHEMA(msg["building"]) if not msg.get("homes") else None
    by_id: dict[str, dict[str, Any]] = {}
    for entry in msg.get("packs", []):
        source = entry.get("source")
        name = str(entry.get("id") or "?")
        if not isinstance(source, dict):
            skipped.append({"id": name, "reason": "no_source"})
            continue
        # where a pack came from (#25): kept only when it names GitHub as this version writes it
        origin = checked_origin(source["origin"]) if "origin" in source else None
        try:
            # kept as an import keeps it (#376): checked sizes, no readme or licence text
            clean, kept = checked_source(source)
            official_only(not_reserved(clean), origin)
        except PackError as err:
            skipped.append({"id": name, "reason": err.code})
            continue
        if origin is not None:
            kept["origin"] = origin
        # one entry per pack id (#376): the last one in the backup wins
        if clean["id"] in by_id:
            skipped.append({"id": clean["id"], "reason": "duplicate"})
        by_id[clean["id"]] = {**clean, "source": kept, "imported_at": time.time()}
    checked = list(by_id.values())
    items: list[dict[str, Any]] = []
    for item in msg.get("items", []):
        try:
            items.append(verify_item(item))
        except PackError as err:
            skipped.append({"id": str(item.get("id") or "?"), "reason": err.code})
    return homes, building, checked, items, skipped


class _RestoreFailed(Exception):
    """A backup could not be restored (#153); the message says whether everything was put back."""


async def _async_restore_backup(
    hass: HomeAssistant,
    data: FloorplanData,
    target: Home | None,
    building: dict[str, Any] | None,
    homes: list[dict[str, Any]],
    active: str | None,
    packs: list[dict[str, Any]],
    items: list[dict[str, Any]],
    replaced: dict[str, dict[str, Any]] | None = None,
) -> None:
    """Write a checked backup (#153): the plans first (each keeps its state before as a restore point), then which
    home is active, then the packs and the custom items, each onto the one with the same id (the others stay). When a
    step fails, the steps done are undone in reverse and _RestoreFailed is raised."""
    undo: list[Callable[[], Awaitable[Any]]] = []
    restored: list[Home] = []
    try:
        if target is not None and building is not None:
            # put back as it was, a read-only home's problem too (#379)
            undo.append(partial(target.async_put_back, target.state()))
            await target.async_restore(building)
            restored.append(target)
        for entry in homes:
            if (home := data.homes.get(entry["id"])) is not None:
                if home.name != entry["name"]:
                    undo.append(partial(data.async_rename_home, home.id, home.name))
                    await data.async_rename_home(home.id, entry["name"])
                undo.append(partial(home.async_put_back, home.state()))
                await home.async_restore(entry["building"])
            else:
                home = await data.async_create_home(entry["name"], entry["building"], home_id=entry["id"])
                undo.append(partial(data.async_delete_home, home.id))
            restored.append(home)
        if active in data.homes and active != data.active_id:
            undo.append(partial(data.async_set_active, data.active_id))
            await data.async_set_active(active)
        if packs:
            ids = {p["id"] for p in packs}
            undo.append(partial(data.async_set_packs, data.packs))
            await data.async_set_packs([p for p in data.packs if p["id"] not in ids] + packs)
        if items:
            undo.append(partial(data.custom.async_replace, data.custom.items))
            await data.custom.async_replace([*data.custom.items, *items])
        if packs or items:
            # the restored plans take recipe copies of their items from the packs now installed (a plan saved
            # before #2 has none of its own), and of the custom items restored (#376); a copy a plan has stays
            for home in restored:
                await home.async_follow_custom_items()
    except Exception as err:
        _LOGGER.exception("Restoring a backup failed; undoing the steps done so far")
        put_back = True
        for step in reversed(undo):
            try:
                await step()
            except Exception:
                _LOGGER.exception("Undoing a step of a failed backup restore failed")
                put_back = False
        state = (
            "everything was put back as it was"
            if put_back
            else "it is partly restored: every restored home keeps its state before as a restore point"
        )
        raise _RestoreFailed(f"Restoring the backup failed ({err}); {state}") from err
    if packs and (updates := hass.data.get(DATA_PACK_UPDATES)) is not None:
        await updates.async_forget_uninstalled()
        # the releases the restored packs replaced can be rolled back to (#376)
        await updates.async_restored(replaced or {})


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/voice/subscribe",
        # the view's screen name ("": none): a sentence for one screen goes only to the views of that name (#366)
        vol.Optional("screen"): vol.All(str, vol.Length(max=60)),
    }
)
@callback
def ws_voice_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """The sentences Assist (or the service `home_3d.ask`) hands to the views; each open view listens.

    What a view gets (#367): the sentences for every screen and for its own screen name, with their text (the view
    needs it to answer, and answering is what a wall tablet of a user who is no admin is for; the text is what was
    said to the house, never an answer); never a sentence for another screen. Where people are (a locating answer's
    rooms) only while the view's user is an admin, when people are shown to admins only; the server filters, the
    screen is not trusted to hide it."""

    @callback
    def forward(ask: dict[str, Any]) -> None:
        connection.send_message(websocket_api.event_message(msg["id"], ask))

    connection.subscriptions[msg["id"]] = subscribe_view(
        hass, forward, msg.get("screen"), bool(connection.user and connection.user.is_admin)
    )
    connection.send_result(msg["id"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/voice/answer",
        vol.Required("ask_id"): vol.All(str, vol.Length(max=64)),
        vol.Required("text"): vol.All(str, vol.Length(max=2000)),
        vol.Optional("answered", default=True): bool,
    }
)
@callback
def ws_voice_answer(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """A view's answer to a sentence: the first that understood is taken, one that did not is counted (it
    counts when no view understands); answers to a question answered already are told so (`taken: false`)."""
    broker: AskBroker | None = hass.data.get(DATA_ASK)
    taken = broker.answer(msg["ask_id"], msg["text"], msg["answered"]) if broker else False
    connection.send_result(msg["id"], {"taken": taken})


@websocket_api.websocket_command({vol.Required("type"): "home_3d/voice/settings"})
@callback
def ws_voice_settings(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """The voice settings: which sentences Assist hands to Home 3D."""
    settings: VoiceSettings | None = hass.data.get(DATA_VOICE)
    connection.send_result(msg["id"], {"sentences": settings.sentences if settings else "off"})


@websocket_api.websocket_command(
    {vol.Required("type"): "home_3d/voice/settings/set", vol.Required("sentences"): vol.In(SENTENCE_MODES)}
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_voice_settings_set(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Sets which sentences Assist hands to Home 3D; the sentence files are rewritten and Assist reloads them."""
    settings: VoiceSettings | None = hass.data.get(DATA_VOICE)
    if settings is None:
        connection.send_error(msg["id"], "not_ready", "voice settings not loaded")
        return
    try:
        kept = await settings.async_set_sentences(msg["sentences"])
    except OSError as err:
        connection.send_error(msg["id"], "write_failed", str(err))
        return
    connection.send_result(msg["id"], {"sentences": settings.sentences, "kept": kept})


# ---------------------------------------------------------------------------- editors (#7)


def _editors(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict) -> Editors | None:
    editors: Editors | None = hass.data.get(DATA_EDITORS)
    if editors is None:
        connection.send_error(msg["id"], "not_loaded", "Home 3D is not set up")
    return editors


async def _send_editors(editors: Editors, connection: websocket_api.ActiveConnection, msg: dict) -> None:
    connection.send_result(msg["id"], {"users": await editors.async_users(), "custom": editors.custom is not None})


@websocket_api.websocket_command({vol.Required("type"): "home_3d/editors/get"})
@websocket_api.require_admin
@websocket_api.async_response
async def ws_editors_get(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Everyone who signs in and whether they may change the plan; `custom` is false while the admins are."""
    if (editors := _editors(hass, connection, msg)) is not None:
        await _send_editors(editors, connection, msg)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/editors/set",
        vol.Required("editors"): vol.Any(None, [vol.All(str, vol.Length(max=64))]),
    }
)
@websocket_api.require_admin
@websocket_api.async_response
async def ws_editors_set(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Pick the editors (null: every admin again). A list without an admin is refused."""
    if (editors := _editors(hass, connection, msg)) is None:
        return
    try:
        await editors.async_set(msg["editors"])
    except EditorsError as err:
        connection.send_error(msg["id"], err.code, err.detail)
        return
    # who may change the plan is a security setting (#188)
    who = "everyone who is an admin" if msg["editors"] is None else f"{len(msg['editors'])} user(s)"
    audit(connection, msg, f"set the editors to {who} with")
    await _send_editors(editors, connection, msg)


# ---------------------------------------------------------------------------- homes (#53)


def _send_homes(data: FloorplanData, connection: websocket_api.ActiveConnection, msg: dict, **extra: Any) -> None:
    connection.send_result(msg["id"], {"homes": data.homes_list(), "active": data.active_id, **extra})


@websocket_api.websocket_command({vol.Required("type"): "home_3d/homes/list"})
@require_editor
@callback
def ws_homes_list(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Every home with its revision and size, and which one is active (editors: viewers see the active home)."""
    if (data := _data(hass, connection, msg)) is not None:
        _send_homes(data, connection, msg)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/homes/create",
        vol.Required("name"): _HOME_NAME,
        # False for a sample or template home (#61): no import of this install's areas offered
        vol.Optional("area_import", default=True): bool,
    }
)
@require_editor
@websocket_api.async_response
async def ws_homes_create(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Add an empty home (it does not become active)."""
    if (data := _data(hass, connection, msg)) is None:
        return
    home = await data.async_create_home(msg["name"], area_import=msg["area_import"])
    _send_homes(data, connection, msg, home=home.info())


@websocket_api.websocket_command({vol.Required("type"): "home_3d/homes/load_sample"})
@require_editor
@websocket_api.async_response
async def ws_homes_load_sample(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Add the sample home (#54) as a new home of its own; no home is overwritten and, like any new home (#58), it
    does not become the active one. It is a demo home (#100) that never offers this install's areas (#61)."""
    if (data := _data(hass, connection, msg)) is None:
        return
    taken = {home.name for home in data.homes.values()}
    name, number = SAMPLE_NAME, 1
    while name in taken:
        number += 1
        name = f"{SAMPLE_NAME} {number}"
    building = await hass.async_add_executor_job(lambda: BUILDING_SCHEMA(load_sample()))
    home = await data.async_create_home(name, building, area_import=False, demo=True)
    _send_homes(data, connection, msg, home=home.info())


@websocket_api.websocket_command(
    {vol.Required("type"): "home_3d/homes/rename", vol.Required("home_id"): _HOME_ID, vol.Required("name"): _HOME_NAME}
)
@require_editor
@websocket_api.async_response
async def ws_homes_rename(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Give a home another name."""
    if (data := _data(hass, connection, msg)) is None:
        return
    try:
        await data.async_rename_home(msg["home_id"], msg["name"])
    except HomesError as err:
        connection.send_error(msg["id"], err.code, err.detail)
        return
    _send_homes(data, connection, msg)


@websocket_api.websocket_command(
    {
        vol.Required("type"): "home_3d/homes/duplicate",
        vol.Required("home_id"): _HOME_ID,
        vol.Required("name"): _HOME_NAME,
    }
)
@require_editor
@websocket_api.async_response
async def ws_homes_duplicate(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Add a home with a copy of another's plan and pictures."""
    if (data := _data(hass, connection, msg)) is None:
        return
    try:
        home = await data.async_duplicate_home(msg["home_id"], msg["name"])
    except HomesError as err:
        connection.send_error(msg["id"], err.code, err.detail)
        return
    _send_homes(data, connection, msg, home=home.info())


@websocket_api.websocket_command({vol.Required("type"): "home_3d/homes/delete", vol.Required("home_id"): _HOME_ID})
@require_editor
@websocket_api.async_response
async def ws_homes_delete(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Remove a home with its plan, restore points and pictures; the last home is never removed."""
    if (data := _data(hass, connection, msg)) is None:
        return
    try:
        await data.async_delete_home(msg["home_id"])
    except HomesError as err:
        connection.send_error(msg["id"], err.code, err.detail)
        return
    _send_homes(data, connection, msg)


@websocket_api.websocket_command({vol.Required("type"): "home_3d/homes/set_active", vol.Required("home_id"): _HOME_ID})
@require_editor
@websocket_api.async_response
async def ws_homes_set_active(
    hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]
) -> None:
    """Make a home the active one: the panel, the cards without a home, voice, locating and time travel follow."""
    if (data := _data(hass, connection, msg)) is None:
        return
    try:
        await data.async_set_active(msg["home_id"])
    except HomesError as err:
        connection.send_error(msg["id"], err.code, err.detail)
        return
    _send_homes(data, connection, msg)


@websocket_api.websocket_command({vol.Required("type"): "home_3d/pets/subscribe", **_HOME})
@callback
def ws_pets_subscribe(hass: HomeAssistant, connection: websocket_api.ActiveConnection, msg: dict[str, Any]) -> None:
    """Roaming pets (#337): where each pet of a home is now (by pet id: floor, x, z, pose, facing, and the routine
    spot or the trigger that put it there with when that runs out), at once and whenever it changes. Without a home
    this follows the active home, like building/subscribe."""
    if (home := _home(hass, connection, msg)) is None:
        return
    named = msg.get("home_id")
    followed = [home.id]

    def send(home_id: str) -> None:
        routines = hass.data.get(DATA_PETS)
        pets = routines.targets(home_id) if routines is not None else {}
        connection.send_message(websocket_api.event_message(msg["id"], {"home_id": home_id, "pets": pets}))

    @callback
    def forward(home_id: str, _targets: dict[str, Any]) -> None:
        if home_id == followed[0]:
            send(home_id)

    @callback
    def homes_changed() -> None:
        if (data := hass.data.get(DOMAIN)) is None:
            return
        if named is None and data.active_id != followed[0] and data.active_id in data.homes:
            followed[0] = data.active_id
            send(data.active_id)

    unsubs = [
        async_dispatcher_connect(hass, SIGNAL_PETS_UPDATED, forward),
        async_dispatcher_connect(hass, SIGNAL_HOMES_UPDATED, homes_changed),
    ]

    @callback
    def unsubscribe() -> None:
        for unsub in unsubs:
            unsub()

    connection.subscriptions[msg["id"]] = unsubscribe
    connection.send_result(msg["id"])
    send(home.id)
