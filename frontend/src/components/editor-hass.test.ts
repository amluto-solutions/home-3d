// Home Assistant hands the editor a new `hass` for every state change, several a second in a big home (#130): the
// editor renders again only when the change touches what its last render read, and its entity lists are kept.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import type { HomeAssistant } from "../types.ts";
import { makeEditor, square } from "./editor-harness.ts";

const lamp = (): Furniture => ({ id: "lamp", type: "lamp_floor", x: 2, z: 2, rotation: 0, w: 0.4, d: 0.4, h: 1.5, variant: null, entity: "light.lamp" });
const st = (id: string, state: string) => ({ entity_id: id, state, attributes: { friendly_name: id } });

function hassWith(states: Record<string, string>): HomeAssistant {
  return {
    states: Object.fromEntries(Object.entries(states).map(([id, s]) => [id, st(id, s)])),
    entities: {},
    devices: {},
    areas: {},
    user: { is_admin: true },
    language: "en",
    locale: { language: "en" },
  } as unknown as HomeAssistant;
}
const changed = (h: HomeAssistant, id: string, state: string) => ({ ...h, states: { ...h.states, [id]: st(id, state) } }) as HomeAssistant;

async function lampSelected() {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [lamp()]);
  ed.hass = hassWith({ "light.lamp": "on", "sensor.power": "12", "switch.kettle": "off" });
  ed.selectItem("furniture", "lamp");
  // what a render does: read through the watched hass while drawing the plan (a lit lamp glows) and the item's panel
  ed.hassWatch.begin();
  ed.renderFurniture(ed.floor);
  ed.renderFurnitureForm(ed.furnitureItem);
  ed.hassWatch.end();
  return ed;
}

/** A new hass arrives; would the editor render? */
function rendersFor(ed: Record<string, any>, next: HomeAssistant): boolean {
  const old = ed.hass;
  ed.hass = next;
  return ed.shouldUpdate(new Map([["hass", old]]));
}

test("a state change of an entity the plan and the item's panel do not show needs no render; one of the lamp on the plan does (#130)", async () => {
  const ed = await lampSelected();
  assert.equal(rendersFor(ed, changed(ed.hass, "switch.kettle", "on")), false);
  assert.equal(rendersFor(ed, changed(ed.hass, "sensor.power", "13")), false);
  assert.equal(rendersFor(ed, changed(ed.hass, "light.lamp", "off")), true);
});

test("an entity that comes, or a registry change, renders again (#130)", async () => {
  const ed = await lampSelected();
  assert.equal(rendersFor(ed, changed(ed.hass, "light.new", "on")), true);
  assert.equal(rendersFor(ed, { ...ed.hass, entities: {} } as HomeAssistant), true);
});

test("a skipped render still hands the new hass to the 3D view beside the plan (#130)", async () => {
  const ed = await lampSelected();
  const view = { hass: null as unknown };
  const root = ed.renderRoot as Record<string, unknown>;
  root.querySelectorAll = (sel: string) => (sel === "fp3d-view3d" ? [view] : []);
  const next = changed(ed.hass, "switch.kettle", "on");
  assert.equal(rendersFor(ed, next), false);
  assert.equal(view.hass, next);
});

test("the entity lists of the pickers are made once, not on every render (#130)", async () => {
  const ed = await lampSelected();
  const lights = ed.entityOptions((id: string) => id.startsWith("light."));
  assert.deepEqual(lights.map((o: { id: string }) => o.id), ["light.lamp"]);
  ed.hass = changed(ed.hass, "switch.kettle", "on");
  assert.equal(ed.entityOptions((id: string) => id.startsWith("light.")), lights);
  // a filter that captures something names it, so another value gets its own list
  const without = (own: string) => ed.entityOptions((id: string) => id !== own, own).map((o: { id: string }) => o.id);
  assert.deepEqual(without("light.lamp"), ["sensor.power", "switch.kettle"]);
  assert.deepEqual(without("sensor.power"), ["light.lamp", "switch.kettle"]);
});
