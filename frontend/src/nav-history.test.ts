// Browser Back and Forward follow every page and pane of the panel (#322): back-stack.ts is the one navigation module,
// the panel (panel.ts) its host. A browser history in plain Node: entries with a state and an address, traversals that
// arrive later (as a browser's do) until `run()`.
import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding } from "./model.ts";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";

const listeners: ((e: { state: unknown }) => void)[] = [];
let entries: { state: unknown; url: string }[] = [{ state: { root: true }, url: "/lovelace/0" }];
let at = 0;
const queued: number[] = [];
const url = () => entries[at]!.url;
g.window = {
  addEventListener: (type: string, fn: (e: { state: unknown }) => void) => type === "popstate" && listeners.push(fn),
  removeEventListener: () => undefined,
};
g.location = {
  get pathname() {
    return url().split(/[?#]/)[0];
  },
  get search() {
    const m = /\?[^#]*/.exec(url());
    return m ? m[0] : "";
  },
  get hash() {
    const i = url().indexOf("#");
    return i < 0 ? "" : url().slice(i);
  },
};
const copy = (s: unknown) => (s === null || s === undefined ? null : JSON.parse(JSON.stringify(s)));
const history = {
  get state() {
    return copy(entries[at]!.state);
  },
  pushState(state: unknown, _t: string, to?: string) {
    entries = entries.slice(0, at + 1);
    entries.push({ state: copy(state), url: to ?? url() });
    at++;
  },
  replaceState(state: unknown, _t: string, to?: string) {
    entries[at] = { state: copy(state), url: to ?? url() };
  },
  back: () => void queued.push(-1),
  forward: () => void queued.push(1),
};
g.history = history;
/** The browser gets round to the traversals asked for: each lands and fires popstate. */
function run(): void {
  while (queued.length) {
    const d = queued.shift()!;
    if (at + d < 0 || at + d >= entries.length) continue;
    at += d;
    for (const fn of listeners) fn({ state: history.state });
  }
}
/** The user presses the browser's Back (or Forward). */
const back = () => (history.back(), run());
const forward = () => (history.forward(), run());
/** Home Assistant opens a page of its own (a link, the sidebar). */
const visit = (to: string) => history.pushState(null, "", to);

const { Floorplan3dPanel, pageOf } = await import("./panel.ts");
const { BackLayers, navHost, navHosted, navEntryOf, openBackLayer } = await import("./back-stack.ts");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Panel = Record<string, any>;

/** The panel as Home Assistant shows it at the address the history stands on: built, then the history's host. */
function panel(): Panel {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (Floorplan3dPanel as any)() as Panel;
  p.hass = { language: "en", user: { id: "u", is_admin: true, name: "x" }, states: {}, themes: { darkMode: true } };
  p.data.building = emptyBuilding();
  p.data.canEdit = true;
  p.navRelease = navHost(p.pageNow(), pageOf, p.showPage);
  return p;
}
/** The panel renders: what is open over the page is kept in step with the history (updated() does this). */
const render = (p: Panel) => p.syncBack(new Map(["_viewOpen", "_roomsOpen", "_findOpen", "_cameraWall", "_micProbe"].map((k) => [k, undefined])));
const settingsEvent = (section: string | null, id: string | null = null) => ({ detail: { section, id }, stopPropagation: () => undefined, preventDefault: () => undefined });

test("the address names a page: the 3D view, the editor, Extensions or a Settings section; other hashes are none of the panel's", () => {
  assert.equal(pageOf(""), "");
  assert.equal(pageOf("#editor"), "#editor");
  assert.equal(pageOf("#extensions"), "#extensions");
  assert.equal(pageOf("#settings"), "#settings");
  assert.equal(pageOf("#settings/look/walls"), "#settings/look/walls");
  assert.equal(pageOf("#something-else"), null);
});

test("every page is an entry: Back and Forward walk the editor, Settings and each Settings section; the address follows", () => {
  visit("/home_3d");
  history.replaceState({ root: true }, "");
  const start = at;
  const p = panel();
  assert.deepEqual(navEntryOf(history.state), { page: "", panes: [] }, "the entry the panel opened on is its own");
  assert.equal(history.state.root, true, "Home Assistant's keys stay");
  p.setMode("editor");
  p.openSettings("look");
  p.openSettings("people", "person_look");
  assert.equal(at, start + 3);
  assert.equal(location.hash, "#settings/people/person_look");
  back();
  assert.equal(p._mode, "settings");
  assert.deepEqual(p._settingsAt, { section: "look", id: null });
  assert.equal(location.hash, "#settings/look");
  back();
  assert.equal(p._mode, "editor");
  back();
  assert.equal(p._mode, "view");
  assert.equal(location.hash, "");
  forward();
  forward();
  assert.equal(p._mode, "settings");
  assert.equal(p.settingsFrom, "editor", "its Back-to button still says where it came from");
  assert.equal(at, start + 2, "walking the history adds no entry");
  p.navRelease();
});

test("the View panel -> 'all settings' -> Back is the View panel again; Back closes it before it leaves the panel", () => {
  visit("/lovelace/0");
  visit("/home_3d");
  const start = at;
  const p = panel();
  p.setViewOpen(true);
  render(p);
  assert.equal(at, start + 1, "the open View panel is an entry");
  // the View panel's "Go to all settings" (view-panel.ts sends open-settings)
  p.onOpenSettings(settingsEvent("look"));
  render(p);
  run();
  assert.equal(p._mode, "settings");
  assert.equal(p._viewOpen, false);
  assert.equal(at, start + 2);
  back();
  assert.equal(p._mode, "view");
  assert.equal(p._viewOpen, true, "Back is the pane the user came from");
  render(p);
  assert.equal(at, start + 1, "the pane opened again takes its entry over: no new one");
  back();
  assert.equal(p._viewOpen, false, "Back closes the pane first");
  assert.equal(p._mode, "view");
  render(p);
  run();
  assert.equal(at, start);
  back();
  assert.equal(location.pathname, "/lovelace/0", "then Back leaves the panel as before");
  forward();
  forward();
  assert.equal(p._viewOpen, true, "Forward opens it again");
  p.navRelease();
});

test("a pane closed by its own button gives its entry back, so Back is not used up on it", () => {
  visit("/home_3d");
  const start = at;
  const p = panel();
  p._roomsOpen = true;
  render(p);
  assert.equal(at, start + 1);
  p.closeRooms(false);
  render(p);
  run();
  assert.equal(at, start);
  // a pane closed and another opened at once: the new entry waits for the step back, then stands where the old was
  p._findOpen = true;
  render(p);
  p._findOpen = false;
  p._roomsOpen = true;
  render(p);
  assert.equal(at, start + 1, "the new entry waits while the step back is on its way");
  run();
  assert.equal(at, start + 1);
  assert.deepEqual(navEntryOf(history.state)?.panes, ["panel:rooms"]);
  back();
  assert.equal(p._roomsOpen, false);
  p.navRelease();
});

test("a Settings address survives a reload, and a link or typed hash inside the panel opens its page", () => {
  visit("/home_3d#settings/look/walls");
  const p = panel();
  assert.equal(p._mode, "settings");
  assert.deepEqual(p._settingsAt, { section: "look", id: "walls" });
  assert.deepEqual(navEntryOf(history.state), { page: "#settings/look/walls", panes: [] });
  p.navRelease();
  visit("/home_3d#editor");
  const e = panel();
  assert.equal(e._mode, "editor");
  // a link inside the panel (Home Assistant's navigate: a new entry, then location-changed)
  visit("/home_3d#extensions");
  e.onHash();
  assert.equal(e._mode, "extensions");
  assert.deepEqual(navEntryOf(history.state), { page: "#extensions", panes: [] }, "the entry becomes the panel's");
  back();
  assert.equal(e._mode, "editor");
  e.navRelease();
});

test("the Settings page's sections are entries; Back to its plain address is its list", () => {
  visit("/home_3d");
  const p = panel();
  p.onOpenSettings(settingsEvent(null));
  const start = at;
  // the page's own section buttons send settings-nav; the panel's handler is the same as openSettings
  p.openSettings("look");
  assert.equal(at, start + 1);
  const key = p.settingsKey;
  back();
  assert.deepEqual(p._settingsAt, { section: null, id: null });
  assert.equal(location.hash, "#settings");
  assert.equal(p.settingsKey, key + 1, "the page is drawn afresh: its list on a phone, the first section elsewhere");
  p.navRelease();
});

test("a dashboard card never adds an entry or takes the dashboard's Back; Home Assistant's dialog is never copied", () => {
  visit("/lovelace/0");
  const start = at;
  assert.equal(navHosted(), false, "no panel: no host");
  const card = new BackLayers("view3d", navHosted);
  card.sync("menu", true, () => undefined);
  assert.equal(at, start);
  // the panel is the host, but this page is a dashboard
  visit("/home_3d");
  const p = panel();
  visit("/lovelace/1");
  assert.equal(navHosted(), false);
  const two = at;
  new BackLayers("view3d", navHosted).sync("sheet", true, () => undefined);
  assert.equal(at, two);
  p.navRelease();
  // Home Assistant's more-info dialog in the entry is its own: a pane's entry keeps the rest only
  visit("/home_3d");
  const q = panel();
  history.replaceState({ ...history.state, dialog: { name: "more-info" } }, "");
  const release = openBackLayer(() => undefined, "test:pane");
  assert.equal(history.state.dialog, undefined);
  assert.ok(navEntryOf(history.state));
  release();
  run();
  q.navRelease();
});

test("Back leaving the panel closes what is open, and the panel's page stays as it was", () => {
  visit("/lovelace/0");
  visit("/home_3d");
  const p = panel();
  p._findOpen = true;
  render(p);
  // the browser goes back past the panel's entries in one step (a long press on Back)
  history.back();
  history.back();
  run();
  assert.equal(location.pathname, "/lovelace/0");
  assert.equal(p._findOpen, false);
  assert.equal(p._mode, "view");
  p.navRelease();
});

test("a picked floor and an open room are steps of Back, as the bar's Back button takes them (#346)", () => {
  visit("/home_3d");
  const start = at;
  const p = panel();
  const floor = (id: string) => ({ id, name: id, rooms: [{ id: `${id}r`, name: "Room", points: [[0, 0], [4, 0], [4, 3], [0, 3]], area_id: null }], furniture: [], placements: [], openings: [], walls: [], height: 2.5, elevation: 0 });
  p.data.building.floors = [floor("f1"), floor("f2")];
  const step = () => p.syncBack(new Map([["_floorId", undefined], ["_roomId", undefined]]));
  p._floorId = "f1";
  step();
  assert.equal(at, start + 1, "a floor is an entry");
  p._floorId = "f2";
  step();
  assert.equal(at, start + 1, "another floor is the same step");
  p._roomId = "f2r";
  step();
  assert.equal(at, start + 2, "a room on it is the next");
  back();
  assert.equal(p._roomId, null, "Back closes the room first");
  assert.equal(p._floorId, "f2");
  back();
  assert.equal(p._floorId, null, "then the whole house");
  forward();
  assert.equal(p._floorId, "f2", "Forward picks the floor again");
  // the bar's Back button: the same step, and its entry goes with it
  p._roomId = "f2r";
  step();
  const there = at;
  p.back();
  step();
  run();
  assert.equal(p._roomId, null);
  assert.equal(at, there - 1, "the room's entry goes with it");
  p.navRelease();
});
