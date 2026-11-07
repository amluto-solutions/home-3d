// Alt in the plan (#125): Alt+click without moving picks the next item in a stack (#75), Alt-drag moves the item
// being dragged without snapping. Pressing Alt on the selected item and dragging must move that item, not the one
// under it.

import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Furniture } from "../model.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Fp3dEditor } = (await import("./editor.ts")) as unknown as { Fp3dEditor: new () => Record<string, any> };

const SCALE = 50; // px per metre: the plan's (0, 0) sits at screen (100, 100)

const item = (id: string, x: number, z: number, w: number, d: number): Furniture => ({ id, type: "box", x, z, rotation: 0, w, d, h: 0.8, variant: null });

/** A 1.6 m sideboard in the middle of a 6 x 4 m room, a small lamp standing on it. */
function editor() {
  const b = emptyBuilding();
  const floor = newFloor("f", "Ground", 0);
  floor.rooms.push({ id: "r", name: "Lounge", area_id: null, points: [[0, 0], [6, 0], [6, 4], [0, 4]], floor_material: "wood" } as never);
  floor.furniture.push(item("sb", 3, 2, 1.6, 0.45), item("lamp", 3, 2, 0.2, 0.2));
  b.floors.push(floor);
  b.settings.grid = 0.1;
  const el = new Fp3dEditor();
  el._doc = b;
  el._floorId = "f";
  el.canEdit = true;
  el._view = { scale: SCALE, ox: 100, oy: 100 };
  el.renderRoot = { activeElement: null, querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) };
  el._tool = "select";
  return el;
}

const NOWHERE = { closest: () => null };
const screen = (at: [number, number]) => ({ clientX: at[0] * SCALE + 100, clientY: at[1] * SCALE + 100 });

/** Press at `from` with Alt held, move to `to` (if any), let go there. */
function altDrag(el: Record<string, any>, from: [number, number], to: [number, number] | null) {
  el.pointerDown({ pointerId: 1, button: 0, pointerType: "mouse", ...screen(from), target: NOWHERE, currentTarget: { setPointerCapture() {} }, shiftKey: false, altKey: true });
  const end = to ?? from;
  if (to) el.onPointerMove({ pointerId: 1, pointerType: "mouse", ...screen(to), target: NOWHERE, altKey: true, shiftKey: false });
  el.onPointerUp({ pointerId: 1, button: 0, type: "pointerup", pointerType: "mouse", ...screen(end), target: NOWHERE, altKey: true, currentTarget: { releasePointerCapture() {} } });
}

const at = (el: Record<string, any>, id: string) => {
  const f = (el._doc.floors[0].furniture as Furniture[]).find((m) => m.id === id)!;
  return [f.x, f.z];
};

test("Alt-dragging the selected item over a stack moves that item, off the grid (#125)", () => {
  const el = editor();
  el.selectItem("furniture", "sb");
  altDrag(el, [3.05, 2], [3.48, 2.07]);
  assert.equal(el._furnitureId, "sb");
  assert.deepEqual(at(el, "sb"), [3.43, 2.07]);
  assert.deepEqual(at(el, "lamp"), [3, 2]);
  // one undo step
  assert.equal(el.history.canUndo, true);
});

test("Alt-dragging the selected small item on top of a stack moves it, not the one under it (#125)", () => {
  const el = editor();
  el.selectItem("furniture", "lamp");
  altDrag(el, [3, 2], [3.25, 2.33]);
  assert.equal(el._furnitureId, "lamp");
  assert.deepEqual(at(el, "lamp"), [3.25, 2.33]);
  assert.deepEqual(at(el, "sb"), [3, 2]);
});

test("Alt+click without moving still cycles through the stack (#75, #125)", () => {
  const el = editor();
  el.selectItem("furniture", "lamp");
  altDrag(el, [3, 2], null);
  assert.equal(el._furnitureId, "sb");
  altDrag(el, [3, 2], null);
  assert.equal(el._furnitureId, "lamp");
  // nothing moved, no undo step
  assert.deepEqual(at(el, "lamp"), [3, 2]);
  assert.deepEqual(at(el, "sb"), [3, 2]);
  assert.equal(el.history.canUndo, false);
});

test("Alt on a stack with nothing of it selected takes the top item, and drags it freely (#125)", () => {
  const el = editor();
  el.selectItem("room", "r");
  altDrag(el, [3, 2], null);
  assert.equal(el._furnitureId, "lamp");
  el.selectItem("room", "r");
  altDrag(el, [3, 2], [3.11, 2]);
  assert.equal(el._furnitureId, "lamp");
  assert.deepEqual(at(el, "lamp"), [3.11, 2]);
});
