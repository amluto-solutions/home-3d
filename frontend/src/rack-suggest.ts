// Linking rack gear to Home Assistant (#119): which HA device stands behind a piece of gear, and which of its
// entities a slot links: the status entity (what its LED shows) and the useful further values (load, battery,
// temperature …) in a sensible order, capped, never "everything" (a 24-port switch has hundreds). Pure; used by the
// editor's rack sheet. `entityKind` is also the rack card's (#120) catalogue of kinds.

import type { RackSlot } from "./rack.ts";
import type { HomeAssistant } from "./types.ts";

export type RackMetricKind = "status" | "load" | "battery" | "runtime" | "power" | "temperature" | "cpu" | "memory" | "disk" | "throughput" | "uptime" | "update" | "switch" | "button" | "other";

/** The order links are suggested in (and the card's default pick looks at, #120). */
export const RACK_KIND_ORDER: readonly RackMetricKind[] = ["status", "load", "battery", "runtime", "power", "temperature", "cpu", "memory", "disk", "throughput", "uptime", "other", "update", "switch", "button"];

/** Integrations whose devices often sit in a rack: offered first when picking the device behind gear. */
export const RACK_PLATFORMS = new Set(["unifi", "nut", "apcupsd", "systemmonitor", "glances", "synology_dsm", "qnap", "qnap_qsw", "proxmoxve", "esphome", "snmp", "tplink_omada", "netgear", "fritz", "mikrotik", "opnsense", "pfsense", "truenas", "unraid", "unifiprotect", "zha", "upnp", "hassio"]);

/** At most this many further links come from picking a device; the user adds more by hand (rack-links RACK_MAX_LINKS). */
export const SUGGESTED_LINKS = 8;

/** A per-port entity of a switch or PDU ("…_port_3_poe", "…_outlet_12_power"): there are many, so they come last. */
const PER_PORT = /_(port|outlet|lan|eth)_?\d+/;

const kindRank = (k: RackMetricKind): number => RACK_KIND_ORDER.indexOf(k);

/** What kind of value an entity is, from its domain, device class, unit and the words of its id. */
export function entityKind(hass: Pick<HomeAssistant, "states" | "entities">, id: string): RackMetricKind {
  const domain = id.slice(0, id.indexOf("."));
  const st = hass.states[id];
  const cls = String(st?.attributes?.device_class ?? "");
  const unit = String(st?.attributes?.unit_of_measurement ?? "");
  const words = `${id.slice(domain.length + 1)} ${hass.entities?.[id]?.translation_key ?? ""}`.toLowerCase();
  if (domain === "update") return "update";
  if (domain === "button") return "button";
  if (domain === "switch") return "switch";
  if (domain === "device_tracker") return "status";
  if (domain === "binary_sensor") return ["connectivity", "running", "plug", "power", "problem"].includes(cls) || /status|state|online|connected|running/.test(words) ? "status" : "other";
  if (domain !== "sensor") return "other";
  if (/runtime/.test(words) || (cls === "duration" && /battery/.test(words))) return "runtime";
  if (cls === "battery" || (/battery|charge/.test(words) && unit === "%")) return "battery";
  if (cls === "temperature") return "temperature";
  if (cls === "power" || unit === "W" || unit === "kW") return "power";
  if (cls === "data_rate" || /\/s$/.test(unit) || /throughput|bandwidth|download|upload|\b(rx|tx)\b|_(rx|tx)(_|$)|network_(in|out)|packets/.test(words)) return "throughput";
  if (/uptime|last_boot|boot_time/.test(words) || (cls === "timestamp" && /up|boot/.test(words))) return "uptime";
  if (/cpu|processor/.test(words)) return "cpu";
  if (/memory|\bram\b|swap/.test(words)) return "memory";
  if (/disk|volume|storage|drive|pool|\bfs\b|used_space|free_space/.test(words)) return "disk";
  if (/load/.test(words)) return "load";
  if (/status|state/.test(words) || cls === "enum") return "status";
  return "other";
}

/** The HA device an entity belongs to. */
const deviceOf = (hass: Pick<HomeAssistant, "entities">, id: string): string | null => hass.entities?.[id]?.device_id ?? null;

