// What the 3D view shows by kind of object (#268, #269): the View panel's "Display what" list and its Furniture switch.
// Hiding is a flag, never a rebuild: the viewer collapses the hidden items' triangles in place (viewer3d.ts
// setHiddenItems) and the device pins of a hidden kind are left out of the markers. A kind is hidden, not shown,
// so a kind added later shows at once. Pure functions, no Lit.

import { ENERGY_DEVICES, isLamp, type Building, type Furniture } from "./model.ts";
import { isCameraItem, isThermostatItem } from "./packs.ts";

export { OBJECT_TYPES, DISPLAY_HIDDEN_KEY, SHOW_FURNITURE_KEY, parseHidden, hiddenText, type ObjectType } from "./display-pref.ts";
import type { ObjectType } from "./display-pref.ts";

const DOMAIN_TYPE: Record<string, ObjectType> = {
  light: "lights",
  media_player: "media",
  remote: "media",
  camera: "cameras",
  sensor: "sensors",
  binary_sensor: "sensors",
  climate: "climate",
  water_heater: "climate",
  cover: "covers",
  switch: "plugs",
  input_boolean: "plugs",
  fan: "plugs",
  lock: "plugs",
  vacuum: "plugs",
};

/** The kind of a device by its entity id (null: no kind of its own, never hidden). */
export function typeOfEntity(entityId: string | null | undefined): ObjectType | null {
  if (!entityId) return null;
  return DOMAIN_TYPE[entityId.slice(0, entityId.indexOf("."))] ?? null;
}

const DECOR = new Set(["plant", "rug", "shelf", "coat_rack"]);
const OUTDOOR = new Set(["awning", "waste_bin", "mailbox", "parking", "pool_pump", "pool_filter", "pool_heat_pump", "pool_dosing", "pool_valve"]);
const PLUGS = new Set(["wall_switch", "wall_socket", "wifi_ap", "water_heater", "robot_vacuum", "fridge_smart", "washer", "dryer", "dishwasher"]);
/** The building's own parts: never hidden here. */
const STRUCTURE = new Set(["stairs", "stairs_u", "stairwell", "loft_ladder"]);
const KNOWN = new Set<string>([
  "radiator", "ac_unit", "sofa", "sofa_l", "sofa_u", "armchair", "stool", "coffee_table", "tv_board", "tv_wall", "sideboard", "table", "table_round", "chair", "bench", "corner_bench", "bar_stool",
  "kitchen", "kitchen_wall", "kitchen_tall", "island", "worktop", "sink", "stove", "fridge", "bed", "bunk_bed", "nightstand", "wardrobe", "dresser", "bathtub", "shower", "wc", "washbasin", "desk", "office_chair", "tall_cabinet",
]);

/** The kind of an item; null for the building's own parts (stairs …), which are never hidden. `entity` is what the item is linked to. */
export function typeOfItem(f: Furniture, entity: string | null = f.entity ?? null): ObjectType | null {
  const t = f.type;
  if ((ENERGY_DEVICES as readonly string[]).includes(t)) return "energy";
  if (STRUCTURE.has(t)) return null;
  if (isLamp(t)) return "lights";
  if (OUTDOOR.has(t)) return t === "awning" && entity?.startsWith("cover.") ? "covers" : "outdoor";
  if (DECOR.has(t)) return "decor";
  if (PLUGS.has(t)) return "plugs";
  if (t === "tv_wall") return "media";
  if (t === "radiator" || t === "ac_unit" || isThermostatItem(t)) return "climate";
  if (isCameraItem(t)) return "cameras";
  // furniture of the library stays furniture whatever it is linked to (a sofa with an occupancy sensor); a pack item
  // takes the kind of its device
  if (KNOWN.has(t)) return "furniture";
  return typeOfEntity(entity) ?? "furniture";
}

/** An item you can use: it is linked to a device. */
export function interactive(f: Furniture, entity: string | null = f.entity ?? null): boolean {
  return !!entity && entity !== "none" ? true : !!f.state_entity && f.state_entity !== "none";
}

/** Whether the View hides the item: its kind is unticked, or the Furniture switch is off and it is plain furniture or decor (#269). */
export function itemHidden(f: Furniture, hidden: ReadonlySet<ObjectType>, furnitureOn: boolean, entity: string | null = f.entity ?? null): boolean {
  const kind = typeOfItem(f, entity);
  if (kind === null) return false;
  if (hidden.has(kind)) return true;
  return !furnitureOn && (kind === "furniture" || kind === "decor") && !interactive(f, entity);
}

/** The ids of the items the View hides. `entityOf` is the device an item is linked to (registry links included). */
export function hiddenItemIds(b: Building, hidden: ReadonlySet<ObjectType>, furnitureOn: boolean, entityOf?: (f: Furniture) => string | null): Set<string> {
  const out = new Set<string>();
  if (!hidden.size && furnitureOn) return out;
  for (const fl of b.floors) for (const f of fl.furniture) if (itemHidden(f, hidden, furnitureOn, entityOf ? entityOf(f) : (f.entity ?? null))) out.add(f.id);
  return out;
}
