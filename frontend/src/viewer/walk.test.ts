import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Room, type Vec2 } from "../model.ts";
import { flightA, flightB, twoFloors } from "../geometry/stair-fixture.ts";
import { petMap } from "../fun/pets.ts";
import { FloorMap, stairSpot, WalkCamera, type Obstacle } from "./walk.ts";

function rect(id: string, x0: number, z0: number, x1: number, z1: number): Room {
  return { id, name: id, area_id: null, points: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], floor_material: "wood" };
}

const floor = { ...newFloor("f", "Ground", 0), rooms: [rect("r", 0, 0, 8, 5)] };
const building = { ...emptyBuilding(), floors: [floor] };
// a sofa across the middle of the room
const sofa: Obstacle = { c: [4, 2.5], u: [0, 1], hw: 1.2, hd: 0.45 };

/** Points along the way, every 5 cm. */
function along(start: Vec2, way: Vec2[]): Vec2[] {
  const out: Vec2[] = [];
  let p = start;
  for (const q of way) {
    const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) / 0.05));
    for (let i = 1; i <= n; i++) out.push([p[0] + ((q[0] - p[0]) * i) / n, p[1] + ((q[1] - p[1]) * i) / n]);
    p = q;
  }
  return out;
}

test("pets walk around furniture; a walk through the house (no obstacles) goes straight", () => {
  const start: Vec2 = [1, 2.5];
  const goal: Vec2 = [7, 2.5];
  const person = new FloorMap(building, floor);
  assert.deepEqual(person.path(start, goal), [goal]);
  const pet = new FloorMap(building, floor, [sofa]);
  const way = pet.path(start, goal);
  assert.ok(way && way.length > 1, "a detour");
  for (const p of along(start, way!)) assert.equal(pet.obstacleAt(p, 0), null, `${p} lies in the sofa`);
});

test("a place on the furniture is reached with a last hop, and left with a first one", () => {
  const pet = new FloorMap(building, floor, [sofa]);
  const onSofa: Vec2 = [4, 2.5];
  const there = pet.path([1, 1], onSofa);
  assert.ok(there && there.at(-1)![0] === 4 && there.at(-1)![1] === 2.5);
  const back = pet.path(onSofa, [7, 4]);
  assert.ok(back && back.length >= 2);
  assert.equal(pet.obstacleAt(back[0], 0), null, "first hop down to the floor");
});

test("an outer door upstairs leads nowhere unless a balcony is drawn behind it; downstairs it leads into the garden (#766)", () => {
  const french = { id: "fd", room_id: "r", edge: 0, offset: 4, width: 1.2, type: "window" as const, sill: 0, height: 2.2, hinge: "left" as const, leaves: 2 as const, swing: "in" as const, cover: null, contact: null, contact2: null, tilt: null };
  const up = { ...newFloor("upper", "Upper", 2.8), rooms: [rect("r", 0, 0, 8, 5)], openings: [french] };
  assert.equal(new FloorMap({ ...emptyBuilding(), floors: [up] }, up).doors.length, 0);
  // the room's edge 0 runs along z = 0: a balcony in front of it (z < 0)
  const withBalcony = { ...up, outdoor: [{ id: "b", type: "terrace", points: [[2, -2], [6, -2], [6, 0], [2, 0]] }] } as typeof up;
  assert.equal(new FloorMap({ ...emptyBuilding(), floors: [withBalcony] }, withBalcony).doors.length, 1);
  const down = { ...up, elevation: 0 };
  assert.equal(new FloorMap({ ...emptyBuilding(), floors: [down] }, down).doors.length, 1);
});

test("the walk takes the camera again when the viewer swaps its controls, and gives it back on dispose (#200)", () => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.requestAnimationFrame ??= () => 1;
  g.cancelAnimationFrame ??= () => undefined;
  g.window ??= new EventTarget();
  g.document ??= new EventTarget();
  const protoUpdate = () => false;
  const makeControls = () => ({ update: protoUpdate, view: { target: { x: 0, y: 0, z: 0, set() {} }, radius: 1, theta: 0, phi: 0 } });
  const v = {
    camera: { position: { set() {}, x: 0, y: 0, z: 0 }, lookAt() {}, fov: 50, near: 0.1, updateProjectionMatrix() {}, aspect: 1 },
    controls: makeControls(),
    floorMap: new Map(),
    floors: [],
    labels: { style: { visibility: "" } },
    renderer: { domElement: {} },
    invalidate() {},
    updateWalls() {},
    onControls: null as (() => void) | null,
  };
  const surface = new EventTarget() as unknown as HTMLElement;
  const walk = new WalkCamera(v as never, new FloorMap(building, floor), surface, { onRoom() {} });
  assert.notEqual(v.controls.update, protoUpdate, "the walk drives the camera");
  // a quality change: new controls, the walk's hook runs
  v.controls = makeControls();
  assert.equal(v.controls.update, protoUpdate);
  v.onControls?.();
  assert.notEqual(v.controls.update, protoUpdate, "the walk took the camera again");
  walk.dispose();
  assert.equal(v.controls.update, protoUpdate, "the orbit camera is back");
  assert.equal(v.onControls, null);
});

