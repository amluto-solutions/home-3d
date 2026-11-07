// One-off migration for #203: door and window contact sensors used to be matched with openings automatically
// (by room area and position) whenever an opening had none of its own. That matching is gone; this saves the pairs
// a home showed as explicit links, once, so no home loses a link it relied on.
import { legacyContactPairs, type OpeningEntities } from "./devices.ts";
import type { HomeAssistant } from "./types.ts";
import type { Building } from "./model.ts";

/**
 * Write the automatic contact pairs of a plan into its openings as explicit links, once per plan (the plan is marked
 * with `opening_links_saved`). Only openings without a contact of their own are filled; a contact set by hand, "none"
 * and a window with a handle sensor (which never got a plain contact) stay as they are. Returns how many links were
 * written; 0 and no mark at all when Home Assistant has not told its entities yet (it runs again on the next load).
 * Idempotent: a marked plan is not touched, and a second run on an unmarked one finds nothing left to fill.
 */
export function saveAutomaticOpeningLinks(hass: HomeAssistant, building: Building): number {
  if (building.opening_links_saved) return 0;
  if (!Object.keys(hass.states ?? {}).length) return 0;
  const pairs = legacyContactPairs(hass, building.floors);
  let written = 0;
  for (const floor of building.floors) {
    for (const o of floor.openings) {
      if (o.contact != null) continue;
      if (o.sensor === "handle") continue;
      const id = pairs.get(o.id);
      if (!id) continue;
      o.contact = id;
      written++;
    }
  }
  building.opening_links_saved = true;
  return written;
}

/** The contact and tilt sensors (binary_sensor) linked to doors and windows: the opening shows their state, not a pin (#349). */
export function linkedContactIds(links: Iterable<OpeningEntities>): Set<string> {
  const out = new Set<string>();
  for (const e of links) for (const id of [e.contact, e.contact2, e.tilt, e.tilt2]) if (id?.startsWith("binary_sensor.")) out.add(id);
  return out;
}
