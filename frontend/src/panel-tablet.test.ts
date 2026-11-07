// The panel in locked tablet mode (#92): built in plain Node (no browser), its lit templates flattened to text.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Building } from "./model.ts";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
const listeners = new Map<string, Set<() => void>>();
g.window ??= {};
Object.assign(g.window as object, {
  addEventListener: (type: string, fn: () => void) => listeners.set(type, (listeners.get(type) ?? new Set()).add(fn)),
  removeEventListener: (type: string, fn: () => void) => listeners.get(type)?.delete(fn),
});
const fire = (type: string) => listeners.get(type)?.forEach((fn) => fn());
const at = (search: string) => (g.location = { search });
at("");

const { Floorplan3dPanel } = await import("./panel.ts");

/** The text and attribute names of a lit template, nested templates and lists included. */
function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol" || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  if (typeof v === "function") return "";
  return String(v);
}

function building(tabletUsers: string[] = [], idle: number | null = null): Building {
  const room = (id: string, name: string) => ({ id, name, points: [[0, 0], [4, 0], [4, 3], [0, 3]], area_id: null });
  return {
    floors: [
      { id: "f0", name: "Ground", rooms: [room("r1", "Kitchen")], furniture: [], placements: [], openings: [], walls: [], height: 2.5, elevation: 0 },
      { id: "f1", name: "Upstairs", rooms: [room("r2", "Study")], furniture: [], placements: [], openings: [], walls: [], height: 2.5, elevation: 2.5 },
    ],
    settings: { roof: { type: "none" }, tablet_users: tabletUsers, tablet_idle: idle },
  } as unknown as Building;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function panel(b: Building, userId = "admin"): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (Floorplan3dPanel as any)();
  p.hass = { language: "en", user: { id: userId, is_admin: true, name: "x" }, states: {}, themes: { darkMode: true } };
  p.data.building = b;
  p.data.canEdit = true;
  p.data.homeName = "Sample Home";
  p.data.homeId = "h1";
  return p;
}

function shown(p: { willUpdate(c: Map<string, unknown>): void; render(): unknown }): string {
  p.willUpdate(new Map());
  return flat(p.render());
}

test("an editor sees the tabs, the home switcher and the View button without tablet mode", () => {
  at("");
  const text = shown(panel(building()));
  assert.match(text, /fp3d-home-switcher/);
  assert.match(text, /<nav class="fp3d-tabs" aria-label=Mode>/);
  assert.match(text, /fp3d-view-btn/);
  assert.match(text, /fp3d-tt-chip/);
});

test("?tablet shows only the home name, the floors and a View menu: no tabs, switcher, view settings or Rooms picker (#92, #249)", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  at("?tablet");
  const text = shown(panel(building()));
  assert.match(text, /Sample Home/);
  assert.doesNotMatch(text, /fp3d-home-switcher/);
  assert.doesNotMatch(text, /<nav class="fp3d-tabs" aria-label=Mode>/);
  assert.doesNotMatch(text, /fp3d-tt-chip/);
  assert.doesNotMatch(text, /fp3d-rooms-btn/);
  assert.match(text, /Ground/);
  assert.match(text, /Upstairs/);
  // the one View button (#247): on a tablet its panel holds 3D or 2D and what the 3D shows
  assert.match(text, /fp3d-view-btn/);
});

test("a user ticked as a wall tablet gets the locked view, and the Editor stays shut for them (#92)", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  at("");
  const p = panel(building(["wall"]), "wall");
  assert.doesNotMatch(shown(p), /<nav class="fp3d-tabs" aria-label=Mode>/);
  p.setMode("editor");
  assert.equal(p._mode, "view");
  at("?tablet=0");
  assert.match(shown(p), /<nav class="fp3d-tabs" aria-label=Mode>/);
});

test("a tablet goes back to the whole house after the plan's idle time; a touch restarts the wait (#92)", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  at("?tablet");
  const p = panel(building([], 30));
  shown(p);
  p._floorId = "f1";
  p._roomId = "r2";
  p._viewOpen = true;
  t.mock.timers.tick(20000);
  fire("pointerdown");
  t.mock.timers.tick(20000);
  assert.equal(p._roomId, "r2");
  t.mock.timers.tick(10000);
  assert.equal(p._roomId, null);
  assert.equal(p._floorId, null);
  assert.equal(p._viewOpen, false);
  const heard = listeners.get("pointerdown")?.size ?? 0;
  at("?tablet=0");
  shown(p);
  assert.equal(listeners.get("pointerdown")?.size ?? 0, heard - 1, "its touch listener goes once tablet mode is off");
});
