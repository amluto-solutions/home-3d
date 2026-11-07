// Rack contents (#113): rack-mount gear (pack items with a `rack` spec) fitted into whole-U positions of a placed rack
// (a pack item with a `rack_frame`, rack-frame.ts). The contents are saved on the placed rack as `rack.slots`; their
// recipes are copied into the plan like any placed item's (#2). These are the placement rules, pure (no DOM, no
// three.js); the backend refuses saves that break them (custom_components/home_3d/racks.py, same rules).
//
// A slot's `col` / `face` / `on` (#114) and its Home Assistant links `entity` / `links` (#119, rack-links.ts) are
// optional fields on RackSlot.

import type { PackItem } from "./packs.ts";
import { RACK_DOOR_DEPTH, RACK_MAX_U, RACK_OPENING, RACK_UNIT, RACK_WIDTHS, type RackFrame, type RackLayout, type RackProblem, type RackWidth } from "./rack-frame.ts";

/** How much of the rack's width the gear takes: all of it, or half / a third on a shared U (#114). */
export const RACK_GEAR_WIDTHS = ["full", "half", "third"] as const;
/** Half-depth gear sits on the front rails; full-depth gear blocks the rear face too (#114). */
export const RACK_GEAR_DEPTHS = ["half", "full"] as const;
/** At most this many pieces of gear in one rack. */
export const RACK_MAX_SLOTS = 60;

export type RackGearWidth = (typeof RACK_GEAR_WIDTHS)[number];
export type RackGearDepth = (typeof RACK_GEAR_DEPTHS)[number];

/** The spec as a pack writes it (`rack` of an item): what makes an item rack-mount gear. */
export interface RackGearSpec {
  /** Height in rack units (1 to 60; 0 = a vertical PDU in the side lane, #114). */
  u: number;
  width?: RackGearWidth;
  depth?: RackGearDepth;
  /** The rack standard it is made for: 19 (default) or 10 inch. */
  inch?: RackWidth;
  /** A shelf (#114): loose gear (a hub, a mini PC) stands on its top. At least 1U. */
  shelf?: boolean;
}

/** A checked gear spec with its defaults. */
export interface RackGear {
  u: number;
  width: RackGearWidth;
  depth: RackGearDepth;
  inch: RackWidth;
  /** A shelf (readRackGear always fills it; optional so older lookups stay valid). */
  shelf?: boolean;
}

/** One piece of gear in a rack (on the placed rack's `rack.slots`). */
export interface RackSlot {
  /** Unique within the rack. */
  id: string;
  /** The gear's pack item type ("pack:<pack>:<item>"). */
  type: string;
  /** Its lowest rail position, counted from the bottom (1 = the lowest U), whatever the rack's numbering. */
  u: number;
  /** Its own name ("Core switch"); none = the item's name. */
  name?: string | null;
  /**
   * Which column of its U it takes (#114): half-width gear 0 (left) or 1, third-width 0 to 2, full width only 0. For
   * 0U gear the side lane: 0 left, 1 right. None = 0.
   */
  col?: number;
  /** The face it is mounted on (#114): front (none) or rear. Full-depth gear takes both whichever it names. */
  face?: RackFace | null;
  /**
   * Loose gear (#114: any item without a rack spec, a hub, a mini PC) stands on a shelf: the shelf slot's id. Its `u`
   * is the shelf's (kept in step when the shelf moves); loose gear on one shelf stands side by side in slot order.
   */
  on?: string | null;
  /**
   * Its status entity in Home Assistant (#119): what its status LED shows (rack-links.ts) and what a hold opens.
   * None = no status of its own (the LED follows `links`, or there is none).
   */
  entity?: string | null;
  /** Further entities of the device (#119): its load, temperature, battery …, shown with its details and on the rack card (#120). */
  links?: string[] | null;
}

/** The faces of a 4-post rack (#114). */
export const RACK_FACES = ["front", "rear"] as const;
export type RackFace = (typeof RACK_FACES)[number];

