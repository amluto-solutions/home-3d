// What the read-only 2D plan (#41) draws, in floor metres: the floor shown, its items with what a tap on them does
// and their live state, the device markers, doors and windows, energy flows; and the view that fits it on screen.
// Pure data, no DOM: the plan view turns it into SVG.

import { itemColourRoles, roleColour } from "../colour-roles.ts";
import { generateWalls, locateOpening, openingHost, pointOnRoomEdge, type Wall, type WallOptions } from "../geometry/walls.ts";
import { isFrontDoor, openingStyle, sidelightLayout, signedArea, zonesOf, type Building, type Floor, type Furniture, type Vec2 } from "../model.ts";
import { packItem } from "../packs.ts";
import { readRackFrame } from "../rack-frame.ts";
import { rackDrawOf, type RackDraw } from "../rack-elevation.ts";
import type { OpeningState } from "../viewer/openings.ts";
import type { DeviceMarker, FlowPiece } from "../viewer/viewer3d.ts";

/** The floor the plan shows: the chosen one, else (the house view) the floor with rooms nearest the ground. */
export function shownFloor(b: Building, floorId: string | null): Floor | null {
  const chosen = floorId ? b.floors.find((f) => f.id === floorId) : undefined;
  if (chosen) return chosen;
  const withRooms = b.floors.filter((f) => f.rooms.some((r) => r.points.length >= 3));
  if (!withRooms.length) return b.floors[0] ?? null;
  // at ground level or the first one above it; below the ground only when nothing else is there
  return [...withRooms].sort((x, y) => rank(x.elevation) - rank(y.elevation))[0];
}

const rank = (elevation: number) => (elevation >= -0.01 ? elevation : 1000 - elevation);

/** A rack with gear and no device of its own is tapped by this pick (+ its furniture id): the tap shows its front view (#115). */
export const RACK_PICK = "rack:";

/** The rack a plan pick names, or null for any other pick. */
export const rackOfPick = (pick: string | null): string | null => (pick?.startsWith(RACK_PICK) ? pick.slice(RACK_PICK.length) : null);

/** How to draw a tapped rack's front view (#115): null when the item is gone or no rack. */
export function rackDraw(floor: Floor, furnitureId: string): RackDraw | null {
  const f = floor.furniture.find((o) => o.id === furnitureId);
  return f ? rackDrawOf(f, packItem) : null;
}

/** A furniture item as the plan draws it. */
export interface PlanItem {
  f: Furniture;
  /** What a tap on it reports (as in 3D: its entity, its pin, "item:<id>" for own actions); null: not tappable. */
  pick: string | null;
  /** Its device is on (a lamp lit, a TV playing …). */
  on: boolean;
  unavailable: boolean;
  /** A light's colour while it is on, or the colour of its temperature ("rgb(…)"). */
  glow: string | null;
  /** It shades with its temperature (a radiator, a cylinder, #10): filled with `glow` whether on or not. */
  shade?: boolean;
  /** The item's own colour of its main colour role (#12), or null for the look's. */
  tint: string | null;
}

/**
 * The floor's items with their pick ids (`targets`: furniture id → pick id) and their devices' states. A lamp has no
 * target: in 3D its light's marker makes the lamp tappable, so here too.
 */
export function planItems(floor: Floor, targets: ReadonlyMap<string, string>, devices: readonly DeviceMarker[], shades: ReadonlyMap<string, readonly number[]> = new Map()): PlanItem[] {
  const byId = new Map(devices.map((d) => [d.id, d]));
  const lamps = new Map(devices.filter((d) => d.furnitureId && d.pickable).map((d) => [d.furnitureId!, d]));
  return floor.furniture.map((f) => {
    const pick = targets.get(f.id) ?? lamps.get(f.id)?.id ?? (f.rack?.slots?.length && readRackFrame(packItem(f.type)) ? `${RACK_PICK}${f.id}` : null);
    const m = pick ? byId.get(pick) : undefined;
    const on = !!m?.active && !m.unavailable;
    const tint = itemColourRoles(f.type).map((r) => roleColour(f.colors, r)).find((c) => !!c) ?? null;
    // a radiator or cylinder in the colour of its temperature (#10)
    const shade = shades.get(f.id);
    return { f, pick, on, unavailable: !!m?.unavailable, glow: shade ? rgb(shade) : on && m?.glow ? rgb(m.glow.color) : null, tint, ...(shade ? { shade: true } : {}) };
  });
}

