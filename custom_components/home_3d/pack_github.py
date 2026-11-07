"""Install a furniture pack from a GitHub URL (#25).

An editor pastes the URL of a public repository (pack at its root) or of a pack folder inside one
(`https://github.com/<owner>/<repo>/tree/<ref>/<folder>`). Home Assistant fetches the pack, never the browser, and only
from GitHub: the repository and the commit from api.github.com, the files from raw.githubusercontent.com at that
commit. Names, file count and sizes are checked before anything is downloaded; the files then go through the same
v2 check as a folder import (packs.verify_folder).

The installed pack keeps where it came from (`origin`, see fetch_pack): owner, repo, ref, folder and the commit, so
an update check can compare commits later.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
import json
import re
import time
from typing import Any
from urllib.parse import urlsplit

import aiohttp
from homeassistant.core import HomeAssistant
from homeassistant.helpers.aiohttp_client import async_get_clientsession
import voluptuous as vol
from yarl import URL

from .packs import (
    MAX_FILE_SIZE,
    MAX_FOLDER_BYTES,
    MAX_ITEMS,
    MAX_STRINGS_SIZE,
    PACK_FILE,
    STRINGS_FILE,
    PackError,
    data_paths,
    verify_pack_file,
)

# the only hosts a pack is fetched from (a redirect elsewhere is refused)
ALLOWED_HOSTS = frozenset({"github.com", "api.github.com", "raw.githubusercontent.com"})
# GitHub's file sizes are bytes; the pack limits count characters, which take up to four bytes each in UTF-8
MAX_FILE_BYTES = MAX_FILE_SIZE * 4
# a language pack's strings.json (#196) may be larger
MAX_STRINGS_BYTES = MAX_STRINGS_SIZE * 4
# the whole folder: the same byte limit as a folder import (#375; the files' bytes are at most what is sent), so a
# pack installed by URL also imports as a folder. The downloaded files are then checked like one (packs.py).
# files in the pack folder (data files plus a readme and a licence text); more is refused before any download
MAX_FILES = MAX_ITEMS + 10
# an answer of the GitHub API (the file list of a large repository is the biggest)
MAX_API_BYTES = 5_000_000
MAX_REDIRECTS = 3
PARALLEL_DOWNLOADS = 8
TIMEOUT = aiohttp.ClientTimeout(total=30)
HEADERS = {"Accept": "application/vnd.github+json", "User-Agent": "home-3d"}

_OWNER = re.compile(r"^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$")
_REPO = re.compile(r"^[A-Za-z0-9_.-]{1,100}$")
# a branch, tag or commit as one path segment (a branch name with "/" in it cannot be told from the folder)
_REF = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$")
_FOLDER_PART = re.compile(r"^[A-Za-z0-9_][A-Za-z0-9_.-]{0,99}$")
_SHA = re.compile(r"^[0-9a-f]{40}$")

# how long update checks wait after GitHub refused without saying for how long (#377), and the bounds of a wait
DEFAULT_BACKOFF = 3600
BACKOFF_RANGE = (60, 6 * 3600)


class RateLimited(PackError):
    """GitHub refused (403 / 429, a rate limit): code "fetch_failed", and `retry_at`, when to ask again (#377)."""

    def __init__(self, detail: str, headers: Any) -> None:
        super().__init__("fetch_failed", detail)
        self.retry_at = _retry_at(headers, time.time())


def _retry_at(headers: Any, now: float) -> float:
    """When GitHub may be asked again: its Retry-After, else the reset time of a used-up rate limit, else in an
    hour; at least a minute and at most six hours from now."""
    try:
        if (after := headers.get("Retry-After")) is not None:
            at = now + float(after)
        elif headers.get("X-RateLimit-Remaining") == "0" and (reset := headers.get("X-RateLimit-Reset")) is not None:
            at = float(reset)
        else:
            at = now + DEFAULT_BACKOFF
    except (TypeError, ValueError):
        at = now + DEFAULT_BACKOFF
    return min(max(at, now + BACKOFF_RANGE[0]), now + BACKOFF_RANGE[1])


URL_HINT = "paste https://github.com/<owner>/<repo> or https://github.com/<owner>/<repo>/tree/<branch>/<folder>"


@dataclass(frozen=True)
class GitHubPackUrl:
    """Where a pack lives on GitHub. `ref` is None for the default branch; `folder` is "" for the repo root."""

    owner: str
    repo: str
    ref: str | None
    folder: str

    @property
    def url(self) -> str:
        """The URL in its plain form (https, no ".git", no trailing slash)."""
        base = f"https://github.com/{self.owner}/{self.repo}"
        if self.ref is None:
            return base
        return f"{base}/tree/{self.ref}" + (f"/{self.folder}" if self.folder else "")


def parse_url(url: str) -> GitHubPackUrl:
    """A pasted GitHub URL of a repo or of a pack folder in it; raises PackError("bad_url")."""
    text = url.strip()
    if "://" not in text:
        text = "https://" + text
    parts = urlsplit(text)
    host = (parts.hostname or "").lower()
    if parts.scheme not in ("https", "http") or host not in ("github.com", "www.github.com"):
        raise PackError("bad_url", f"not a GitHub URL: {URL_HINT}")
    try:
        port = parts.port
    except ValueError:
        # a port that is no port ("github.com:99999") (#47)
        port = -1
    if parts.username or parts.password or port:
        raise PackError("bad_url", f"not a plain GitHub URL: {URL_HINT}")
    segments = [s for s in parts.path.split("/") if s]
    if len(segments) < 2:
        raise PackError("bad_url", f"the URL names no repository: {URL_HINT}")
    owner, repo, rest = segments[0], segments[1].removesuffix(".git"), segments[2:]
    if not _OWNER.match(owner) or not _REPO.match(repo) or repo in (".", ".."):
        raise PackError("bad_url", f"not a GitHub repository: {URL_HINT}")
    ref: str | None = None
    folder: list[str] = []
    if rest:
        if rest[0] == "tree" and len(rest) >= 2:
            ref, folder = rest[1], rest[2:]
        elif rest[:2] == ["releases", "tag"] and len(rest) == 3:
            ref = rest[2]
        else:
            raise PackError("bad_url", f"not a repository or folder URL: {URL_HINT}")
        if not _REF.match(ref) or any(not _FOLDER_PART.match(p) for p in folder):
            raise PackError("bad_url", f"the branch or folder in the URL is not valid: {URL_HINT}")
    return GitHubPackUrl(owner, repo, ref, "/".join(folder))


# ---------------------------------------------------------------------------- fetching


async def _read(response: aiohttp.ClientResponse, limit: int, what: str) -> bytes:
    """The body of an answer, refused once it grows over `limit` bytes."""
    body = bytearray()
    async for chunk in response.content.iter_chunked(65536):
        body += chunk
        if len(body) > limit:
            raise PackError("too_large", f"{what}: more than {limit} bytes")
    return bytes(body)


async def _get(session: aiohttp.ClientSession, url: str, limit: int, what: str) -> bytes:
    """GET from GitHub, following redirects only to the allowed hosts; raises PackError."""
    for _ in range(MAX_REDIRECTS + 1):
        target = URL(url)
        if target.scheme != "https" or target.host not in ALLOWED_HOSTS:
            raise PackError("fetch_failed", f"{what}: refused to fetch from {target.host}")
        try:
            async with session.get(url, headers=HEADERS, allow_redirects=False, timeout=TIMEOUT) as response:
                if response.status in (301, 302, 303, 307, 308) and response.headers.get("Location"):
                    url = str(target.join(URL(response.headers["Location"])))
                    continue
                if response.status == 404:
                    raise PackError("not_found", f"{what}: not found on GitHub (or the repository is private)")
                if response.status in (403, 429):
                    raise RateLimited(f"{what}: GitHub refused (rate limit?); try again later", response.headers)
                if response.status != 200:
                    raise PackError("fetch_failed", f"{what}: GitHub answered {response.status}")
                return await _read(response, limit, what)
        except (aiohttp.ClientError, TimeoutError) as err:
            raise PackError("fetch_failed", f"{what}: {err or type(err).__name__}") from err
    raise PackError("fetch_failed", f"{what}: too many redirects")


async def _get_json(session: aiohttp.ClientSession, url: str, what: str) -> Any:
    body = await _get(session, url, MAX_API_BYTES, what)
    try:
        return json.loads(body)
    except ValueError as err:
        raise PackError("fetch_failed", f"{what}: GitHub sent no JSON") from err


def _byte_limit(path: str) -> int:
    """The largest download for a file of a pack folder: a language pack's texts may be larger than an item."""
    return MAX_STRINGS_BYTES if path == STRINGS_FILE else MAX_FILE_BYTES


def _hidden(path: str) -> bool:
    return any(part.startswith(".") for part in path.split("/"))


def _pack_folders(paths: list[str]) -> list[str]:
    """The folders below the fetched one that hold a pack.json (a repository with a folder per pack)."""
    return sorted(p.rsplit("/", 1)[0] for p in paths if p.endswith("/" + PACK_FILE))


async def fetch_pack(hass: HomeAssistant, url: str) -> tuple[dict[str, str], dict[str, Any]]:
    """Fetch the pack at a GitHub URL: its data files (relative path -> text, not yet checked by verify_folder)
    and its origin; raises PackError."""
    where = parse_url(url)
    session = async_get_clientsession(hass)
    api = f"https://api.github.com/repos/{where.owner}/{where.repo}"
    name = f"{where.owner}/{where.repo}"

    ref = where.ref
    if ref is None:
        repo = await _get_json(session, api, name)
        ref = repo.get("default_branch") if isinstance(repo, dict) else None
        if not isinstance(ref, str) or not _REF.match(ref):
            raise PackError("fetch_failed", f"{name}: GitHub named no usable default branch")
    commit = await _get_json(session, f"{api}/commits/{ref}", f'{name} at "{ref}"')
    try:
        sha = commit["sha"]
        tree_sha = commit["commit"]["tree"]["sha"]
    except (KeyError, TypeError) as err:
        raise PackError("fetch_failed", f'{name} at "{ref}": GitHub named no commit') from err
    if not (isinstance(sha, str) and _SHA.match(sha) and isinstance(tree_sha, str) and _SHA.match(tree_sha)):
        raise PackError("fetch_failed", f'{name} at "{ref}": GitHub named no commit')

    tree = await _get_json(session, f"{api}/git/trees/{tree_sha}?recursive=1", f"{name}: the file list")
    if not isinstance(tree, dict) or not isinstance(tree.get("tree"), list):
        raise PackError("fetch_failed", f"{name}: GitHub sent no file list")
    if tree.get("truncated"):
        raise PackError("too_large", f"{name}: the repository is too large to list; link the pack folder")
    prefix = f"{where.folder}/" if where.folder else ""
    sizes: dict[str, int] = {}
    folder_found = not where.folder
    for entry in tree["tree"]:
        path = entry.get("path") if isinstance(entry, dict) else None
        if not isinstance(path, str) or not path.startswith(prefix):
            if path == where.folder and entry.get("type") == "tree":
                folder_found = True
            continue
        folder_found = True
        if entry.get("type") != "blob":
            continue
        relative = path[len(prefix) :]
        if _hidden(relative):
            continue
        size = entry.get("size", 0)
        if isinstance(size, bool) or not isinstance(size, int) or size < 0:
            raise PackError("fetch_failed", f"{name}: GitHub sent no valid size for {relative}")
        sizes[relative] = size
    shown = f"{name}/{where.folder}" if where.folder else name
    if not folder_found:
        raise PackError("not_found", f'{name} has no folder "{where.folder}" at "{ref}"')
    if PACK_FILE not in sizes and (inner := _pack_folders(list(sizes))):
        listed = ", ".join(inner[:10]) + (" …" if len(inner) > 10 else "")
        raise PackError(
            "not_a_pack",
            f"{shown} holds several packs ({listed}); paste the URL of one pack folder, "
            f"e.g. https://github.com/{where.owner}/{where.repo}/tree/{ref}/{prefix}{inner[0]}",
        )
    if len(sizes) > MAX_FILES:
        raise PackError("too_many_items", f"{shown}: {len(sizes)} files, at most {MAX_FILES}")
    try:
        wanted = data_paths(list(sizes))
    except PackError as err:
        raise PackError(err.code, f"{shown}: {err.detail}") from err
    for path in wanted:
        if sizes[path] > (limit := _byte_limit(path)):
            raise PackError("too_large", f"{path}: {sizes[path]} bytes, at most {limit}")
    if (total := sum(sizes[p] for p in wanted)) > MAX_FOLDER_BYTES:
        raise PackError("too_large", f"{shown}: {total} bytes, at most {MAX_FOLDER_BYTES}")

    raw = f"https://raw.githubusercontent.com/{where.owner}/{where.repo}/{sha}/{prefix}"
    gate = asyncio.Semaphore(PARALLEL_DOWNLOADS)

    async def download(path: str) -> str:
        async with gate:
            body = await _get(session, raw + path, _byte_limit(path), path)
        try:
            return body.decode("utf-8")
        except UnicodeDecodeError as err:
            raise PackError("invalid_content", f"{path}: not UTF-8 text") from err

    texts = await asyncio.gather(*(download(path) for path in wanted))
    origin = {
        "type": "github",
        "url": GitHubPackUrl(where.owner, where.repo, where.ref, where.folder).url,
        "owner": where.owner,
        "repo": where.repo,
        # the branch, tag or commit the URL named, or the default branch when it named none
        "ref": ref,
        "default_branch": where.ref is None,
        "folder": where.folder,
        "commit": sha,
        "fetched_at": time.time(),
    }
    return dict(zip(wanted, texts, strict=True)), origin


# ---------------------------------------------------------------------------- update checks (#26)


async def latest_release(hass: HomeAssistant, origin: dict[str, Any]) -> tuple[str, dict[str, Any] | None]:
    """Where an installed pack's ref points now: the commit, and the pack's own pack.json there (None when the
    commit is the installed one: one request when nothing moved). A packs repository holds a folder per pack, so a new
    commit may change only other packs: the caller compares the pack's release, not the commit. Raises PackError."""
    session = async_get_clientsession(hass)
    name = f"{origin['owner']}/{origin['repo']}"
    api = f"https://api.github.com/repos/{name}"
    commit = await _get_json(session, f"{api}/commits/{origin['ref']}", f'{name} at "{origin["ref"]}"')
    sha = commit.get("sha") if isinstance(commit, dict) else None
    if not isinstance(sha, str) or not _SHA.match(sha):
        raise PackError("fetch_failed", f'{name} at "{origin["ref"]}": GitHub named no commit')
    if sha == origin["commit"]:
        return sha, None
    prefix = f"{origin['folder']}/" if origin["folder"] else ""
    body = await _get(
        session, f"https://raw.githubusercontent.com/{name}/{sha}/{prefix}{PACK_FILE}", MAX_FILE_BYTES, PACK_FILE
    )
    try:
        return sha, verify_pack_file(body.decode("utf-8"))
    except UnicodeDecodeError as err:
        raise PackError("invalid_content", f"{PACK_FILE}: not UTF-8 text") from err


# ---------------------------------------------------------------------------- the kept origin

ORIGIN_SCHEMA = vol.Schema(
    {
        vol.Required("type"): "github",
        vol.Required("url"): vol.All(str, vol.Length(max=500)),
        vol.Required("owner"): vol.All(str, vol.Match(_OWNER)),
        vol.Required("repo"): vol.All(str, vol.Match(_REPO)),
        vol.Required("ref"): vol.All(str, vol.Match(_REF)),
        vol.Required("default_branch"): bool,
        vol.Required("folder"): vol.All(str, vol.Length(max=400)),
        vol.Required("commit"): vol.All(str, vol.Match(_SHA)),
        vol.Optional("release"): vol.All(int, vol.Range(min=1, max=100000)),
        vol.Optional("fetched_at"): vol.Coerce(float),
    }
)


def checked_origin(origin: Any) -> dict[str, Any] | None:
    """The origin kept with a pack from a backup, or None when it is not one this version wrote (a later update
    check fetches from it, so it must name GitHub and nothing else)."""
    try:
        clean = ORIGIN_SCHEMA(origin)
    except vol.Invalid:
        return None
    try:
        url = parse_url(clean["url"]) if clean["url"].startswith("https://github.com/") else None
    except PackError:
        return None
    if url is None or (url.owner, url.repo, url.folder) != (clean["owner"], clean["repo"], clean["folder"]):
        return None
    return clean
