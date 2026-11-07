// A TV reached through several integrations has several media players placed on it: one card for the group (#356).

import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Furniture } from "../model.ts";
import { isTvItemType } from "../devices.ts";
import { GROUP_RADIUS, hostAt, losers } from "../media-groups.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
// (syncDevices sets timers for the next minute and for the grace time: they must not keep the test process alive)
const realTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((...a: Parameters<typeof setTimeout>) => realTimeout(...a).unref()) as typeof setTimeout;
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any> } };

const IDS = ["media_player.sample_lounge_tv", "media_player.sample_lounge_tv_cast", "media_player.sample_lounge_tv_android", "media_player.sample_lounge_tv_native"];
const state = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes: { device_class: "tv", ...attributes }, last_changed: new Date().toISOString() });
const bare = (a: Record<string, unknown>) => ({ device_class: null, ...a });

/** A lounge with a TV on a unit and the given players placed 20 cm apart on it; returns the media cards. */
function cards(states: Record<string, [string, Record<string, unknown>?]>, opts: { onItem?: boolean; spread?: number; hostType?: string } = {}): { id: string; title: string }[] {
  const el = new Fp3dView3d();
  const b = emptyBuilding();
  const floor = newFloor("g", "Ground", 0);
  if (opts.onItem !== false) floor.furniture = [{ id: "tv_unit", type: opts.hostType ?? "tv", name: "TV", x: 2, z: 2, rotation: 0, w: 1.4, d: 0.4, h: 0.6, variant: null } as Furniture];
  const ids = Object.keys(states);
  floor.placements = ids.map((entity_id, i) => ({ entity_id, x: 1.7 + i * (opts.spread ?? 0.2), z: 2, y: 1, marker: "never" }) as never);
  b.floors = [floor];
  el.building = b;
  el.hass = {
    language: "en",
    locale: { language: "en", number_format: "language" },
    config: { unit_system: {} },
    entities: {},
    states: Object.fromEntries(ids.map((id) => [id, state(id, states[id][0], states[id][1])])),
  };
  const noop: any = new Proxy(() => undefined, { get: (_t, k) => (k === "then" ? undefined : noop), apply: () => undefined });
  el.viewer = noop;
  try {
    el.syncDevices(true);
  } catch {
    /* only the cards are looked at */
  }
  return (el._holos ?? el.holos ?? []).filter((c: { kind: string }) => c.kind === "media").map((c: { media: { id: string; title: string } }) => c.media);
}

test("four players on one TV, one playing: one card, for the playing one (#356)", () => {
  const got = cards({ [IDS[0]]: ["off"], [IDS[1]]: ["playing", { media_title: "Sample Film" }], [IDS[2]]: ["unavailable"], [IDS[3]]: ["off"] });
  assert.deepEqual(got.map((c) => c.id), [IDS[1]]);
  assert.equal(got[0].title, "Sample Film");
});

test("all off or unavailable: at most one card (#356)", () => {
  assert.equal(cards({ [IDS[0]]: ["off"], [IDS[1]]: ["off"], [IDS[2]]: ["unavailable"], [IDS[3]]: ["standby"] }).length, 1);
  assert.equal(cards({ [IDS[0]]: ["unavailable"], [IDS[1]]: ["unavailable"] }).length, 0);
});

test("a paused player with a title beats an idle one; players far apart off any item keep their own cards (#356)", () => {
  assert.deepEqual(cards({ [IDS[0]]: ["off"], [IDS[1]]: ["paused", { media_title: "Sample Show" }] }).map((c) => c.id), [IDS[1]]);
  assert.equal(cards({ [IDS[0]]: ["playing"], [IDS[1]]: ["playing"] }, { onItem: false, spread: 2 }).length, 2);
  assert.equal(cards({ [IDS[0]]: ["playing"], [IDS[1]]: ["playing"] }, { onItem: false, spread: 0.2 }).length, 1);
});

