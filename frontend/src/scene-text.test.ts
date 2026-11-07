// The 3D view and the plan have a text equivalent and a keyboard route (#195, A11Y-3).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener: () => undefined, removeEventListener: () => undefined });
g.location = { search: "", hash: "", pathname: "/home_3d" };
g.history = { state: null, replaceState: () => undefined };

const { Fp3dView3d } = (await import("./components/view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any> } };
const { emptyBuilding, newFloor } = await import("./model.ts");

function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(v);
}

test("the room list names every room with its state and opens the room on a click (#195)", () => {
  const el = new Fp3dView3d();
  const building = emptyBuilding();
  building.floors = [
    { ...newFloor("g", "Ground", 0), rooms: [{ id: "lounge", name: "Lounge", area_id: "lounge", points: [[0, 0], [4, 0], [4, 3], [0, 3]], floor_material: "wood" }] },
  ];
  el.building = building;
  el.hass = {
    language: "en",
    locale: { language: "en", number_format: "language" },
    config: { unit_system: { temperature: "°C" } },
    entities: { "light.a": { entity_id: "light.a", area_id: "lounge" } },
    areas: { lounge: { area_id: "lounge", name: "Lounge" } },
    states: { "light.a": { entity_id: "light.a", state: "on", attributes: {} } },
  };
  el._alerts = [];
  const tpl = el.renderRoomList();
  const out = flat(tpl);
  assert.match(out, /<nav class="fp3d-sr-rooms" aria-label=Rooms>/);
  assert.match(out, /<section aria-label=Ground>/);
  assert.match(out, /<button type="button" @click=>Lounge: 1 of 1 lights on<[/]button>/);
  // a click fires the same event as a tap on the room
  const events: { type: string; detail: unknown }[] = [];
  el.dispatchEvent = (e: CustomEvent) => (events.push({ type: e.type, detail: e.detail }), true);
  findHandler(tpl)();
  assert.deepEqual(events, [{ type: "room-tap", detail: { floorId: "g", roomId: "lounge" } }]);
  // nothing to list without a building, and not while walking through the house
  el.building = null;
  assert.equal(flat(el.renderRoomList()), "");
});

function findHandler(tpl: unknown): () => void {
  const seen: unknown[] = [tpl];
  while (seen.length) {
    const v = seen.pop();
    if (typeof v === "function") return v as () => void;
    if (Array.isArray(v)) seen.push(...v);
    else if (v && typeof v === "object" && "values" in (v as object)) seen.push(...(v as { values: unknown[] }).values);
  }
  throw new Error("no handler");
}

test("the canvas and the plan are reachable by keyboard and named (#195)", () => {
  const v3 = readFileSync(new URL("./viewer/viewer3d.ts", import.meta.url), "utf8");
  assert.match(v3, /domElement\.tabIndex = 0/);
  assert.match(v3, /setAttribute\("role", "application"\)/);
  assert.match(v3, /keys: \(\) => !this\.furnish/, "the arrow keys keep nudging the selection while furnishing");
  const v2 = readFileSync(new URL("./plan2d/viewer2d.ts", import.meta.url), "utf8");
  assert.match(v2, /r\.tabIndex = 0/);
  assert.match(v2, /setDescription\(label: string\)/);
  const view = readFileSync(new URL("./components/view3d.ts", import.meta.url), "utf8");
  assert.match(view, /setDescription\(\(this\.sceneLabel = translate\(this\.hass, flat \? "sr_plan" : "sr_scene"\)\)\)/);
});
