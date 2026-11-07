import assert from "node:assert/strict";
import { test } from "node:test";
import { cheapRate } from "./cheap-rate.ts";
import { DEFAULT_ENERGY } from "./model.ts";
import type { HassEntity } from "./types.ts";

const st = (entity_id: string, state: string): HassEntity => ({ entity_id, state, attributes: {} });
const states = (...list: HassEntity[]) => Object.fromEntries(list.map((s) => [s.entity_id, s]));
const at = (h: number, m = 0) => new Date(2026, 9, 29, h, m);

test("the cheap rate follows the configured binary sensor", () => {
  const energy = { ...DEFAULT_ENERGY, cheap_rate: "binary_sensor.off_peak" };
  assert.equal(cheapRate(energy, states(st("binary_sensor.off_peak", "on")), at(12)), true);
  assert.equal(cheapRate(energy, states(st("binary_sensor.off_peak", "off")), at(12)), false);
});

test("nothing configured: no cheap rate at all (no badge), and an unavailable sensor is not cheap", () => {
  assert.equal(cheapRate(DEFAULT_ENERGY, states(st("binary_sensor.off_peak", "on")), at(2)), null);
  assert.equal(cheapRate({ ...DEFAULT_ENERGY, cheap_rate: "none" }, states(), at(2)), null);
  assert.equal(cheapRate({ ...DEFAULT_ENERGY, cheap_rate: "binary_sensor.off_peak" }, states(st("binary_sensor.off_peak", "unavailable")), at(2)), false);
});

test("a configured daily window: inside it is cheap, over midnight when the start is after the end", () => {
  const energy = { ...DEFAULT_ENERGY, cheap_from: "23:30", cheap_to: "05:30" };
  assert.equal(cheapRate(energy, states(), at(23, 45)), true);
  assert.equal(cheapRate(energy, states(), at(3)), true);
  assert.equal(cheapRate(energy, states(), at(5, 30)), false);
  assert.equal(cheapRate(energy, states(), at(12)), false);
  assert.equal(cheapRate({ ...DEFAULT_ENERGY, cheap_from: "13:00", cheap_to: "16:00" }, states(), at(14)), true);
  // a half-filled window is no window
  assert.equal(cheapRate({ ...DEFAULT_ENERGY, cheap_from: "13:00" }, states(), at(14)), null);
});

test("the entity wins over the window", () => {
  const energy = { ...DEFAULT_ENERGY, cheap_rate: "schedule.cheap", cheap_from: "00:00", cheap_to: "23:59" };
  assert.equal(cheapRate(energy, states(st("schedule.cheap", "off")), at(12)), false);
});
