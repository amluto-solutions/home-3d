// The Settings tab (#139) on the panel, built in plain Node (no browser), its lit templates flattened to text.
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

const { Floorplan3dPanel, pageOf } = await import("./panel.ts");
const { navHost } = await import("./back-stack.ts");
// the panel as Home Assistant shows it: the host of the history (#322), as connectedCallback makes it
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const host = (p: any) => (p.navRelease = navHost(p.pageNow(), pageOf, p.showPage));

function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol" || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  // a directive (keyed, #322): what it draws is its last value
  if (typeof v === "object" && "_$litDirective$" in (v as object)) return flat((v as { values: unknown[] }).values.at(-1));
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  if (typeof v === "function") return "";
  return String(v);
}

function building(tabletUsers: string[] = []): Building {
  const room = { id: "r1", name: "Kitchen", points: [[0, 0], [4, 0], [4, 3], [0, 3]], area_id: null };
  return {
    floors: [{ id: "f0", name: "Ground", rooms: [room], furniture: [], placements: [], openings: [], walls: [], height: 2.5, elevation: 0 }],
    settings: { roof: { type: "none" }, tablet_users: tabletUsers },
  } as unknown as Building;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function panel(editor: boolean, userId = "u1"): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (Floorplan3dPanel as any)();
  p.hass = { language: "en", user: { id: userId, is_admin: editor, name: "x" }, states: {}, themes: { darkMode: true } };
  p.data.building = building(["wall"]);
  p.data.canEdit = editor;
  p.data.homeName = "Sample Home";
  return p;
}

const shown = (p: { willUpdate(c: Map<string, unknown>): void; render(): unknown }) => {
  p.willUpdate(new Map());
  return flat(p.render());
};

test("everyone has the Settings tab; only editors the Editor and Extensions tabs (#139)", () => {
  at("");
  const viewer = shown(panel(false));
  assert.match(viewer, /fp3d-tab-settings/);
  assert.doesNotMatch(viewer, /fp3d-tab-ext/);
  const editor = shown(panel(true));
  assert.match(editor, /fp3d-tab-settings/);
  assert.match(editor, /fp3d-tab-ext/);
});

test("a #settings/<section>/<id> address opens the Settings tab there; leaving it clears the address", () => {
  at("", "#settings/warnings/alert_unavailable");
  const p = panel(true);
  host(p);
  assert.equal(p._mode, "settings");
  assert.deepEqual(p._settingsAt, { section: "warnings", id: "alert_unavailable" });
  p._settingsReady = true;
  assert.match(shown(p), /fp3d-settings-page/);
  p.setMode("view");
  assert.equal((g.location as { hash: string }).hash, "");
});

test("other parts open the page with an open-settings event; locked tablet mode never shows it", () => {
  at("");
  const p = panel(true);
  host(p);
  let prevented = false;
  p.onOpenSettings({ detail: { section: "look", id: "walls" }, stopPropagation: () => undefined, preventDefault: () => (prevented = true) });
  assert.equal(p._mode, "settings");
  assert.deepEqual(p._settingsAt, { section: "look", id: "walls" });
  assert.equal(prevented, true);
  assert.equal((g.location as { hash: string }).hash, "#settings/look/walls");

  at("?tablet", "#settings");
  const t = panel(false, "wall");
  const text = shown(t);
  assert.equal(t._mode, "view");
  assert.doesNotMatch(text, /fp3d-tab-settings/);
  assert.doesNotMatch(text, /fp3d-settings-page/);
});
