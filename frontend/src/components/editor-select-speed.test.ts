// Selection speed (#392): the entity lists count the states once per states object, not on every call, and a new
// selection sets the side panel back to its top only when it was scrolled down (setting scrollTop forces a layout).
import assert from "node:assert/strict";
import { test } from "node:test";
import { stateCount } from "../hass-watch.ts";
import { EntityOptionCache } from "../entity-options.ts";
import type { HomeAssistant } from "../types.ts";
import { editorSource } from "./editor-source.ts";

test("a states object is counted once; a new one (an entity came) is counted again", () => {
  let reads = 0;
  const states = new Proxy({ "light.sample_lounge": {}, "sensor.sample_power": {} }, { ownKeys: (t) => (reads++, Reflect.ownKeys(t)) });
  assert.equal(stateCount(states), 2);
  assert.equal(stateCount(states), 2);
  assert.equal(reads, 1);
  assert.equal(stateCount({ ...states, "light.sample_new": {} }), 3);
  assert.equal(stateCount(undefined), 0);
});

test("the option cache keeps its lists while the states object only changes values, and drops them when one came", () => {
  const cache = new EntityOptionCache();
  const st = (id: string) => ({ entity_id: id, state: "on", attributes: {} });
  const h1 = { states: { "light.sample_lounge": st("light.sample_lounge") }, entities: {}, devices: {}, areas: {} } as unknown as HomeAssistant;
  const a = cache.get(h1, "lights", (id) => id.startsWith("light."));
  const h2 = { ...h1, states: { ...h1.states, "light.sample_lounge": { ...st("light.sample_lounge"), state: "off" } } } as HomeAssistant;
  assert.equal(cache.get(h2, "lights", (id) => id.startsWith("light.")), a);
  const h3 = { ...h2, states: { ...h2.states, "light.sample_hall": st("light.sample_hall") } } as HomeAssistant;
  assert.notEqual(cache.get(h3, "lights", (id) => id.startsWith("light.")), a);
});

test("a selection sets only a scrolled side panel back to the top, noted by a passive scroll listener", () => {
  const src = editorSource();
  assert.match(src, /if \(!this\.scrolledSides\.has\(side\)\) continue;/);
  assert.match(src, /\{ capture: true, passive: true \}/);
  assert.doesNotMatch(src, /\.fp3d-side"\)\) side\.scrollTop = 0;/);
  assert.doesNotMatch(src, /Object\.keys\(hass\?\.states \?\? \{\}\)\.length/);
});
