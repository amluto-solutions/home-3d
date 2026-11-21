// Some rooms on their own (#500, ported from NeonPlan 3D 4.0.0, MIT, Mastershort): the plan cut down to them, for a card
// with `rooms` (the kids' tablet, a granny flat, the guest room) and for the phone's "Room on its own". The 3D view draws
// only these rooms with what stands in them, and syncs only their devices – less to draw, so old tablets keep up.
// A wall a shown room shared with a hidden one keeps the thickness of the inner wall it was, and a door or window in
// it stays: it is filed under the shown room (seen from that side its hinge and swing are the other way round).
import { pointInPolygon, type Building, type Floor, type Opening, type Room, type Vec2 } from "./model.ts";
import { dormerParent, sectionFloor } from "./roof-sections.ts";

/** How far (m) a point may lie off an edge and still be on it. */
const ON_EDGE = 0.06;

/** Where p lies along the edge a → b: its distance from the line and from a (both in m). */
function onSegment(p: Vec2, a: Vec2, b: Vec2): { off: number; at: number; len: number } {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const len = Math.hypot(dx, dz) || 1e-9;
  const at = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len;
  const off = Math.abs((p[0] - a[0]) * dz - (p[1] - a[1]) * dx) / len;
  return { off, at, len };
}

/** The edge of the outline that p lies on, or -1. */
function onEdgeOf(p: Vec2, points: readonly Vec2[]): number {
  for (let i = 0; i < points.length; i++) {
    const s = onSegment(p, points[i], points[(i + 1) % points.length]);
    if (s.off < ON_EDGE && s.at > -ON_EDGE && s.at < s.len + ON_EDGE) return i;
  }
  return -1;
}

/** The point `offset` m along the room's edge. */
function edgePoint(room: Room, edge: number, offset: number): Vec2 | null {
  const a = room.points[edge];
  const b = room.points[(edge + 1) % room.points.length];
  if (!a || !b) return null;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1e-9;
  return [a[0] + ((b[0] - a[0]) * offset) / len, a[1] + ((b[1] - a[1]) * offset) / len];
}

/**
 * The ids of the rooms (and outdoor areas) that the plan has, from a card's `rooms` (anything else is ignored: a typo in
 * the YAML, a room deleted since). Empty: none is there, the whole house shows.
 */
export function shownRoomIds(b: Building | null | undefined, ids: unknown): string[] {
  if (!b || !Array.isArray(ids) || !ids.length) return [];
  const all = new Set(b.floors.flatMap((f) => [...f.rooms.map((r) => r.id), ...(f.outdoor ?? []).map((o) => o.id)]));
  return [...new Set(ids.filter((id): id is string => typeof id === "string" && all.has(id)))];
}

/** The floors that hold these rooms (or outdoor areas), in the plan's order. */
export function floorsOfRooms(b: Building, ids: readonly string[]): string[] {
  const want = new Set(ids);
  return b.floors.filter((f) => f.rooms.some((r) => want.has(r.id)) || (f.outdoor ?? []).some((o) => want.has(o.id))).map((f) => f.id);
}

