"""The rooms and doors locating works with, read from a plan (#169).

Locating used to learn them only from an admin's browser (the locating settings), so a room added, renamed or removed
in the editor, or another home made active, left it with the old rooms. The service now reads them from the active
home's plan whenever that changes.

The door graph is the browser's (locate/graph.ts doorPairs) worked out without the wall geometry: a door, a passage or
a window down to the floor joins the rooms found a short step to either side of it.
"""

from __future__ import annotations

import math
from typing import Any

# how far to each side of an opening the rooms it joins are looked for (m): past half of a thick wall, and once more
# for rooms drawn with a gap between them
_PROBES = (0.2, 0.4)
# a window this low (m) is a way through, like the browser's door graph counts it
_LOW_SILL = 0.1

Point = tuple[float, float]


def plan_rooms(building: dict[str, Any]) -> list[dict[str, Any]]:
    """Every room of the plan as locating keeps it: id, name, the floor's name and the linked area."""
    return [
        {
            "id": str(room["id"]),
            "name": str(room.get("name") or ""),
            "floor": floor.get("name"),
            "area_id": room.get("area_id"),
        }
        for floor in building.get("floors") or []
        for room in floor.get("rooms") or []
        if isinstance(room, dict) and room.get("id")
    ]


def _inside(point: Point, polygon: list[Point]) -> bool:
    x, z = point
    inside = False
    for i, (ax, az) in enumerate(polygon):
        bx, bz = polygon[i - 1]
        if (az > z) != (bz > z) and x < (bx - ax) * (z - az) / (bz - az) + ax:
            inside = not inside
    return inside


def _opening_at(opening: dict[str, Any], rooms: dict[str, list[Point]], walls: dict[str, Any]) -> tuple[Point, Point]:
    """Where an opening is and the direction of its wall; raises KeyError/IndexError/ValueError when it has no host."""
    if opening.get("wall"):
        wall = walls[opening["wall"]]
        a, b = (float(wall["a"][0]), float(wall["a"][1])), (float(wall["b"][0]), float(wall["b"][1]))
    else:
        points = rooms[opening["room_id"]]
        edge = int(opening["edge"])
        if edge >= len(points):
            raise IndexError(edge)
        a, b = points[edge], points[(edge + 1) % len(points)]
    length = math.hypot(b[0] - a[0], b[1] - a[1])
    if length < 1e-6:
        raise ValueError("an edge without length")
    d = ((b[0] - a[0]) / length, (b[1] - a[1]) / length)
    offset = float(opening.get("offset") or 0)
    return (a[0] + d[0] * offset, a[1] + d[1] * offset), d


def plan_doors(building: dict[str, Any]) -> list[tuple[str, str]]:
    """The pairs of rooms joined by a door, a passage or a window down to the floor, each pair once."""
    out: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for floor in building.get("floors") or []:
        rooms = {
            str(r["id"]): [(float(p[0]), float(p[1])) for p in r.get("points") or []]
            for r in floor.get("rooms") or []
            if isinstance(r, dict) and r.get("id")
        }
        rooms = {k: v for k, v in rooms.items() if len(v) >= 3}
        walls = {w["id"]: w for w in floor.get("walls") or [] if isinstance(w, dict) and w.get("id")}
        for opening in floor.get("openings") or []:
            if opening.get("type") == "window" and not float(opening.get("sill") or 0) < _LOW_SILL:
                continue
            try:
                (x, z), (dx, dz) = _opening_at(opening, rooms, walls)
            except (KeyError, IndexError, ValueError, TypeError):
                continue
            sides: list[str | None] = []
            for sign in (1, -1):
                found = None
                for probe in _PROBES:
                    point = (x - dz * probe * sign, z + dx * probe * sign)
                    found = next((rid for rid, poly in rooms.items() if _inside(point, poly)), None)
                    if found is not None:
                        break
                sides.append(found)
            a, b = sides
            if a is None or b is None or a == b:
                continue
            key = (a, b) if a < b else (b, a)
            if key not in seen:
                seen.add(key)
                out.append((a, b))
    return out
