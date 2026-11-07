// Static pets (#17): a pet that stays at a fixed spot in a pose instead of roaming. Where it is, how high (on a sofa,
// a bed or a desk) and which way it faces. Shared by the 3D pets (fun bundle), the plan editor and the extensions
// page, so it brings no code of its own dependencies (only types): the plan's surfaces are handed in.

import type { Building, Floor, Furniture, Pet, PetPlace, PetPose, PetSpot, Vec2 } from "./model.ts";

/** The item's own name: a pack item's id after the pack ("pack:home3d.pets:cat_bed" → "cat_bed"). */
export const itemOf = (type: string) => type.slice(type.lastIndexOf(":") + 1).toLowerCase();
export const SOFA = /^(sofa|armchair|chesterfield|corner_(left|right|sofa))|sofa/;
export const BED = /^bed(_|$)/;

/** Whether a pet stays at its spot (a pet roams unless switched to static). */
export const isStaticPet = (pet: Pet): boolean => pet.static === true;

export interface StaticPlace {
  pos: Vec2;
  /** Height above its floor: the seat of a sofa, the top of a bed or desk, else 0. */
  y: number;
  /** Turn round the vertical axis (the 3D model's rotation.y). */
  heading: number;
  pose: PetPose;
}

/** Whether a point lies on an item (its turned rectangle). */
function onItem(f: Furniture, p: Vec2): boolean {
  const a = (f.rotation * Math.PI) / 180;
  const dx = p[0] - f.x;
  const dz = p[1] - f.z;
  const u = dx * Math.cos(a) + dz * Math.sin(a);
  const v = -dx * Math.sin(a) + dz * Math.cos(a);
  return Math.abs(u) <= f.w / 2 && Math.abs(v) <= f.d / 2;
}

/**
 * Where a static pet is shown on its floor: at its (first) spot, up on the sofa, bed or desk under it, facing as set
 * (else the front of what it lies on). Null while it has no spot yet (the 3D view then finds it one of its places).
 */
export function staticPlace(floor: Floor, pet: Pet, surface?: (floor: Floor, x: number, z: number) => number): StaticPlace | null {
  const first = petSpots(pet)[0];
  return first ? placeAt(floor, first, surface) : null;
}

/** Where a place (a routine spot, a trigger's place, #337) is shown on its floor: up on what is under it, facing as set. */
export function placeAt(floor: Floor, place: PetPlace, surface?: (floor: Floor, x: number, z: number) => number): StaticPlace | null {
  if (place.x == null || place.z == null || !Number.isFinite(place.x) || !Number.isFinite(place.z)) return null;
  const pos: Vec2 = [place.x, place.z];
  let y = surface?.(floor, pos[0], pos[1]) ?? 0;
  let under: Furniture | null = null;
  for (const f of floor.furniture) {
    const t = itemOf(f.type);
    if (t.startsWith("dog") || t.startsWith("cat") || t.includes("bunk") || !onItem(f, pos)) continue;
    const bed = BED.test(t) || t === "sofa_bed";
    if (!bed && !SOFA.test(t)) continue;
    // on the seat, not in it (the same heights as a roaming cat's places)
    const top = bed ? Math.min(0.58, f.h * 0.64) : Math.min(0.5, f.h * 0.58);
    if (top >= y) {
      y = top;
      under = f;
    }
  }
  const heading = place.rotation != null ? (-place.rotation * Math.PI) / 180 : under ? (-under.rotation * Math.PI) / 180 : 0;
  return { pos, y, heading, pose: place.pose ?? "sit" };
}

/**
 * A pet's routine spots (#337): its own list, else for a static pet (a plan from before) its old spot as the only one,
 * else none. An empty list stays empty (the old fields are not read again once the list is there).
 */
export function petSpots(pet: Pet): PetSpot[] {
  if (pet.spots) return pet.spots;
  if (!isStaticPet(pet) || pet.x == null || pet.z == null || !Number.isFinite(pet.x) || !Number.isFinite(pet.z)) return [];
  return [{ id: "spot_1", floor_id: pet.floor_id ?? null, x: pet.x, z: pet.z, pose: pet.pose ?? null, rotation: pet.rotation ?? null }];
}

/** A polygon's area (absolute) and its centre of area. */
function areaCentre(points: readonly Vec2[]): { area: number; c: Vec2 } {
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const cross = points[j][0] * points[i][1] - points[i][0] * points[j][1];
    a += cross;
    cx += (points[j][0] + points[i][0]) * cross;
    cz += (points[j][1] + points[i][1]) * cross;
  }
  if (Math.abs(a) < 1e-9) return { area: 0, c: points[0] ?? [0, 0] };
  return { area: Math.abs(a / 2), c: [cx / (3 * a), cz / (3 * a)] };
}

/**
 * Switch a pet between roaming and static. Switched on for the first time it gets a first spot in the middle of its
 * floor's biggest room (drag it in the editor from there). Back to roaming a pet with a routine follows it; one with
 * just the one all-day spot wanders the house again and keeps that spot (in the old fields) for the next time.
 */
