// What the small device popup (components/device-popup.ts, #272 #271 #284) decides, as pure functions: which kind of card
// an entity gets, what a light or a vacuum can do (only what works is shown), and where the popup stands. Kept apart from
// the element so it is tested without a browser.

import { lightAbilities } from "./light-abilities.ts";
import type { HassEntity, HomeAssistant } from "./types.ts";

export type PopupKind = "light" | "vacuum" | "camera";

/** Which popup an entity opens, null for devices that keep their quick menu or details. */
export function popupKind(entityId: string): PopupKind | null {
  const domain = entityId.slice(0, entityId.indexOf("."));
  return domain === "light" ? "light" : domain === "vacuum" ? "vacuum" : domain === "camera" ? "camera" : null;
}

/** What a light offers: brightness, colour temperature (with its range in kelvin) and colour, by its colour modes. */
export interface LightControls {
  dim: boolean;
  temp: { min: number; max: number } | null;
  color: boolean;
  /** Brightness in percent (0 when off). */
  pct: number;
  on: boolean;
  /** The current colour temperature, kelvin, else null. */
  kelvin: number | null;
  /** The current hue (0-360), else null. */
  hue: number | null;
}

export function lightControls(st: HassEntity): LightControls {
  const can = lightAbilities(st);
  const a = st.attributes;
  const on = st.state === "on";
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const min = num(a.min_color_temp_kelvin) ?? 2000;
  const max = num(a.max_color_temp_kelvin) ?? 6500;
  const hs = Array.isArray(a.hs_color) ? num(a.hs_color[0]) : null;
  const bri = num(a.brightness);
  return {
    dim: can.dim,
    temp: can.temp ? { min: Math.min(min, max), max: Math.max(min, max) } : null,
    color: can.color,
    pct: on ? (bri !== null ? Math.max(1, Math.round(bri / 2.55)) : 100) : 0,
    on,
    kelvin: num(a.color_temp_kelvin),
    hue: hs,
  };
}

// Home Assistant's VacuumEntityFeature bits.
const VAC_TURN_ON = 1;
const VAC_PAUSE = 4;
const VAC_STOP = 8;
const VAC_RETURN_HOME = 16;
const VAC_LOCATE = 512;
const VAC_START = 8192;
const VAC_CLEAN_AREA = 16384;

/** What a robot vacuum can do, from its supported_features: a button it cannot serve is never drawn. */
export interface VacuumControls {
  start: "start" | "turn_on" | null;
  pause: boolean;
  stop: boolean;
  home: boolean;
  locate: boolean;
  cleanArea: boolean;
}

export function vacuumControls(st: HassEntity): VacuumControls {
  const f = st.attributes.supported_features;
  // an integration that reports no features at all: the basics every vacuum has
  if (typeof f !== "number") return { start: "start", pause: true, stop: false, home: true, locate: false, cleanArea: false };
  return {
    start: f & VAC_START ? "start" : f & VAC_TURN_ON ? "turn_on" : null,
    pause: (f & VAC_PAUSE) !== 0,
    stop: (f & VAC_STOP) !== 0,
    home: (f & VAC_RETURN_HOME) !== 0,
    locate: (f & VAC_LOCATE) !== 0,
    cleanArea: (f & VAC_CLEAN_AREA) !== 0,
  };
}

/** The states in which a vacuum is at work. */
export function vacuumBusy(state: string): boolean {
  return state === "cleaning" || state === "returning" || /clean/.test(state);
}

const AREA_KEYS = ["cleaned_area", "cleaning_area", "last_clean_area", "last_cleaned_area", "clean_area"];
const TIME_KEYS = ["cleaning_time", "clean_time", "last_clean_duration", "cleaning_duration", "last_cleaning_time"];
const WHEN_KEYS = ["last_clean_start", "last_clean_end", "last_run", "last_cleaned", "last_clean", "last_clean_time"];
const SENSOR_AREA = /(last_?clean(ed|ing)?_?area|cleaning_?area|clean(ed)?_?area)/;
const SENSOR_TIME = /(last_?clean(ed|ing)?_?(time|duration)|cleaning_?(time|duration)|clean_?(time|duration))/;
const SENSOR_WHEN = /(last_?(clean(ed|ing)?(_?(start|end|time))?|run)$)/;

/** What the last run was, as far as the integration tells (attributes of the vacuum, else sensors of its device). */
export interface VacuumRun {
  /** ISO time or null. */
  when: string | null;
  /** Cleaned area with its unit, else null. */
  area: string | null;
  /** Duration in seconds, else null. */
  seconds: number | null;
  battery: number | null;
}

