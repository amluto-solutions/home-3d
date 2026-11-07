// The folded "Walls" heading of the room panel (#67): how many walls a room has and which are special.
import type { Room } from "../model.ts";

/** Walls of a room (one per edge), how many edges have no wall (on any part) and how many slope. */
export function wallSummary(room: Room): { walls: number; open: number; sloping: number } {
  const n = room.points.length;
  let open = 0;
  let sloping = 0;
  for (let i = 0; i < n; i++) {
    const h = room.wall_heights?.[i] ?? null;
    if (Array.isArray(h) ? h.some((x) => x === 0) : h === 0) open++;
    if (room.wall_slopes?.[i]) sloping++;
  }
  return { walls: n, open, sloping };
}
