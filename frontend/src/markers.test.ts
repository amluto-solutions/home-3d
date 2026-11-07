import assert from "node:assert/strict";
import { test } from "node:test";
import { cameraMotionSensors, cameraRedUntil, detectionKind, buildMarkers, setCameraSensors, stateText } from "./markers.ts";
import type { Building } from "./model.ts";
import { emptyBuilding, newFloor } from "./model.ts";
import type { HassEntity, HomeAssistant } from "./types.ts";
import { readFileSync } from "node:fs";
import { useLanguage } from "./i18n.ts";

// these tests read the French texts, which a page fetches from its language pack (#134)
const fr = JSON.parse(readFileSync(new URL("../../custom_components/home_3d/bundled_languages/amluto.lang-fr/strings.json", import.meta.url), "utf8"));
useLanguage("fr", fr);

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity => ({ entity_id, state, attributes });

function hassWith(states: HassEntity[]): HomeAssistant {
  return {
    language: "fr",
    connection: {} as HomeAssistant["connection"],
    callWS: async () => undefined as never,
    callService: async () => undefined,
    areas: { living: { area_id: "living", name: "Salon" } },
    states: Object.fromEntries(states.map((s) => [s.entity_id, s])),
  };
}

test("state texts are short and localised", () => {
  const hass = hassWith([]);
  assert.equal(stateText(hass, st("light.a", "on", { brightness: 128 })), "50 %");
  assert.equal(stateText(hass, st("light.a", "off")), "Éteint");
  assert.equal(stateText(hass, st("cover.a", "open", { current_position: 70 })), "70 %");
  assert.equal(stateText(hass, st("cover.a", "closing", { current_position: 70 })), "Fermeture");
  assert.equal(stateText(hass, st("binary_sensor.f", "on", { device_class: "window" })), "Ouvert");
  assert.equal(stateText(hass, st("binary_sensor.m", "off", { device_class: "motion" })), "Rien");
  assert.equal(stateText(hass, st("climate.h", "heat", { current_temperature: 21.4 })), "21,4 °C");
  assert.equal(stateText(hass, st("sensor.t", "21.44", { unit_of_measurement: "°C" })), "21,4 °C");
  assert.equal(stateText(hass, st("light.a", "unavailable")), "Indisponible");
  assert.equal(stateText(hass, undefined), "Indisponible");
});

test("markers find their room, default height and light glow; missing entities are skipped", () => {
  const floor = newFloor("ground", "Ground floor", 0);
  floor.rooms = [{ id: "r", name: "Salon", area_id: "living", points: [[0, 0], [4, 0], [4, 3], [0, 3]], floor_material: "wood" }];
  floor.placements = [
    { entity_id: "light.ceiling", x: 2, z: 1.5, y: null },
    { entity_id: "switch.outside", x: 9, z: 9, y: 0.4 },
    { entity_id: "light.deleted", x: 1, z: 1, y: null },
  ];
  const building: Building = { ...emptyBuilding(), floors: [floor] };
  const hass = hassWith([st("light.ceiling", "on", { friendly_name: "Salon Plafond", brightness: 255 }), st("switch.outside", "off")]);
  const markers = buildMarkers(hass, building);
  assert.equal(markers.length, 2);
  const [lamp, sw] = markers;
  assert.equal(lamp.roomId, "r");
  assert.equal(lamp.name, "Plafond");
  assert.equal(lamp.y, 2.25);
  assert.ok(lamp.active && lamp.glow && lamp.glow.level === 1);
  assert.equal(sw.roomId, null);
  assert.equal(sw.y, 0.4);
  assert.equal(sw.glow, null);
});

test("a TV shows the app that is running", () => {
  const hass = hassWith([]);
  assert.equal(stateText(hass, st("media_player.tv", "on", { app_name: "YouTube" })), "YouTube");
  assert.equal(stateText(hass, st("media_player.tv", "playing", { media_title: "Les infos" })), "Les infos");
  assert.equal(stateText(hass, st("media_player.tv", "off", { app_name: "YouTube" })), "Éteint");
});

