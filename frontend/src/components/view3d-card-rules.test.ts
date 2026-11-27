// Card rules (#537): every floating card follows the card rule of the item it hangs over; the main solar card and
// "Today in the household" have theirs in their own settings ("this item" on the solar card: the plant's main sensor).
// A hidden card takes its anchor line with it, and a card the viewer is using stays until they touch elsewhere.

import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, THIS_ITEM, type Building, type Furniture, type Placement, type ShowRule } from "../model.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
// (syncDevices sets timers for the next minute: they must not keep the test process alive)
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((...a: Parameters<typeof setTimeout>) => realTimeout(...a).unref()) as typeof setTimeout;
const realInterval = globalThis.setInterval;
globalThis.setInterval = ((...a: Parameters<typeof setInterval>) => realInterval(...a).unref()) as typeof setInterval;
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any> } };

interface Card {
  kind: string;
  rule?: string;
  name: string;
}
type States = Record<string, string | { state: string; attributes: Record<string, unknown> }>;

const PLAYING: ShowRule = { match: "all", conditions: [{ type: "state", entity: THIS_ITEM, when: "state", state: "playing" }] };

/** A plan with a room, a TV on media_player.tv, a plug with a power card and the main solar card on sensor.pv. */
function plan(opts: { tv?: ShowRule; plug?: ShowRule; main?: ShowRule; household?: ShowRule } = {}): Building {
  const b = emptyBuilding();
  const floor = newFloor("g", "Ground", 0);
  floor.rooms = [{ id: "r1", name: "Lounge", points: [[0, 0], [5, 0], [5, 4], [0, 4]] } as Building["floors"][number]["rooms"][number]];
  const tv: Furniture = { id: "tv1", type: "tv", x: 1, z: 1, rotation: 0, w: 1.2, d: 0.1, h: 0.7, variant: null, entity: "media_player.tv" };
  if (opts.tv) tv.show_rules = { card: opts.tv };
  const plug: Placement = { entity_id: "switch.kettle", x: 2, z: 1, y: 1, holo: true };
  if (opts.plug) plug.show_rules = { card: opts.plug };
  floor.furniture = [tv];
  floor.placements = [plug];
  b.floors = [floor];
  b.energy = { ...b.energy, solar: "sensor.pv" };
  b.settings.roof.hologram = { field: null, size: 1, right: 0, up: 0, ...(opts.main ? { card_rule: opts.main } : {}) };
  if (opts.household) b.settings.household = { card_rule: opts.household };
  return b;
}

const BASE: States = {
  "media_player.tv": { state: "playing", attributes: { device_class: "tv", media_title: "News" } },
  "switch.kettle": "on",
  "sensor.kettle_power": { state: "1200", attributes: { device_class: "power", unit_of_measurement: "W" } },
  "sensor.pv": { state: "51", attributes: { device_class: "power", unit_of_measurement: "W" } },
};

/** A view of the plan; `sync` returns the cards it shows and how many anchors it sends. */
function view(b: Building, states: States, extra: Record<string, unknown> = {}) {
  const el = new Fp3dView3d();
  // the cards' day curves come from Home Assistant's statistics: none here
  el.watchSolarDay = () => undefined;
  Object.assign(el, extra);
  el.building = b;
  const anchors: unknown[][] = [];
  const noop: any = new Proxy(() => undefined, {
    get: (_t, k) => (k === "then" ? undefined : k === "setAnchors" ? (list: unknown[]) => anchors.push(list) : noop),
    apply: () => undefined,
  });
  el.viewer = noop;
  const hass = (s: States) => ({
    language: "en",
    locale: { language: "en", number_format: "language" },
    config: { unit_system: {} },
    entities: { "sensor.kettle_power": { entity_id: "sensor.kettle_power", device_id: "d1" }, "switch.kettle": { entity_id: "switch.kettle", device_id: "d1" } },
    devices: {},
    states: Object.fromEntries(
      Object.entries(s).map(([id, v]) => [id, { entity_id: id, ...(typeof v === "string" ? { state: v, attributes: {} } : v), last_changed: new Date().toISOString() }]),
    ),
  });
  el.hass = hass(states);
  const sync = (s?: States) => {
    if (s) el.hass = hass(s);
    el.syncDevices(!s);
    return { cards: el._holos as Card[], anchors: anchors.at(-1)?.length ?? 0 };
  };
  return { el, sync };
}

const has = (cards: Card[], rule: string) => cards.some((c) => c.rule === rule);

