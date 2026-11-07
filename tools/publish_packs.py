"""Publish the packs that ship with Home 3D into a checkout of the packs repository (#27).

    python tools/publish_packs.py PACKS_CHECKOUT [--source BUNDLED_PACKS_FOLDER]

Every pack folder in custom_components/home_3d/bundled_packs/ is checked first with the same schema and limits Home
Assistant uses on import (tools/fp3dpack.py), and a pack whose content differs from its copy in the checkout must have
a higher `release` than that copy: the update check compares releases only. If any pack fails, nothing is written.
Otherwise each pack folder is copied into the checkout (files that are gone from the pack are removed from its copy),
and README.md, NOTICE and LICENSE at the top of the checkout are written again. Git data and folders of other packs
in the checkout are left alone. When the checkout has tools/build_index.py (#336), index.json (the list the Library's
Browse packs tab shows) is built again from the packs, keeping the community entries it lists. Commit, push and tag
the checkout yourself; see docs/packs.md ("Publishing the packs").

A pack with an item field that older Home 3D versions refuse (HELD_FIELDS) is held back: it is left out of the
checkout, README and index until those versions read the field, and listed as held.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parent.parent
BUNDLED_DIR = ROOT / "custom_components" / "home_3d" / "bundled_packs"
MOVES_FILE = ROOT / "custom_components" / "home_3d" / "moved_items.json"
REPO = "amluto-solutions/home-3d-packs"
BRANCH = "main"
# the pack whose licence text becomes the licence of the whole repository (else the first pack that has one)
LICENCE_PACK = "amluto.living"
# Item fields older Home 3D versions do not read: their item check refuses an unknown field, so an update to a pack
# with one would fail there. `role_names` (#411) came in 1.2.0; the packs that use it (Living, Office & tech,
# Smart-home devices) stay out of the packs repository until older versions can read it (#424).
HELD_FIELDS = ("role_names",)

IKEA_PACK = "amluto.ikea-uk"
IKEA_NOTICE = (
    "IKEA is a trademark of Inter IKEA Systems B.V. The IKEA UK pack (amluto.ikea-uk/) names IKEA products only\n"
    "so they can be found; its models are our own work, built from simple shapes. Home 3D is not affiliated with,\n"
    "sponsored by or endorsed by IKEA or Inter IKEA Systems B.V."
)

_spec = importlib.util.spec_from_file_location("fp3dpack", Path(__file__).resolve().parent / "fp3dpack.py")
assert _spec and _spec.loader
fp3dpack = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(fp3dpack)


class PublishError(Exception):
    """Nothing was published."""


def _pack_folders(source: Path) -> list[Path]:
    return sorted(
        p for p in source.iterdir() if p.is_dir() and not p.name.startswith(".") and (p / "pack.json").exists()
    )


def _checked(source: Path) -> list[tuple[Path, dict]]:
    folders = _pack_folders(source)
    if not folders:
        raise PublishError(f"no pack folders (with a pack.json) in {source}")
    problems: list[str] = []
    checked: list[tuple[Path, dict]] = []
    for folder in folders:
        try:
            pack = fp3dpack.check(folder)
        except fp3dpack.packs.PackError as err:
            problems.append(f"{folder.name}: {err}")
            continue
        if pack["id"] != folder.name:
            problems.append(f"{folder.name}: the folder must be named after the pack id {pack['id']}")
            continue
        checked.append((folder, pack))
    if problems:
        raise PublishError("not published, these packs fail the check:\n  " + "\n  ".join(problems))
    return checked


def _content(pack: dict) -> str:
    """What a pack holds apart from its release."""
    return json.dumps({k: v for k, v in pack.items() if k != "release"}, sort_keys=True)


def _not_bumped(checked: list[tuple[Path, dict]], target: Path) -> list[str]:
    """The packs that changed since their copy in the checkout without a higher release (#47): the update check
    would never offer the change."""
    problems: list[str] = []
    for folder, pack in checked:
        published = target / folder.name
        if not (published / "pack.json").exists():
            continue
        try:
            before = fp3dpack.check(published)
        except fp3dpack.packs.PackError:
            # a copy this version cannot read: compare by its release alone
            release = json.loads((published / "pack.json").read_text(encoding="utf-8")).get("release", 1)
            before = {"release": release, "content": None}
        if _content(before) != _content(pack) and pack["release"] <= before.get("release", 1):
            problems.append(
                f"{folder.name}: the content changed, so its release must go above {before.get('release', 1)}"
            )
    return problems


def _plural(count: int, word: str) -> str:
    return f"{count} {word}" + ("" if count == 1 else "s")


def readme(packs: list[dict]) -> str:
    lines = [
        "# Home 3D packs",
        "",
        "Furniture packs for [Home 3D](https://github.com/amluto-solutions/home-3d), a floor plan and 3D room planner",
        "for Home Assistant. One folder per pack. All packs are MIT licensed (see `LICENSE`).",
        "",
        "Home 3D already ships with these packs and works offline. The copies here let you update a pack without",
        "waiting for a new Home 3D version: Home 3D checks each pack's own `release` number and offers a newer one.",
        "",
        "## Packs",
        "",
    ]
    for pack in packs:
        url = f"https://github.com/{REPO}/tree/{BRANCH}/{pack['id']}"
        lines += [
            f"### {pack['name']}",
            "",
            f"- Pack id: `{pack['id']}`",
            f"- {_plural(len(pack['items']), 'item')}, release {pack['release']}, licence {pack['licence']}",
            f"- Install URL: {url}",
        ]
        if pack.get("description"):
            lines += ["", pack["description"]]
        lines.append("")
    lines += [
        "## Install a pack",
        "",
        "In Home 3D's editor open the Library's **Browse packs** tab, pick a pack and choose **Install**. It lists our",
        "packs and community packs (`index.json`).",
        "",
        "Or open **Extensions**, choose **Install from GitHub**, paste a pack's install URL and confirm. Home",
        "Assistant downloads and checks the pack; nothing else is fetched. Pasting the repository URL",
        f"(`https://github.com/{REPO}`) lists the packs and asks for one folder URL.",
        "",
        "## Get your pack listed",
        "",
        "Made a pack? Add it to `community.json` by pull request and it shows under Browse packs. CI checks every",
        "listed pack: MIT licence, Home 3D's pack check, a unique id, data only. See `CONTRIBUTING.md`.",
        "",
        "## Update a pack",
        "",
        "The update check compares each installed pack's `release` in its `pack.json` with the one here, so a new",
        "release of one pack does not show as an update for the others.",
        "",
        "## Contributing and format",
        "",
        "The pack format is described in the Home 3D repository (`docs/packs.md`). These folders are generated from",
        "the packs in Home 3D with `tools/publish_packs.py`; send changes to Home 3D rather than editing them here.",
    ]
    if any(p["id"] == IKEA_PACK for p in packs):
        lines += ["", "## Trademarks", "", IKEA_NOTICE.replace("\n", " ")]
    return "\n".join(lines) + "\n"


def notice(packs: list[dict]) -> str:
    text = (
        "Home 3D packs\nCopyright (c) 2026 Amluto Solutions Ltd\n\n"
        "The furniture packs in this repository are original work, published under the MIT License (LICENSE).\n"
    )
    if any(p["id"] == IKEA_PACK for p in packs):
        text += "\n" + IKEA_NOTICE + "\n"
    return text


def _copy_pack(folder: Path, destination: Path) -> None:
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(folder, destination, ignore=shutil.ignore_patterns(".*", "__pycache__"))


def _retire(target: Path, published: list[str], moves_file: Path) -> list[str]:
    """Replace the folder of every pack that items moved out of (moved_items.json) and that is no longer published
    by a README pointing at the packs its items went to; returns the retired pack ids."""
    table = json.loads(moves_file.read_text(encoding="utf-8")).get("moved", {})
    successors: dict[str, set[str]] = {}
    for old, new in table.items():
        old_pack, new_pack = old.split(":")[1], new.split(":")[1]
        successors.setdefault(old_pack, set()).add(new_pack)
    retired = []
    for pack_id, new_packs in sorted(successors.items()):
        if pack_id in published or not (target / pack_id).is_dir():
            continue
        shutil.rmtree(target / pack_id)
        (target / pack_id).mkdir()
        lines = [
            f"# {pack_id} (retired)",
            "",
            "This pack was split into themed packs and retired. Its items kept their ids; Home 3D moves plans over by",
            "itself. Install the packs you want instead:",
            "",
            *[f"- https://github.com/{REPO}/tree/{BRANCH}/{p}" for p in sorted(new_packs - {pack_id})],
        ]
        (target / pack_id / "README.md").write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
        retired.append(pack_id)
    return retired


def held_back(pack: dict) -> list[str]:
    """The HELD_FIELDS a pack's items use (none: it is published)."""
    return sorted({field for item in pack.get("items", []) for field in HELD_FIELDS if field in item})


def publish(target: Path, source: Path = BUNDLED_DIR, moves_file: Path | None = None) -> list[str]:
    """Copy the packs in `source` into the checkout `target`; returns the published pack ids. Packs held back
    (held_back) are left out. With `moves_file` (the moved-items table), packs that were retired are replaced by a
    README. Raises PublishError, with nothing written, if any pack fails the check."""
    checked = [(folder, pack) for folder, pack in _checked(source) if not held_back(pack)]
    if not target.is_dir():
        raise PublishError(f"{target} is not a folder")
    if problems := _not_bumped(checked, target):
        raise PublishError("not published, these packs need a new release:\n  " + "\n  ".join(problems))
    for folder, _ in checked:
        _copy_pack(folder, target / folder.name)
    packs = [pack for _, pack in checked]
    (target / "README.md").write_text(readme(packs), encoding="utf-8", newline="\n")
    (target / "NOTICE").write_text(notice(packs), encoding="utf-8", newline="\n")
    licences = [
        f / "LICENSE" for f, p in sorted(checked, key=lambda c: c[1]["id"] != LICENCE_PACK) if (f / "LICENSE").exists()
    ]
    if licences:
        shutil.copyfile(licences[0], target / "LICENSE")
    if moves_file:
        _retire(target, [pack["id"] for pack in packs], moves_file)
    rebuild_index(target)
    return [pack["id"] for pack in packs]


def rebuild_index(target: Path) -> bool:
    """Build the checkout's index.json again with its own tools/build_index.py (#336), checking the packs with this
    repository's pack check; False when the checkout has no such script. Raises PublishError when the index fails."""
    script = target / "tools" / "build_index.py"
    if not script.is_file():
        return False
    done = subprocess.run(
        [sys.executable, str(script), "build", str(target), "--home3d", str(ROOT)],
        capture_output=True,
        text=True,
        check=False,
    )
    if done.returncode != 0:
        raise PublishError(f"the packs were copied, but index.json was not built: {done.stderr or done.stdout}")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("target", type=Path, help="a checkout of the packs repository")
    parser.add_argument("--source", type=Path, default=BUNDLED_DIR, help="folder holding the pack folders")
    args = parser.parse_args()
    try:
        published = publish(args.target, args.source, MOVES_FILE)
    except PublishError as err:
        sys.exit(str(err))
    print(f"published {len(published)} packs into {args.target}: {', '.join(published)}")
    for _, pack in _checked(args.source):
        if fields := held_back(pack):
            print(f"held back {pack['id']}: older Home 3D versions do not read {', '.join(fields)}")


if __name__ == "__main__":
    main()