/** What a placed rack carries (Furniture.rack). */
export interface RackContents {
  slots: RackSlot[];
  /** The rack card (#120): the editor's pick of values (rack-card.ts); missing / null = the default set, [] = no card. */
  card?: { metrics?: string[] | null } | null;
}

/** The room a rack offers gear: its U count, its width and how deep gear may be (rack-frame.ts rackLayout). */
export interface RackSpace {
  u: number;
  width: RackWidth;
  mountDepth: number;
  /** Whether it has rear rails for gear on the rear face (a 2-post rack has none; none = it has). */
  rear?: boolean;
  /** How wide the side lanes for 0U gear are, beside the rails (metres; none = wide enough). */
  lane?: number;
}

/** The gear spec and the depth (metres) of a slot's type; null when the type is no rack-mount gear. */
export type GearOf = (type: string) => { gear: RackGear; depth: number; size?: readonly [number, number, number]; watts?: number | null; electric?: boolean } | null;

/** Why gear can't go where it was put. */
export type RackRefusal = "overlap" | "outside" | "too_deep" | "wrong_width" | "not_gear" | "full" | "missing" | "no_rear" | "no_lane" | "no_shelf" | "shelf_full" | "too_tall" | "not_loose";

/** The size (metres) and estimated watts of an item that can stand on a shelf; null when it can't (a rack, unknown). */
export type LooseOf = (type: string) => { size: readonly [number, number, number]; watts?: number | null; electric?: boolean } | null;

const noLoose: LooseOf = () => null;

export interface RackResult {
  ok: boolean;
  /** The rack's slots afterwards (the same array when refused). */
  slots: RackSlot[];
  why?: RackRefusal;
  /** The slots it would overlap. */
  clash: string[];
  /** The rail positions it would take (1 = the lowest), for the sheet's green or red highlight. */
  units: number[];
}

/** Measures may round to the millimetre. */
const SLACK = 0.001;
const FIELDS = new Set(["u", "width", "depth", "inch", "shelf"]);

/** The rules of a gear spec (the backend's RACK_GEAR_SCHEMA); none for an item without one. */
export function rackGearProblems(item: Pick<PackItem, "rack">): RackProblem[] {
  const raw = item.rack as unknown;
  if (raw === undefined) return [];
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [{ field: "rack", why: "rack gear is an object" }];
  const g = raw as Record<string, unknown>;
  const out: RackProblem[] = [];
  for (const key of Object.keys(g)) if (!FIELDS.has(key)) out.push({ field: key, why: "not a rack gear field" });
  if (typeof g.u !== "number" || !Number.isInteger(g.u) || g.u < 0 || g.u > RACK_MAX_U) out.push({ field: "u", why: `a whole number of U, 0 to ${RACK_MAX_U}` });
  if (g.width !== undefined && !(RACK_GEAR_WIDTHS as readonly unknown[]).includes(g.width)) out.push({ field: "width", why: `one of ${RACK_GEAR_WIDTHS.join(", ")}` });
  if (g.depth !== undefined && !(RACK_GEAR_DEPTHS as readonly unknown[]).includes(g.depth)) out.push({ field: "depth", why: `one of ${RACK_GEAR_DEPTHS.join(", ")}` });
  if (g.inch !== undefined && !(RACK_WIDTHS as readonly unknown[]).includes(g.inch)) out.push({ field: "inch", why: "19 or 10 (inches)" });
  if (g.shelf !== undefined && typeof g.shelf !== "boolean") out.push({ field: "shelf", why: "true or false" });
  else if (g.shelf && g.u === 0) out.push({ field: "shelf", why: "a shelf takes at least 1U" });
  return out;
}

/** An item's gear spec with its defaults, or null when it has none or it breaks the rules. */
export function readRackGear(item: Pick<PackItem, "rack"> | undefined): RackGear | null {
  const g = item?.rack;
  if (!g || rackGearProblems(item).length) return null;
  return { u: g.u, width: g.width ?? "full", depth: g.depth ?? "half", inch: g.inch ?? 19, shelf: g.shelf ?? false };
}

