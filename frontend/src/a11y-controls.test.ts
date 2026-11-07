// The mode switcher is a group of pressed buttons, and overlay cards work from the keyboard (#180).
import assert from "node:assert/strict";
import { test } from "node:test";
import { activateKey } from "./activate-key.ts";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener: () => undefined, removeEventListener: () => undefined });
g.location = { search: "", hash: "", pathname: "/home_3d" };
g.history = { state: null, replaceState: () => undefined };

const { Floorplan3dPanel } = await import("./panel.ts");
const { Fp3dView3d } = (await import("./components/view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any> } };

function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(v);
}

test("the tabs are named navigation, the open one aria-current=page, not a half-built tab list (#180, #249)", () => {
  const p = new (Floorplan3dPanel as any)();
  p.hass = { language: "en", user: { id: "u", is_admin: true, name: "x" }, states: {}, themes: { darkMode: true } };
  p.data.building = { floors: [], settings: {} };
  p.data.canEdit = true;
  p.willUpdate(new Map());
  const out = flat(p.render());
  assert.doesNotMatch(out, /role="tab/);
  assert.match(out, /<nav class="fp3d-tabs" aria-label=Mode>/);
  assert.match(out, /class="fp3d-tab fp3d-tab-view" aria-current=page aria-label=3D/);
  assert.match(out, /class="fp3d-tab fp3d-tab-settings" aria-current= aria-label=Settings/);
  assert.doesNotMatch(out, /fp3d-tab[^>]*aria-pressed/, "tabs are not toggles");
});

test("a card opens on Enter and Space, but a key on a control inside it is left alone (#180)", () => {
  let n = 0;
  const key = activateKey(() => n++);
  const card = {};
  const press = (k: string, target: object) => {
    let prevented = false;
    key({ key: k, target, currentTarget: card, preventDefault: () => (prevented = true) } as unknown as KeyboardEvent);
    return prevented;
  };
  assert.equal(press("Enter", card), true);
  assert.equal(press(" ", card), true);
  assert.equal(press("a", card), false);
  assert.equal(press("Enter", {}), false);
  assert.equal(n, 2);
});

test("the device card is a button with a name that has its value, a state, and a key handler (#180)", () => {
  const el = new Fp3dView3d();
  el.hass = { language: "en", locale: { language: "en", number_format: "language" }, states: {}, config: { unit_system: {} } };
  const out = flat(el.renderDeviceCard({ kind: "device", name: "Kettle", w: 2000 }, 0));
  assert.match(out, /role="button" tabindex="0" aria-expanded=true aria-label=Kettle: 2 kW @click=/);
  const tpl = el.renderDeviceCard({ kind: "device", name: "Kettle", w: 2000 }, 0) as { values: unknown[] };
  assert.ok(tpl.values.filter((v) => typeof v === "function").length >= 2, "click and keydown handlers");
});
