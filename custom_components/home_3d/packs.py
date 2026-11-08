"""Furniture packs: data-only JSON, furniture models built from boxes, cylinders, lofts, spheres, lathes, rounded
boxes and curved shells.

A pack (format v2, see docs/packs.md) is a folder: a pack.json naming the pack, its publisher and its licence, and
one JSON file per item, in subfolders if wanted. The pack id is "publisher.pack", an item's full id
"publisher.pack/item_id". verify_folder() checks every file against the schemas below, within limits (item count,
parts per item, file size), and refuses anything else: packs carry no code, pictures or links.

Old single-file packs (format "fp3dpack", version 1) still import through verify_pack().

This module only depends on voluptuous, so tools/fp3dpack.py (which checks packs) uses the same schema.
"""

from __future__ import annotations

import hashlib
import itertools
import json
import logging
from pathlib import Path
import re
from typing import Any

import voluptuous as vol

_LOGGER = logging.getLogger(__name__)

# The lists and limits of an item. The item editor's brief for an LLM (frontend/src/item-format.ts, #14) states the
# same ones, and a frontend test reads them from here, so keep these names and keep each a plain literal.
PART_SHAPES = ["box", "cyl", "loft", "sphere", "lathe", "rbox", "shell"]
COLOUR_ROLES = [
    "body",
    "fabric",
    "cushion",
    "wood",
    "white",
    "metal",
    "dark",
    "glass",
    "plant",
    "pot",
    "accent",
    "paint",
]
# what an item may call the part drawn in a colour role (`role_names`, #411): the names of its colour rows in the panel
PART_NAMES = [
    "main",
    "second",
    "third",
    "details",
    "paint",
    "trim",
    "tyres",
    "tyres_trim",
    "wheels",
    "windows",
    "lights",
    "frame",
    "legs",
    "seat",
    "fabric",
    "cushion",
    "wood",
    "metal",
    "glass",
    "plant",
    "pot",
    "case",
    "panels",
    "valves",
    "grille",
    "buttons",
    "screen",
    "top",
    "base",
    "fronts",
    "handles",
    "shade",
]
MOUNTS = ["floor", "surface", "wall", "ceiling"]
LIGHTS = [
    "ceiling",
    "downlight",
    "spot",
    "panel",
    "pendant",
    "floor",
    "uplight",
    "table",
    "wall",
    "strip",
    "bollard",
    "garden",
]
MAX_PARTS = 60
MAX_NAME_LENGTH = 80
MAX_ROOMS = 12
MAX_TAGS = 12
MAX_TAG_LENGTH = 30
METRES_RANGE = (0.01, 10)
FRACTION_RANGE = (-0.5, 0.5)
SPAN_RANGE = (0.001, 1)
LEVEL_RANGE = (0, 1)
WALL_Y_RANGE = (0, 3)
ROT_RANGE = (-360, 360)


def _range(limits: tuple[float, float]) -> vol.All:
    """A number from limits[0] to limits[1]."""
    return vol.All(vol.Coerce(float), vol.Range(min=limits[0], max=limits[1]))


_ID = vol.All(str, vol.Match(r"^[a-z0-9][a-z0-9_.-]{0,39}$"))
_TEXT = vol.All(str, vol.Length(min=1, max=MAX_NAME_LENGTH))
# a colour: "#rrggbb" or a role of the built-in palette (so packs follow the look of the plan)
_COLOR = vol.Any(
    vol.Match(r"^#[0-9a-fA-F]{6}$"),
    vol.In(COLOUR_ROLES),
)
_FRACTION = _range(FRACTION_RANGE)
_SPAN = _range(SPAN_RANGE)
_LEVEL = _range(LEVEL_RANGE)
_METRES = _range(METRES_RANGE)

# A lathe's profile: [radius, height] points turned around the part's upright axis (#4). The radius is a fraction of
# the part's half width and half depth (1 touches the part's box), the height a fraction of the part's height.
# At most 12 points keeps a turned part low-poly on wall tablets.
MAX_PROFILE_POINTS = 12
_PROFILE = vol.All(
    [vol.All([_LEVEL], vol.Length(min=2, max=2))],
    vol.Length(min=2, max=MAX_PROFILE_POINTS),
)
# A rounded box: the radius of its rounded edges as a fraction of the part's shortest side (0.5: fully round)
ROUND_RANGE = (0.01, 0.5)
_ROUND = _range(ROUND_RANGE)

# A curved shell (#252): a body lofted through cross-sections, for car bodies and the like. `side` is its side view as
# stations [z, bottom, top] from the part's back (z 0) to its front (z 1), the heights fractions of the part's height;
# `plan` its plan view as [z, width], the width a fraction of the part's width (default: the whole width). Between the
# stations both run as smooth curves. Each cross-section is a rectangle with rounded corners (`round`, default 0.25 of
# its shorter side), its top `taper` times as wide as its bottom (default 1). 16 stations at most keeps it low-poly.
MAX_SHELL_POINTS = 16
TAPER_RANGE = (0.1, 1.5)
_SIDE = vol.All(
    [vol.All([_LEVEL], vol.Length(min=3, max=3))],
    vol.Length(min=2, max=MAX_SHELL_POINTS),
)
_PLAN = vol.All(
    [vol.All([_LEVEL], vol.Length(min=2, max=2))],
    vol.Length(min=2, max=MAX_SHELL_POINTS),
)


def _rising(points: list[list[float]], path: str) -> None:
    """Stations along a shell run from its back to its front: z never goes down."""
    for before, after in itertools.pairwise(points):
        if after[0] < before[0]:
            raise vol.Invalid("a shell's stations run from z 0 (back) to z 1 (front)", path=[path])


