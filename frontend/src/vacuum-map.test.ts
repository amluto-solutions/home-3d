import assert from "node:assert/strict";
import { test } from "node:test";
import { affineFrom3, apply, compose, det, floorCentre, imageToPlan, invert, isMapCamera, readCalibration, readMapCamera, similarityFrom2, spotOnPlan, vacuumToPlan, type Affine, type Pt } from "./vacuum-map.ts";

const near = (a: Pt, b: Pt, eps = 1e-6) => assert.ok(Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps, `${a} != ${b}`);

// a Dreame-like calibration: 1 px = 50 mm, y turned over, origin at pixel (400, 300)
const dreame = [
  { vacuum: { x: 0, y: 0 }, map: { x: 400, y: 300 } },
  { vacuum: { x: 1000, y: 0 }, map: { x: 420, y: 300 } },
  { vacuum: { x: 0, y: 1000 }, map: { x: 400, y: 280 } },
];

test("calibration points give vacuum -> image", () => {
  const cal = readCalibration(dreame)!;
  near(apply(cal, [0, 0]), [400, 300]);
  near(apply(cal, [2000, -500]), [440, 310]);
  assert.ok(det(cal) < 0, "the map's y axis is turned over");
});

test("unusable calibrations are refused", () => {
  assert.equal(readCalibration(undefined), null);
  assert.equal(readCalibration([dreame[0], dreame[1]]), null);
  // dreame_vacuum's placeholder before a map has arrived: every point at 0
  const zero = [0, 1, 2].map(() => ({ vacuum: { x: 0, y: 0 }, map: { x: 0, y: 0 } }));
  assert.equal(readCalibration(zero), null);
  assert.equal(readCalibration([{ vacuum: { x: "a", y: 0 }, map: { x: 0, y: 0 } }, ...dreame]), null);
});

test("affine from three points, its inverse and composition", () => {
  const m = affineFrom3([[0, 0], [1, 0], [0, 1]], [[5, 6], [7, 6], [5, 9]])!;
  near(apply(m, [1, 1]), [7, 9]);
  const inv = invert(m)!;
  near(apply(inv, [7, 9]), [1, 1]);
  near(apply(compose(inv, m), [3.5, -2]), [3.5, -2]);
  assert.equal(affineFrom3([[0, 0], [1, 1], [2, 2]], [[0, 0], [1, 0], [0, 1]]), null);
  assert.equal(invert([1, 2, 2, 4, 0, 0]), null);
});

test("similarity from two points, with and without a flip", () => {
  const src: Pt[] = [[0, 0], [1000, 0]];
  const dst: Pt[] = [[2, 3], [2, 4]];
  const plain = similarityFrom2(src, dst, false)!;
  near(apply(plain, [1000, 0]), [2, 4]);
  near(apply(plain, [0, 1000]), [1, 3]);
  const flipped = similarityFrom2(src, dst, true)!;
  near(apply(flipped, [1000, 0]), [2, 4]);
  near(apply(flipped, [0, 1000]), [3, 3]);
  assert.ok(det(flipped) < 0 && det(plain) > 0);
  assert.equal(similarityFrom2([[1, 1], [1, 1]], dst, false), null);
});

test("vacuum -> plan: none, one, two and three picked pairs", () => {
  const cal = readCalibration(dreame)!;
  const size: Pt = [800, 600];
  // none: upright at true size (1 px = 50 mm = 0.05 m), the picture's middle on the centre
  const none = vacuumToPlan(cal, size, [], [5, 4]);
  near(apply(compose(none, invert(cal)!), [400, 300]), [5, 4]);
  near(apply(none, [1000, 0]), [6, 4]);
  near(apply(none, [0, 1000]), [5, 3]);
  // one pair: the same, shifted onto it
  const one = vacuumToPlan(cal, size, [{ v: [0, 0], p: [1, 1] }], [5, 4]);
  near(apply(one, [0, 0]), [1, 1]);
  near(apply(one, [1000, 0]), [2, 1]);
  // two pairs: the robot's x runs down the plan here, flipped like the picture (y up on the map -> +x on the plan)
  const two = vacuumToPlan(cal, size, [{ v: [0, 0], p: [1, 1] }, { v: [2000, 0], p: [1, 3] }], [5, 4]);
  near(apply(two, [2000, 0]), [1, 3]);
  near(apply(two, [0, 1000]), [2, 1]);
  assert.ok(det(two) < 0);
  // three pairs: exact through all of them (a slightly sheared plan)
  const pairs = [
    { v: [0, 0] as Pt, p: [1, 1] as Pt },
    { v: [1000, 0] as Pt, p: [2, 1.1] as Pt },
    { v: [0, 1000] as Pt, p: [0.9, 0] as Pt },
  ];
  const three = vacuumToPlan(cal, size, pairs, [5, 4]);
  for (const pr of pairs) near(apply(three, pr.v), pr.p);
  // only the last three count
  const four = vacuumToPlan(cal, size, [{ v: [9, 9], p: [99, 99] }, ...pairs], [5, 4]);
  for (const pr of pairs) near(apply(four, pr.v), pr.p);
  // three on a line: the last two decide
  const line = vacuumToPlan(cal, size, [{ v: [0, 0], p: [0, 0] }, { v: [1000, 0], p: [1, 0] }, { v: [2000, 0], p: [2, 0] }], [5, 4]);
  near(apply(line, [2000, 0]), [2, 0]);
});

