import assert from "node:assert/strict";
import { test } from "node:test";
import { flight, flightA, flightB, twoFloors } from "./stair-fixture.ts";
import { stairLinks } from "./stair-links.ts";

test("two flights that meet join into one way that turns the corner and reaches the floor above", () => {
  const links = stairLinks(twoFloors(flightA(), flightB()));
  assert.equal(links.length, 1);
  const [l] = links;
  assert.equal(l.lower, "ground");
  assert.equal(l.upper, "upper");
  const hs = l.pts.map((p) => p[1]);
  assert.equal(hs[0], 0);
  assert.ok(Math.abs(hs[hs.length - 1] - 2.75) < 1e-9, "ends at the floor above");
  assert.ok(hs.some((h) => Math.abs(h - 0.55) < 1e-9), "passes the turn at the height of the first flight's top");
  assert.ok(hs.every((h, i) => !i || h >= hs[i - 1]), "never goes down");
  // first flight runs along x (rotation 90), the second along z: the way turns
  assert.ok(Math.abs(l.pts[0][2] - 11.688) < 1e-9 && l.pts[0][0] < l.pts[1][0]);
  assert.ok(Math.abs(l.pts[l.pts.length - 1][0] - 7.7) < 1e-9 && l.pts[l.pts.length - 1][2] < l.pts[l.pts.length - 2][2]);
  // the order of the items does not matter
  assert.equal(stairLinks(twoFloors(flightB(), flightA())).length, 1);
});

test("a short flight alone does not take you to the floor above", () => {
  assert.equal(stairLinks(twoFloors(flightA())).length, 0);
  // nor the second flight on its own (it does not start on the floor)
  assert.equal(stairLinks(twoFloors(flightB())).length, 0);
});

test("a single full-height flight is as before", () => {
  const links = stairLinks(twoFloors(flight("s", 7, 11, 0, 1, 3, 2.75)));
  assert.equal(links.length, 1);
  const p = links[0].pts;
  assert.deepEqual(p.map((q) => q[1]), [0, 2.75]);
  assert.deepEqual([p[0][0], p[0][2], p[1][0], p[1][2]], [7, 12.5, 7, 9.5]);
});

test("a lone stair a bit short of the floor-to-floor height still links, ending at the floor above", () => {
  const links = stairLinks(twoFloors(flight("s", 7, 11, 0, 1, 3, 2.5)));
  assert.equal(links.length, 1);
  assert.deepEqual(links[0].pts.map((q) => q[1]), [0, 2.75]);
});
