// #407 (DEF-4): item folds remember less. Appearance is remembered per kind; Size, the glow, Energy, Taps and
// visibility and More options open for one selection only, so one look into More options no longer opens every later
// item of that kind at full length.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { itemProfile } from "../item-profile.ts";
import { openFolds, panelUi, REMEMBERED_FOLDS, resetFolds, setFoldOpen } from "./editor/item-sections.ts";
import { makeEditor, square } from "./editor-harness.ts";

const washer = (id: string, x: number): Furniture => ({ id, type: "washer", x, z: 1, rotation: 0, w: 0.6, d: 0.6, h: 0.85, variant: null }) as Furniture;

function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function" || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return typeof v === "object" ? "" : String(v);
}
const openOf = (form: string) => [...form.matchAll(/data-fold=(\w+)[\s\S]*?aria-expanded=(true|false)/g)].filter((m) => m[2] === "true").map((m) => m[1]);

test("only Appearance is remembered per kind (#407)", () => {
  assert.deepEqual([...REMEMBERED_FOLDS], ["appearance"]);
  resetFolds();
  const p = itemProfile("washer");
  const passing: Set<ReturnType<typeof openFolds>[number]> = new Set();
  for (const fold of ["size", "energy", "taps", "more"] as const) setFoldOpen(p, fold, true, passing);
  assert.deepEqual(openFolds(p).filter((f) => f !== "appearance"), [], "nothing but Appearance outlives the selection");
  assert.deepEqual(openFolds(p, passing).sort(), ["energy", "more", "size", "taps", ...openFolds(p)].sort());
  resetFolds();
});

test("More options opened on one washer leaves the next washer at its short first view (#407)", async () => {
  resetFolds();
  const ed = await makeEditor([square("r", 0, 0, 6, 6)], [washer("a", 1), washer("b", 3)]);
  ed.selectItem("furniture", "a");
  const p = itemProfile("washer");
  const first = openOf(flat(ed.renderFurnitureForm(ed.furnitureItem)));
  setFoldOpen(p, "more", true, panelUi(ed, "a").folds);
  setFoldOpen(p, "taps", true, panelUi(ed, "a").folds);
  assert.ok(openOf(flat(ed.renderFurnitureForm(ed.furnitureItem))).includes("more"), "open for this washer");
  // the next washer: More options and Taps closed again
  ed.selectItem("furniture", "b");
  assert.deepEqual(openOf(flat(ed.renderFurnitureForm(ed.furnitureItem))), first);
  // and back to the first one: a new selection, closed too
  ed.selectItem("furniture", "a");
  assert.deepEqual(openOf(flat(ed.renderFurnitureForm(ed.furnitureItem))), first);
  resetFolds();
});

test("Appearance closed on one sofa stays closed for the next sofa (#407)", async () => {
  resetFolds();
  const sofa = (id: string) => ({ ...washer(id, 1), type: "sofa" }) as Furniture;
  const ed = await makeEditor([square("r", 0, 0, 6, 6)], [sofa("a"), { ...sofa("b"), x: 3 }]);
  ed.selectItem("furniture", "a");
  assert.ok(openOf(flat(ed.renderFurnitureForm(ed.furnitureItem))).includes("appearance"), "a sofa opens Appearance first");
  setFoldOpen(itemProfile("sofa"), "appearance", false, panelUi(ed, "a").folds);
  ed.selectItem("furniture", "b");
  assert.ok(!openOf(flat(ed.renderFurnitureForm(ed.furnitureItem))).includes("appearance"));
  resetFolds();
});

test("re-rendering the same selection keeps a fold open: a drag or a value change does not close it (#407)", async () => {
  resetFolds();
  const ed = await makeEditor([square("r", 0, 0, 6, 6)], [washer("a", 1)]);
  ed.selectItem("furniture", "a");
  setFoldOpen(itemProfile("washer"), "energy", true, panelUi(ed, "a").folds);
  ed.selectItem("furniture", "a");
  assert.ok(openOf(flat(ed.renderFurnitureForm(ed.furnitureItem))).includes("energy"));
  resetFolds();
});
