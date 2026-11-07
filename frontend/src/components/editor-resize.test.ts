import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Furniture, type Vec2 } from "../model.ts";

// the editor's bundle hashes are build-time constants: plain strings will do here
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dEditor } = (await import("./editor.ts")) as unknown as { Fp3dEditor: new () => Record<string, any> };

const rect = (x0: number, z0: number, x1: number, z1: number): Vec2[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

/** An editor with a 5 x 4 m bedroom (selected) whose bed stands by the east wall, and a hall beyond that wall. */
function editor() {
  const b = emptyBuilding();
  const floor = newFloor("f", "Ground", 0);
  floor.rooms.push({ id: "r", name: "Bedroom", area_id: null, points: rect(0, 0, 5, 4), floor_material: "wood" });
  floor.rooms.push({ id: "n", name: "Hall", area_id: null, points: rect(5, 0, 8, 4), floor_material: "wood" });
  floor.furniture.push({ id: "bed", type: "bed", x: 4.5, z: 2, w: 1.4, d: 2, h: 0.5, rotation: 0 } as Furniture);
  b.floors.push(floor);
  const el = new Fp3dEditor();
  el._doc = b;
  el._floorId = "f";
  el.canEdit = true;
  el._roomId = "r";
  el._view = { scale: 50, ox: 100, oy: 100 };
  el.renderRoot = { activeElement: null, querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) };
  return el;
}

const floor = (el: Record<string, any>) => el._doc.floors[0];
const bedX = (el: Record<string, any>) => floor(el).furniture[0].x;

test("narrowing a rectangular room by its width field carries the bed and the hall's wall, with one undo step (#64)", () => {
  const el = editor();
  el.setRect("w", 4);
  assert.equal(bedX(el), 3.5);
  assert.deepEqual(floor(el).rooms[1].points, rect(4, 0, 8, 4));
  assert.deepEqual(el.resizeNote()?.carried, { furniture: 1, devices: 0, walls: 1 });
  el.undo();
  assert.equal(bedX(el), 4.5);
  assert.deepEqual(floor(el).rooms[0].points, rect(0, 0, 5, 4));
});

test("'Outline only' keeps the new outline but puts the contents and the neighbour back, then flags the bed left outside (#64)", () => {
  const el = editor();
  el.setRect("w", 4);
  el.outlineOnly();
  assert.deepEqual(floor(el).rooms[0].points, rect(0, 0, 4, 4));
  assert.equal(bedX(el), 4.5);
  assert.deepEqual(floor(el).rooms[1].points, rect(5, 0, 8, 4));
  assert.deepEqual(el.resizeNote()?.stranded, { furniture: ["bed"], devices: [] });
  // still one undo step back to before the resize
  el.undo();
  assert.deepEqual(floor(el).rooms[0].points, rect(0, 0, 5, 4));
  assert.equal(el.resizeNote(), null);
});

test("moving a corner leaves the contents where they are and offers to select what is now outside (#64)", () => {
  const el = editor();
  el._vertex = 1;
  el.drag = { kind: "vertex", roomId: "r", index: 1, base: el._doc, moved: false };
  el.change((_: unknown, f: any) => (f.rooms[0].points[1] = [3, 0]), el._doc, false);
  el.drag.moved = true;
  el.onPointerUp({ pointerId: 1, button: 0, type: "pointerup", clientX: 250, clientY: 100 });
  assert.equal(bedX(el), 4.5);
  assert.deepEqual(el.resizeNote()?.stranded, { furniture: ["bed"], devices: [] });
  el.selectStranded();
  assert.equal(el._furnitureId, "bed");
});

test("a typed corner position flags stranded items too, and the flag goes once anything else changes (#64)", () => {
  const el = editor();
  el.setPoint(1, 0, 3);
  el.setPoint(2, 0, 3);
  assert.deepEqual(el.resizeNote()?.stranded.furniture, ["bed"]);
  el.updateRoom({ name: "Guest room" });
  assert.equal(el.resizeNote(), null);
});
