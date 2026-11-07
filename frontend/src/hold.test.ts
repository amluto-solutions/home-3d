import assert from "node:assert/strict";
import { test } from "node:test";
import { holdTarget } from "./hold.ts";

test("a long press on any device's pin opens that entity's more-info, whatever its kind (#82)", () => {
  for (const id of ["light.sample_lamp", "switch.sample_plug", "cover.sample_blind", "lock.sample_door", "fan.sample_fan", "climate.sample_trv", "camera.sample_door", "sensor.sample_temp", "media_player.sample_tv"]) {
    assert.equal(holdTarget(id), id);
  }
});

test("a long press on a sensor-backed pin opens the sensor behind it (#82)", () => {
  assert.equal(holdTarget("hh:sensor.sample_moisture#plant1"), "sensor.sample_moisture");
  assert.equal(holdTarget("detect:binary_sensor.sample_person"), "binary_sensor.sample_person");
});

test("pins with no single Home Assistant entity behind them have no more-info of their own (#82)", () => {
  for (const id of ["item:f1", "opening:o1", "gangs:f2", "trail:t", "lamp:f3", "module:pool", "grid"]) assert.equal(holdTarget(id), null);
});
