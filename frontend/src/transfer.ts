// Export and import of the building as a JSON file. Without entities, a plan can be shared with others:
// areas, lights, sensors and every other link to this Home Assistant are removed.

import { knownPlanVersion, normalizeBuilding, PLAN_VERSION, type Building } from "./model.ts";

export const EXPORT_FORMAT = "home3d";

export interface ExportFile {
  format: typeof EXPORT_FORMAT;
  version: 1;
  exported_at: string;
  building: Building;
}

/** Home Assistant entity domains: a string "<domain>.<object_id>" with one of these is a link to an entity. */
const ENTITY_DOMAINS = [
  "ai_task", "alarm_control_panel", "assist_satellite", "automation", "binary_sensor", "button", "calendar", "camera", "climate", "conversation", "counter", "cover",
  "date", "datetime", "device_tracker", "event", "fan", "group", "humidifier", "image", "input_boolean", "input_button", "input_datetime", "input_number",
  "input_select", "input_text", "lawn_mower", "light", "lock", "media_player", "notify", "number", "person", "plant", "remote", "scene", "schedule", "script",
  "select", "sensor", "siren", "stt", "sun", "switch", "text", "time", "timer", "todo", "tts", "update", "vacuum", "valve", "water_heater", "weather", "zone",
];
const ENTITY_ID = new RegExp(`^(?:${ENTITY_DOMAINS.join("|")})\\.[a-z0-9_]+$`);

/** Whether a value is an entity id of this Home Assistant. */
export function isEntityLink(v: unknown): boolean {
  return typeof v === "string" && ENTITY_ID.test(v);
}

/** Fields that hold an area or floor of this Home Assistant (plain ids, so no pattern finds them). */
const AREA_KEYS = new Set(["area_id", "ha_floor"]);
/** Whole blocks that only hold links to this Home Assistant: its entity sets, module data and menu buttons. */
const LINK_BLOCKS = new Set(["mods", "car", "buttons"]);
/** Lists of rules that are nothing without their entity: an element that names one goes. */
const RULE_LISTS = new Set(["triggers", "alert_snoozed", "alert_ignored", "pictures"]);

function stripLinks(node: unknown, key = ""): void {
  if (Array.isArray(node)) {
    for (let i = node.length - 1; i >= 0; i--) {
      const el = node[i];
      if (isEntityLink(el)) node.splice(i, 1);
      else if (RULE_LISTS.has(key) && el && typeof el === "object" && Object.values(el).some(isEntityLink)) node.splice(i, 1);
      else stripLinks(el, key);
    }
    return;
  }
  if (!node || typeof node !== "object") return;
  const o = node as Record<string, unknown>;
  for (const [k, v] of Object.entries(o)) {
    if (LINK_BLOCKS.has(k)) delete o[k];
    else if (AREA_KEYS.has(k) || isEntityLink(v)) o[k] = null;
    else stripLinks(v, k);
  }
}

/**
 * A copy of the building without any link to this Home Assistant: entities, areas and floors, the menu buttons, module
 * data and every picture (background images stay out anyway). Besides the fields known to hold a link, every value
 * that is an entity id goes (#155), so a field added later is covered without a change here.
 */
export function withoutEntities(b: Building): Building {
  const out = structuredClone(b);
  out.energy = { ...out.energy, grid: null, solar: null, battery: null, battery_soc: null, tariff: null, ...(out.energy.cost_sensors ? { cost_sensors: [] } : {}), ...(out.energy.earning_sensors ? { earning_sensors: [] } : {}), ...(out.energy.systems ? { systems: out.energy.systems.map((x) => ({ ...x, grid: null, solar: null, battery: null, battery_soc: null, inverter: null })) } : {}) };
  out.presence = [];
  for (const f of out.floors) {
    f.placements = [];
    f.background = null;
    f.rooms = f.rooms.map((r) => ({ ...r, area_id: null }));
    f.furniture = f.furniture.map((m) => ({ ...m, entity: null, power: null }));
    f.openings = f.openings.map((o) => ({ ...o, cover: null, contact: null, tilt: null }));
  }
  stripLinks(out);
  return out;
}

export function exportFile(b: Building, shareable: boolean): ExportFile {
  return { format: EXPORT_FORMAT, version: 1, exported_at: new Date().toISOString(), building: shareable ? withoutEntities(b) : structuredClone(b) };
}

/** Reads an export file; throws "not_json" or "not_plan" when it is none, "plan_too_new" for a plan of a newer Home 3D
 * (#165). */
export function parseExport(text: string): Building {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("not_json");
  }
  const file = data as Partial<ExportFile>;
  const b = (file?.format === EXPORT_FORMAT ? file.building : data) as Building | undefined;
  if (!b || !Array.isArray(b.floors) || !b.settings) throw new Error("not_plan");
  if (Number.isInteger(b.version) && b.version > PLAN_VERSION) throw new Error("plan_too_new");
  if (!knownPlanVersion(b.version)) throw new Error("not_plan");
  // background images are not part of an export
  for (const f of b.floors) f.background = null;
  return normalizeBuilding(b);
}

/** Ids of the stored pictures a plan uses: floor backgrounds and screen pictures (not URLs or cameras). */
export function storedImageIds(b: Building): string[] {
  const ids = new Set<string>();
  for (const f of b.floors) {
    if (f.background?.image_id) ids.add(f.background.image_id);
    for (const m of f.furniture) for (const r of m.pictures ?? []) if (r.image && !/^https?:\/\//.test(r.image) && !r.image.startsWith("camera:")) ids.add(r.image);
  }
  return [...ids];
}

/** Starts a download of a text file in the browser. */
export function download(name: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
