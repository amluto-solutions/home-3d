// Changes saved at once from the panel (3D view settings, hiding a room) keep the editor undo history (#384).
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Building } from "./model.ts";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener: () => undefined, removeEventListener: () => undefined });
const at = (search: string, hash = "") => (g.location = { search, hash, pathname: "/home_3d" });
const setUrl = (_s: unknown, _t: string, url?: string) => url !== undefined && ((g.location as { hash: string }).hash = url.includes("#") ? url.slice(url.indexOf("#")) : "");
g.history = { state: null, replaceState: setUrl, pushState: setUrl };
at("");

const { Floorplan3dPanel } = await import("./panel.ts");

function building(): Building {
  const room = { id: "r1", name: "Kitchen", points: [[0, 0], [4, 0], [4, 3], [0, 3]], area_id: null };
  return { floors: [{ id: "f0", name: "Ground", rooms: [room], furniture: [], placements: [], openings: [], walls: [], height: 2.5, elevation: 0 }], settings: { roof: { type: "none" } } } as unknown as Building;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function panel(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (Floorplan3dPanel as any)();
  p.data.building = building();
  p.data.homeId = "h1";
  // the controller: the change is made on its own copy, shown at once
  p.data.update = (change: (b: Building) => void) => {
    const next = structuredClone(p.data.building as Building);
    change(next);
    p.data.building = next;
  };
  return p;
}

test("hiding a room is one more undo step, and an editor opened next keeps the steps (#384)", () => {
  const p = panel();
  const before = p.data.building as Building;
  p.hideRoom("r1", true);
  assert.equal(p.data.building.floors[0].rooms[0].hide_in_picker, true);
  assert.equal(p.undoHistory.steps, 1);
  assert.equal(p.undoHistory.adopt(p.data.building, "h1"), true, "the history is kept");
  assert.equal(p.undoHistory.steps, 1);
  assert.equal(before.floors[0].rooms[0].hide_in_picker, undefined);
});

test("a 3D view plan change is recorded too, and steps pile up (#384)", () => {
  const p = panel();
  p.onPlanChange({ preventDefault: () => undefined, detail: { change: (b: Building) => (b.settings.roof = { type: "flat" } as never) } });
  p.hideRoom("r1", true);
  assert.equal(p.undoHistory.steps, 2);
  assert.equal(p.undoHistory.adopt(p.data.building, "h1"), true);
});