function sensorsOfDevice(hass: HomeAssistant, entityId: string): HassEntity[] {
  const device = hass.entities?.[entityId]?.device_id;
  if (!device) return [];
  return Object.keys(hass.entities ?? {})
    .filter((id) => id.startsWith("sensor.") && hass.entities![id]?.device_id === device)
    .map((id) => hass.states[id])
    .filter((s): s is HassEntity => !!s && s.state !== "unknown" && s.state !== "unavailable");
}

function secondsOf(value: unknown, unit: string | undefined): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(n)) return null;
  const u = (unit ?? "").toLowerCase();
  return u.startsWith("h") ? n * 3600 : u === "s" || u.startsWith("sec") ? n : n * 60;
}

export function vacuumRun(hass: HomeAssistant, st: HassEntity): VacuumRun {
  const a = st.attributes;
  const siblings = sensorsOfDevice(hass, st.entity_id);
  const byName = (re: RegExp) => siblings.find((s) => re.test(s.entity_id.split(".")[1] ?? ""));
  const attr = (keys: string[]) => keys.find((k) => a[k] !== undefined && a[k] !== null && a[k] !== "");
  const round1 = (n: number) => Math.round(n * 10) / 10;
  let area: string | null = null;
  const ak = attr(AREA_KEYS);
  if (ak && Number.isFinite(Number(a[ak]))) area = `${round1(Number(a[ak]))} ${(a.area_unit as string | undefined) ?? "m²"}`;
  else {
    const s = byName(SENSOR_AREA);
    if (s && Number.isFinite(Number(s.state))) area = `${round1(Number(s.state))} ${(s.attributes.unit_of_measurement as string | undefined) ?? "m²"}`;
  }
  let seconds: number | null = null;
  const tk = attr(TIME_KEYS);
  if (tk) seconds = secondsOf(a[tk], a.time_unit as string | undefined);
  else {
    const s = byName(SENSOR_TIME);
    if (s) seconds = secondsOf(s.state, s.attributes.unit_of_measurement as string | undefined);
  }
  let when: string | null = null;
  const wk = attr(WHEN_KEYS);
  if (wk && Number.isFinite(Date.parse(String(a[wk])))) when = new Date(String(a[wk])).toISOString();
  else {
    const s = byName(SENSOR_WHEN);
    if (s && Number.isFinite(Date.parse(s.state))) when = new Date(s.state).toISOString();
  }
  let battery: number | null = null;
  if (typeof a.battery_level === "number") battery = Math.round(a.battery_level);
  else {
    const s = siblings.find((x) => x.attributes.device_class === "battery");
    if (s && Number.isFinite(Number(s.state))) battery = Math.round(Number(s.state));
  }
  return { when, area, seconds, battery };
}

/** "1 h 5 min", "42 min", "30 s". */
export function durationText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 90) return `${s} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`;
}

/** The rooms a vacuum can clean by Home Assistant's own area mapping (entity registry options), as [area id, name]. */
export function vacuumAreas(hass: HomeAssistant, options: unknown): [string, string][] {
  const map = (options as { vacuum?: { area_mapping?: Record<string, unknown> } } | null | undefined)?.vacuum?.area_mapping;
  if (!map || typeof map !== "object") return [];
  return Object.keys(map)
    .filter((id) => !Array.isArray(map[id]) || (map[id] as unknown[]).length > 0)
    .map((id): [string, string] => [id, hass.areas?.[id]?.name ?? id])
    .sort((a, b) => a[1].localeCompare(b[1]));
}

/** Where a popup of `w` x `h` stands for a pin at (x, y) in a stage of `sw` x `sh`: above the pin (below near the top), kept inside the stage. */
export function popupPosition(x: number, y: number, w: number, h: number, sw: number, sh: number): { left: number; top: number } {
  const gap = 18;
  let left = x - w / 2;
  let top = y - h - gap;
  if (top < 8) top = y + gap;
  left = Math.max(8, Math.min(sw - w - 8, left));
  top = Math.max(8, Math.min(sh - h - 8, top));
  return { left, top };
}

/** A camera's picture with a changing query, so the browser fetches a fresh still. */
export function stillUrl(st: HassEntity | undefined, tick: number): string | null {
  const picture = st?.attributes.entity_picture as string | undefined;
  if (!picture) return null;
  return picture.startsWith("data:") ? picture : `${picture}${picture.includes("?") ? "&" : "?"}fp3d=${tick}`;
}
