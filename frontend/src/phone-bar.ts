// The phone view's bar at the bottom (#493, ported from NeonPlan 3D 4.0.0, MIT, Mastershort; the element is
// components/phone-nav.ts): which places it has for a house and the numbers on them. Pure code: everything comes from
// the plan and the room tiles (room-tiles.ts).
import type { RoomTile } from "./room-tiles.ts";

export interface NavFloor {
  id: string;
  name: string;
  rooms: RoomTile[];
  /** Lights on in the floor's rooms. */
  lightsOn: number;
}

export interface NavSlot {
  /** "now", "covers", "more", "rooms" (all floors behind one place) or "floor:<id>". */
  id: string;
  /** A floor's own name; empty for the fixed places (the element has their words). */
  label: string;
  /** The number on the place (lights on, blinds shut, lines that need a look); 0 shows none. */
  badge: number;
  /** A place's own symbol (the fixed places have theirs in the element). */
  icon?: string;
}

/** The floors that have rooms, lowest first, each with its tiles. */
export function navFloors(floors: readonly { id: string; name: string; elevation: number }[], tiles: readonly RoomTile[]): NavFloor[] {
  return [...floors]
    .sort((a, b) => a.elevation - b.elevation)
    .map((f) => {
      const rooms = tiles.filter((t) => t.floorId === f.id);
      return { id: f.id, name: f.name, rooms, lightsOn: rooms.reduce((n, r) => n + r.lightsOn.length, 0) };
    })
    .filter((f) => f.rooms.length > 0);
}

/**
 * The places in bar order: Now, the rooms, the blinds, `extra` (places a card adds), More. A house with exactly two
 * floors gets a place per floor (two taps to any room); one floor, or three and more, share one place "Rooms" whose
 * sheet switches between the floors. A house without blinds has no blinds place.
 */
export function navSlots(floors: readonly NavFloor[], attention: number, coversShut: number, hasCovers: boolean, extra: readonly NavSlot[] = []): NavSlot[] {
  const rooms: NavSlot[] =
    floors.length === 2
      ? floors.map((f) => ({ id: `floor:${f.id}`, label: f.name, badge: f.lightsOn }))
      : floors.length
        ? [{ id: "rooms", label: "", badge: floors.reduce((n, f) => n + f.lightsOn, 0) }]
        : [];
  return [{ id: "now", label: "", badge: attention }, ...rooms, ...(hasCovers ? [{ id: "covers", label: "", badge: coversShut }] : []), ...extra, { id: "more", label: "", badge: 0 }];
}

/** The places a phone's bar holds legibly; the rest go under More. */
export const MAX_SLOTS = 5;

/**
 * The bar with at most `max` places: first two floor places become one "Rooms", then the places just before More move
 * under it, from the right (added places, then the blinds). Now, the rooms and More always stay. Returns the bar and
 * the places that moved, in bar order.
 */
export function fitSlots(slots: readonly NavSlot[], max = MAX_SLOTS): { bar: NavSlot[]; over: NavSlot[] } {
  let bar = [...slots];
  if (bar.length > max) {
    const floors = bar.filter((s) => s.id.startsWith("floor:"));
    if (floors.length > 1) {
      const at = bar.indexOf(floors[0]);
      bar = bar.filter((s) => !s.id.startsWith("floor:"));
      bar.splice(at, 0, { id: "rooms", label: "", badge: floors.reduce((n, f) => n + f.badge, 0) });
    }
  }
  const over: NavSlot[] = [];
  while (bar.length > max) {
    const i = bar.length - 2;
    if (i < 1 || bar[i].id === "rooms" || bar[i].id.startsWith("floor:")) break;
    over.unshift(...bar.splice(i, 1));
  }
  return { bar, over };
}

export interface NavCover {
  entity: string;
  name: string;
  /** 0 shut … 100 open; null when the cover reports no position. */
  position: number | null;
  shut: boolean;
}

/** A cover on the blinds sheet: shut when its state says so or it stands at 0 %. */
export function navCover(entity: string, name: string, state: string | undefined, position: unknown): NavCover {
  const pos = typeof position === "number" && Number.isFinite(position) ? Math.round(position) : null;
  return { entity, name, position: pos, shut: state === "closed" || pos === 0 };
}

/** The blinds of each floor (the rooms' covers, each once), floors without any left out. */
export function floorCovers(floors: readonly NavFloor[]): { id: string; name: string; entities: string[] }[] {
  return floors.map((f) => ({ id: f.id, name: f.name, entities: [...new Set(f.rooms.flatMap((r) => r.covers))] })).filter((f) => f.entities.length);
}

// ---- places of one's own (#494, card option `phone_places`; ported from NeonPlan 3D 4.0.0, MIT, Mastershort)

/** A device on an own place's page: a lamp with its brightness, a thermostat with what it has and wants. */
export interface NavDevice {
  entity: string;
  name: string;
  on: boolean;
  detail: string;
}

/** A group place's devices by floor (the rooms' lamps or thermostats, each once), floors without any left out. */
export function floorGroup(floors: readonly NavFloor[], kind: "lights" | "climate"): { id: string; name: string; entities: string[] }[] {
  return floors
    .map((f) => ({ id: f.id, name: f.name, entities: [...new Set(f.rooms.flatMap((r) => (kind === "lights" ? r.lights : (r.climates ?? []))))] }))
    .filter((f) => f.entities.length);
}

/** What an own place needs to be in the bar: a group with devices in this house, or a scene that is there, or a link. */
export interface OwnPlaceInput {
  kind: "lights" | "climate" | "action" | "link";
  name?: string;
  icon?: string;
  entity?: string;
  /** lights/climate: the devices it found; action: whether its entity exists. */
  devices: number;
  exists: boolean;
  /** lights: lamps on (the number on the place). */
  on: number;
  /** The word when the place has no name of its own (the kind's word, a scene's name). */
  fallback: string;
}

export const OWN_ICON: Record<OwnPlaceInput["kind"], string> = { lights: "💡", climate: "🌡", action: "▶", link: "↗" };

/** The bar places (`own:<index>`) of the own places; one with nothing to show (no devices, a scene that is gone) stays away. */
export function ownSlots(places: readonly OwnPlaceInput[]): NavSlot[] {
  const out: NavSlot[] = [];
  places.forEach((p, i) => {
    const there = p.kind === "lights" || p.kind === "climate" ? p.devices > 0 : p.kind === "action" ? p.exists : true;
    if (!there) return;
    out.push({ id: `own:${i}`, label: p.name || p.fallback, icon: p.icon || OWN_ICON[p.kind], badge: p.kind === "lights" ? p.on : 0 });
  });
  return out;
}

/** The mode a thermostat goes back to when its place switches it on: heating first, else its first mode that is not off. */
export function climateOnMode(modes: readonly string[]): string | undefined {
  return ["heat", "auto", "heat_cool"].find((m) => modes.includes(m)) ?? modes.find((m) => m !== "off");
}
