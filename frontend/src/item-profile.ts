/**
 * The item panel's kind profiles (#397, option A of the run 9 panel review): which sections and folds an item's panel
 * shows, decided once from its type, so the panel renders the profile instead of testing `isElectric`, `isLamp` and
 * similar predicates in many places.
 *
 * Fixed order: header, Position (always open), the kind's main section, then closed folds (Appearance, Size, and per
 * kind Occupancy sensor / Screen pictures / Energy, then Taps and visibility, More options). View only: no stored plan
 * key depends on it.
 */

import { hasScreen } from "./devices.ts";
import { isCameraItem, isHeaterItem, isSensorItem, isThermostatItem, isVehicleItem } from "./furniture-links.ts";
import { ENERGY_DEVICES, GANG_TYPES, isLamp, TECH_TYPES } from "./model.ts";
import { energyRole, isElectric, packInfo } from "./packs.ts";
import { isPrinter } from "./printer.ts";
import type { HassEntity } from "./types.ts";

/** What an item is, as far as its panel is concerned. */
export type ItemKind =
  | "car"
  | "parking"
  | "lamp"
  | "screen"
  | "appliance"
  | "energy"
  | "camera"
  | "sensor"
  | "heating"
  | "network"
  | "printer"
  | "kitchen"
  | "bed"
  | "seating"
  | "household"
  | "switch"
  | "tech"
  | "stairs"
  | "opening"
  | "furniture";

/** The kind's main section, open under Position (null: none, the folds follow Position). */
export type MainSection = "car" | "parking" | "lamp" | "device" | "household" | "switch" | "tech" | "stairs" | null;

/** A closed fold of the panel. "glow" is the occupancy sensor of a seat or bed, the glow link of other furniture. */
export type PanelFold = "appearance" | "size" | "glow" | "screen" | "energy" | "taps" | "more";

export interface ItemProfile {
  kind: ItemKind;
  main: MainSection;
  /** The folds, top to bottom. */
  folds: PanelFold[];
  /** The fold open the first time an item of this kind is chosen (the sofa opens Appearance). */
  openFirst: PanelFold | null;
  /** Mirror left-right (not lamps, not vehicles). */
  mirror: boolean;
  /** "Glow when this is on" (the state link): in the glow fold, or in More options for devices and cars. */
  glow: boolean;
  /** "Second half" for the other side: beds and sofas only (#414, WORD-4). */
  secondState: boolean;
  /** A consumable or service (filters, rinse aid, a boiler's service): appliances, screens, printers, boilers. */
  consumable: boolean;
  /** "Ask before switching": items that switch something (not cars, sensors, heating controls or floor openings). */
  confirm: boolean;
}

/** Built-in types that link nothing that glows (no state link). */
const NO_GLOW = new Set(["parking", "stairwell", "rug", "grid_point", "waste_bin", "mailbox", "wall_switch", "wall_socket", "wifi_ap", "water_heater"]);
const SEATS = new Set(["sofa", "sofa_l", "sofa_u", "armchair", "stool", "chair", "bench", "corner_bench", "bar_stool", "office_chair"]);
const BEDS = new Set(["bed", "bunk_bed"]);
const STAIRS = new Set(["stairs", "stairs_u"]);
const SOFAS = new Set(["sofa", "sofa_l", "sofa_u"]);
/** Fitted kitchen units: furniture with a socket in them, but no device of their own (#414, WORD-6). */
const KITCHEN_UNITS = new Set(["kitchen", "island"]);

/** The words a pack item is known by: its family and its tags, lower case. */
function packWords(type: string): string[] {
  const info = packInfo(type);
  return info ? [info.family ?? "", ...(info.tags ?? [])].map((t) => t.toLowerCase()).filter(Boolean) : [];
}

/** A bed (built-in, or a pack item tagged "bed" or of a bed family), not a raised garden bed or a pet bed. */
export function isBedItem(type: string): boolean {
  if (BEDS.has(type)) return true;
  const words = packWords(type);
  if (words.some((w) => /raised|garden|flower|cat_|dog_|pet/.test(w))) return false;
  return words.some((w) => w === "bed" || w === "bunk bed" || /(^|_)(bed|bed_frame|daybed|loft_bed|bunk_bed|ottoman_bed)$/.test(w));
}

/** Something to sit on: a sofa, an armchair, a chair, a stool or a bench (not a TV bench or a workbench). */
export function isSeatItem(type: string): boolean {
  if (SEATS.has(type)) return true;
  return packWords(type).some((w) => !/tv_bench|tv bench|workbench/.test(w) && /(sofa|armchair|chair|stool|bench|couch|settee|loveseat|recliner)/.test(w));
}

/** A sofa (built-in, or a pack item of a sofa, couch or settee family or tag): the seat with two halves (#414). */
export function isSofaItem(type: string): boolean {
  if (SOFAS.has(type)) return true;
  return packWords(type).some((w) => /(sofa|couch|settee|loveseat)/.test(w));
}