def _shape_fields(part: dict[str, Any]) -> dict[str, Any]:
    """A lathe has a profile and only a lathe; only a rounded box or a shell has a rounding; a shell has a side view
    and only a shell has one, a plan or a taper."""
    if (part["shape"] == "lathe") != ("profile" in part):
        raise vol.Invalid("a lathe part needs a profile, and only a lathe part has one", path=["profile"])
    if "round" in part and part["shape"] not in ("rbox", "shell"):
        raise vol.Invalid("only a rounded box (rbox) or a shell part has a rounding", path=["round"])
    if (part["shape"] == "shell") != ("side" in part):
        raise vol.Invalid("a shell part needs a side view, and only a shell part has one", path=["side"])
    for key in ("plan", "taper"):
        if key in part and part["shape"] != "shell":
            raise vol.Invalid(f"only a shell part has a {key}", path=[key])
    if part["shape"] == "shell":
        _rising(part["side"], "side")
        if any(top < bottom for _z, bottom, top in part["side"]):
            raise vol.Invalid("a shell's top is above its bottom at every station", path=["side"])
        _rising(part.get("plan", []), "plan")
    return part


# Parts in fractions of the item's size: x/z centre (-0.5..0.5, front at +z), w/d extent, y/h bottom
# and height of the item height. A cylinder's diameter is the smaller of w and d; a sphere, a lathe and a rounded
# box fill their part box (squashed when w, d and h differ).
_PART_FIELDS = vol.Schema(
    {
        vol.Required("shape"): vol.In(PART_SHAPES),
        vol.Required("x"): _FRACTION,
        vol.Required("z"): _FRACTION,
        vol.Required("w"): _SPAN,
        vol.Required("d"): _SPAN,
        vol.Required("y"): _LEVEL,
        vol.Required("h"): _SPAN,
        vol.Required("color"): _COLOR,
        vol.Optional("top"): _COLOR,
        # outline: True (soft blue), "glow" (cyan like the walls) or "faint"
        vol.Optional("edges", default=False): vol.Any(bool, vol.In(["glow", "faint"])),
        # lamps: the part shines in the colour and brightness of the linked light
        vol.Optional("glow", default=False): bool,
        # a screen (TV, monitor): shows the linked media player's app colour and picture on its front (+z)
        vol.Optional("screen", default=False): bool,
        # loft: centre and extent of the top rectangle (default: the same as the bottom)
        vol.Optional("tx"): _FRACTION,
        vol.Optional("tz"): _FRACTION,
        vol.Optional("tw"): _SPAN,
        vol.Optional("td"): _SPAN,
        # cylinder axis: upright (default) or lying along x or z (wheels, rollers)
        vol.Optional("axis"): vol.In(["x", "y", "z"]),
        # turn of the part around its own centre (degrees around the vertical axis): spiral steps, diagonals
        vol.Optional("rot"): _range(ROT_RANGE),
        # free sizes (1.23): the measures that stay when the item is resized ("w", "d", "h" or several): legs,
        # arms and plates keep their size and their distance from the edge, the parts between them stretch
        vol.Optional("fix"): vol.All(str, vol.Match(r"^[wdh]{1,3}$")),
        # lathe: the profile turned around the upright axis (vases, lamp bases, bowls)
        vol.Optional("profile"): _PROFILE,
        # rounded box: the radius of its edges (default 0.2 of the shortest side); shell: of its cross-sections' corners
        vol.Optional("round"): _ROUND,
        # shell (#252): side view [z, bottom, top], plan view [z, width] and taper of its cross-sections
        vol.Optional("side"): _SIDE,
        vol.Optional("plan"): _PLAN,
        vol.Optional("taper"): _range(TAPER_RANGE),
    }
)
PART_SCHEMA = vol.All(_PART_FIELDS, _shape_fields)

# Plan symbol in the same fractions (optional: without it the parts are drawn from above).
SYMBOL_SCHEMA = vol.Any(
    vol.Schema(
        {
            vol.Required("shape"): "rect",
            "x": _FRACTION,
            "z": _FRACTION,
            "w": _SPAN,
            "d": _SPAN,
            vol.Optional("fill", default=False): bool,
        }
    ),
    vol.Schema({vol.Required("shape"): "circle", "x": _FRACTION, "z": _FRACTION, "r": _SPAN}),
    vol.Schema({vol.Required("shape"): "line", "x1": _FRACTION, "z1": _FRACTION, "x2": _FRACTION, "z2": _FRACTION}),
)

# A rack frame (#112): an empty 19" or 10" rack that rack-mount gear is fitted into later (docs/packs.md, "Racks").
# The item's parts draw the frame; the spec says where its U positions are. frontend/src/rack-frame.ts reads the same
# spec with the same rules (a test compares these lists).
RACK_FORMS = ["frame2", "frame4", "cabinet", "wall_frame", "wall_cabinet"]
RACK_WALL_FORMS = ["wall_frame", "wall_cabinet"]
RACK_CABINET_FORMS = ["cabinet", "wall_cabinet"]
RACK_DOORS = ["none", "glass", "mesh", "solid"]
RACK_WIDTHS = [19, 10]
# 1U in metres, and the width across a panel's mounting ears by rack width (19" = 482.6 mm, 10" = 254 mm)
RACK_UNIT = 0.04445
RACK_PANEL_WIDTH = {19: 0.4826, 10: 0.254}
RACK_MAX_U = 60
RACK_START_U_RANGE = (1, 100)
RACK_MOUNT_DEPTH_RANGE = (0.05, 1.5)
RACK_BOTTOM_RANGE = (0, 2)
# measures may round to the millimetre (racks.py too)
RACK_SLACK = 0.001


def _whole(value: Any) -> int:
    """A whole number (not true or false, which Python counts as numbers)."""
    if isinstance(value, bool) or not isinstance(value, int):
        raise vol.Invalid("expected a whole number")
    return value


