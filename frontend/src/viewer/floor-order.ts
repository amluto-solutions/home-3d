// The order a new home's floors are built in, one per frame (#131): the open floor first (the ground floor in the
// whole-house view), then the others from the nearest; of two as near, the upper one (it covers the lower one).

import type { Building } from "../model.ts";
import { groundFloor } from "../solar.ts";

export function buildOrder(b: Building, floorId: string | null): string[] {
  const first = b.floors.find((f) => f.id === floorId) ?? groundFloor(b);
  const at = first?.elevation ?? 0;
  return [...b.floors]
    .sort((p, q) => (p === first ? -1 : q === first ? 1 : Math.abs(p.elevation - at) - Math.abs(q.elevation - at) || q.elevation - p.elevation))
    .map((f) => f.id);
}