function kindOf(type: string): ItemKind {
  if (type === "parking") return "parking";
  if (isVehicleItem(type)) return "car";
  if (type === "waste_bin" || type === "mailbox") return "household";
  if (GANG_TYPES.has(type)) return "switch";
  if (TECH_TYPES.has(type)) return "tech";
  if (type === "stairwell") return "opening";
  if (STAIRS.has(type)) return "stairs";
  if (isLamp(type)) return "lamp";
  if ((ENERGY_DEVICES as readonly string[]).includes(type) || energyRole(type) !== null) return "energy";
  // the kinds that are no plain "Device" (#414, WORD-7), before the screen test: a thermostat's display is no TV
  if (isPrinter(type)) return "printer";
  if (isCameraItem(type)) return "camera";
  if (type === "ac_unit" || isThermostatItem(type) || isHeaterItem(type)) return "heating";
  if (isSensorItem(type)) return "sensor";
  if (packInfo(type)?.group === "network") return "network";
  if (KITCHEN_UNITS.has(type)) return "kitchen";
  if (isElectric(type)) return hasScreen(type) ? "screen" : "appliance";
  if (isBedItem(type)) return "bed";
  if (isSeatItem(type)) return "seating";
  return "furniture";
}

const MAIN: Record<ItemKind, MainSection> = {
  car: "car",
  parking: "parking",
  lamp: "lamp",
  screen: "device",
  appliance: "device",
  energy: "device",
  camera: "device",
  sensor: "device",
  heating: "device",
  network: "device",
  printer: "device",
  // a kitchen unit links nothing of its own (#414, WORD-6); one linked already keeps its link (item-folds.ts)
  kitchen: null,
  bed: null,
  seating: null,
  household: "household",
  switch: "switch",
  tech: "tech",
  stairs: "stairs",
  // a floor opening's main section is the hole's help (the stairwell note)
  opening: "stairs",
  furniture: null,
};

const FOLDS: Record<ItemKind, PanelFold[]> = {
  car: ["appearance", "size", "energy", "taps", "more"],
  parking: ["appearance", "size", "taps", "more"],
  lamp: ["appearance", "size", "taps", "more"],
  screen: ["appearance", "size", "screen", "energy", "taps", "more"],
  appliance: ["appearance", "size", "energy", "taps", "more"],
  // an energy device's power sensor is its main link: it stands in the main section
  energy: ["appearance", "size", "taps", "more"],
  camera: ["appearance", "size", "energy", "taps", "more"],
  // a smoke alarm, a motion sensor: nothing to power-meter (#414, MANY-8)
  sensor: ["appearance", "size", "taps", "more"],
  // a boiler or a heat pump has its power fold; a TRV radiator or a thermostat none (itemProfile drops it)
  heating: ["appearance", "size", "energy", "taps", "more"],
  network: ["appearance", "size", "energy", "taps", "more"],
  printer: ["appearance", "size", "energy", "taps", "more"],
  kitchen: ["appearance", "size", "taps", "more"],
  bed: ["appearance", "size", "glow", "taps", "more"],
  seating: ["appearance", "size", "glow", "taps", "more"],
  household: ["appearance", "size", "taps", "more"],
  switch: ["appearance", "size", "taps", "more"],
  tech: ["appearance", "size", "taps", "more"],
  stairs: ["appearance", "size", "taps", "more"],
  // a hole in the floor: Position, Size and the hole's help only (#414, MANY-8)
  opening: ["size"],
  furniture: ["appearance", "size", "glow", "taps", "more"],
};

const profiles = new Map<string, ItemProfile>();

/** The panel profile of an item type (kept per type; pack items are looked up once their pack is there). */
export function itemProfile(type: string): ItemProfile {
  const had = profiles.get(type);
  if (had && (had.kind !== "furniture" || !type.startsWith("pack:") || packInfo(type))) return had;
  const kind = kindOf(type);
  const furnitureLike = kind === "bed" || kind === "seating" || kind === "furniture";
  // a radiator with a TRV, a smart valve or a wall thermostat: no power sensor, nothing to switch (#414, MANY-8)
  const controlOnly = kind === "heating" && isThermostatItem(type);
  const folds = FOLDS[kind].filter((f) => !(f === "glow" && kind === "furniture" && NO_GLOW.has(type)) && !(f === "energy" && controlOnly));
  const profile: ItemProfile = {
    kind,
    main: MAIN[kind],
    folds,
    openFirst: furnitureLike ? "appearance" : null,
    mirror: kind !== "lamp" && kind !== "car" && kind !== "opening",
    glow: !NO_GLOW.has(type) && (furnitureLike || kind === "appliance" || kind === "car" || kind === "printer" || kind === "network"),
    secondState: kind === "bed" || (kind === "seating" && isSofaItem(type)),
    // a boiler's yearly service and an air conditioner's filter stay; a radiator valve has none
    consumable: kind === "appliance" || kind === "screen" || kind === "printer" || (kind === "heating" && !controlOnly),
    confirm: kind === "heating" ? !controlOnly : !NO_CONFIRM.has(kind),
  };
  profiles.set(type, profile);
  return profile;
}

/** Kinds with nothing to ask about before switching (#414, MANY-8). */
const NO_CONFIRM = new Set<ItemKind>(["car", "parking", "household", "stairs", "opening", "sensor", "kitchen"]);

/**
 * Whether an entity reports on and off (#414, WORD-4): a switch, a light, a binary sensor, a person, a tracker, a
 * sensor with a text state. A temperature or another measuring sensor is never "on", so "Glows when on" warns.
 */
export function hasOnOffState(st: HassEntity | undefined): boolean {
  if (!st) return true;
  const domain = st.entity_id.slice(0, st.entity_id.indexOf("."));
  if (domain === "number" || domain === "input_number" || domain === "counter") return false;
  if (domain !== "sensor") return true;
  if (st.attributes.unit_of_measurement || st.attributes.state_class) return false;
  const v = String(st.state).trim();
  return v === "" || !Number.isFinite(Number(v));
}
