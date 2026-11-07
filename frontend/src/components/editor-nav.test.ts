import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor } from "./editor-harness.ts";

const room = { id: "r", name: "Lounge", area_id: null, points: [[0, 0], [4, 0], [4, 3], [0, 3]], floor_material: "wood" } as never;
const sofa = { id: "s", type: "sofa", x: 1, z: 1, rotation: 0, w: 1, d: 1, h: 1, variant: null } as never;

test("arrow keys move the view when nothing is selected (#234)", async () => {
  const el = await makeEditor([room], [sofa]);
  const before = { ...el._view };
  assert.equal(el.key("ArrowLeft").prevented, true);
  assert.ok(el._view.ox > before.ox, "the plan follows the arrow to the right");
  el.key("ArrowDown");
  assert.ok(el._view.oy < before.oy);
  assert.equal(el._doc.floors[0].furniture[0].x, 1, "nothing was nudged");
});

test("arrow keys still nudge a selection (#234)", async () => {
  const el = await makeEditor([room], [sofa]);
  el._furnitureId = "s";
  const before = { ...el._view };
  el.key("ArrowRight");
  assert.deepEqual(el._view, before);
  assert.ok(el._doc.floors[0].furniture[0].x > 1);
});

test("zoom and pan helpers keep the middle of the plan fixed (#234)", async () => {
  const el = await makeEditor([room]);
  const mid = el.toWorld(400, 300);
  el.zoomBy(2);
  const after = el.toWorld(400, 300);
  assert.ok(Math.abs(after[0] - mid[0]) < 1e-9 && Math.abs(after[1] - mid[1]) < 1e-9);
  assert.equal(el._view.scale, 200);
});

test("the plan draws the navigation control, 44 px, right of the hint bar (#234)", async () => {
  const { editorSource } = await import("./editor-source.ts");
  const src = editorSource();
  assert.match(src, /\$\{this\.renderNav\(\)\}/);
  assert.match(src, /\.fp3d-nav \{[^}]*right: 10px;[^}]*top: 50%/);
  assert.match(src, /\.fp3d-nav-btn \{[^}]*width: 44px;[^}]*height: 44px;/);
});
