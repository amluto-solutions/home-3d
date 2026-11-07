import assert from "node:assert/strict";
import { test } from "node:test";
import { GeoBuffer } from "./geo.ts";
import { pushLampModel } from "./viewer3d.ts";

test("an LED strip rising along its length climbs from one end to the other (D539)", () => {
  const buf = new GeoBuffer();
  // 2 m long along x, its middle at 1.5 m, rising 30°
  pushLampModel(buf, { lamp: "strip", x: 0, z: 0, size: [2, 0.03, 0.02], base: 1.5, rotation: 0, variant: null, roll: 0, upright: false, rise: 30 }, 2.5, 0xffffff);
  const p = buf.p;
  let lowEnd = Infinity;
  let highEnd = -Infinity;
  for (let i = 0; i < p.length; i += 3) {
    if (p[i] < -0.8) lowEnd = Math.min(lowEnd, p[i + 1]);
    if (p[i] > 0.8) highEnd = Math.max(highEnd, p[i + 1]);
  }
  // the ends lie about ±0.5 m (sin 30° × 1 m) below and above the middle
  assert.ok(lowEnd < 1.1 && lowEnd > 0.9, `low ${lowEnd}`);
  assert.ok(highEnd > 1.95 && highEnd < 2.1, `high ${highEnd}`);
});
