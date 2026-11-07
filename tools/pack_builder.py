"""Shared helpers for the generators of our own garden packs (gen_plants.py, gen_hardscape.py).

Parts are written in metres relative to the item's centre on the floor (x across, z in depth with the front at +z,
y up from the floor) and turned into the fractions of the item's size that the pack format wants.
"""

from __future__ import annotations

import json
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
BUNDLED = ROOT / "custom_components" / "home_3d" / "bundled_packs"
LICENCE_SOURCE = BUNDLED / "amluto.outdoor" / "LICENSE"


def _f(v: float) -> float:
    return round(v, 4)


def _clamp(v: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, v))


class Item:
    """One pack item under construction."""

    def __init__(self, item_id: str, name: str, size: tuple[float, float, float], group: str) -> None:
        self.id = item_id
        self.name = name
        self.W, self.D, self.H = (round(s, 3) for s in size)
        self.group = group
        self.parts: list[dict] = []
        self.symbol: list[dict] = []
        self.meta: dict = {}

    def p(
        self,
        shape: str,
        cx: float,
        cz: float,
        w: float,
        d: float,
        y: float,
        h: float,
        color: str,
        *,
        tx: float | None = None,
        tz: float | None = None,
        tw: float | None = None,
        td: float | None = None,
        **kw,
    ) -> None:
        W, D, H = self.W, self.D, self.H
        part: dict = {
            "shape": shape,
            "x": _f(_clamp(cx / W, -0.5, 0.5)),
            "z": _f(_clamp(cz / D, -0.5, 0.5)),
            "w": _f(_clamp(w / W, 0.001, 1)),
            "d": _f(_clamp(d / D, 0.001, 1)),
            "y": _f(_clamp(y / H, 0, 1)),
            "h": _f(_clamp(h / H, 0.001, 1)),
            "color": color,
        }
        if shape == "loft":
            part["tx"] = _f(_clamp((cx if tx is None else tx) / W, -0.5, 0.5))
            part["tz"] = _f(_clamp((cz if tz is None else tz) / D, -0.5, 0.5))
            part["tw"] = _f(_clamp((w if tw is None else tw) / W, 0.001, 1))
            part["td"] = _f(_clamp((d if td is None else td) / D, 0.001, 1))
        part.update(kw)
        self.parts.append(part)

    def box(self, *a, **k) -> None:
        self.p("box", *a, **k)

    def cyl(self, *a, **k) -> None:
        self.p("cyl", *a, **k)

    def sphere(self, *a, **k) -> None:
        self.p("sphere", *a, **k)

    def circle_symbol(self, r: float = 0.5) -> None:
        self.symbol = [{"shape": "circle", "x": 0, "z": 0, "r": r}]

    def rect_symbol(self, fill: bool = True) -> None:
        self.symbol = [{"shape": "rect", "x": 0, "z": 0, "w": 1, "d": 1, "fill": fill}]

    def data(self) -> dict:
        out: dict = {
            "id": self.id,
            "name": {"en": self.name},
            "size": [self.W, self.D, self.H],
            "group": self.group,
        }
        out.update(self.meta)
        out["parts"] = self.parts
        if self.symbol:
            out["symbol"] = self.symbol
        return out


def _compact(obj) -> str:
    return json.dumps(obj, separators=(", ", ": "), ensure_ascii=False)


def dump_item(data: dict) -> str:
    lines = ["{"]
    keys = [k for k in data if k not in ("parts", "symbol")]
    for k in keys:
        lines.append(f'  "{k}": {_compact(data[k])},')
    lines.append('  "parts": [')
    lines.append(",\n".join("    " + _compact(p) for p in data["parts"]))
    lines.append("  ]" + ("," if data.get("symbol") else ""))
    if data.get("symbol"):
        lines.append('  "symbol": [')
        lines.append(",\n".join("    " + _compact(s) for s in data["symbol"]))
        lines.append("  ]")
    lines.append("}")
    return "\n".join(lines) + "\n"


def write_pack(pack_id: str, name: str, description: str, items: list[Item]) -> None:
    """Write the whole pack folder again (the old copy is removed first)."""
    folder = BUNDLED / pack_id
    if folder.exists():
        shutil.rmtree(folder)
    folder.mkdir(parents=True)
    pack = {
        "format": "home3d-pack",
        "version": 2,
        "id": pack_id,
        "name": name,
        "publisher": "Amluto Solutions",
        "licence": "MIT",
        "release": 1,
        "description": description,
    }
    (folder / "pack.json").write_text(json.dumps(pack, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    shutil.copyfile(LICENCE_SOURCE, folder / "LICENSE")
    seen: set[str] = set()
    for it in items:
        if it.id in seen:
            raise SystemExit(f"duplicate item id {it.id}")
        seen.add(it.id)
        if len(it.parts) > 60:
            raise SystemExit(f"{it.id}: {len(it.parts)} parts")
        sub = folder / it.group
        sub.mkdir(exist_ok=True)
        (sub / f"{it.id}.json").write_bytes(dump_item(it.data()).encode("utf-8"))
    print(f"{pack_id}: {len(items)} items")


def add_items(pack_id: str, items: list[Item], release: int, note: str) -> None:
    """Add (or rewrite) items in an existing bundled pack and set its release and `release_note`.

    Unlike `write_pack` the folder is not cleared: the pack's other items stay as they are.
    """
    folder = BUNDLED / pack_id
    if not (folder / "pack.json").exists():
        raise SystemExit(f"{pack_id} does not exist")
    seen: set[str] = set()
    for it in items:
        if it.id in seen:
            raise SystemExit(f"duplicate item id {it.id}")
        seen.add(it.id)
        if len(it.parts) > 60:
            raise SystemExit(f"{it.id}: {len(it.parts)} parts")
        sub = folder / it.group
        sub.mkdir(exist_ok=True)
        (sub / f"{it.id}.json").write_bytes(dump_item(it.data()).encode("utf-8"))
    meta = json.loads((folder / "pack.json").read_text(encoding="utf-8"))
    meta["release"] = release
    meta["release_note"] = note
    (folder / "pack.json").write_bytes((json.dumps(meta, indent=2, ensure_ascii=False) + "\n").encode("utf-8"))
    print(f"{pack_id}: {len(items)} items added or rewritten, release {release}")