/** A walk on a lower floor with the given rooms and a straight stair (foot at z 4, top at z 1) up to a first floor. */
function stairWalk(lowerRooms: Room[]) {
  const g = globalThis as unknown as Record<string, unknown>;
  g.requestAnimationFrame ??= () => 1;
  g.cancelAnimationFrame ??= () => undefined;
  g.window ??= new EventTarget();
  g.document ??= new EventTarget();
  const lower = { ...newFloor("ground", "Ground", 0), rooms: lowerRooms };
  const upper = { ...newFloor("upper", "Upper", 2.7), rooms: [rect("b", 0, -4, 8, 6)] };
  // a straight stair, its foot at the front (+z), its top at the back
  lower.furniture.push({ id: "s", type: "stairs", x: 4, z: 2.5, rotation: 0, w: 1, d: 3, h: 2.7, variant: null, entity: null, power: null });
  const b = { ...emptyBuilding(), floors: [lower, upper] };
  const shown: string[] = [];
  const stairs: boolean[] = [];
  const v = {
    camera: { position: { set() {}, x: 0, y: 0, z: 0 }, lookAt() {}, fov: 50, near: 0.1, updateProjectionMatrix() {}, aspect: 1 },
    controls: { update: () => false, view: { target: { x: 0, y: 0, z: 0, set() {} }, radius: 1, theta: 0, phi: 0 } },
    floorMap: new Map(),
    floors: [],
    labels: { style: { visibility: "" } },
    renderer: { domElement: {} },
    invalidate() {},
    updateWalls() {},
    onControls: null as (() => void) | null,
  };
  const walk = new WalkCamera(v as never, new FloorMap(b, lower), new EventTarget() as unknown as HTMLElement, { onRoom() {}, start: { x: 4, z: 5.2, yaw: -Math.PI / 2, pitch: 0 }, onFloor: (f, st) => (shown.push(f.id), stairs.push(st)) });
  const w = walk as unknown as { move(dx: number, dz: number): void; stairs(): void; lift: number; map: FloorMap };
  const step = (dz: number, n: number) => {
    for (let i = 0; i < n; i++) {
      w.move(0, dz);
      w.stairs();
    }
  };
  return { walk, w, shown, stairs, step };
}

test("walking onto a stair climbs it and switches to the upper floor at the top, and back down (#270)", () => {
  const { walk, w, shown, step } = stairWalk([rect("a", 0, -4, 8, 6)]);
  step(-0.05, 30);
  assert.equal(w.map.floor.id, "ground", "still on the steps of the lower floor");
  assert.ok(w.lift > 0.1 && w.lift < 2.7, `lifted part of the way (${w.lift})`);
  assert.deepEqual(shown, ["upper"], "the stairs show while on them");
  step(-0.05, 60);
  assert.equal(w.map.floor.id, "upper", "up on the first floor");
  assert.equal(w.lift, 0);
  assert.equal(shown.at(-1), "upper");
  // away from the top and back onto it: down the stair
  step(-0.05, 30);
  assert.equal(w.map.floor.id, "upper", "no stair taken on the way away");
  step(0.05, 50);
  assert.equal(w.map.floor.id, "ground", "on the steps down (lower floor)");
  assert.ok(w.lift > 0 && w.lift < 2.7, `part of the way down (${w.lift})`);
  step(0.05, 80);
  assert.equal(w.lift, 0);
  assert.equal(shown.at(-1), "ground");
  walk.dispose();
});

test("on the steps both floors show; stepping off at the top ends that (#312)", () => {
  const { walk, w, stairs, step } = stairWalk([rect("a", 0, -4, 8, 6)]);
  step(-0.05, 30);
  assert.deepEqual(stairs, [true], "on the steps");
  step(-0.05, 60);
  assert.equal(w.map.floor.id, "upper");
  assert.deepEqual(stairs, [true, false], "off the top");
  walk.dispose();
});

test("a wall of the lower floor under the top step does not stop the climb", () => {
  // the hall ends where the stair arrives upstairs; behind that wall, a cupboard under the landing
  const { walk, w, step } = stairWalk([rect("hall", 0, 1, 8, 6), rect("cupboard", 0, -4, 8, 1)]);
  step(-0.05, 90);
  assert.equal(w.map.floor.id, "upper", `up on the first floor (stopped at lift ${w.lift})`);
  walk.dispose();
});

test("stairSpot finds the nearest point on the way and its height", () => {
  const way: [number, number, number][] = [[0, 0, 4], [0, 2.7, 1]];
  const mid = stairSpot(way, [0.2, 2.5]);
  assert.ok(Math.abs(mid.s - 1.5) < 1e-9 && Math.abs(mid.dist - 0.2) < 1e-9 && Math.abs(mid.h - 1.35) < 1e-9);
});