RACK_FRAME_SCHEMA = vol.Schema(
    {
        # height in rack units
        vol.Required("u"): vol.All(_whole, vol.Range(min=1, max=RACK_MAX_U)),
        # 2-post, 4-post open frame, 4-post cabinet, wall-mounted frame, wall-mounted cabinet (NetBox's form factors)
        vol.Required("form"): vol.In(RACK_FORMS),
        # 19 or 10 inch (default 19)
        vol.Optional("width"): vol.All(_whole, vol.In(RACK_WIDTHS)),
        # a cabinet's front door (default none)
        vol.Optional("door"): vol.In(RACK_DOORS),
        # the number of the lowest U (default 1), and whether the numbers run from the top down (default false)
        vol.Optional("start_u"): vol.All(_whole, vol.Range(min=RACK_START_U_RANGE[0], max=RACK_START_U_RANGE[1])),
        vol.Optional("desc"): bool,
        # metres from the front rails to the rear ones: the deepest gear that fits (default: from the item's depth)
        vol.Optional("mount_depth"): _range(RACK_MOUNT_DEPTH_RANGE),
        # metres from the item's bottom to the bottom of its lowest U (default: the U space centred in the height)
        vol.Optional("bottom"): _range(RACK_BOTTOM_RANGE),
    }
)


# Rack-mount gear (#113): an item that fits into a rack's U positions. frontend/src/rack.ts reads the same spec (a test
# compares these lists). Half / third width, the rear face and 0U side-lane gear are placed from #114 on.
RACK_GEAR_WIDTHS = ["full", "half", "third"]
RACK_GEAR_DEPTHS = ["half", "full"]

# an item's estimated watts (#114), at most this
MAX_WATTS = 100000


def _watts(value: Any) -> float:
    """A number of watts (not true or false, which Python counts as numbers)."""
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise vol.Invalid("expected a number of watts")
    return value


RACK_GEAR_SCHEMA = vol.Schema(
    {
        # height in rack units (0 = a vertical PDU in the side lane)
        vol.Required("u"): vol.All(_whole, vol.Range(min=0, max=RACK_MAX_U)),
        # how much of the rack's width it takes (default full)
        vol.Optional("width"): vol.In(RACK_GEAR_WIDTHS),
        # half depth sits on the front rails, full depth blocks the rear face too (default half)
        vol.Optional("depth"): vol.In(RACK_GEAR_DEPTHS),
        # the rack standard it is made for: 19 or 10 inch (default 19)
        vol.Optional("inch"): vol.All(_whole, vol.In(RACK_WIDTHS)),
        # a shelf: loose gear stands on its top (#114)
        vol.Optional("shelf"): bool,
    }
)


def _shelf_has_room(gear: dict[str, Any]) -> dict[str, Any]:
    """A shelf takes at least 1U (loose gear stands in its U space)."""
    if gear.get("shelf") and gear["u"] < 1:
        raise vol.Invalid("a shelf takes at least 1U", path=["shelf"])
    return gear


def _rack_fits(item: dict[str, Any]) -> dict[str, Any]:
    """A rack frame fits its item: its panels across the width, its U space in the height, its mounting depth in the
    depth; wall racks hang on a wall, the others stand; only cabinets have a door."""
    frame = item.get("rack_frame")
    if frame is None:
        return item
    width, depth, height = item["size"]
    form = frame["form"]
    if RACK_PANEL_WIDTH[frame.get("width", 19)] > width + RACK_SLACK:
        raise vol.Invalid("the rack's panels are wider than the item", path=["rack_frame", "width"])
    if frame.get("mount_depth", 0) > depth + RACK_SLACK:
        raise vol.Invalid("the mounting depth is deeper than the item", path=["rack_frame", "mount_depth"])
    space = frame["u"] * RACK_UNIT
    bottom = frame.get("bottom", max(0.0, (height - space) / 2))
    if bottom + space > height + RACK_SLACK:
        raise vol.Invalid(f"{frame['u']}U do not fit in the item's height", path=["rack_frame", "u"])
    mount = item.get("mount", "floor")
    if (form in RACK_WALL_FORMS) != (mount == "wall") or mount == "ceiling":
        raise vol.Invalid('a wall rack has "mount": "wall", any other stands on the floor or a desk', path=["mount"])
    if frame.get("door", "none") != "none" and form not in RACK_CABINET_FORMS:
        raise vol.Invalid("only a cabinet has a door", path=["rack_frame", "door"])
    return item


