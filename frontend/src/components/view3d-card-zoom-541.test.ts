// The zoom view (#541): a card opens near full screen; its rule never closes it while it is open, Back closes it, and
// it closes when its card goes for another reason.

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
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

test("a card open in the zoom view is never closed by its rule; it goes once the view closes (#541)", () => {
  const { sync, el } = view(plan({ tv: PLAYING }), BASE);
  const tv = sync().cards.find((c) => c.rule === "f:tv1")!;
  el.zoomTo(tv);
  assert.equal(el._zoom, "media|f:tv1", "the view knows the card by its kind and item, not its index");
  assert.ok(has(sync(PAUSED).cards, "f:tv1"), "its rule says hide: it stays while the view is open");
  assert.ok(has(sync(PAUSED).cards, "f:tv1"), "and on the next sync too");
  el.zoomTo(null);
  assert.equal(el._zoom, null);
  assert.ok(!has(el._holos as Card[], "f:tv1"), "closed: the rule takes it at once");
});

test("the hold of stage 2 and the zoom view share one place (cardKept) (#537, #541)", () => {
  const { sync, el } = view(plan({ tv: PLAYING }), BASE);
  sync();
  assert.equal(el.cardKept("f:tv1"), false);
  el.cardHeld = "f:tv1";
  assert.equal(el.cardKept("f:tv1"), true, "the touched card");
  el.cardHeld = null;
  el.zoomTo((el._holos as Card[]).find((c) => c.rule === "f:tv1"));
  assert.equal(el.cardKept("f:tv1"), true, "the zoomed card");
  assert.equal(el.cardKept("p:switch.kettle"), false, "no other card");
  el.zoomTo(null);
});

test("the zoom view closes when its card goes for another reason than its rule (#541)", () => {
  const { sync, el } = view(plan(), BASE);
  sync();
  el.zoomTo((el._holos as Card[]).find((c) => c.rule === "p:switch.kettle"));
  assert.equal(el._zoom, "device|p:switch.kettle");
  const without = plan();
  without.floors[0].placements = [];
  el.building = without;
  sync();
  assert.ok(!has(el._holos as Card[], "p:switch.kettle"));
  assert.equal(el._zoom, null, "its card went: the view closed");
  el.zoomTo(null);
});

test("Back closes the zoom view: it is a back layer of the 3D view (#541)", () => {
  const src = readFileSync(new URL("./view3d.ts", import.meta.url), "utf8");
  assert.ok(src.includes(`row("_zoom", "zoom", !!this._zoom, () => this.zoomTo(null));`));
  for (const kind of ["renderCarCard", "renderModuleCard", "renderMediaCard", "renderRackCard", "renderDeviceCard", "renderHoloCard"]) {
    const at = src.indexOf(`private ${kind}(`);
    const next = src.indexOf("\n  private ", at + 10);
    assert.ok(src.slice(at, next).includes("this.zoomBtn(card)"), `${kind} has the zoom button`);
    assert.ok(src.slice(at, next).includes("this.zoomDraw"), `${kind} shows in full in the zoom view`);
  }
});
