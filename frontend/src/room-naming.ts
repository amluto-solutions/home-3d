// Naming a room while adding it (#65): Home Assistant's area names as suggestions, and a link to the area named.
import type { HassArea } from "./types.ts";

const fold = (s: string) => s.trim().toLocaleLowerCase();

/** Name and area of a new room: a typed area name links that area (unless a room already has it); empty = `fallback`. */
export function nameNewRoom(typed: string, areas: readonly HassArea[], used: ReadonlySet<string | null>, fallback: string): { name: string; area_id: string | null } {
  const name = typed.trim();
  if (!name) return { name: fallback, area_id: null };
  const area = areas.find((a) => fold(a.name) === fold(name) && !used.has(a.area_id));
  return area ? { name: area.name, area_id: area.area_id } : { name, area_id: null };
}

/** Names to offer: areas no room stands for yet, those of `haFloor` first, each group by name. */
export function roomNameSuggestions(areas: readonly HassArea[], used: ReadonlySet<string | null>, haFloor: string | null): string[] {
  return areas
    .filter((a) => !used.has(a.area_id))
    .sort((a, b) => Number(b.floor_id === haFloor && !!haFloor) - Number(a.floor_id === haFloor && !!haFloor) || a.name.localeCompare(b.name))
    .map((a) => a.name);
}
