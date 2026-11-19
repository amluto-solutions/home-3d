// Port 3.5 (#484): with Space held a mouse drag in the plan only pans, and never moves what lies under the pointer.
import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Furniture } from "../model.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
for (const name of ["HTMLInputElement", "HTMLSelectElement", "HTMLTextAreaElement", "HTMLButtonElement"]) (globalThis as Record<string, unknown>)[name] ??= class {};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const { Fp3dEditor } = (await import("./editor.ts")) as unknown as { Fp3dEditor: new () => Record<string, any> };

const SCALE = 50;
const item = (id: string, x: number, z: number): Furniture => ({ id, type: "box", x, z, rotation: 0, w: 1.6, d: 0.45, h: 0.8, variant: null });

function editor() {
  const b = emptyBuilding();
  const floor = newFloor("f", "Ground", 0);
  floor.rooms.push({ id: "r", name: "Lounge", area_id: null, points: [[0, 0], [6, 0], [6, 4], [0, 4]], floor_material: "wood" } as never);
  floor.furniture.push(item("sb", 3, 2));
  b.floors.push(floor);
  b.settings.grid = 0.1;
  const el = new Fp3dEditor();
  el._doc = b;
  el._floorId = "f";
  el.canEdit = true;
  el._view = { scale: SCALE, ox: 100, oy: 100 };
  el.renderRoot = { activeElement: null, querySelector: () => ({ getBoundingClientRect: () => ({ left: 0, top: 0 }) }) };
  el._tool = "select";
  Object.defineProperty(el, "isConnected", { value: true });
  Object.defineProperty(el, "offsetParent", { value: {} });
  return el;
}

const NOWHERE = { closest: () => null };
const screen = (at: [number, number]) => ({ clientX: at[0] * SCALE + 100, clientY: at[1] * SCALE + 100 });
const key = (k: string, target: unknown = null) => ({ key: k, shiftKey: false, ctrlKey: false, metaKey: false, composedPath: () => (target ? [target] : []), preventDefault() { this.stopped = true; }, stopped: false });

function drag(el: Record<string, any>, from: [number, number], to: [number, number], type = "mouse") {
  el.pointerDown({ pointerId: 1, button: 0, pointerType: type, ...screen(from), target: NOWHERE, currentTarget: { setPointerCapture() {} }, shiftKey: false, altKey: false });
  el.onPointerMove({ pointerId: 1, pointerType: type, ...screen(to), target: NOWHERE, altKey: false, shiftKey: false });
  el.onPointerUp({ pointerId: 1, button: 0, type: "pointerup", pointerType: type, ...screen(to), target: NOWHERE, altKey: false, currentTarget: { releasePointerCapture() {} } });
}

test("with Space held a mouse drag over an item pans the plan and leaves the item where it is (#484)", () => {
  const el = editor();
  el.selectItem("furniture", "sb");
  const space = key(" ");
  el.onKey(space);
  assert.equal(el.spaceHeld, true);
  assert.equal(space.stopped, true, "the page does not scroll");
  const before = { ...el._view };
  drag(el, [3, 2], [3.6, 2.4]);
  const f = el._doc.floors[0].furniture[0];
  assert.deepEqual([f.x, f.z], [3, 2]);
  assert.notDeepEqual({ ...el._view }, before, "the plan moved");
});

test("Space let go, the same drag moves the item again (#484)", () => {
  const el = editor();
  el.selectItem("furniture", "sb");
  el.onKey(key(" "));
  el.onShift({ key: " ", shiftKey: false });
  assert.equal(el.spaceHeld, false);
  drag(el, [3.05, 2], [3.5, 2.1]);
  const f = el._doc.floors[0].furniture[0];
  assert.notDeepEqual([f.x, f.z], [3, 2]);
});

test("Space on a focused button is not a pan key; losing the window lets it go (#484)", () => {
  const el = editor();
  // a focused button takes Space for itself
  el.onKey(key(" ", new (globalThis as unknown as { HTMLButtonElement: new () => unknown }).HTMLButtonElement()));
  assert.equal(el.spaceHeld, false);
  el.onKey(key(" "));
  assert.equal(el.spaceHeld, true);
  el.onKeysLost();
  assert.equal(el.spaceHeld, false);
});
