import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { Furniture, OutdoorArea } from "./model.ts";
import { makeEditor, square } from "./components/editor-harness.ts";
import { clearLabels, itemRank, roomRank, textWidth } from "./viewer/label-clear.ts";

// #341: one collision pass for room, outdoor area and item names, in the 2D editor, the 2D view and the 3D view.

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");
const item = (id: string, x: number, z: number, w = 1, d = 1, type = "sofa"): Furniture => ({ id, type, x, z, rotation: 0, w, d, h: 0.5, variant: null }) as Furniture;

test("a kept name (the selected one) always shows and still keeps the others off its place (#341)", () => {
  const box = (x: number, rank: number, keep = false) => ({ x, y: 0, w: 80, h: 20, rank, keep });
  // the small selected item wins over the big room it sits in
  assert.deepEqual(clearLabels([box(0, 1e6 + 20), box(10, 2, true)]), [false, true]);
  // two kept names both show
  assert.deepEqual(clearLabels([box(0, 5, true), box(10, 2, true)]), [true, true]);
  // names a few pixels apart count as touching: they never sit edge to edge
  assert.deepEqual(clearLabels([box(0, 5), box(83, 2)]), [true, false]);
  assert.deepEqual(clearLabels([box(0, 5), box(100, 2)]), [true, true]);
});

test("a room's name ranks above an outdoor area's, that above an item's (#341)", () => {
  const room = square("wc", 0, 0, 1, 1);
  const lawn = { ...square("lawn", 0, 0, 30, 30), outdoor: true };
  assert.ok(roomRank(room) > roomRank(lawn));
  assert.ok(roomRank(lawn) > itemRank(5, 5));
  assert.ok(itemRank(2, 1) > itemRank(1, 1));
});

test("text widths follow the text and the font size; no canvas in Node, so an estimate (#341)", () => {
  assert.ok(textWidth("Kitchen-diner", "600 13px X") > textWidth("WC", "600 13px X"));
  assert.ok(textWidth("Lounge", "600 13px X") > textWidth("Lounge", "11px X"));
});

test("2D editor: an item's name under a room's gives way, and comes back when zoomed in (#341)", async () => {
  // a 3 x 3 m garage with a car just below its middle: at 40 px per metre the names sit on each other
  const ed = await makeEditor([square("garage", 0, 0, 3, 3)], [item("car", 1.5, 2.2, 1.2, 1.2, "car")]);
  ed._view = { scale: 40, ox: 0, oy: 0 };
  const floor = ed._doc.floors[0];
  let shown = ed.planLabels(floor);
  assert.ok(shown.has("r:garage"));
  assert.ok(!shown.has("f:car"));
  // the same view and floor: the answer is reused, not worked out again
  assert.equal(ed.planLabels(floor), shown);
  // zoomed in, the names are far enough apart: both show
  ed._view = { scale: 200, ox: 0, oy: 0 };
  shown = ed.planLabels(floor);
  assert.ok(shown.has("r:garage") && shown.has("f:car"));
  // selected, the item's name shows whatever it sits under
  ed._view = { scale: 40, ox: 0, oy: 0 };
  ed._furnitureId = "car";
  assert.ok(ed.planLabels(floor).has("f:car"));
});

test("2D editor: a smaller room's name gives way to a larger one's next to it; the selected room always shows (#341)", async () => {
  const ed = await makeEditor([square("hall", 0, 0, 4, 4), square("wc", 4, 0, 5, 1)]);
  ed._view = { scale: 10, ox: 0, oy: 0 };
  const floor = ed._doc.floors[0];
  assert.deepEqual([...ed.planLabels(floor)], ["r:hall"]);
  ed._roomId = "wc";
  assert.ok(ed.planLabels(floor).has("r:wc"));
});

test("2D editor: a fence is not named in the middle of the plot unless selected (#341)", async () => {
  const ed = await makeEditor([]);
  const fence: OutdoorArea = { id: "fence", type: "fence", points: [[0, 0], [20, 0], [20, 20], [0, 20]] } as OutdoorArea;
  const lawn: OutdoorArea = { id: "lawn", type: "lawn", points: [[30, 0], [40, 0], [40, 10], [30, 10]] } as OutdoorArea;
  const floor = { ...ed._doc.floors[0], outdoor: [fence, lawn] };
  ed._view = { scale: 20, ox: 0, oy: 0 };
  let shown = ed.planLabels(floor);
  assert.ok(shown.has("o:lawn") && !shown.has("o:fence"));
  ed._outdoorId = "fence";
  shown = ed.planLabels(floor);
  assert.ok(shown.has("o:fence"));
});

test("the editor, the 2D view and the 3D view all place names through the one pass, measured once per text (#341)", () => {
  const rooms = src("./components/editor/rooms.ts");
  const furniture = src("./components/editor/furniture.ts");
  const outdoor = src("./components/editor/outdoor.ts");
  assert.match(rooms, /if \(!shown\.has\(`r:\$\{r\.id\}`\)\) return nothing;/);
  assert.match(outdoor, /shown\.has\(`o:\$\{a\.id\}`\)/);
  // a hidden item name stays in the plan and shows while the pointer is over its item
  assert.match(furniture, /class=\$\{named\.has\(`f:\$\{f\.id\}`\) \? "" : "fp3d-lbl-off"\}/);
  assert.match(src("./components/editor/styles/forms.ts"), /\.fp3d-furn:hover \.fp3d-lbl-off \{\s*display: inline;/);
  const p2d = src("./plan2d/viewer2d.ts");
  // a pan or zoom works the names out again, without drawing the plan again
  assert.match(p2d, /this\.placeAnchors\(\);\s*this\.clearNames\(\);/);
  assert.match(p2d, /const keep = clearLabels\(this\.names\.map\(\(n\) => n\.box\)\);/);
  const v3d = src("./viewer/viewer3d.ts");
  // 3D: the pins' real size (a phone's are larger) is read once per text, not per frame
  assert.match(v3d, /const fresh = names\.filter\(\(n\) => !this\.pinSizes\.has\(n\.pin\)\);/);
  assert.match(v3d, /this\.pinSizes\.delete\(pin\);\s*pin\.textContent = name/);
  // the canvas measures with the plan's fonts
  const styles = src("./styles.ts");
  assert.match(styles, /--fp3d-title-font: "Bricolage Grotesque", "Figtree"/);
  assert.match(styles, /--fp3d-font: "Figtree"/);
});
