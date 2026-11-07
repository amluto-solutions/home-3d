import assert from "node:assert/strict";
import { test } from "node:test";
import { EntityOptionCache, rankOptions } from "./entity-options.ts";
import type { HomeAssistant } from "./types.ts";

const st = (id: string, name: string) => ({ entity_id: id, state: "on", attributes: { friendly_name: name } });
function hassOf(ids: [string, string][], area?: string): HomeAssistant {
  return {
    states: Object.fromEntries(ids.map(([id, name]) => [id, st(id, name)])),
    entities: Object.fromEntries(ids.map(([id]) => [id, { entity_id: id, area_id: area ?? null }])),
    areas: area ? { [area]: { area_id: area, name: "Kitchen" } } : {},
    devices: {},
  } as unknown as HomeAssistant;
}

test("an entity list is sorted by name and carries the entity's area (#130)", () => {
  const cache = new EntityOptionCache();
  const hass = hassOf([["light.b", "Bulb"], ["light.a", "Ceiling"], ["switch.x", "Kettle"]], "kitchen");
  assert.deepEqual(cache.get(hass, "lights", (id) => id.startsWith("light.")), [
    { id: "light.b", label: "Bulb · Kitchen", area: "kitchen" },
    { id: "light.a", label: "Ceiling · Kitchen", area: "kitchen" },
  ]);
});

test("a list asked for again under the same key is not made again while no entity came, went or changed in the registry (#130)", () => {
  const cache = new EntityOptionCache();
  let calls = 0;
  const lights = (id: string) => (calls++, id.startsWith("light."));
  const hass = hassOf([["light.a", "A"], ["switch.x", "X"]]);
  const first = cache.get(hass, "lights", lights);
  // a new hass object for a state change (same registry, same entities): a new filter closure, same key
  const next = { ...hass, states: { ...hass.states, "light.a": { ...hass.states["light.a"], state: "off" } } } as HomeAssistant;
  const again = cache.get(next, "lights", (id) => (calls++, id.startsWith("light.")));
  assert.equal(again, first);
  assert.equal(calls, 2);
});

test("a new entity, a registry change or an area rename makes the list again (#130)", () => {
  const cache = new EntityOptionCache();
  const lights = (id: string) => id.startsWith("light.");
  const hass = hassOf([["light.a", "A"]], "kitchen");
  const first = cache.get(hass, "lights", lights);
  const added = { ...hass, states: { ...hass.states, "light.b": st("light.b", "B") } } as HomeAssistant;
  assert.deepEqual(cache.get(added, "lights", lights).map((o) => o.id), ["light.a", "light.b"]);
  const renamed = { ...added, areas: { kitchen: { area_id: "kitchen", name: "Galley" } } } as unknown as HomeAssistant;
  assert.equal(cache.get(renamed, "lights", lights)[0].label, "A · Galley");
  const registry = { ...renamed, entities: { ...renamed.entities } } as HomeAssistant;
  assert.notEqual(cache.get(registry, "lights", lights), first);
});

test("different keys keep different lists (#130)", () => {
  const cache = new EntityOptionCache();
  const hass = hassOf([["light.a", "A"], ["switch.x", "X"]]);
  assert.deepEqual(cache.get(hass, "lights", (id) => id.startsWith("light.")).map((o) => o.id), ["light.a"]);
  assert.deepEqual(cache.get(hass, "switches", (id) => id.startsWith("switch.")).map((o) => o.id), ["switch.x"]);
  assert.deepEqual(cache.get(hass, "lights", () => true).map((o) => o.id), ["light.a"]);
});

test("without a key the filter function itself is the key (a module's field keeps its filter) (#130)", () => {
  const cache = new EntityOptionCache();
  const hass = hassOf([["light.a", "A"], ["switch.x", "X"]]);
  const f = (id: string) => id.startsWith("switch.");
  const first = cache.get(hass, f, f);
  assert.equal(cache.get(hass, f, f), first);
  assert.deepEqual(cache.get(hass, (id: string) => id.startsWith("light."), (id) => id.startsWith("light.")).map((o) => o.id), ["light.a"]);
});

test("likely entities come first: the room's area, then the link's own domain, else by name (#132)", () => {
  const options = [
    { id: "sensor.attic_temp", label: "Attic temperature" },
    { id: "switch.boiler_plug", label: "Boiler plug", area: "utility" },
    { id: "climate.hall", label: "Hall thermostat", area: "hall" },
    { id: "climate.lounge", label: "Lounge thermostat", area: "lounge" },
    { id: "sensor.lounge_temp", label: "Lounge temperature", area: "lounge" },
  ];
  const ids = (list: readonly { id: string }[]) => list.map((o) => o.id);
  assert.deepEqual(ids(rankOptions(options, { area: "lounge", domains: ["climate"] })), [
    "climate.lounge",
    "sensor.lounge_temp",
    "climate.hall",
    "sensor.attic_temp",
    "switch.boiler_plug",
  ]);
  // nothing to go by: the list as it was (and the same list, not a copy)
  assert.equal(rankOptions(options, {}), options);
  // a cached list is never changed in place (#130)
  assert.equal(options[0].id, "sensor.attic_temp");
});