/** The rail positions gear of `u` units takes from position `at` up. */
function span(at: number, u: number): number[] {
  return Array.from({ length: Math.max(1, u) }, (_, i) => at + i);
}

/** How many U a 0U item standing in a side lane is long: its height in U, rounded up (a hair short counts as full). */
export function laneUnits(height: number): number {
  return Math.max(1, Math.ceil(height / RACK_UNIT - 0.02));
}

/** How many U gear takes: its `u`, or for 0U gear its length in the side lane. */
function gearUnits(of: NonNullable<ReturnType<GearOf>>): number {
  return of.gear.u >= 1 ? of.gear.u : laneUnits(of.size?.[2] ?? RACK_UNIT);
}

/** The positions a slot takes (a slot whose type is unknown keeps its one U, so it blocks no more than that). */
export function slotUnits(s: RackSlot, gearOf: GearOf): number[] {
  const of = gearOf(s.type);
  return span(s.u, of ? gearUnits(of) : 1);
}

/** How many columns one U has for gear of a width. */
export const RACK_COLUMNS: Record<RackGearWidth, number> = { full: 1, half: 2, third: 3 };
/** 0U gear: a lane down the left (col 0) and one down the right (col 1) of the rails. */
const LANES = 2;

/** The part of the rack's width (0 = left, 1 = right) a slot takes. */
function across(width: RackGearWidth, col: number): [number, number] {
  const n = RACK_COLUMNS[width];
  return [col / n, (col + 1) / n];
}

/** Do two slots of the same kind (U gear or 0U gear) take some of the same width or lane? */
function sideBySide(a: RackGear, ac: number, b: RackGear, bc: number): boolean {
  if (a.u < 1) return ac === bc;
  const [a0, a1] = across(a.width, ac);
  const [b0, b1] = across(b.width, bc);
  return a0 < b1 - 1e-9 && b0 < a1 - 1e-9;
}

/** The faces a slot takes: both for full-depth gear, else the one it is on. */
export function slotFaces(s: Pick<RackSlot, "face">, gear: RackGear): RackFace[] {
  return gear.depth === "full" ? ["front", "rear"] : [s.face === "rear" ? "rear" : "front"];
}

/** Whether gear this deep (metres) fits between a rack's rails. */
export function fitsDepth(space: Pick<RackSpace, "mountDepth">, depth: number): boolean {
  return depth <= space.mountDepth + SLACK;
}

/** Can `s` go into the rack beside `others` (its own old place not counted)? */
export function checkSlot(space: RackSpace, others: readonly RackSlot[], s: RackSlot, gearOf: GearOf, looseOf: LooseOf = noLoose): Omit<RackResult, "slots"> {
  if (s.on) return checkLoose(space, others, s, gearOf, looseOf);
  const of = gearOf(s.type);
  const n = of ? gearUnits(of) : 1;
  const units = span(s.u, n);
  const no = (why: RackRefusal, clash: string[] = []) => ({ ok: false, why, clash, units });
  if (!of) return no("not_gear");
  const g = of.gear;
  const lane = g.u < 1;
  if (g.inch !== space.width) return no("wrong_width");
  const col = s.col ?? 0;
  if (!Number.isInteger(s.u) || s.u < 1 || s.u + n - 1 > space.u) return no("outside");
  if (!Number.isInteger(col) || col < 0 || col >= (lane ? LANES : RACK_COLUMNS[g.width])) return no("outside");
  if (s.face === "rear" && space.rear === false) return no("no_rear");
  if (lane && (of.size?.[0] ?? 0) > (space.lane ?? Infinity) + SLACK) return no("no_lane");
  if (!fitsDepth(space, of.depth)) return no("too_deep");
  const taken = new Set(units);
  const faces = slotFaces(s, g);
  const hits = (o: RackSlot): boolean => {
    if (o.on) return false;
    const oo = gearOf(o.type);
    if (oo) {
      // 0U gear stands beside the U space: it only meets other 0U gear
      if (oo.gear.u < 1 !== lane) return false;
      if (!sideBySide(g, col, oo.gear, o.col ?? 0)) return false;
      if (!slotFaces(o, oo.gear).some((f) => faces.includes(f))) return false;
    } else if (lane) return false;
    return slotUnits(o, gearOf).some((u) => taken.has(u));
  };
  const clash = others.filter((o) => o.id !== s.id && hits(o)).map((o) => o.id);
  if (clash.length) return no("overlap", clash);
  return { ok: true, clash: [], units };
}

