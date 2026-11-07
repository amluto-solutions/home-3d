"""Store options shared by every store whose data can be large (#176).

Newer Home Assistant turns a store's data into JSON in the event loop unless told otherwise. The plans, the background
images, the restore points, the packs (with their source files and the previous release kept for a roll back) and the
custom items can each be a megabyte or more, so they are serialised in the executor (older versions always did that).
The data handed to such a store must not change afterwards: every store here is given new objects on each save.
"""

from __future__ import annotations

import inspect
from typing import Any

from homeassistant.helpers.storage import Store

OFF_LOOP: dict[str, Any] = {}
if "serialize_in_event_loop" in inspect.signature(Store.__init__).parameters:
    OFF_LOOP["serialize_in_event_loop"] = False
