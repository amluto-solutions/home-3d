// What loading the neighbourhood map needs on the page, shared by Settings > Surroundings (#464) and the editor's
// "Start with the map" note (#465): the radius shown first, Home Assistant's location, the text for a failure and the
// plan with the freshly loaded map. Small and free of the map bundle (load-osm.ts), which loads only on a tap.

import type { Building, Surroundings } from "./model.ts";
import type { HomeAssistant } from "./types.ts";

/** The radius shown before a map is loaded (m). */
export const DEFAULT_RADIUS = 150;

/** The plan with freshly loaded map data: the outline choice stays, the hidden-by-hand lists do not (the houses are numbered anew). */
export function loaded(b: Building, res: { surroundings: Surroundings; north: number }): Building {
  const flat = b.settings.surroundings?.flat === true;
  return { ...b, settings: { ...b.settings, north: res.north, surroundings: { ...res.surroundings, ...(flat ? { flat } : {}) } } };
}

/** Why loading failed, as a text key: the map bundle's errors have a `kind` (they are not this bundle's class). */
export function errorKey(e: unknown): string {
  const kind = (e as { kind?: string } | null)?.kind;
  return kind === "busy" || kind === "empty" ? `surround_err_${kind}` : "surround_err_offline";
}

/** The location Home Assistant has set, or null when it has none (0, 0 is the unset default). */
export function homeLocation(hass: HomeAssistant | undefined): { lat: number; lon: number } | null {
  const lat = hass?.config?.latitude;
  const lon = hass?.config?.longitude;
  return typeof lat === "number" && typeof lon === "number" && !(lat === 0 && lon === 0) ? { lat, lon } : null;
}
