import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { makeEditor, square } from "./editor-harness.ts";

const item = (id: string, x: number, z: number, w = 0.3, d = 0.3): Furniture => ({ id, type: "box", x, z, rotation: 0, w, d, h: 0.3, variant: null });
const rooms = () => [square("r1", 0, 0, 3, 3), square("r2", 3, 0, 6, 3)];

test("Tab cycles through the items of the selected item's room, Shift+Tab backwards (#75)", async () => {
  const ed = await makeEditor(rooms(), [item("a", 1, 1), item("c", 4, 1), item("b", 2, 2)]);
  ed.selectItem("furniture", "a");
  assert.equal(ed.key("Tab").prevented, true);
  assert.equal(ed._furnitureId, "b");
  ed.key("Tab");
  assert.equal(ed._furnitureId, "a", "round again, staying in room r1");
  ed.key("Tab", { shiftKey: true });
  assert.equal(ed._furnitureId, "b");
});

test("Tab with no item selected leaves the keyboard alone (#75)", async () => {
  const ed = await makeEditor(rooms(), [item("a", 1, 1)]);
  assert.equal(ed.key("Tab").prevented, false);
  assert.equal(ed._furnitureId, null);
});

test("a hidden item is not drawn, not picked and skipped by Tab; showing it again brings it back (#75)", async () => {
  const ed = await makeEditor(rooms(), [item("a", 1, 1), item("lid", 2, 2, 0.1, 0.1), item("b", 2, 2)]);
  ed.toggleItemHidden("lid");
  ed.press(200, 200);
  ed.release(200, 200);
  assert.equal(ed._furnitureId, "b", "the item under the hidden one");
  ed.key("Tab");
  assert.equal(ed._furnitureId, "a");
  ed.toggleItemHidden("lid");
  ed.press(200, 200);
  ed.release(200, 200);
  assert.equal(ed._furnitureId, "lid");
});

test("hiding the selected item drops the selection (#75)", async () => {
  const ed = await makeEditor(rooms(), [item("a", 1, 1)]);
  ed.selectItem("furniture", "a");
  ed.toggleItemHidden("a");
  assert.equal(ed._furnitureId, null);
});

test("choosing an item from the list moves the plan only when the item is out of view (#75)", async () => {
  const ed = await makeEditor(rooms(), [item("near", 2, 2), item("far", 20, 20)]);
  const before = { ...ed._view };
  ed.selectFromList("near");
  assert.equal(ed._furnitureId, "near");
  assert.deepEqual(ed._view, before, "already visible: no jump");
  ed.selectFromList("far");
  assert.equal(ed._furnitureId, "far");
  const [sx, sy] = ed.toScreen([20, 20]);
  assert.ok(sx > 0 && sx < 800 && sy > 0 && sy < 600, "brought into view");
});

test("deleting from the list removes that item (#75)", async () => {
  const ed = await makeEditor(rooms(), [item("a", 1, 1), item("b", 2, 2)]);
  await ed.deleteFromList("a");
  assert.deepEqual(ed._doc.floors[0].furniture.map((f: Furniture) => f.id), ["b"]);
});

test("changing an item's type in the panel takes the new type's size, one undo step (#132)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [{ id: "s", type: "sofa", x: 2, z: 2, rotation: 0, w: 2.2, d: 0.9, h: 0.82, variant: null }]);
  ed.selectItem("furniture", "s");
  ed.retypeFurniture("bed");
  const f = ed._doc.floors[0].furniture[0];
  assert.deepEqual([f.type, f.w, f.d, f.h], ["bed", 1.6, 2.05, 0.9]);
  ed.undo();
  assert.equal(ed._doc.floors[0].furniture[0].type, "sofa");
});
