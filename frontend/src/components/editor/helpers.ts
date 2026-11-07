// Module-level helpers of the editor (#202: moved out of editor.ts): drag kinds, wall view tables, stroke and pipe
// geometry, small predicates. Shared by editor.ts and its area modules under editor/.

import type { AlignLines, Span } from "../../geometry/snap-guides.ts";
import { onWall, pipePath, type P3 } from "../../geometry/runs.ts";
import type { WallRun } from "../../pool-runs.ts";
import type { WallFrame } from "../../geometry/wall-frame.ts";
import type { PoolPipe } from "../../model.ts";
import type { ResizeNote as ResizeNoteOf } from "../../geometry/room-resize.ts";
import { ENERGY_DEVICES, type Building, type Floor, type OutdoorArea, type Opening, type Room, type Vec2 } from "../../model.ts";
import type { HomeAssistant } from "../../types.ts";
import { energyRole, packInfo, packItem } from "../../packs.ts";

/** Drag-and-drop type of an entity dragged from the unplaced list onto the plan (#83). */
export const ENTITY_DRAG = "application/x-home3d-entity";

/** Items that can be fixed against moving. */
export type ResizeNote = ResizeNoteOf<Building>;
export type FixKind = "room" | "opening" | "furniture" | "device" | "wall" | "outdoor";

/** Highest mount height the backend accepts (schema: 0–10 m); "40" meant as centimetres would refuse every save. */
export const MAX_MOUNT_Y = 10;

/** A paw (24 × 24), the static pets' mark in the plan. */
export const PAW = "M8.3 3.5a2 1.6 0 1 1 0 3.2 2 1.6 0 0 1 0-3.2m7.4 0a2 1.6 0 1 1 0 3.2 2 1.6 0 0 1 0-3.2M4.5 8a1.8 1.5 0 1 1 0 3 1.8 1.5 0 0 1 0-3m15 0a1.8 1.5 0 1 1 0 3 1.8 1.5 0 0 1 0-3M12 10c2.5 0 4.6 1.9 5.3 4.3.6 2 .2 3.7-1.3 4.5-1.4.8-2.6-.2-4-.2s-2.6 1-4 .2c-1.5-.8-1.9-2.5-1.3-4.5C7.4 11.9 9.5 10 12 10";

// `from` (the points, #395): the plan a point drag edits when it differs from `base` (a "+" added the point; `base`,
// without it, is the undo step)
export type Drag =
  | { kind: "pan"; last: [number, number] }
  | { kind: "vertex"; roomId: string; index: number; base: Building; moved: boolean; from?: Building }
  | { kind: "device"; entityId: string; start: Vec2; startScreen: [number, number]; base: Building; moved: boolean }
  | { kind: "pet"; id: string; ref?: string; start: Vec2; startScreen: [number, number]; base: Building; moved: boolean }
  | { kind: "opening"; id: string; startScreen: [number, number]; base: Building; moved: boolean; peers?: Span[] }
  // `pick`: an Alt+click without moving selects this item instead (#75, #125)
  | { kind: "furniture"; id: string; start: Vec2; startScreen: [number, number]; base: Building; moved: boolean; pick?: string | null; lines?: AlignLines }
  | { kind: "furnset"; ids: string[]; start: Vec2; startScreen: [number, number]; base: Building; moved: boolean; pick?: string | null; areas?: string[] }
  | { kind: "marquee"; start: Vec2; end: Vec2; add: boolean }
  | { kind: "rotate"; id: string; base: Building; moved: boolean }
  | { kind: "resize"; id: string; corner: [1 | -1, 1 | -1]; base: Building; moved: boolean }
  | { kind: "room"; roomId: string; start: Vec2; startScreen: [number, number]; base: Building; moved: boolean }
  | { kind: "rect"; start: Vec2; end: Vec2; outdoor?: boolean; hole?: boolean; roof?: boolean }
  | { kind: "roofmove"; id: string; start: Vec2; startScreen: [number, number]; base: Building; moved: boolean }
  | { kind: "solarturn"; id: string; base: Building; moved: boolean }
  | { kind: "solarmove"; id: string; start: Vec2; startScreen: [number, number]; base: Building; moved: boolean; grab: { du: number; ds: number } | null; win?: boolean }
  | { kind: "outvertex"; id: string; index: number; base: Building; moved: boolean; from?: Building }
  | { kind: "outbox"; id: string; corner: number; base: Building; moved: boolean }
  | { kind: "pipept"; pool: string; pipe: string; index: number; base: Building; moved: boolean }
  | { kind: "poolport"; pool: string; id: string; base: Building; moved: boolean }
  | { kind: "pooldev"; id: string; start: Vec2; base: Building; moved: boolean }
  | { kind: "pooljoint"; pool: string; id: string; start: Vec2; base: Building; moved: boolean }
  | { kind: "roofcorner"; id: string; corner: [0 | 1, 0 | 1]; base: Building; moved: boolean }
  | { kind: "roofvertex"; id: string; index: number; base: Building; moved: boolean; from?: Building }
  | { kind: "cablept"; id: string; index: number; base: Building; moved: boolean }
  | { kind: "holopt"; base: Building; moved: boolean }
  | { kind: "bgmove"; start: Vec2; bx: number; bz: number; base: Building; moved: boolean }
  | { kind: "bgscale"; base: Building; moved: boolean }
  | { kind: "bgrotate"; base: Building; moved: boolean; start: number; rot: number }
  | { kind: "freewall"; start: Vec2; end: Vec2 }
  | { kind: "wallmove"; id: string; end: "a" | "b" | null; start: Vec2; startScreen: [number, number]; base: Building; moved: boolean }
  | { kind: "outdoor"; id: string; start: Vec2; startScreen: [number, number]; base: Building; moved: boolean }
  | { kind: "tap"; startScreen: [number, number]; last: [number, number]; panning: boolean; ghost?: { floor: string; id: string } };

