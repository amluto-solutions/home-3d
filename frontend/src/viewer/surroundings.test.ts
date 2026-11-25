// The neighbourhood from the map in 3D and in the 2D plans (#463): drawn once with the ground floor (blocks at their
// height, flat layers below the ground and centimetres apart), the neighbours' shadows, the floor keys, the room card
// and the plans. Invented data only. Ported from NeonPlan 3D 3.3.0 - 3.4.1 (MIT, Mastershort), with our own tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { BufferGeometry } from "three";
import { nothing } from "lit";
import { DEFAULT_GROUND, emptyBuilding, newFloor, type Building, type Room, type Surroundings, type Vec2 } from "../model.ts";
import { placedSurroundings, type PlacedSurroundings } from "../surroundings.ts";
import { planMap, surroundPlanSvg } from "../surround-plan.ts";
import { buildFloorGeometry } from "./build.ts";
import { floorKeys } from "./floor-keys.ts";
import { setNaturalPalette } from "./palette.ts";
import { runAll } from "./slices.ts";
import { AREA_Y, DEEPEST, FLAT_Y, surroundingsGeometry, WAY_Y } from "./surroundings.ts";
import { AROUND_SHADOW, blockShadows, neighbourShadows, shadowBox } from "./sun-shadow.ts";

const rect = (x0: number, z0: number, x1: number, z1: number): Vec2[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];
const room = (id: string, p: Vec2[]): Room => ({ id, name: id, area_id: null, points: p, floor_material: "wood" });

/** A house of 12 x 8 m with an invented neighbourhood: the own house, two neighbours, a road, a path, a park, a tree. */
function house(extra: Partial<Surroundings> = {}): Building {
  const b = emptyBuilding();
  b.floors = [
    { ...newFloor("gf", "Ground", 0), rooms: [room("a", rect(0, 0, 12, 8))] },
    { ...newFloor("up", "Upper", 2.75), rooms: [room("b", rect(0, 0, 12, 8))] },
  ];
  b.settings.surroundings = {
    on: true,
    lat: 45.5,
    lon: 7.25,
    at: 1_800_000_000,
    radius: 150,
    x: 6,
    z: 4,
    own: 0,
    buildings: [
      { p: rect(-6, -4, 6, 4), h: 7 },
      { p: rect(14, -4, 24, 4), h: 9.5 },
      { p: rect(-30, -20, -22, -12), h: 3 },
    ],
    ways: [
      { p: [[-60, -15], [60, -15]], w: 6, k: "road" },
      { p: [[0, -15], [0, -40]], w: 1.5, k: "path" },
    ],
    areas: [{ p: rect(-60, 20, -30, 50), k: "green" }],
    trees: [[10, 10]],
    ...extra,
  };
  return b;
}

/** Each triangle as its three corners [x, y, z]. */
function triangles(g: BufferGeometry, from = 0, to = Infinity): number[][][] {
  const p = g.getAttribute("position");
  const out: number[][][] = [];
  for (let i = from * 3; i < Math.min(p.count, to * 3); i += 3) out.push([0, 1, 2].map((k) => [p.getX(i + k), p.getY(i + k), p.getZ(i + k)]));
  return out;
}

/** The map's geometry for a plan, standing on the default ground. */
const geometry = (b: Building) => runAll(surroundingsGeometry(placedSurroundings(b)!, DEFAULT_GROUND));

test("the map is a geometry of its own: the floors are drawn exactly as before (Realistic and every style unchanged)", () => {
  const b = house();
  const plain = buildFloorGeometry(b.floors[0], 0.24, 0.12);
  const withMap = structuredClone(b);
  const again = buildFloorGeometry(withMap.floors[0], 0.24, 0.12);
  assert.deepEqual(Array.from(again.walls.getAttribute("position").array), Array.from(plain.walls.getAttribute("position").array));
  const { solid } = geometry(b);
  assert.ok(solid.getAttribute("position").count > 0);
  // the map never folds away or turns to glass with the walls
  assert.ok(Array.from(solid.getAttribute("fold").array).every((f) => f === -1));
});