test("a stair drawn as two flights is climbed round the corner and switches floors only at the top (#304)", () => {
  const g = globalThis as unknown as Record<string, unknown>;
  g.requestAnimationFrame ??= () => 1;
  g.cancelAnimationFrame ??= () => undefined;
  g.window ??= new EventTarget();
  g.document ??= new EventTarget();
  const run = (flights: ReturnType<typeof flightA>[]) => {
    const b = twoFloors(...flights);
    const v = {
      camera: { position: { set() {}, x: 0, y: 0, z: 0 }, lookAt() {}, fov: 50, near: 0.1, updateProjectionMatrix() {}, aspect: 1 },
      controls: { update: () => false, view: { target: { x: 0, y: 0, z: 0, set() {} }, radius: 1, theta: 0, phi: 0 } },
      floorMap: new Map(), floors: [], labels: { style: { visibility: "" } }, renderer: { domElement: {} }, invalidate() {}, updateWalls() {}, onControls: null as (() => void) | null,
    };
    const walk = new WalkCamera(v as never, new FloorMap(b, b.floors[0]), new EventTarget() as unknown as HTMLElement, { onRoom() {}, start: { x: 6.4, z: 11.688, yaw: 0, pitch: 0 }, onFloor() {} });
    const w = walk as unknown as { move(dx: number, dz: number): void; stairs(): void; lift: number; map: FloorMap; state: { x: number; z: number } };
    const to = (x: number, z: number) => {
      for (let i = 0; i < 400; i++) {
        const dx = x - w.state.x;
        const dz = z - w.state.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.03) return;
        w.move((dx / d) * Math.min(0.05, d), (dz / d) * Math.min(0.05, d));
        w.stairs();
      }
    };
    return { walk, w, to };
  };
  // both flights: along the first, round the corner, up the second
  const full = run([flightA(), flightB()]);
  full.to(7.2, 11.688);
  assert.ok(full.w.lift > 0 && full.w.lift < 0.55, `on the first flight (${full.w.lift})`);
  full.to(8.2, 11.688);
  assert.ok(Math.abs(full.w.lift - 0.55) < 0.15, `at the turn (${full.w.lift})`);
  assert.equal(full.w.map.floor.id, "ground");
  full.to(7.7, 11.188);
  full.to(7.7, 10.3);
  assert.ok(full.w.lift > 1 && full.w.lift < 2.75, `well up the second flight (${full.w.lift})`);
  full.to(7.7, 8.5);
  assert.equal(full.w.map.floor.id, "upper", "up on the next floor");
  full.walk.dispose();
  // the short flight alone: no floor change, no lift
  const alone = run([flightA()]);
  alone.to(8.6, 11.688);
  assert.equal(alone.w.map.floor.id, "ground");
  assert.equal(alone.w.lift, 0);
  alone.walk.dispose();
});

test("pets stay indoors: only doors between two rooms are ways, never round the outside of the house (#444)", () => {
  const door = (id: string, room: string, edge: number, offset: number, type: "door" | "garage" | "window" = "door") => ({ id, room_id: room, edge, offset, width: 0.9, type, sill: 0, height: 2.1, hinge: "left" as const, leaves: 1 as const, swing: "in" as const, cover: null, contact: null, contact2: null, tilt: null });
  const rooms = [rect("a", 0, 0, 4, 5), rect("b", 4, 0, 8, 5)];
  const outside = [door("front", "a", 0, 2), door("gate", "b", 0, 2, "garage"), door("french", "b", 2, 2, "window")];
  const apart = { ...newFloor("f", "EG", 0), rooms, openings: outside };
  const plan = { ...emptyBuilding(), floors: [apart] };
  const from: Vec2 = [1, 3];
  const to: Vec2 = [7, 3];
  assert.ok(new FloorMap(plan, apart).path(from, to));
  assert.equal(petMap(FloorMap, plan, apart, new Set(), []).path(from, to), null);
  const joined = { ...apart, openings: [...outside, door("inner", "a", 1, 2.5)] };
  const way = petMap(FloorMap, { ...plan, floors: [joined] }, joined, new Set(), []).path(from, to);
  assert.ok(way && way.every((p) => p[1] > 0.3 && p[1] < 4.7), "through the house");
  assert.equal(petMap(FloorMap, { ...plan, floors: [joined] }, joined, new Set(["inner"]), []).path(from, to), null);
});

test("upstairs, a door between rooms drawn a wall's width apart is a way, not a door into the air (#444)", () => {
  const door = { id: "d", room_id: "a", edge: 1, offset: 2.5, width: 0.8, type: "door" as const, sill: 0, height: 2.1, hinge: "left" as const, leaves: 1 as const, swing: "in" as const, cover: null, contact: null, contact2: null, tilt: null };
  const up = { ...newFloor("og", "OG", 2.75), rooms: [rect("a", 0, 0, 4, 5), { ...rect("b", 4.12, 0, 8, 5), wall_heights: [null, null, null, 0] }], openings: [door] };
  const map = new FloorMap({ ...emptyBuilding(), floors: [up] }, up);
  assert.equal(map.doors.length, 1);
  assert.ok(map.path([1, 2.5], [7, 2.5]), "from room to room");
  const alone = { ...up, rooms: [rect("a", 0, 0, 4, 5)] };
  assert.equal(new FloorMap({ ...emptyBuilding(), floors: [alone] }, alone).doors.length, 0);
});