test("the lounge layout: a chain of players on a bench beside the TV item, one missing, shares one card (#356)", () => {
  const el = new Fp3dView3d();
  const b = emptyBuilding();
  const floor = newFloor("g", "Ground", 0);
  const P = ["media_player.sample_a", "media_player.sample_b", "media_player.sample_c", "media_player.sample_d"];
  floor.furniture = [
    { id: "tv", type: "tv", name: "TV", x: 2.83, z: 9.3, rotation: 270, w: 1.479, d: 0.075, h: 0.8, variant: null },
    { id: "bench", type: "bench", name: "Bench", x: 3, z: 9.3, rotation: 270, w: 1.79, d: 0.42, h: 0.5, variant: null },
  ] as Furniture[];
  floor.placements = [
    { entity_id: P[0], x: 2.95, z: 9.2, y: 1.4, rotation: 270, marker: null },
    { entity_id: P[1], x: 2.95, z: 9.4, y: 1.4, rotation: 270, marker: "never" },
    { entity_id: P[2], x: 2.95, z: 9.0, y: 1.4, rotation: 270, marker: "never" },
    { entity_id: P[3], x: 2.95, z: 9.6, y: 1.4, rotation: 270, marker: "never" },
    { entity_id: "light.sample_lamp", x: 3.141, z: 9.2, y: 1.4, rotation: 270, marker: null },
  ] as never;
  b.floors = [floor];
  el.building = b;
  el.hass = {
    language: "en",
    locale: { language: "en", number_format: "language" },
    config: { unit_system: {} },
    entities: {},
    states: { [P[0]]: state(P[0], "on"), [P[1]]: state(P[1], "on"), [P[3]]: state(P[3], "paused"), "light.sample_lamp": { entity_id: "light.sample_lamp", state: "on", attributes: {} } },
  };
  el.viewer = new Proxy(() => undefined, { get: (_t, k) => (k === "then" ? undefined : el.viewer), apply: () => undefined });
  try {
    el.syncDevices(true);
  } catch {
    /* only the cards are looked at */
  }
  const got = (el._holos ?? []).filter((c: { kind: string }) => c.kind === "media");
  assert.deepEqual(got.map((c: { media: { id: string } }) => c.media.id), [P[0]]);
});

test("players in a chain, each within half a metre of the next, are one group (#356)", () => {
  const c = (id: string, z: number) => ({ id, floorId: "g", x: 0, z, rank: 1, tv: true });
  assert.deepEqual([...losers([c("a", 0), c("b", 0.4), c("c", 0.8), c("d", 1.2)])], ["b", "c", "d"]);
  assert.deepEqual([...losers([c("d", 1.2), c("a", 0), c("b", 0.4), c("c", 0.8)])], ["a", "b", "c"]);
});

test("a single player behaves as before (#356)", () => {
  assert.deepEqual(cards({ [IDS[0]]: ["off"] }).map((c) => c.id), [IDS[0]]);
  assert.deepEqual(cards({ [IDS[0]]: ["playing", { media_title: "Sample" }] }).map((c) => c.id), [IDS[0]]);
});

test("a speaker and a TV on one bench, both playing: two cards (#362)", () => {
  const sp = "media_player.sample_speaker";
  const states = { [IDS[0]]: ["playing", { media_title: "Sample Film" }], [sp]: ["playing", bare({ media_title: "Sample Song" })] } as Record<string, [string, Record<string, unknown>?]>;
  assert.deepEqual(cards(states, { hostType: "sideboard" }).map((c) => c.id).sort(), [IDS[0], sp].sort());
  // players of the same TV item still share one card
  assert.equal(cards({ [IDS[0]]: ["off"], [IDS[1]]: ["off"] }, { hostType: "tv" }).length, 1);
});

test("two PCs on one desk: two cards (#362)", () => {
  const states = { "media_player.sample_pc_a": ["playing", bare({})], "media_player.sample_pc_b": ["playing", bare({})] } as Record<string, [string, Record<string, unknown>?]>;
  assert.equal(cards(states, { hostType: "desk" }).length, 2);
});

test("TV item detection: built-in and pack TVs, not monitors or projector screens (#362)", () => {
  assert.equal(isTvItemType("tv_board"), true);
  assert.equal(isTvItemType("desk"), false);
  assert.equal(isTvItemType("sideboard"), false);
});

test("same friendly name within the radius is one group even without the tv class (#362)", () => {
  const c = (id: string, x: number, name: string) => ({ id, floorId: "g", x, z: 0, rank: 1, name });
  assert.deepEqual([...losers([c("a", 0, "lounge"), c("b", 0.2, "lounge")])], ["b"]);
  assert.equal(losers([c("a", 0, "lounge"), c("b", 0.2, "kitchen")]).size, 0);
});

test("grouping rule: same item or within half a metre on one floor; the best rank keeps the card (#356)", () => {
  assert.equal(GROUP_RADIUS, 0.5);
  const c = (id: string, x: number, rank: number, extra: object = {}) => ({ id, floorId: "g", x, z: 0, rank, tv: true, ...extra });
  assert.deepEqual([...losers([c("a", 0, 1), c("b", 0.4, 5), c("c", 3, 1)])], ["a"]);
  assert.deepEqual([...losers([c("a", 0, 1), c("b", 0.4, 1)])], ["b"]);
  assert.deepEqual([...losers([c("a", 0, 1, { hostId: "f", hostTv: true }), c("b", 5, 4, { hostId: "f", hostTv: true })])], ["a"]);
  assert.equal(losers([c("a", 0, 1), { ...c("b", 0.1, 5), floorId: "u" }]).size, 0);
  assert.equal(hostAt([{ id: "f", x: 2, z: 2, w: 1.4, d: 0.4 }], 2.6, 2.1), "f");
  assert.equal(hostAt([{ id: "f", x: 2, z: 2, w: 1.4, d: 0.4 }], 2.6, 2.4), undefined);
  assert.equal(hostAt([{ id: "f", x: 2, z: 2, w: 1.4, d: 0.4, rotation: 90 }], 2.1, 2.6), "f");
});
