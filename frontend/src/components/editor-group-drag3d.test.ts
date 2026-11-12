// A multi selection dragged in the 3D pane: grabbing one of the items keeps the selection and the drop moves them all
// by the same step (the grab used to select the grabbed item alone, so only it moved), and the 3D view is told the
// whole selection, so its wireframe boxes match what moves.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { makeEditor, square } from "./editor-harness.ts";

const box = (id: string, x: number): Furniture => ({ id, type: "box", x, z: 2, rotation: 0, w: 0.5, d: 0.5, h: 0.5, variant: null });
const ev = <T>(detail: T) => ({ detail }) as CustomEvent<T>;

test("grabbing one of a multi selection in 3D keeps the selection and moves every item by the same step", async () => {
  const ed = await makeEditor([square("r", 0, 0, 8, 8)], [box("a", 1), box("b", 2), box("c", 3), box("d", 4), box("e", 6)]);
  ed.setMulti(["a", "b", "c", "d"]);
  ed.onFurnitureSelected3d(ev({ id: "c" }));
  assert.deepEqual(ed._multi, ["a", "b", "c", "d"], "the grab keeps the multi selection");
  ed.onFurnitureMoved3d(ev({ id: "c", x: 3.5, z: 2.5 }));
  const at = Object.fromEntries(ed.floor!.furniture.map((f: Furniture) => [f.id, [f.x, f.z]]));
  assert.deepEqual(at, { a: [1.5, 2.5], b: [2.5, 2.5], c: [3.5, 2.5], d: [4.5, 2.5], e: [6, 2] });
});

test("an item outside the multi selection, or none, still selects as before", async () => {
  const ed = await makeEditor([square("r", 0, 0, 8, 8)], [box("a", 1), box("b", 2), box("e", 6)]);
  ed.setMulti(["a", "b"]);
  ed.onFurnitureSelected3d(ev({ id: "e" }));
  assert.deepEqual(ed._multi, []);
  assert.equal(ed._furnitureId, "e");
  ed.onFurnitureSelected3d(ev<{ id: string | null }>({ id: null }));
  assert.equal(ed._furnitureId, null);
});

test("the editor's 3D pane is told the whole selection, not only the first item", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./editor/pane3d.ts", import.meta.url), "utf8");
  assert.match(src, /\.selectedSet=\$\{this\._furnitureId \? this\.selection\(\) : \[\]\}/);
  assert.match(src, /@furniture-select=\$\{this\.onFurnitureSelected3d\}/);
});

test("Shift is let go when the window loses the keys (no keyup comes after Alt+Tab)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 8, 8)], [box("a", 1)]);
  ed.shiftHeld = true;
  ed.onKeysLost();
  assert.equal(ed.shiftHeld, false);
});
