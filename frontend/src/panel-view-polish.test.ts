// The one View panel on the 3D view (#247, the menus redesign #219): it replaces the header's View popover and the
// stage's Show popover, its rows are the Settings page's own (registry.ts), and the rules of the old menus carry over
// (#214: whole-house rows disabled with a hint while one floor is open; #215: each choice once).
import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding } from "./model.ts";
import { englishTable } from "./i18n.ts";
import { settingById, SETTINGS } from "./settings/registry.ts";
import { appearanceOptions, LOOK, optionGroups, optionText, viewSections, type ViewContext } from "./settings/view-settings.ts";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener: () => undefined, removeEventListener: () => undefined });
g.location = { search: "", hash: "", pathname: "/home_3d" };
g.history = { state: null, replaceState: () => undefined };

const { Floorplan3dPanel } = await import("./panel.ts");
const en = englishTable() as Record<string, string>;
const t = (k: string, v?: Record<string, string | number>) => Object.entries(v ?? {}).reduce((s, [n, x]) => s.replace(`{${n}}`, String(x)), en[k] ?? k);

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

const ctx = (o: Partial<ViewContext> = {}): ViewContext => ({ floors: 2, floorOpen: false, roof: true, plan2d: false, kiosk: false, ...o });
const rows = (c: ViewContext, section: string) => viewSections(c).find((s) => s.id === section)?.rows ?? [];

test("one View button on the 3D view: no header popover, no Show chip (#247)", () => {
  const out = flat(panel(null).render());
  assert.ok(!out.includes("fp3d-opts-btn") && !out.includes("fp3d-view-opts"), "the header has no View popover");
  assert.ok(!out.includes("fp3d-show-wrap") && !out.includes(">Show <"), "the stage has no Show chip");
  assert.match(out, /class="fp3d-chip fp3d-view-btn"\s+aria-haspopup="dialog"\s+aria-expanded=false\s+aria-controls="fp3d-view-panel"/);
  assert.ok(!out.includes("<fp3d-view-panel"), "closed: no panel");
  const p = panel(null);
  p.setViewOpen(true);
  const open = flat(p.render());
  assert.match(open, /aria-expanded=true/);
  assert.match(open, /<fp3d-view-panel\s+id="fp3d-view-panel"/);
});

test("Escape closes the View panel first and goes no further up; the next Escape goes up a level (#247)", () => {
  const p = panel("f1");
  p._roomId = "f1r";
  p._viewOpen = true;
  p.onKey({ key: "Escape" });
  assert.equal(p._viewOpen, false);
  assert.equal(p._roomId, "f1r", "the room stays open");
  p.onKey({ key: "Escape" });
  assert.equal(p._roomId, null);
});

test("leaving the 3D view and a wall tablet's quiet return close the View panel", () => {
  const p = panel(null);
  p._viewOpen = true;
  p.setMode("settings");
  assert.equal(p._viewOpen, false);
  const q = panel(null);
  q._viewOpen = true;
  q.returnHome();
  assert.equal(q._viewOpen, false);
});

test("its rows are the Settings page's own entries, under the same stored keys (#247)", () => {
  const keys: string[] = [];
  for (const kiosk of [false, true])
    for (const s of viewSections(ctx({ kiosk, floorOpen: true })))
      for (const r of s.rows) {
        const entry = settingById(r.id);
        assert.ok(entry, r.id);
        assert.ok(SETTINGS.includes(entry!), `${r.id} is in the registry's list`);
        assert.equal(entry, LOOK.find((x) => x.id === r.id), `${r.id}: the very same object`);
        keys.push(...(entry!.prefKeys ?? []));
      }
  for (const k of ["theme", "accent", "walls", "explode", "floor_stack", "heat", "display_hidden", "roof", "trail", "weather", "markers", "pinSize", "clock"]) assert.ok(keys.includes(k), k);
});

