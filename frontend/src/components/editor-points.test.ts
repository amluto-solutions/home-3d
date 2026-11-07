// The points of drawn outlines (#395): a "+" at the middle of every edge adds a point (a press, or a drag that moves
// it), right-click / long press / Delete removes one, never below three points; each add or remove is one undo step.
// Rooms, outdoor areas and roof outlines alike.

import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor, planEl, square, type TestEditor } from "./editor-harness.ts";
import type { OutdoorArea, Vec2 } from "../model.ts";

const S = 100; // px per metre in the harness

const area = (id: string, points: Vec2[]): OutdoorArea => ({ id, type: "driveway", points }) as OutdoorArea;
const drive = (): Vec2[] => [[0, 0], [4, 0], [4, 2], [0, 2]];

async function outdoorEditor(points: Vec2[] = drive()): Promise<TestEditor> {
  const ed = await makeEditor([]);
  ed._doc.floors[0].outdoor = [area("a", points)];
  ed._tool = "select";
  ed.selectItem("outdoor", "a");
  return ed;
}

const outPoints = (ed: TestEditor): Vec2[] => ed._doc.floors[0].outdoor[0].points;

test("a press on an outdoor area's edge '+' adds a point in the middle of that edge, one undo step (#395)", async () => {
  const ed = await outdoorEditor();
  ed.press(2 * S, 0, { target: planEl({ "data-out-mid": "a:0" }) });
  ed.release(2 * S, 0, { target: planEl({ "data-out-mid": "a:0" }) });
  assert.deepEqual(outPoints(ed), [[0, 0], [2, 0], [4, 0], [4, 2], [0, 2]]);
  assert.deepEqual(ed._point, { kind: "out", id: "a", index: 1 }, "the new point is chosen");
  ed.undo();
  assert.deepEqual(outPoints(ed), drive(), "one undo takes it away again");
  assert.equal(ed.history.canUndo, false);
});

test("dragging the '+' moves the new point, not its neighbour; still one undo step (#395)", async () => {
  const ed = await outdoorEditor();
  ed._doc.settings.grid = 0.5;
  const mid = planEl({ "data-out-mid": "a:1" });
  ed.press(4 * S, 1 * S, { target: mid });
  ed.move(5 * S, 1 * S, { target: mid });
  ed.release(5 * S, 1 * S, { target: mid });
  assert.deepEqual(outPoints(ed), [[0, 0], [4, 0], [5, 1], [4, 2], [0, 2]]);
  ed.undo();
  assert.deepEqual(outPoints(ed), drive());
});

test("dragging a room's edge '+' moves the new corner (rooms insert on edge drag, kept and fixed, #395)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 3)]);
  ed._doc.settings.grid = 0.5;
  ed._tool = "select";
  ed.selectItem("room", "r");
  const mid = planEl({ "data-mid": "0" });
  ed.press(2 * S, 0, { target: mid });
  ed.move(2 * S, -1 * S, { target: mid });
  ed.release(2 * S, -1 * S, { target: mid });
  const pts = ed._doc.floors[0].rooms[0].points;
  assert.equal(pts.length, 5);
  assert.deepEqual(pts[1], [2, -1], "the new corner moved");
  assert.deepEqual(pts[2], [4, 0], "the next corner stayed");
  ed.undo();
  assert.equal(ed._doc.floors[0].rooms[0].points.length, 4, "one undo step for the add and the drag");
});

test("Delete removes the chosen outdoor point, never below three points, one undo step each (#395)", async () => {
  const ed = await outdoorEditor();
  ed.press(4 * S, 2 * S, { target: planEl({ "data-out-vertex": "a:2" }) });
  ed.release(4 * S, 2 * S, { target: planEl({ "data-out-vertex": "a:2" }) });
  assert.deepEqual(ed._point, { kind: "out", id: "a", index: 2 });
  ed.key("Delete");
  // removing is async for rooms only; outdoor points go at once
  await Promise.resolve();
  assert.deepEqual(outPoints(ed), [[0, 0], [4, 0], [0, 2]]);
  assert.equal(ed._doc.floors[0].outdoor.length, 1, "the area itself stays");
  ed.press(0, 0, { target: planEl({ "data-out-vertex": "a:0" }) });
  ed.release(0, 0, { target: planEl({ "data-out-vertex": "a:0" }) });
  ed.key("Backspace");
  await Promise.resolve();
  assert.equal(outPoints(ed).length, 3, "three points stay");
  assert.equal(ed._doc.floors[0].outdoor.length, 1, "Delete on the last three points does not delete the area");
  ed.undo();
  assert.deepEqual(outPoints(ed), drive(), "one undo brings the point back");
});

