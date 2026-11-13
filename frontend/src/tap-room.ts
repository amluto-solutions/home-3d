// "Switch devices only in the opened room" (#454): a per-device preference for wall tablets. With it on and a room
// opened, a tap on a device that stands in another room opens that room and switches nothing. The redirect follows
// NeonPlan 3D 3.1.1 (MIT, (c) 2026 Mastershort, upstream 572f099); the setting itself is ours.

import { outdoorZones, pointInPolygon, type Building } from "./model.ts";

/** The device preference ("home3d.tap_in_room"; "1" = on, off by default). */
export const TAP_IN_ROOM_KEY = "home3d.tap_in_room";

/** Where a device lies: its floor and room (null: not inside any room). */
export interface Where {
  floorId: string;
  roomId: string | null;
}

/** Whether this device has the preference on (storage that cannot be read counts as off). */
export function tapInRoomOn(): boolean {
  try {
    return localStorage.getItem(TAP_IN_ROOM_KEY) === "1";
  } catch {
    return false;
  }
}

/** The things a tap can reach, by the id the viewer reports: entity ids, "opening:<id>", "gangs:<id>", "item:<id>". */
export type WhereIndex = Map<string, Where[]>;

export interface WhereInput {
  building: Building;
  /** The device pins (placed devices, items with an entity, locks): where each stands. */
  markers: readonly { id: string; floorId: string; roomId: string | null }[];
  /** Furniture id -> the id a tap on it reports (entity, "item:<id>", "module:<id>"). */
  furnitureTargets: ReadonlyMap<string, string>;
  /** Opening id -> the entity a tap on it reports. */
  openingTargets: ReadonlyMap<string, string>;
}

function add(index: WhereIndex, id: string, at: Where): void {
  const list = index.get(id);
  if (!list) index.set(id, [at]);
  else if (!list.some((w) => w.floorId === at.floorId && w.roomId === at.roomId)) list.push(at);
}

/** Where each tappable id lies: the pins, the furniture and the openings, by the room they stand in. */
export function buildWhere(input: WhereInput): WhereIndex {
  const index: WhereIndex = new Map();
  for (const m of input.markers) add(index, m.id, { floorId: m.floorId, roomId: m.roomId });
  for (const floor of input.building.floors) {
    const zones = [...floor.rooms, ...outdoorZones(floor)].filter((r) => r.points.length >= 3);
    for (const f of floor.furniture) {
      const at: Where = { floorId: floor.id, roomId: zones.find((r) => pointInPolygon([f.x, f.z], r.points))?.id ?? null };
      const target = input.furnitureTargets.get(f.id);
      if (target) add(index, target, at);
      add(index, `gangs:${f.id}`, at);
      add(index, `item:${f.id}`, at);
    }
    for (const o of floor.openings) {
      const at: Where = { floorId: floor.id, roomId: o.room_id || null };
      const target = input.openingTargets.get(o.id);
      if (target) add(index, target, at);
      add(index, `opening:${o.id}`, at);
    }
  }
  return index;
}

/**
 * Where a tap on `id` goes instead, when the preference is on and a room is open: the device's place when it is not in
 * the opened room. Null: switch as usual (no room open, the device is in the opened room, or nobody knows where it is).
 */
export function elsewhere(index: WhereIndex, id: string, openRoom: string | null, on: boolean): Where | null {
  if (!on || !openRoom) return null;
  const found = index.get(id);
  if (!found?.length || found.some((w) => w.roomId === openRoom)) return null;
  return found[0];
}
