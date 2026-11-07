import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor } from "../model.ts";
import { editorSource } from "./editor-source.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dEditor } = (await import("./editor.ts")) as unknown as { Fp3dEditor: new () => Record<string, any> };

function editor() {
  const b = emptyBuilding();
  b.floors.push(newFloor("g", "Ground", 0));
  const el = new Fp3dEditor();
  el._doc = b;
  el._floorId = "g";
  el.renderRoot = { activeElement: null };
  return el;
}

test("a settings change from the 3D-beside view goes through the editor's edit path: undoable, announced for saving (#212)", () => {
  const el = editor();
  const saved: unknown[] = [];
  el.addEventListener("building-changed", (e: Event) => saved.push((e as CustomEvent).detail.building));
  const before = el._doc.settings.wall_interior;
  const event = new CustomEvent("plan-change", { detail: { change: (b: any) => (b.settings.wall_interior = before + 0.05) }, cancelable: true });
  el.onPlanChange3d(event);
  // the view must not save behind the editor's back
  assert.equal(event.defaultPrevented, true);
  assert.equal(el._doc.settings.wall_interior, before + 0.05);
  assert.equal(saved.length, 1);
  assert.equal(el._canUndo, true);
  el.undo();
  assert.equal(el._doc.settings.wall_interior, before);
});

test("both embedded 3D views hand their plan changes to the editor (#212)", () => {
  const src = editorSource();
  assert.equal(src.split("<fp3d-view3d").length - 1, 2);
  assert.equal(src.split("@plan-change=${this.onPlanChange3d}").length - 1, 2);
});
