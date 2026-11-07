// A small plan and Home Assistant for the Settings page tests (#139); placeholder entity ids only.
import type { Building } from "../model.ts";
import type { HomeAssistant } from "../types.ts";

export function sampleBuilding(): Building {
  const room = { id: "r1", name: "Hall", points: [[0, 0], [4, 0], [4, 3], [0, 3]], area_id: null };
  return {
    version: 1,
    floors: [
      { id: "f0", name: "Ground", elevation: 0, height: 2.5, rooms: [room], furniture: [], placements: [{ entity_id: "camera.sample_door", x: 1, z: 1 }], openings: [], walls: [] },
      { id: "f1", name: "Upstairs", elevation: 2.6, height: 2.5, rooms: [], furniture: [], placements: [], openings: [], walls: [] },
    ],
    settings: { wall_exterior: 0.24, wall_interior: 0.12, grid: 0.05, north: 0, roof: { type: "none", pitch: 35, overhang: 0.4 }, director: { doorbell: true } },
    energy: { meter: null, grid: null, grid_invert: false, solar: null, battery: null, battery_invert: false, battery_soc: null, consumption: null, tariff: null },
    presence: [],
  } as unknown as Building;
}

export function sampleHass(): HomeAssistant {
  const st = (entity_id: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state: "on", attributes, last_changed: "", last_updated: "" });
  const states = Object.fromEntries(
    [
      st("camera.sample_door"),
      st("event.sample_doorbell", { device_class: "doorbell" }),
      st("binary_sensor.sample_rain", { device_class: "moisture" }),
      st("binary_sensor.sample_grid", { device_class: "power" }),
      st("sensor.sample_power", { device_class: "power", unit_of_measurement: "W" }),
      st("input_text.sample_notes"),
      st("weather.sample_home"),
      st("scene.sample_evening"),
    ].map((s) => [s.entity_id, s]),
  );
  return { language: "en", user: { id: "u1", is_admin: true, name: "Admin" }, states, config: { unit_system: { temperature: "°C" } }, connection: {}, callWS: async () => ({}), callService: async () => ({}) } as unknown as HomeAssistant;
}

