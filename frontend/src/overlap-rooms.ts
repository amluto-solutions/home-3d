// "Rooms overlap" with the rooms it means (#1195): the pairs by name, from the wall warnings "overlap:<room>:<room>".
// Ported from NeonPlan 3D 4.0.0 (MIT, Mastershort).

import type { Room } from "./model.ts";

export interface OverlapInfo {
  /** The first two pairs by name, "A / B". */
  shown: string[];
  /** How many pairs the sentence leaves out. */
  more: number;
  /** All pairs, for a tooltip. */
  all: string;
  /** The room a tap selects: the first of the first pair, when it still exists. */
  first: string | null;
}

export function overlapInfo(rooms: Pick<Room, "id" | "name">[], warnings: string[]): OverlapInfo {
  const name = (id: string) => rooms.find((r) => r.id === id)?.name || "?";
  const seen = new Set<string>();
  const pairs: string[][] = [];
  for (const w of warnings) {
    if (!w.startsWith("overlap:")) continue;
    const [p, q] = w.split(":").slice(1, 3);
    const key = [p, q].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([p, q]);
  }
  const label = ([p, q]: string[]) => `${name(p)} / ${name(q)}`;
  const shown = pairs.slice(0, 2).map(label);
  const first = pairs[0]?.[0];
  return { shown, more: pairs.length - shown.length, all: pairs.map(label).join(", "), first: first && rooms.some((r) => r.id === first) ? first : null };
}
