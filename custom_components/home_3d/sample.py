"""The sample home that ships with Home 3D (#54): a furnished two-storey house to try the panel with.

The data is `sample/sample-home.json` (the building only). It was built by hand in the editor from bundled pack items
only (their recipe copies travel in the file). Every device links a generic placeholder entity
(`<domain>.sample_<what>`, #101) that no real Home Assistant has, so the home is a demo (#100): the viewer shows fixed
demo states for them until an editor links real entities. Loading it adds a new home, it never touches an existing
one, and it never offers to import this install's own areas (#61).
"""

from __future__ import annotations

from collections.abc import Iterator
import json
from pathlib import Path
import re
from typing import Any

SAMPLE_FILE = Path(__file__).parent / "sample" / "sample-home.json"
SAMPLE_NAME = "Sample Home"
# every entity id in the shipped sample is a placeholder like this (#101)
PLACEHOLDER = re.compile(r"^[a-z_]+\.sample_[a-z0-9_]+$")

# the Home Assistant domains an entity id in a plan can have
_DOMAINS = (
    "alarm_control_panel|automation|binary_sensor|button|calendar|camera|climate|cover|device_tracker|event|fan|"
    "group|humidifier|input_boolean|input_button|input_datetime|input_number|input_select|input_text|light|lock|"
    "media_player|number|person|remote|scene|script|select|sensor|siren|sun|switch|update|vacuum|valve|"
    "water_heater|weather|zone"
)
_ENTITY = re.compile(rf"(?<![\w.])(?:{_DOMAINS})\.[a-z0-9_]+")


def load_sample() -> dict[str, Any]:
    """The sample building, as stored (the caller checks and completes it like any other building)."""
    return json.loads(SAMPLE_FILE.read_text(encoding="utf-8"))


def _strings(value: Any) -> Iterator[str]:
    if isinstance(value, str):
        yield value
    elif isinstance(value, dict):
        for key, item in value.items():
            yield key
            yield from _strings(item)
    elif isinstance(value, list):
        for item in value:
            yield from _strings(item)


def entity_ids(building: dict[str, Any]) -> list[str]:
    """Every entity id a building names, sorted and without repeats."""
    return sorted({match for text in _strings(building) for match in _ENTITY.findall(text)})