export function setPetStatic(pet: Pet, on: boolean, floor: Floor | undefined): Pet {
  if (!on) {
    const s = petSpots(pet);
    const lone = s.length === 1 && !s[0].from && !s[0].to && !s[0].days?.length;
    return lone ? { ...pet, static: false, spots: null, floor_id: s[0].floor_id ?? pet.floor_id ?? null, x: s[0].x, z: s[0].z, pose: s[0].pose ?? null, rotation: s[0].rotation ?? null } : { ...pet, static: false };
  }
  const spots = petSpots({ ...pet, static: true });
  if (spots.length) return { ...pet, static: true, spots };
  const rooms = (floor?.rooms ?? []).filter((r) => r.points.length >= 3).map((r) => areaCentre(r.points));
  const best = rooms.sort((p, q) => q.area - p.area)[0];
  const [x, z] = best?.c ?? [0, 0];
  const r = (v: number) => Math.round(v * 100) / 100;
  return { ...pet, static: true, spots: [{ id: "spot_1", floor_id: floor?.id ?? null, x: r(x), z: r(z), pose: pet.pose ?? "sit", rotation: pet.rotation ?? null }] };
}

/** A change to a pet's first spot (#337: a static pet's pose and facing are its first spot's), as a patch of the pet. */
export function firstSpot(pet: Pet, patch: Partial<PetSpot>): Partial<Pet> {
  return { spots: petSpots(pet).map((s, i) => (i ? s : { ...s, ...patch })) };
}

/** The floor a pet lives on: its own, else (none set, or gone) the floor nearest the ground that has rooms. */
export function petFloor(b: Building, pet: Pet): Floor | undefined {
  const withRooms = b.floors.filter((f) => f.rooms.some((r) => r.points.length >= 3));
  return withRooms.find((f) => f.id === pet.floor_id) ?? [...withRooms].sort((x, y) => Math.abs(x.elevation) - Math.abs(y.elevation))[0];
}

/** The floor of a place (#337): its own, else (none set, or gone) the pet's. */
export function placeFloor(b: Building, pet: Pet, place: PetPlace): Floor | undefined {
  return b.floors.find((f) => f.id === place.floor_id && f.rooms.length) ?? petFloor(b, pet);
}

/** A pet's place in the editor's plan (#337): "spot:<id>" or "trigger:<id>", its point and its number in the list. */
export interface PetMark {
  pet: Pet;
  ref: string;
  x: number;
  z: number;
  n: number;
  trigger: boolean;
}

/**
 * The pets' marks on a floor's plan: each pet's first spot (where it stays with roaming off); the selected pet's
 * every spot and trigger place too.
 */
export function petMarks(b: Building, floorId: string, selected?: string | null): PetMark[] {
  const out: PetMark[] = [];
  for (const pet of b.settings.pets?.list ?? []) {
    const spots = petSpots(pet);
    const places: [PetPlace & { id: string }, boolean, number][] = pet.id === selected ? [...spots.map((s, i): [PetSpot, boolean, number] => [s, false, i + 1]), ...(pet.triggers ?? []).map((t, i): [PetPlace & { id: string }, boolean, number] => [t, true, i + 1])] : spots.slice(0, 1).map((s): [PetSpot, boolean, number] => [s, false, 1]);
    for (const [p, trigger, n] of places) {
      if (p.x == null || p.z == null || placeFloor(b, pet, p)?.id !== floorId) continue;
      out.push({ pet, ref: `${trigger ? "trigger" : "spot"}:${p.id}`, x: p.x, z: p.z, n, trigger });
    }
  }
  return out;
}

/** The static pets with a spot that live on a floor (shown and dragged in its plan). */
export function staticPetsOn(b: Building, floorId: string): Pet[] {
  return (b.settings.pets?.list ?? []).filter((p) => isStaticPet(p) && petSpots(p).length && placeFloor(b, p, petSpots(p)[0])?.id === floorId);
}

/** A pet's place by its mark's ref ("spot:<id>", "trigger:<id>"). */
export function placeOfRef(pet: Pet, ref: string): PetPlace | undefined {
  const [kind, id] = ref.split(":");
  return kind === "trigger" ? pet.triggers?.find((t) => t.id === id) : petSpots(pet).find((s) => s.id === id);
}

/**
 * The editor drags a pet's place (#337: a spot or a trigger's place, "spot:<id>" / "trigger:<id>"; none: its first
 * spot) to the point, on the grid; `floorId` moves it to that floor too. A pet without spots has nothing to drag.
 */
export function movePet(b: Building, id: string, x: number, z: number, grid: number, ref?: string, floorId?: string): void {
  const pet = b.settings.pets?.list.find((p) => p.id === id);
  if (!pet) return;
  const snap = (v: number) => Math.round(Math.round(v / grid) * grid * 1000) / 1000;
  const r = ref ?? `spot:${petSpots(pet)[0]?.id}`;
  // the routine as a list of its own from now on (a plan from before has the old spot only)
  if (!r.startsWith("trigger") && !pet.spots && petSpots(pet).length) pet.spots = petSpots(pet);
  const place = placeOfRef(pet, r);
  if (!place) return;
  place.x = snap(x);
  place.z = snap(z);
  if (floorId) place.floor_id = floorId;
}

/** Where the server puts a pet now (#337): its place, the routine spot or trigger that put it there, when that runs out. */
export interface PetLive extends PetPlace {
  spot: string | null;
  trigger: string | null;
  until: string | null;
}

/** The pets' places of a home as the server works them out (#337), at once and on every change; the unsubscribe. */
export function subscribePets(
  conn: { subscribeMessage<T>(cb: (msg: T) => void, msg: Record<string, unknown>): Promise<() => Promise<void>> },
  home: string | null | undefined,
  cb: (pets: Record<string, PetLive>) => void,
): Promise<() => Promise<void>> {
  return conn.subscribeMessage<{ pets: Record<string, PetLive> }>((m) => cb(m.pets ?? {}), { type: "home_3d/pets/subscribe", ...(home ? { home_id: home } : {}) });
}
