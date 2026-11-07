import assert from "node:assert/strict";
import { test } from "node:test";
import { flowSpeed, flowWidth } from "./flow-style.ts";

test("a cable carrying nothing stands still and stays thin", () => {
  assert.equal(flowSpeed(0), 0);
  assert.equal(flowWidth(0), 0.6);
});

test("thickness and speed grow with the watts, up to a limit", () => {
  const watts = [50, 300, 1000, 3000, 7000];
  for (let i = 1; i < watts.length; i++) {
    assert.ok(flowWidth(watts[i]) > flowWidth(watts[i - 1]), `wider at ${watts[i]} W`);
    assert.ok(flowSpeed(watts[i]) > flowSpeed(watts[i - 1]), `faster at ${watts[i]} W`);
  }
  // a car charging at 11 kW is no wider than one at 22 kW: the cable keeps within the floor
  assert.equal(flowWidth(11000), 2.4);
  assert.equal(flowWidth(22000), 2.4);
  assert.equal(flowSpeed(22000), 2.4);
});