export interface Guides {
  point?: Vec2;
  x?: number;
  z?: number;
  /** snap guides of a door, window or item being placed or dragged (#143): plan metres, with a short label */
  lines?: { a: Vec2; b: Vec2; label: string }[];
}

/** Every drag with a `base` and `moved`: one that changes the document live. */
type EditDragKind = Extract<Drag, { base: Building; moved: boolean }>["kind"];
/**
 * Drags that change the document live (restored when cancelled, recorded in the history when done). Typed as a
 * record of every such kind (#184): a new one left out of it no longer type-checks.
 */
const EDIT_DRAG_KINDS: Record<EditDragKind, true> = { vertex: true, room: true, device: true, pet: true, opening: true, furniture: true, furnset: true, rotate: true, resize: true, outdoor: true, roofmove: true, roofcorner: true, roofvertex: true, outvertex: true, outbox: true, pipept: true, poolport: true, pooldev: true, pooljoint: true, solarmove: true, solarturn: true, cablept: true, holopt: true, bgmove: true, bgscale: true, bgrotate: true, wallmove: true };
export const EDIT_DRAGS: ReadonlySet<string> = new Set(Object.keys(EDIT_DRAG_KINDS));

/** The other doors and windows on the wall `o` sits on (#143): centre offsets and widths, for equal spacing. */
export function wallPeers(floor: Floor, o: Pick<Opening, "id" | "room_id" | "edge"> & { wall?: string | null }): Span[] {
  const out: Span[] = [];
  for (const x of floor.openings) {
    if (x.id === o.id) continue;
    const same = o.wall ? x.wall === o.wall : !x.wall && x.room_id === o.room_id && x.edge === o.edge;
    if (same) out.push({ offset: x.offset, width: x.width });
  }
  return out;
}

/** An angle turned on by `d` degrees, kept between -180 and 180. */
export const turnBy = (a: number, d: number): number => {
  const v = (((a + d) % 360) + 360) % 360;
  return v > 180 ? v - 360 : v;
};

/** Topics of the ⚙ settings menu (everything that belongs to the whole plan). */
/** The parts of the editor the Settings page shows on their own (#139; the same names as its registry's EmbedTopic). */
export type EditorTopic = "favorites" | "own_buttons" | "media_presets" | "director_triggers" | "editors" | "tablet_users" | "backup" | "backdrop_picture" | "energy_balance" | "hologram" | "presence" | `module:${string}`;

