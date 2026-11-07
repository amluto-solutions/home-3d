import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor } from "./model.ts";
import { searchIndex, searchItems } from "./search.ts";
import type { HomeAssistant } from "./types.ts";

test("search finds rooms and placed devices by name, room and without accents", () => {
  const hass = {
    language: "en",
    states: {
      "light.ceiling": { entity_id: "light.ceiling", state: "on", attributes: { friendly_name: "Ceiling light Café" } },
      "sensor.t": { entity_id: "sensor.t", state: "21", attributes: { friendly_name: "Temperature" } },
    },
  } as unknown as HomeAssistant;
  const b = emptyBuilding();
  const floor = newFloor("ground", "Ground floor", 0);
  floor.rooms = [{ id: "k", name: "Café", area_id: null, points: [[0, 0], [4, 0], [4, 3], [0, 3]], floor_material: "wood" }];
  floor.placements = [{ entity_id: "sensor.t", x: 1, z: 1, y: null, mount: null }];
  floor.furniture = [{ id: "l", type: "lamp_ceiling", x: 2, z: 2, rotation: 0, w: 0.4, d: 0.4, h: 0.1, variant: null, entity: "light.ceiling", power: null }];
  b.floors = [floor];
  const index = searchIndex(hass, b);
  assert.equal(index.length, 3);
  // the room comes first, then its devices; "cafe" matches "Café"
  const hits = searchItems(index, "cafe");
  assert.equal(hits[0].kind, "room");
  assert.ok(hits.some((h) => h.entity === "light.ceiling"));
  // devices know their room
  const temp = searchItems(index, "temp")[0];
  assert.equal(temp.entity, "sensor.t");
  assert.equal(temp.where, "Café");
  assert.deepEqual(searchItems(index, "  "), []);
});
