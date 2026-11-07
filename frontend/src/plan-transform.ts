// Shift floor and Turn floor (#156): one place that knows every field of the plan holding plan coordinates (or a
// plan direction) and moves or turns them all with the floor or the whole house. PLAN_FIELDS lists them; the test
// reads model.ts and fails when a new coordinate field is neither listed here nor named as not a plan coordinate.
// Pure functions on the building, no Lit.

import type { Building, Floor, OutdoorArea, RoofSection, RoofWindow, SlopeDir, SolarField, StartView, Vec2 } from "./model.ts";
import { fieldFace, fieldModules, fieldSize, GROUND, groundFace, groundFloor, roofFaces, rowCounts, topFloor, wallFaces, windowAsField, type RoofFace } from "./solar.ts";
import { petFloor, placeFloor } from "./pet-place.ts";

/** A move of the plan: a shift (no turn) or a quarter turn clockwise in the plan about a point. */
export interface PlanTransform {
  /** Where a plan point goes. */
  point(p: Vec2): Vec2;
  /** Quarter turns clockwise in the plan: 0 = a shift, 1 = Turn floor. */
  quarter: 0 | 1;
}

const round = (v: number) => Math.round(v * 1000) / 1000;

export function shiftBy(dx: number, dz: number): PlanTransform {
  return { point: (p) => [round(p[0] + dx), round(p[1] + dz)], quarter: 0 };
}

/** A quarter turn clockwise in the plan (+x goes to +z) about (cx, cz). */
export function turnAbout(cx: number, cz: number): PlanTransform {
  return { point: (p) => [round(cx - (p[1] - cz)), round(cz + (p[0] - cx))], quarter: 1 };
}

/** A plan direction (no position) after the transform. */
function dir(t: PlanTransform, v: Vec2): Vec2 {
  return t.quarter ? [-v[1], v[0]] : v;
}

/** A plan angle in degrees (clockwise, as furniture rotation) after the transform. */
function deg(t: PlanTransform, a: number): number {
  return (a + 90 * t.quarter) % 360;
}

const SLOPE_TURN: Record<SlopeDir, SlopeDir> = { x: "z", z: "-x", "-x": "-z", "-z": "x" };

/**
 * Every field holding plan coordinates or a plan direction, as "Interface.field" of model.ts, and how
 * `transformPlan` treats it. A field added to model.ts that holds plan coordinates goes here (and into
 * `transformPlan`); plan-transform.test.ts checks both.
 */
export const PLAN_FIELDS = {
  "Room.points": "moved",
  // #350: the pairs' plan ends (p) move, the robot's own (v) stay
  "VacuumMap.points": "moved",
  "Room.start_view": "a StartView, moved with its room",
  "Furniture.x": "moved",
  "Furniture.z": "moved",
  "Furniture.rotation": "turned",
  "Furniture.bin_kerb": "moved",
  "Placement.x": "moved",
  "Placement.z": "moved",
  "Placement.rotation": "turned",
  "Background.x": "moved",
  "Background.z": "moved",
  "Background.rotation": "turned",
  "Floor.start_view": "a StartView, moved with its floor",
  "FreeWall.a": "moved",
  "FreeWall.b": "moved",
  "RoofSection.x0": "moved (all floors)",
  "RoofSection.z0": "moved (all floors)",
  "RoofSection.x1": "moved (all floors)",
  "RoofSection.z1": "moved (all floors)",
  "RoofSection.axis": "turned (all floors)",
  "RoofSection.points": "moved (all floors)",
  "RoofSection.rotation": "kept: the section turns about its moved pivot",
  "RoofSection.pivot": "moved (all floors)",
  "SolarField.u": "garden: moved with the ground floor; roof and wall: kept on its face, which is found again",
  "SolarField.v": "as u",
  "SolarField.face": "wall and roof faces found again after the move (wall ids hold coordinates)",
  "SolarField.rotation": "garden fields turned",
  "HologramSettings.x": "moved (all floors)",
  "HologramSettings.z": "moved (all floors)",
  "CableRoute.points": "moved with its floor",
  "RoofWindow.u": "kept on its face, which is found again",
  "RoofWindow.v": "as u",
  "RoofWindow.face": "as SolarField.face",
  "Pet.x": "moved with its floor",
  "Pet.z": "moved with its floor",
  "Pet.rotation": "turned",
  "PetPlace.x": "a routine spot or trigger place (#337): moved with its floor",
  "PetPlace.z": "as x",
  "PetPlace.rotation": "turned",
  "BuildingSettings.north": "turned (all floors)",
  "BuildingSettings.start_view": "a StartView, moved with the whole house (all floors)",
  "StartView.target": "moved",
  "StartView.theta": "turned (the camera looks from the same side of what it shows)",
  "OutdoorArea.points": "moved",
  "OutdoorArea.slope_dir": "turned",
  "PoolPort.x": "moved with its pool",
  "PoolPort.z": "moved with its pool",
  "PoolPipe.points": "moved with its floor",
  "PoolJoint.x": "moved with its pool",
  "PoolJoint.z": "moved with its pool",
  "PoolJoint.nx": "turned",
  "PoolJoint.nz": "turned",
  "EnergySettings.meter": "moved with its floor",
} as const;