/** Wall view side bar: what stands or hangs at a wall, by kind. */
export const WALL_CATS: Record<string, string[]> = {
  base: ["kitchen", "sink", "stove", "dishwasher", "sideboard", "dresser", "tv_board", "nightstand", "washbasin", "washer", "dryer", "worktop", "desk"],
  hang: ["kitchen_wall", "tv_wall", "shelf", "lamp_wall", "radiator", "ac_unit", "led_strip"],
  tall: ["kitchen_tall", "fridge", "wardrobe", "tall_cabinet", "shelf", "coat_rack"],
  living: ["sofa", "armchair", "bed", "bunk_bed", "bench", "corner_bench", "plant"],
  light: ["lamp_wall", "lamp_floor", "led_strip", "lamp_table"],
  switches: ["wall_switch", "wall_socket", "wifi_ap", "water_heater"],
};
/** Hanging pieces (they go into a gap high on the wall). */
export const HANGING = new Set(["kitchen_wall", "tv_wall", "lamp_wall", "shelf", "led_strip", "ac_unit"]);
/** Cabinets built to measure: in a gap they take its width. */
export const WALL_FIT = new Set(["kitchen", "kitchen_wall", "kitchen_tall", "sideboard", "dresser", "tv_board", "worktop", "wardrobe", "tall_cabinet", "shelf", "desk"]);
/** The narrowest a fitted piece may become (a 29 cm desk is no desk). */
export const WALL_FIT_MIN: Record<string, number> = { kitchen: 0.15, kitchen_wall: 0.2, kitchen_tall: 0.3, sideboard: 0.4, dresser: 0.4, tv_board: 0.6, worktop: 0.1, wardrobe: 0.4, tall_cabinet: 0.3, shelf: 0.25, desk: 0.6 };
export const SNAP_PX = 10;
export const round = (v: number) => Math.round(v * 1000) / 1000;

/** How far in front of a wall's face a pipe laid on it runs (to its middle). */
export const RUN_GAP = 0.06;

/** A pipe being laid in the wall view: where it starts (a node, a T-piece on a pipe, a loose end it extends) and its points. */
export interface RunDraft {
  pool: string;
  from: string;
  fromT: P3 | null;
  extend: { pipe: string; end: "from" | "to" } | null;
  pts: P3[];
  /** Where it starts (a node, a T-piece, a loose end): drawn with the draft in 3D. */
  anchor: P3 | null;
  /** The wall the last point was set on ("room|edge") and its distance in front of it. */
  wall: string;
  d: number;
}

/** What the wall view's pipe tools need about the wall shown. */
export interface RunCtx {
  frame: WallFrame;
  floor: Floor;
  room: Room;
  key: string;
  L: number;
  H: number;
  gap: number;
  runs: WallRun[];
  pool: OutdoorArea;
  pt: (e: PointerEvent) => { s: number; y: number };
}

/** Douglas–Peucker: the stroke's corners, wiggles below `tol` dropped. */
/**
 * Changes the item of a list that matches, or nothing when it is gone: the selection may point at a room, door or
 * piece of furniture that is no longer on this floor (another floor shown, undone, deleted elsewhere) – the editor
 * threw "Cannot convert undefined or null to object" there.
 */
export function patchItem<T extends object>(item: T | undefined, patch: Partial<T>): void {
  if (item) Object.assign(item, patch);
}

export function simplifyStroke(pts: { s: number; y: number }[], tol: number): { s: number; y: number }[] {
  if (pts.length < 3) return pts.slice(1);
  const a = pts[0];
  const b = pts[pts.length - 1];
  let far = 0;
  let at = -1;
  const len = Math.hypot(b.s - a.s, b.y - a.y) || 1;
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i];
    const dist = Math.abs((b.s - a.s) * (a.y - p.y) - (a.s - p.s) * (b.y - a.y)) / len;
    if (dist > far) [far, at] = [dist, i];
  }
  if (far <= tol || at < 0) return [];
  return [...simplifyStroke(pts.slice(0, at + 1), tol), pts[at], ...simplifyStroke(pts.slice(at), tol)];
}

/**
 * Right angles: each piece of the stroke runs level or upright (whichever it is nearer to), pieces in a line merge,
 * stubs shorter than 8 cm go; the points sit on a 5 cm grid. The first and the last point stay where they are.
 */
