// A bin's kerb spot is easy to find (#226): it sits right under the position fields of the bin's panel, before the
// shape, colours and collection fields; the household bins settings have a button that goes to it.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { SETTINGS } from "../settings/registry.ts";
import { makeEditor, square } from "./editor-harness.ts";

const flat = (v: unknown): string => {
  if (v == null || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  const t = v as { strings?: readonly string[]; values?: unknown[] };
  if (typeof v === "object") return t.strings ? t.strings.map((s, i) => s + (i < t.values!.length ? flat(t.values![i]) : "")).join("") : "";
  return String(v);
};

const bin = (id = "bin", x = 1.5): Furniture => ({ id, type: "waste_bin", x, z: 1.5, rotation: 0, w: 0.58, d: 0.72, h: 1.07, variant: null });

test("a selected bin shows Set kerb spot before its shape, colours and collection fields (#226)", async () => {
  const ed = await makeEditor([square("r1", 0, 0, 6, 6)], [bin()]);
  ed.selectItem("furniture", "bin");
  const out = flat(ed.renderFurnitureForm(ed.furnitureItem));
  const at = (s: string) => out.indexOf(s);
  assert.ok(at("Set kerb spot") > 0, "the button is there");
  for (const later of ["Waste calendar or sensor", "Word in the calendar", "Shape"]) assert.ok(at("Set kerb spot") < at(later), `before "${later}"`);
  assert.equal(out.split("fp3d-kerb-btn").length - 1, 1, "one button, not two");
  // a bin with a spot offers Move and Delete (one word for it, #408)
  ed.updateFurniture({ bin_kerb: { x: 3, z: 4 } });
  const set = flat(ed.renderFurnitureForm(ed.furnitureItem));
  assert.ok(set.includes("Move kerb spot") && set.includes("Delete"));
});

test("the kerb spot is not on other items (#226)", async () => {
  const ed = await makeEditor([square("r1", 0, 0, 6, 6)], [{ ...bin("sofa"), type: "sofa" }]);
  ed.selectItem("furniture", "sofa");
  assert.ok(!flat(ed.renderFurnitureForm(ed.furnitureItem)).includes("kerb spot"));
});

test("goToFurniture selects an item on another floor and shows it (#226)", async () => {
  const ed = await makeEditor([square("r1", 0, 0, 6, 6)], [bin()]);
  ed._doc.floors.push({ ...ed._doc.floors[0], id: "g", furniture: [bin("far", 4)], rooms: [square("r2", 0, 0, 6, 6)] });
  ed._floorId = "f";
  assert.equal(ed.goToFurniture("far"), true);
  assert.equal(ed._floorId, "g");
  assert.equal(ed._furnitureId, "far");
  assert.equal(ed.goToFurniture("nope"), false);
});

test("the household bins settings have a button that goes to the bin's kerb spot (#226)", () => {
  const s = SETTINGS.find((x) => x.id === "household.kerb");
  assert.ok(s && s.card === "bins" && s.control.kind === "action");
  assert.equal((s.control as { action: string }).action, "kerb");
});

test("the kerb spot is a step: the button, one line saying what to do next, and the state (#328)", async () => {
  const ed = await makeEditor([square("r1", 0, 0, 6, 6)], [bin()]);
  ed.selectItem("furniture", "bin");
  const idle = flat(ed.renderFurnitureForm(ed.furnitureItem));
  assert.ok(idle.includes("No kerb spot yet."));
  assert.ok(idle.includes("then tap the plan where the bin stands on collection day"));
  ed._kerbPick = true;
  const picking = flat(ed.renderFurnitureForm(ed.furnitureItem));
  assert.ok(picking.includes("fp3d-kerb-picking") && picking.includes("click where the bin stands"));
  ed._kerbPick = false;
  ed.updateFurniture({ bin_kerb: { x: 3, z: 4 } });
  assert.ok(flat(ed.renderFurnitureForm(ed.furnitureItem)).includes("Kerb spot is set."));
});

test("the two bin tag settings say what changes on the view (#328)", async () => {
  const { englishTable } = await import("../i18n.ts");
  const en = englishTable() as Record<string, string>;
  const next = SETTINGS.find((x) => x.id === "household.bin_next_only")!;
  const days = SETTINGS.find((x) => x.id === "household.bin_days")!;
  assert.equal(en[next.label], "Tag only the bins collected next");
  assert.equal(en[days.label], "Show a bin's tag from this many days before pickup");
  assert.ok(/three days before pickup/.test(en[days.hint!]));
});
