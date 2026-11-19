import assert from "node:assert/strict";
import { test } from "node:test";
import { PerspectiveCamera, Vector3 } from "three";
import { boxEdgeOnScreen, cloudBanks, dayLight, horizonAt, moonPhase, outlineBox, skyColors, skyMode, starField, sunsetGlow } from "./sky.ts";

// #476: the real sky, ported from NeonPlan 3D 3.5.0/3.5.1 (MIT, (c) 2026 Mastershort)

test("the sky's day light follows the sun: night below −8°, full day above 10°", () => {
  assert.equal(dayLight(null), 0);
  assert.equal(dayLight(-20), 0);
  assert.equal(dayLight(30), 1);
  assert.ok(dayLight(0) > 0.3 && dayLight(0) < 0.6);
});

test("the sunset glows with the sun near the horizon, not at noon or deep night", () => {
  assert.ok(sunsetGlow(1) > 0.9);
  assert.equal(sunsetGlow(40), 0);
  assert.equal(sunsetGlow(-20), 0);
});

test("sky colours: dark at night, blue by day, warm horizon at sunset, grey under clouds", () => {
  const night = skyColors(-20, 0);
  const day = skyColors(40, 0);
  const sunset = skyColors(1, 0);
  assert.ok(night.zenith[2] < 40 && day.zenith[2] > 180);
  assert.ok(sunset.horizon[0] > sunset.horizon[2]);
  const grey = skyColors(40, 1);
  assert.ok(grey.zenith[2] - grey.zenith[0] < day.zenith[2] - day.zenith[0]);
});

test("the moon's phase: new moon on 2000-01-06, full about 14.8 days later, the full moon of 24 Nov 2026", () => {
  assert.ok(moonPhase(new Date(Date.UTC(2000, 0, 6, 18, 14))) < 0.01);
  const full = moonPhase(new Date(Date.UTC(2000, 0, 21, 12)));
  assert.ok(Math.abs(full - 0.5) < 0.03, String(full));
  const p = moonPhase(new Date(Date.UTC(2026, 10, 24, 12)));
  assert.ok(Math.abs(p - 0.5) < 0.05, String(p));
  // before the known new moon it still lies in 0…1
  const before = moonPhase(new Date(Date.UTC(1999, 0, 1)));
  assert.ok(before >= 0 && before < 1);
});

test("stars and clouds are the same on every start and lie in the sky", () => {
  assert.deepEqual(starField(20), starField(20));
  for (const s of starField(200)) assert.ok(s.el > 0 && s.el <= 90 && s.az >= 0 && s.az < 360);
  for (const c of cloudBanks(30)) assert.ok(c.el >= 6 && c.el <= 32);
});

test("the Homely day looks paint the whole sky; neon, Day, Realistic and the evening looks get it over their own", () => {
  assert.deepEqual(skyMode({ base: "day", natural: true }), { mode: "full", ownDay: false });
  assert.deepEqual(skyMode({ base: "day", natural: true, dim: 0.5 }), { mode: "overlay", ownDay: false });
  assert.deepEqual(skyMode({ base: "neon" }), { mode: "overlay", ownDay: false });
  assert.deepEqual(skyMode({ base: "day" }), { mode: "overlay", ownDay: false });
  // Realistic colours its own sky by the sun: no second daylight haze over it
  assert.deepEqual(skyMode({ base: "realistic" }), { mode: "overlay", ownDay: true });
});

test("the horizon: low in the picture, about the middle over a look's own sky, never below the map's far edge", () => {
  assert.equal(horizonAt(1000, 0, false, null), 600);
  assert.ok(Math.abs(horizonAt(1000, 1, false, null) - 900) < 1e-6);
  assert.ok(Math.abs(horizonAt(1000, 0, true, null) - 420) < 1e-6);
  // the neighbourhood's far edge a third down the picture: the horizon lies there (upstream #1203)
  assert.equal(horizonAt(1000, 0.5, false, 0.3), 300);
  // an edge further down than the horizon changes nothing
  assert.ok(Math.abs(horizonAt(1000, 0.5, false, 0.95) - 750) < 1e-6);
});

test("the box round the map's outlines", () => {
  assert.equal(outlineBox([]), null);
  assert.deepEqual(
    outlineBox([
      { p: [[1, 2], [5, -3]] },
      { p: [[-4, 8]] },
    ]),
    [-4, -3, 5, 8],
  );
});

test("the map's far edge on the screen: higher the further the map reaches, null behind the camera", () => {
  const cam = new PerspectiveCamera(50, 1, 0.1, 2000);
  cam.position.set(0, 30, 40);
  cam.lookAt(0, 0, 0);
  cam.updateMatrixWorld();
  const on = (v: Vector3, x: number, z: number) => v.set(x, 0, z);
  const near = boxEdgeOnScreen([-10, -10, 10, 10], on, cam)!;
  const far = boxEdgeOnScreen([-300, -300, 300, 300], on, cam)!;
  assert.ok(near > 0 && near < 1, String(near));
  assert.ok(far < near, `${far} < ${near}`);
  // a box wholly behind the camera
  assert.equal(boxEdgeOnScreen([-5, 100, 5, 120], on, cam), null);
});