test("neighbours stand as blocks of their real height; the own house is not drawn", () => {
  const tris = triangles(geometry(house()).solid);
  const top = (x0: number, x1: number) => Math.max(...tris.flat().filter(([x, , z]) => x >= x0 && x <= x1 && Math.abs(z) <= 4.01).map(([, y]) => y));
  // the neighbour of 9.5 m east of the house (plan x 20 .. 30), standing on the ground
  assert.ok(Math.abs(top(20, 30) - (DEFAULT_GROUND + 9.5)) < 1e-6, String(top(20, 30)));
  // nothing of the own house (it would stand on the plan's rooms, 0 .. 12)
  const onHouse = tris.filter((t) => t.every(([x, y, z]) => x > 0.5 && x < 11.5 && z > 0.5 && z < 7.5 && y > DEFAULT_GROUND + 0.5));
  assert.equal(onHouse.length, 0);
});

test("flat layers lie below the ground, each kind at its own depth centimetres apart, areas lowest and streets on top", () => {
  const levels = [...Object.values(AREA_Y), ...Object.values(WAY_Y)].sort((p, q) => p - q);
  for (let i = 1; i < levels.length; i++) assert.ok(levels[i] - levels[i - 1] >= 0.01 - 1e-9, `${levels[i - 1]} and ${levels[i]} are too close`);
  assert.ok(Math.max(...levels, FLAT_Y) < 0, "all below the ground");
  assert.ok(AREA_Y.green < WAY_Y.road && AREA_Y.wood < WAY_Y.path);
  assert.equal(DEEPEST, AREA_Y.green);
  const tris = triangles(geometry(house()).solid);
  const flatAt = (y: number) => tris.some((t) => t.every((p) => Math.abs(p[1] - (DEFAULT_GROUND + y)) < 1e-6));
  assert.ok(flatAt(AREA_Y.green), "the park");
  assert.ok(flatAt(WAY_Y.road), "the road");
  assert.ok(flatAt(WAY_Y.path), "the path");
});

test("the flat outlines mode draws the neighbours flat on the ground, no block rises", () => {
  const tris = triangles(geometry(house({ flat: true, trees: [] })).solid);
  assert.ok(tris.length > 0);
  assert.ok(tris.flat().every(([, y]) => y < DEFAULT_GROUND), "nothing above the ground");
  assert.ok(tris.some((t) => t.every((p) => Math.abs(p[1] - (DEFAULT_GROUND + FLAT_Y)) < 1e-6)), "the outlines' floor");
});

test("the gable roof option gives a house a ridge at its height and eaves below it; big buildings stay blocks (#491)", () => {
  const ridge = (b: Building) => {
    const tris = triangles(geometry(b).solid).flat().filter(([x]) => x >= 20 && x <= 30);
    const at = (z: number) => Math.max(...tris.filter(([, , pz]) => Math.abs(pz - z) < 1e-6).map(([, y]) => y));
    const [z0, z1] = [Math.min(...tris.map(([, , z]) => z)), Math.max(...tris.map(([, , z]) => z))];
    return { top: Math.max(...tris.map(([, y]) => y)), edge: at(z0), middle: at((z0 + z1) / 2) };
  };
  // off: a block, as high at its edge as in the middle
  const block = ridge(house({ trees: [] }));
  assert.ok(Math.abs(block.edge - (DEFAULT_GROUND + 9.5)) < 1e-6);
  // on: the ridge (the map's height) along the 10 m side, the eave at the 8 m side lower
  const roofed = ridge(house({ trees: [], roofs: true }));
  assert.ok(Math.abs(roofed.top - (DEFAULT_GROUND + 9.5)) < 1e-6);
  assert.ok(Math.abs(roofed.middle - (DEFAULT_GROUND + 9.5)) < 1e-6);
  assert.ok(roofed.edge < DEFAULT_GROUND + 9.5 - 1, String(roofed.edge));
  // a hall (too wide) stays a block even with the option on
  const hall = house({ trees: [], roofs: true, buildings: [{ p: rect(-6, -4, 6, 4), h: 7 }, { p: rect(14, -4, 54, 21), h: 9.5 }] });
  assert.ok(Math.abs(ridge(hall).edge - (DEFAULT_GROUND + 9.5)) < 1e-6);
  // the outline mode wins: flat stays flat
  assert.ok(triangles(geometry(house({ trees: [], roofs: true, flat: true })).solid).flat().every(([, y]) => y < DEFAULT_GROUND));
});

