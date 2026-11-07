// Today's kWh at the end of an energy cable (#29): the energy sensor of the circuit or device the cable runs to.

import type { Consumer } from "./energy.ts";
import type { HomeAssistant } from "./types.ts";

const isEnergy = (hass: HomeAssistant, id: string) => id.startsWith("sensor.") && hass.states[id]?.attributes.device_class === "energy";

/**
 * The energy sensor (kWh counter) that belongs to a power sensor: the one linked on the item ("none" = none), else the
 * one named after the power sensor (PowerCalc: sensor.x_power → sensor.x_energy), else the only one of its device, or,
 * on a device with several (a circuit monitor's channels), the one named like it. Unsure: none rather than a wrong one.
 */
export function energySensorFor(hass: HomeAssistant, powerSensor: string, linked?: string | null): string | null {
  if (linked === "none") return null;
  if (linked) return linked;
  const stem = powerSensor.replace(/^sensor\./, "").replace(/_?power$/, "");
  const named = `sensor.${stem}_energy`;
  if (isEnergy(hass, named)) return named;
  const device = hass.entities?.[powerSensor]?.device_id;
  if (!device) return null;
  const list = Object.keys(hass.states).filter((id) => isEnergy(hass, id) && hass.entities?.[id]?.device_id === device);
  if (list.length === 1) return list[0];
  return list.find((id) => id.startsWith(`sensor.${stem}_`)) ?? null;
}

/** A wire end to look up: its key (the consumer), its energy sensor (null: none) and its power sensor. */
export interface WireEndSensors {
  key: string;
  energy: string | null;
  power: string;
}

/** A cable's end at a consumer: where it is and the sensors its today's kWh come from. */
export interface WireEnd extends WireEndSensors {
  /** The consumer (placed entity or item's entity). */
  id: string;
  floorId: string;
  x: number;
  z: number;
}

/**
 * The wire ends of the consumers, one per power sensor (the key), each with its energy sensor. A consumer without one
 * (none linked or found, or set to none) has no wire end: nothing is configured, so nothing shows (#29).
 */
export function wireEnds(hass: HomeAssistant, consumers: readonly Consumer[]): WireEnd[] {
  const ends: WireEnd[] = [];
  for (const c of consumers) {
    const energy = energySensorFor(hass, c.powerEntity, c.energy);
    if (energy) ends.push({ key: c.powerEntity, id: c.id, floorId: c.floorId, x: c.x, z: c.z, energy, power: c.powerEntity });
  }
  return ends;
}

type Row = { start: string | number; change?: number | null };

/**
 * Today's kWh of every wire end, from the recorder's five-minute statistics since midnight: its energy sensor's change.
 * An end without an energy sensor gets none (null when the recorder cannot be asked).
 */
export async function fetchTodayKwh(hass: HomeAssistant, ends: readonly WireEndSensors[], now = new Date()): Promise<Map<string, number> | null> {
  const out = new Map<string, number>();
  const ids = [...new Set(ends.map((e) => e.energy).filter((id): id is string => !!id))];
  if (!ids.length) return out;
  const midnight = new Date(now);
  midnight.setHours(0, 0, 0, 0);
  try {
    const counted = await hass.callWS<Record<string, Row[]>>({
      type: "recorder/statistics_during_period",
      start_time: midnight.toISOString(),
      statistic_ids: ids,
      period: "5minute",
      types: ["change"],
      units: { energy: "kWh" },
    });
    for (const e of ends) {
      if (!e.energy) continue;
      const kwh = counted?.[e.energy]?.reduce((s, r) => s + (r.change ?? 0), 0);
      if (kwh !== undefined) out.set(e.key, kwh);
    }
    return out;
  } catch {
    return null;
  }
}
