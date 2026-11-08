"""The pack index (#336): the curated list of packs the Library's Browse tab offers.

`index.json` in amluto-solutions/home-3d-packs lists our packs and the community packs added by pull request (CI there
checks every listed pack with the same rules as packs.py). Home Assistant fetches it, never the browser, and only from
GitHub: the URL is configurable (a fork's index), but must be a raw.githubusercontent.com file (a github.com "blob"
link is turned into its raw form). Installing a listed pack goes through the install-by-URL path (#25) with its
GitHub URL, so the index itself is never trusted to install anything: it only names packs.

The index is kept in memory for a few hours (CACHE_SECONDS); a failed fetch hands back the copy it has, marked stale,
or "offline" when it has none. Entries this version cannot read are left out, not the whole index.
"""

from __future__ import annotations

from functools import partial
import json
import time
from typing import Any
from urllib.parse import urlsplit

from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
import voluptuous as vol

from .pack_github import _get, parse_url
from .packs import OFFICIAL_OWNER, PackError, verify_item

DEFAULT_INDEX_URL = "https://raw.githubusercontent.com/amluto-solutions/home-3d-packs/main/index.json"
INDEX_FORMAT = "home3d-pack-index"
INDEX_VERSION = 1
# how long a fetched index is used before it is fetched again (a refresh asks at once)
CACHE_SECONDS = 6 * 3600
MAX_INDEX_BYTES = 2_000_000
MAX_PACKS = 500
MAX_PREVIEWS = 6
MAX_URL_LENGTH = 500

_TEXT = vol.All(str, vol.Length(min=1, max=80))
_COUNT = vol.All(int, vol.Range(min=0, max=100000))
ENTRY_SCHEMA = vol.Schema(
    {
        vol.Required("id"): vol.All(str, vol.Match(r"^[a-z0-9][a-z0-9_-]{0,29}\.[a-z0-9][a-z0-9_-]{0,29}$")),
        vol.Required("name"): _TEXT,
        vol.Required("publisher"): _TEXT,
        vol.Required("licence"): vol.All(str, vol.Match(r"^[A-Za-z0-9][A-Za-z0-9.+-]{1,39}$")),
        vol.Required("release"): vol.All(int, vol.Range(min=1, max=100000)),
        vol.Required("url"): vol.All(str, vol.Length(max=MAX_URL_LENGTH)),
        vol.Optional("description", default=""): vol.All(str, vol.Length(max=400)),
        vol.Optional("release_note"): vol.All(str, vol.Length(max=200)),
        vol.Optional("source", default="community"): vol.In(["official", "community"]),
        vol.Optional("kind", default="furniture"): vol.In(["furniture", "language"]),
        vol.Optional("language"): vol.All(str, vol.Match(r"^[a-z]{2,3}$")),
        vol.Optional("items", default=0): _COUNT,
        vol.Optional("texts"): _COUNT,
        # item group -> how many items of it (the Browse tab's categories)
        vol.Optional("categories", default={}): vol.All(
            {vol.All(str, vol.Match(r"^[a-z0-9][a-z0-9_.-]{0,39}$")): _COUNT}
        ),
        # the item whose picture stands for the pack (one of the previews)
        vol.Optional("thumbnail"): vol.All(str, vol.Length(max=40)),
        # a few whole items, drawn as the pack's pictures before it is installed (checked one by one below)
        vol.Optional("previews", default=[]): list,
    },
    extra=vol.REMOVE_EXTRA,
)


def index_url(text: str | None) -> str:
    """The index URL to fetch for a setting (empty: the default). A github.com "blob" link becomes its raw file;
    anything but an https file on raw.githubusercontent.com raises PackError("bad_url")."""
    text = (text or "").strip()
    if not text:
        return DEFAULT_INDEX_URL
    if len(text) > MAX_URL_LENGTH:
        raise PackError("bad_url", "the index URL is too long")
    parts = urlsplit(text)
    host = (parts.hostname or "").lower()
    if parts.scheme != "https" or parts.username or parts.password or parts.port or parts.query or parts.fragment:
        raise PackError("bad_url", "the index URL must be a plain https link to a file on GitHub")
    segments = [s for s in parts.path.split("/") if s]
    if host in ("github.com", "www.github.com") and len(segments) >= 5 and segments[2] == "blob":
        owner, repo, _blob, ref, *path = segments
        return f"https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{'/'.join(path)}"
    if host != "raw.githubusercontent.com" or len(segments) < 4 or any(s in (".", "..") for s in segments):
        raise PackError("bad_url", "the index URL must be a raw.githubusercontent.com file (or a github.com file link)")
    return f"https://raw.githubusercontent.com/{'/'.join(segments)}"


