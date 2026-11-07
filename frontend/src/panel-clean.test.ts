// "Hide the controls" (the eye) takes the floor bar with it: Whole house, the floors, Rooms and the search (#317).
import assert from "node:assert/strict";
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

const BAR = ["fp3d-nav", "fp3d-floors", "fp3d-rooms-btn", "fp3d-find-toggle"];

test("with the controls hidden there is no floor bar, whichever floor is open (#317)", () => {
  for (const floor of [null, "f1", "f2"]) {
    const p = panel(floor);
    const shown = flat(p.render());
    for (const c of BAR) assert.ok(shown.includes(c), `${c} while the controls show`);
    p._clean = true;
    const clean = flat(p.render());
    for (const c of BAR) assert.ok(!clean.includes(c), `${c} with the controls hidden (floor ${floor})`);
    assert.match(clean, /fp3d-app fp3d-clean/);
  }
});

test("hiding the controls closes the Rooms list and the search, and the bar's own style hides it too (#317)", () => {
  const p = panel(null);
  p._roomsOpen = true;
  p._findOpen = true;
  const view = flat(p.render()).match(/@clean-toggle=<fn>/);
  assert.ok(view, "the eye is wired");
  // the eye's handler is the template's function: call it through the rendered template values
  const tpl = p.renderView(p.data.building) as { values: unknown[] };
  const toggle = tpl.values.flat(3).find((v) => typeof v === "function" && String(v).includes("clean"));
  assert.ok(toggle, "found the clean-toggle handler");
  (toggle as () => void)();
  assert.equal(p._clean, true);
  assert.equal(p._roomsOpen, false);
  assert.equal(p._findOpen, false);
  const css = String((Floorplan3dPanel as unknown as { styles: unknown }).styles instanceof Array ? ((Floorplan3dPanel as unknown as { styles: { cssText?: string }[] }).styles.map((s) => s.cssText ?? "").join("")) : "");
  assert.match(css, /\.fp3d-clean \.fp3d-nav\s*\{\s*display:\s*none/);
});
