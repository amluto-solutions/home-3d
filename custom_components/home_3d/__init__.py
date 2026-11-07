"""Home 3D: draw your home in Home Assistant and control it in 3D."""

from __future__ import annotations

import contextlib
from functools import lru_cache, partial
import hashlib
import logging
from pathlib import Path
import re

from aiohttp import web
from homeassistant.components import frontend, panel_custom
from homeassistant.components.http import HomeAssistantView
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.dispatcher import async_dispatcher_send
from homeassistant.helpers.http import KEY_HASS
from homeassistant.helpers.typing import ConfigType

from .card_resource import (
    LOADER_FILE,
    LOADER_URL,
    async_remove_card_resource,
    async_schedule_card_resource,
    loader_source,
)
from .const import (
    APP_BUNDLE,
    CONF_RESTORE_PICTURE_DAYS,
    CONF_SHOW_IN_SIDEBAR,
    DATA_EDITORS,
    DATA_PACK_UPDATES,
    DATA_PETS,
    DEFAULT_RESTORE_PICTURE_DAYS,
    DEFAULT_SHOW_IN_SIDEBAR,
    DOMAIN,
    LEGACY_URL_BASE,
    MAIN_BUNDLE,
    MAIN_URL,
    PANEL_COMPONENT,
    PANEL_ICON,
    PANEL_TITLE,
    PANEL_URL_PATH,
    URL_BASE,
)
from .editors import Editors
from .frontend_build import read_build
from .locate.recorder import async_remove_recordings, async_unload_recorder
from .locate.service import DATA_LOCATE, SIGNAL_LOCATE, LocateService
from .pack_updates import PackUpdates
from .pets import PetRoutines
from .storage import FloorplanData
from .voice import async_remove_sentences, async_setup_voice, async_unload_voice
from .websocket import async_register_commands

_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)
PLATFORMS = ["sensor"]

