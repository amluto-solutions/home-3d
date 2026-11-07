// The room panel (owner feedback 4 Nov): no clock or weather while it is open (#352), a sheet whose height can be
// dragged (#353), closing keeps the room selected and in view (#354).
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

const src = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const { Fp3dView3d } = (await import("./components/view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any> } };

const tap = (p: any, roomId: string) => p.onRoomTap(new CustomEvent("room-tap", { detail: { floorId: "f1", roomId } }));
const update = (p: any, prev: Record<string, unknown>) => p.willUpdate(new Map(Object.entries(prev)));

test("closing the room panel keeps the room selected; a tap on the room opens its panel again (#354)", () => {
  const p = panel("f1");
  tap(p, "f1r");
  update(p, { _roomId: null });
  assert.equal(p._roomId, "f1r");
  assert.equal(p.roomPanelShown, true);
  assert.match(flat(p.render()), /<fp3d-room-panel/);
  // the X
  const close = handlers(p.render(), /@close=$/);
  close.at(-1)!();
  assert.equal(p._roomId, "f1r", "the room stays selected (the camera stays on it)");
  assert.equal(p.roomPanelShown, false);
  assert.doesNotMatch(flat(p.render()), /<fp3d-room-panel/);
  assert.doesNotMatch(flat(p.render()), /fp3d-room-open/, "the sheet's room is given back to the view");
  // tapping the same room brings the panel back instead of leaving the room
  tap(p, "f1r");
  assert.equal(p._roomId, "f1r");
  assert.equal(p.roomPanelShown, true);
  // a second tap with the panel showing still leaves the room, as before
  tap(p, "f1r");
  assert.equal(p._roomId, null);
});

test("a closed panel opens again when another room (or the same room later) is picked (#354)", () => {
  const p = panel("f1");
  p._roomId = "f1r";
  p._shutRoom = "f1r";
  p._roomId = null;
  update(p, { _roomId: "f1r" });
  assert.equal(p._shutRoom, null, "leaving the room forgets the closed panel");
  p._roomId = "f1r";
  update(p, { _roomId: null });
  assert.equal(p.roomPanelShown, true);
});

test("the card closes its panel the same way (#354)", () => {
  const code = src("./card.ts");
  assert.match(code, /@close=\$\{\(\) => \(this\._shutRoom = this\._roomId\)\}/);
  assert.match(code, /e\.detail\.roomId === this\._roomId && this\._shutRoom === this\._roomId/);
  assert.doesNotMatch(code, /@close=\$\{\(\) => \(this\._roomId = null\)\}/);
});

test("no clock or weather tile while a room panel is open (#352)", () => {
  const el = new Fp3dView3d();
  el.hass = { language: "en", locale: { language: "en", time_format: "24" }, states: {}, config: { time_zone: "UTC" } };
  el.clock = "tr";
  el.now = () => Date.parse("2026-11-04T05:56:00Z");
  assert.match(flat(el.renderClock()), /fp3d-clock/);
  el.panelOpen = true;
  assert.equal(flat(el.renderClock()), "");
  el.panelOpen = false;
  assert.match(flat(el.renderClock()), /fp3d-clock/);
  // the clock's timer stops, so the test run ends
  el.clock = "off";
  el.renderClock();
});

test("the sheet takes its dragged height from --fp3d-sheet-h, the view's buttons step up with it (#353)", () => {
  const room = src("./components/room-panel.ts");
  assert.match(room, /class="fp3d-rp-grab"/);
  assert.match(room, /new SheetResize\(this, "room_sheet"\)/);
  const panelCss = src("./panel.ts");
  assert.match(panelCss, /height: var\(--fp3d-sheet-h, 55%\)/);
  assert.match(panelCss, /--fp3d-bottom-inset: calc\(var\(--fp3d-sheet-h, 55%\) \+ 8px\)/);
  assert.match(src("./card.ts"), /height: var\(--fp3d-sheet-h, 55%\)/);
});

test("the sheet is told by the stylesheet's --fp3d-sheet, not by top (a computed top is in pixels) (#353)", () => {
  const fp = src("./float-panel.ts");
  assert.doesNotMatch(fp, /\.top === "auto"/);
  assert.match(fp, /getPropertyValue\("--fp3d-sheet"\)/);
  assert.match(src("./components/room-panel.ts"), /:host \{\s*--fp3d-sheet: 1;\s*\}/);
});