function moveView(t: PlanTransform, v: StartView | null | undefined): void {
  if (!v) return;
  if (v.target) [v.target.x, v.target.z] = t.point([v.target.x, v.target.z]);
  // the camera offset is (sin θ, cos θ) in the plan: a quarter turn clockwise takes θ to θ − 90°
  if (t.quarter) {
    v.theta -= Math.PI / 2;
    if (v.theta <= -Math.PI) v.theta += 2 * Math.PI;
  }
}

function moveArea(t: PlanTransform, a: OutdoorArea): void {
  a.points = a.points.map(t.point);
  if (t.quarter && (a.slope_dir || a.slope)) a.slope_dir = SLOPE_TURN[a.slope_dir ?? "x"];
  const pool = a.pool;
  if (!pool) return;
  for (const p of pool.ports ?? []) [p.x, p.z] = t.point([p.x, p.z]);
  for (const j of pool.joints ?? []) {
    [j.x, j.z] = t.point([j.x, j.z]);
    if (j.nx != null && j.nz != null) [j.nx, j.nz] = dir(t, [j.nx, j.nz]);
  }
}

function moveFloor(t: PlanTransform, f: Floor): void {
  for (const r of f.rooms) {
    r.points = r.points.map(t.point);
    moveView(t, r.start_view);
  }
  for (const m of f.furniture) {
    [m.x, m.z] = t.point([m.x, m.z]);
    if (t.quarter) m.rotation = deg(t, m.rotation);
    if (m.bin_kerb) [m.bin_kerb.x, m.bin_kerb.z] = t.point([m.bin_kerb.x, m.bin_kerb.z]);
  }
  for (const p of f.placements) {
    [p.x, p.z] = t.point([p.x, p.z]);
    if (t.quarter) p.rotation = deg(t, p.rotation ?? 0);
  }
  for (const a of f.outdoor) moveArea(t, a);
  for (const w of f.walls ?? []) {
    w.a = t.point(w.a);
    w.b = t.point(w.b);
  }
  if (f.background) {
    [f.background.x, f.background.z] = t.point([f.background.x, f.background.z]);
    if (t.quarter) f.background.rotation = deg(t, f.background.rotation ?? 0);
  }
  moveView(t, f.start_view);
}

/**
 * A roof section moved with the house. Turned, its rectangle turns into the other one and the ridge runs the other
 * way: a ridge along x becomes one along z with sides a and b kept where they were (flip changes), a ridge along z
 * becomes one along x whose ends swap (u runs the other way). A turned wing keeps its angle and turns about its moved
 * pivot: turning both about different points equals turning the turned rectangle about the moved pivot.
 */
export function moveSection(t: PlanTransform, s: RoofSection): void {
  const [ax, az] = t.point([s.x0, s.z0]);
  const [bx, bz] = t.point([s.x1, s.z1]);
  s.x0 = Math.min(ax, bx);
  s.x1 = Math.max(ax, bx);
  s.z0 = Math.min(az, bz);
  s.z1 = Math.max(az, bz);
  if (s.points) s.points = s.points.map(t.point);
  if (s.pivot) s.pivot = t.point(s.pivot);
  if (!t.quarter) return;
  if (s.axis === "x") {
    s.axis = "z";
    s.flip = !s.flip;
  } else {
    s.axis = "x";
    const [e0, e1] = [s.end_u0, s.end_u1];
    if (e0 !== undefined || e1 !== undefined) {
      s.end_u0 = e1 ?? null;
      s.end_u1 = e0 ?? null;
    }
  }
}

/** A field or roof window on a roof or wall face, with the face it lay on before the move. */
interface Anchor {
  item: SolarField | RoofWindow;
  field: SolarField;
  face: RoofFace;
}

