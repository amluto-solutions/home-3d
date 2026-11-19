// The neighbourhood from OpenStreetMap (#462): reading a saved Overpass answer (invented data, no network), laying the
// map under the plan, and hiding the map's buildings where the plan builds the house. Ported from NeonPlan 3D 3.4.1
// (MIT, Mastershort), with our own fixture.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { Building, Surroundings, Vec2 } from "./model.ts";
import { emptyBuilding, newFloor } from "./model.ts";
import { placeUnderPlan } from "./surround-align.ts";
import { buildingHeight, clipLine, fetchSurroundings, loadSurroundings, OVERPASS_SERVERS, overpassQuery, parseHeight, parseOverpass, placeSurroundings, simplify, SurroundError, toMetres, wayKind, type OsmElement } from "./surround-fetch.ts";
import { atGroundLevel, hiddenBuildings, homeBuilding, mapCorners, mapToPlan, OSM_ATTRIBUTION, OSM_COPYRIGHT, ownOutline, ownUnderPlan, placedSurroundings, planMiddle, surroundFloorId, surroundKey, turnMap } from "./surroundings.ts";

/** The saved answer: an invented neighbourhood around an invented point (see the file's own note). */
const ANSWER = JSON.parse(readFileSync(new URL("./overpass-answer.fixture.json", import.meta.url), "utf8")) as { elements: OsmElement[] };
const LAT = 45.5;
const LON = 7.25;

/** A point `e` metres east and `n` metres north of the origin, as OSM gives it. */
function ll(e: number, n: number) {
  const k = Math.PI / 180;
  return { lat: LAT + n / (6378137 * k), lon: LON + e / (6378137 * k * Math.cos(LAT * k)) };
}

