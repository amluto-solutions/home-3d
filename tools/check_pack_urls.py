"""Check that packs install by URL from real GitHub, with the code Home Assistant uses (needs the network).

    python tools/check_pack_urls.py [REPO_URL] [PACK_ID ...]

Defaults to https://github.com/amluto-solutions/home-3d-packs and the packs amluto.bedroom and amluto.ikea-uk
(Living is held back from the packs repository for now: tools/publish_packs.py HELD_FIELDS).
For each pack it fetches the folder URL (<repo>/tree/main/<pack id>) with custom_components/home_3d/pack_github.py,
checks the files with the pack schema, and runs the update check against an older commit. It also checks that the
repository URL alone is refused with the folder URLs. Exits with an error when anything fails. Run it where
Home Assistant's packages are installed (the project's test virtualenv).
"""

from __future__ import annotations

import asyncio
from pathlib import Path
import sys
from types import SimpleNamespace

import aiohttp

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from custom_components.home_3d import pack_github, packs

DEFAULT_REPO = "https://github.com/amluto-solutions/home-3d-packs"
DEFAULT_PACKS = ["amluto.bedroom", "amluto.ikea-uk"]


async def check(repo: str, pack_ids: list[str]) -> bool:
    ok = True
    async with aiohttp.ClientSession() as session:
        # fetch_pack takes Home Assistant's shared session; give it a plain one
        pack_github.async_get_clientsession = lambda _hass: session
        hass = SimpleNamespace()
        for pack_id in pack_ids:
            url = f"{repo}/tree/main/{pack_id}"
            try:
                files, origin = await pack_github.fetch_pack(hass, url)
                pack = packs.verify_folder(files)
                if pack["id"] != pack_id:
                    raise packs.PackError("invalid_content", f"the folder holds {pack['id']}")
                sha, latest = await pack_github.latest_release(hass, {**origin, "commit": "0" * 40})
                if sha != origin["commit"] or latest is None or latest["id"] != pack_id:
                    raise packs.PackError("fetch_failed", "the update check did not read the pack's own pack.json")
                print(
                    f"ok    {url}: {pack['id']}, {len(pack['items'])} items, release {pack['release']},"
                    f" {pack['licence']}, commit {origin['commit'][:7]}, update check reads release {latest['release']}"
                )
            except packs.PackError as err:
                ok = False
                print(f"FAIL  {url}: {err.code}: {err.detail}")
        try:
            await pack_github.fetch_pack(hass, repo)
            ok = False
            print(f"FAIL  {repo}: installed although it holds several packs")
        except packs.PackError as err:
            # the refusal lists at most 10 folders (pack_github.py)
            shown = sum(pack_id in err.detail for pack_id in pack_ids)
            good = err.code == "not_a_pack" and shown >= min(10, len(pack_ids))
            ok = ok and good
            print(f"{'ok  ' if good else 'FAIL'}  {repo}: refused ({err.code}), folders listed")
    return ok


def main() -> None:
    args = sys.argv[1:]
    repo = args[0] if args and args[0].startswith("https://") else DEFAULT_REPO
    pack_ids = [a for a in args if not a.startswith("https://")] or DEFAULT_PACKS
    if not asyncio.run(check(repo, pack_ids)):
        sys.exit(1)


if __name__ == "__main__":
    main()
