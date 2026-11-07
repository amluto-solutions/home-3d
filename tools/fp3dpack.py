"""Check furniture packs for Home 3D before you import or publish them.

    python tools/fp3dpack.py validate PACK_FOLDER [PACK_FOLDER ...]
        Checks a v2 pack folder (pack.json and one JSON file per item, see docs/packs.md) with the same schema and
        limits Home Assistant uses on import, and prints a short summary.

    python tools/fp3dpack.py validate OLD_PACK.json
        Checks an old single-file pack (format "fp3dpack", version 1) the same way.

Exits with an error when anything does not validate. Needs the package "voluptuous".
"""

from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent.parent
_spec = importlib.util.spec_from_file_location("fp3d_packs", ROOT / "custom_components" / "home_3d" / "packs.py")
assert _spec and _spec.loader
packs = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(packs)


read_folder = packs.read_folder


def check(path: Path) -> dict:
    """The checked pack at a path (a folder or an old single file); raises packs.PackError."""
    if path.is_dir():
        return packs.verify_folder(read_folder(path))
    return packs.verify_pack(path.read_text(encoding="utf-8"))


def validate(paths: list[Path]) -> None:
    failed = False
    for path in paths:
        try:
            pack = check(path)
        except packs.PackError as err:
            print(f"{path}: invalid: {err}")
            failed = True
            continue
        licence = pack["licence"] or "no licence (old pack)"
        # a language pack (#196) holds texts, not items
        content = (
            f"{len(pack['strings'])} texts ({pack['language']})"
            if packs.is_language_pack(pack)
            else f"{len(pack['items'])} items"
        )
        print(
            f'{path}: ok: {pack["id"]} "{pack["name"]}" by {pack["publisher"]}, {content},'
            f" release {pack['release']}, {licence}"
        )
    if failed:
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("validate", aliases=["verify"])
    p.add_argument("paths", type=Path, nargs="+")
    args = parser.parse_args()
    validate(args.paths)


if __name__ == "__main__":
    main()
