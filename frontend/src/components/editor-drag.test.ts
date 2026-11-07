// A drag on the plan changes the plan on every pointer move (#130): only the floor being edited is copied, so a big
// plan's other floors, settings and recipe copies are not cloned again on every move.

import assert from "node:assert/strict";
import { test } from "node:test";
import { newFloor, type Furniture } from "../model.ts";
import { makeEditor, planEl, square } from "./editor-harness.ts";

const sofa = (): Furniture => ({ id: "sofa", type: "sofa", x: 2, z: 2, rotation: 0, w: 1, d: 0.5, h: 0.8, variant: null });

async function twoFloors() {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [sofa()]);
  ed._doc.floors.push({ ...newFloor("up", "Upstairs", 3), rooms: [square("u", 0, 0, 4, 4)], furniture: [{ ...sofa(), id: "bed", type: "bed" }] });
  ed._doc.recipes = { "pack:x:y": { hash: "h", recipe: { id: "y" } } } as never;
  return ed;
}

test("dragging an item moves it and copies only its floor: the other floors and the recipes stay the same objects (#130)", async () => {
  const ed = await twoFloors();
  const before = ed._doc;
  ed.press(200, 200, { target: planEl({ "data-furniture": "sofa" }) });
  ed.move(260, 200);
  ed.move(300, 200);
  const moved = ed._doc;
  assert.notEqual(moved, before);
  assert.equal(moved.floors[0].furniture[0].x, 3);
  assert.equal(before.floors[0].furniture[0].x, 2, "the plan before the drag is untouched");
  assert.equal(moved.floors[1], before.floors[1]);
  assert.equal(moved.recipes, before.recipes);
  assert.equal(moved.settings, before.settings);
  ed.release(300, 200);
  ed.undo();
  assert.equal(ed._doc.floors[0].furniture[0].x, 2);
  assert.equal(ed._doc.floors[1].furniture[0].id, "bed");
});
