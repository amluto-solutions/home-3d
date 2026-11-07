// The floor bar (#222, #224, #249): the floors in one row and one Rooms picker (option B of the redesign #219) instead
// of a chip per room; the wrap toggle went with the chips.
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
  const p = new (Floorplan3dPanel as any)();
  p.hass = { language: "en", user: { id: "u", is_admin: true, name: "x" }, states: {}, themes: { darkMode: true } };
  const b = emptyBuilding();
  const floor = (id: string, name: string, elevation: number) => ({ id, name, rooms: [{ id: `${id}r`, name: "Room", points: [[0, 0], [4, 0], [4, 3], [0, 3]], area_id: null }], furniture: [], placements: [], openings: [], walls: [], height: 2.5, elevation });
  b.floors = [floor("f1", "Ground", 0), floor("f2", "Upper", 2.5)] as unknown as typeof b.floors;
  b.settings.roof = { ...b.settings.roof, type: "gable" };
  p.data.building = b;
  p.data.canEdit = true;
  p.willUpdate(new Map());
  p._viewOpen = true;
  p._floorId = floorId;
  return p;
}

test("the floor bar: Whole house and every floor in one row; no room chips, one Rooms picker (#222, #249)", () => {
  const all = flat(panel(null).render());
  assert.ok(all.includes("Whole house") && all.includes("Ground") && all.includes("Upper"));
  assert.match(all, /class="fp3d-seg fp3d-floors"/);
  assert.ok(!all.includes("fp3d-room-chip"), "no room chips");
  assert.match(all, /fp3d-rooms-btn/);
  const p = panel("f1");
  p._roomsOpen = true;
  const one = flat(p.render());
  assert.match(one, /<fp3d-rooms-picker/, "the picker opens from its button");
  // the picked floor's rooms, or every floor's under the whole house (top floor first)
  assert.deepEqual(p.roomGroups(p.data.building, p.data.building.floors[0]).map((g: { id: string }) => g.id), ["f1"]);
  assert.deepEqual(p.roomGroups(p.data.building, undefined).map((g: { id: string }) => g.id), ["f2", "f1"]);
});

test("the wrap toggle is gone: nothing is left to wrap (#224, #249)", () => {
  const out = flat(panel("f1").render());
  assert.doesNotMatch(out, /fp3d-nav-toggle|fp3d-nav-wrap/);
});