/** A shelf's tray: loose gear stands this high above the bottom of the shelf's lowest U (the rest is its room). */
export const SHELF_TRAY = 0.004;

/** How much room a shelf gives loose gear: across (the opening between the rails, by its width), deep, high. */
export function shelfRoom(space: Pick<RackSpace, "width">, of: NonNullable<ReturnType<GearOf>>): { w: number; d: number; h: number } {
  return { w: RACK_OPENING[space.width] / RACK_COLUMNS[of.gear.width], d: of.depth, h: of.gear.u * RACK_UNIT - SHELF_TRAY };
}

/** Can loose gear `s` stand on the shelf it names? */
function checkLoose(space: RackSpace, others: readonly RackSlot[], s: RackSlot, gearOf: GearOf, looseOf: LooseOf): Omit<RackResult, "slots"> {
  const shelf = others.find((o) => o.id === s.on && !o.on);
  const sh = shelf && gearOf(shelf.type);
  const units = shelf ? slotUnits(shelf, gearOf) : [s.u];
  const no = (why: RackRefusal, clash: string[] = []) => ({ ok: false, why, clash, units });
  if (!shelf || !sh?.gear.shelf) return no("no_shelf");
  const item = looseOf(s.type);
  if (!item) return no("not_loose");
  const room = shelfRoom(space, sh);
  if (item.size[2] > room.h + SLACK) return no("too_tall");
  if (item.size[1] > room.d + SLACK) return no("too_deep");
  const beside = others.filter((o) => o.on === shelf.id && o.id !== s.id);
  const used = beside.reduce((sum, o) => sum + (looseOf(o.type)?.size[0] ?? 0), 0);
  if (used + item.size[0] > room.w + SLACK) return no("shelf_full", beside.map((o) => o.id));
  return { ok: true, clash: [], units };
}

/** Bottom first; loose gear right after its shelf, in the order it stands. */
const byU = (a: RackSlot, b: RackSlot): number => a.u - b.u;

/** Put new gear into the rack, or a slot anew where it says (refused when it breaks a rule). */
export function addSlot(space: RackSpace, slots: RackSlot[], s: RackSlot, gearOf: GearOf, looseOf: LooseOf = noLoose): RackResult {
  const replaces = slots.some((o) => o.id === s.id);
  if (!replaces && slots.length >= RACK_MAX_SLOTS) return { ok: false, why: "full", clash: [], units: [], slots };
  const check = checkSlot(space, slots, s, gearOf, looseOf);
  if (!check.ok) return { ...check, slots };
  const placed = s.on ? { ...s, u: slots.find((o) => o.id === s.on)!.u } : s;
  return { ...check, slots: [...slots.filter((o) => o.id !== s.id), placed].sort(byU) };
}

/** Move gear to another lowest position (refused when it breaks a rule there); a shelf takes its loose gear along. */
export function moveSlot(space: RackSpace, slots: RackSlot[], id: string, u: number, gearOf: GearOf, looseOf: LooseOf = noLoose): RackResult {
  const old = slots.find((s) => s.id === id);
  if (!old) return { ok: false, why: "missing", clash: [], units: [], slots };
  if (old.on) return { ok: true, clash: [], units: [old.u], slots };
  const moved = { ...old, u };
  const check = checkSlot(space, slots, moved, gearOf, looseOf);
  return check.ok ? { ...check, slots: slots.map((s) => (s.id === id ? moved : s.on === id ? { ...s, u } : s)).sort(byU) } : { ...check, slots };
}

