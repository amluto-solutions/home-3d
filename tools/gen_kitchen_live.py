"""Make our own kitchen items live (#467): doors, drawers, oven and fridge doors that move with Home Assistant.

    python tools/gen_kitchen_live.py [--check]

Reads the items of amluto.kitchen-bath (kitchen, appliance) and the kitchen and appliance items of amluto.ikea-uk,
asks tools/kitchen_live.py for their live version and writes the files again, then raises the two packs' release and
their release note. The item files are the source (they are hand-written); items that are live already are left alone,
so running it twice changes nothing. The L-shaped corner sink units come from tools/gen_kitchen_worktop.py, which calls
the same code, so its output has the same slots. `--check` writes nothing and exits 1 when an item still could be live.
"""

from __future__ import annotations

import json
from pathlib import Path
import sys

from kitchen_live import closed_look_kept, convert
from pack_builder import BUNDLED, dump_item

TARGETS = {
    "amluto.kitchen-bath": ("kitchen", "appliance"),
    "amluto.ikea-uk": ("kitchen", "appliance"),
}
NOTE = "Release {release}: kitchen doors, drawers and appliance doors move with Home Assistant (live parts, #467)."


def dump_indented(data: dict) -> str:
    """The layout of the IKEA pack's files: indented fields, one line a part."""
    head = {k: v for k, v in data.items() if k != "parts"}
    text = json.dumps(head, indent=2, ensure_ascii=False)[:-2]
    parts = ",\n".join("    " + json.dumps(p, separators=(", ", ": "), ensure_ascii=False) for p in data["parts"])
    return text + ',\n  "parts": [\n' + parts + "\n  ]\n}\n"


def writer(path: Path, item: dict):
    """The function that writes `item` in the layout `path` has now (so the diff holds only the change)."""
    raw = path.read_bytes()
    for dump in (dump_item, dump_indented):
        if dump(item).encode("utf-8") == raw:
            return dump
    raise SystemExit(f"{path.name}: not in a layout this tool writes")


def run(check: bool = False) -> int:
    changed: dict[str, int] = {}
    for pack, groups in TARGETS.items():
        for group in groups:
            for path in sorted((BUNDLED / pack / group).glob("*.json")):
                item = json.loads(path.read_text(encoding="utf-8"))
                live = convert(item)
                if live is None:
                    continue
                if not closed_look_kept(item, live):
                    raise SystemExit(f"{path.name}: the closed look would change")
                dump = writer(path, item)
                changed[pack] = changed.get(pack, 0) + 1
                if not check:
                    path.write_bytes(dump(live).encode("utf-8"))
    for pack, count in changed.items():
        print(f"{pack}: {count} items made live")
        if check:
            continue
        meta_path = BUNDLED / pack / "pack.json"
        meta = json.loads(meta_path.read_text(encoding="utf-8"))
        meta["release"] += 1
        meta["release_note"] = NOTE.format(release=meta["release"])
        meta_path.write_bytes((json.dumps(meta, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    return 1 if (check and changed) else 0


if __name__ == "__main__":
    sys.exit(run("--check" in sys.argv))