/** A colour of the 3D view (0..1 per channel) for CSS. */
const rgb = (c: readonly number[]) => `rgb(${c.map((v) => Math.round(v * 255)).join(",")})`;

/** The markers the plan shows on a floor: those with a pin (the view decides which carry one). */
export function planMarkers(devices: readonly DeviceMarker[], floorId: string): DeviceMarker[] {
  return devices.filter((m) => m.floorId === floorId && m.pin !== false);
}

/** A door, window or garage door in the plan (floor metres). */
export interface PlanOpening {
  id: string;
  type: Floor["openings"][number]["type"];
  front: boolean;
  /** The gap it leaves in the wall. */
  gap: Vec2[];
  /** Panes, a sliding leaf, a garage door's panel. */
  lines: [Vec2, Vec2][];
  /** Dashed lines (a garage door's track). */
  dashed: [Vec2, Vec2][];
  /** Swinging leaves: the leaf and its swing as an SVG path, and the leaf's length. */
  arcs: { d: string; r: number }[];
  /** A wide band along it to tap it by. */
  hit: [Vec2, Vec2];
  pick: string | null;
  /** Open or tilted now (its sensor or cover says so). */
  open: boolean;
  /** Its blind or garage door is (mostly) down. */
  covered: boolean;
}

/** The floor's doors and windows; `targets` maps an opening to what a tap on it reports (as in 3D). */
export function planOpenings(floor: Floor, wallOpts: WallOptions, targets: ReadonlyMap<string, string>, states: ReadonlyMap<string, OpeningState>, walls?: readonly Wall[]): PlanOpening[] {
  const all = walls ?? generateWalls(floor.rooms, wallOpts, floor.walls ?? []).walls;
  const out: PlanOpening[] = [];
  for (const o of floor.openings) {
    const host = openingHost(o, floor.rooms, floor.walls ?? []);
    if (!host) continue;
    const { room, edge } = host;
    const hit = locateOpening(all, o, host);
    const p0 = pointOnRoomEdge(room, edge, o.offset - o.width / 2);
    const p1 = pointOnRoomEdge(room, edge, o.offset + o.width / 2);
    const ux = (p1[0] - p0[0]) / (o.width || 1);
    const uz = (p1[1] - p0[1]) / (o.width || 1);
    // the normal into the room (outlines may run either way round)
    const sgn = signedArea(room.points) >= 0 ? 1 : -1;
    const n: Vec2 = [-uz * sgn, ux * sgn];
    let across: [number, number] = [0.06, 0.06];
    if (hit) across = hit.wall.free || hit.wall.roomLeft === room.id ? [hit.wall.left, hit.wall.right] : [hit.wall.right, hit.wall.left];
    const q = (p: Vec2, k: number): Vec2 => [p[0] + n[0] * k, p[1] + n[1] * k];
    const style = openingStyle(o, hit?.wall.exterior ?? false);
    const mid = (across[0] - across[1]) / 2;
    const lines: [Vec2, Vec2][] = [];
    const dashed: [Vec2, Vec2][] = [];
    const arcs: { d: string; r: number }[] = [];
    if (o.type === "garage") {
      // the door panel just inside, its track under the ceiling dashed
      const a0 = q(p0, across[0] - 0.04);
      const a1 = q(p1, across[0] - 0.04);
      lines.push([a0, a1]);
      dashed.push([a0, q(p0, across[0] + Math.min(2, o.height))], [a1, q(p1, across[0] + Math.min(2, o.height))]);
    } else if (o.type === "door") {
      const out = o.swing === "out";
      const face = out ? -across[1] : across[0];
      const hingeAtP0 = (o.hinge === "left") === sgn > 0;
      const two = o.leaves === 2;
      let l0 = p0;
      let l1 = p1;
      const lights = sidelightLayout(o.width, style, hingeAtP0, o);
      if (lights) {
        const at = (k: number): Vec2 => (k <= 0.02 ? p0 : k >= o.width - 0.02 ? p1 : pointOnRoomEdge(room, edge, o.offset - o.width / 2 + k));
        l0 = at(lights.x0);
        l1 = at(lights.x1);
        for (const [a, b] of lights.panels) lines.push([q(at(a), mid + 0.035), q(at(b), mid + 0.035)], [q(at(a), mid - 0.035), q(at(b), mid - 0.035)]);
      }
      const midP: Vec2 = [(l0[0] + l1[0]) / 2, (l0[1] + l1[1]) / 2];
      const leafW = (two ? 0.5 : 1) * Math.hypot(l1[0] - l0[0], l1[1] - l0[1]);
      const arc = (hinge: Vec2, free: Vec2) => {
        const h = q(hinge, face);
        const f = q(free, face);
        const leaf = q(hinge, face + (out ? -leafW : leafW));
        const cross = (leaf[0] - h[0]) * (f[1] - h[1]) - (leaf[1] - h[1]) * (f[0] - h[0]);
        arcs.push({ d: `M${h[0]} ${h[1]}L${leaf[0]} ${leaf[1]}A${leafW} ${leafW} 0 0 ${cross > 0 ? 1 : 0} ${f[0]} ${f[1]}`, r: leafW });
      };
      if (style === "passage") dashed.push([q(p0, mid), q(p1, mid)]);
      else if (style === "sliding") lines.push([q(l0, face), q(l1, face)]);
      else if (two) {
        arc(l0, midP);
        arc(l1, midP);
      } else arc(hingeAtP0 ? l0 : l1, hingeAtP0 ? l1 : l0);
    } else {
      // two panes in the middle of the wall; a double window has a post between its leaves
      lines.push([q(p0, mid + 0.035), q(p1, mid + 0.035)], [q(p0, mid - 0.035), q(p1, mid - 0.035)]);
      if (o.leaves === 2) {
        const m: Vec2 = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2];
        lines.push([q(m, across[0]), q(m, -across[1])]);
      }
    }
    const st = states.get(o.id);
    out.push({
      id: o.id,
      type: o.type,
      front: o.type === "door" && isFrontDoor(style),
      gap: [q(p0, across[0] + 0.01), q(p1, across[0] + 0.01), q(p1, -across[1] - 0.01), q(p0, -across[1] - 0.01)],
      lines,
      dashed,
      arcs,
      hit: [q(p0, mid), q(p1, mid)],
      pick: targets.get(o.id) ?? null,
      // without a sensor 3D shows a guess: only a sensed state counts as open
      open: !!st?.sensed && (st.open > 0.05 || (st.open2 ?? 0) > 0.05 || st.tilt > 0.05 || (st.tilt2 ?? 0) > 0.05 || (o.type === "garage" && st.cover !== null && st.cover < 0.95)),
      covered: !!st && o.type !== "garage" && st.cover !== null && st.cover > 0.5,
    });
  }
  return out;
}

