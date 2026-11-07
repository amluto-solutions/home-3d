import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { makeEditor, planEl, square } from "./editor-harness.ts";

const thermostat = (): Furniture => ({ id: "t", type: "box", x: 2, z: 2, rotation: 0, w: 0.09, d: 0.03, h: 0.1, variant: null });

test("a press just beside a tiny item selects and drags the item, not the room (#72)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [thermostat()]);
  // 100 px/m: the thermostat is 9 x 3 px; press 10 px right of its centre, on the bare room floor element
  ed.press(210, 200, { target: planEl({ "data-room": "r" }) });
  assert.equal(ed._furnitureId, "t");
  assert.equal(ed.drag?.kind, "furniture");
  ed.move(260, 200);
  ed.release(260, 200);
  const room = ed._doc.floors[0].rooms[0];
  assert.deepEqual(room.points[0], [0, 0], "the room did not move");
  assert.ok(ed._doc.floors[0].furniture[0].x > 2.3, "the item moved");
});

test("on touch the tiny item's target is 44 px (#72)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [thermostat()]);
  ed.press(220, 200, { pointerType: "touch", target: planEl({ "data-room": "r" }) });
  assert.equal(ed._furnitureId, "t");
});

test("pressing an unselected room selects it and pans; only a selected room drags (#72)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [thermostat()]);
  ed.press(100, 100, { target: planEl({ "data-room": "r" }) });
  assert.equal(ed._roomId, "r");
  assert.equal(ed.drag?.kind, "pan");
  ed.release(100, 100);
  ed.press(100, 100, { target: planEl({ "data-room": "r" }) });
  assert.equal(ed.drag?.kind, "room");
});

test("with an item selected, a press on its room's floor selects the room without dragging it (#72)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [thermostat()]);
  ed.press(200, 200);
  ed.release(200, 200);
  assert.equal(ed._furnitureId, "t");
  assert.equal(ed._roomId, null);
  ed.selectItem("room", "r");
  ed.selectItem("furniture", "t");
  ed.press(100, 300, { target: planEl({ "data-room": "r" }) });
  assert.equal(ed._furnitureId, null);
  assert.equal(ed._roomId, "r");
  assert.equal(ed.drag?.kind, "pan");
});

const sideboard = (): Furniture => ({ id: "sb", type: "box", x: 2, z: 2, rotation: 0, w: 1.6, d: 0.45, h: 0.8, variant: null });

test("Alt+click picks through stacked items, one deeper per click (#75)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [sideboard(), thermostat()]);
  ed.press(200, 200);
  ed.release(200, 200);
  assert.equal(ed._furnitureId, "t", "the small one on top first");
  ed.press(200, 200, { altKey: true });
  ed.release(200, 200, { altKey: true });
  assert.equal(ed._furnitureId, "sb");
  ed.press(200, 200, { altKey: true });
  ed.release(200, 200, { altKey: true });
  assert.equal(ed._furnitureId, "t", "and round again");
});

test("a thin radiator under a window is pressed through the window's wide tap band; the window's own gap still selects it (#132)", async () => {
  const radiator: Furniture = { id: "trv", type: "box", x: 2, z: 0.05, rotation: 0, w: 1.12, d: 0.1, h: 0.6, variant: null };
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [radiator]);
  ed._doc.floors[0].openings = [{ id: "win", room_id: "r", edge: 0, offset: 2, width: 1.2, type: "window", sill: 0.9, height: 1.2, hinge: "left", leaves: 1, swing: "in", contact: null, contact2: null, cover: null }];
  // 20 px/m: the radiator is 2 px deep; the window's invisible band (26 px) covers it
  ed._view = { scale: 20, ox: 0, oy: 0 };
  ed.press(42, 3, { target: planEl({ "data-opening": "win", class: "fp3d-open-hit" }) });
  ed.release(42, 3);
  assert.equal(ed._furnitureId, "trv");
  assert.equal(ed._openingId, null);
  ed.press(42, -2, { target: planEl({ "data-opening": "win", class: "fp3d-open-gap" }) });
  ed.release(42, -2);
  assert.equal(ed._openingId, "win");
});
