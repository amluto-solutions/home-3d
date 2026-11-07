// The entity lists of the editor's link pickers (#130). Made from every state in Home Assistant (thousands), so they
// are kept per list until an entity comes or goes, or the entity, device or area registry changes: a state change
// alone (several a second) reuses them. A list is found by a key naming it (a filter closure is new on every render).

import { entityName } from "./devices.ts";
import type { HomeAssistant } from "./types.ts";
import { stateCount } from "./hass-watch.ts";

export interface EntityOption {
  id: string;
  label: string;
  /** The entity's area (its own, else its device's): lets a picker put the open room's entities first (#132). */
  area?: string;
}

/** What makes an entity a likely pick (#132): the area of the room being edited, the link's domains, best first. */
export interface OptionPreference {
  area?: string | null;
  domains?: readonly string[];
}

/**
 * The options with the likely ones first (#132): an entity in the room's area scores 2, one of the link's first
 * domain 1 (a later listed domain less), so "climate in this room" leads, then the room's other entities, then the
 * domain elsewhere; the rest keeps its order (by name). Returns a new list (never sorts a cached one in place), or
 * the same list when there is nothing to go by.
 */
export function rankOptions<T extends EntityOption>(options: readonly T[], prefer: OptionPreference): readonly T[] {
  const domains = prefer.domains ?? [];
  if (!prefer.area && !domains.length) return options;
  const score = (o: T): number => {
    const i = domains.indexOf(o.id.slice(0, o.id.indexOf(".")));
    return (prefer.area && o.area === prefer.area ? 2 : 0) + (i < 0 ? 0 : 1 / (i + 1));
  };
  return options
    .map((o, i) => ({ o, i, s: score(o) }))
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .map((x) => x.o);
}

type Filter = (id: string) => boolean;

/** Every entity the filter accepts, labelled "name · area" and sorted by that label. */
export function entityOptionList(hass: HomeAssistant | undefined, filter: Filter): EntityOption[] {
  if (!hass) return [];
  const areaOf = (id: string): string | null => {
    const entry = hass.entities?.[id];
    return entry?.area_id ?? (entry?.device_id ? hass.devices?.[entry.device_id]?.area_id : null) ?? null;
  };
  return Object.keys(hass.states ?? {})
    .filter(filter)
    .map((id) => {
      const area = areaOf(id);
      const name = area ? hass.areas?.[area]?.name : undefined;
      // the device name once (#172): "Lounge Lamp" in the Lounge reads "Lamp · Lounge", not "Lounge Lamp · Lounge"
      return { id, label: `${entityName(hass, id, name)}${name ? ` · ${name}` : ""}`, ...(area ? { area } : {}) };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export class EntityOptionCache {
  private byKey = new Map<string, EntityOption[]>();
  private byFilter = new WeakMap<Filter, EntityOption[]>();
  private snapshot: { entities: unknown; devices: unknown; areas: unknown; count: number } | null = null;

  /** The list under `key` (a name, or a filter function that stays the same), made with `filter` when not kept. */
  get(hass: HomeAssistant | undefined, key: string | Filter, filter: Filter): EntityOption[] {
    this.check(hass);
    const kept = typeof key === "string" ? this.byKey.get(key) : this.byFilter.get(key);
    if (kept) return kept;
    const list = entityOptionList(hass, filter);
    if (typeof key === "string") this.byKey.set(key, list);
    else this.byFilter.set(key, list);
    return list;
  }

  /** Forget every list when an entity came or went or a registry changed. */
  private check(hass: HomeAssistant | undefined): void {
    const s = this.snapshot;
    // counted once per states object (#392): about 6 lists a render asked for all ~5,000 states each time
    const count = stateCount(hass?.states);
    if (s && s.entities === hass?.entities && s.devices === hass?.devices && s.areas === hass?.areas && s.count === count) return;
    this.snapshot = { entities: hass?.entities, devices: hass?.devices, areas: hass?.areas, count };
    this.byKey.clear();
    this.byFilter = new WeakMap();
  }
}
