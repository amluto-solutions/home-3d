import assert from "node:assert/strict";
import { test } from "node:test";
import { buildWhere, elsewhere, tapInRoomOn, TAP_IN_ROOM_KEY } from "./tap-room.ts";
import type { Building } from "./model.ts";

const square = (x: number, z: number): [number, number][] => [[x, z], [x + 4, z], [x + 4, z + 4], [x, z + 4]];

const building = {
  floors: [
    {
      id: "f1",
      rooms: [
        { id: "lounge", points: square(0, 0) },
        { id: "kitchen", points: square(5, 0) },
      ],
      furniture: [{ id: "lamp1", x: 6, z: 2 }, { id: "sofa", x: 1, z: 1 }],
      openings: [{ id: "w1", room_id: "kitchen" }, { id: "w2", room_id: "lounge" }],
      outdoor: [],
    },
  ],
} as unknown as Building;

const index = buildWhere({
  building,
  markers: [
    { id: "light.sample_lounge", floorId: "f1", roomId: "lounge" },
    { id: "light.sample_kitchen", floorId: "f1", roomId: "kitchen" },
    { id: "switch.sample_garden", floorId: "f1", roomId: null },
  ],
  furnitureTargets: new Map([["lamp1", "light.sample_lamp"]]),
  openingTargets: new Map([["w1", "cover.sample_kitchen"], ["w2", "cover.sample_lounge"]]),
});

test("setting off or no room open: nothing is redirected", () => {
  assert.equal(elsewhere(index, "light.sample_kitchen", "lounge", false), null);
  assert.equal(elsewhere(index, "light.sample_kitchen", null, true), null);
});

test("a device in the opened room switches as usual", () => {
  assert.equal(elsewhere(index, "light.sample_lounge", "lounge", true), null);
  assert.equal(elsewhere(index, "cover.sample_lounge", "lounge", true), null);
  assert.equal(elsewhere(index, "opening:w2", "lounge", true), null);
});

test("a device of another room opens that room", () => {
  assert.deepEqual(elsewhere(index, "light.sample_kitchen", "lounge", true), { floorId: "f1", roomId: "kitchen" });
  assert.deepEqual(elsewhere(index, "light.sample_lamp", "lounge", true), { floorId: "f1", roomId: "kitchen" });
  assert.deepEqual(elsewhere(index, "cover.sample_kitchen", "lounge", true), { floorId: "f1", roomId: "kitchen" });
  assert.deepEqual(elsewhere(index, "gangs:lamp1", "lounge", true), { floorId: "f1", roomId: "kitchen" });
});

test("a device outside every room is elsewhere; an unknown id is not", () => {
  assert.deepEqual(elsewhere(index, "switch.sample_garden", "lounge", true), { floorId: "f1", roomId: null });
  assert.equal(elsewhere(index, "switch.unknown", "lounge", true), null);
});

test("the preference is off unless stored as 1", () => {
  const store = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store.get(k) ?? null };
  assert.equal(tapInRoomOn(), false);
  store.set(TAP_IN_ROOM_KEY, "1");
  assert.equal(tapInRoomOn(), true);
  delete (globalThis as { localStorage?: unknown }).localStorage;
  assert.equal(tapInRoomOn(), false);
});
