import assert from "node:assert/strict";
import { mock, test } from "node:test";
import { Gestures, type GestureEvents } from "./gestures.ts";

/** Gestures on a fake clock, recording what they report. */
function rig(swipes: string[] = []) {
  let now = 1000;
  const seen: unknown[][] = [];
  const events: GestureEvents = {
    tap: (x, y, target) => void seen.push(["tap", x, y, target]),
    doubleTap: (x, y, target) => void seen.push(["double", x, y, target]),
    hold: (x, y, target) => void seen.push(["hold", x, y, target]),
    pan: (dx, dy) => void seen.push(["pan", dx, dy]),
    zoom: (k, x, y) => void seen.push(["zoom", Math.round(k * 100) / 100, x, y]),
    swipeStart: (target) => swipes.includes(target),
    swipeMove: (target, dy) => void seen.push(["swipe", target, dy]),
    swipeEnd: (target) => void seen.push(["swipe-end", target]),
  };
  const g = new Gestures(events, () => now);
  return {
    g,
    seen,
    wait(ms: number) {
      now += ms;
      mock.timers.tick(ms);
    },
  };
}

test.beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
test.afterEach(() => mock.timers.reset());

test("a short press without moving is a tap on what lies under the finger", () => {
  const { g, seen, wait } = rig();
  g.down(1, 50, 60, "light.lamp");
  wait(120);
  g.up(1, 51, 60);
  assert.deepEqual(seen, [["tap", 50, 60, "light.lamp"]]);
});

test("a second tap soon after is a double tap, not another tap (as in 3D)", () => {
  const { g, seen, wait } = rig();
  g.down(1, 50, 60, "item:a");
  wait(80);
  g.up(1, 50, 60);
  wait(150);
  g.down(1, 52, 61, "item:a");
  wait(80);
  g.up(1, 52, 61);
  assert.deepEqual(seen, [
    ["tap", 50, 60, "item:a"],
    ["double", 52, 61, "item:a"],
  ]);
  // a third tap much later is a tap again
  wait(1000);
  g.down(1, 52, 61, null);
  g.up(1, 52, 61);
  assert.deepEqual(seen.at(-1), ["tap", 52, 61, null]);
});

test("holding still for half a second is a hold, and letting go after it is no tap", () => {
  const { g, seen, wait } = rig();
  g.down(1, 10, 20, "camera.drive");
  wait(499);
  assert.deepEqual(seen, []);
  wait(2);
  g.up(1, 10, 20);
  assert.deepEqual(seen, [["hold", 10, 20, "camera.drive"]]);
});

test("a drag moves the plan instead of tapping or holding", () => {
  const { g, seen, wait } = rig();
  g.down(1, 100, 100, "light.lamp");
  g.move(1, 104, 100);
  g.move(1, 120, 90);
  g.move(1, 130, 95);
  wait(600);
  g.up(1, 130, 95);
  assert.deepEqual(seen, [
    ["pan", 20, -10],
    ["pan", 10, 5],
  ]);
});

test("two fingers zoom around the point between them", () => {
  const { g, seen } = rig();
  g.down(1, 100, 100, null);
  g.down(2, 200, 100, null);
  g.move(2, 300, 100);
  g.up(2, 300, 100);
  g.up(1, 100, 100);
  assert.deepEqual(seen, [
    ["zoom", 2, 200, 100],
    ["pan", 50, 0],
  ]);
});

test("a drag up or down on a device that takes swipes dims or moves it instead of the plan", () => {
  const { g, seen } = rig(["light.dimmer"]);
  g.down(1, 100, 100, "light.dimmer");
  g.move(1, 100, 92);
  g.move(1, 101, 70);
  g.up(1, 101, 70);
  assert.deepEqual(seen, [
    ["swipe", "light.dimmer", -8],
    ["swipe", "light.dimmer", -30],
    ["swipe-end", "light.dimmer"],
  ]);
});
