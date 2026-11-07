/**
 * Which entities an item's main link ("Device") offers: a lamp its light, a TV its media player, a radiator its
 * thermostat, a camera its camera … (the editor's Device dropdown, #81).
 */
import { isStatusSensor } from "./devices.ts";
import { isLamp } from "./model.ts";
import { isCameraItem, isEntityMarker, isPackHeater, isPackSensor, isPackType, isRobotVacuum, isThermostatItem, packDisplay, packInfo, packMotion } from "./packs.ts";
import { isPrinter } from "./printer.ts";
import { isMediaFurniture } from "./devices.ts";
import type { HomeAssistant } from "./types.ts";

export { isCameraItem, isThermostatItem };

const ALARM_CLASSES = new Set(["smoke", "gas", "carbon_monoxide", "heat", "moisture", "safety", "sound", "problem"]);

/** Tags (any case) of a pack item, its family among them. */
function tagsOf(type: string): string[] {
  const info = packInfo(type);
  return info ? [...(info.tags ?? []), info.family ?? ""].map((t) => t.toLowerCase()) : [];
}

const HEATER_TAGS = /^(boiler|gas boiler|oil boiler|combi|combi boiler|system boiler|water heater|hot water cylinder|heat pump)$/;
const SENSOR_TAGS = /^(smoke alarm|smoke detector|co alarm|co detector|carbon monoxide|heat alarm|water meter|gas meter|leak sensor|leak detector|water leak sensor|motion sensor|door sensor|contact sensor|sensor)$/;

/**
 * A heater with hot water (#645), also one made in the item editor and tagged "boiler", "heat pump" … (#132): it
 * links its thermostat or its water_heater entity.
 */
export function isHeaterItem(type: string): boolean {
  return isPackHeater(type) || tagsOf(type).some((t) => HEATER_TAGS.test(t));
}

/** A sensor model (#810), or an own item tagged as a smoke alarm, a water meter, a leak sensor … (#132). */
export function isSensorItem(type: string): boolean {
  return isPackSensor(type) || tagsOf(type).some((t) => SENSOR_TAGS.test(t));
}

/** A vehicle placed as an item (a pack's car, an own item marked as a vehicle) (#132). */
export function isVehicleItem(type: string): boolean {
  return !!packInfo(type)?.vehicle;
}

/** Kinds whose own field wins over a screen part: a thermostat's or a boiler's display does not make it a TV (#132). */
function ownsItsLink(type: string): boolean {
  return type === "ac_unit" || isThermostatItem(type) || isHeaterItem(type) || isCameraItem(type) || isSensorItem(type) || isVehicleItem(type);
}

/** A TV-like item: a media item with a real screen (a pack item with only a status light links like any device). */
export function isTvLike(type: string): boolean {
  return isMediaFurniture(type) && (!isPackType(type) || packDisplay(type)) && !ownsItsLink(type);
}

/** The main link field of an item (#132): its label (an i18n key) and the entity domains that fit it best, best first. */
export interface LinkField {
  label:
    | "furn_entity"
    | "furn_entity_light"
    | "motor_cover"
    | "furn_entity_tv"
    | "awning_cover"
    | "furn_entity_climate"
    | "furn_entity_heater"
    | "furn_entity_vacuum"
    | "furn_entity_camera"
    | "furn_entity_sensor"
    | "furn_entity_car"
    | "furn_entity_printer"
    | "furn_entity_rack"
    | "furn_entity_battery";
  domains: string[];
}