_ITEM_FIELDS = vol.Schema(
    {
        vol.Required("id"): _ID,
        # names by language ("de", "en", …); "en" or the first one is the fallback
        vol.Required("name"): vol.All({vol.All(str, vol.Length(min=2, max=5)): _TEXT}, vol.Length(min=1, max=10)),
        vol.Required("size"): vol.All([_METRES], vol.Length(min=3, max=3)),
        vol.Optional("electric", default=False): bool,
        # where it stands: on the floor, on the furniture below it, on a wall (bottom at wall_y) or
        # hanging from the ceiling
        vol.Optional("mount", default="floor"): vol.In(MOUNTS),
        vol.Optional("wall_y", default=1.0): _range(WALL_Y_RANGE),
        # its top carries other items (like a table or a worktop)
        vol.Optional("surface", default=False): bool,
        # a vehicle: offered for parking spots
        vol.Optional("vehicle", default=False): bool,
        # the item's own colour for a role (#404): what its parts in that role show while the placed item has no
        # colour of its own for it (a car's paint in this colourway)
        vol.Optional("colors"): vol.All({vol.In(COLOUR_ROLES): vol.Match(r"^#[0-9a-fA-F]{6}$")}, vol.Length(min=1)),
        # what its part in a role is called (#411): the item panel names that colour row so ("Paint", "Legs")
        vol.Optional("role_names"): vol.All({vol.In(COLOUR_ROLES): vol.In(PART_NAMES)}, vol.Length(min=1)),
        # stairs: when it reaches the floor above, it cuts a stairwell opening into that floor
        vol.Optional("hole", default=False): bool,
        # a lamp: how its light spreads (like the built-in lamp of that kind)
        vol.Optional("light"): vol.In(LIGHTS),
        vol.Required("parts"): vol.All([PART_SCHEMA], vol.Length(min=1, max=MAX_PARTS)),
        vol.Optional("symbol"): vol.All([SYMBOL_SCHEMA], vol.Length(max=40)),
        # the library (since 1.23): what the item is, the rooms it is made for, words that find it, and
        # variants of one thing (a table in three lengths) as a family with the variant's name by language
        vol.Optional("group"): _ID,
        vol.Optional("room"): vol.All([_ID], vol.Length(max=MAX_ROOMS)),
        vol.Optional("tags"): vol.All([vol.All(str, vol.Length(min=1, max=MAX_TAG_LENGTH))], vol.Length(max=MAX_TAGS)),
        vol.Optional("family"): _ID,
        vol.Optional("variant"): vol.All({vol.All(str, vol.Length(min=2, max=5)): _TEXT}, vol.Length(min=1, max=10)),
        # the IKEA product name ("KALLAX"): the library finds the item by it as well as by its readable name
        vol.Optional("ikea"): vol.All(str, vol.Length(min=1, max=40)),
        # an empty rack that gear can be fitted into (#112)
        vol.Optional("rack_frame"): RACK_FRAME_SCHEMA,
        # rack-mount gear that fits into a rack (#113)
        vol.Optional("rack"): vol.All(RACK_GEAR_SCHEMA, _shelf_has_room),
        # its estimated typical power draw: a rack's total adds up its gear's (#114)
        vol.Optional("watts"): vol.All(_watts, vol.Range(min=0, max=MAX_WATTS)),
    }
)
ITEM_SCHEMA = vol.All(_ITEM_FIELDS, _rack_fits)


class PackError(Exception):
    """A pack that cannot be imported; `code` says why, `detail` names the file and the fault."""

    def __init__(self, code: str, detail: str = "") -> None:
        """Keep the reason."""
        super().__init__(f"{code}: {detail}" if detail else code)
        self.code = code
        self.detail = detail


def _unknown_value(err: vol.Invalid) -> bool:
    """Whether a value outside a known list failed: voluptuous says so in its message; Probatio, which checks
    schemas since Home Assistant 2026.9, gives it the code "not_in_list" (pointed out by hohoanganh)."""
    found = getattr(err, "errors", None) or [err]
    return any(getattr(e, "code", None) == "not_in_list" or "value must be one of" in str(e) for e in found)


def _check(schema: vol.Schema | vol.All, path: str, data: Any) -> dict[str, Any]:
    """Data against a schema; raises PackError naming the file (a value this version does not know yet, as a
    newer pack may use, asks for an update)."""
    try:
        return schema(data)
    except vol.Invalid as err:
        code = "needs_update" if _unknown_value(err) else "invalid_content"
        raise PackError(code, f"{path}: {err}" if path else str(err)) from err


# ---------------------------------------------------------------------------- pack format v2: a folder

# the pack the household's own items (#13) are offered as; no imported pack may take this id
CUSTOM_PACK_ID = "household.custom"
PACK_FORMAT_V2 = "home3d-pack"
PACK_VERSION_V2 = 2
PACK_FILE = "pack.json"
# limits of a pack folder: items, characters per file and in all (one websocket message carries the folder)
MAX_ITEMS = 1000
MAX_FILE_SIZE = 50_000
MAX_FOLDER_SIZE = 3_000_000
# Home Assistant takes a websocket message of at most 4 MiB (aiohttp's default); a larger one drops the connection
MAX_MESSAGE_BYTES = 4 * 1024 * 1024
# the data files as a folder import sends them (#375): their JSON in UTF-8 bytes, with room left in the message for
# the rest of it. A folder within this fits in one message however it was installed (files or GitHub), so it also
# round-trips: an installed pack can always be imported again as a folder.
MAX_FOLDER_BYTES = 3_800_000
# an item file: lower-case names, at most three folders deep ("seating/chairs/stool.json")
_ITEM_PATH = re.compile(r"^(?:[a-z0-9][a-z0-9_-]{0,39}/){0,3}[a-z0-9][a-z0-9_.-]{0,39}\.json$")
# a readme and the licence text may come along; they are not read
_DOC_PATH = re.compile(r"^(?:README|LICEN[CS]E|COPYING|CHANGELOG)(?:\.(?:md|txt))?$", re.IGNORECASE)
# packs are data only: no links in any text
_LINK = re.compile(r"\b(?:https?|ftp|file|data|javascript|mailto):|\bwww\.", re.IGNORECASE)

# ---------------------------------------------------------------------------- language packs (#196)

# A language pack is a pack folder whose pack.json says "kind": "language" and names the "language"; next to it, one
# strings.json holds that language's texts: an object of text key -> text. A key the pack lacks shows in English.
PACK_KINDS = ["furniture", "language"]
LANGUAGE_KIND = "language"
STRINGS_FILE = "strings.json"
# a language's texts are many short strings in one file: it may be larger than an item file
MAX_STRINGS_SIZE = 400_000
MAX_STRINGS = 10_000
MAX_STRING_LENGTH = 2_000
_STRING_KEY = re.compile(r"^[a-z][a-z0-9_]{0,79}$")
# a text may not hold a web address ("https://…" with nothing after it, as a hint for a field, is no address)
_TEXT_LINK = re.compile(r"\b(?:https?|ftp)://[\w-]|\b(?:javascript|data|file|mailto):\S|\bwww\.[\w-]", re.IGNORECASE)


def is_language_pack(pack: dict[str, Any]) -> bool:
    """Whether a checked pack holds a language's texts (#196) rather than furniture."""
    return pack.get("kind") == LANGUAGE_KIND


