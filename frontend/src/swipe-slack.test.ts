import assert from "node:assert/strict";
import { test } from "node:test";
import { SWIPE_SLACK, swipePast, swipeValue, swipeWasTap } from "./swipe-slack.ts";

test("a shaky finger on a blind moves nothing and counts as a tap (#1208)", () => {
  assert.equal(swipePast(SWIPE_SLACK), 0);
  assert.equal(swipePast(-SWIPE_SLACK), 0);
  assert.equal(swipeValue(40, 10), 40);
  assert.equal(swipeValue(40, -18), 40);
  assert.equal(swipeWasTap(Math.abs(12)), true);
  assert.equal(swipeWasTap(SWIPE_SLACK), true);
  assert.equal(swipeWasTap(SWIPE_SLACK + 1), false);
});

test("past the slack a swipe moves the value from its edge, up = more, clamped", () => {
  assert.equal(swipePast(SWIPE_SLACK + 22), 22);
  assert.equal(swipePast(-SWIPE_SLACK - 22), -22);
  assert.equal(swipeValue(50, -(SWIPE_SLACK + 110)), 100);
  assert.equal(swipeValue(50, SWIPE_SLACK + 110), 0);
  assert.equal(swipeValue(50, SWIPE_SLACK + 220), 0);
  assert.equal(swipeValue(0, -(SWIPE_SLACK + 44)), 20);
});