test("image -> plan puts the picture's pixels where the robot's points are", () => {
  const cal = readCalibration(dreame)!;
  const pairs = [{ v: [0, 0] as Pt, p: [1, 1] as Pt }, { v: [1000, 0] as Pt, p: [2, 1] as Pt }];
  const ip = imageToPlan(cal, [800, 600], pairs, [0, 0])!;
  near(apply(ip, [400, 300]), [1, 1]);
  near(apply(ip, [420, 300]), [2, 1]);
  assert.equal(imageToPlan(null, [800, 600], pairs, [0, 0]), null);
});

test("a Roborock map extractor calibration (no flip in the numbers given) works the same way", () => {
  const roborock = [
    { vacuum: { x: 25500, y: 25500 }, map: { x: 466, y: 1104 } },
    { vacuum: { x: 26500, y: 25500 }, map: { x: 466, y: 1084 } },
    { vacuum: { x: 25500, y: 26500 }, map: { x: 446, y: 1104 } },
  ];
  const cal = readCalibration(roborock)!;
  near(apply(cal, [26000, 25500]), [466, 1094]);
  const vp = vacuumToPlan(cal, [1000, 1200], [{ v: [25500, 25500], p: [3, 3] }, { v: [26500, 25500], p: [3, 2] }], [0, 0]);
  near(apply(vp, [26500, 25500]), [3, 2]);
  // the picture keeps its handedness on the plan
  const ip = compose(vp, invert(cal)!);
  assert.ok(det(ip) > 0);
});

test("robot and dock positions from both integrations", () => {
  const dreameCam = readMapCamera({ calibration_points: dreame, vacuum_position: { x: 120, y: -40, a: 90 }, charger_position: { x: 0, y: 0, a: 180 } });
  assert.deepEqual(dreameCam.robot, { x: 120, y: -40, a: 90 });
  assert.deepEqual(dreameCam.dock, { x: 0, y: 0, a: 180 });
  const xiaomi = readMapCamera({ calibration_points: dreame, vacuum_position: { x: 25000, y: 25100, a: 12 }, charger: { x: 25500, y: 25500 } });
  assert.deepEqual(xiaomi.dock, { x: 25500, y: 25500, a: null });
  assert.equal(readMapCamera(undefined).robot, null);
  assert.equal(readMapCamera({ vacuum_position: { x: "?" } }).robot, null);
});

test("a robot's heading turns with the map", () => {
  const vp: Affine = [0, 0.001, 0.001, 0, 0, 0]; // vacuum x -> plan z, vacuum y -> plan x (a flip)
  const s = spotOnPlan(vp, { x: 1000, y: 2000, a: 0 });
  near(s.at, [2, 1]);
  assert.ok(Math.abs(s.heading! - Math.PI / 2) < 1e-9, "facing +x on the map is facing down the plan");
  assert.equal(spotOnPlan(vp, { x: 0, y: 0, a: null }).heading, null);
});

test("map cameras and the floor's middle", () => {
  assert.equal(isMapCamera("camera.sample_vacuum_map", { calibration_points: [] }), true);
  assert.equal(isMapCamera("camera.sample_door", {}), false);
  assert.equal(isMapCamera("sensor.sample", { calibration_points: [] }), false);
  near(floorCentre([{ points: [[0, 0], [4, 0], [4, 2]] }, { points: [[-2, 6], [0, 6], [0, 8]] }]), [1, 4]);
  near(floorCentre([]), [0, 0]);
});

test("the 3D view shows the maps switched on, on floors that exist; the View offers its switch only for a plan with maps", async () => {
  const { shownMaps } = await import("./vacuum-maps.ts");
  const { viewSections } = await import("./settings/view-settings.ts");
  const b = { floors: [{ id: "f1" }], settings: { vacuum_maps: [
    { id: "a", camera: "camera.sample_vacuum_map", floor_id: "f1" },
    { id: "b", camera: "camera.sample_vacuum_map_1", floor_id: "f1", show: false },
    { id: "c", camera: "camera.sample_other_map", floor_id: "gone" },
  ] } } as never;
  assert.deepEqual(shownMaps(b).map((m) => m.id), ["a"]);
  assert.deepEqual(shownMaps(null), []);
  const rows = (vacuums: boolean, plan2d = false) => viewSections({ floors: 1, floorOpen: false, roof: false, plan2d, kiosk: false, vacuums }).flatMap((s) => s.rows.map((r) => r.id));
  assert.ok(rows(true).includes("vacuum_maps"));
  assert.ok(!rows(false).includes("vacuum_maps"));
  assert.ok(!rows(true, true).includes("vacuum_maps"), "the 2D plan does not draw them");
});