/** A piece of an energy flow on the plan. */
export interface PlanFlow {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  color: string;
  /** Power runs through it now (its stripes move). */
  moving: boolean;
  /** Width against a plain cable's. */
  width: number;
}

/** The energy flows (#28, #43) on the floor shown; pieces meant for the house view only stay away. */
export function flowLines(flows: readonly FlowPiece[], floorId: string): PlanFlow[] {
  return flows
    .filter((p) => p.floorId === floorId && !p.house)
    .map((p) => ({ x1: p.a[0], z1: p.a[2], x2: p.b[0], z2: p.b[2], color: rgb(p.color), moving: Math.abs(p.power) >= 1, width: (p.width ?? 1) * (p.thick ?? 1) }));
}

/** The box around what a floor holds (rooms, else outdoor areas; devices and items too). */
export function planBounds(floor: Floor): { x0: number; z0: number; x1: number; z1: number } | null {
  const pts: Vec2[] = floor.rooms.flatMap((r) => r.points);
  if (!pts.length) pts.push(...floor.outdoor.flatMap((a) => a.points));
  for (const f of floor.furniture) pts.push([f.x, f.z]);
  for (const p of floor.placements) pts.push([p.x, p.z]);
  if (!pts.length) return null;
  const xs = pts.map((p) => p[0]);
  const zs = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) };
}

/** How the plan lies on screen: screen = metres × k + (tx, ty). */
export interface PlanView {
  k: number;
  tx: number;
  ty: number;
}

/**
 * Where the view's anchors sit on screen: a point on the plan (`plan`, the energy cables' ends, #29) on the floor
 * shown is where the plan draws it; the floating cards belong to the 3D view and stay hidden.
 */
