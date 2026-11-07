// Home Assistant hands the panel and the card a new `hass` for every state change (#177): they render again only when
// the change touches what their last render read. The 3D view and the room panel still get every new hass.

import assert from "node:assert/strict";
import { test } from "node:test";
import { demoHome } from "./demo-home.fixture.ts";
import type { Building } from "./model.ts";
import type { HomeAssistant } from "./types.ts";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener: () => undefined, removeEventListener: () => undefined });
g.location ??= { search: "" };

const { Floorplan3dPanel } = await import("./panel.ts");
const { Floorplan3dCard } = await import("./card.ts");

const st = (id: string, state: string) => ({ entity_id: id, state, attributes: {} });
function hassWith(states: Record<string, string>): HomeAssistant {
  return {
    language: "en",
    user: { id: "admin", is_admin: true, name: "x" },
    themes: { darkMode: true },
    entities: {},
    states: Object.fromEntries(Object.entries(states).map(([id, s]) => [id, st(id, s)])),
    callService: async () => undefined,
    callWS: async () => undefined,
  } as unknown as HomeAssistant;
}
const changed = (h: HomeAssistant, id: string, state: string) => ({ ...h, states: { ...h.states, [id]: st(id, state) } }) as HomeAssistant;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type El = Record<string, any>;

/** A panel (or card) that rendered `b` with `hass`, its 3D view holding the hass that render handed it. */
function rendered(el: El, b: Building, hass: HomeAssistant) {
  el.hass = hass;
  el.data.building = b;
  el.data.canEdit = true;
  el.data.homeId = "h1";
  el.willUpdate(new Map([["hass", undefined]]));
  el.hassWatch.begin();
  el.render();
  el.hassWatch.end();
  const view = { hass: el.shownHass };
  el.renderRoot = { querySelectorAll: (sel: string) => (sel.split(",").includes("fp3d-view3d") ? [view] : []) };
  return view;
}

/** A new hass arrives; would it render? */
function rendersFor(el: El, next: HomeAssistant): boolean {
  const old = el.hass;
  el.hass = next;
  return el.shouldUpdate(new Map([["hass", old]]));
}

const states = { "light.sample_lounge": "on", "sensor.unrelated": "1" };

test("the panel skips a render for a state it does not show, and the 3D view and the plan's loader still get it (#177)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (Floorplan3dPanel as any)() as El;
  const view = rendered(p, demoHome(false), hassWith(states));
  const next = changed(p.hass, "sensor.unrelated", "2");
  assert.equal(rendersFor(p, next), false);
  assert.equal(view.hass, next);
  assert.equal(p.data.hass, next);
  // a registry or language change renders
  assert.equal(rendersFor(p, { ...next, entities: { x: {} } } as unknown as HomeAssistant), true);
});

test("a demo home's view gets the demo states over the next live hass, also when the panel skips its render (#177)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (Floorplan3dPanel as any)() as El;
  // this Home Assistant has none of the demo's entities: the view shows the demo's own states
  const view = rendered(p, demoHome(), hassWith({ "sensor.unrelated": "1" }));
  assert.equal(view.hass.states["light.sample_lounge"]?.state, "on");
  const next = changed(p.hass, "sensor.unrelated", "2");
  assert.equal(rendersFor(p, next), false);
  assert.equal(view.hass.states["sensor.unrelated"].state, "2");
  assert.equal(view.hass.states["light.sample_lounge"]?.state, "on");
});

test("the card skips a render for a state it does not show and hands the new hass to its 3D view (#177)", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = new (Floorplan3dCard as any)() as El;
  c.setConfig({ type: "custom:home-3d-card" });
  const view = rendered(c, demoHome(false), hassWith(states));
  const next = changed(c.hass, "sensor.unrelated", "2");
  assert.equal(rendersFor(c, next), false);
  assert.equal(view.hass, next);
  // night dimming that follows the sun is a state the card shows
  c.setConfig({ type: "custom:home-3d-card", night: "sun" });
  assert.equal(rendersFor(c, changed(c.hass, "sun.sun", "below_horizon")), true);
});
