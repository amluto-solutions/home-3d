import assert from "node:assert/strict";
import { test } from "node:test";
import { alignLines, halfSize, itemBox, snapAxis, snapOnWall, snapPoint, snapTolerance, wallGuides, type AlignLines } from "./snap-guides.ts";

const near = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} != ${b}`);

test("the pixel tolerance turns into metres by the zoom (#143)", () => {
  near(snapTolerance(100, 8), 0.08);
  near(snapTolerance(40, 8), 0.2);
  // zoomed in, the same pixels are fewer metres
  assert.ok(snapTolerance(400) < snapTolerance(40));
});

test("a door dragged near the middle of its wall snaps to the middle (#143)", () => {
  const s = snapOnWall(2.04, 0.9, 4, [], 0.08)!;
  assert.equal(s.kind, "mid");
  near(s.offset, 2);
  assert.equal(s.tick, 2);
  // too far away: nothing
  assert.equal(snapOnWall(2.2, 0.9, 4, [], 0.08), null);
});

test("an opening snaps flush with either end of its wall (#143)", () => {
  const start = snapOnWall(0.5, 0.9, 4, [], 0.08)!;
  assert.equal(start.kind, "end");
  near(start.offset, 0.45);
  assert.equal(start.tick, 0);
  const end = snapOnWall(3.53, 0.9, 4, [], 0.08)!;
  assert.equal(end.kind, "end");
  near(end.offset, 3.55);
  assert.equal(end.tick, 4);
});

test("an opening snaps to set distances from a corner (#143)", () => {
  // window 1.2 wide, its side 0.5 m from the wall's start: centre 1.1
  const s = snapOnWall(1.13, 1.2, 5, [], 0.08)!;
  assert.equal(s.kind, "corner");
  near(s.offset, 1.1);
  assert.equal(s.value, 0.5);
  assert.deepEqual(s.spans, [[0, 0.5]]);
  // and from the far end: side at 4.0 on a 5 m wall, 1 m from the corner
  const far = snapOnWall(3.42, 1.2, 5, [], 0.08)!;
  assert.equal(far.kind, "corner");
  near(far.offset, 3.4);
  assert.equal(far.value, 1);
});

test("an opening between two others snaps to equal gaps (#143)", () => {
  // windows at [0.5, 1.5] and [4.5, 5.5] on a 8 m wall; a 1 m window between them centres at 3, gaps 1 m
  const others = [
    { offset: 1, width: 1 },
    { offset: 5, width: 1 },
  ];
  const s = snapOnWall(3.05, 1, 8, others, 0.1)!;
  assert.equal(s.kind, "equal");
  near(s.offset, 3);
  near(s.value!, 1);
  assert.deepEqual(s.spans, [
    [1.5, 2.5],
    [3.5, 4.5],
  ]);
});

test("the gap of the neighbouring pair repeats along the wall (#143)", () => {
  // 0.6 from the wall's start to the first window, then the second dragged 0.6 to the right of the first
  const others = [{ offset: 1.1, width: 1 }];
  const s = snapOnWall(2.67, 1, 10, others, 0.1)!;
  assert.equal(s.kind, "equal");
  near(s.offset, 2.7);
  near(s.value!, 0.6);
  // the repeated stretch and the first one are both drawn
  assert.equal(s.spans.length, 2);
});

test("the nearest wall target wins; at the same distance the middle beats the others (#143)", () => {
  // middle of a 2 m wall for a 1 m door is also flush with nothing; a 2 m door on a 2 m wall: middle == ends
  const s = snapOnWall(1, 2, 2, [], 0.1)!;
  assert.equal(s.kind, "mid");
  // a target the opening would not fit into is never offered
  assert.equal(snapOnWall(0.2, 0.9, 4, [], 0.1), null);
});

test("wall guides: dimension lines off the wall and a cross line at the tick (#143)", () => {
  const g = wallGuides([0, 0], [4, 0], { offset: 2, kind: "mid", spans: [], tick: 2 }, 0.1);
  assert.equal(g.length, 1);
  assert.deepEqual(g[0].a.map((v) => Math.round(v * 1000) / 1000), [2, -0.15]);
  assert.deepEqual(g[0].b.map((v) => Math.round(v * 1000) / 1000), [2, 0.15]);
  const e = wallGuides([0, 0], [4, 0], { offset: 1, kind: "equal", value: 0.5, spans: [[0, 0.5], [1.5, 2]], tick: null }, 0.1);
  assert.equal(e.length, 2);
  assert.equal(e[0].value, 0.5);
  assert.deepEqual(e[1].a, [1.5, 0.1]);
});

test("an item's box covers its turned footprint (#143)", () => {
  const b = itemBox({ x: 1, z: 1, w: 2, d: 1, rotation: 90 });
  near(b.x1 - b.x0, 1);
  near(b.z1 - b.z0, 2);
  const h = halfSize({ x: 0, z: 0, w: 2, d: 1, rotation: 0 });
  near(h[0], 1);
  near(h[1], 0.5);
});

const room = { points: [[0, 0], [6, 0], [6, 4], [0, 4]] as [number, number][] };

test("an item snaps to its room's centre lines (#143)", () => {
  const lines = alignLines([], [room]);
  const s = snapPoint([3.05, 1], [0.5, 0.5], lines, 0.1);
  assert.equal(s.x, true);
  assert.equal(s.z, false);
  near(s.p[0], 3);
  assert.equal(s.guides.length, 1);
  assert.equal(s.guides[0].kind, "room");
  assert.equal(s.guides[0].axis, "x");
});

test("an item aligns its edges and centre with other items (#143)", () => {
  // a table from x 1..2, z 1..2
  const lines = alignLines([{ x0: 1, x1: 2, z0: 1, z1: 2 }], []);
  // a chair 0.4 wide dragged so its left side is at 1.03: aligns with the table's left side
  const edge = snapPoint([1.23, 3], [0.2, 0.2], lines, 0.08);
  near(edge.p[0], 1.2);
  assert.equal(edge.guides[0].kind, "edge");
  // the guide runs along x = 1 from the table to the chair
  assert.deepEqual(edge.guides[0].a, [1, 1]);
  near(edge.guides[0].b[1], 3.2);
  // centre on centre
  const centre = snapPoint([1.52, 3], [0.2, 0.2], lines, 0.08);
  near(centre.p[0], 1.5);
  assert.equal(centre.guides[0].kind, "centre");
});

test("room centre lines (explicit) beat item alignment; far items give no guides (#143)", () => {
  const lines: AlignLines = alignLines([{ x0: 2.96, x1: 3.5, z0: 0, z1: 1 }], [room]);
  // the item's edge at 2.96 is nearer than the room centre (3), but the room centre wins
  const s = snapAxis(3.03, 0.2, 2, 2.4, lines.xs, 0.1);
  assert.equal(s?.line.kind, "room");
  near(s!.v, 3);
  // an item 10 m away on the other axis does not count
  const far = alignLines([{ x0: 1, x1: 2, z0: 20, z1: 21 }], []);
  assert.equal(snapAxis(1.5, 0.2, 0, 1, far.xs, 0.1), null);
});

test("nothing near: the point is unchanged and no guides are made (#143)", () => {
  const lines = alignLines([{ x0: 1, x1: 2, z0: 1, z1: 2 }], []);
  const s = snapPoint([4.5, 3.3], [0.2, 0.2], lines, 0.05);
  assert.deepEqual(s.p, [4.5, 3.3]);
  assert.equal(s.x || s.z, false);
  assert.equal(s.guides.length, 0);
});

test("a room's centre line only counts for an item standing in that room (#143)", () => {
  const lines = alignLines([], [room]);
  // inside the room (z 1 within 0..4): the x centre line takes it
  assert.equal(snapAxis(3.02, 0.2, 0.8, 1.2, lines.xs, 0.1)?.line.kind, "room");
  // the same x but below the room (z 6): the room's line is not its business
  assert.equal(snapAxis(3.02, 0.2, 5.8, 6.2, lines.xs, 0.1), null);
});