const rect = (x0: number, z0: number, x1: number, z1: number): Vec2[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

function house(rooms: [number, number, number, number][], north = 0): Building {
  const b = emptyBuilding();
  b.settings.north = north;
  b.floors = [{ ...newFloor("gf", "Ground floor", 0), rooms: rooms.map(([x0, z0, x1, z1], i) => ({ id: `r${i}`, name: `r${i}`, area_id: null, floor_material: "wood", points: rect(x0, z0, x1, z1) })) }];
  return b;
}

const base = (buildings: Surroundings["buildings"]): Surroundings => ({ on: true, lat: LAT, lon: LON, at: 0, radius: 150, x: 0, z: 0, own: null, buildings, ways: [], areas: [], trees: [] });

// ------------------------------------------------------------------ reading an answer

test("map metres: east and north of the origin, to the centimetre", () => {
  const p = ll(30, -12);
  const [e, n] = toMetres(LAT, LON, p.lat, p.lon);
  assert.ok(Math.abs(e - 30) < 0.02 && Math.abs(n + 12) < 0.02);
});

test("heights come from the height tag, the storeys, or the kind of building", () => {
  assert.equal(parseHeight("12"), 12);
  assert.equal(parseHeight("12,5 m"), 12.5);
  assert.ok(Math.abs(parseHeight("10'")! - 3.048) < 1e-9);
  assert.equal(parseHeight("tall"), null);
  assert.equal(buildingHeight({ building: "house", height: "8.5" }), 8.5);
  assert.equal(buildingHeight({ building: "house", "building:levels": "2" }), 7.5);
  assert.equal(buildingHeight({ building: "garage" }), 3);
  assert.equal(buildingHeight({ building: "apartments" }), 14);
  assert.equal(buildingHeight({ building: "yes" }), 7);
  assert.equal(buildingHeight({ building: "yes", height: "9000" }), 400, "capped at the schema's 400 m");
});

test("streets, paths, railways and streams get their kind and width; tunnels and plans are left out", () => {
  assert.deepEqual(wayKind({ highway: "residential" }), { k: "road", w: 6 });
  assert.deepEqual(wayKind({ highway: "footway" }), { k: "path", w: 1.8 });
  assert.deepEqual(wayKind({ highway: "track" }), { k: "path", w: 3 });
  assert.deepEqual(wayKind({ highway: "primary", width: "12" }), { k: "road", w: 12 });
  assert.deepEqual(wayKind({ railway: "rail" }), { k: "rail", w: 3 });
  assert.deepEqual(wayKind({ waterway: "stream" }), { k: "water", w: 2 });
  assert.equal(wayKind({ highway: "proposed" }), null);
  assert.equal(wayKind({ highway: "primary", tunnel: "yes" }), null);
  assert.equal(wayKind({ waterway: "river", tunnel: "culvert" }), null);
  assert.equal(wayKind({ building: "yes" }), null);
});

test("simplifying keeps the corners and drops points on a straight line", () => {
  assert.deepEqual(
    simplify([
      [0, 0],
      [5, 0.02],
      [10, 0],
      [10, 10],
    ]),
    [
      [0, 0],
      [10, 0],
      [10, 10],
    ],
  );
});

test("the saved Overpass answer becomes buildings, ways, areas and trees in map metres; far and unwanted things stay out", () => {
  const s = parseOverpass(ANSWER, LAT, LON, 150);
  assert.equal(s.lat, LAT);
  assert.equal(s.radius, 150);
  // the home, the neighbour, the garage, the block of flats (its outer ring); not the far one, not building=no
  assert.equal(s.buildings.length, 4);
  assert.equal(s.buildings[0].p.length, 4, "the closing point is dropped");
  assert.deepEqual(
    s.buildings.map((b) => b.h),
    [7.5, 9.5, 3, 14],
  );
  // the road (its ends far outside), the footway, the railway and the stream; not the tunnel, not the proposed road
  assert.deepEqual(s.ways.map((w) => w.k).sort(), ["path", "rail", "road", "water"]);
  assert.deepEqual(s.areas.map((a) => a.k).sort(), ["green", "water", "wood"]);
  assert.equal(s.trees.length, 2, "the far tree stays out");
  // everything within the schema's limits: shapes of 2 to 200 points, coordinates within ±1000 m
  for (const shape of [...s.buildings, ...s.ways, ...s.areas]) {
    assert.ok(shape.p.length >= 2 && shape.p.length <= 200);
    for (const [x, z] of shape.p) assert.ok(Math.abs(x) <= 1000 && Math.abs(z) <= 1000);
  }
});

test("lines reaching kilometres away are cut at the neighbourhood, a far wood at its square", () => {
  const s = parseOverpass(ANSWER, LAT, LON, 150);
  const far = (pts: Vec2[]) => Math.max(...pts.map((p) => Math.hypot(p[0], p[1])));
  const stream = s.ways.find((w) => w.k === "water")!;
  assert.ok(far(stream.p) <= 150 * 1.15 + 0.02, "the stream ends at the circle");
  assert.ok(far(stream.p) > 150, "and reaches it");
  const wood = s.areas.find((a) => a.k === "wood")!;
  for (const [x, z] of wood.p) assert.ok(Math.abs(x) <= 225.01 && Math.abs(z) <= 225.01);
});

test("cutting a line at a circle keeps the parts inside, each crossing cut at the rim", () => {
  const parts = clipLine(
    [
      [-300, 0],
      [300, 0],
      [300, 10],
      [0, 10],
    ],
    100,
  );
  assert.equal(parts.length, 2);
  assert.deepEqual(
    parts[0].map((p) => p.map((v) => Math.round(v))),
    [
      [-100, 0],
      [100, 0],
    ],
  );
  assert.ok(Math.abs(parts[1][0][0] - Math.sqrt(100 * 100 - 10 * 10)) < 0.01, "cut at the rim, to the centimetre");
});

test("an area of more than 200 points is simplified until it fits, not dropped", () => {
  // a circle of 400 points, 60 m across: a wood the plan can only keep with 200 points or fewer
  const ring = Array.from({ length: 400 }, (_, i) => ll(30 * Math.cos((i / 400) * 2 * Math.PI), 30 * Math.sin((i / 400) * 2 * Math.PI)));
  const s = parseOverpass({ elements: [{ type: "way", tags: { natural: "wood" }, geometry: [...ring, ring[0]] }] }, LAT, LON, 150);
  assert.equal(s.areas.length, 1);
  assert.ok(s.areas[0].p.length <= 200 && s.areas[0].p.length >= 8);
});

// ------------------------------------------------------------------ the query and the servers (no network)

test("the query asks for a box around the home of the radius, with geometry and tags", () => {
  const q = overpassQuery(LAT, LON, 100);
  const box = /\[bbox:([-\d.]+),([-\d.]+),([-\d.]+),([-\d.]+)\]/.exec(q)!.slice(1).map(Number);
  assert.ok(Math.abs((box[2] - box[0]) / 2 - 100 / 111319.5) < 1e-5, "100 m north and south");
  assert.ok(box[1] < LON && box[3] > LON);
  assert.ok(q.includes('way["building"]') && q.includes('node["natural"="tree"]') && q.endsWith("out tags geom;"));
});

test("only the two public Overpass servers are asked, by POST, without cookies or referrer", async () => {
  assert.deepEqual(
    OVERPASS_SERVERS.map((u) => new URL(u).host),
    ["overpass-api.de", "overpass.kumi.systems"],
  );
  const asked: { url: string; init: RequestInit }[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    asked.push({ url, init });
    return new Response(JSON.stringify(ANSWER), { status: 200 });
  }) as unknown as typeof fetch;
  const out = await fetchSurroundings(LAT, LON, 150, undefined, fetcher);
  assert.equal(out.buildings.length, 4);
  assert.equal(asked.length, 1, "one query: the location is sent once");
  assert.equal(asked[0].url, OVERPASS_SERVERS[0]);
  assert.equal(asked[0].init.method, "POST");
  assert.equal(asked[0].init.credentials, "omit");
  assert.equal(asked[0].init.referrerPolicy, "no-referrer");
  assert.ok(String(asked[0].init.body).startsWith("data="));
});

