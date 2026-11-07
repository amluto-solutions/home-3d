// Home Assistant hands the 3D view a new `hass` for every state change, several a second on a wall tablet (#177): the
// view updates only when one the scene shows, or one its last update read, changed.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { HomeAssistant } from "../types.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = await import("./view3d.ts");

const st = (id: string, state: string) => ({ entity_id: id, state, attributes: {} });
const hassWith = (states: Record<string, string>) =>
  ({ language: "en", themes: { darkMode: true }, entities: {}, states: Object.fromEntries(Object.entries(states).map(([id, s]) => [id, st(id, s)])) }) as unknown as HomeAssistant;
const changed = (h: HomeAssistant, id: string, state: string) => ({ ...h, states: { ...h.states, [id]: st(id, state) } }) as HomeAssistant;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type View = Record<string, any>;

/** A view that showed `hass` (the scene watches light.lamp) and whose last update read what `read` reads. */
function view(hass: HomeAssistant, theme = "neon", read: (v: View) => void = () => {}): View {
  const v = new Fp3dView3d() as unknown as View;
  Object.assign(v, { theme, hass, watched: ["light.lamp"] });
  v.renderRoot = { querySelectorAll: () => [] };
  // an update with a new hass: what it reads from willUpdate to the end of updated is noted
  v.hassWatch.begin();
  read(v);
  v.hassWatch.end();
  return v;
}

/** A new hass arrives; would the view update? */
function updatesFor(v: View, next: HomeAssistant): boolean {
  const old = v.hass;
  v.hass = next;
  return v.shouldUpdate(new Map([["hass", old]]));
}

const home = () => hassWith({ "light.lamp": "on", "sensor.unrelated": "1", "sun.sun": "below_horizon" });

test("a state the scene does not show needs no update; a watched light does (#177)", () => {
  const v = view(home());
  assert.equal(updatesFor(v, changed(v.hass, "sensor.unrelated", "2")), false);
  assert.equal(updatesFor(v, changed(v.hass, "light.lamp", "off")), true);
});

test("a state the last update read (the sun, for the look that follows it) updates the view (#177)", () => {
  const v = view(home(), "auto", (x) => x.effectiveTheme());
  assert.equal(updatesFor(v, changed(v.hass, "sensor.unrelated", "2")), false);
  assert.equal(updatesFor(v, changed(v.hass, "sun.sun", "above_horizon")), true);
});

test("a registry, theme or language change always updates; so does anything during a replay (#177)", () => {
  assert.equal(updatesFor(view(home()), { ...home(), entities: { "light.lamp": {} } } as unknown as HomeAssistant), true);
  assert.equal(updatesFor(view(home()), { ...home(), themes: { darkMode: false } } as unknown as HomeAssistant), true);
  const v = view(home());
  v.replay = { t: 0 };
  assert.equal(updatesFor(v, changed(v.hass, "sensor.unrelated", "2")), true);
});

test("an item shown only while its entity is there (#15) updates the view when that entity comes back (#177)", () => {
  const b = { floors: [{ id: "g", furniture: [{ id: "tree", type: "plant", x: 0, z: 0, show_when: { entity: "switch.xmas" } }] }] };
  const v = view(hassWith({ "light.lamp": "on", "sensor.unrelated": "1", "switch.xmas": "unavailable" }));
  v.building = b;
  v.shownPlan = { from: b, hidden: "tree", plan: b };
  assert.equal(updatesFor(v, changed(v.hass, "sensor.unrelated", "2")), false);
  assert.equal(updatesFor(v, changed(v.hass, "switch.xmas", "on")), true);
});

test("a skipped update hands the new hass to the quick menu it drew (#177)", () => {
  const v = view(home());
  const menu = { hass: v.hass };
  v.renderRoot = { querySelectorAll: (sel: string) => (sel.includes("fp3d-quick-menu") ? [menu] : []) };
  const next = changed(v.hass, "sensor.unrelated", "2");
  assert.equal(updatesFor(v, next), false);
  assert.equal(menu.hass, next);
});

test("a device sync during an update notes no reads: it goes through every state (the locating) (#177)", () => {
  const v = view(home());
  let recording: boolean | undefined;
  // no viewer: the sync returns at once, after the guard that pauses the watch
  Object.defineProperty(v, "viewer", { get: () => ((recording = v.hassWatch.recording), null) });
  v.hassWatch.begin();
  v.syncDevices(false);
  v.hassWatch.end();
  assert.equal(recording, false);
});