def verify_strings(path: str, text: str) -> dict[str, str]:
    """The checked texts of a language pack's strings.json; raises PackError naming the key and the fault."""
    data = _parse(path, text)
    if not isinstance(data, dict) or not data:
        raise PackError("invalid_content", f"{path}: an object of text key -> text, with at least one text")
    if len(data) > MAX_STRINGS:
        raise PackError("too_many_items", f"{path}: {len(data)} texts, at most {MAX_STRINGS}")
    for key, value in data.items():
        if not _STRING_KEY.match(key):
            raise PackError("invalid_content", f'{path}: "{key[:60]}" is not a text key (lower case, digits and _)')
        if not isinstance(value, str) or not value or len(value) > MAX_STRING_LENGTH:
            raise PackError("invalid_content", f"{path}: {key} must be a text of 1 to {MAX_STRING_LENGTH} characters")
        if _TEXT_LINK.search(value):
            raise PackError("not_data", f"{path}: {key}: links are not allowed ({value[:60]})")
    return data


def _verify_language(pack: dict[str, Any], files: dict[str, str]) -> dict[str, Any]:
    """A language pack's payload: pack.json with "language", and strings.json as its only other file."""
    if "language" not in pack:
        raise PackError("invalid_content", f'{PACK_FILE}: a language pack names its "language", e.g. "de"')
    others = sorted(path for path in files if path not in (PACK_FILE, STRINGS_FILE))
    if others:
        raise PackError("not_data", f"{others[0]}: a language pack holds only {PACK_FILE} and {STRINGS_FILE}")
    if STRINGS_FILE not in files:
        raise PackError("invalid_content", f"a language pack needs {STRINGS_FILE}")
    return {**pack, "features": [], "items": [], "strings": verify_strings(STRINGS_FILE, files[STRINGS_FILE])}