test("a busy server is asked again after a pause, then the second server", async () => {
  const urls: string[] = [];
  const answers = [503, 429, 504, 200];
  const fetcher = (async (url: string) => {
    urls.push(url);
    const status = answers.shift()!;
    return status === 200 ? new Response(JSON.stringify(ANSWER), { status }) : new Response("busy", { status });
  }) as unknown as typeof fetch;
  const pauses: number[] = [];
  const out = await fetchSurroundings(LAT, LON, 100, undefined, fetcher, async (ms) => void pauses.push(ms));
  assert.ok(out.ways.length > 0);
  assert.deepEqual(pauses, [4000, 8000], "no pause before giving up on a server");
  assert.deepEqual(urls, [OVERPASS_SERVERS[0], OVERPASS_SERVERS[0], OVERPASS_SERVERS[0], OVERPASS_SERVERS[1]]);
});

test("no map server reached, busy servers and an empty map are told apart", async () => {
  const fail = (async () => {
    throw new TypeError("network");
  }) as typeof fetch;
  await assert.rejects(fetchSurroundings(LAT, LON, 100, undefined, fail), (e: unknown) => e instanceof SurroundError && e.kind === "offline");
  const busy = (async () => new Response("busy", { status: 429 })) as typeof fetch;
  await assert.rejects(fetchSurroundings(LAT, LON, 100, undefined, busy, async () => undefined), (e: unknown) => (e as SurroundError).kind === "busy");
  const empty = (async () => new Response(JSON.stringify({ elements: [] }), { status: 200 })) as typeof fetch;
  await assert.rejects(fetchSurroundings(LAT, LON, 100, undefined, empty), (e: unknown) => (e as SurroundError).kind === "empty");
  const aborted = new AbortController();
  aborted.abort();
  await assert.rejects(fetchSurroundings(LAT, LON, 100, aborted.signal, fail), (e: unknown) => (e as SurroundError).kind === "offline");
});

// ------------------------------------------------------------------ laying the map under the plan