test("houses hidden by hand are not drawn; shown again they are", () => {
  const count = (b: Building) => placedSurroundings(b)!.buildings.length;
  assert.equal(count(house()), 2);
  assert.equal(count(house({ hide: [1] })), 1);
  // the own building shown by hand leaves out what the plan builds on it: here that is all of it (#529)
  assert.equal(count(house({ hide: [1], show: [0] })), 1);
});

test("the homely styles draw the map in their natural colours", () => {
  const b = house();
  const colours = () => Array.from(geometry(b).solid.getAttribute("color").array);
  const neon = colours();
  setNaturalPalette(true);
  try {
    assert.notDeepEqual(colours(), neon);
  } finally {
    setNaturalPalette(false);
  }
  assert.deepEqual(colours(), neon);
});

test("drawing the map pauses between pieces (it is built in short slices)", () => {
  const b = house({ trees: Array.from({ length: 200 }, (_, i) => [40 + (i % 20) * 4, 40 + Math.floor(i / 20) * 4] as Vec2) });
  const steps = surroundingsGeometry(placedSurroundings(b)!, DEFAULT_GROUND);
  let pauses = 0;
  while (!steps.next().done) pauses++;
  assert.ok(pauses >= 4, String(pauses));
});

// ------------------------------------------------------------------ shadows

test("a neighbour's block throws its height away from the sun", () => {
  // the sun in the south at 45 degrees: light from +z, the shadow falls north (-z) as far as the block is tall
  const tris = blockShadows([{ p: rect(0, 0, 4, 4), h: 6 }], [0, 1], 45);
  const [x0, z0, x1, z1] = shadowBox(tris)!;
  assert.ok(Math.abs(z0 + 6) < 1e-6, String(z0));
  assert.deepEqual([x0, x1, z1], [0, 4, 4]);
  assert.equal(blockShadows([{ p: rect(0, 0, 4, 4), h: 6 }], [0, 1], -1).length, 0, "no sun, no shadow");
});

test("the neighbours near the house add their shadows into the garden; far ones and the flat mode add none", () => {
  const placed = (extra: Partial<PlacedSurroundings> = {}): PlacedSurroundings => ({
    ground: null,
    buildings: [
      { p: rect(16, 0, 20, 4), h: 8 },
      { p: rect(400, 0, 404, 4), h: 30 },
    ],
    ways: [],
    areas: [],
    trees: [],
    flat: false,
    roofs: false,
    y: 0,
    ...extra,
  });
  const own: [number, number, number, number] = [0, -3, 12, 8];
  // morning: the sun in the east (light from +x), the neighbour's shadow falls west, towards the house
  const tris: number[] = [];
  const box = neighbourShadows(tris, own, placed(), [1, 0], 30, 0.2);
  assert.ok(tris.length > 0);
  assert.ok(box[0] < 4 && box[2] >= 20 && box[2] <= own[2] + AROUND_SHADOW, JSON.stringify(box));
  // the far one throws nothing into the picture
  assert.ok(!tris.some((v, i) => i % 2 === 0 && v > 100));
  const flat: number[] = [];
  assert.deepEqual(neighbourShadows(flat, own, placed({ flat: true }), [1, 0], 30, 0.2), own);
  assert.equal(flat.length, 0);
  assert.deepEqual(neighbourShadows([], own, null, [1, 0], 30, 0.2), own, "no map, the house's own box");
  // a map lowered below the lawn (a street under the garden, #482): the blocks keep a height, no empty or upside-down shadow
  const low: number[] = [];
  neighbourShadows(low, own, placed(), [1, 0], 30, -50);
  assert.ok(low.length > 0 && low.every(Number.isFinite));
});

