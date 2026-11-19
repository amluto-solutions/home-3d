import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { FLYIN, flyInAllowed, flyInFrame, globePoint } from "./fly-in.ts";
import { SETTINGS } from "../settings/registry.ts";
import type { SettingsEnv } from "../settings/registry.ts";

test("the globe shows the point it is turned to in its middle, the far side not at all", () => {
  const p = globePoint(53.7, 7.5, 53.7, 7.5)!;
  assert.ok(Math.abs(p[0]) < 1e-9 && Math.abs(p[1]) < 1e-9);
  assert.equal(globePoint(-53.7, -172.5, 53.7, 7.5), null);
  // a place east of the middle lies to the right, a place north of it above
  assert.ok(globePoint(53.7, 20, 53.7, 7.5)![0] > 0);
  assert.ok(globePoint(60, 7.5, 53.7, 7.5)![1] > 0);
});

test("the timeline: the globe turns, the camera comes down while it dives, then it fades and ends", () => {
  const { turn, dive, fade } = FLYIN;
  const start = flyInFrame(0);
  assert.deepEqual([start.k, start.d, start.out, start.dive, start.done], [0, 0, 0, false, false]);
  assert.equal(flyInFrame(turn).k, 1);
  assert.equal(flyInFrame(turn - 1).dive, false);
  // the 3D flight starts while the globe dives, before the canvas fades
  const mid = flyInFrame(turn + dive * 0.6);
  assert.ok(mid.dive && mid.d > 0 && mid.d < 1 && mid.out === 0 && !mid.done);
  const fading = flyInFrame(turn + dive + fade / 2);
  assert.ok(fading.out > 0.4 && fading.out < 0.6 && !fading.done);
  assert.equal(flyInFrame(turn + dive + fade + 1).done, true);
});

test("it plays only where it may: a place, no reduced motion, not the tablet level, time travel, flat plan or editor", () => {
  const ok = { lat: 53.7, lon: 7.5, low: false, readOnly: false, walkable: true, plain: false, paced: false, reducedMotion: false };
  assert.equal(flyInAllowed(ok), true);
  assert.equal(flyInAllowed({ ...ok, lat: undefined }), false);
  assert.equal(flyInAllowed({ ...ok, lon: "7.5" }), false);
  assert.equal(flyInAllowed({ ...ok, lat: NaN }), false);
  assert.equal(flyInAllowed({ ...ok, lat: 123 }), false);
  for (const off of [{ low: true }, { readOnly: true }, { walkable: false }, { plain: true }, { paced: true }, { reducedMotion: true }]) {
    assert.equal(flyInAllowed({ ...ok, ...off }), false, JSON.stringify(off));
  }
});

test("the setting is off by default, sits right below Real sky and is stored as `flyin`", () => {
  const ids = SETTINGS.map((s) => s.id);
  assert.equal(ids.indexOf("flyin"), ids.indexOf("sky") + 1);
  const s = SETTINGS.find((x) => x.id === "flyin")!;
  assert.equal(s.default, false);
  assert.equal(s.card, SETTINGS.find((x) => x.id === "sky")!.card);
  const building = { settings: {} } as unknown as NonNullable<SettingsEnv["building"]>;
  const env = { building } as SettingsEnv;
  assert.equal(s.read(env), false);
  const next = s.write!(env, true) as { settings: { flyin?: boolean } };
  assert.equal(next.settings.flyin, true);
  assert.equal(building.settings.flyin, undefined);
});

test("no outside host, no download and no image: the globe is drawn in code", () => {
  const src = readFileSync(new URL("./fly-in.ts", import.meta.url), "utf8");
  assert.ok(!/https?:\/\//.test(src.replace(/\/\/ .*$/gm, "")));
  assert.ok(!/fetch\(|new Image|XMLHttpRequest|import\(/.test(src));
});
