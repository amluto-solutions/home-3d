import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture, Room } from "./model.ts";
import { itemsByRoom, listWindow } from "./item-list.ts";

const room = (id: string, x0: number, z0: number, x1: number, z1: number): Room => ({ id, name: id, area_id: null, points: [[x0, z0], [x1, z0], [x1, z1], [x0, z1]], floor_material: "wood" });
const item = (id: string, x: number, z: number): Furniture => ({ id, type: "box", x, z, rotation: 0, w: 0.2, d: 0.2, h: 0.2, variant: null });

test("items are listed under the smallest room their centre is in, outside ones under null (#75)", () => {
  const hall = room("hall", 0, 0, 10, 10);
  const cupboard = room("cupboard", 1, 1, 2, 2);
  const groups = itemsByRoom([hall, cupboard], [item("a", 5, 5), item("b", 1.5, 1.5), item("c", 20, 20), item("d", 6, 6)]);
  assert.deepEqual(groups.get("hall")?.map((f) => f.id), ["a", "d"]);
  assert.deepEqual(groups.get("cupboard")?.map((f) => f.id), ["b"]);
  assert.deepEqual(groups.get(null)?.map((f) => f.id), ["c"]);
});

test("a long list renders only the rows in view, with spacers keeping the scroll height (#75)", () => {
  // 120 rows of 30 px in a 300 px box scrolled to 600 px: rows 20-29 are visible, 4 extra either side
  assert.deepEqual(listWindow(120, 600, 300, 30, 4), { start: 16, end: 34, before: 480, after: 2580 });
  // at the top
  assert.deepEqual(listWindow(120, 0, 300, 30, 4), { start: 0, end: 14, before: 0, after: 3180 });
  // a short list shows everything
  assert.deepEqual(listWindow(5, 0, 300, 30, 4), { start: 0, end: 5, before: 0, after: 0 });
  // scrolled past the end (the list shrank): clamps to the last rows
  assert.deepEqual(listWindow(10, 5000, 300, 30, 4), { start: 0, end: 10, before: 0, after: 0 });
});