/** Take gear out of the rack (a shelf with what stands on it). */
export function removeSlot(slots: RackSlot[], id: string): RackSlot[] {
  return slots.filter((s) => s.id !== id && s.on !== id);
}

/** The room a laid-out rack offers gear. */
export function rackSpace(frame: { u: number; width: RackWidth }, at: Pick<RackLayout, "mountDepth" | "rear" | "lane">): RackSpace {
  return { u: frame.u, width: frame.width, mountDepth: at.mountDepth, rear: at.rear !== null, lane: at.lane };
}

/** What a rack's sheet sums up (#114). */
export interface RackTotals {
  /** Rail positions taken on either face, and the rest. */
  used: number;
  free: number;
  /** Rail positions taken on the front and on the rear face (full-depth gear counts on both). */
  front: number;
  rear: number;
  /** Estimated watts of all its gear (shelves' loose gear and 0U PDUs too), from the packs' `watts`. */
  watts: number;
  /** How many electric pieces have no watts in their pack (the total is then a low estimate). */
  unknown: number;
}

/** U used / free and estimated watts of a rack's gear. */
export function rackTotals(space: Pick<RackSpace, "u">, slots: readonly RackSlot[], gearOf: GearOf, looseOf: LooseOf = noLoose): RackTotals {
  const front = new Set<number>();
  const rear = new Set<number>();
  let watts = 0;
  let unknown = 0;
  for (const s of slots) {
    const of = s.on ? looseOf(s.type) : gearOf(s.type);
    if (!of) continue;
    if (typeof of.watts === "number") watts += of.watts;
    else if (of.electric) unknown++;
    if (s.on || !("gear" in of) || of.gear.u < 1) continue;
    const faces = slotFaces(s, of.gear);
    for (const u of slotUnits(s, gearOf)) {
      if (u < 1 || u > space.u) continue;
      if (faces.includes("front")) front.add(u);
      if (faces.includes("rear")) rear.add(u);
    }
  }
  const used = new Set([...front, ...rear]).size;
  return { used, free: Math.max(0, space.u - used), front: front.size, rear: rear.size, watts: Math.round(watts), unknown };
}

/** An item's estimated watts (pack field `watts`), null when the pack gives none. */
function wattsOf(item: Pick<PackItem, "watts">): number | null {
  return typeof item.watts === "number" && item.watts >= 0 ? item.watts : null;
}

/** The gear lookup over pack items (`itemOf` = packItem in the app): a type is gear when its item has a valid `rack` spec. */
export function packGearOf(itemOf: (type: string) => Pick<PackItem, "rack" | "size" | "watts" | "electric"> | undefined): GearOf {
  return (type) => {
    const item = itemOf(type);
    const gear = readRackGear(item);
    return item && gear ? { gear, depth: item.size[1], size: item.size, watts: wattsOf(item), electric: !!item.electric } : null;
  };
}

/** The loose-gear lookup over pack items: anything but a rack can stand on a shelf (#114). */
export function packLooseOf(itemOf: (type: string) => Pick<PackItem, "rack_frame" | "size" | "watts" | "electric"> | undefined): LooseOf {
  return (type) => {
    const item = itemOf(type);
    return item && !item.rack_frame ? { size: item.size, watts: wattsOf(item), electric: !!item.electric } : null;
  };
}

/** How far a gear's front panel stands in front of the rails' face (its ears). */
const PANEL_PROUD = 0.003;

/** A piece of gear where the rack shows it: its box in the rack's own coordinates (rack-frame.ts rackLayout). */
export interface RackPiece {
  slot: RackSlot;
  item: PackItem;
  /** Centre across and front to back; `y` is its bottom above the rack's bottom. */
  x: number;
  z: number;
  y: number;
  w: number;
  d: number;
  h: number;
  /** Turned round, its front to the rack's back (#114: gear on the rear face). */
  back: boolean;
}

