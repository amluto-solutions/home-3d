// Relight only what changed (#389): a lamp switched in one room recolours that room and the rooms its open doors light,
// and the result is the very same as a full relight.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Floor, Opening, Room } from "../model.ts";
import { newFloor } from "../model.ts";
import { buildFloorGeometry } from "./build.ts";
import { buildLightSurface, lightColors, relight, type LightSource } from "./lighting.ts";

function rect(id: string, x0: number, z0: number, x1: number, z1: number): Room {
  return { id, name: id, area_id: null, points: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], floor_material: "wood" };
}

function surfaceOf(floor: Floor) {
  const geo = buildFloorGeometry(floor, 0.24, 0.12);
  return buildLightSurface(floor, geo.walls2d, geo.wallBuckets, geo.openings, 0.25);
}

const lamp = (x: number, z: number, color: [number, number, number], room: number, level = 1): LightSource => ({ x, y: 2.4, z, color, level, kind: "ceiling", room });

const door: Opening = { id: "d", room_id: "a", edge: 1, offset: 1.5, width: 0.9, type: "door", sill: 0, height: 2.05, hinge: "left", leaves: 1, swing: "in", cover: null, contact: null, contact2: null, tilt: null };

/** Three rooms in a row: a and b share a door, c is closed off. */
const floor: Floor = { ...newFloor("f", "F", 0), rooms: [rect("a", 0, 0, 4, 3), rect("b", 4, 0, 8, 3), rect("c", 8, 0, 12, 3)], openings: [door] };

test("the first relight colours every vertex like lightColors", () => {
  const s = surfaceOf(floor);
  const sources = [lamp(2, 1.5, [1, 0.8, 0.5], 0), lamp(10, 1.5, [0, 0, 1], 2)];
  const { cache, zones } = relight(s, sources, 0.42, [1], null);
  assert.equal(zones, null);
  assert.deepEqual([...cache.colors], [...lightColors(s, sources, 0.42, [1])]);
});

test("a lamp switched in a closed room recolours only that room", () => {
  const s = surfaceOf(floor);
  const before = [lamp(2, 1.5, [1, 1, 1], 0), lamp(10, 1.5, [1, 1, 1], 2)];
  const first = relight(s, before, 0.42, [1], null).cache;
  const after = [lamp(2, 1.5, [1, 1, 1], 0), lamp(10, 1.5, [1, 0, 0], 2, 0.5)];
  const { cache, zones } = relight(s, after, 0.42, [1], first);
  assert.deepEqual(zones, [2]);
  assert.deepEqual([...cache.colors], [...lightColors(s, after, 0.42, [1])]);
});

test("a lamp switched next to an open door also recolours the room behind the door", () => {
  const s = surfaceOf(floor);
  const first = relight(s, [lamp(3.5, 1.5, [1, 1, 1], 0)], 0.42, [1], null).cache;
  const after = [lamp(3.5, 1.5, [0, 1, 0], 0)];
  const { cache, zones } = relight(s, after, 0.42, [1], first);
  assert.deepEqual([...(zones ?? [])].sort(), [0, 1]);
  assert.deepEqual([...cache.colors], [...lightColors(s, after, 0.42, [1])]);
});

test("a lamp switched off darkens its room; a door closed takes the light out of the next room", () => {
  const s = surfaceOf(floor);
  const on = [lamp(3.5, 1.5, [1, 1, 1], 0)];
  const first = relight(s, on, 0.42, [1], null).cache;
  const shut = relight(s, on, 0.42, [0], first);
  assert.deepEqual(shut.zones, [1]);
  assert.deepEqual([...shut.cache.colors], [...lightColors(s, on, 0.42, [0])]);
  const off = relight(s, [], 0.42, [0], shut.cache);
  assert.deepEqual(off.zones, [0]);
  assert.ok(off.cache.colors.every((c) => c === 0));
});

test("nothing changed: nothing is recoloured; a new strength or key relights all", () => {
  const s = surfaceOf(floor);
  const sources = [lamp(2, 1.5, [1, 1, 1], 0)];
  const first = relight(s, sources, 0.42, [1], null).cache;
  assert.deepEqual(relight(s, sources, 0.42, [1], first).zones, []);
  assert.equal(relight(s, sources, 0.42, [1], first, "tint", (z) => (z === 3 ? 1 : 0.12)).zones, null);
  // a new surface (the plan was rebuilt) starts again
  assert.equal(relight(surfaceOf(floor), sources, 0.42, [1], first).zones, null);
});

test("the heatmap's dimming applies to recoloured rooms too", () => {
  const s = surfaceOf(floor);
  const dim = (z: number) => (z === floor.rooms.length ? 1 : 0.12);
  const first = relight(s, [lamp(10, 1.5, [1, 1, 1], 2)], 0.42, [1], null, "tint", dim).cache;
  const after = [lamp(10, 1.5, [1, 1, 0], 2)];
  const { cache } = relight(s, after, 0.42, [1], first, "tint", dim);
  const plain = lightColors(s, after, 0.42, [1]);
  for (let v = 0; v < s.room.length; v++) for (let c = 0; c < 3; c++) assert.ok(Math.abs(cache.colors[v * 3 + c] - plain[v * 3 + c] * dim(s.room[v])) < 1e-6);
});

test("a lamp moved, dimmed and moved back keeps its shadows right (shadow masks per lamp position)", () => {
  // an L of walls: room a gets a free-standing wall that shadows part of it
  const walled: Floor = { ...floor, walls: [{ id: "w", a: [2, 0.5], b: [2, 2.5], height: 2.5, thickness: 0.1 }] as Floor["walls"] };
  const s = surfaceOf(walled);
  let cache = relight(s, [lamp(1, 1.5, [1, 1, 1], 0)], 0.42, [1], null).cache;
  for (const sources of [[lamp(3, 1.5, [1, 1, 1], 0)], [lamp(3, 1.5, [1, 0, 0], 0, 0.4)], [lamp(1, 1.5, [1, 1, 1], 0)]]) {
    cache = relight(s, sources, 0.42, [1], cache).cache;
    assert.deepEqual([...cache.colors], [...lightColors(s, sources, 0.42, [1])]);
  }
});
