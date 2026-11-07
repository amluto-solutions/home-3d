// Live room effects (#10): a wet leak sensor turns its room's floor red, motion lights a room for a short while,
// radiators and hot-water cylinders shade from cold blue to warm red with their temperature.

import { areaEntities, toCelsius, tempUnit } from "./devices.ts";
import { isPackHeater } from "./packs.ts";
import { pointInPolygon, type Building, type EffectSettings, type Floor, type Furniture, type Room } from "./model.ts";
import type { HomeAssistant } from "./types.ts";

/** A wet leak sensor's room floor. */
export const LEAK_COLOR: [number, number, number] = [1, 0.12, 0.1];

export type LiveKind = "leak" | "motion";

/** The binary sensor classes of each kind. */
const LIVE_CLASSES: Record<LiveKind, ReadonlySet<string>> = {
  leak: new Set(["moisture"]),
  motion: new Set(["motion", "occupancy", "presence"]),
};

/**
 * A room's leak or motion sensors: the one chosen for the room, else every one of its area and those placed
 * inside it (a sensor of the area placed in another room counts there instead).
 */
export function roomLiveSensors(hass: HomeAssistant, floor: Floor | null, room: Room, kind: LiveKind): string[] {
  const chosen = room.live?.[kind];
  if (chosen === "none") return [];
  if (chosen) return hass.states[chosen] ? [chosen] : [];
  const classes = LIVE_CLASSES[kind];
  const fits = (id: string) => id.startsWith("binary_sensor.") && classes.has(String(hass.states[id]?.attributes.device_class ?? ""));
  const inRoom = (x: number, z: number) => room.points.length >= 3 && pointInPolygon([x, z], room.points);
  const placed = floor?.placements.filter((p) => fits(p.entity_id)) ?? [];
  const here = placed.filter((p) => inRoom(p.x, p.z)).map((p) => p.entity_id);
  const elsewhere = new Set(placed.filter((p) => !inRoom(p.x, p.z)).map((p) => p.entity_id));
  return [...new Set([...areaEntities(hass, room.area_id).filter((id) => fits(id) && !elsewhere.has(id)), ...here])];
}

/** The settings' defaults: 30 s of light after motion, 30 s of a red camera; radiators blue at 18 °C, red at 45 °C; a cylinder 25 to 55 °C. */
export const EFFECT_DEFAULTS: Required<{ [K in keyof EffectSettings]: number }> = {
  motion_seconds: 30,
  camera_seconds: 30,
  radiator_cold: 18,
  radiator_hot: 45,
  tank_cold: 25,
  tank_hot: 55,
};

