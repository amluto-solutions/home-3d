import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor } from "../model.ts";

// the editor's bundle hashes are build-time constants: plain strings will do here
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dEditor } = (await import("./editor.ts")) as unknown as { Fp3dEditor: new () => Record<string, any> };

/** An editor on a plan with a sofa and a lamp in one room, and a stand-in for the box with the cursor. */
function editor() {
  const b = emptyBuilding();
  const floor = newFloor("f", "Ground", 0);
  floor.rooms.push({ id: "r", name: "Lounge", area_id: null, points: [[0, 0], [5, 0], [5, 4], [0, 4]], floor_material: "wood" } as never);
  const item = (id: string, x: number) => ({ id, type: "sofa", x, z: 2, rotation: 0, w: 1, d: 1, h: 1, variant: null }) as never;
  floor.furniture.push(item("sofa", 1), item("lamp", 3));
  b.floors.push(floor);
  const el = new Fp3dEditor();
  el._doc = b;
  el._floorId = "f";
  // the box with the cursor: blurring it runs its change handler and leaves nothing focused
  const root: { activeElement: unknown } = { activeElement: null };
  const input = { tagName: "INPUT", blurs: 0, onBlur: () => {}, focus: () => void (root.activeElement = input), blur() {
    input.blurs++;
    input.onBlur();
    root.activeElement = null;
  } };
  el.renderRoot = root;
  const x = (id: string) => (el._doc.floors[0].furniture as { id: string; x: number }[]).find((f) => f.id === id)!.x;
  return { el, input, x };
}

test("choosing another item lets go of the box with the cursor, and what was typed lands on the first item (#56)", () => {
  const { el, input, x } = editor();
  el.selectItem("furniture", "sofa");
  input.focus();
  // the X box of the sofa has "4.5" typed in: its change handler commits when it is blurred
  input.onBlur = () => el.updateFurniture({ x: 4.5 });
  el.selectItem("furniture", "lamp");
  assert.equal(input.blurs, 1);
  assert.equal(x("sofa"), 4.5);
  assert.equal(x("lamp"), 3);
  assert.equal(el._furnitureId, "lamp");
});

test("going back to the room or the floor lets go too (#56)", () => {
  const { el, input } = editor();
  el.selectItem("furniture", "sofa");
  input.focus();
  el.selectItem("room", "r");
  input.focus();
  el.selectItem("room", null);
  assert.equal(input.blurs, 2);
});

test("editing the chosen item (typing changes the plan) keeps the cursor (#56)", () => {
  const { el, input } = editor();
  el.selectItem("furniture", "sofa");
  input.focus();
  el.updateFurniture({ x: 2 });
  el.updateFurniture({ name: "Couch" });
  assert.equal(input.blurs, 0);
});

test("Escape with the cursor in a box lets go of the box and keeps the item (#70)", () => {
  const { el, input } = editor();
  el._tool = "furniture";
  el.selectItem("furniture", "sofa");
  input.focus();
  el.escape();
  assert.equal(input.blurs, 1);
  assert.equal(el._furnitureId, "sofa");
});

test("Escape while furnishing goes back to the library: the item is let go, the room and the tool stay (#70)", () => {
  const { el } = editor();
  el._tool = "furniture";
  el.selectItem("room", "r");
  el.selectItem("furniture", "sofa");
  el._roomId = "r";
  el.escape();
  assert.equal(el._furnitureId, null);
  assert.equal(el._roomId, "r");
  assert.equal(el._tool, "furniture");
});

/** The side bar's scroll boxes as the editor finds them after a render. */
function withSideBars(el: Record<string, any>) {
  const sides = [{ scrollTop: 420 }, { scrollTop: 90 }];
  const root = el.renderRoot as Record<string, unknown>;
  root.querySelector = () => null;
  root.querySelectorAll = (sel: string) => (sel === ".fp3d-side" ? sides : []);
  // both were scrolled down (the editor's passive scroll listener notes it, #392)
  for (const s of sides) el.scrolledSides.add(s);
  return sides;
}

test("a side panel at its top is not written to on a new selection: no forced layout (#392)", () => {
  const { el } = editor();
  const sides = withSideBars(el);
  el.scrolledSides = new WeakSet();
  let writes = 0;
  for (const s of sides) Object.defineProperty(s, "scrollTop", { get: () => 0, set: () => writes++ });
  el.updated(new Map([["_furnitureId", "sofa"]]));
  assert.equal(writes, 0);
});

test("another item opens its panel at the top, not where the last one was scrolled to (#71)", () => {
  const { el } = editor();
  const sides = withSideBars(el);
  el.updated(new Map([["_furnitureId", "sofa"]]));
  assert.deepEqual(sides.map((s) => s.scrollTop), [0, 0]);
});

test("an edit of the same item keeps the panel where it is (#71)", () => {
  const { el } = editor();
  const sides = withSideBars(el);
  el.updated(new Map([["_doc", el._doc]]));
  el.updated(new Map([["_multi", []]]));
  assert.deepEqual(sides.map((s) => s.scrollTop), [420, 90]);
});
