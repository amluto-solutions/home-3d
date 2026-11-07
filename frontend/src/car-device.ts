/**
 * The car's Home Assistant device (#415, WORD-3): the car section links one device, not "any entity of the car".
 * The plan keeps what it stored before: a vehicle item's `entity` (or a parking spot's `car.device`) holds one entity
 * of the device, and the car's readings are found beside it (devices.ts carEntities).
 */
import type { HomeAssistant } from "./types.ts";

/** A car-like device: it has a tracker, a lock, a climate entity or a battery sensor. */
const CARRISH = (hass: HomeAssistant, id: string): boolean =>
  id.startsWith("device_tracker.") || id.startsWith("lock.") || id.startsWith("climate.") || (id.startsWith("sensor.") && hass.states[id]?.attributes.device_class === "battery");

/** The device an entity belongs to (null: none, or no registry). */
export function deviceOf(hass: HomeAssistant, id: string | null | undefined): string | null {
  if (!id || id === "none") return null;
  return hass.entities?.[id]?.device_id ?? null;
}

/** A device's entities, in the registry's order. */
function entitiesOf(hass: HomeAssistant, device: string): string[] {
  return Object.values(hass.entities ?? {})
    .filter((e) => e.device_id === device)
    .map((e) => e.entity_id);
}

/** A device's name: the user's, the integration's, else its first entity's friendly name. */
export function deviceName(hass: HomeAssistant, device: string): string {
  const d = hass.devices?.[device];
  const name = d?.name_by_user || d?.name;
  if (name) return name;
  const first = entitiesOf(hass, device)[0];
  return (first && (hass.states[first]?.attributes.friendly_name as string | undefined)) || device;
}

let memo: { entities: unknown; devices: unknown; count: number; options: { id: string; label: string }[] } | null = null;

/** The devices a car can be: the car-like ones, by name (kept while the registry stays). */
export function carDeviceOptions(hass: HomeAssistant): { id: string; label: string }[] {
  const count = Object.keys(hass.states).length;
  if (memo && memo.entities === hass.entities && memo.devices === hass.devices && memo.count === count) return memo.options;
  const devices = new Set<string>();
  for (const e of Object.values(hass.entities ?? {})) if (e.device_id && CARRISH(hass, e.entity_id)) devices.add(e.device_id);
  const options = [...devices].map((id) => ({ id, label: deviceName(hass, id) })).sort((a, b) => a.label.localeCompare(b.label));
  memo = { entities: hass.entities, devices: hass.devices, count, options };
  return options;
}

/**
 * The entity that stands for a device in the plan: the one stored now when it is on that device, else the device's
 * battery sensor, its tracker, its first sensor, its first entity.
 */
export function deviceSeed(hass: HomeAssistant, device: string, keep?: string | null): string | null {
  if (keep && deviceOf(hass, keep) === device) return keep;
  const ids = entitiesOf(hass, device);
  return (
    ids.find((id) => id.startsWith("sensor.") && hass.states[id]?.attributes.device_class === "battery") ??
    ids.find((id) => id.startsWith("device_tracker.")) ??
    ids.find((id) => id.startsWith("sensor.")) ??
    ids[0] ??
    null
  );
}