test("sensor values use the decimals set in Home Assistant", () => {
  const st = { entity_id: "sensor.gas", state: "1234.567", attributes: { unit_of_measurement: "m³" } };
  const hass = { language: "en", entities: { "sensor.gas": { entity_id: "sensor.gas", display_precision: 3 } } } as unknown as HomeAssistant;
  assert.equal(stateText(hass, st), "1,234.567 m³");
  assert.equal(stateText({ ...hass, entities: {} } as HomeAssistant, st), "1,234.6 m³");
});

test("a placement's marker setting reaches the marker", () => {
  const b: Building = emptyBuilding();
  b.floors = [{ ...newFloor("ground", "Ground floor", 0), placements: [{ entity_id: "sensor.t", x: 1, z: 1, y: null, marker: "always" }, { entity_id: "switch.s", x: 2, z: 1, y: null }] }];
  const hass = { language: "fr", states: { "sensor.t": { entity_id: "sensor.t", state: "21", attributes: {} }, "switch.s": { entity_id: "switch.s", state: "on", attributes: {} } } } as unknown as HomeAssistant;
  const [t, s] = buildMarkers(hass, b);
  assert.equal(t.show, "always");
  assert.equal(s.show, undefined);
});

test("a camera's detection sensors are told apart by what they detect", () => {
  const hass = { states: { "binary_sensor.driveway_car_occupancy": { entity_id: "binary_sensor.driveway_car_occupancy", state: "on", attributes: {} }, "binary_sensor.x": { entity_id: "binary_sensor.x", state: "on", attributes: { friendly_name: "Terrace dog detected" } } } } as unknown as Parameters<typeof detectionKind>[0];
  assert.equal(detectionKind(hass, "binary_sensor.front_door_person_occupancy"), "person");
  assert.equal(detectionKind(hass, "binary_sensor.driveway_car_occupancy"), "car");
  assert.equal(detectionKind(hass, "binary_sensor.x"), "pet");
  assert.equal(detectionKind(hass, "binary_sensor.hall_motion"), "motion");
});

test("a camera counts its own device's detection sensors, or exactly the ones chosen by hand (#815)", () => {
  const st = (id: string, dc: string) => ({ entity_id: id, state: "off", attributes: { device_class: dc } });
  const hass = {
    states: { "camera.driveway": st("camera.driveway", ""), "binary_sensor.driveway_motion": st("binary_sensor.driveway_motion", "motion"), "binary_sensor.frigate_person": st("binary_sensor.frigate_person", "occupancy") },
    entities: {
      "camera.driveway": { entity_id: "camera.driveway", device_id: "reolink" },
      "binary_sensor.driveway_motion": { entity_id: "binary_sensor.driveway_motion", device_id: "reolink" },
      "binary_sensor.frigate_person": { entity_id: "binary_sensor.frigate_person", device_id: "frigate" },
    },
  } as unknown as HomeAssistant;
  const floor = newFloor("ground", "Ground floor", 0);
  floor.placements.push({ entity_id: "camera.driveway", x: 1, z: 1 } as Building["floors"][number]["placements"][number]);
  const b = { ...emptyBuilding(), floors: [floor] } as Building;
  setCameraSensors(b);
  assert.deepEqual(cameraMotionSensors(hass, "camera.driveway"), ["binary_sensor.driveway_motion"]);
  floor.placements[0].detect_sensors = ["binary_sensor.frigate_person"];
  setCameraSensors(b);
  assert.deepEqual(cameraMotionSensors(hass, "camera.driveway"), ["binary_sensor.frigate_person"]);
  setCameraSensors(null);
});