/** The plan's effect settings, each missing (or nonsense) one at its default. */
export function effectSettings(b: Building): Required<{ [K in keyof EffectSettings]: number }> {
  const own = b.settings.effects ?? {};
  const out = { ...EFFECT_DEFAULTS };
  for (const key of Object.keys(out) as (keyof typeof out)[]) {
    const v = own[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  out.motion_seconds = Math.max(0, Math.min(3600, out.motion_seconds));
  out.camera_seconds = Math.max(0, Math.min(3600, out.camera_seconds));
  return out;
}

/**
 * The rooms motion lights now: a motion sensor that is on lights its room until the set time has passed since it
 * turned on. `next` is when the next of them goes dark (epoch ms; null = none lit), for the view to look again.
 */
export function motionRooms(hass: HomeAssistant, b: Building, now: number): { rooms: Set<string>; next: number | null } {
  const rooms = new Set<string>();
  let next: number | null = null;
  const ms = effectSettings(b).motion_seconds * 1000;
  if (ms <= 0) return { rooms, next };
  for (const floor of b.floors) {
    for (const room of floor.rooms) {
      for (const id of roomLiveSensors(hass, floor, room, "motion")) {
        const st = hass.states[id];
        if (st?.state !== "on") continue;
        const since = Date.parse(st.last_changed ?? "");
        // no time known: lit while on
        const until = Number.isFinite(since) ? since + ms : Number.POSITIVE_INFINITY;
        if (until <= now) continue;
        rooms.add(room.id);
        if (Number.isFinite(until) && (next === null || until < next)) next = until;
      }
    }
  }
  return { rooms, next };
}

type Rgb = [number, number, number];

/** Cold blue, through amber, to warm red. */
const SHADE_STOPS: [number, Rgb][] = [
  [0, [0.22, 0.5, 1]],
  [0.6, [1, 0.62, 0.22]],
  [1, [1, 0.16, 0.1]],
];

/** The colour of a temperature between `cold` (blue) and `hot` (red), clamped at both ends. */
export function tempShade(celsius: number, cold: number, hot: number): Rgb {
  const t = hot > cold ? Math.max(0, Math.min(1, (celsius - cold) / (hot - cold))) : celsius >= hot ? 1 : 0;
  for (let i = 1; i < SHADE_STOPS.length; i++) {
    const [t1, c1] = SHADE_STOPS[i];
    const [t0, c0] = SHADE_STOPS[i - 1];
    if (t <= t1) {
      const k = (t - t0) / (t1 - t0);
      return [c0[0] + (c1[0] - c0[0]) * k, c0[1] + (c1[1] - c0[1]) * k, c0[2] + (c1[2] - c0[2]) * k];
    }
  }
  return SHADE_STOPS[SHADE_STOPS.length - 1][1];
}

/** What shades with its temperature: a radiator (with or without its TRV) or a hot-water tank. */
export function shadeKind(type: string): "radiator" | "tank" | null {
  // towel rails warm up like a radiator: plain, heated and electric ones alike (#140)
  if (type === "radiator" || /^pack:.*:(radiator|trv|(heated_|electric_)?towel_rail)(_[a-z0-9_]+)?$/.test(type)) return "radiator";
  if (isPackHeater(type)) return "tank";
  return null;
}

const isTemperature = (hass: HomeAssistant, id: string | null | undefined): id is string =>
  !!id && id !== "none" && id.startsWith("sensor.") && hass.states[id]?.attributes.device_class === "temperature";

/** Names of a tank's own temperature among a heat pump's many. */
const TANK_NAME = /(tank|cylinder|dhw|hot.?water|boiler)/i;

/** A temperature sensor of the device the item's entity belongs to: the only one, or (a tank) the one named for it. */
function deviceTemperature(hass: HomeAssistant, entity: string | null | undefined, kind: "radiator" | "tank"): string | null {
  const device = entity && entity !== "none" ? hass.entities?.[entity]?.device_id : null;
  if (!device || !hass.entities) return null;
  const temps = Object.values(hass.entities)
    .filter((e) => e.device_id === device && isTemperature(hass, e.entity_id))
    .map((e) => e.entity_id);
  if (kind === "tank") return temps.find((id) => TANK_NAME.test(`${id} ${hass.states[id]?.attributes.friendly_name ?? ""}`)) ?? (temps.length === 1 ? temps[0] : null);
  return temps.length === 1 ? temps[0] : null;
}

/** A temperature in °C from a sensor's state, or a thermostat's or water heater's current temperature. */
function readCelsius(hass: HomeAssistant, id: string): number | null {
  const st = hass.states[id];
  if (!st) return null;
  if (id.startsWith("climate.") || id.startsWith("water_heater.")) {
    const v = st.attributes.current_temperature;
    return typeof v === "number" && Number.isFinite(v) ? toCelsius(v, tempUnit(hass)) : null;
  }
  if (st.state === "" || st.state === "unavailable" || st.state === "unknown") return null;
  const v = Number(st.state);
  return Number.isFinite(v) ? toCelsius(v, st.attributes.unit_of_measurement) : null;
}

/** The entity an item's temperature comes from: the chosen one, a temperature at its symbol, its water heater, its device's. */
export function itemTempSource(hass: HomeAssistant, f: Furniture): string | null {
  const kind = shadeKind(f.type);
  if (!kind || f.temp_sensor === "none") return null;
  if (f.temp_sensor) return f.temp_sensor;
  if (isTemperature(hass, f.extra)) return f.extra;
  if (kind === "tank" && f.entity?.startsWith("water_heater.")) return f.entity;
  return deviceTemperature(hass, f.entity, kind);
}

export interface ItemShade {
  kind: "radiator" | "tank";
  /** Where the temperature comes from, and the temperature in °C. */
  sensor: string;
  celsius: number;
  color: Rgb;
}

/** How a radiator or hot-water cylinder shades now (null: no temperature, or not such an item). */
export function itemShade(hass: HomeAssistant, b: Building, f: Furniture): ItemShade | null {
  const kind = shadeKind(f.type);
  const sensor = kind ? itemTempSource(hass, f) : null;
  const celsius = sensor ? readCelsius(hass, sensor) : null;
  if (!kind || !sensor || celsius === null) return null;
  const s = effectSettings(b);
  const color = kind === "radiator" ? tempShade(celsius, s.radiator_cold, s.radiator_hot) : tempShade(celsius, s.tank_cold, s.tank_hot);
  return { kind, sensor, celsius, color };
}
