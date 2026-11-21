// Card option `surroundings: false` (#492): the card draws the house without the map; the plan keeps it; the card form
// offers the switch only when the plan has surroundings. Ported from NeonPlan 3D 4.0.0 (MIT, Mastershort), with our own tests.
import assert from "node:assert/strict";
import { test } from "node:test";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = await import("./components/view3d.ts");
const { Floorplan3dCardEditor } = (await import("./card-editor.ts")) as unknown as { Floorplan3dCardEditor: { new (): Record<string, any> } };

type View = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function flat(t: unknown): string {
  if (t == null || t === false) return "";
  if (Array.isArray(t)) return t.map(flat).join("");
  if (typeof t === "object" && "strings" in (t as object)) {
    const r = t as { strings: string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(t);
}

const plan = () => ({ floors: [], settings: { surroundings: { on: true, buildings: [] } } });
const viewOf = (): View => {
  const v = new Fp3dView3d() as unknown as View;
  v.hass = { language: "en", themes: { darkMode: true }, entities: {}, states: {} };
  return v;
};

test("by default the view draws the map; surroundings=false leaves it out of the shown plan, the plan itself keeps it", () => {
  const b = plan();
  const v = viewOf();
  assert.equal(v.surroundings, true);
  assert.equal(v.viewPlan(b), b, "the whole plan");
  assert.equal(v.mapShown(), false, "no building set yet");
  v.building = b;
  assert.equal(v.mapShown(), true);
  v.surroundings = false;
  const shown = v.viewPlan(b);
  assert.equal(shown.settings.surroundings, null);
  assert.ok(b.settings.surroundings, "the plan keeps its surroundings");
  assert.equal(v.viewPlan(b), shown, "the same object again, so the viewer does not rebuild");
  assert.equal(v.mapShown(), false, "no OpenStreetMap credit without the map");
});

test("a plan without surroundings is handed over as it is", () => {
  const b = { floors: [], settings: {} };
  const v = viewOf();
  v.surroundings = false;
  assert.equal(v.viewPlan(b), b);
});

test("the card hands its option to the viewer and the config type knows the key", async () => {
  const { readFileSync } = await import("node:fs");
  const card = readFileSync(new URL("./card.ts", import.meta.url), "utf8");
  assert.match(card, /\.surroundings=\$\{c\?\.surroundings !== false\}/);
  const cfg = readFileSync(new URL("./card-config.ts", import.meta.url), "utf8");
  assert.match(cfg, /surroundings\?: boolean;/);
});

test("the card form offers the switch only when the plan has surroundings, on by default", () => {
  const el = new Floorplan3dCardEditor();
  el.hass = { language: "en" };
  el._config = { type: "custom:home-3d-card" };
  el._floors = [];
  el._styles = [];
  el._hasMap = false;
  assert.doesNotMatch(flat(el.render()), /Show the surroundings from the map/);
  el._hasMap = true;
  const text = flat(el.render());
  assert.match(text, /Show the surroundings from the map/);
  assert.match(text, /calmer on a small screen/);
  assert.equal(el.value.surroundings, true);
  el._config = { type: "custom:home-3d-card", surroundings: false };
  assert.equal(el.value.surroundings, false);
});
