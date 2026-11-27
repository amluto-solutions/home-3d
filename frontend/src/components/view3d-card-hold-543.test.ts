// The hold of a touched card (#543): a card its rule would hide stays while the viewer uses it, and follows its rule again
// after this device's hold time without a touch on it (default 30 s). A card open in the zoom view is never taken; its
// time starts again when the view closes.

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
const PAUSED = { ...BASE, "media_player.tv": { state: "paused", attributes: { device_class: "tv", media_title: "News" } } };

// this device's preferences ("home3d.<key>"), as the browser keeps them
const prefs = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k: string) => prefs.get(k) ?? null, setItem: (k: string, v: string) => void prefs.set(k, v), removeItem: (k: string) => void prefs.delete(k) } });

/** A view whose TV card shows only while it plays, the TV touched and then paused: held against its rule. */
function held() {
  const v = view(plan({ tv: PLAYING }), BASE);
  const at = v.sync().cards.findIndex((c) => c.rule === "f:tv1");
  const touch = () => v.el.onCardTouch({ composedPath: () => [{ getAttribute: (a: string) => (a === "data-holo" ? String(at) : null) }] });
  touch();
  assert.ok(has(v.sync(PAUSED).cards, "f:tv1"), "held: its rule does not take it");
  return { ...v, touch, shown: () => has(v.el._holos as Card[], "f:tv1") };
}

test("a touched card follows its rule again after 30 s without a touch, not before (#543)", (t) => {
  prefs.clear();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { shown } = held();
  t.mock.timers.tick(29_000);
  assert.ok(shown(), "29 s: still there");
  t.mock.timers.tick(1_000);
  assert.ok(!shown(), "30 s: its rule hides it");
});

test("a touch on the card starts its time again (#543)", (t) => {
  prefs.clear();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { shown, touch } = held();
  t.mock.timers.tick(20_000);
  touch();
  t.mock.timers.tick(20_000);
  assert.ok(shown(), "20 s after the second touch: still there");
  t.mock.timers.tick(10_000);
  assert.ok(!shown());
});

test("a changed setting changes the time; 0 lets the rule count at once (#543)", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  prefs.set("home3d.card_hold", "5");
  const a = held();
  t.mock.timers.tick(4_999);
  assert.ok(a.shown(), "under 5 s: still there");
  t.mock.timers.tick(1);
  assert.ok(!a.shown(), "5 s: gone");
  prefs.set("home3d.card_hold", "120");
  const b = held();
  t.mock.timers.tick(60_000);
  assert.ok(b.shown(), "120 s set: still there after a minute");
  t.mock.timers.tick(60_000);
  assert.ok(!b.shown());
  prefs.set("home3d.card_hold", "0");
  const c = held();
  t.mock.timers.tick(0);
  assert.ok(!c.shown(), "0: no hold");
  prefs.clear();
});

test("a card open in the zoom view is never taken; its time starts again when the view closes (#543, #541)", (t) => {
  prefs.clear();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { el, shown } = held();
  el.zoomTo((el._holos as Card[]).find((c) => c.rule === "f:tv1"));
  t.mock.timers.tick(120_000);
  assert.ok(shown(), "two minutes open in the zoom view: still there");
  el.zoomTo(null);
  assert.ok(shown(), "closed: still held, its time starts now");
  t.mock.timers.tick(29_000);
  assert.ok(shown());
  t.mock.timers.tick(1_000);
  assert.ok(!shown(), "30 s after the view closed: its rule hides it");
});

test("the hold time is a Settings row of this device, 30 s by default (#543)", async () => {
  const { SETTINGS } = await import("../settings/registry.ts");
  const row = SETTINGS.find((s) => s.id === "card_hold")!;
  assert.equal(row.scope, "device");
  assert.equal(row.default, 30);
  const store = new Map<string, string | null>();
  const env = { prefs: { get: (k: string) => store.get(k) ?? null, set: (k: string, v: string | null) => void store.set(k, v) } } as never;
  row.write!(env, 45 as never);
  assert.equal(store.get("card_hold"), "45");
  assert.equal(row.read(env), 45);
});

test("a zoomed card that goes by itself does not stay held for good (#543)", (t) => {
  prefs.clear();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { el, sync, shown } = held();
  el.zoomTo((el._holos as Card[]).find((c) => c.rule === "f:tv1"));
  t.mock.timers.tick(60_000);
  // the TV leaves Home Assistant for a moment: no card to zoom any more, so the zoom view closes by itself
  const { "media_player.tv": _gone, ...without } = BASE;
  sync(without);
  assert.equal(el._zoom, null);
  assert.equal(el.cardHeld, "f:tv1", "still held, its time starts now");
  t.mock.timers.tick(30_000);
  assert.equal(el.cardHeld, null, "30 s later: let go");
  assert.ok(!has(sync(PAUSED).cards, "f:tv1"), "back, paused: its rule hides it");
  assert.ok(!shown());
});

test("a held card's time runs again when the view comes back to the page (#543)", (t) => {
  prefs.clear();
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const { el, shown } = held();
  // taken off the page and put back (a dashboard view change): the timer stopped while away
  clearTimeout(el.holdTimer);
  Object.defineProperty(el, "hasUpdated", { configurable: true, value: true });
  for (const k of ["observeStage", "start", "watchTrail", "watchAsk", "listenReplay", "endStyleAt"]) el[k] = () => undefined;
  // no page here: nothing to draw into
  el.renderRoot = {};
  el.shouldUpdate = () => false;
  const doc = globalThis.document;
  globalThis.document = { addEventListener: () => undefined, hidden: false } as unknown as Document;
  try {
    el.connectedCallback();
  } finally {
    globalThis.document = doc;
  }
  assert.ok(shown());
  t.mock.timers.tick(30_000);
  assert.ok(!shown(), "30 s after coming back: its rule hides it");
});
