"""Which frontend build the integration serves now (#60).

The build writes `frontend/build.json` next to the bundles with the same id it puts into the main bundle. An open
page compares the two: after an update (or the same version rebuilt) the files on disk are newer than the
JavaScript the page still runs, and it offers a reload.
"""

from __future__ import annotations

import json
from pathlib import Path

BUILD_FILE = Path(__file__).parent / "frontend" / "build.json"


def read_build() -> str | None:
    """The build id on disk, None without a readable build file (a development checkout). Blocking: run it in the
    executor. Read on every ask, so files copied in without a restart are seen at once."""
    try:
        build = json.loads(BUILD_FILE.read_text(encoding="utf-8")).get("build")
    except (OSError, ValueError, AttributeError):
        return None
    return build if isinstance(build, str) and build else None
