// A cancelled drag (#184): the plan goes back to how it was before it, the undo history follows, and a free wall's
// move is one of those drags.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Building, FreeWall } from "../model.ts";
import { makeEditor, planEl, square, type TestEditor } from "./editor-harness.ts";

async function withWall(): Promise<TestEditor> {
  const ed = await makeEditor([square("r", 0, 0, 6, 6)], [{ id: "sofa", type: "sofa", x: 4, z: 4, rotation: 0, w: 1, d: 0.5, h: 0.8, variant: null }]);
  ed._doc.floors[0].walls = [{ id: "w", a: [1, 1], b: [3, 1] }];
  ed.history.adopt(ed._doc, ed.home);
  return ed;
}

const wall = (b: Building): FreeWall => b.floors[0].walls!.find((w) => w.id === "w")!;

/** The browser gives up on the pointer (a scroll took over, the tab lost it): pointercancel instead of pointerup. */
function cancel(ed: TestEditor, sx: number, sy: number, id = 1): void {
  ed.onPointerUp({ type: "pointercancel", clientX: sx, clientY: sy, button: 0, pointerId: id, pointerType: "touch", altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, target: planEl(), currentTarget: ed.renderRoot.querySelector("svg"), preventDefault() {}, stopPropagation() {} });
}

function dragWall(ed: TestEditor): void {
  ed.press(200, 100, { target: planEl({ "data-free-wall": "w" }) });
  ed.move(250, 100);
  ed.move(300, 100);
  assert.deepEqual(wall(ed._doc).a, [2, 1], "the wall moves with the pointer");
}

test("a free-wall move the browser cancels puts the wall back and adds no undo step (#184)", async () => {
  const ed = await withWall();
  dragWall(ed);
  cancel(ed, 300, 100);
  assert.deepEqual(wall(ed._doc).a, [1, 1]);
  assert.deepEqual(wall(ed._doc).b, [3, 1]);
  assert.equal(ed.history.canUndo, false);
});

test("a second finger during a free-wall move puts the wall back before the pinch (#184)", async () => {
  const ed = await withWall();
  dragWall(ed);
  ed.press(400, 400, { id: 2 });
  assert.deepEqual(wall(ed._doc).a, [1, 1]);
  assert.equal(ed.drag, null);
});

test("a free-wall move that ends normally is one undo step (#184)", async () => {
  const ed = await withWall();
  dragWall(ed);
  ed.release(300, 100);
  assert.deepEqual(wall(ed._doc).a, [2, 1]);
  ed.undo();
  assert.deepEqual(wall(ed._doc).a, [1, 1]);
});

test("after a cancelled drag the history still matches the plan, so reopening the editor keeps it (#184)", async () => {
  const ed = await withWall();
  // one ordinary step: the sofa dragged and let go
  ed.press(400, 400, { target: planEl({ "data-furniture": "sofa" }) });
  ed.move(450, 400);
  ed.release(450, 400);
  assert.equal(ed.history.canUndo, true);
  // then another drag of it that the browser cancels
  ed.press(450, 400, { target: planEl({ "data-furniture": "sofa" }) });
  ed.move(550, 400);
  assert.equal(ed._doc.floors[0].furniture[0].x, 5.5);
  cancel(ed, 550, 400);
  assert.equal(ed._doc.floors[0].furniture[0].x, 4.5);
  // the panel hands the editor opened next the plan it last got: the steps must stay
  assert.equal(ed.history.adopt(ed._doc, ed.home), true);
  ed.undo();
  assert.equal(ed._doc.floors[0].furniture[0].x, 4);
});

test("a joint or fitting drag cut short on the wall view is kept as one step and ends; nothing stale is left (#184)", async () => {
  const ed = await withWall();
  const before = ed._doc;
  ed.change((_: Building, floor: Building["floors"][number]) => (floor.walls![0].a = [0, 0]), before, false);
  ed.jointDrag = { id: "j", d: 0, base: before, moved: true };
  ed.fitDrag = { pipe: "p", id: "v", base: before, moved: false, x: 0, y: 0 };
  ed.endJointDrags();
  assert.equal(ed.jointDrag, null);
  assert.equal(ed.fitDrag, null);
  ed.undo();
  assert.deepEqual(wall(ed._doc).a, [1, 1]);
  assert.equal(ed.history.canUndo, false);
});
