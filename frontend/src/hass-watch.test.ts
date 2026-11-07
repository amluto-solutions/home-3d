import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { forwardHass, HASS_CHILDREN, HassWatch } from "./hass-watch.ts";
import type { HomeAssistant } from "./types.ts";

const st = (state: string) => ({ state, attributes: {} });
const base = () =>
  ({ states: { "light.a": st("on"), "light.b": st("off"), "sensor.t": st("20") }, entities: {}, areas: {}, language: "en" }) as unknown as HomeAssistant;
const withState = (h: HomeAssistant, id: string, state: string) => ({ ...h, states: { ...h.states, [id]: st(state) } }) as HomeAssistant;

/** A "render" that reads the given entities through the watched hass. */
function render(watch: HassWatch, hass: HomeAssistant, read: (h: HomeAssistant) => void) {
  watch.begin();
  try {
    read(watch.wrap(hass));
  } finally {
    watch.end();
  }
}

test("a state change of an entity the last render read matters; one it did not read does not (#130)", () => {
  const watch = new HassWatch();
  const hass = base();
  render(watch, hass, (h) => void h.states["light.a"]?.state);
  assert.equal(watch.matters(hass, withState(hass, "light.a", "off")), true);
  assert.equal(watch.matters(hass, withState(hass, "sensor.t", "21")), false);
});

test("anything besides the states (registry, areas, language, user) always matters (#130)", () => {
  const watch = new HassWatch();
  const hass = base();
  render(watch, hass, () => {});
  assert.equal(watch.matters(hass, { ...hass, entities: {} } as HomeAssistant), true);
  assert.equal(watch.matters(hass, { ...hass, language: "de" } as HomeAssistant), true);
  assert.equal(watch.matters(hass, { ...hass } as HomeAssistant), false);
});

test("an entity that came or went matters (#130)", () => {
  const watch = new HassWatch();
  const hass = base();
  render(watch, hass, () => {});
  assert.equal(watch.matters(hass, withState(hass, "switch.new", "on")), true);
  const { "sensor.t": _gone, ...rest } = hass.states;
  assert.equal(watch.matters(hass, { ...hass, states: rest } as HomeAssistant), true);
});

test("a render that went through all states (a list of them) watches every state (#130)", () => {
  const watch = new HassWatch();
  const hass = base();
  render(watch, hass, (h) => void Object.keys(h.states).length);
  assert.equal(watch.matters(hass, withState(hass, "sensor.t", "21")), true);
  // asking whether an entity exists watches it too
  render(watch, hass, (h) => void ("light.b" in h.states));
  assert.equal(watch.matters(hass, withState(hass, "light.b", "on")), true);
  assert.equal(watch.matters(hass, withState(hass, "sensor.t", "22")), false);
});

test("reads while paused are not watched, and each render starts afresh (#130)", () => {
  const watch = new HassWatch();
  const hass = base();
  render(watch, hass, (h) => watch.pause(() => Object.keys(h.states).forEach((id) => h.states[id])));
  assert.equal(watch.matters(hass, withState(hass, "sensor.t", "21")), false);
  render(watch, hass, (h) => void h.states["sensor.t"]);
  render(watch, hass, () => {});
  assert.equal(watch.matters(hass, withState(hass, "sensor.t", "21")), false);
});

test("outside a render the wrapped hass reads like the real one and records nothing; it is the same object per hass (#130)", () => {
  const watch = new HassWatch();
  const hass = base();
  const wrapped = watch.wrap(hass);
  assert.equal(wrapped, watch.wrap(hass));
  assert.equal(wrapped.states["light.a"].state, "on");
  assert.deepEqual(Object.keys(wrapped.states), ["light.a", "light.b", "sensor.t"]);
  render(watch, hass, () => {});
  void wrapped.states["light.a"];
  assert.equal(watch.matters(hass, withState(hass, "light.a", "off")), false);
});