test("the home's building is the one around the origin, else the nearest close by", () => {
  const s = base([
    { p: rect(20, 20, 30, 30), h: 7 },
    { p: rect(-5, -5, 5, 5), h: 7 },
  ]);
  assert.equal(homeBuilding(s), 1);
  assert.equal(homeBuilding(base([{ p: rect(8, 8, 12, 12), h: 7 }])), 0);
  assert.equal(homeBuilding(base([{ p: rect(80, 80, 90, 90), h: 7 }])), null);
});

test("north up: a map point lands east = right, north = up of the origin's plan point", () => {
  assert.deepEqual(mapToPlan({ x: 10, z: 20 }, 0, [3, 4]), [13, 16]);
  const [x, z] = mapToPlan({ x: 0, z: 0 }, 90, [0, 5]);
  assert.ok(Math.abs(x - 5) < 1e-9 && Math.abs(z) < 1e-9, "north turned 90° clockwise points right");
});

test("loading the saved answer lays the map's house (standing at 30°) onto the drawn rooms and turns north to match", async () => {
  const b = house([[0, 0, 12, 8]]);
  const fetcher = (async () => new Response(JSON.stringify(ANSWER), { status: 200 })) as unknown as typeof fetch;
  const { surroundings: s, north } = await loadSurroundings(LAT, LON, 150, b, undefined, fetcher);
  assert.equal(s.on, true);
  assert.equal(s.own, 0, "the home's building");
  assert.ok(s.at > 1_700_000_000);
  // the map's corners land on the plan's corners
  const corners = s.buildings[0].p.map((p) => mapToPlan(s, north, p));
  for (const want of rect(0, 0, 12, 8)) assert.ok(corners.some(([x, z]) => Math.hypot(x - want[0], z - want[1]) < 0.1), `a corner at ${want} (got ${JSON.stringify(corners)})`);
  // the house itself is not drawn, the neighbours are
  const placed = placedSurroundings({ ...b, settings: { ...b.settings, north, surroundings: s } })!;
  assert.equal(placed.buildings.length, 3);
});

test("a house standing at an angle on the map is turned onto the plan and lies on its rooms", () => {
  const b = house([[0, 0, 12, 8]]);
  const t = (30 * Math.PI) / 180;
  const rot = ([e, n]: Vec2): Vec2 => [e * Math.cos(t) - n * Math.sin(t), e * Math.sin(t) + n * Math.cos(t)];
  const footprint: Vec2[] = rect(-6, -4, 6, 4).map(rot).map(([e, n]) => [e + 2, n + 1]);
  const s = base([{ p: footprint, h: 7 }]);
  const placed = placeUnderPlan(s, homeBuilding(s), b);
  const corners = footprint.map((p) => mapToPlan(placed, placed.north, p));
  for (const want of rect(0, 0, 12, 8)) assert.ok(corners.some(([x, z]) => Math.hypot(x - want[0], z - want[1]) < 0.05), `a corner at ${want}`);
});

test("of the turns that fit, the one closest to the north set so far wins", () => {
  const sq = rect(-6, -4, 6, 4);
  const s = base([{ p: sq, h: 7 }]);
  assert.equal(placeUnderPlan(s, 0, house([[0, 0, 12, 8]], 0)).north, 0);
  assert.equal(placeUnderPlan(s, 0, house([[0, 0, 12, 8]], 170)).north, 180);
  // a north a little left of up is told as 0 … 360, like the north field
  const t = (-10 * Math.PI) / 180;
  const tilted: Vec2[] = sq.map(([e, n]) => [e * Math.cos(t) - n * Math.sin(t), e * Math.sin(t) + n * Math.cos(t)]);
  assert.equal(placeUnderPlan(base([{ p: tilted, h: 7 }]), 0, house([[0, 0, 12, 8]], 0)).north, 350);
});

