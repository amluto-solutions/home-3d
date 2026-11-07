// The area import (#61): a real home offers rooms for the Home Assistant areas of a floor that has none yet; a sample
// or template home (settings.area_import false) never offers this install's own areas.

import assert from "node:assert/strict";
import { test } from "node:test";
import { createHome } from "./api.ts";
import { emptyBuilding, newFloor, unplacedAreas } from "./model.ts";
import type { HomeAssistant } from "./types.ts";

const AREAS = {
  kitchen: { area_id: "kitchen", name: "Kitchen", floor_id: "ground" },
  lounge: { area_id: "lounge", name: "Lounge", floor_id: "ground" },
  office: { area_id: "office", name: "Office", floor_id: "upstairs" },
};

function plan(areaImport?: boolean) {
  const b = emptyBuilding();
  const floor = { ...newFloor("f", "Ground", 0), ha_floor: "ground" };
  floor.rooms.push({ id: "r", name: "Kitchen", area_id: "kitchen", points: [[0, 0], [1, 0], [1, 1]] } as never);
  b.floors.push(floor);
  if (areaImport !== undefined) b.settings.area_import = areaImport;
  return { b, floor };
}

test("a real home offers the floor's areas that have no room yet (#61)", () => {
  const { b, floor } = plan();
  assert.deepEqual(unplacedAreas(b, floor, AREAS).map((a) => a.area_id), ["lounge"]);
  assert.deepEqual(unplacedAreas(plan(true).b, plan(true).floor, AREAS).map((a) => a.area_id), ["lounge"]);
});

test("a sample or template home offers no Home Assistant areas (#61)", () => {
  const { b, floor } = plan(false);
  assert.deepEqual(unplacedAreas(b, floor, AREAS), []);
});

test("a floor without a Home Assistant floor offers no areas (#61)", () => {
  const { b, floor } = plan();
  assert.deepEqual(unplacedAreas(b, { ...floor, ha_floor: null }, AREAS), []);
});

test("a sample or template home is created without the area import; a real one keeps it (#61)", async () => {
  const sent: Record<string, unknown>[] = [];
  const hass = { callWS: async (msg: Record<string, unknown>) => (sent.push(msg), {}) } as unknown as HomeAssistant;
  await createHome(hass, "Sample", { areaImport: false });
  await createHome(hass, "Flat");
  assert.deepEqual(sent, [
    { type: "home_3d/homes/create", name: "Sample", area_import: false },
    { type: "home_3d/homes/create", name: "Flat" },
  ]);
});