/**
 * Where a rack's gear is drawn (#113, #114): each slot's item at its U, in its column (half / third width), its front
 * panel just proud of the front rails (rear gear: of the rear rails, turned round), centred in its U space, no wider
 * than its column and no deeper than the rails allow. 0U gear stands in a side lane from its lowest U; a shelf sits
 * at the bottom of its U and its loose gear stands on it side by side from the left, fronts to the shelf's front.
 * Slots whose type is no gear (its recipe missing) or that no longer fit the rack are left out (rackMisfits names them).
 */
export function rackContents(at: RackLayout, slots: readonly RackSlot[], itemOf: (type: string) => PackItem | undefined): RackPiece[] {
  const out: RackPiece[] = [];
  const shelves = new Map<string, { piece: RackPiece; x0: number; x1: number; top: number }>();
  for (const slot of slots) {
    if (slot.on) continue;
    const item = itemOf(slot.type);
    const gear = readRackGear(item);
    if (!item || !gear) continue;
    const back = slot.face === "rear" && gear.depth !== "full";
    if (back && at.rear === null) continue;
    const low = at.units[slot.u - 1];
    if (!low) continue;
    const col = slot.col ?? 0;
    if (gear.u < 1) {
      // 0U: in the lane, from its lowest U up to the rack's top at most
      if (col > 1) continue;
      const w = Math.min(item.size[0], at.lane);
      const h = Math.min(item.size[2], at.top - low.y0);
      const d = Math.min(item.size[1], at.mountDepth);
      const z = slot.face === "rear" ? (at.rear ?? at.front - at.mountDepth) + d / 2 : at.front - d / 2;
      out.push({ slot, item, x: (col === 0 ? -1 : 1) * (at.panel / 2 + at.lane / 2), z, y: low.y0, w, d, h, back: slot.face === "rear" });
      continue;
    }
    if (!at.units[slot.u + gear.u - 2]) continue;
    const n = RACK_COLUMNS[gear.width];
    if (col >= n) continue;
    const room = gear.u * at.unit;
    const h = Math.min(item.size[2], room);
    const d = Math.min(item.size[1], at.mountDepth + PANEL_PROUD);
    const z = back ? at.rear! - PANEL_PROUD + d / 2 : at.front + PANEL_PROUD - d / 2;
    const x = -at.panel / 2 + ((col + 0.5) * at.panel) / n;
    const piece: RackPiece = { slot, item, x, z, y: gear.shelf ? low.y0 : low.y0 + (room - h) / 2, w: Math.min(item.size[0], at.panel / n), d, h, back };
    out.push(piece);
    if (gear.shelf) {
      const half = at.opening / n / 2;
      shelves.set(slot.id, { piece, x0: x - half, x1: x + half, top: low.y0 + room });
    }
  }
  for (const slot of slots) {
    const shelf = slot.on ? shelves.get(slot.on) : undefined;
    const item = shelf && itemOf(slot.type);
    if (!shelf || !item || item.rack_frame) continue;
    const s = shelf.piece;
    const w = Math.min(item.size[0], shelf.x1 - shelf.x0);
    const d = Math.min(item.size[1], s.d);
    const h = Math.min(item.size[2], Math.max(0, shelf.top - s.y - SHELF_TRAY));
    // fronts to the shelf's front (its back for a rear shelf), side by side from the left
    const z = s.back ? s.z - s.d / 2 + d / 2 : s.z + s.d / 2 - d / 2;
    out.push({ slot, item, x: shelf.x0 + w / 2, z, y: s.y + SHELF_TRAY, w, d, h, back: s.back });
    shelf.x0 += w;
  }
  return out;
}

/** Where a piece's status LED shows (#119): rack-local metres like RackPiece, its centre, and its edge length. */
export interface RackLedSpot {
  x: number;
  y: number;
  z: number;
  size: number;
}

/**
 * A piece's status LED (#119): a small square on its front panel near the top left (as you face that panel; rear
 * gear faces the rack's back), standing just proud of it so it is never hidden in the panel. One U or bigger, it
 * keeps the same size; on a small piece (loose gear) it shrinks with it.
 */