def checked_setting(value: Any) -> str:
    """The stored `index_url` setting: "" (the default) or a URL index_url() accepts, kept as typed."""
    if not isinstance(value, str):
        raise vol.Invalid("the index URL must be text")
    try:
        index_url(value)
    except PackError as err:
        raise vol.Invalid(err.detail) from err
    return value.strip()


def _entry(raw: Any, official: bool) -> dict[str, Any] | None:
    """One listed pack as the Browse tab gets it, or None when this version cannot read it."""
    try:
        entry = ENTRY_SCHEMA(raw)
        url = parse_url(entry["url"])
    except (vol.Invalid, PackError):
        return None
    # the install path only takes GitHub URLs; keep the plain form it installs (and an update check compares)
    entry["url"] = url.url
    # "official" is not the entry's to say (#372): only the default index, for a pack on Home 3D's own account
    if not official or url.owner.casefold() != OFFICIAL_OWNER:
        entry["source"] = "community"
    previews = []
    for item in entry["previews"][:MAX_PREVIEWS]:
        try:
            previews.append(verify_item(item))
        except (PackError, KeyError, TypeError):
            continue
    entry["previews"] = previews
    if entry.get("thumbnail") not in {p["id"] for p in previews}:
        entry.pop("thumbnail", None)
        if previews:
            entry["thumbnail"] = previews[0]["id"]
    return entry


def read_index(body: bytes, *, official: bool = False) -> list[dict[str, Any]]:
    """The packs an index file lists (unreadable entries and repeated ids left out); raises PackError. Only the
    default index (`official`) may mark an entry official."""
    try:
        data = json.loads(body)
    except (ValueError, RecursionError) as err:
        raise PackError("invalid_index", "the pack index is not JSON") from err
    if not isinstance(data, dict) or data.get("format") != INDEX_FORMAT or not isinstance(data.get("packs"), list):
        raise PackError("invalid_index", f'the pack index must say "format": "{INDEX_FORMAT}" and list "packs"')
    version = data.get("version")
    if not isinstance(version, int) or version < 1:
        raise PackError("invalid_index", "the pack index names no version")
    packs: list[dict[str, Any]] = []
    seen: set[str] = set()
    for raw in data["packs"][:MAX_PACKS]:
        entry = _entry(raw, official)
        if entry is None or entry["id"] in seen:
            continue
        seen.add(entry["id"])
        packs.append(entry)
    return packs


class PackIndex:
    """The last index fetched, by URL, and when."""

    def __init__(self, hass: HomeAssistant) -> None:
        self.hass = hass
        self._url: str | None = None
        self._packs: list[dict[str, Any]] = []
        self._fetched_at = 0.0

    async def async_get(self, url: str, *, refresh: bool = False) -> dict[str, Any]:
        """The index at `url`: from memory while it is fresh (unless `refresh`), else fetched. A failed fetch gives
        the copy kept for this URL with `stale` and the error; with none kept it raises PackError("offline")."""
        now = time.time()
        kept = self._url == url
        if kept and not refresh and now - self._fetched_at < CACHE_SECONDS:
            return self._answer()
        try:
            body = await _get(async_get_clientsession(self.hass), url, MAX_INDEX_BYTES, "the pack index")
            # checking every entry and its previews takes seconds for a large index: not in the event loop (#374)
            packs = await self.hass.async_add_executor_job(partial(read_index, body, official=url == DEFAULT_INDEX_URL))
        except PackError as err:
            if kept:
                return {**self._answer(), "stale": True, "error": err.code}
            raise PackError("offline", f"{err.code}: {err.detail}" if err.detail else err.code) from err
        self._url, self._packs, self._fetched_at = url, packs, now
        return self._answer()

    def _answer(self) -> dict[str, Any]:
        return {"url": self._url, "fetched_at": self._fetched_at, "packs": self._packs}
