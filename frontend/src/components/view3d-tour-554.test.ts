// A tour through the house (a module's answer): each stop's words stand in the picture, and an opening is looked at
// from above, more steeply in a shallow room (#554).

import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Building, type Opening } from "../model.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any> } };

/** One room 5 m wide and `depth` m deep with a window in its first wall. */
function house(depth: number): Building {
  const b = emptyBuilding();
  const floor = newFloor("g", "Ground", 0);
  floor.rooms = [{ id: "r", name: "Room", area_id: null, points: [[0, 0], [5, 0], [5, depth], [0, depth]], floor_material: "wood" }];
  floor.openings = [{ id: "w", room_id: "r", edge: 0, offset: 2.5, width: 1, type: "window", sill: 0.9, height: 1.2, hinge: "left", leaves: 1, swing: "in", cover: null, contact: null, contact2: null, tilt: null } as Opening];
  b.floors = [floor];
  return b;
}

test("an opening knows how far its room reaches in front of it (#554)", () => {
  const el = new Fp3dView3d();
  assert.ok(Math.abs(el.openingSpot(house(8), "w").depth - 8) < 1e-6);
  assert.ok(Math.abs(el.openingSpot(house(2), "w").depth - 2) < 1e-6);
});

test("a tour shows each stop's words with its number, looks from higher up in a shallow room, and clears (#554)", async () => {
  const shown: ({ text: string; step: string } | null)[] = [];
  const views: { radius: number; phi: number }[] = [];
  for (const depth of [12, 2]) {
    const el = new Fp3dView3d();
    el.floorId = "g";
    el.renderRoot = { querySelector: () => null };
    el.viewer = { focus: (...a: any[]) => (views.push(a[5]), shown.push(el._tourStop)) };
    const realTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((f: () => void) => realTimeout(f, 0)) as typeof setTimeout;
    try {
      await el.runTour([{ openingId: "w", say: "The window is open" }, { openingId: "w", say: "Still open" }], house(depth), new Map(), null);
    } finally {
      globalThis.setTimeout = realTimeout;
    }
    assert.equal(el._tourStop, null);
  }
  assert.deepEqual(shown.slice(0, 2), [{ text: "The window is open", step: "1 / 2" }, { text: "Still open", step: "2 / 2" }]);
  assert.equal(views[0].radius, 6.5);
  assert.equal(views[0].phi, 0.72);
  // 2 m deep: steeper than the deep room, held at the steepest the rule allows
  assert.ok(Math.abs(views[2].phi - Math.asin(0.3)) < 1e-9, `shallow room: ${views[2].phi}`);
});
