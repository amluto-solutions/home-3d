// Phone layout on the panel (#346): the floor dropdown and the bottom bar.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { emptyBuilding } from "./model.ts";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener: () => undefined, removeEventListener: () => undefined });
g.location = { search: "", hash: "", pathname: "/home_3d" };
g.history = { state: null, replaceState: () => undefined };

const { Floorplan3dPanel } = await import("./panel.ts");

function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol") return "";
  if (typeof v === "function") return "<fn>";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(v);
}

function panel(floorId: string | null) {
  const p = new (Floorplan3dPanel as any)();
  p.hass = { language: "en", user: { id: "u", is_admin: true, name: "x" }, states: {}, themes: { darkMode: true } };
  const b = emptyBuilding();
  const floor = (id: string, name: string, elevation: number) => ({ id, name, rooms: [{ id: `${id}r`, name: "Room", points: [[0, 0], [4, 0], [4, 3], [0, 3]], area_id: null }], furniture: [], placements: [], openings: [], walls: [], height: 2.5, elevation });
  b.floors = [floor("f1", "Ground", 0), floor("f2", "Upper", 2.5)] as unknown as typeof b.floors;
  b.settings.roof = { ...b.settings.roof, type: "gable" };
  p.data.building = b;
  p.data.canEdit = true;
  p.willUpdate(new Map());
  p._floorId = floorId;
  return p;
}

function handlers(v: unknown, re: RegExp, out: ((e?: unknown) => void)[] = []): ((e?: unknown) => void)[] {
  if (Array.isArray(v)) v.forEach((x) => handlers(x, re, out));
  else if (v && typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    r.values.forEach((x, i) => {
      if (typeof x === "function" && re.test(r.strings[i])) out.push(x as () => void);
      handlers(x, re, out);
    });
  }
  return out;
}

test("phones pick the floor from a dropdown: the whole house first, the top floor next, the chosen one selected (#346)", () => {
  const p = panel("f1");
  const bar = p.renderFloorBar(p.data.building, p.data.building.floors[0]);
  const out = flat(bar);
  const pick = out.slice(out.indexOf('<label class="fp3d-floor-pick'));
  assert.match(pick, /^<label class="fp3d-floor-pick fp3d-floor-on">/);
  assert.match(pick, /<select aria-label=Floors/);
  const options = [...pick.matchAll(/<option value="?(\w*)"? \?selected=(true|false)>([^<]*)<\/option>/g)].map((m) => [m[1], m[2], m[3]]);
  assert.deepEqual(options, [
    ["", "false", "Whole house"],
    ["f2", "false", "Upper"],
    ["f1", "true", "Ground"],
  ]);
  const [change] = handlers(bar, /@change=$/);
  change({ target: { value: "f2" } });
  assert.equal(p._floorId, "f2");
  change({ target: { value: "" } });
  assert.equal(p._floorId, null);
  // the chips stay for wider screens; a phone shows the dropdown instead
  const src = readFileSync(new URL("./panel.ts", import.meta.url), "utf8");
  const phone = src.slice(src.indexOf("@media ${unsafeCSS(PHONE_MEDIA)} {\n        .fp3d-header {"));
  assert.match(phone, /\.fp3d-nav \.fp3d-floors \{\s*display: none;\s*\}\s*\.fp3d-floor-pick \{\s*display: block;/);
});

test("the phone bottom bar: one row of 44 px squares, symbols with their names kept, one 3D/2D button (#346)", () => {
  const p = panel("f1");
  p.hasCameras = () => true;
  const out = flat(p.renderView(p.data.building));
  const bar = out.slice(out.indexOf('<div class="fp3d-overlay">'));
  // the segment stays for wider screens; the phone's one button names what it switches to
  assert.match(bar, /class="fp3d-chip fp3d-plan-toggle" title=2D or 3D aria-label=2D or 3D: 2D @click=<fn>>\s*2D\s*</);
  assert.match(bar, /class="fp3d-chip fp3d-view-btn"[\s\S]*?aria-label=View[\s\S]*?<span class="fp3d-bar-icon"><svg[\s\S]*?<span class="fp3d-bar-word">View<\/span>/);
  assert.match(bar, /class="fp3d-chip fp3d-cam-btn" aria-pressed=false aria-label=Cameras[\s\S]*?<span class="fp3d-bar-word">Cameras<\/span>/);
  assert.match(bar, /class="fp3d-chip fp3d-back-btn" aria-label=Back[\s\S]*?<span class="fp3d-bar-word">Back<\/span>/);
  const [toggle] = handlers(p.renderView(p.data.building), /@click=$/).filter((h) => h.toString().includes("setPlan2d(!this._plan2d)"));
  assert.ok(toggle, "the 3D/2D button");
  const src = readFileSync(new URL("./panel.ts", import.meta.url), "utf8");
  const phone = src.slice(src.indexOf("/* one bar along the foot (#346)"));
  assert.match(phone, /\.fp3d-overlay \{\s*left: 108px;\s*right: 8px;[\s\S]*?flex-wrap: nowrap;/);
  assert.match(phone, /\.fp3d-overlay \.fp3d-chip \{[^}]*width: 44px;[^}]*height: 44px;[^}]*border-radius: 14px;/);
  assert.match(phone, /\.fp3d-overlay > \.fp3d-seg \{\s*display: none;/);
  // the star and the eye dock at the bar's start (in a row above a room sheet), except with the controls hidden
  assert.match(phone, /fp3d-view3d \{\s*--fp3d-dock-left: 8px;\s*--fp3d-dock-bottom: calc\(8px \+ env\(safe-area-inset-bottom, 0px\)\);/);
  assert.match(phone, /\.fp3d-room-open fp3d-view3d \{\s*--fp3d-dock-bottom: calc\(var\(--fp3d-sheet-h, 55%\) \+ 18px\);/);
  assert.match(phone, /\.fp3d-clean fp3d-view3d \{\s*--fp3d-dock-left: initial;\s*--fp3d-dock-bottom: initial;/);
  // time travel shows no star: the eye and the bar close the gap
  assert.match(phone, /\.fp3d-tt fp3d-view3d \{\s*--fp3d-dock-left: -42px;/);
  const view = readFileSync(new URL("./components/view3d.ts", import.meta.url), "utf8");
  assert.match(view, /\.fp3d-eye \{\s*left: calc\(var\(--fp3d-dock-left, 12px\) \+ 50px\);\s*bottom: var\(--fp3d-dock-bottom, calc\(10px \+ var\(--fp3d-bottom-inset, 0px\)\)\);/);
  assert.match(view, /\.fp3d-central-btn \{\s*left: var\(--fp3d-dock-left, 12px\);\s*bottom: var\(--fp3d-dock-bottom, calc\(62px \+ var\(--fp3d-bottom-inset, 0px\)\)\);/);
  // seven squares at a 50 px pitch from an 8 px edge end 8 px short of a 360 px screen
  assert.equal(8 + 7 * 44 + 6 * 6 + 8, 360);
});