export function rackLedSpot(p: RackPiece): RackLedSpot {
  const size = Math.min(0.01, p.h / 3, p.w / 6);
  const inset = Math.min(0.025, p.w / 5) + size / 2;
  const y = p.y + p.h - Math.min(0.012, p.h / 4) - size / 2;
  const proud = 0.0015 + size / 2;
  return p.back ? { x: p.x + p.w / 2 - inset, y, z: p.z - p.d / 2 - proud, size } : { x: p.x - p.w / 2 + inset, y, z: p.z + p.d / 2 + proud, size };
}

/**
 * The gear a point in the rack (rack-local metres, as rackContents gives) lies on (#119: a tap in 3D): the piece
 * whose box, grown by a few millimetres, holds it; loose gear before the shelf it stands on (the smallest box wins).
 */
export function rackSlotAt(pieces: readonly RackPiece[], at: readonly [number, number, number]): string | null {
  const [x, y, z] = at;
  const grow = 0.006;
  let best: RackPiece | null = null;
  for (const p of pieces) {
    if (Math.abs(x - p.x) > p.w / 2 + grow || Math.abs(z - p.z) > p.d / 2 + grow || y < p.y - grow || y > p.y + p.h + grow) continue;
    if (!best || p.w * p.h * p.d < best.w * best.h * best.d) best = p;
  }
  return best?.slot.id ?? null;
}

/**
 * The gear a tap on a rack meant (#119, #131), in rack-local metres like rackSlotAt: the piece at the hit point; a hit
 * on a glass or mesh door (its rim, its bars: the pane itself draws nothing) goes on along `dir` to the first gear
 * behind it, as the eye does. A solid door, a side panel or the roof keep the tap.
 */
export function rackTapSlot(frame: RackFrame, w: number, d: number, h: number, pieces: readonly RackPiece[], at: readonly [number, number, number], dir: readonly [number, number, number]): string | null {
  const hit = rackSlotAt(pieces, at);
  if (hit || (frame.door !== "glass" && frame.door !== "mesh")) return hit;
  const [x, y, z] = at;
  const onDoor = z >= d / 2 - RACK_DOOR_DEPTH - 0.005 && Math.abs(x) <= w / 2 + 0.005 && y >= -0.005 && y <= h + 0.005;
  if (!onDoor) return null;
  // the first box the ray enters (slab method), each grown like rackSlotAt's
  const grow = 0.006;
  let best: { t: number; id: string } | null = null;
  for (const p of pieces) {
    const lo = [p.x - p.w / 2 - grow, p.y - grow, p.z - p.d / 2 - grow];
    const hi = [p.x + p.w / 2 + grow, p.y + p.h + grow, p.z + p.d / 2 + grow];
    let t0 = 0;
    let t1 = Infinity;
    for (let k = 0; k < 3 && t0 <= t1; k++) {
      if (Math.abs(dir[k]) < 1e-12) {
        if (at[k] < lo[k] || at[k] > hi[k]) t0 = Infinity;
        continue;
      }
      const a = (lo[k] - at[k]) / dir[k];
      const b = (hi[k] - at[k]) / dir[k];
      t0 = Math.max(t0, Math.min(a, b));
      t1 = Math.min(t1, Math.max(a, b));
    }
    if (t0 <= t1 && (!best || t0 < best.t)) best = { t: t0, id: p.slot.id };
  }
  return best?.id ?? null;
}

/** A piece of gear that does not fit where it is (#114: the rack frame changed, a pack update made it bigger). */
export interface RackMisfit {
  id: string;
  why: RackRefusal;
  clash: string[];
}

/** Every slot that breaks a rule where it is, in the rack's order; slots whose type is unknown are left alone. */
export function rackMisfits(space: RackSpace, slots: readonly RackSlot[], gearOf: GearOf, looseOf: LooseOf = noLoose): RackMisfit[] {
  const out: RackMisfit[] = [];
  for (const s of slots) {
    if (!(s.on ? looseOf(s.type) : gearOf(s.type))) continue;
    const c = checkSlot(space, slots, s, gearOf, looseOf);
    if (!c.ok) out.push({ id: s.id, why: c.why!, clash: c.clash });
  }
  return out;
}