test("no house on the map: the home's location goes to the plan's middle and north stays", () => {
  const b = house([[0, 0, 12, 8]], 25);
  assert.deepEqual(placeUnderPlan(base([]), null, b), { north: 25, x: 6, z: 4 });
  const data = parseOverpass({ elements: [{ type: "way", tags: { highway: "residential" }, geometry: [ll(-50, 0), ll(50, 0)] }] }, LAT, LON, 100);
  const { surroundings, north } = placeSurroundings(data, b, 1_763_164_800_000);
  assert.deepEqual([surroundings.own, surroundings.x, surroundings.z, north, surroundings.at], [null, 6, 4, 25, 1_763_164_800]);
});

test("nothing drawn yet: the map's house is turned square to the screen with its corner at the plan's origin", () => {
  const b = house([]);
  const t = (20 * Math.PI) / 180;
  const sq: Vec2[] = rect(-6, -4, 6, 4).map(([e, n]) => [e * Math.cos(t) - n * Math.sin(t) + 3, e * Math.sin(t) + n * Math.cos(t) - 2]);
  const placed = placeUnderPlan(base([{ p: sq, h: 7 }]), 0, b);
  assert.equal(placed.north, 20, "of the four square turns, the one closest to north up");
  const corners = sq.map((p) => mapToPlan(placed, placed.north, p));
  for (const want of rect(0, 0, 12, 8)) assert.ok(corners.some(([x, z]) => Math.hypot(x - want[0], z - want[1]) < 0.05), `a corner at ${want}`);
  assert.equal(planMiddle(b), null);
});

test("a garage mapped as a building of its own turns the map the right way round and is hidden too", () => {
  // the plan: a house of two rooms, a garage beside it that reaches further up, a shed apart in the garden
  const b = house(
    [
      [0, 0, 5, 8],
      [5.2, 0, 10, 8],
      [10.5, -4, 14.5, 4.5],
      [11, -10, 14, -7.5],
    ],
    210,
  );
  // the map as it really is: north 120°, the house and the garage with their walls, the origin in the house
  const truth = { north: 120, x: 5, z: 4 };
  const t = (truth.north * Math.PI) / 180;
  const toMap = ([x, z]: Vec2): Vec2 => {
    const dx = x - truth.x;
    const dz = z - truth.z;
    return [dx * Math.cos(t) + dz * Math.sin(t), dx * Math.sin(t) - dz * Math.cos(t)];
  };
  const box = (x0: number, z0: number, x1: number, z1: number): Vec2[] => rect(x0, z0, x1, z1).map(toMap);
  const s = base([
    { p: box(-0.3, -0.3, 10.3, 8.3), h: 7 },
    { p: box(10.3, -4.3, 14.8, 4.8), h: 3 },
    { p: box(30, 0, 40, 10), h: 7 },
  ]);
  const own = homeBuilding(s);
  assert.equal(own, 0);
  const placed = placeUnderPlan(s, own, b);
  assert.equal(placed.north, 120, "not the turn closest to the old north (210°), the one where house and garage fit");
  assert.ok(Math.hypot(placed.x - truth.x, placed.z - truth.z) < 0.3, JSON.stringify(placed));
  const sur: Surroundings = { ...s, own, x: placed.x, z: placed.z };
  const moved = { ...b, settings: { ...b.settings, north: placed.north } };
  assert.deepEqual([...hiddenBuildings(sur, moved)].sort(), [0, 1], "the house and its garage, not the neighbour");
});

// ------------------------------------------------------------------ what is not drawn

