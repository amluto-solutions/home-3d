import assert from "node:assert/strict";
import { test } from "node:test";
import type { Floor, OutdoorArea } from "../model.ts";
import { newFloor, outdoorGround } from "../model.ts";
import { GeoBuffer, LineBuffer } from "./geo.ts";
import { pushOutdoor } from "./outdoor.ts";

// Ported from NeonPlan 3D 4.0.1 (MIT, Mastershort).
test("a hedge on falling ground reaches down to the lawn under it, so no underside shows (#1262)", () => {
  // a lawn 10 x 6 that falls 0.8 m towards its z = 6 edge, with a hedge standing on its low half
  const lawn: OutdoorArea = { id: "l", type: "lawn", points: [[0, 0], [10, 0], [10, 6], [0, 6]], slope: 0.8, slope_dir: "z" };
  const hedge: OutdoorArea = { id: "h", type: "hedge", points: [[1, 4], [9, 4], [9, 4.5], [1, 4.5]], height: 1.2 };
  const floor: Floor = { ...newFloor("eg", "Garden", 0), outdoor: [lawn, hedge] };
  const ground = Math.min(...hedge.points.map(([x, z]) => outdoorGround(floor, x, z)));
  assert.ok(ground < -0.55, `the lawn under the hedge falls to ${ground}`);

  const buf = new GeoBuffer();
  pushOutdoor(buf, new LineBuffer(), floor);
  const ys: number[] = [];
  for (let i = 0; i < buf.p.length; i += 3) {
    const x = buf.p[i];
    const z = buf.p[i + 2];
    if (x >= 0.9 && x <= 9.1 && z >= 3.9 && z <= 4.6) ys.push(buf.p[i + 1]);
  }
  assert.ok(ys.length > 0);
  // the hedge's foot sits in the lawn, not above it: no underside can show from the low side
  assert.ok(Math.min(...ys) <= ground, `hedge foot ${Math.min(...ys)} should reach ${ground}`);
  // and the hedge still stands its full height over its own ground (nothing was pulled down with the foot)
  assert.ok(Math.max(...ys) - Math.min(...ys) > 1.2);
});