/** A device's entities that Home Assistant has states for (disabled ones have none), in registry order. */
function deviceEntities(hass: Pick<HomeAssistant, "states" | "entities">, device: string): string[] {
  return Object.values(hass.entities ?? {})
    .filter((e) => e.device_id === device && !!hass.states[e.entity_id])
    .map((e) => e.entity_id);
}

/** Ranked by kind, then a device's own values before per-port ones, else registry order. */
function ranked(hass: Pick<HomeAssistant, "states" | "entities">, ids: string[]): string[] {
  const score = (id: string) => kindRank(entityKind(hass, id)) + (PER_PORT.test(id) ? 100 : 0);
  return ids.map((id, i) => ({ id, i, s: score(id) })).sort((a, b) => a.s - b.s || a.i - b.i).map((x) => x.id);
}

/** The entity that says best whether a device is up: a connectivity / running sensor, a status text, a tracker. */
function statusOf(hass: Pick<HomeAssistant, "states" | "entities">, ids: string[]): string | null {
  const pref = (id: string): number => {
    if (entityKind(hass, id) !== "status" || PER_PORT.test(id)) return 99;
    const cls = String(hass.states[id]?.attributes?.device_class ?? "");
    if (id.startsWith("binary_sensor.") && (cls === "connectivity" || cls === "running")) return 0;
    if (id.startsWith("sensor.")) return 1;
    if (id.startsWith("device_tracker.")) return 2;
    return 3;
  };
  const best = ids.map((id) => ({ id, p: pref(id) })).filter((x) => x.p < 99).sort((a, b) => a.p - b.p)[0];
  return best?.id ?? null;
}

const useful = (hass: Pick<HomeAssistant, "states" | "entities">, id: string): boolean => {
  const k = entityKind(hass, id);
  return k !== "button" && k !== "switch" && k !== "update" && !PER_PORT.test(id);
};

/** What a slot links when its gear is said to be this HA device: its status entity, its useful values (capped), its name. */
export function fromDevice(hass: HomeAssistant, device: string): { entity: string | null; links: string[]; name: string | null } {
  const ids = deviceEntities(hass, device);
  const entity = statusOf(hass, ids);
  const links = ranked(hass, ids.filter((id) => id !== entity && useful(hass, id))).slice(0, SUGGESTED_LINKS);
  const d = hass.devices?.[device];
  return { entity, links, name: d?.name_by_user || d?.name || null };
}

/** More entities for a slot, from the HA devices of what it links already, without those it has; useful values first. */
export function suggestRackLinks(hass: Pick<HomeAssistant, "states" | "entities">, slot: Partial<RackSlot>, max = SUGGESTED_LINKS): string[] {
  const have = new Set([slot.entity, ...(slot.links ?? [])].filter((id): id is string => !!id));
  const devices = new Set([...have].map((id) => deviceOf(hass, id)).filter((d): d is string => !!d));
  const ids = [...devices].flatMap((d) => deviceEntities(hass, d)).filter((id) => !have.has(id));
  return ranked(hass, ids).slice(0, max);
}

/** The HA devices a piece of gear can be (only those with entities): rack-ish integrations first, then by name. */
export function rackDeviceOptions(hass: HomeAssistant): { id: string; label: string }[] {
  const platforms = new Map<string, Set<string>>();
  for (const e of Object.values(hass.entities ?? {})) {
    if (!e.device_id || !hass.states[e.entity_id]) continue;
    const set = platforms.get(e.device_id) ?? new Set<string>();
    if (e.platform) set.add(e.platform);
    platforms.set(e.device_id, set);
  }
  return [...platforms]
    .map(([id, set]) => {
      const d = hass.devices?.[id];
      const name = d?.name_by_user || d?.name || id;
      const make = [d?.manufacturer, d?.model].filter(Boolean).join(" ");
      return { id, label: make ? `${name} · ${make}` : name, rack: [...set].some((p) => RACK_PLATFORMS.has(p)) };
    })
    .sort((a, b) => Number(b.rack) - Number(a.rack) || a.label.localeCompare(b.label))
    .map(({ id, label }) => ({ id, label }));
}