_STATIC_REGISTERED = f"{DOMAIN}_static_registered"


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Register the websocket commands and the static path once, as early as possible (#461)."""
    async_register_commands(hass)
    await _async_register_static(hass)
    return True


FRONTEND_DIR = Path(__file__).parent / "frontend"


# A file named after its content (a chunk, home-3d-chunk-<hash>.js) or asked for by its content hash (the bundles the
# main one loads, home-3d-3d.js?v=<hash>) never changes under that URL: the browser keeps it for a year and does not
# ask again (run 6 speed). Before, every load checked each of the thirty-odd files with a request of its own.
_HASHED_NAME = re.compile(r"home-3d-[\w-]+-[A-Z0-9]{8}\.js")
_CONTENT_HASH = re.compile(r"[0-9a-f]{12}")
CACHE_IMMUTABLE = "public, max-age=31536000, immutable"
CACHE_CHECK = "no-cache"


class FrontendView(HomeAssistantView):
    """The bundles, languages and pictures of the frontend. A file whose URL names its content is kept by the browser
    (CACHE_IMMUTABLE); anything else is served without caching: a browser checks it on each load (and gets a short
    304 when it is unchanged), so an update of the files shows after a reload, with no restart of Home Assistant for
    the frontend alone. Also under the path before #218 (see URL_BASE)."""

    url = f"{URL_BASE}/{{path:.+}}"
    extra_urls = [f"{LEGACY_URL_BASE}/{{path:.+}}"]  # noqa: RUF012 (HomeAssistantView declares it a list)
    name = f"{DOMAIN}:frontend"
    requires_auth = False

    async def get(self, request: web.Request, path: str) -> web.StreamResponse:
        hass: HomeAssistant = request.app[KEY_HASS]
        if path == LOADER_FILE:
            # the dashboard resource: loads the bundle and tries again while it is not there yet (#461). It imports
            # the start file, which picks the current build (#357), so it is the same for every build and never kept:
            # a dashboard resource from before an update (`?v=<old>`) gets it too
            text = loader_source(MAIN_URL)
            return web.Response(text=text, content_type="text/javascript", headers={"Cache-Control": CACHE_CHECK})
        found = await hass.async_add_executor_job(_frontend_file_cached, path, request.query.get("v"))
        if found is None:
            raise web.HTTPNotFound
        file, cache = found
        return web.FileResponse(file, headers={"Cache-Control": cache})


def _frontend_file(path: str) -> Path | None:
    """The file under the frontend folder for a request path, None outside of it or missing (in the executor)."""
    root = FRONTEND_DIR.resolve()
    file = (root / path).resolve()
    return file if root in file.parents and file.is_file() else None


def _frontend_file_cached(path: str, version: str | None) -> tuple[Path, str] | None:
    """The file for a request path and how long the browser may keep it (in the executor): a year when its name or
    the asked `v` is its content hash, else it checks again on each load."""
    file = _frontend_file(path)
    if file is None:
        return None
    if _HASHED_NAME.fullmatch(file.name):
        return file, CACHE_IMMUTABLE
    if file.name == MAIN_BUNDLE or not version:
        # the start file is never kept (#357): every page names it, whatever `v` an old page put on it
        return file, CACHE_CHECK
    if file.name == APP_BUNDLE:
        # the app under the current build id (#340, #357): only the start file names it, after asking which build is
        # served, so nothing old names this URL. Kept only when the file on disk is that build (a deploy that wrote
        # build.json before the app must not have the old app kept under the new URL); an old id gets the current file,
        # checked on each load
        stat = file.stat()
        if version == read_build() and _holds_build(file, stat.st_mtime_ns, stat.st_size, version):
            return file, CACHE_IMMUTABLE
        return file, CACHE_CHECK
    if _CONTENT_HASH.fullmatch(version):
        stat = file.stat()
        if _content_hash(file, stat.st_mtime_ns, stat.st_size) == version:
            return file, CACHE_IMMUTABLE
    return file, CACHE_CHECK


@lru_cache(maxsize=8)
def _holds_build(file: Path, mtime_ns: int, size: int, build: str) -> bool:
    """Whether the app file is this build: the build puts its id into the app (build.mjs __FP3D_BUILD__)."""
    return f'"{build}"'.encode() in file.read_bytes()


@lru_cache(maxsize=64)
def _content_hash(file: Path, mtime_ns: int, size: int) -> str:
    """The build's content hash of a file (the first 12 hex digits of its SHA-256, build.mjs hashOf), kept while the
    file stays the same (its time and size are part of the key)."""
    return hashlib.sha256(file.read_bytes()).hexdigest()[:12]


async def _async_register_static(hass: HomeAssistant) -> None:
    # views cannot be unregistered, so it is registered once per run
    if hass.data.get(_STATIC_REGISTERED):
        return
    hass.http.register_view(FrontendView())
    hass.data[_STATIC_REGISTERED] = True


def _bundle_urls() -> tuple[str, str]:
    """The URLs of the start file and of the card loader: the same for every build (#218, #357). The start file goes to
    the extra module and the panel, and the loader imports it, so the browser runs one copy; it picks the build."""
    return MAIN_URL, LOADER_URL


async def _async_register_panel(hass: HomeAssistant, entry: ConfigEntry, url: str) -> None:
    """Register the panel; with the sidebar option off it has no title and icon, so it stays out of the sidebar
    while its URL (and the dashboard card) keep working (#8)."""
    show = entry.options.get(CONF_SHOW_IN_SIDEBAR, DEFAULT_SHOW_IN_SIDEBAR)
    await panel_custom.async_register_panel(
        hass,
        frontend_url_path=PANEL_URL_PATH,
        webcomponent_name=PANEL_COMPONENT,
        sidebar_title=PANEL_TITLE if show else None,
        sidebar_icon=PANEL_ICON if show else None,
        module_url=url,
        require_admin=False,
        config={},
    )


async def _async_options_updated(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """Show or hide the sidebar entry without a restart: replace the panel under the same URL. How long the pictures
    of restore points are kept (#154) counts from the next clean-up, at the next start."""
    if (data := hass.data.get(DOMAIN)) is not None:
        data.picture_days = entry.options.get(CONF_RESTORE_PICTURE_DAYS, DEFAULT_RESTORE_PICTURE_DAYS)
    frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
    await _async_register_panel(hass, entry, _bundle_urls()[0])


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Load the stores and register the frontend (panel and card)."""
    # Everything started here registers its own clean-up with the entry as it starts (#190): when a later step fails,
    # or the entry is unloaded or reloaded, the same callbacks stop the timers and listeners and drop the data, so
    # setup and unload cannot drift apart. (A failed setup runs them too.)
    data = FloorplanData(hass, entry.options.get(CONF_RESTORE_PICTURE_DAYS, DEFAULT_RESTORE_PICTURE_DAYS))
    await data.async_load()
    hass.data[DOMAIN] = data
    entry.async_on_unload(partial(_forget, hass, DOMAIN))

    # pack updates (#26): settings, pins, previous releases and the scheduled check; a Home 3D update that brought a
    # newer bundled pack is applied to placed items now when auto-update is on
    updates = PackUpdates(hass, data)
    entry.async_on_unload(updates.stop)
    entry.async_on_unload(partial(_forget, hass, DATA_PACK_UPDATES))
    await updates.async_load()
    hass.data[DATA_PACK_UPDATES] = updates
    updates.start()
    await updates.async_auto_update()

    # who may change the plan (#7)
    editors = Editors(hass)
    await editors.async_load()
    hass.data[DATA_EDITORS] = editors
    entry.async_on_unload(partial(_forget, hass, DATA_EDITORS))

    # locating (who and what is where, from the Bluetooth scanners): idle unless an admin switched it on
    locate = LocateService(hass)
    # before the load, which starts it when it was on; also writes a save still waiting for its delay (#368)
    entry.async_on_unload(locate.async_unload)
    entry.async_on_unload(partial(_forget, hass, DATA_LOCATE))
    # the lab recorder (locate/rec) stops with the entry too (#368)
    entry.async_on_unload(partial(async_unload_recorder, hass))
    await locate.async_load()
    hass.data[DATA_LOCATE] = locate
    # open views follow the new service at once after a reload (their subscription outlives it, #368)
    async_dispatcher_send(hass, SIGNAL_LOCATE)
    # with the rooms and doors of the active home's plan, whenever it changes (#169)
    entry.async_on_unload(locate.follow_plan(lambda: data.active.building, lambda: data.active_id))

    # roaming pets (#337): where each pet is now, the same on every screen
    routines = PetRoutines(hass, lambda: {home_id: home.building for home_id, home in data.homes.items()})
    entry.async_on_unload(partial(_forget, hass, DATA_PETS))
    entry.async_on_unload(routines.start())
    hass.data[DATA_PETS] = routines

    # Assist asks the house: service, intent and the sentences Assist understands (with the names locating knows)
    entry.async_on_unload(partial(async_unload_voice, hass))
    await async_setup_voice(hass)
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)

    await _async_register_static(hass)

    # one URL for the bundle everywhere: the extra module, the panel's module_url and the card loader (#218)
    url, loader_url = _bundle_urls()
    entry.async_on_unload(partial(_remove_frontend, hass, url))
    frontend.add_extra_js_url(hass, url)
    # and as a dashboard resource, so a dashboard never draws the card before its script is there (#252), through
    # the loader on our own path, which tries again while the bundle is not there yet (#461)
    entry.async_on_unload(async_schedule_card_resource(hass, loader_url))
    await _async_register_panel(hass, entry, url)
    # the sidebar option (#8) applies at once: the panel is registered again, the entry is not reloaded
    entry.async_on_unload(entry.add_update_listener(_async_options_updated))
    return True


def _forget(hass: HomeAssistant, key: str) -> None:
    """Drop what setup kept in `hass.data` (an unload callback must return nothing, which `dict.pop` does not)."""
    hass.data.pop(key, None)


def _remove_frontend(hass: HomeAssistant, url: str) -> None:
    """Take the panel and the script out of the frontend (the reverse of what setup added)."""
    frontend.async_remove_panel(hass, PANEL_URL_PATH, warn_if_unknown=False)
    # newer Home Assistant raises when the list was never made (no frontend loaded, as in tests) or the url is gone
    with contextlib.suppress(KeyError, ValueError):
        frontend.remove_extra_js_url(hass, url)


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload the platforms; everything else setup started is stopped by the callbacks it registered with the entry
    (#190), which Home Assistant runs once this returns True."""
    return await hass.config_entries.async_unload_platforms(entry, PLATFORMS)


async def async_remove_entry(hass: HomeAssistant, entry: ConfigEntry) -> None:
    """The plan, its pictures and packs stay in .storage when the integration is removed: they are the
    user's work, and removing and re-adding the integration must never cost it. The lab recordings of locating
    (config/home_3d_locate) are not: they hold the Bluetooth addresses heard in the house and go (#368)."""
    await async_remove_card_resource(hass)
    # the Assist sentence files Home 3D wrote (a file the user changed stays)
    with contextlib.suppress(OSError):
        await async_remove_sentences(hass)
    await async_remove_recordings(hass)
