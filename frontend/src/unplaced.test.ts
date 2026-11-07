import assert from "node:assert/strict";
import { test } from "node:test";
import { newFloor, type Building, type Floor, type Furniture } from "./model.ts";
import { emptyBuilding } from "./model.ts";
import type { HomeAssistant } from "./types.ts";
import { hiddenUnplaced, setUnplacedHidden, suggestLinks, unplacedByArea } from "./unplaced.ts";

/** A hand-built Home Assistant with two areas and a few devices (generic ids only). */
function hassWith(): HomeAssistant {
  const states: Record<string, unknown> = {};
  const entities: Record<string, unknown> = {};
  const add = (id: string, area: string | null, attributes: Record<string, unknown> = {}, device?: string, state = "on") => {
    entities[id] = { entity_id: id, area_id: area, ...(device ? { device_id: device } : {}) };
    states[id] = { entity_id: id, state, attributes };
  };
  add("light.sample_lounge_lamp", "area_lounge", { friendly_name: "Lounge lamp" });
  add("climate.sample_lounge_radiator", "area_lounge", { friendly_name: "Lounge radiator" }, undefined, "heat");
  add("camera.sample_hall_door", "area_hall", { friendly_name: "Hall door" }, "dev_cam", "idle");
  add("binary_sensor.sample_hall_door_motion", "area_hall", { friendly_name: "Hall door motion", device_class: "motion" }, "dev_cam", "off");
  add("switch.sample_hall_plug", "area_hall", { friendly_name: "Hall plug" });
  return {
    language: "en",
    states,
    entities,
    devices: {},
    areas: { area_lounge: { area_id: "area_lounge", name: "Lounge" }, area_hall: { area_id: "area_hall", name: "Hall" } },
  } as unknown as HomeAssistant;
}

const square = (x: number): [number, number][] => [
  [x, 0],
  [x + 4, 0],
  [x + 4, 4],
  [x, 4],
];

function building(extra: Partial<Floor> = {}): Building {
  const b = emptyBuilding();
  b.floors = [
    {
      ...newFloor("f1", "Ground", 0),
      rooms: [
        { id: "lounge", name: "Lounge", points: square(0), area_id: "area_lounge" } as Floor["rooms"][number],
        { id: "hall", name: "Hall", points: square(4), area_id: "area_hall" } as Floor["rooms"][number],
      ],
      ...extra,
    },
  ];
  return b;
}

const item = (id: string, type: string, x: number, extra: Partial<Furniture> = {}): Furniture => ({ id, type, x, z: 2, rotation: 0, w: 0.5, d: 0.2, h: 0.5, variant: null, entity: null, power: null, ...extra });

test("unplaced entities are listed by Home Assistant area, one row per device, with the area's room (#83)", () => {
  const areas = unplacedByArea(hassWith(), building());
  assert.deepEqual(
    areas.map((a) => [a.name, a.floorId, a.roomId, a.ids]),
    [
      ["Hall", "f1", "hall", ["switch.sample_hall_plug", "binary_sensor.sample_hall_door_motion", "camera.sample_hall_door"]],
      ["Lounge", "f1", "lounge", ["light.sample_lounge_lamp", "climate.sample_lounge_radiator"]],
    ],
  );
});

test("placed pins, linked items and hidden entities leave the list; a placed camera takes its device's sensor along (#83)", () => {
  const b = building({
    placements: [{ entity_id: "camera.sample_hall_door", x: 5, z: 1, y: null, mount: null }],
    furniture: [item("lamp", "lamp_floor", 1, { entity: "light.sample_lounge_lamp" })],
  });
  const areas = unplacedByArea(hassWith(), b, { hidden: ["switch.sample_hall_plug"], linked: ["climate.sample_lounge_radiator"] });
  assert.deepEqual(areas, []);
});

test("an unplaced entity gets a one-tap link to an unlinked item of its area's room, by kind or by name (#83)", () => {
  const hass = hassWith();
  const b = building({
    furniture: [
      // the lamp has no light yet: a light of its room is the obvious one
      item("lamp", "lamp_floor", 1),
      // linked to nothing on purpose: never suggested
      item("radiator", "radiator", 2, { entity: "none" }),
      // a desk named after the plug in the hall: the plug by name
      item("desk", "desk", 6, { name: "Hall plug desk" }),
      // a lamp in the hall: not for a light of the lounge
      item("hall_lamp", "lamp_floor", 7),
    ],
  });
  const areas = unplacedByArea(hass, b);
  const got = suggestLinks(hass, b, areas);
  assert.deepEqual([...got].sort(), [
    ["light.sample_lounge_lamp", { floorId: "f1", furnitureId: "lamp" }],
    ["switch.sample_hall_plug", { floorId: "f1", furnitureId: "desk" }],
  ]);
});

test("an item already linked automatically is not suggested again (#83)", () => {
  const hass = hassWith();
  const b = building({ furniture: [item("lamp", "lamp_floor", 1)] });
  const got = suggestLinks(hass, b, unplacedByArea(hass, b), new Map([["lamp", { entity: "light.other", power: null }]]));
  assert.equal(got.size, 0);
});

test("hiding an entity keeps it in the plan's list of hidden ones, where it can be unhidden (#83)", () => {
  const hass = hassWith();
  const b = building();
  b.settings = { ...b.settings, unplaced_hidden: setUnplacedHidden(b.settings, "switch.sample_hall_plug", true) };
  assert.deepEqual(b.settings.unplaced_hidden, ["switch.sample_hall_plug"]);
  // hidden: out of the list, in the Hidden view with its area
  assert.equal(unplacedByArea(hass, b).find((a) => a.name === "Hall")!.ids.includes("switch.sample_hall_plug"), false);
  assert.deepEqual(hiddenUnplaced(hass, b), [{ id: "switch.sample_hall_plug", area: "Hall" }]);
  // hiding twice changes nothing; unhiding brings it back
  assert.deepEqual(setUnplacedHidden(b.settings, "switch.sample_hall_plug", true), ["switch.sample_hall_plug"]);
  b.settings = { ...b.settings, unplaced_hidden: setUnplacedHidden(b.settings, "switch.sample_hall_plug", false) };
  assert.deepEqual(b.settings.unplaced_hidden, []);
  assert.equal(unplacedByArea(hass, b).find((a) => a.name === "Hall")!.ids.includes("switch.sample_hall_plug"), true);
});

test("an entity hidden and then removed from Home Assistant drops out of the Hidden view (#83)", () => {
  const b = building();
  b.settings = { ...b.settings, unplaced_hidden: ["switch.sample_gone"] };
  assert.deepEqual(hiddenUnplaced(hassWith(), b), []);
});
