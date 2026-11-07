import assert from "node:assert/strict";
import { test } from "node:test";
import { sunArcStretch, sunPath, sunPosition } from "./sun-path.ts";

// Berlin, midsummer: the sun stands about 61° high in the south at noon and rises in the north-east before 5:00 local time
const BERLIN: [number, number] = [52.52, 13.405];

test("the sun at midsummer noon over Berlin", () => {
  // solar noon in Berlin is about 11:07 UTC
  const p = sunPosition(Date.UTC(2026, 5, 21, 11, 7), ...BERLIN);
  assert.ok(Math.abs(p.elevation - 60.9) < 0.5, String(p.elevation));
  assert.ok(Math.abs(p.azimuth - 180) < 2, String(p.azimuth));
  // in the evening it stands in the west-north-west
  const eve = sunPosition(Date.UTC(2026, 5, 21, 18, 0), ...BERLIN);
  assert.ok(eve.azimuth > 270 && eve.azimuth < 310 && eve.elevation > 0 && eve.elevation < 15, JSON.stringify(eve));
});

test("the day's path runs from sunrise to sunset above the horizon", () => {
  const path = sunPath(Date.UTC(2026, 5, 21, 11, 0), ...BERLIN);
  assert.ok(path.rise && path.set);
  // sunrise about 02:43 UTC, sunset about 19:33 UTC (whatever the browser's time zone)
  assert.ok(Math.abs(path.rise.t - Date.UTC(2026, 5, 21, 2, 43)) < 5 * 60_000, new Date(path.rise.t).toISOString());
  assert.ok(Math.abs(path.set.t - Date.UTC(2026, 5, 21, 19, 33)) < 5 * 60_000, new Date(path.set.t).toISOString());
  assert.ok(path.rise.azimuth > 40 && path.rise.azimuth < 60, String(path.rise.azimuth));
  assert.equal(path.points[0], path.rise);
  assert.equal(path.points.at(-1), path.set);
  assert.ok(path.points.every((p, i) => i === 0 || p.t > path.points[i - 1].t));
  assert.ok(path.points.slice(1, -1).every((p) => p.elevation > -0.9));
});

test("no sunrise in the polar night", () => {
  const path = sunPath(Date.UTC(2026, 11, 21, 12, 0), 78.2, 15.6);
  assert.equal(path.rise, null);
  assert.equal(path.points.length, 0);
});

test("the drawn sun path clears the highest roof by default and never lowers (#319)", () => {
  // a winter sun 15 degrees high over a 9 m house, dome radius 8 m: the dome's top is 2.1 m up as it was
  const r = 8;
  const k = sunArcStretch("auto", 15, r, 9);
  assert.ok(Math.sin((15 * Math.PI) / 180) * r * k >= 10 - 1e-9, "the top of the path is 1 m over the roof");
  assert.ok(k > 1 && k <= 10);
  // a high summer sun over a low house needs no stretch
  assert.equal(sunArcStretch("auto", 60, 12, 3), 1);
  // "higher" goes half as far again; "real" keeps the old height; a polar day's tiny peak is capped
  assert.ok(sunArcStretch("high", 15, r, 9) > k);
  assert.equal(sunArcStretch("real", 15, r, 9), 1);
  assert.equal(sunArcStretch("auto", 0, 8, 12), 10);
});
