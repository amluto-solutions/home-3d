import assert from "node:assert/strict";
import { test } from "node:test";
import type { Alert } from "./alerts.ts";
import type { Room } from "./model.ts";
import { emptyBuilding, newFloor } from "./model.ts";
import { roomSentence, sceneSummary } from "./room-summary.ts";
import type { HassEntity, HomeAssistant } from "./types.ts";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity => ({ entity_id, state, attributes });
const rect = (id: string, name: string, area: string | null, x0: number, extra: Partial<Room> = {}): Room => ({
  id, name, area_id: area, points: [[x0, 0], [x0 + 4, 0], [x0 + 4, 3], [x0, 3]], floor_material: "wood", ...extra,
});

function setup() {
  const building = emptyBuilding();
  building.floors = [
    { ...newFloor("g", "Ground", 0), rooms: [rect("lounge", "Lounge", "lounge", 0, { climate: { temperature: "sensor.lounge_t" } }), rect("hall", "Hall", null, 4)] },
    { ...newFloor("u", "Upstairs", 3), rooms: [rect("bed", "Bedroom", "bed", 0)] },
  ];
  const hass: HomeAssistant = {
    language: "en",
    connection: {} as HomeAssistant["connection"],
    callWS: async () => undefined as never,
    callService: async () => undefined,
    areas: { lounge: { area_id: "lounge", name: "Lounge" }, bed: { area_id: "bed", name: "Bedroom" } },
    entities: {
      "light.lounge_a": { entity_id: "light.lounge_a", area_id: "lounge" },
      "light.lounge_b": { entity_id: "light.lounge_b", area_id: "lounge" },
      "light.bed": { entity_id: "light.bed", area_id: "bed" },
    },
    states: Object.fromEntries(
      [
        st("light.lounge_a", "on"),
        st("light.lounge_b", "off"),
        st("light.bed", "off"),
        st("sensor.lounge_t", "21.46", { device_class: "temperature", unit_of_measurement: "°C" }),
      ].map((s) => [s.entity_id, s]),
    ),
  };
  return { hass, building };
}

const smoke = (roomId: string | null, floorId: string | null): Alert => ({ kind: "smoke", entity: "binary_sensor.smoke", roomId, floorId });

test("every room of the floor is listed with its lights, temperature and warnings (#195)", () => {
  const { hass, building } = setup();
  const [ground, up] = sceneSummary(hass, building, [], null);
  assert.deepEqual(ground.rooms.map((r) => [r.name, r.lightsOn, r.lights, r.temperature]), [["Lounge", 1, 2, "21.5 °C"], ["Hall", 0, 0, null]]);
  assert.equal(ground.name, "Ground");
  assert.deepEqual(up.rooms.map((r) => [r.name, r.lightsOn, r.lights]), [["Bedroom", 0, 1]]);
  // the sentence a screen reader gets
  assert.equal(roomSentence(hass, ground.rooms[0]), "Lounge: 1 of 2 lights on, 21.5 °C");
  assert.equal(roomSentence(hass, up.rooms[0]), "Bedroom: lights off");
  // a room with nothing to tell is just named
  assert.equal(roomSentence(hass, ground.rooms[1]), "Hall");
});

test("one floor only when a floor is open (#195)", () => {
  const { hass, building } = setup();
  const only = sceneSummary(hass, building, [], "u");
  assert.deepEqual(only.map((f) => f.floorId), ["u"]);
});

test("a warning shows with its room, a house-wide one with every room, a quiet one with none (#195)", () => {
  const { hass, building } = setup();
  const list = (a: Alert) => sceneSummary(hass, building, [a], null).flatMap((f) => f.rooms).map((r) => r.alerts.length);
  assert.deepEqual(list(smoke("lounge", "g")), [1, 0, 0]);
  assert.deepEqual(list(smoke(null, null)), [1, 1, 1]);
  assert.deepEqual(list(smoke(null, "u")), [0, 0, 1]);
  assert.deepEqual(list({ ...smoke("lounge", "g"), quiet: true }), [0, 0, 0]);
  const [g] = sceneSummary(hass, building, [smoke("lounge", "g")], null);
  assert.match(roomSentence(hass, g.rooms[0]), /^Lounge: 1 of 2 lights on, 21\.5 °C, Lounge · /);
});
