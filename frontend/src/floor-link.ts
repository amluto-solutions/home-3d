// Plan floors and Home Assistant's floor registry (#263, ND-05): a floor links to the HA floor of the same name by
// itself (when it is added or renamed, and once for a home none of whose floors is linked yet); the link stays
// editable in the floor's settings. Add floor never offers an HA floor the plan already has by name.

import type { HassFloor } from "./types.ts";

/** A floor name to compare: letter case, punctuation and a trailing "floor" don't matter ("Ground Floor" = "ground"). */
export function floorKey(name: string): string {
  return name
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s*\bfloor$/, "")
    .trim();
}

/** Whether two floor names name the same floor. */
export function sameFloorName(a: string, b: string): boolean {
  const k = floorKey(a);
  return k !== "" && k === floorKey(b);
}

/** The HA floor named like `name` that no other plan floor links to yet; null when there is none. */
export function haFloorNamed(name: string, ha: readonly HassFloor[], taken: ReadonlySet<string | null>): HassFloor | null {
  return ha.find((f) => !taken.has(f.floor_id) && sameFloorName(f.name, name)) ?? null;
}

/** For each unlinked plan floor whose name matches a free HA floor: that HA floor's id (each HA floor once). */
export function floorLinks(floors: readonly { id: string; name: string; ha_floor: string | null }[], ha: readonly HassFloor[]): Map<string, string> {
  const taken = new Set<string | null>(floors.map((f) => f.ha_floor));
  const out = new Map<string, string>();
  for (const f of floors) {
    if (f.ha_floor) continue;
    const hit = haFloorNamed(f.name, ha, taken);
    if (!hit) continue;
    taken.add(hit.floor_id);
    out.set(f.id, hit.floor_id);
  }
  return out;
}

/** The HA floor a home's first floor stands for when none was picked: the one at level 0, else the lowest. */
export function firstHaFloor(free: readonly HassFloor[]): HassFloor | null {
  return free.find((f) => f.level === 0) ?? free[0] ?? null;
}