test("the own building and buildings standing in the plan's rooms are not drawn; hide, show and flat by hand", () => {
  const b = house([[0, 0, 12, 8]]);
  const s: Surroundings = { ...base([{ p: rect(-6, -4, 6, 4), h: 7 }, { p: rect(20, 0, 25, 5), h: 3 }, { p: rect(4, -1, 5, 0), h: 3 }]), x: 6, z: 4, own: 0 };
  assert.deepEqual([...hiddenBuildings(s, b)].sort(), [0, 2]);
  const placed = placedSurroundings({ ...b, settings: { ...b.settings, surroundings: s } })!;
  assert.equal(placed.buildings.length, 1);
  assert.deepEqual(placed.buildings[0].p[0], [26, 4]);
  assert.equal(placed.flat, false);
  // on the ground floor's ground unless the map is moved up or down (#482); a map saved without a height is at 0
  assert.equal(placed.y, 0);
  const at = (y: number) => placedSurroundings({ ...b, settings: { ...b.settings, surroundings: s, surroundings_y: y } })!.y;
  assert.equal(at(-1.2), -1.2);
  assert.equal(at(99), 30);
  assert.equal(at(-99), -30);
  assert.equal(at(Number.NaN), 0);
  assert.equal(placedSurroundings({ ...b, settings: { ...b.settings, surroundings: { ...s, on: false } } }), null);
  assert.equal(placedSurroundings(b), null);
  const picked = { ...s, hide: [1], show: [2], flat: true };
  assert.deepEqual([...hiddenBuildings(picked, b)].sort(), [0, 1]);
  const flat = placedSurroundings({ ...b, settings: { ...b.settings, surroundings: picked } })!;
  assert.equal(flat.flat, true);
  assert.equal(flat.buildings.length, 1);
});

test("map buildings over a carport, a shed on a garden floor, an upper floor and a pergola are hidden; the neighbours stay", () => {
  const b = house([[0, 0, 10, 8]]);
  // the garden on a floor of its own at ground level, with a shed as a room and a pergola
  b.floors.push({
    ...newFloor("garden", "Garden", 0),
    rooms: [{ id: "shed", name: "Shed", area_id: null, floor_material: "wood", points: rect(-6, 12, -3, 15) }],
    outdoor: [{ id: "p", type: "pergola", points: rect(2, 12, 6, 15) }],
  });
  // an upper floor reaching out over a porch the ground floor does not have
  b.floors.push({ ...newFloor("ff", "First floor", 2.7), rooms: [{ id: "over", name: "Over", area_id: null, floor_material: "wood", points: rect(0, -4, 10, 0) }] });
  // a carport as an open roof section beside the house (a custom roof), and a dormer that is no building
  b.settings.roof = {
    ...b.settings.roof,
    type: "custom",
    sections: [
      { id: "carport", x0: 11, z0: 0, x1: 14, z1: 5, shape: "shed", axis: "x", eave_a: 2.4, eave_b: 2.4, pitch_a: 4, pitch_b: 4, base: 2.4, open: true },
      { id: "dormer", x0: 30, z0: 0, x1: 32, z1: 2, shape: "gable", axis: "x", eave_a: 2.4, eave_b: 2.4, pitch_a: 30, pitch_b: 30, base: 5, dormer: true },
    ],
  } as Building["settings"]["roof"];
  // the map in plan coordinates (north up, origin at the plan's origin): map north is plan -z
  const box = (x0: number, z0: number, x1: number, z1: number): Vec2[] => [
    [x0, -z0],
    [x1, -z0],
    [x1, -z1],
    [x0, -z1],
  ];
  const s: Surroundings = {
    ...base([
      { p: box(0, 0, 10, 8), h: 7 },
      { p: box(11.2, 0.3, 13.8, 4.8), h: 3 },
      { p: box(-6.2, 11.8, -2.8, 15.2), h: 3 },
      { p: box(2.2, 12.2, 5.8, 14.8), h: 3 },
      { p: box(0.5, -3.5, 9.5, -0.5), h: 3 },
      { p: box(20, 0, 30, 8), h: 7 },
      { p: box(30.2, 0.2, 31.8, 1.8), h: 3 },
    ]),
    own: 0,
  };
  assert.deepEqual([...hiddenBuildings(s, b)].sort(), [0, 1, 2, 3, 4], "not the neighbour, not the one under a dormer");
  // the same roof sections on a plain gable roof are not built, so they hide nothing
  const gable = { ...b, settings: { ...b.settings, roof: { ...b.settings.roof, type: "gable" as const } } };
  assert.ok(!hiddenBuildings(s, gable).has(1));
});

