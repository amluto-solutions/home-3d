import assert from "node:assert/strict";
import { test } from "node:test";
import { IdleClock, nightActive, tabletIdleSeconds, tabletMode } from "./kiosk.ts";
import type { HomeAssistant } from "./types.ts";

const at = (h: number, m = 0) => new Date(2026, 0, 1, h, m);

test("night dimming follows the sun or a time range that may cross midnight", () => {
  const hass = { states: { "sun.sun": { entity_id: "sun.sun", state: "below_horizon", attributes: {} } } } as unknown as HomeAssistant;
  assert.equal(nightActive("off", hass), false);
  assert.equal(nightActive(undefined, hass), false);
  assert.equal(nightActive("sun", hass), true);
  hass.states["sun.sun"].state = "above_horizon";
  assert.equal(nightActive("sun", hass), false);
  assert.equal(nightActive("22:00-06:00", hass, at(23)), true);
  assert.equal(nightActive("22:00-06:00", hass, at(3, 30)), true);
  assert.equal(nightActive("22:00-06:00", hass, at(6)), false);
  assert.equal(nightActive("22:00-06:00", hass, at(12)), false);
  assert.equal(nightActive("13:00-14:00", hass, at(13, 30)), true);
  assert.equal(nightActive("13:00-14:00", hass, at(14)), false);
  assert.equal(nightActive("garbage", hass, at(13)), false);
});

test("tablet mode comes from ?tablet in the address or from the signed-in user's tick, and ?tablet=0 overrides the tick (#92)", () => {
  assert.equal(tabletMode("", "u1", undefined), false);
  assert.equal(tabletMode("?tablet", "u1", undefined), true);
  assert.equal(tabletMode("?view=2d&tablet=1", undefined, []), true);
  assert.equal(tabletMode("", "wall", ["wall"]), true);
  assert.equal(tabletMode("", "admin", ["wall"]), false);
  assert.equal(tabletMode("?tablet=0", "wall", ["wall"]), false);
  assert.equal(tabletMode("?tablet=off", "wall", ["wall"]), false);
});

test("the tablet's idle return takes ?idle= first, then the plan setting, else two minutes; 0 means never (#92)", () => {
  assert.equal(tabletIdleSeconds("", undefined), 120);
  assert.equal(tabletIdleSeconds("", 45), 45);
  assert.equal(tabletIdleSeconds("?tablet&idle=30", 45), 30);
  assert.equal(tabletIdleSeconds("?idle=0", 45), 0);
  assert.equal(tabletIdleSeconds("", 0), 0);
  assert.equal(tabletIdleSeconds("?idle=soon", 45), 45);
  assert.equal(tabletIdleSeconds("?idle=-5", undefined), 120);
});

test("the idle clock fires once after the quiet spell, a touch restarts it, 0 seconds or stop() keep it quiet (#92)", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let fired = 0;
  const clock = new IdleClock(() => fired++);
  clock.arm(10);
  t.mock.timers.tick(9000);
  clock.touch();
  t.mock.timers.tick(9000);
  assert.equal(fired, 0);
  t.mock.timers.tick(1000);
  assert.equal(fired, 1);
  t.mock.timers.tick(60000);
  assert.equal(fired, 1, "it does not repeat until touched again");
  clock.touch();
  clock.stop();
  t.mock.timers.tick(60000);
  assert.equal(fired, 1);
  clock.arm(0);
  clock.touch();
  t.mock.timers.tick(60000);
  assert.equal(fired, 1);
});