test("right-click on a point opens its menu with Remove point, disabled at three points (#395)", async () => {
  const { canRemovePoint } = await import("./editor/points.ts");
  const ed = await outdoorEditor();
  ed.openContext(planEl({ "data-out-vertex": "a:3" }), [0, 2 * S]);
  assert.deepEqual(ed._ctx?.point, { kind: "out", id: "a", index: 3 });
  assert.equal(canRemovePoint(ed as never, ed._ctx.point), true);
  const tri = await outdoorEditor([[0, 0], [4, 0], [0, 2]]);
  tri.openContext(planEl({ "data-out-vertex": "a:1" }), [4 * S, 0]);
  assert.equal(canRemovePoint(tri as never, tri._ctx.point), false);
});

test("a right-click on a room's corner removes that corner through its menu (#395)", async () => {
  const { removePoint } = await import("./editor/points.ts");
  const ed = await makeEditor([{ ...square("r", 0, 0, 4, 3), points: [[0, 0], [2, 0], [4, 0], [4, 3], [0, 3]] }]);
  ed._tool = "select";
  ed.selectItem("room", "r");
  ed.openContext(planEl({ "data-vertex": "1" }), [2 * S, 0]);
  assert.deepEqual(ed._ctx?.point, { kind: "room", id: "r", index: 1 });
  assert.equal(ed._vertex, 1);
  await removePoint(ed as never, ed._ctx.point);
  assert.deepEqual(ed._doc.floors[0].rooms[0].points, [[0, 0], [4, 0], [4, 3], [0, 3]]);
  ed.undo();
  assert.equal(ed._doc.floors[0].rooms[0].points.length, 5);
});

test("the arrow keys move the chosen outdoor point alone (#395)", async () => {
  const ed = await outdoorEditor();
  ed._doc.settings.grid = 0.5;
  ed.press(4 * S, 0, { target: planEl({ "data-out-vertex": "a:1" }) });
  ed.release(4 * S, 0, { target: planEl({ "data-out-vertex": "a:1" }) });
  ed.key("ArrowRight");
  assert.deepEqual(outPoints(ed), [[0, 0], [4.5, 0], [4, 2], [0, 2]]);
});

test("a roof outline gets points from its '+' and loses them by Delete, its box following (#395)", async () => {
  const ed = await makeEditor([]);
  ed._doc.settings.roof = { ...ed._doc.settings.roof, type: "custom", sections: [{ id: "s", shape: "flat", points: [[0, 0], [4, 0], [4, 2], [0, 2]], x0: 0, z0: 0, x1: 4, z1: 2 } as never] };
  ed._tool = "roof";
  ed._roofId = "s";
  const mid = planEl({ "data-roof-mid": "s:1" });
  ed.press(4 * S, 1 * S, { target: mid });
  ed.move(5 * S, 1 * S, { target: mid });
  ed.release(5 * S, 1 * S, { target: mid });
  const sec = () => ed._doc.settings.roof.sections[0];
  assert.deepEqual(sec().points, [[0, 0], [4, 0], [5, 1], [4, 2], [0, 2]]);
  assert.equal(sec().x1, 5, "the section's box takes the new point");
  ed.key("Delete");
  await Promise.resolve();
  assert.deepEqual(sec().points, [[0, 0], [4, 0], [4, 2], [0, 2]]);
  assert.equal(ed._doc.settings.roof.sections.length, 1, "Delete took the point, not the section");
  assert.equal(sec().x1, 4);
  ed.undo();
  assert.equal(sec().points.length, 5, "the remove was one undo step");
  ed.undo();
  assert.equal(sec().points.length, 4, "and the add another");
});