export function anchorSpots(anchors: readonly { p: readonly [number, number, number]; floorId: string; plan?: boolean }[], floorId: string | null, v: PlanView, below = 0): { on: boolean; x: number; y: number }[] {
  // `below`: pixels under the point, so a device pin drawn on the very point keeps its taps
  return anchors.map((a) => (a.plan && a.floorId === floorId ? { on: true, x: v.tx + a.p[0] * v.k, y: v.ty + a.p[2] * v.k + below } : { on: false, x: 0, y: 0 }));
}

const MIN_K = 2;
const MAX_K = 2000;

/** The view that shows the box whole, centred, `pad` pixels from the edges. */
export function fitView(box: { x0: number; z0: number; x1: number; z1: number }, w: number, h: number, pad = 24): PlanView {
  const bw = Math.max(0.5, box.x1 - box.x0);
  const bh = Math.max(0.5, box.z1 - box.z0);
  const k = Math.min(MAX_K, Math.max(MIN_K, Math.min((w - 2 * pad) / bw, (h - 2 * pad) / bh)));
  return { k, tx: (w - bw * k) / 2 - box.x0 * k, ty: (h - bh * k) / 2 - box.z0 * k };
}

/**
 * Fit `box` into a view of `size` less what covers its edges: the floor pictures on the left, the stat chips at the
 * top and the bottom bar (with time travel) below, so no part of the plan starts hidden (#91).
 */
export function fitInside(box: { x0: number; z0: number; x1: number; z1: number }, size: { w: number; h: number }, inset: { left: number; top: number; bottom: number }, pad = 28): PlanView {
  const v = fitView(box, Math.max(1, size.w - inset.left), Math.max(1, size.h - inset.top - inset.bottom), pad);
  return { k: v.k, tx: v.tx + inset.left, ty: v.ty + inset.top };
}

/**
 * Where the plan goes when a room is chosen while a sheet (the room panel on a phone) covers the lower part of the view
 * (#259, V13): the room, fitted and centred in the part above the sheet, as the 3D view zooms to it. Null when nothing
 * covers the plan (the room panel beside it on a wide screen: the plan keeps its place) or the room is not on the floor.
 */
export function roomFocusView(floor: Floor, roomId: string | null, size: { w: number; h: number }, bottom: number): PlanView | null {
  if (!roomId || bottom < size.h * 0.3) return null;
  const room = zonesOf(floor).find((r) => r.id === roomId);
  if (!room || room.points.length < 3) return null;
  const xs = room.points.map((p) => p[0]);
  const zs = room.points.map((p) => p[1]);
  const box = { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) };
  // the room with a margin around it: the walls and the doors next to it stay in sight
  return fitInside(box, size, { left: 0, top: 60, bottom: Math.min(bottom + 8, size.h * 0.7) }, 36);
}

/** Zoom by `factor` around the screen point (px, py), which stays where it is. */
export function zoomView(v: PlanView, factor: number, px: number, py: number): PlanView {
  const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
  const s = k / v.k;
  return { k, tx: px - (px - v.tx) * s, ty: py - (py - v.ty) * s };
}

/** Small pictures of every floor with rooms (the floor switcher), as SVG data URLs: the rooms' outlines, fitted. */
export function floorPictures(b: Building, width: number, height: number): { floorId: string; url: string }[] {
  const out: { floorId: string; url: string }[] = [];
  for (const floor of b.floors) {
    const rooms = floor.rooms.filter((r) => r.points.length >= 3);
    if (!rooms.length) continue;
    const pts = rooms.flatMap((r) => r.points);
    const box = { x0: Math.min(...pts.map((p) => p[0])), z0: Math.min(...pts.map((p) => p[1])), x1: Math.max(...pts.map((p) => p[0])), z1: Math.max(...pts.map((p) => p[1])) };
    const v = fitView(box, width, height, 8);
    const at = (p: Vec2) => `${round(p[0] * v.k + v.tx)},${round(p[1] * v.k + v.ty)}`;
    const polys = rooms.map((r) => `<polygon points="${r.points.map(at).join(" ")}" fill="rgba(91,124,255,0.22)" stroke="#37e0ff" stroke-width="1.5" stroke-linejoin="round"/>`).join("");
    const text = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${polys}</svg>`;
    out.push({ floorId: floor.id, url: `data:image/svg+xml,${encodeURIComponent(text)}` });
  }
  return out;
}

const round = (n: number) => Math.round(n * 10) / 10;
