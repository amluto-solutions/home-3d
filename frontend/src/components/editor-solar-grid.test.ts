import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Building, type SolarField } from "../model.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dEditor } = (await import("./editor.ts")) as unknown as { Fp3dEditor: new () => Record<string, any> };

/** Every string and value of a lit template, flattened into one text. */
function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return String(v);
}

/** A one-floor house under a gable roof with two solar fields on its south face, in the editor's Energy tool. */
function editor(): Record<string, any> {
  const b: Building = emptyBuilding();
  b.floors = [{ ...newFloor("f", "Ground", 0), height: 2.5, rooms: [{ id: "r", name: "R", area_id: null, points: [[0, 0], [10, 0], [10, 8], [0, 8]], floor_material: "wood" }] }];
  const field = (id: string, u: number): SolarField => ({ id, face: "main:b", u, v: 0.5, rows: 2, cols: 2, portrait: true });
  b.settings = { ...b.settings, wall_exterior: 0.24, roof: { type: "gable", pitch: 35, overhang: 0.4, solar: [field("s1", 0.5), field("s2", 5)] } };
  const el = new Fp3dEditor();
  el._doc = b;
  el._floorId = "f";
  el.canEdit = true;
  el._view = { scale: 50, ox: 100, oy: 100 };
  el._tool = "energy";
  return el;
}

/** The class of the plan group drawn for each field. */
function fieldClasses(el: Record<string, any>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of flat(el.renderSolarFields()).matchAll(/data-solar=(\w+) class=([\w -]+)>/g)) out[m[1]] = m[2].trim();
  return out;
}

test("roof solar fields are drawn dimmed over the floor plan by default, so the rooms under them stay readable (#89)", () => {
  const c = fieldClasses(editor());
  assert.match(c.s1, /fp3d-solar-dim/);
  assert.match(c.s2, /fp3d-solar-dim/);
});

test("the selected solar field is drawn at full strength while the others stay dim (#89)", () => {
  const el = editor();
  el._solarId = "s2";
  const c = fieldClasses(el);
  assert.match(c.s1, /fp3d-solar-dim/);
  assert.doesNotMatch(c.s2, /fp3d-solar-dim/);
  assert.match(c.s2, /fp3d-solar-sel/);
});

test("switching the dim toggle off draws every field at full strength, and the choice is remembered (#89)", () => {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) };
  try {
    const el = editor();
    el.setSolarDim(false);
    const c = fieldClasses(el);
    assert.doesNotMatch(c.s1, /fp3d-solar-dim/);
    assert.doesNotMatch(c.s2, /fp3d-solar-dim/);
    // a new editor on this device starts with the grid at full strength too
    assert.doesNotMatch(fieldClasses(editor()).s1, /fp3d-solar-dim/);
  } finally {
    delete (globalThis as Record<string, unknown>).localStorage;
  }
});

test("the Energy panel offers the dim toggle once there are solar fields (#89)", () => {
  const el = editor();
  assert.match(flat(el.renderSolarList()), /fp3d-solar-dim-toggle/);
  el._doc.settings.roof.solar = [];
  assert.doesNotMatch(flat(el.renderSolarList()), /fp3d-solar-dim-toggle/);
});
