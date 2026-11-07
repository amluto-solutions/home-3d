import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { altPick, firmHit, itemsAt, minHitPx } from "./pick.ts";

const item = (id: string, x: number, z: number, w: number, d: number, rotation = 0): Furniture => ({ id, type: "box", x, z, rotation, w, d, h: 0.5, variant: null });

test("a tiny item is hit within a 24 px target, 44 px on touch (#72)", () => {
  // a 9 x 3 cm thermostat at 50 px/m is 4.5 x 1.5 px on screen
  const thermostat = item("t", 2, 2, 0.09, 0.03);
  assert.equal(minHitPx("mouse"), 24);
  assert.equal(minHitPx("pen"), 24);
  assert.equal(minHitPx("touch"), 44);
  // 10 px from its centre: inside a 24 px target (12 px each side), outside the drawn shape
  assert.deepEqual(itemsAt([thermostat], [2 + 10 / 50, 2], 50, 24), ["t"]);
  // 15 px away: outside 24 px, inside 44 px
  assert.deepEqual(itemsAt([thermostat], [2 + 15 / 50, 2], 50, 24), []);
  assert.deepEqual(itemsAt([thermostat], [2 + 15 / 50, 2], 50, 44), ["t"]);
});

test("a turned item is hit along its own axes (#72)", () => {
  const bench = item("b", 0, 0, 2, 0.4, 90);
  // turned 90 degrees: 2 m long along z, 0.4 m along x
  assert.deepEqual(itemsAt([bench], [0, 0.9], 100, 24), ["b"]);
  assert.deepEqual(itemsAt([bench], [0.9, 0], 100, 24), []);
});

test("stacked items: the smallest drawn shape under the point comes first, padded targets after real hits (#72)", () => {
  const sideboard = item("sb", 2, 2, 1.6, 0.45);
  const thermostat = item("t", 2, 2, 0.09, 0.03);
  const lamp = item("l", 2.5, 2, 0.2, 0.2);
  // on the thermostat itself: the thermostat, then the sideboard under it
  assert.deepEqual(itemsAt([thermostat, sideboard, lamp], [2, 2], 50, 24), ["t", "sb"]);
  // on the sideboard 8 px beside the thermostat: the sideboard was pressed, the thermostat's padding comes second
  assert.deepEqual(itemsAt([sideboard, thermostat], [2 + 8 / 50, 2], 50, 24), ["sb", "t"]);
});

test("items can be left out of the hit test, e.g. hidden in the editor (#72)", () => {
  const a = item("a", 0, 0, 1, 1);
  assert.deepEqual(itemsAt([a], [0, 0], 50, 24, (f) => f.id === "a"), []);
});

test("Alt on a stack grabs the selected item and keeps the next one for a click without moving (#125)", () => {
  const hits = ["lamp", "sb", "rug"];
  // the selected item is under the press: drag it; a plain click goes on to the next
  assert.deepEqual(altPick(hits, ["sb"], "sb"), { grab: "sb", next: "rug" });
  assert.deepEqual(altPick(hits, ["rug"], "rug"), { grab: "rug", next: "lamp" });
  // a block: the selected part under the press is grabbed
  assert.deepEqual(altPick(hits, ["sb", "tv"], "tv"), { grab: "sb", next: "rug" });
  // nothing of the stack selected: the top item, as a plain press
  assert.deepEqual(altPick(hits, ["chair"], "chair"), { grab: "lamp", next: null });
  assert.deepEqual(altPick([], ["sb"], "sb"), { grab: null, next: null });
  // a single item: nothing to cycle to
  assert.deepEqual(altPick(["sb"], ["sb"], "sb"), { grab: "sb", next: null });
});

test("a thin item (a TRV radiator 2 px deep on screen) is pressed through its grown depth, even over a bed in front (#132)", () => {
  // 1.12 x 0.1 m radiator against a wall at 20 px/m: 22 x 2 px; a bed right in front of it
  const radiator = item("trv", 2, 0.05, 1.12, 0.1);
  const bed = item("bed", 2, 1.13, 1.6, 2.05);
  // 6 px into the bed, along the radiator's length: the radiator, then the bed under the press
  assert.deepEqual(itemsAt([bed, radiator], [2.2, 0.05 + 6 / 20], 20, 24), ["trv", "bed"]);
  assert.equal(firmHit(radiator, [2.2, 0.05 + 6 / 20], 20, 24), true);
  // beyond its length the grown depth does not count as its own shape
  assert.equal(firmHit(radiator, [2 + 0.56 + 6 / 20, 0.05], 20, 24), false);
  // a tiny item (thin both ways) keeps #72's order: the bigger item pressed comes first
  const thermostat = item("t", 2, 1.5, 0.09, 0.03);
  assert.deepEqual(itemsAt([bed, thermostat], [2 + 8 / 20, 1.5], 20, 24), ["bed", "t"]);
});