def strings_hash(strings: dict[str, str]) -> str:
    """A fingerprint of a language's texts: "sha256:" and the hash of their JSON with sorted keys."""
    text = json.dumps(strings, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(text.encode()).hexdigest()


def language_of(packs: list[dict[str, Any]], language: str) -> tuple[dict[str, str], list[str]]:
    """The texts the offered packs have for a language, and the ids of the packs they came from. Several packs for
    one language add up: a key in a later pack (an installed one comes after the bundled ones) wins."""
    strings: dict[str, str] = {}
    ids: list[str] = []
    for pack in packs:
        if is_language_pack(pack) and pack.get("language") == language:
            strings.update(pack.get("strings", {}))
            ids.append(pack["id"])
    return strings, ids


# a pack id is "publisher.pack"; an item's full id is "publisher.pack/item_id"
_PACK_ID = vol.All(str, vol.Match(r"^[a-z0-9][a-z0-9_-]{0,29}\.[a-z0-9][a-z0-9_-]{0,29}$"))

PACK_SCHEMA_V2 = vol.Schema(
    {
        vol.Required("format"): PACK_FORMAT_V2,
        vol.Required("version"): PACK_VERSION_V2,
        vol.Required("id"): _PACK_ID,
        vol.Required("name"): _TEXT,
        vol.Required("publisher"): _TEXT,
        # an SPDX licence id ("MIT", "CC-BY-4.0", …); "license" is read as "licence"
        vol.Required("licence"): vol.All(str, vol.Match(r"^[A-Za-z0-9][A-Za-z0-9.+-]{1,39}$")),
        # release number of the pack (a newer release of the same id replaces an installed one)
        vol.Optional("release", default=1): vol.All(int, vol.Range(min=1, max=100000)),
        vol.Optional("description", default=""): vol.All(str, vol.Length(max=400)),
        # one line on what this release changed (#288), shown next to the update; optional
        vol.Optional("release_note"): vol.All(str, vol.Length(max=200), vol.Match(r"^[^\r\n]*$")),
        # what the pack holds (#196): furniture items (the default, left out) or the texts of one language
        vol.Optional("kind"): vol.In(PACK_KINDS),
        # the language a language pack is for: a base language code ("de", "fr", "pt"), lower case
        vol.Optional("language"): vol.All(str, vol.Match(r"^[a-z]{2,3}$")),
    }
)


def recipe_hash(item: dict[str, Any]) -> str:
    """A fingerprint of a checked item's recipe: "sha256:" and the hash of its JSON with sorted keys. A plan's copy
    of a recipe (#2) and the installed item have the same hash while the recipe is the same."""
    text = json.dumps(item, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return "sha256:" + hashlib.sha256(text.encode()).hexdigest()


# ---------------------------------------------------------------------------- the library's light form (#44)

# An item without what draws it: enough to browse, search, filter and size it. The recipe (its parts and plan symbol)
# comes on demand with `packs/items`; placed items draw from the plan's recipe copies (#2).
RECIPE_FIELDS = ("parts", "symbol")
# values the check fills in for a missing field (the schema's defaults): left out of the index, the frontend reads a
# missing field the same way
_DEFAULTS = {
    str(key): key.default() for key in _ITEM_FIELDS.schema if isinstance(key, vol.Optional) and callable(key.default)
}


def item_index(item: dict[str, Any]) -> dict[str, Any]:
    """An item as the library lists it: every field but its recipe, without the filled-in defaults."""
    return {k: v for k, v in item.items() if k not in RECIPE_FIELDS and not (k in _DEFAULTS and _DEFAULTS[k] == v)}


def pack_hash(pack: dict[str, Any]) -> str:
    """A fingerprint of a pack's items: it changes whenever any recipe does (a browser keeps recipes by it). A
    language pack's is that of its texts."""
    if is_language_pack(pack):
        return strings_hash(pack.get("strings", {}))
    digest = hashlib.sha256()
    for item in pack.get("items", []):
        digest.update(f"{item['id']}={recipe_hash(item)}\n".encode())
    return "sha256:" + digest.hexdigest()


def library_pack(pack: dict[str, Any], *, whole: bool = False) -> dict[str, Any]:
    """A pack as `packs/list` sends it: its fields, its hash and the index of its items (`whole`: the items with
    their recipes). The files it was imported from stay on the server (a backup carries them); where it came from
    (#25) is kept."""
    light = {k: v for k, v in pack.items() if k not in ("items", "source", "strings")}
    if is_language_pack(pack):
        # the texts come with `languages/get`, for the language a page shows (#196); the list only counts them
        light["texts"] = len(pack.get("strings", {}))
    origin = (pack.get("source") or {}).get("origin")
    if origin is not None:
        light["source"] = {"origin": origin}
    items = pack.get("items", [])
    return {**light, "hash": pack_hash(pack), "items": items if whole else [item_index(item) for item in items]}


def _parse(path: str, text: str) -> Any:
    """One file of a pack folder as JSON; raises PackError naming the file."""
    try:
        return json.loads(text)
    except ValueError as err:
        raise PackError("invalid_content", f"{path}: not JSON") from err
    except RecursionError as err:
        raise PackError("invalid_content", f"{path}: nested too deeply") from err


def _link_in(data: Any) -> str | None:
    """The first text with a link in parsed JSON, or None."""
    if isinstance(data, str):
        return data if _LINK.search(data) else None
    values = data.values() if isinstance(data, dict) else data if isinstance(data, list) else []
    for value in values:
        if (found := _link_in(value)) is not None:
            return found
    return None


def no_links(path: str, data: Any) -> Any:
    """The parsed JSON itself, or PackError when any text in it holds a link (a pack is data, nothing is fetched)."""
    try:
        found = _link_in(data)
    except RecursionError as err:
        # no pack nests anywhere near this deep (#47)
        raise PackError("invalid_content", f"{path}: nested too deeply") from err
    if found is not None:
        raise PackError("not_data", f"{path}: links are not allowed ({found[:60]})")
    return data


def verify_pack_file(text: str) -> dict[str, Any]:
    """The checked pack.json of a folder."""
    pack = no_links(PACK_FILE, _parse(PACK_FILE, text))
    if not isinstance(pack, dict) or pack.get("format") != PACK_FORMAT_V2:
        raise PackError("not_a_pack", f'{PACK_FILE}: "format" must be "{PACK_FORMAT_V2}"')
    if "licence" not in pack and "license" in pack:
        pack = {**pack, "licence": pack["license"]}
        del pack["license"]
    if not pack.get("licence"):
        raise PackError("no_licence", f'{PACK_FILE} must name the licence of the pack, e.g. "licence": "MIT"')
    return _check(PACK_SCHEMA_V2, PACK_FILE, pack)


def _item_file(path: str, text: str) -> dict[str, Any]:
    """One checked item file; its name is the item's id ("seating/stool.json" holds "stool")."""
    item = _check(ITEM_SCHEMA, path, no_links(path, _parse(path, text)))
    stem = path.rsplit("/", 1)[-1].removesuffix(".json")
    if item["id"] != stem:
        raise PackError("invalid_content", f'{path}: the item id "{item["id"]}" must match the file name')
    return item


def verify_item(data: Any) -> dict[str, Any]:
    """One item on its own, as an item file holds it (an item made in the item editor, #13): the same checks as an
    item in a pack folder; raises PackError."""
    path = f"{data['id']}.json" if isinstance(data, dict) and isinstance(data.get("id"), str) else "item"
    return _check(ITEM_SCHEMA, path, no_links(path, data))


def data_paths(paths: list[str]) -> list[str]:
    """The paths of a folder's files that are read (pack.json and the items, not the readme or licence text), after
    the checks on names and count; raises PackError. A fetch from GitHub runs it before downloading anything."""
    if PACK_FILE not in paths:
        raise PackError("not_a_pack", f"no {PACK_FILE}")
    kept: list[str] = []
    for path in paths:
        if _DOC_PATH.match(path):
            continue
        if path != PACK_FILE and not _ITEM_PATH.match(path):
            raise PackError("not_data", f"{path}: a pack holds only {PACK_FILE} and item .json files")
        kept.append(path)
    if len(kept) - 1 > MAX_ITEMS:
        raise PackError("too_many_items", f"{len(kept) - 1} items, at most {MAX_ITEMS}")
    return kept


def _data_files(files: dict[str, str]) -> dict[str, str]:
    """The pack.json and item files of a folder, after the checks on names, count and size; raises PackError."""
    kept = {path: files[path] for path in data_paths(list(files))}
    for path, text in kept.items():
        limit = MAX_STRINGS_SIZE if path == STRINGS_FILE else MAX_FILE_SIZE
        if len(text) > limit:
            raise PackError("too_large", f"{path}: {len(text)} characters, at most {limit}")
    total = sum(len(text) for text in kept.values())
    if total > MAX_FOLDER_SIZE:
        raise PackError("too_large", f"the pack: {total} characters, at most {MAX_FOLDER_SIZE}")
    if (sent := folder_bytes(kept)) > MAX_FOLDER_BYTES:
        raise PackError("too_large", f"the pack: {sent} bytes as sent, at most {MAX_FOLDER_BYTES}")
    return kept


def folder_bytes(files: dict[str, str]) -> int:
    """The size of a folder's files as a folder import sends them: compact JSON, UTF-8 (frontend api.ts measures
    the same way)."""
    return len(json.dumps(files, ensure_ascii=False, separators=(",", ":")).encode())


def verify_folder(files: dict[str, str]) -> dict[str, Any]:
    """Check a pack folder (relative path -> file text) and return the pack with its items; raises PackError.

    The result has the same shape as an old single-file pack (see verify_pack), so everything after the import
    treats both alike."""
    files = _data_files(files)
    pack = verify_pack_file(files[PACK_FILE])
    if is_language_pack(pack):
        return _verify_language(pack, files)
    if "language" in pack:
        raise PackError("invalid_content", f'{PACK_FILE}: "language" belongs to a language pack ("kind": "language")')
    if len(files.get(STRINGS_FILE, "")) > MAX_FILE_SIZE:
        raise PackError("too_large", f"{STRINGS_FILE}: {len(files[STRINGS_FILE])} characters, at most {MAX_FILE_SIZE}")
    items = [_item_file(path, text) for path, text in sorted(files.items()) if path != PACK_FILE]
    if not items:
        raise PackError("invalid_content", "a pack needs at least one item file")
    seen: set[str] = set()
    for item in items:
        if item["id"] in seen:
            raise PackError("invalid_content", f'the item id "{item["id"]}" is used twice')
        seen.add(item["id"])
    return {**pack, "features": [], "items": items}


def read_folder(folder: Path) -> dict[str, str]:
    """Every file of a pack folder on disk (relative path with "/" -> text), leaving out hidden files and folders."""
    files: dict[str, str] = {}
    for path in sorted(folder.rglob("*")):
        rel = path.relative_to(folder)
        if path.is_file() and not any(part.startswith(".") for part in rel.parts):
            files[rel.as_posix()] = path.read_text(encoding="utf-8", errors="replace")
    return files


# ---------------------------------------------------------------------------- packs that ship with Home 3D

# The packs bundled with the integration: one folder per pack (amluto.living, ...), read from the disk at setup,
# so they are there on a fresh install without network access. They are checked like an imported pack.
BUNDLED_DIR = Path(__file__).parent / "bundled_packs"
# the language packs that ship with Home 3D (#196): one folder per language
BUNDLED_LANGUAGES_DIR = Path(__file__).parent / "bundled_languages"


def load_bundled(root: Path = BUNDLED_DIR) -> list[dict[str, Any]]:
    """The checked bundled packs, marked "bundled"; a folder that does not check is logged and left out."""
    found: list[dict[str, Any]] = []
    if not root.is_dir():
        return found
    for folder in sorted(p for p in root.iterdir() if (p / PACK_FILE).is_file()):
        try:
            found.append({**verify_folder(read_folder(folder)), "bundled": True})
        except PackError as err:
            _LOGGER.error("Bundled pack %s does not check: %s", folder.name, err)
    return found


def kind_of(pack: dict[str, Any]) -> str:
    """What a pack holds: "furniture" (the default) or "language" (#196)."""
    return str(pack.get("kind") or "furniture")


def with_bundled(bundled: list[dict[str, Any]], imported: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """All packs to offer: the bundled ones, then the imported ones, one per pack id. When a pack is both bundled
    and imported (a copy imported from files or installed from a GitHub URL), the higher release wins; on a tie the
    imported one. An imported pack of another kind never takes a bundled pack's place (#372: a furniture pack named
    like a bundled language pack, kept from before 1.0.1, must not leave the page in English)."""
    kinds = {p["id"]: kind_of(p) for p in bundled}
    imported = [p for p in imported if kinds.get(p["id"], kind_of(p)) == kind_of(p)]
    release = {p["id"]: p.get("release", 1) for p in imported}
    kept = [p for p in bundled if release.get(p["id"], 0) < p.get("release", 1)]
    shadowed = {p["id"] for p in kept}
    return kept + [p for p in imported if p["id"] not in shadowed]


def is_bundled(bundled: list[dict[str, Any]], pack_id: str) -> bool:
    """Whether a pack id is one of the bundled packs."""
    return any(p["id"] == pack_id for p in bundled)


# ---------------------------------------------------------------------------- our own packs (#372)

# Home 3D's own packs use this id prefix and publisher. Only an official source may: the bundled packs, and packs
# installed from the GitHub account that publishes them (the default pack index lists them from there). A file, a
# backup without such an origin or another account can never pass for one of ours.
RESERVED_PREFIX = "amluto."
RESERVED_PUBLISHER = "Amluto Solutions"
OFFICIAL_OWNER = "amluto-solutions"
# compared folded (see _folded)
RESERVED_PUBLISHERS = frozenset({"amlutosolutions", "amluto"})


def _folded(text: Any) -> str:
    """A name without case, spaces, dots, dashes and underscores ("Amluto Solutions" -> "amlutosolutions")."""
    return re.sub(r"[\s._-]+", "", str(text or "")).casefold()


def is_reserved(pack: dict[str, Any]) -> bool:
    """Whether a pack uses the id prefix or the publisher of Home 3D's own packs."""
    pack_id = str(pack.get("id", ""))
    return pack_id.startswith(RESERVED_PREFIX) or _folded(pack.get("publisher")) in RESERVED_PUBLISHERS


def is_official(origin: Any) -> bool:
    """Whether a pack's origin is an official source: installed from GitHub from Home 3D's own account."""
    return (
        isinstance(origin, dict)
        and origin.get("type") == "github"
        and str(origin.get("owner", "")).casefold() == OFFICIAL_OWNER
    )


def official_only(pack: dict[str, Any], origin: Any) -> dict[str, Any]:
    """A pack being imported, installed or restored from `origin` (None: files), unless it uses the id prefix or the
    publisher of Home 3D's own packs without coming from an official source; raises PackError("reserved_id")."""
    if is_reserved(pack) and not is_official(origin):
        raise PackError(
            "reserved_id",
            f'{pack["id"]} by {pack.get("publisher")}: the id prefix "{RESERVED_PREFIX}" and the publisher '
            f'"{RESERVED_PUBLISHER}" belong to Home 3D\'s own packs, which install only from '
            f"github.com/{OFFICIAL_OWNER}",
        )
    return pack


# ---------------------------------------------------------------------------- old single-file packs (v1)

PACK_FORMAT = "fp3dpack"
PACK_VERSION = 1
# largest single pack file accepted (characters of JSON)
MAX_PACK_SIZE = 1_000_000

# feature names an old pack may list (kept for pack compatibility; every feature whose code is here is on anyway)
KNOWN_FEATURES = [
    "camera_cockpit",
    "weather",
    "screens",
    "fridge_smart",
    "energy_pro",
    "sound",
    "auto_pro",
    "time_travel",
    "pool",
    "household",
    # fun extras (pets, seasonal decorations)
    "fun_pets",
    "fun_halloween",
    "fun_seasons",
]

# An old pack's payload. Top-level keys this version does not read (the fields of the old signed shop packs) are
# dropped; the items are checked as strictly as in a v2 pack.
PAYLOAD_SCHEMA = vol.Schema(
    {
        vol.Required("format"): PACK_FORMAT,
        vol.Required("version"): PACK_VERSION,
        vol.Required("id"): _ID,
        vol.Required("name"): _TEXT,
        vol.Required("publisher"): _TEXT,
        vol.Optional("release", default=1): vol.All(int, vol.Range(min=1, max=100000)),
        vol.Optional("description", default=""): vol.All(str, vol.Length(max=400)),
        # feature names (compatibility only: they unlock nothing that is not already on)
        vol.Optional("features", default=[]): vol.All([vol.In(KNOWN_FEATURES)], vol.Length(max=10)),
        vol.Required("items"): vol.All([ITEM_SCHEMA], vol.Length(min=0, max=200)),
    },
    extra=vol.REMOVE_EXTRA,
)


def _payload_of(data: Any) -> dict[str, Any] | None:
    """The payload of a parsed old pack file: {"payload": {...}} (anything next to it is ignored) or the payload
    itself; None when it is not an old pack."""
    if not isinstance(data, dict):
        return None
    payload = data["payload"] if isinstance(data.get("payload"), dict) else data
    return payload if payload.get("format") == PACK_FORMAT else None


def validate_payload(payload: Any) -> dict[str, Any]:
    """Check the content of an old single-file pack; raises PackError."""
    features = payload.get("features") if isinstance(payload, dict) else None
    if isinstance(features, list):
        unknown = [f for f in features if isinstance(f, str) and f not in KNOWN_FEATURES]
        if unknown:
            # a Pro add-on newer than this installation (#218): ask for an update, not a cryptic error
            raise PackError("needs_update", ", ".join(unknown))
    clean = _check(PAYLOAD_SCHEMA, "", payload)
    ids = [item["id"] for item in clean["items"]]
    if len(ids) != len(set(ids)):
        raise PackError("invalid_content", "item ids must be unique")
    if not ids and not clean["features"]:
        raise PackError("invalid_content", "a pack needs items or features")
    # an old pack declares no licence
    return {**clean, "licence": None}


def verify_pack(text: str) -> dict[str, Any]:
    """Parse an old single-file pack and return its checked payload; raises PackError."""
    if len(text) > MAX_PACK_SIZE:
        raise PackError("too_large", f"{len(text)} characters, at most {MAX_PACK_SIZE}")
    try:
        data = json.loads(text)
    except ValueError as err:
        raise PackError("not_a_pack", "not JSON") from err
    except RecursionError as err:
        raise PackError("invalid_content", "nested too deeply") from err
    payload = _payload_of(data)
    if payload is None:
        if isinstance(data, dict) and data.get("format") == PACK_FORMAT_V2:
            raise PackError("not_a_pack", f"this is the {PACK_FILE} of a pack folder: import the whole folder")
        raise PackError("not_a_pack", f'neither a pack folder nor an old pack file (format "{PACK_FORMAT}")')
    return validate_payload(payload)


def parts_of(text: str) -> dict[str, Any]:
    """The source kept with an old pack that verify_pack accepted: its payload with only the fields this version
    reads, so a backup can carry the pack and a restore can check it again."""
    payload = _payload_of(json.loads(text))
    assert payload is not None
    return {key: value for key, value in payload.items() if key in {str(k) for k in PAYLOAD_SCHEMA.schema}}


# ---------------------------------------------------------------------------- the kept source of a pack


def source_of_folder(files: dict[str, str]) -> dict[str, Any]:
    """The source kept with a v2 pack: its data files as they were imported."""
    return {"files": _data_files(files)}


def checked_folder(files: dict[str, str]) -> tuple[dict[str, Any], dict[str, Any]]:
    """A pack folder's checked payload and the source kept with it; raises PackError. Plain work without the event
    loop: a large pack takes a while, so callers run it in the executor (#176)."""
    return verify_folder(files), source_of_folder(files)


def checked_file(text: str) -> tuple[dict[str, Any], dict[str, Any]]:
    """An old single-file pack's checked payload and the source kept with it; raises PackError (see checked_folder)."""
    return verify_pack(text), parts_of(text)


def checked_source(source: Any) -> tuple[dict[str, Any], dict[str, Any]]:
    """The kept source of an imported pack checked again (a backup being restored), as an import keeps it: the
    payload, and the source with only what a pack is read from (#376: no readme or licence text, no fields this
    version does not read). Raises PackError. The caller adds a checked origin."""
    payload = verify_source(source)
    if isinstance(source.get("files"), dict):
        return payload, source_of_folder(source["files"])
    fields = {str(k) for k in PAYLOAD_SCHEMA.schema}
    return payload, {key: value for key, value in source.items() if key in fields}


def verify_source(source: Any) -> dict[str, Any]:
    """Check the kept source of an imported pack again (a backup being restored); raises PackError."""
    if isinstance(source, dict) and isinstance(source.get("files"), dict):
        files = source["files"]
        if not all(isinstance(k, str) and isinstance(v, str) for k, v in files.items()):
            raise PackError("invalid_content", "the files of a pack are texts")
        return verify_folder(files)
    return validate_payload(source)