/** The building with only these rooms and outdoor areas (by id): their furniture, devices, doors, windows and walls. */
export function roomsOnly(b: Building, ids: readonly string[]): Building {
  // some rooms show on their own: not in the neighbourhood from the map (that belongs to the whole house)
  if (b.settings.surroundings) b = { ...b, settings: { ...b.settings, surroundings: null } };
  const want = new Set(ids);
  const inner = b.settings.wall_interior ?? 0.12;
  const floors: Floor[] = [];
  let topCut = false;
  const top = roofFloorId(b);
  for (const f of b.floors) {
    const rooms = f.rooms.filter((r) => want.has(r.id));
    const outdoor = (f.outdoor ?? []).filter((o) => want.has(o.id));
    if (!rooms.length && !outdoor.length) continue;
    if (f.id === top && rooms.length < f.rooms.length) topCut = true;
    const shapes = [...rooms.map((r) => r.points), ...outdoor.map((o) => o.points)].filter((p) => p.length >= 3);
    const inside = (x: number, z: number) => shapes.some((pts) => pointInPolygon([x, z], pts));
    const hidden = f.rooms.filter((r) => !want.has(r.id) && r.points.length >= 3);
    // a wall shared with a hidden room: now an outer wall of what shows, as thin as the inner wall it was
    const cut = rooms.map((r) => {
      const n = r.points.length;
      const thick = Array.from({ length: n }, (_, i) => r.wall_thickness?.[i] ?? null);
      let changed = false;
      for (let i = 0; i < n; i++) {
        if (thick[i] !== null) continue;
        const a = r.points[i];
        const c = r.points[(i + 1) % n];
        const mid: Vec2 = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
        if (hidden.some((h) => onEdgeOf(mid, h.points) >= 0)) {
          thick[i] = inner;
          changed = true;
        }
      }
      return changed ? { ...r, wall_thickness: thick } : r;
    });
    const walls = (f.walls ?? []).filter((w) => inside((w.a[0] + w.b[0]) / 2, (w.a[1] + w.b[1]) / 2));
    const keptWalls = new Set(walls.map((w) => w.id));
    const openings: Opening[] = [];
    for (const o of f.openings) {
      if (o.wall) {
        if (keptWalls.has(o.wall)) openings.push(o);
        continue;
      }
      if (want.has(o.room_id)) {
        openings.push(o);
        continue;
      }
      // a door of the hidden neighbour in a wall the shown room has: filed under the shown room
      const host = f.rooms.find((r) => r.id === o.room_id);
      const p = host ? edgePoint(host, o.edge, o.offset) : null;
      if (!p) continue;
      for (const r of rooms) {
        const edge = onEdgeOf(p, r.points);
        if (edge < 0) continue;
        const s = onSegment(p, r.points[edge], r.points[(edge + 1) % r.points.length]);
        openings.push({ ...o, room_id: r.id, edge, offset: s.at, hinge: o.hinge === "left" ? "right" : "left", swing: o.swing === "in" ? "out" : "in" });
        break;
      }
    }
    floors.push({
      ...f,
      rooms: cut,
      outdoor,
      walls,
      openings,
      furniture: f.furniture.filter((m) => inside(m.x, m.z)),
      placements: f.placements.filter((p) => inside(p.x, p.z)),
    });
  }
  const roof = b.settings.roof;
  if (roof?.type === "custom" && roof.sections?.length) {
    // a roof of sections: each sits on a floor of its own; the sections over the floors shown stay, the others would
    // hang in the air. A dormer goes with the section it sits on.
    const shown = new Set(floors.map((f) => f.id));
    const all = roof.sections;
    const own = new Set(all.filter((s) => shown.has(sectionFloor(b, s)?.id ?? "")));
    const sections = all.filter((s) => own.has((s.dormer && dormerParent(all, s)) || s));
    if (sections.length === all.length) return { ...b, floors };
    return { ...b, floors, settings: { ...b.settings, roof: sections.length ? { ...roof, sections } : { ...roof, type: "none" } } };
  }
  // a flat or gable roof spans the top floor's rooms: without that floor it came down onto the next one, and with only
  // some of its rooms it shrank onto them (its slopes and roof windows no longer matched) – then the cut shows no roof.
  // Upstream keeps the whole footprint with a frame of the roof's own; our roof has none, so it is left out.
  const keepRoof = !roof || roof.type === "none" || top === null || (floors.some((f) => f.id === top) && !topCut);
  if (!keepRoof) return { ...b, floors, settings: { ...b.settings, roof: { ...roof, type: "none" } } };
  return { ...b, floors };
}

/** The floor the roof sits on: the highest with rooms (as the roof itself picks it). */
function roofFloorId(b: Building): string | null {
  const withRooms = b.floors.filter((f) => f.rooms.some((r) => r.points.length >= 3));
  return [...withRooms].sort((p, q) => q.elevation - p.elevation)[0]?.id ?? null;
}