/** Which main link field an item shows: from its type, else its pack family and tags (#132). */
export function linkField(type: string): LinkField {
  if (isLamp(type)) return { label: "furn_entity_light", domains: ["light", "switch", "input_boolean"] };
  if (packMotion(type)) return { label: "motor_cover", domains: ["cover", "switch"] };
  if (type === "ac_unit" || isThermostatItem(type)) return { label: "furn_entity_climate", domains: ["climate"] };
  if (isHeaterItem(type)) return { label: "furn_entity_heater", domains: ["climate", "water_heater", "switch"] };
  if (isRobotVacuum(type)) return { label: "furn_entity_vacuum", domains: ["vacuum"] };
  if (isCameraItem(type)) return { label: "furn_entity_camera", domains: ["camera"] };
  if (isSensorItem(type)) return { label: "furn_entity_sensor", domains: ["sensor", "binary_sensor"] };
  if (isVehicleItem(type)) return { label: "furn_entity_car", domains: ["device_tracker", "binary_sensor", "sensor"] };
  // the kind's own link names (#414, WORD-6): a printer, a rack's gear, a home battery
  if (isPrinter(type)) return { label: "furn_entity_printer", domains: ["sensor", "binary_sensor"] };
  if (packInfo(type)?.rack_frame || packInfo(type)?.family === "network_rack") return { label: "furn_entity_rack", domains: ["switch", "sensor", "binary_sensor"] };
  if (type === "home_battery" || packInfo(type)?.family === "home_battery") return { label: "furn_entity_battery", domains: ["sensor"] };
  if (isTvLike(type)) return { label: "furn_entity_tv", domains: ["media_player", "switch"] };
  if (type === "awning") return { label: "awning_cover", domains: ["cover"] };
  return { label: "furn_entity", domains: ["switch"] };
}

/** Whether the item's main link may be this entity. */
export function mainLinkAccepts(hass: HomeAssistant, type: string, id: string): boolean {
  // a generic sensor or switch marker stands for any device: any entity (#79)
  if (isEntityMarker(type)) return true;
  // a lamp can follow a light or a plain switch (e.g. a relay that switches the ceiling light)
  if (isLamp(type)) return /^(light|switch|input_boolean)\./.test(id);
  // a radiator (built-in, a pack's radiator with a TRV, a smart valve, a wall thermostat) and an air conditioner: their
  // thermostat (#81); before the TV test, so a thermostat's display does not make it a TV (#132)
  if (type === "ac_unit" || isThermostatItem(type)) return id.startsWith("climate.");
  // a media player, or the smart plug an older TV is switched with; a roll-down screen also its motor's cover (#511)
  if (isTvLike(type)) return /^(media_player|switch|input_boolean|light)\./.test(id) || (packMotion(type) === "screen" && id.startsWith("cover."));
  if (type === "awning") return id.startsWith("cover.");
  // a motorised curtain or a roof window's blind: its motor's cover (or a switch that drives it, #511, #24)
  const motion = packMotion(type);
  if (motion === "curtain" || motion === "blind") return /^(cover|switch|input_boolean)\./.test(id);
  if (isRobotVacuum(type)) return id.startsWith("vacuum.");
  return (
    // a camera (a doorbell camera too): its camera entity, besides the switches and sensors of its device (#81)
    (isCameraItem(type) && id.startsWith("camera.")) ||
    // or a status sensor (a 3D printer's print status: running, idle, finish …)
    /^(switch|media_player|fan|input_boolean|climate|vacuum|cover)\./.test(id) ||
    // a pack's heat pump indoor unit, boiler or buffer tank: its water_heater entity (#645); an own boiler too (#132)
    (isHeaterItem(type) && id.startsWith("water_heater.")) ||
    // a pack's sensor model (motion, presence, contact, leak …): any sensor, with or without a class (#810), an own
    // smoke alarm or water meter too (#132); a 3D printer (#11): any of its sensors (OctoPrint reports printing as a
    // binary sensor); a car (#132): its charging and battery sensors
    ((isSensorItem(type) || isPrinter(type) || isVehicleItem(type)) && /^(binary_sensor|sensor)\./.test(id)) ||
    // a car: where it is (its own integration's tracker)
    (isVehicleItem(type) && id.startsWith("device_tracker.")) ||
    isStatusSensor(hass.states[id]) ||
    // alarms that report as binary sensors (binary_sensor.…_smoke, #490); a smoke detector takes any
    (id.startsWith("binary_sensor.") && (type.endsWith("smoke_detector") || ALARM_CLASSES.has(String(hass.states[id]?.attributes.device_class ?? ""))))
  );
}

/** The main link's filter for an entity dropdown. */
export function linkFilter(hass: HomeAssistant, type: string): (id: string) => boolean {
  return (id) => mainLinkAccepts(hass, type, id);
}