test("a TV card with the rule 'this item is playing' shows only while the TV plays, its anchor goes with it (#537)", () => {
  const { sync } = view(plan({ tv: PLAYING }), BASE);
  const on = sync();
  assert.ok(has(on.cards, "f:tv1"), "playing: the TV's card shows");
  const off = sync({ ...BASE, "media_player.tv": { state: "off", attributes: { device_class: "tv" } } });
  assert.ok(!has(off.cards, "f:tv1"), "off: the rule hides the card the TV kept before");
  assert.equal(off.anchors, on.anchors - 1, "and its anchor (the line to the TV) is gone too");
  assert.ok(has(sync(BASE).cards, "f:tv1"), "playing again: back");
});

test("without a rule a TV keeps its card while off, as before (#281)", () => {
  const { sync } = view(plan(), { ...BASE, "media_player.tv": { state: "off", attributes: { device_class: "tv" } } });
  assert.ok(has(sync().cards, "f:tv1"));
});

test("the solar card shows above a chosen power, its main sensor being 'this item' (#537, #538)", () => {
  const above: ShowRule = { match: "all", conditions: [{ type: "state", entity: THIS_ITEM, when: "above", value: 50 }] };
  const { sync, el } = view(plan({ main: above }), BASE);
  assert.ok(has(sync().cards, "main"), "51 W: shows");
  assert.ok((el.watched as string[]).includes("sensor.pv"), "its sensor is watched");
  assert.ok(!has(sync({ ...BASE, "sensor.pv": { state: "49", attributes: { device_class: "power", unit_of_measurement: "W" } } }).cards, "main"), "49 W: hidden");
});

test("the solar card in a chosen time window: judged again by the minute timer (#537)", () => {
  const now = new Date();
  const hh = (h: number) => `${String((h + 24) % 24).padStart(2, "0")}:00`;
  const window = (from: number, to: number): ShowRule => ({ match: "all", conditions: [{ type: "time", start: hh(now.getHours() + from), end: hh(now.getHours() + to) }] });
  const inside = view(plan({ main: window(0, 1) }), BASE);
  assert.ok(has(inside.sync().cards, "main"));
  assert.notEqual(inside.el.showTimer, undefined, "a time condition starts the minute timer");
  clearTimeout(inside.el.showTimer);
  const outside = view(plan({ main: window(2, 3) }), BASE);
  assert.ok(!has(outside.sync().cards, "main"));
  clearTimeout(outside.el.showTimer);
});

test("a placed device's power card follows its rule on a fixed entity (#537)", () => {
  const night: ShowRule = { match: "all", conditions: [{ type: "state", entity: "binary_sensor.night", when: "off" }] };
  const { sync } = view(plan({ plug: night }), { ...BASE, "binary_sensor.night": "off" });
  assert.ok(has(sync().cards, "p:switch.kettle"));
  assert.ok(!has(sync({ ...BASE, "binary_sensor.night": "on" }).cards, "p:switch.kettle"));
});

test("a card the viewer touched stays while its rule hides it, and goes at a touch elsewhere (#537)", () => {
  const { sync, el } = view(plan({ tv: PLAYING }), BASE);
  const cards = sync().cards;
  const at = cards.findIndex((c) => c.rule === "f:tv1");
  const touch = (holo: number | null) => el.onCardTouch({ composedPath: () => (holo === null ? [{ getAttribute: () => null }] : [{ getAttribute: (a: string) => (a === "data-holo" ? String(holo) : null) }]) });
  touch(at);
  const paused = { ...BASE, "media_player.tv": { state: "paused", attributes: { device_class: "tv", media_title: "News" } } };
  assert.ok(has(sync(paused).cards, "f:tv1"), "held: the rule does not close it");
  touch(null);
  assert.ok(!has(el._holos as Card[], "f:tv1"), "a touch elsewhere lets it go");
});

test("the editor shows every card, whatever its rule says (#537)", () => {
  const { sync } = view(plan({ tv: PLAYING }), { ...BASE, "media_player.tv": { state: "off", attributes: { device_class: "tv" } } }, { furnish: true });
  assert.ok(has(sync().cards, "f:tv1"));
});

test("'Today in the household' has its rule in its own settings (#537)", () => {
  const dark: ShowRule = { match: "all", conditions: [{ type: "state", entity: "binary_sensor.dark", when: "on" }] };
  const { sync, el } = view(plan({ household: dark }), { ...BASE, "binary_sensor.dark": "off" });
  sync();
  assert.equal(el._hhRuled, true, "hidden by its rule");
  sync({ ...BASE, "binary_sensor.dark": "on" });
  assert.equal(el._hhRuled, false);
});