type V3 = [number, number, number];
const dot = (a: V3, b: V3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

function sameFace(a: RoofFace, b: RoofFace): boolean {
  const near = (p: V3, q: V3) => Math.abs(p[0] - q[0]) + Math.abs(p[1] - q[1]) + Math.abs(p[2] - q[2]) < 1e-6;
  return near(a.o, b.o) && near(a.eu, b.eu) && near(a.es, b.es) && Math.abs(a.lu - b.lu) < 1e-6 && Math.abs(a.ls - b.ls) < 1e-6;
}

/**
 * Put a field back on its face after the move: the face it lay on, moved, is found among the new faces (same
 * plane, same directions, holding the field's middle) and the field gets that face's key and its corner there.
 * A face whose eave or slope now runs the other way (a flat roof turned) mirrors the field's rows or columns, so the
 * modules stay where they were. Returns false when no face fits (the field is left as it was).
 */
function reanchor(t: PlanTransform, a: Anchor, faces: readonly RoofFace[]): boolean {
  const T3 = (p: V3): V3 => {
    const [x, z] = t.point([p[0], p[2]]);
    return [x, p[1], z];
  };
  const R3 = (v: V3): V3 => {
    const [x, z] = dir(t, [v[0], v[2]]);
    return [x, v[1], z];
  };
  const { face, field } = a;
  const [w, d] = fieldSize(face, field);
  const at = (u: number, s: number): V3 => {
    const p: V3 = [face.o[0] + face.eu[0] * u + face.es[0] * s, face.o[1] + face.eu[1] * u + face.es[1] * s, face.o[2] + face.eu[2] * u + face.es[2] * s];
    return T3(p);
  };
  const c0 = at(field.u, field.v);
  const c1 = at(field.u + w, field.v + d);
  // the face is recognised by where the modules are (rows that do not fit on the face are left out of the field)
  const shown = fieldModules(face, field, true).flatMap((m) => m.corners);
  const mid: V3 = shown.length
    ? T3([0, 1, 2].map((i) => shown.reduce((sum, c) => sum + c[i], 0) / shown.length) as V3)
    : c0;
  const eu = R3(face.eu);
  const es = R3(face.es);
  const n = R3(face.n);
  for (const g of faces) {
    if (dot(g.n, n) < 0.999 || Math.abs(dot(g.eu, eu)) < 0.999 || Math.abs(dot(g.es, es)) < 0.999) continue;
    // the modules ride a little above the face: the plane through the field's corner, not its modules
    if (Math.abs(dot(sub(c0, g.o), g.n)) > 0.02) continue;
    const mu = dot(sub(mid, g.o), g.eu);
    const ms = dot(sub(mid, g.o), g.es);
    if (mu < -0.02 || mu > g.lu + 0.02 || ms < -0.02 || ms > g.ls + 0.02) continue;
    const u0 = dot(sub(c0, g.o), g.eu);
    const u1 = dot(sub(c1, g.o), g.eu);
    const s0 = dot(sub(c0, g.o), g.es);
    const s1 = dot(sub(c1, g.o), g.es);
    const item = a.item;
    item.face = g.key;
    item.u = round(Math.min(u0, u1));
    item.v = round(Math.min(s0, s1));
    if ("rows" in item) mirror(item, dot(g.eu, eu) < 0, dot(g.es, es) < 0);
    return true;
  }
  return false;
}

/** A field whose face now runs the other way along the eave (columns) or across (rows): the same modules, mirrored. */
function mirror(f: SolarField, cols: boolean, rows: boolean): void {
  if (!cols && !rows) return;
  const counts = rowCounts(f);
  const last = counts.length - 1;
  if (cols && f.align && f.align !== "center") f.align = f.align === "left" ? "right" : "left";
  else if (cols && !f.align && counts.some((c) => c !== counts[0])) f.align = "right";
  if (f.skip?.length) {
    f.skip = f.skip.map((cell) => {
      const [r, c] = cell.split(":").map(Number);
      const c2 = cols ? counts[r] - 1 - c : c;
      const r2 = rows ? last - r : r;
      return `${r2}:${c2}`;
    });
  }
  if (rows) {
    if (f.layout?.length) f.layout = [...f.layout].reverse();
    f.flip = !f.flip;
  }
}

/**
 * Move or turn the given floors (null: every floor, the whole house) and everything on them: rooms, furniture and
 * their bin kerb spots, devices, outdoor areas with their pools (ports, joints, pipes), free walls, the background,
 * static pets, cables and the meter of those floors, garden solar fields with the ground floor, start views, and
 * fields and roof windows on walls (and on the roof when it moves) found again on their moved face. With every floor
 * also the roof sections, the free hologram, the house's start view and north. Changes `doc` in place.
 */
export function transformPlan(doc: Building, floorIds: readonly string[] | null, t: PlanTransform): void {
  const all = floorIds == null;
  const moved = new Set(all ? doc.floors.map((f) => f.id) : floorIds);
  const roof = doc.settings.roof;
  // before anything moves: the faces fields lie on, the floor of each pet and of the garden
  const roofMoves = all || (roof.type !== "custom" && roof.type !== "none" && moved.has(topFloor(doc)?.id ?? ""));
  const oldRoof = roofFaces(doc);
  const anchors: Anchor[] = [];
  const hosted = (item: SolarField | RoofWindow, field: SolarField) => {
    if (item.face === GROUND) return;
    const wall = item.face.startsWith("wall:");
    if (wall ? !moved.has(item.face.split(":")[1]) : !roofMoves) return;
    const face = fieldFace(doc, field, oldRoof);
    if (face) anchors.push({ item, field, face });
  };
  for (const f of roof.solar ?? []) hosted(f, f);
  for (const w of roof.windows ?? []) hosted(w, windowAsField(w));
  const ground = groundFloor(doc)?.id;
  const pets = (doc.settings.pets?.list ?? []).filter((p) => p.x != null && p.z != null && moved.has(petFloor(doc, p)?.id ?? ""));
  // a pet's routine spots and trigger places (#337), each on its own floor
  const places = (doc.settings.pets?.list ?? []).flatMap((p) => [...(p.spots ?? []), ...(p.triggers ?? [])].filter((s) => s.x != null && s.z != null && moved.has(placeFloor(doc, p, s)?.id ?? "")));

  for (const f of doc.floors) if (moved.has(f.id)) moveFloor(t, f);
  for (const f of doc.floors) {
    for (const a of f.outdoor) for (const p of a.pool?.pipes ?? []) if (moved.has(p.floor_id)) p.points = p.points.map(t.point);
  }
  for (const c of roof.cables ?? []) if (moved.has(c.floor_id)) c.points = c.points.map(t.point);
  const meter = doc.energy.meter;
  if (meter && moved.has(meter.floor_id)) [meter.x, meter.z] = t.point([meter.x, meter.z]);
  // the plan ends of a robot vacuum map's alignment pairs (#350)
  for (const m of doc.settings.vacuum_maps ?? []) if (moved.has(m.floor_id)) for (const pr of m.points ?? []) pr.p = t.point(pr.p);
  for (const p of [...pets, ...places]) {
    [p.x, p.z] = t.point([p.x!, p.z!]);
    if (t.quarter && p.rotation != null) p.rotation = deg(t, p.rotation);
  }
  if (ground && moved.has(ground)) {
    for (const f of roof.solar ?? []) {
      if (f.face !== GROUND) continue;
      // the field's corner in the plan, moved; u and v count along its (turned) axes
      const g = groundFace(doc, f);
      const [x, z] = t.point([g.eu[0] * f.u + g.es[0] * f.v, g.eu[2] * f.u + g.es[2] * f.v]);
      if (t.quarter) f.rotation = deg(t, f.rotation ?? 0);
      const r = ((f.rotation ?? 0) * Math.PI) / 180;
      f.u = round(x * Math.cos(r) + z * Math.sin(r));
      f.v = round(-x * Math.sin(r) + z * Math.cos(r));
    }
  }
  if (all) {
    for (const s of roof.sections ?? []) moveSection(t, s);
    const h = roof.hologram;
    if (h && h.place === "free" && h.x != null && h.z != null) [h.x, h.z] = t.point([h.x, h.z]);
    moveView(t, doc.settings.start_view);
    if (t.quarter) doc.settings.north = deg(t, doc.settings.north ?? 0);
  }

  // fields and roof windows on what moved: found again on the moved face (a wall's key holds its coordinates)
  if (anchors.length) {
    const newRoof = roofFaces(doc);
    const walls = new Map<string, RoofFace[]>();
    for (const a of anchors) {
      const floorId = a.item.face.startsWith("wall:") ? a.item.face.split(":")[1] : null;
      if (floorId && !walls.has(floorId)) walls.set(floorId, wallFaces(doc, floorId));
      const faces = floorId ? walls.get(floorId)! : newRoof;
      const same = faces.find((g) => g.key === a.item.face);
      if (same && sameFace(same, a.face)) continue;
      reanchor(t, a, faces);
    }
  }
}