test("a camera stays red for the hold time after its motion passed (#137)", () => {
  const t0 = Date.parse("2026-10-30T12:00:00Z");
  const sensor = (state: string, changed: number) =>
    ({ entity_id: "binary_sensor.drive_motion", state, last_changed: new Date(changed).toISOString(), attributes: { device_class: "motion" } }) as unknown as HassEntity;
  const hassWith = (s: HassEntity) =>
    ({
      states: { "camera.drive": { entity_id: "camera.drive", state: "idle", attributes: {} }, "binary_sensor.drive_motion": s },
      entities: { "camera.drive": { entity_id: "camera.drive", device_id: "cam" }, "binary_sensor.drive_motion": { entity_id: "binary_sensor.drive_motion", device_id: "cam" } },
    }) as unknown as HomeAssistant;
  setCameraSensors(null);
  // on: red with no end
  assert.equal(cameraRedUntil(hassWith(sensor("on", t0)), "camera.drive", 30_000, t0 + 90_000), Number.POSITIVE_INFINITY);
  // off 10 s ago: red for another 20 s
  assert.equal(cameraRedUntil(hassWith(sensor("off", t0)), "camera.drive", 30_000, t0 + 10_000), t0 + 30_000);
  // off longer than the hold, or no hold: not red
  assert.equal(cameraRedUntil(hassWith(sensor("off", t0)), "camera.drive", 30_000, t0 + 31_000), null);
  assert.equal(cameraRedUntil(hassWith(sensor("off", t0)), "camera.drive", 0, t0 + 1_000), null);
  // the marker follows, with the plan's own hold time
  const floor = newFloor("ground", "Ground floor", 0);
  floor.placements.push({ entity_id: "camera.drive", x: 1, z: 1 } as Building["floors"][number]["placements"][number]);
  const b = { ...emptyBuilding(), floors: [floor] } as Building;
  assert.equal(buildMarkers(hassWith(sensor("off", t0)), b, t0 + 20_000)[0].motion, true);
  b.settings = { ...b.settings, effects: { camera_seconds: 10 } };
  assert.equal(buildMarkers(hassWith(sensor("off", t0)), b, t0 + 20_000)[0].motion, false);
});

test("a camera's red hold counts from when this browser saw the sensor go off, not from Home Assistant's clock (#199)", async (t) => {
  const real = Date.parse("2026-10-30T12:00:00Z");
  t.mock.timers.enable({ apis: ["Date"], now: real });
  const ha = (state: string, changedMs: number) =>
    ({
      states: {
        "camera.yard": { entity_id: "camera.yard", state: "idle", attributes: {} },
        "binary_sensor.yard_motion": { entity_id: "binary_sensor.yard_motion", state, last_changed: new Date(changedMs).toISOString(), attributes: { device_class: "motion" } },
      },
      entities: { "camera.yard": { entity_id: "camera.yard", device_id: "cam2" }, "binary_sensor.yard_motion": { entity_id: "binary_sensor.yard_motion", device_id: "cam2" } },
    }) as unknown as HomeAssistant;
  setCameraSensors(null);
  // Home Assistant's clock runs 10 minutes behind this browser's
  const skew = -10 * 60_000;
  // seen on, then off: the hold counts from the moment of seeing it, 30 s
  assert.equal(cameraRedUntil(ha("on", real + skew), "camera.yard", 30_000, real), Number.POSITIVE_INFINITY);
  t.mock.timers.setTime(real + 5_000);
  assert.equal(cameraRedUntil(ha("off", real + 5_000 + skew), "camera.yard", 30_000, real + 5_000), real + 35_000);
  t.mock.timers.setTime(real + 20_000);
  assert.equal(cameraRedUntil(ha("off", real + 5_000 + skew), "camera.yard", 30_000, real + 20_000), real + 35_000);
  t.mock.timers.setTime(real + 36_000);
  assert.equal(cameraRedUntil(ha("off", real + 5_000 + skew), "camera.yard", 30_000, real + 36_000), null);
  // a sensor already off when first looked at (page just loaded) with a clock ahead of the server: never held from the future
  t.mock.timers.setTime(real + 100_000);
  setCameraSensors(null);
  const fresh = ha("off", real + 100_000 + 5 * 60_000);
  fresh.states["binary_sensor.yard_motion"].last_changed = new Date(real + 100_000 + 5 * 60_000).toISOString();
  const until = cameraRedUntil({ ...fresh, entities: { ...fresh.entities, "binary_sensor.yard_motion": { entity_id: "binary_sensor.yard_motion", device_id: "cam3" }, "camera.yard": { entity_id: "camera.yard", device_id: "cam3" } } } as HomeAssistant, "camera.yard", 30_000, real + 100_000);
  assert.ok(until === null || until <= real + 130_000);
});