test("no render yet, or no hass before: it matters (#130)", () => {
  const watch = new HassWatch();
  const hass = base();
  assert.equal(watch.matters(hass, withState(hass, "sensor.t", "21")), true);
  render(watch, hass, () => {});
  assert.equal(watch.matters(undefined, hass), true);
});

test("an update without a new hass adds to what the last one read instead of forgetting it (#177)", () => {
  const watch = new HassWatch();
  const hass = base();
  render(watch, hass, (h) => void h.states["light.a"]);
  // a later update (a menu opened) reads only part of it: light.a still matters
  watch.begin(true);
  void watch.wrap(hass).states["sensor.t"];
  watch.end();
  assert.equal(watch.matters(hass, withState(hass, "light.a", "off")), true);
  assert.equal(watch.matters(hass, withState(hass, "sensor.t", "21")), true);
  assert.equal(watch.matters(hass, withState(hass, "light.b", "on")), false);
});

test("a new callService (the demo home makes one per update) does not matter; another registry does (#177)", () => {
  const watch = new HassWatch();
  const hass = { ...base(), callService: async () => undefined } as HomeAssistant;
  render(watch, hass, () => {});
  assert.equal(watch.matters(hass, { ...hass, callService: async () => undefined } as HomeAssistant), false);
  assert.equal(watch.matters(hass, { ...hass, entities: {} } as HomeAssistant), true);
});

test("a hass a parent handed on wrapped compares like the plain one (#177)", () => {
  const parent = new HassWatch();
  const child = new HassWatch();
  const hass = base();
  const next = withState(hass, "sensor.t", "21");
  render(child, parent.wrap(hass), (h) => void h.states["light.a"]);
  assert.equal(child.matters(parent.wrap(hass), parent.wrap(next)), false);
  assert.equal(child.matters(parent.wrap(hass), parent.wrap(withState(hass, "light.a", "off"))), true);
  // the parent recorded nothing: the child read outside the parent's render
  render(parent, hass, () => {});
  assert.equal(parent.matters(hass, withState(hass, "light.a", "off")), false);
});

test("without entity lists an entity that comes matters only when a render looked for it (#177)", () => {
  const watch = new HassWatch({ entityLists: false });
  const hass = base();
  render(watch, hass, (h) => void h.states["switch.wanted"]);
  assert.equal(watch.matters(hass, withState(hass, "switch.new", "on")), false);
  assert.equal(watch.matters(hass, withState(hass, "switch.wanted", "on")), true);
  // the editor's watch (entity lists kept) still renders for any entity that came
  const editor = new HassWatch();
  render(editor, hass, () => {});
  assert.equal(editor.matters(hass, withState(hass, "switch.new", "on")), true);
});

test("a skipped render hands the new hass to the listed children that had the old one (#177)", () => {
  const hass = base();
  const next = withState(hass, "sensor.t", "21");
  const menu = { localName: "fp3d-quick-menu", hass: hass as unknown };
  const other = { localName: "fp3d-quick-menu", hass: "something else" as unknown };
  let asked = "";
  const root = { querySelectorAll: (sel: string) => ((asked = sel), [menu, other]) } as unknown as ParentNode;
  forwardHass(root, ["fp3d-quick-menu", "fp3d-mic-probe"], [[hass, next]]);
  assert.equal(asked, "fp3d-quick-menu,fp3d-mic-probe");
  assert.equal(menu.hass, next);
  assert.equal(other.hass, "something else");
});

test("HASS_CHILDREN names every element a render hands hass to, so a skipped render forgets none (#177)", () => {
  for (const [file, tags] of Object.entries(HASS_CHILDREN)) {
    const src = readFileSync(new URL(`./${file}`, import.meta.url), "utf8");
    const bound = new Set<string>();
    for (let i = src.indexOf(".hass="); i >= 0; i = src.indexOf(".hass=", i + 1)) {
      const tag = [...src.slice(0, i).matchAll(/<([a-z][a-z0-9]*-[a-z0-9-]+)/g)].pop()?.[1];
      if (tag) bound.add(tag);
    }
    assert.deepEqual([...bound].sort(), [...tags].sort(), file);
  }
});