test("moved by hand off a neighbour taken as the own house: it shows again, the house under the plan is the own one", () => {
  const b = house([[0, 0, 10, 8]]);
  const box = (x0: number, z0: number, x1: number, z1: number): Vec2[] => [
    [x0, -z0],
    [x1, -z0],
    [x1, -z1],
    [x0, -z1],
  ];
  const s: Surroundings = { ...base([{ p: box(25, 0, 35, 8), h: 7 }, { p: box(-30, 0, -20, 8), h: 7 }]), own: 0, x: -25, z: 0 };
  assert.deepEqual([...hiddenBuildings(s, b)], [0], "first laid onto the neighbour");
  const back = { ...s, x: 0, z: 0 };
  assert.equal(ownUnderPlan(back, b), null);
  assert.deepEqual([...hiddenBuildings({ ...back, own: null }, b)], []);
  assert.equal(ownUnderPlan({ ...s, x: 30, z: 0 }, b), 1);
  assert.equal(ownUnderPlan(back, house([])), undefined, "nothing drawn yet: the own house stays as it is");
});

// ------------------------------------------------------------------ helpers the later tickets draw with

test("turning the map about the house keeps every map point at the same distance from the house's middle", () => {
  const s = { x: 3, z: -2 };
  const mid: Vec2 = [6, 4];
  const p: Vec2 = [10, 5];
  const before = mapToPlan(s, 20, p);
  const turned = turnMap(s, 20, 90, mid);
  assert.equal(turned.north, 110);
  const after = mapToPlan(turned, turned.north, p);
  assert.ok(Math.abs(Math.hypot(before[0] - mid[0], before[1] - mid[1]) - Math.hypot(after[0] - mid[0], after[1] - mid[1])) < 0.02);
  const right = turnMap({ x: 16, z: 4 }, 0, 90, mid);
  assert.ok(Math.abs(right.x - 6) < 0.01 && Math.abs(right.z - 14) < 0.01);
  assert.equal(turnMap(s, 10, -20, mid).north, 350);
});

test("the map lies on the floor closest to the ground and shows on every floor at that level", () => {
  const b = house([[0, 0, 10, 8]]);
  b.floors.unshift({ ...newFloor("cellar", "Cellar", -2.5) });
  b.floors.push({ ...newFloor("garden", "Garden", 0.2) }, { ...newFloor("ff", "First floor", 2.7) });
  assert.equal(surroundFloorId(b), "gf");
  assert.deepEqual(
    b.floors.map((f) => atGroundLevel(b, f)),
    [false, true, true, false],
  );
});

test("the own outline, the corners to snap to and the redraw key follow the map", () => {
  const b = house([[0, 0, 12, 8]]);
  assert.equal(ownOutline(b), null);
  assert.deepEqual(mapCorners(b), []);
  assert.equal(surroundKey(b), "");
  const s: Surroundings = { ...base([{ p: rect(-6, -4, 6, 4), h: 7 }, { p: rect(20, 0, 25, 5), h: 3 }]), x: 6, z: 4, own: 0 };
  const withMap = { ...b, settings: { ...b.settings, surroundings: s } };
  assert.deepEqual(ownOutline(withMap)![0], [0, 8]);
  assert.equal(mapCorners(withMap).length, 8);
  const key = surroundKey(withMap);
  assert.notEqual(key, "");
  assert.notEqual(surroundKey({ ...withMap, settings: { ...withMap.settings, surroundings: { ...s, flat: true } } }), key);
  // a new height redraws the map and its shadows (#482); no height and 0 are the same map
  assert.notEqual(surroundKey({ ...withMap, settings: { ...withMap.settings, surroundings_y: 1.5 } }), key);
  assert.equal(surroundKey({ ...withMap, settings: { ...withMap.settings, surroundings_y: 0 } }), key);
  assert.equal(surroundKey({ ...withMap, settings: { ...withMap.settings, surroundings: { ...s, on: false } } }), "");
});

test("the attribution names OpenStreetMap's contributors and links its copyright page", () => {
  assert.equal(OSM_ATTRIBUTION, "© OpenStreetMap contributors");
  assert.equal(OSM_COPYRIGHT, "https://www.openstreetmap.org/copyright");
});
