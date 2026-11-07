import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Building, type RoofSection, type SolarField, type Vec2 } from "./model.ts";
import { fieldFace, fieldModules, GROUND, proposeField, proposeGroundField, proposeWallField, roofFaces, wallFaces, windowCorners, type RoofFace } from "./solar.ts";
import { PLAN_FIELDS, shiftBy, transformPlan, turnAbout, type PlanTransform } from "./plan-transform.ts";

// ---------------------------------------------------------------------------------------------------------------
// 1. Every field of model.ts that holds plan coordinates or a plan direction is listed in PLAN_FIELDS (or here, as
//    not a plan coordinate, with the reason). A new coordinate field fails this test until it is handled.

/** Fields that look like coordinates but are not plan coordinates (none at the moment). */
const NOT_PLAN: Record<string, string> = {};

/** Field names and types that hold plan coordinates or a plan direction. */
const COORD_NAME = /^(x|z|x0|x1|z0|z1|u|v|nx|nz|rotation|theta|north|axis|slope_dir|pivot|points|a|b|face)$/;
const COORD_TYPE = /\bVec2\b|\bStartView\b|\bx\??\s*:\s*number/;

function coordinateFields(): string[] {
  const src = readFileSync(new URL("./model.ts", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const out: string[] = [];
  const head = /(?:export\s+)?interface\s+(\w+)[^{]*\{/g;
  let m: RegExpExecArray | null;
  while ((m = head.exec(src))) {
    // the interface's own fields: statements at the first level of its braces
    let depth = 1;
    let stmt = "";
    const stmts: string[] = [];
    for (let i = head.lastIndex; i < src.length; i++) {
      const ch = src[i];
      if ("{([".includes(ch)) depth++;
      if ("})]".includes(ch)) depth--;
      if (depth === 0) break;
      if (ch === ";" && depth === 1) {
        stmts.push(stmt.trim());
        stmt = "";
      } else stmt += ch;
    }
    for (const st of stmts) {
      const f = /^(\w+)\??\s*:\s*([\s\S]*)$/.exec(st);
      if (f && (COORD_NAME.test(f[1]) || COORD_TYPE.test(f[2]))) out.push(`${m[1]}.${f[1]}`);
    }
  }
  return out.sort();
}

test("every plan-coordinate field of model.ts is moved by Shift floor and Turn floor (#156)", () => {
  const found = coordinateFields();
  assert.ok(found.includes("Furniture.bin_kerb") && found.includes("PoolJoint.nx"), "the scan finds the fields");
  const missing = found.filter((k) => !(k in PLAN_FIELDS) && !(k in NOT_PLAN));
  assert.deepEqual(missing, [], "add these to PLAN_FIELDS and transformPlan (plan-transform.ts), or to NOT_PLAN with the reason");
  const stale = Object.keys(PLAN_FIELDS).filter((k) => !found.includes(k));
  assert.deepEqual(stale, [], "PLAN_FIELDS names fields model.ts no longer has");
});

// ---------------------------------------------------------------------------------------------------------------
// 2. A plan with every one of those fields set; after a shift and a turn each one moved by the same transform.

const rect = (x0: number, z0: number, x1: number, z1: number): Vec2[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

function section(id: string, x0: number, z0: number, x1: number, z1: number, more: Partial<RoofSection>): RoofSection {
  return { id, x0, z0, x1, z1, shape: "gable", axis: "x", eave_a: 2.6, eave_b: 2.6, pitch_a: 35, pitch_b: 35, base: 2.6, ...more };
}

function plan(): Building {
  const b = emptyBuilding();
  const g = newFloor("g", "Ground", 0);
  g.height = 2.6;
  g.rooms.push({ id: "r1", name: "Lounge", area_id: null, points: rect(0, 0, 8, 6), floor_material: "wood", start_view: { theta: 0.4, phi: 0.8, radius: 9, target: { x: 4, y: 0.5, z: 3 } } });
  g.rooms.push({ id: "r2", name: "Garage", area_id: null, points: rect(8, 0, 11, 4), floor_material: "concrete" });
  g.rooms.push({ id: "r3", name: "Porch", area_id: null, points: rect(-4, 0, 0, 2), floor_material: "stone" });
  g.furniture.push({ id: "bin", type: "bin", x: 12, z: 1, rotation: 30, w: 0.6, d: 0.7, h: 1, variant: null, bin_kerb: { x: 14, z: 7 } });
  g.furniture.push({ id: "pump", type: "pool_pump", x: 3, z: 10, rotation: 0, w: 0.5, d: 0.4, h: 0.4, variant: null });
  g.placements.push({ entity_id: "light.sample_lounge", x: 2, z: 2, y: null, rotation: 45 });
  g.walls = [{ id: "fw", a: [1, 1], b: [3, 1] }];
  g.background = { image_id: "img", x: 1, z: -1, width: 12, opacity: 0.5, rotation: 10 };
  g.start_view = { theta: -0.6, phi: 0.9, radius: 14, target: { x: 5, y: 0, z: 2 } };
  g.outdoor.push({ id: "lawn", type: "lawn", points: rect(-2, 7, 12, 14), slope: 0.3, slope_dir: "-z" });
  g.outdoor.push({
    id: "pool",
    type: "pool",
    points: rect(4, 9, 8, 12),
    pool: {
      ports: [{ id: "sk", kind: "skimmer", x: 4.1, z: 10 }],
      joints: [{ id: "hole", kind: "wall", x: 3.5, z: 9.5, y: 0.2, nx: 1, nz: 0 }],
      pipes: [{ id: "p", from: "port:sk", to: "dev:pump", floor_id: "g", points: [[3.8, 10], [3.2, 10.2]] }],
    },
  });
  const u = newFloor("u", "Upper", 2.6);
  u.rooms.push({ id: "r4", name: "Bedroom", area_id: null, points: rect(0, 0, 8, 6), floor_material: "carpet" });
  u.furniture.push({ id: "bed", type: "bed", x: 2, z: 2, rotation: 0, w: 1.4, d: 2, h: 0.5, variant: null });
  b.floors = [g, u];
  b.settings.north = 20;
  b.settings.start_view = { theta: -0.6, phi: 0.85, radius: 20, target: { x: 4, y: 1, z: 3 } };
  b.settings.vacuum_maps = [{ id: "vm", camera: "camera.sample_vacuum_map", floor_id: "g", points: [{ v: [1200, -300], p: [2.5, 1.5] }] }];
  b.settings.pets = { on: true, list: [{ id: "pet", kind: "cat", name: "Sample", fur: "orange", floor_id: "g", static: true, x: 6, z: 4, rotation: 90, spots: [{ id: "s1", floor_id: "g", x: 5, z: 3, rotation: 90 }], triggers: [{ id: "t1", floor_id: "g", x: 2, z: 1, rotation: 180 }] }] };
  b.settings.roof = {
    type: "custom",
    pitch: 35,
    overhang: 0.4,
    sections: [
      // over the upper floor, ridge along x, with a hip at its u0 end
      section("main", -0.24, -0.24, 8.24, 6.24, { base: 5.2, eave_a: 5.2, eave_b: 5.6, pitch_b: 30, end_u0: "hip" }),
      // the garage: a pent roof, ridge along z, rising from side a
      section("garage", 8, -0.24, 11.24, 4.24, { shape: "pent", axis: "z", pitch_a: 15, end_u1: "halfhip" }),
      // the porch: flat, longer than deep
      section("porch", -4.24, -0.24, 0, 2.24, { shape: "flat", eave_a: 2.8, eave_b: 2.8 }),
      // a garden shed: flat, deeper than wide (its face runs along z)
      section("shed", 12, -4, 14, 1, { shape: "flat", eave_a: 2.4, eave_b: 2.4, base: 2.4 }),
      // a wing at an angle in the garden (turned about its own pivot)
      section("wing", 14, 2, 18, 5, { axis: "z", rotation: 30, pivot: [15, 3], flip: true }),
    ],
    cables: [{ id: "grid", floor_id: "g", points: [[0.5, 0.5], [0.5, 5]], height: 0.2 }],
    hologram: { place: "free", field: null, x: 9, z: 9, height: 2, size: 1, right: 0, up: 0 },
  };
  b.energy.meter = { floor_id: "g", x: 0.3, z: 0.3 };
  // solar: one field on each kind of face, and a roof window
  const faces = roofFaces(b);
  const face = (key: string) => faces.find((f) => f.key === key)!;
  const onMain = { ...proposeField(face("main:b"), "fb"), rows: 2 };
  const onGarage = proposeField(face("garage:a"), "fg");
  // the porch: a flat face whose rows differ and whose modules lean: mirrored when the face runs the other way
  const porch = face("porch:top");
  const onPorch: SolarField = { ...proposeField(porch, "fp"), u: 0.2, v: 0.3, rows: 2, cols: 3, layout: [3, 2], align: "left", skip: ["0:0"], portrait: false, tilt: 10, flip: false };
  const onShed: SolarField = { ...proposeField(face("shed:top"), "fs"), u: 0.3, v: 0.2, rows: 2, cols: 2, layout: [1, 2], align: "right", skip: ["1:0"], portrait: false, tilt: 0 };
  const onWall = proposeWallField(b, "fw", "g")!;
  const garden: SolarField = { ...proposeGroundField(b, "fgnd"), rotation: 20 };
  b.settings.roof.solar = [onMain, onGarage, onPorch, onWall, garden, onShed];
  b.settings.roof.windows = [{ id: "rw", face: "main:a", u: 3, v: 1, w: null, h: null, cover: null, contact: null, tilt: null }];
  return b;
}

type V3 = [number, number, number];
const T3 = (t: PlanTransform, p: V3): V3 => {
  const [x, z] = t.point([p[0], p[2]]);
  return [x, p[1], z];
};
const close = (a: number, b: number, tol = 2e-3) => Math.abs(a - b) <= tol;
const sameV3 = (a: V3, b: V3, tol = 2e-3) => close(a[0], b[0], tol) && close(a[1], b[1], tol) && close(a[2], b[2], tol);
const pt = (t: PlanTransform, p: Vec2 | { x: number; z: number }): Vec2 => t.point(Array.isArray(p) ? p : [p.x, p.z]);
const xz = (p: { x?: number | null; z?: number | null }): Vec2 => [p.x!, p.z!];
const rot = (t: PlanTransform, a: number) => (a + 90 * t.quarter) % 360;

/** The corners of a field's modules (any order: a mirrored field lists them the other way). */
function moduleMiddles(face: RoofFace, f: SolarField): V3[] {
  return fieldModules(face, f).flatMap((m) => m.corners);
}

/** The field's modules after the move stand where its modules before the move went. */
function modulesFollow(t: PlanTransform, before: Building, after: Building, id: string): void {
  const f0 = before.settings.roof.solar!.find((f) => f.id === id)!;
  const f1 = after.settings.roof.solar!.find((f) => f.id === id)!;
  const face0 = fieldFace(before, f0)!;
  const face1 = fieldFace(after, f1);
  assert.ok(face1, `field ${id} still has a face (${f1.face})`);
  const want = moduleMiddles(face0, f0).map((p) => T3(t, p));
  const got = moduleMiddles(face1, f1);
  assert.ok(want.length > 0, `field ${id} has modules`);
  assert.equal(got.length, want.length, `field ${id}: as many modules`);
  for (const p of want) assert.ok(got.some((q) => sameV3(p, q)), `field ${id}: a module at ${p.map((v) => v.toFixed(3))} (got ${JSON.stringify(got)})`);
}

/** One check per PLAN_FIELDS entry: the field after the move is the field before, moved by t. */
const CHECKS: Record<keyof typeof PLAN_FIELDS, (t: PlanTransform, a: Building, b: Building) => void> = {
  "Room.points": (t, a, b) => assert.deepEqual(b.floors[0].rooms[0].points, a.floors[0].rooms[0].points.map(t.point)),
  "Room.start_view": (t, a, b) => assert.deepEqual(pt(t, a.floors[0].rooms[0].start_view!.target!), xz(b.floors[0].rooms[0].start_view!.target!)),
  "Furniture.x": (t, a, b) => assert.deepEqual(xz(b.floors[0].furniture[0]), pt(t, a.floors[0].furniture[0])),
  "Furniture.z": (t, a, b) => assert.deepEqual(xz(b.floors[1].furniture[0]), pt(t, a.floors[1].furniture[0])),
  "Furniture.rotation": (t, a, b) => assert.equal(b.floors[0].furniture[0].rotation, rot(t, a.floors[0].furniture[0].rotation)),
  "Furniture.bin_kerb": (t, a, b) => assert.deepEqual(xz(b.floors[0].furniture[0].bin_kerb!), pt(t, a.floors[0].furniture[0].bin_kerb!)),
  "Placement.x": (t, a, b) => assert.deepEqual(xz(b.floors[0].placements[0]), pt(t, a.floors[0].placements[0])),
  "Placement.z": (t, a, b) => assert.deepEqual(xz(b.floors[0].placements[0]), pt(t, a.floors[0].placements[0])),
  "Placement.rotation": (t, a, b) => assert.equal(b.floors[0].placements[0].rotation, rot(t, a.floors[0].placements[0].rotation!)),
  "Background.x": (t, a, b) => assert.deepEqual(xz(b.floors[0].background!), pt(t, a.floors[0].background!)),
  "Background.z": (t, a, b) => assert.deepEqual(xz(b.floors[0].background!), pt(t, a.floors[0].background!)),
  "Background.rotation": (t, a, b) => assert.equal(b.floors[0].background!.rotation, rot(t, a.floors[0].background!.rotation!)),
  "Floor.start_view": (t, a, b) => assert.deepEqual(xz(b.floors[0].start_view!.target!), pt(t, a.floors[0].start_view!.target!)),
  "FreeWall.a": (t, a, b) => assert.deepEqual(b.floors[0].walls![0].a, t.point(a.floors[0].walls![0].a)),
  "FreeWall.b": (t, a, b) => assert.deepEqual(b.floors[0].walls![0].b, t.point(a.floors[0].walls![0].b)),
  // sections: every face of the roof, moved, is a face of the moved roof (the ridge turned with it)
  "RoofSection.x0": (t, a, b) => facesFollow(t, a, b),
  "RoofSection.z0": (t, a, b) => facesFollow(t, a, b),
  "RoofSection.x1": (t, a, b) => facesFollow(t, a, b),
  "RoofSection.z1": (t, a, b) => facesFollow(t, a, b),
  "RoofSection.axis": (t, a, b) => facesFollow(t, a, b),
  "RoofSection.points": (t, a, b) => {
    const pa = structuredClone(a);
    pa.settings.roof.sections![2].points = rect(-4.24, -0.24, 0, 2.24);
    const pb = structuredClone(pa);
    transformPlan(pb, null, t);
    assert.deepEqual(pb.settings.roof.sections![2].points, pa.settings.roof.sections![2].points!.map(t.point));
    void b;
  },
  "RoofSection.rotation": (_t, a, b) => assert.equal(b.settings.roof.sections![4].rotation, a.settings.roof.sections![4].rotation),
  "RoofSection.pivot": (t, a, b) => assert.deepEqual(b.settings.roof.sections![4].pivot, t.point(a.settings.roof.sections![4].pivot!)),
  "SolarField.u": (t, a, b) => ["fb", "fg", "fp", "fs", "fw", "fgnd"].forEach((id) => modulesFollow(t, a, b, id)),
  "SolarField.v": (t, a, b) => ["fb", "fg", "fp", "fs", "fw", "fgnd"].forEach((id) => modulesFollow(t, a, b, id)),
  "SolarField.face": (t, a, b) => {
    const wall = b.settings.roof.solar!.find((f) => f.id === "fw")!;
    assert.ok(wallFaces(b, "g").some((f) => f.key === wall.face), "the wall field's key names a wall of the moved floor");
    modulesFollow(t, a, b, "fw");
  },
  "SolarField.rotation": (t, a, b) => assert.equal(b.settings.roof.solar!.find((f) => f.id === "fgnd")!.rotation, rot(t, a.settings.roof.solar!.find((f) => f.id === "fgnd")!.rotation!)),
  "HologramSettings.x": (t, a, b) => assert.deepEqual(xz(b.settings.roof.hologram!), pt(t, xz(a.settings.roof.hologram!))),
  "HologramSettings.z": (t, a, b) => assert.deepEqual(xz(b.settings.roof.hologram!), pt(t, xz(a.settings.roof.hologram!))),
  "CableRoute.points": (t, a, b) => assert.deepEqual(b.settings.roof.cables![0].points, a.settings.roof.cables![0].points.map(t.point)),
  "RoofWindow.u": (t, a, b) => windowFollows(t, a, b),
  "RoofWindow.v": (t, a, b) => windowFollows(t, a, b),
  "RoofWindow.face": (t, a, b) => windowFollows(t, a, b),
  "Pet.x": (t, a, b) => assert.deepEqual(xz(b.settings.pets!.list[0]), pt(t, xz(a.settings.pets!.list[0]))),
  "Pet.z": (t, a, b) => assert.deepEqual(xz(b.settings.pets!.list[0]), pt(t, xz(a.settings.pets!.list[0]))),
  "Pet.rotation": (t, a, b) => assert.equal(b.settings.pets!.list[0].rotation, rot(t, a.settings.pets!.list[0].rotation!)),
  "PetPlace.x": (t, a, b) => {
    for (const k of ["spots", "triggers"] as const) assert.deepEqual(xz(b.settings.pets!.list[0][k]![0]), pt(t, xz(a.settings.pets!.list[0][k]![0])));
  },
  "PetPlace.z": (t, a, b) => assert.deepEqual(xz(b.settings.pets!.list[0].spots![0]), pt(t, xz(a.settings.pets!.list[0].spots![0]))),
  "PetPlace.rotation": (t, a, b) => assert.equal(b.settings.pets!.list[0].triggers![0].rotation, rot(t, a.settings.pets!.list[0].triggers![0].rotation!)),
  "VacuumMap.points": (t, a, b) => {
    const [p0, p1] = [a.settings.vacuum_maps![0].points![0], b.settings.vacuum_maps![0].points![0]];
    assert.deepEqual(p1.p, t.point(p0.p));
    assert.deepEqual(p1.v, p0.v);
  },
  "BuildingSettings.north": (t, a, b) => assert.equal(b.settings.north, rot(t, a.settings.north)),
  "BuildingSettings.start_view": (t, a, b) => assert.deepEqual(xz(b.settings.start_view!.target!), pt(t, a.settings.start_view!.target!)),
  "StartView.target": (t, a, b) => assert.deepEqual(xz(b.settings.start_view!.target!), pt(t, a.settings.start_view!.target!)),
  "StartView.theta": (t, a, b) => {
    // the camera stands on the same side of what it shows: its offset (sin θ, cos θ) turned with the plan
    const off = (th: number): Vec2 => [Math.sin(th), Math.cos(th)];
    const o0 = off(a.floors[0].rooms[0].start_view!.theta);
    const want = t.quarter ? [-o0[1], o0[0]] : o0;
    const o1 = off(b.floors[0].rooms[0].start_view!.theta);
    assert.ok(close(o1[0], want[0], 1e-9) && close(o1[1], want[1], 1e-9));
  },
  "OutdoorArea.points": (t, a, b) => assert.deepEqual(b.floors[0].outdoor[0].points, a.floors[0].outdoor[0].points.map(t.point)),
  "OutdoorArea.slope_dir": (t, _a, b) => assert.equal(b.floors[0].outdoor[0].slope_dir, t.quarter ? "x" : "-z"),
  "PoolPort.x": (t, a, b) => assert.deepEqual(xz(b.floors[0].outdoor[1].pool!.ports![0]), pt(t, a.floors[0].outdoor[1].pool!.ports![0])),
  "PoolPort.z": (t, a, b) => assert.deepEqual(xz(b.floors[0].outdoor[1].pool!.ports![0]), pt(t, a.floors[0].outdoor[1].pool!.ports![0])),
  "PoolPipe.points": (t, a, b) => assert.deepEqual(b.floors[0].outdoor[1].pool!.pipes![0].points, a.floors[0].outdoor[1].pool!.pipes![0].points.map(t.point)),
  "PoolJoint.x": (t, a, b) => assert.deepEqual(xz(b.floors[0].outdoor[1].pool!.joints![0]), pt(t, a.floors[0].outdoor[1].pool!.joints![0])),
  "PoolJoint.z": (t, a, b) => assert.deepEqual(xz(b.floors[0].outdoor[1].pool!.joints![0]), pt(t, a.floors[0].outdoor[1].pool!.joints![0])),
  "PoolJoint.nx": (t, _a, b) => assert.deepEqual([b.floors[0].outdoor[1].pool!.joints![0].nx, b.floors[0].outdoor[1].pool!.joints![0].nz], t.quarter ? [-0, 1] : [1, 0]),
  "PoolJoint.nz": (t, _a, b) => assert.deepEqual([b.floors[0].outdoor[1].pool!.joints![0].nx, b.floors[0].outdoor[1].pool!.joints![0].nz], t.quarter ? [-0, 1] : [1, 0]),
  "EnergySettings.meter": (t, a, b) => assert.deepEqual(xz(b.energy.meter!), pt(t, a.energy.meter!)),
};

/** Every roof face before the move, moved, lies on a face of the moved roof with the same size and slope. */
function facesFollow(t: PlanTransform, a: Building, b: Building): void {
  const after = roofFaces(b);
  for (const f of roofFaces(a)) {
    const o = T3(t, f.o);
    const end = T3(t, [f.o[0] + f.eu[0] * f.lu, f.o[1] + f.eu[1] * f.lu, f.o[2] + f.eu[2] * f.lu]);
    const top = T3(t, [f.o[0] + f.es[0] * f.ls, f.o[1] + f.es[1] * f.ls, f.o[2] + f.es[2] * f.ls]);
    // the same face: its eave line and its far edge land on the new face's (either way round, a flat face may swap)
    const hit = after.find((g) => {
      const gEnd: V3 = [g.o[0] + g.eu[0] * g.lu, g.o[1] + g.eu[1] * g.lu, g.o[2] + g.eu[2] * g.lu];
      const gTop: V3 = [g.o[0] + g.es[0] * g.ls, g.o[1] + g.es[1] * g.ls, g.o[2] + g.es[2] * g.ls];
      if (g.flat !== f.flat || !close(g.pitch, f.pitch, 1e-6)) return false;
      if (!f.flat) return close(g.lu, f.lu) && close(g.ls, f.ls) && ((sameV3(g.o, o) && sameV3(gEnd, end)) || (sameV3(g.o, end) && sameV3(gEnd, o))) && (sameV3(gTop, top) || sameV3(gTop, [top[0] + end[0] - o[0], top[1], top[2] + end[2] - o[2]]));
      // a flat face: the same rectangle
      const box = (p: V3[]) => [Math.min(...p.map((q) => q[0])), Math.max(...p.map((q) => q[0])), Math.min(...p.map((q) => q[2])), Math.max(...p.map((q) => q[2]))];
      const far: V3 = [end[0] + top[0] - o[0], o[1], end[2] + top[2] - o[2]];
      const gFar: V3 = [gEnd[0] + gTop[0] - g.o[0], g.o[1], gEnd[2] + gTop[2] - g.o[2]];
      return box([o, end, top, far]).every((v, i) => close(v, box([g.o, gEnd, gTop, gFar])[i])) && close(g.o[1], o[1]);
    });
    assert.ok(hit, `roof face ${f.key} has a moved twin`);
  }
}

function windowFollows(t: PlanTransform, a: Building, b: Building): void {
  const w0 = a.settings.roof.windows![0];
  const w1 = b.settings.roof.windows![0];
  const c0 = windowCorners(roofFaces(a).find((f) => f.key === w0.face)!, w0)!.map((p) => T3(t, p));
  const c1 = windowCorners(roofFaces(b).find((f) => f.key === w1.face)!, w1)!;
  for (const p of c0) assert.ok(c1.some((q) => sameV3(p, q)), `roof window corner ${p} moved (got ${JSON.stringify(c1)})`);
}

test("every listed field has a check, and the check is run on the shift and the turn (#156)", () => {
  assert.deepEqual(Object.keys(CHECKS).sort(), Object.keys(PLAN_FIELDS).sort());
});

for (const [name, t] of [
  ["shift", shiftBy(1.5, -0.75)],
  ["turn", turnAbout(4, 3)],
] as const) {
  test(`${name} of the whole house moves every plan-coordinate field by the same transform (#156)`, () => {
    const before = plan();
    // the fixture really sets every field (a check on an unset field proves nothing)
    for (const id of ["fb", "fg", "fp", "fs", "fw", "fgnd"]) assert.ok(fieldFace(before, before.settings.roof.solar!.find((f) => f.id === id)!), `fixture field ${id} lies on a face`);
    const after = structuredClone(before);
    transformPlan(after, null, t);
    for (const [key, check] of Object.entries(CHECKS)) {
      try {
        check(t, before, after);
      } catch (e) {
        throw new Error(`${key}: ${(e as Error).message}`);
      }
    }
  });
}

test("turning four times brings every field back (#156)", () => {
  const before = plan();
  const after = structuredClone(before);
  for (let i = 0; i < 4; i++) transformPlan(after, null, turnAbout(4, 3));
  // keys, frames and flags of the roof may be written differently; where the modules stand is not
  for (const id of ["fb", "fg", "fp", "fs", "fw", "fgnd"]) modulesFollow(shiftBy(0, 0), before, after, id);
  facesFollow(shiftBy(0, 0), before, after);
  // the camera came round once (to rounding)
  const views = (b: Building) => [b.settings.start_view, ...b.floors.flatMap((f) => [f.start_view, ...f.rooms.map((r) => r.start_view)])];
  for (const v of views(after)) if (v) v.theta = Math.round(v.theta * 1e9) / 1e9;
  assert.deepEqual(after.floors, before.floors);
  assert.deepEqual(after.settings.pets, before.settings.pets);
  assert.deepEqual(after.settings.start_view, before.settings.start_view);
  assert.equal(after.settings.north, before.settings.north);
  assert.deepEqual(after.energy, before.energy);
});

test("shifting one floor moves what is on that floor (and the garden fields with the ground floor), nothing else (#156)", () => {
  const before = plan();
  const after = structuredClone(before);
  const t = shiftBy(2, 1);
  transformPlan(after, ["g"], t);
  // the ground floor and what belongs to it
  assert.deepEqual(xz(after.floors[0].furniture[0].bin_kerb!), pt(t, before.floors[0].furniture[0].bin_kerb!));
  assert.deepEqual(xz(after.floors[0].outdoor[1].pool!.ports![0]), pt(t, before.floors[0].outdoor[1].pool!.ports![0]));
  assert.deepEqual(after.floors[0].outdoor[1].pool!.pipes![0].points, before.floors[0].outdoor[1].pool!.pipes![0].points.map(t.point));
  assert.deepEqual(xz(after.settings.pets!.list[0]), pt(t, xz(before.settings.pets!.list[0])));
  assert.deepEqual(xz(after.energy.meter!), pt(t, before.energy.meter!));
  assert.deepEqual(after.settings.roof.cables![0].points, before.settings.roof.cables![0].points.map(t.point));
  modulesFollow(t, before, after, "fw");
  modulesFollow(t, before, after, "fgnd");
  // the upper floor, the roof and the house's own camera stay
  assert.deepEqual(after.floors[1], before.floors[1]);
  assert.deepEqual(after.settings.roof.sections, before.settings.roof.sections);
  assert.deepEqual(after.settings.start_view, before.settings.start_view);
  assert.deepEqual(after.settings.roof.hologram, before.settings.roof.hologram);
  for (const id of ["fb", "fg", "fp", "fs"]) assert.deepEqual(after.settings.roof.solar!.find((f) => f.id === id), before.settings.roof.solar!.find((f) => f.id === id));
  assert.deepEqual(after.settings.roof.windows, before.settings.roof.windows);
});

test("a wall field keeps its wall when the floor moves half a centimetre and the wall's id changes (#156)", () => {
  const before = plan();
  const after = structuredClone(before);
  transformPlan(after, ["g"], shiftBy(0.005, 0));
  const f0 = before.settings.roof.solar!.find((f) => f.id === "fw")!;
  const f1 = after.settings.roof.solar!.find((f) => f.id === "fw")!;
  assert.notEqual(f1.face, f0.face, "the wall's key holds its coordinates");
  assert.ok(fieldFace(after, f1), "the field is not 'face gone'");
  assert.equal(after.settings.roof.solar!.find((f) => f.id === "fgnd")!.face, GROUND);
});
