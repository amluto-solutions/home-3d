import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor } from "../model.ts";

// the editor's bundle hashes are build-time constants: plain strings will do here
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dEditor } = (await import("./editor.ts")) as unknown as { Fp3dEditor: new () => Record<string, any> };

/** A lit template as flat text (strings with their values), enough to see what comes in which order. */
const flat = (v: unknown): string => {
  if (v == null || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  const t = v as { strings?: readonly string[]; values?: unknown[] };
  if (typeof v === "object") return t.strings ? t.strings.map((s, i) => s + (i < t.values!.length ? flat(t.values![i]) : "")).join("") : "";
  return String(v);
};

/** The roof tool's sidebar of a two-floor home. */
function roofPanel(): string {
  const b = emptyBuilding();
  b.floors.push(newFloor("g", "Ground", 0), newFloor("u", "Upstairs", 2.7));
  const el = new Fp3dEditor();
  el._doc = b;
  el._floorId = "g";
  el.canEdit = true;
  el.hass = { language: "en", areas: {}, states: {}, entities: {}, devices: {}, user: { is_admin: true } };
  el._tool = "roof";
  return flat(el.renderRoofPanel());
}

test("the roof shape is labelled for the whole building and sits above, not inside, the per-floor buttons (#68)", () => {
  const panel = roofPanel();
  const roof = panel.indexOf("Roof (whole building)");
  const floors = panel.indexOf("fp3d-roof-floors");
  assert.ok(roof >= 0, "labelled 'Roof (whole building)'");
  assert.ok(floors > roof, "the floor buttons come after the roof's own settings");
  // the shape presets stay
  for (const p of ["none", "flat", "gable", "custom"]) assert.ok(panel.includes(`<option value=${p} `), p);
});

test("the per-floor buttons say they only pick the floor shown to draw along (#68)", () => {
  const panel = roofPanel();
  const floors = panel.slice(panel.indexOf("fp3d-roof-floors"));
  assert.match(floors, /Floor shown/);
});
