"""List every entity id in the sample home, with how often it appears (all generic placeholders since #101).

    python tools/sample_entities.py [SAMPLE_JSON]

Prints one line per entity id: `<entity id>  <count>`. Run it with the project's virtualenv.
"""

from __future__ import annotations

import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from custom_components.home_3d.sample import SAMPLE_FILE, entity_ids


def main(argv: list[str]) -> int:
    path = Path(argv[1]) if len(argv) > 1 else SAMPLE_FILE
    text = path.read_text(encoding="utf-8")
    for entity in entity_ids(json.loads(text)):
        print(f"{entity}  {text.count(entity)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