test("with one floor open, Floors apart and Keep the roof are there but disabled, with the hint (#214)", () => {
  const whole = rows(ctx(), "show");
  assert.deepEqual(whole.find((r) => r.id === "explode"), { id: "explode", disabled: false });
  assert.deepEqual(whole.find((r) => r.id === "roof"), { id: "roof", disabled: false });
  assert.ok(!whole.some((r) => r.id === "floor_stack"), "Floors below only with a floor open");
  assert.equal(viewSections(ctx()).find((s) => s.id === "show")?.hint, undefined);
  const one = rows(ctx({ floorOpen: true }), "show");
  assert.equal(one.find((r) => r.id === "explode")?.disabled, true);
  assert.equal(one.find((r) => r.id === "roof")?.disabled, true);
  assert.ok(one.some((r) => r.id === "floor_stack"));
  assert.equal(viewSections(ctx({ floorOpen: true })).find((s) => s.id === "show")?.hint, "pick_all_floors");
});

test("each row once (#215); the 2D plan drops the 3D-only rows; one floor and no roof drop theirs", () => {
  for (const c of [ctx(), ctx({ floorOpen: true }), ctx({ plan2d: true }), ctx({ floors: 1, roof: false })]) {
    const ids = viewSections(c).flatMap((s) => s.rows.map((r) => r.id));
    assert.equal(new Set(ids).size, ids.length, JSON.stringify(c));
  }
  const flatPlan = rows(ctx({ plan2d: true }), "show").map((r) => r.id);
  for (const id of ["walls", "explode", "roof", "floor_stack"]) assert.ok(!flatPlan.includes(id), id);
  const single = rows(ctx({ floors: 1, roof: false }), "show").map((r) => r.id);
  assert.deepEqual(single, ["walls", "heat", "display", "trail", "weather", "nav", "flows", "holos", "door_pins"]);
});

test("a wall tablet's View panel offers only what the 3D shows (and 3D or 2D, slotted in) (#92)", () => {
  assert.deepEqual(viewSections(ctx({ kiosk: true })).map((s) => s.id), ["show"]);
  const p = panel(null);
  p._tablet = true;
  p._viewOpen = true;
  const out = flat(p.renderView(p.data.building));
  const at = out.indexOf("<fp3d-view-panel");
  assert.ok(at > 0);
  assert.ok(out.slice(at).includes("aria-label=2D or 3D"), "3D or 2D inside the panel");
  assert.match(out, /<span class="fp3d-bar-word">View<\/span> <span class="fp3d-caret"/, "the chip is called View");
});

test("Appearance is one drop-down: Automatic (each saying what it shows now) and Fixed (#247)", () => {
  const sunUp = { themes: { darkMode: true }, states: { "sun.sun": { state: "above_horizon" } } } as never;
  const groups = optionGroups(appearanceOptions({ hass: sunUp }));
  assert.deepEqual(
    groups.map((x) => [x.group, x.options.map((o) => o.value)]),
    [
      ["theme_group_auto", ["theme", "auto"]],
      ["theme_group_fixed", ["neon", "blueprint", "day", "realistic"]],
    ],
  );
  assert.deepEqual(groups[0].options.map((o) => optionText(o, t)), ["Follow Home Assistant (now Neon)", "Follow the sun (now Day)"]);
  assert.deepEqual(groups[1].options.map((o) => optionText(o, t)), ["Neon", "High contrast", "Day", "Realistic"]);
  assert.equal(en.theme_group_auto, "Automatic");
  assert.equal(en.theme_group_fixed, "Fixed");
  // the Settings page's Appearance row is the same drop-down
  const theme = settingById("theme")!;
  assert.equal(theme.control.kind, "select");
  assert.equal(theme.prefKeys?.[0], "theme");
});

test("Device icons has its four choices in full and a sentence saying what “important” means (#247)", () => {
  const markers = settingById("markers")!;
  const labels = markers.control.kind === "select" ? markers.control.options({} as never).map((o) => en[o.label]) : [];
  assert.deepEqual(labels, ["None", "Only in the room I open", "Important only", "All devices"]);
  assert.equal(viewSections(ctx()).find((s) => s.id === "markers")?.hint, "markers_important_hint");
  assert.match(en.markers_important_hint, /^Important: /);
});
