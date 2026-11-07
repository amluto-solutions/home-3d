// Entity pickers and the editor's shortcuts (#132): while a picker's list is open the keyboard belongs to it, so a
// press that lost the picker's focus (a miss in its list) never turns typed keys into plan shortcuts.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { makeEditor, square } from "./editor-harness.ts";

const box = (id: string, x: number): Furniture => ({ id, type: "box", x, z: 1, rotation: 0, w: 0.5, d: 0.5, h: 0.5, variant: null });

const ctrlA = () => ({ key: "a", ctrlKey: true, metaKey: false, shiftKey: false, altKey: false, composedPath: () => [], preventDefault() {} });

async function editorWithPicker(open: boolean) {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [box("a", 1), box("b", 2)]);
  const picker = { open };
  const root = ed.renderRoot;
  Object.defineProperty(ed, "renderRoot", {
    value: { ...root, querySelectorAll: (sel: string) => (sel === "fp3d-entity-picker" ? [picker] : root.querySelectorAll(sel)) },
    configurable: true,
  });
  return ed;
}

test("Ctrl+A while an entity picker's list is open does not select every item on the plan (#132)", async () => {
  const ed = await editorWithPicker(true);
  ed.onKey(ctrlA());
  assert.deepEqual(ed._multi, []);
});

test("with every picker closed Ctrl+A still selects every item (#132)", async () => {
  const ed = await editorWithPicker(false);
  ed.onKey(ctrlA());
  assert.deepEqual(ed._multi, ["a", "b"]);
});

/** The `prefer` object handed to the picker in a template (a plain object with an `area` key). */
function preferOf(v: unknown): { area?: string | null; domains?: string[] } | undefined {
  if (v == null || typeof v !== "object") return undefined;
  if (Array.isArray(v)) return v.map(preferOf).find(Boolean);
  if ("strings" in (v as object)) return (v as { values: unknown[] }).values.map(preferOf).find(Boolean);
  return "area" in (v as object) ? (v as { area?: string | null }) : undefined;
}

test("a picker in the item panel prefers the area of the room the item stands in (#132)", async () => {
  const ed = await makeEditor([{ ...square("r", 0, 0, 4, 4), area_id: "lounge" }, { ...square("k", 4, 0, 8, 4), area_id: "kitchen" }], [box("a", 1), box("b", 6)]);
  ed.selectItem("furniture", "b");
  const prefer = preferOf(ed.entitySelect("Device", null, undefined, [], () => {}, ["light"]));
  assert.deepEqual(prefer, { area: "kitchen", domains: ["light"] });
});