export function snapStroke(pts: { s: number; y: number }[]): { s: number; y: number }[] {
  if (pts.length < 2) return pts;
  const g = (v: number) => Math.round(v * 20) / 20;
  const out: { s: number; y: number }[] = [{ s: pts[0].s, y: pts[0].y }];
  for (let i = 1; i < pts.length; i++) {
    const prev = out[out.length - 1];
    const p = pts[i];
    const level = Math.abs(p.s - prev.s) >= Math.abs(p.y - prev.y);
    const q = level ? { s: g(p.s), y: prev.y } : { s: prev.s, y: g(p.y) };
    const back = out.length > 1 ? out[out.length - 2] : null;
    // the same direction as the piece before: the corner between them goes
    if (back && ((back.y === prev.y && q.y === prev.y) || (back.s === prev.s && q.s === prev.s))) out.pop();
    if (Math.hypot(q.s - out[out.length - 1].s, q.y - out[out.length - 1].y) < 0.08 && i < pts.length - 1) continue;
    out.push(q);
  }
  // the true end: the last corner turns towards it, level then upright
  const end = pts[pts.length - 1];
  const prev = out[out.length - 1];
  out.pop();
  const last = out[out.length - 1];
  if (last) {
    if (Math.abs(end.s - last.s) >= 0.08 && Math.abs(end.y - last.y) >= 0.08) out.push(last.y === prev.y || out.length < 2 ? { s: g(end.s), y: last.y } : { s: last.s, y: g(end.y) });
  }
  out.push({ s: end.s, y: end.y });
  return out;
}

/** A plan point in front of a wall (rounded to the millimetre). */
export function onWallXZ(frame: WallFrame, s: number, d: number): Vec2 {
  const [x, , z] = onWall(frame, s, 0, d);
  return [round(x), round(z)];
}

export function pathLengthOf(p: PoolPipe, nodeAt: (n: string) => { x: number; z: number; y: number } | null): number {
  const path = pipePath(p, nodeAt);
  let l = 0;
  for (let i = 1; i < path.length; i++) l += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1], path[i][2] - path[i - 1][2]);
  return l;
}

/** Arrow keys as plan directions (x right, z down). */
export const ARROWS: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

/** A pack item for the rack code: its recipe once fetched, else the library listing (size, rack spec, mount). */
export const rackItemOf = (type: string) => packItem(type) ?? packInfo(type);

// furniture without a top to light: no "State from" box
export const NO_STATE_TYPES = new Set(["parking", "stairwell", "rug", "grid_point", "waste_bin", "mailbox", "wall_switch", "wall_socket", "wifi_ap", "water_heater"]);

/** A device of the energy tool: the built-in meter, inverter, battery, wallbox and grid point, and pack energy items (#22). */
export function isEnergyDevice(type: string): boolean {
  return (ENERGY_DEVICES as readonly string[]).includes(type) || energyRole(type) !== null;
}

/** A gas or water meter from a pack (its reading in m³ or litres, no power): family "meter" tagged gas or water. */
export function volumeMeter(type: string): boolean {
  const item = packInfo(type);
  return item?.family === "meter" && (item.tags ?? []).some((t) => /^(gas|water)$/i.test(t));
}

/** Distance of a plan point from a segment. */
export function distToSegment(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz || 1;
  const t = Math.min(1, Math.max(0, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2));
  return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dz * t);
}

/** Lower case without accents, so "cafe" finds "Café" and "chaise" finds "Chaise longue". */
export function fold(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

/** A stand-in hass for English names (the furniture search also matches the English name). */
export const EN_HASS = { language: "en" } as HomeAssistant;

/** Entities that carry a number: sensors and the number helpers (input_number, number) – #161. */
export function numberish(id: string): boolean {
  return /^(sensor|input_number|number)\./.test(id);
}

/** Entities that are on or off: binary sensors and the toggle helper (input_boolean) – #161. */
export function binaryish(id: string): boolean {
  return /^(binary_sensor|input_boolean)\./.test(id);
}

/** Where an armed library card would land (#173): the snapped point, its turn, the room under the pointer and the wall it sits against. */
export interface PlaceTarget {
  at: Vec2;
  rotation: number;
  roomId: string | null;
  wall: { roomId: string; edge: number } | null;
}

/**
 * The plan the panel hands the editor is the one the editor itself just made (#391): every edit's building-changed
 * comes back as `building`. It carries nothing new: no render and no pack update check for it.
 */
export function echoedPlan(building: unknown, doc: unknown): boolean {
  return !!building && building === doc;
}
