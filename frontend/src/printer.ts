// A 3D printer from a pack (#11). Its item is linked to one entity of the printer's Home Assistant device (its status
// sensor, usually); the progress, the chamber light and the camera are found on that same device, whatever
// integration made it (Bambu Lab, PrusaLink, OctoPrint, Moonraker …).

import { isStatusSensor, isUnavailable, isWorkingState, lightGlow } from "./devices.ts";
import { isPackType } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";
import type { ScreenState } from "./viewer/viewer3d.ts";

/** A pack item whose id names a 3D printer ("3d_printer", "3d_printer_enclosed", "resin_3d_printer"). */
export function isPrinter(type: string): boolean {
  return isPackType(type) && /:(?:[a-z0-9_.-]*_)?3d_printer(?:_[a-z0-9_.-]*)?$/.test(type);
}

/** The printer's entities: the linked one's siblings on its Home Assistant device. */
export interface PrinterEntities {
  status: string | null;
  progress: string | null;
  light: string | null;
  camera: string | null;
}

const PROGRESS = /(progress|percent|completion|fortschritt)/;
const STATUS = /(status|state|printing)/;
const LIGHT = /(chamber|light|lamp|led)/;

/** The printer's entities, found on the device of the linked entity (none without one). */
export function printerEntities(hass: HomeAssistant, linked: string | null): PrinterEntities {
  const none: PrinterEntities = { status: null, progress: null, light: null, camera: null };
  if (!linked || linked === "none") return none;
  const device = hass.entities?.[linked]?.device_id;
  const siblings = device && hass.entities ? Object.values(hass.entities).filter((e) => e.device_id === device).map((e) => e.entity_id) : [linked];
  const key = (id: string) => `${id} ${String(hass.states[id]?.attributes.friendly_name ?? "")} ${hass.entities?.[id]?.translation_key ?? ""}`.toLowerCase().replace(/[\s-]+/g, "_");
  const percent = (id: string) => id.startsWith("sensor.") && hass.states[id]?.attributes.unit_of_measurement === "%";
  const progress = siblings.find((id) => percent(id) && PROGRESS.test(key(id))) ?? null;
  // the linked entity is the status, unless it is the progress itself or a light or camera
  const own = /^(sensor|binary_sensor)\./.test(linked) && linked !== progress ? linked : null;
  const status = own ?? siblings.find((id) => (isStatusSensor(hass.states[id]) || id.startsWith("binary_sensor.")) && STATUS.test(key(id))) ?? null;
  const lights = siblings.filter((id) => id.startsWith("light."));
  return {
    status,
    progress,
    light: lights.find((id) => /chamber/.test(key(id))) ?? lights[0] ?? siblings.find((id) => id.startsWith("switch.") && LIGHT.test(key(id))) ?? null,
    camera: siblings.find((id) => id.startsWith("camera.")) ?? null,
  };
}

/** What the printer shows: a ring filled to `progress` (0 … 1) while it prints, its chamber light, its camera. */
export interface PrinterState {
  printing: boolean;
  /** 0 … 1 while printing; null when it does not print or says nothing. */
  progress: number | null;
  /** The chamber light's colour and level while it is on. */
  light: { color: [number, number, number]; level: number } | null;
  camera: string | null;
}

/** The printer's state now, from the entities of the linked entity's device. */
export function printerState(hass: HomeAssistant, linked: string | null): PrinterState {
  const e = printerEntities(hass, linked);
  const st = (id: string | null) => (id ? hass.states[id] : undefined);
  const status = st(e.status);
  const printing = !!status && (status.entity_id.startsWith("binary_sensor.") ? status.state === "on" : isWorkingState(status.state) || /^paused?$/i.test(status.state));
  const value = Number(st(e.progress)?.state);
  const progress = printing && e.progress && Number.isFinite(value) ? Math.min(1, Math.max(0, value / 100)) : null;
  return { printing, progress, light: lightGlow(st(e.light)), camera: e.camera && !isUnavailable(st(e.camera)) ? e.camera : null };
}

/** The ring's colour: neon green, like a machine that runs. */
const RING: [number, number, number] = [0.35, 1, 0.55];

/** What lights up on the printer in 3D: its progress ring while it prints, its chamber while the light is on. */
export function printerFaces(s: PrinterState): NonNullable<ScreenState["faces"]> {
  const faces: NonNullable<ScreenState["faces"]> = [];
  // whole per cents: the ring is drawn anew only when it grows visibly
  if (s.printing) faces.push({ part: "progress", color: RING, level: 1, fill: Math.round((s.progress ?? 0) * 100) / 100 });
  if (s.light) faces.push({ part: "chamber", color: s.light.color, level: s.light.level });
  return faces;
}
