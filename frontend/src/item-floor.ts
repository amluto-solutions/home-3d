/**
 * Items between floors (#73): the item panel's floor dropdown moves the chosen items to another floor. The items keep
 * their ids, place (all floors share one plan grid) and every entity link, which deleting and placing them again lost.
 * Their height above the floor (mount) is floor-relative, so it stays as it is.
 */

import type { Building } from "./model.ts";

/** Moves the items `ids` from floor `from` to floor `to` (in place); returns the ids it moved. */
export function moveToFloor(doc: Building, from: string, ids: readonly string[], to: string): string[] {
  const source = doc.floors.find((f) => f.id === from);
  const target = doc.floors.find((f) => f.id === to);
  if (!source || !target || source === target) return [];
  const set = new Set(ids);
  const moving = source.furniture.filter((m) => set.has(m.id));
  if (!moving.length) return [];
  source.furniture = source.furniture.filter((m) => !set.has(m.id));
  target.furniture.push(...moving);
  return moving.map((m) => m.id);
}