test("the viewer: the map only on the ground floor, shadows dropped with quality Low, sun and patches use the aligned north", () => {
  const src = readFileSync(new URL("./viewer3d.ts", import.meta.url), "utf8");
  assert.match(src, /const id = b \? surroundFloorId\(b\) : undefined;/);
  // built once in slices and kept over rebuilds of the house
  assert.match(src, /if \(this\.around\?\.key === key\) return this\.hangAround\(fv\);/);
  assert.match(src, /this\.around\?\.group\.removeFromParent\(\);/);
  // the shadow is drawn only above quality Low (the neighbours' with the house's)
  assert.match(src, /const shade = on && !this\.lowQuality && /);
  assert.match(src, /neighbourShadows\(tris, own, placedOnce\(b\), toSun,/);
  // the map stands on the ground floor's ground moved by its height (#482): drawn, its sky edge and its shadows
  assert.match(src, /const ground = groundLevel\(fv\.floor\) \+ placed\.y;/);
  assert.match(src, /const ground = groundLevel\(fv\.floor\) \+ \(placed\?\.y \?\? 0\);/);
  assert.match(src, /groundLevel\(gf\) \+ \(placedOnce\(b\)\?\.y \?\? 0\) - lawn/);
  // the shadow's key follows the map, and the sun's direction comes from the plan's north (the map turns it)
  assert.match(src, /this\.roofGeos\.length\},\$\{surroundKey\(b\)\}`/);
  assert.match(src, /const toSun: \[number, number\] = \[Math\.sin\(north \+ az\), -Math\.cos\(north \+ az\)\]/);
  assert.match(src, /private buildSun\(fv: FloorView\): void \{[\s\S]{0,300}const north = \(this\.building\?\.settings\.north \?\? 0\) \* DEG/);
  // the floor pictures leave the map out
  assert.match(src, /if \(this\.around\) this\.around\.group\.visible = false;/);
});

// ------------------------------------------------------------------ keys, room cards, plans

test("the floor keys leave the map out: a change of the map rebuilds no floor (the map is kept apart)", () => {
  const b = house();
  const keys = floorKeys(b, "");
  assert.ok(!keys.get("gf")!.includes('"buildings"') && !keys.get("gf")!.includes('"trees"'), "no map data in the key");
  const hidden = structuredClone(b);
  hidden.settings.surroundings!.hide = [1];
  hidden.settings.surroundings!.at += 60;
  assert.deepEqual(floorKeys(hidden, ""), keys);
});

test("a room card shows the house without the map, the house view with it and the attribution", () => {
  const src = readFileSync(new URL("../components/view3d.ts", import.meta.url), "utf8");
  assert.match(src, /if \(!this\.noMapView\(\) \|\| !plan\.settings\.surroundings\) return/);
  assert.match(src, /surroundings: null \} \}/);
  assert.match(src, /href=\$\{OSM_COPYRIGHT\} target="_blank" rel="noopener noreferrer">\$\{OSM_ATTRIBUTION\}<\/a>/);
  const card = readFileSync(new URL("../card.ts", import.meta.url), "utf8");
  assert.ok(card.includes(".roomCard=${!!c?.room || rooms.length > 0}"), "a room card, and a card of some rooms (#500), has no map");
});

test("the 2D plans: the map on floors at the ground floor's level, the own house dashed, nothing upstairs", () => {
  const b = house();
  const map = planMap(b)!;
  assert.equal(map.buildings.length, 3);
  assert.deepEqual(
    map.buildings.map((x) => x.hidden),
    [true, false, false],
    "the own house is marked (dashed), the neighbours are not",
  );
  assert.equal(map.ways.length, 2);
  assert.equal(map.areas.length, 1);
  // plan metres: the own house's map outline lies on the rooms
  assert.equal(map.buildings[0].p, "0,8 12,8 12,0 0,0");
  assert.equal(planMap(b), map, "worked out once per plan");
  assert.notEqual(surroundPlanSvg(b, b.floors[0]), nothing);
  assert.equal(surroundPlanSvg(b, b.floors[1]), nothing, "not upstairs");
  // a garden floor of its own at the ground floor's level shows it too; the map switched off shows it nowhere
  const withGarden = structuredClone(b);
  withGarden.floors.push({ ...newFloor("garden", "Garden", 0.1), rooms: [] });
  assert.notEqual(surroundPlanSvg(withGarden, withGarden.floors[2]), nothing);
  const off = house({ on: false });
  assert.equal(planMap(off), null);
  assert.equal(surroundPlanSvg(off, off.floors[0]), nothing);
});
