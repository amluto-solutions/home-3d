// Icon rules in 3D and the 2D plan (#536): the icon setting decides whether an item may have an icon, its icon rule
// decides when. A hidden icon drops only the pin: the marker stays, so a tap, hold or double tap on the item works.

import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, THIS_ITEM, type Building, type Furniture, type MarkerShow, type Placement, type ShowRule } from "../model.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
// (syncDevices sets timers for the next minute: they must not keep the test process alive)
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((...a: Parameters<typeof setTimeout>) => realTimeout(...a).unref()) as typeof setTimeout;
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any> } };

interface Sent {
  id: string;
  pin?: boolean;
  pickable?: boolean;
  furnitureId?: string;
}

const ON: ShowRule = { match: "all", conditions: [{ type: "state", entity: THIS_ITEM, when: "on" }] };
const st = (entity_id: string, state: string) => ({ entity_id, state, attributes: {}, last_changed: new Date().toISOString() });

/** A plan with a floor lamp on light.reading and a plug on switch.kettle, with the rules and settings given. */
function plan(opts: { lamp?: ShowRule | null; plug?: ShowRule | null; lampMarker?: MarkerShow | null } = {}): Building {
  const b = emptyBuilding();
  const floor = newFloor("g", "Ground", 0);
  const lamp: Furniture = { id: "lamp1", type: "lamp_floor", x: 1, z: 1, rotation: 0, w: 0.4, d: 0.4, h: 1.7, variant: null, entity: "light.reading", marker: opts.lampMarker ?? null };
  if (opts.lamp) lamp.show_rules = { icon: opts.lamp };
  const plug: Placement = { entity_id: "switch.kettle", x: 2, z: 1, y: 1 };
  if (opts.plug) plug.show_rules = { icon: opts.plug };
  floor.furniture = [lamp];
  floor.placements = [plug];
  b.floors = [floor];
  return b;
}

/** A view of the plan with these states; returns the view and the markers it sends to the viewer at each sync. */
function view(b: Building, states: Record<string, string>, extra: Record<string, unknown> = {}) {
  const el = new Fp3dView3d();
  Object.assign(el, extra);
  el.building = b;
  const sent: Sent[][] = [];
  const noop: any = new Proxy(() => undefined, {
    get: (_t, k) => (k === "then" ? undefined : k === "setDevices" ? (list: Sent[]) => sent.push(list) : noop),
    apply: () => undefined,
  });
  el.viewer = noop;
  const hass = (s: Record<string, string>) => ({
    language: "en",
    locale: { language: "en", number_format: "language" },
    config: { unit_system: {} },
    entities: {},
    states: Object.fromEntries(Object.entries(s).map(([id, v]) => [id, st(id, v)])),
  });
  el.hass = hass(states);
  const sync = (s?: Record<string, string>) => {
    if (s) el.hass = hass(s);
    el.syncDevices(!s);
    return sent.at(-1) ?? [];
  };
  return { el, sync, sent };
}

const lampOf = (list: Sent[]) => list.find((m) => m.furnitureId === "lamp1");
const plugOf = (list: Sent[]) => list.find((m) => m.id === "switch.kettle");

test("a lamp with the rule 'this item is on' shows its icon only while on, and stays tappable while hidden (#536)", () => {
  const { sync } = view(plan({ lamp: ON }), { "light.reading": "on", "switch.kettle": "off" });
  const on = lampOf(sync());
  assert.ok(on, "the lamp has its marker");
  assert.equal(on.pin, true, "on: the icon shows (the rule decides in place of the automatic choice)");
  const off = lampOf(sync({ "light.reading": "off", "switch.kettle": "off" }));
  assert.ok(off, "off: the marker stays, so the lamp's 3D object keeps its tap, hold and double tap");
  assert.equal(off.pin, false, "off: no icon");
  assert.notEqual(off.pickable, false, "the lamp can still be tapped");
  assert.equal(lampOf(sync({ "light.reading": "on", "switch.kettle": "off" }))?.pin, true, "on again: back");
});

test("without a rule a lamp keeps the automatic choice: no icon of its own in 3D (#536)", () => {
  const { sync } = view(plan(), { "light.reading": "on" });
  assert.equal(lampOf(sync())?.pin, false);
});

test("the icon setting decides whether an item may have an icon: Hide wins over the rule (#536)", () => {
  const { sync } = view(plan({ lamp: ON, lampMarker: "never" }), { "light.reading": "on" });
  assert.equal(lampOf(sync())?.pin, false);
});

test("a placed device follows its own rule; a fixed entity's change judges it again (#536)", () => {
  const dark: ShowRule = { match: "all", conditions: [{ type: "state", entity: "binary_sensor.dark", when: "on" }] };
  const { el, sync } = view(plan({ plug: dark }), { "switch.kettle": "on", "binary_sensor.dark": "off" });
  assert.equal(plugOf(sync())?.pin, false);
  assert.ok((el.watched as string[]).includes("binary_sensor.dark"), "the rule's entity is watched");
  assert.equal(plugOf(sync({ "switch.kettle": "on", "binary_sensor.dark": "on" }))?.pin, true);
});

test("the editor shows every item, whatever its rule says (#536)", () => {
  const { sync } = view(plan({ plug: { match: "all", conditions: [{ type: "state", entity: THIS_ITEM, when: "on" }] } }), { "switch.kettle": "off" }, { furnish: true });
  assert.equal(plugOf(sync())?.pin, true);
});

test("in the 2D plan a lamp hidden by its rule has no pin either; shown by it, it has (#536)", () => {
  const { sync } = view(plan({ lamp: ON }), { "light.reading": "off" }, { plan2d: true });
  assert.equal(lampOf(sync())?.pin, false);
  assert.equal(lampOf(sync({ "light.reading": "on" }))?.pin, true);
});

test("only a time condition starts the minute timer for the icons, and its tick redraws only when a rule turned (#536)", () => {
  const timed: ShowRule = { match: "all", conditions: [{ type: "time", start: "00:00", end: "23:59" }] };
  const a = view(plan({ plug: ON }), { "switch.kettle": "on" });
  a.sync();
  assert.equal(a.el.showTimer, undefined, "a state rule alone needs no clock");
  const b = view(plan({ plug: timed }), { "switch.kettle": "on" });
  b.sync();
  assert.notEqual(b.el.showTimer, undefined, "a time condition is judged again every minute");
  const before = b.sent.length;
  b.el.syncDevices(false, false);
  assert.equal(b.sent.length, before, "nothing turned: no redraw");
  clearTimeout(b.el.showTimer);
});
