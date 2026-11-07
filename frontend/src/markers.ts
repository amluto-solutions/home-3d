// Turns placements and entity states into device markers for the 3D view, and formats short state
// texts shared by markers and the room panel.

import { detectCameraModel } from "./camera-models.ts";
import { defaultHeight, entityName, isActive, isUnavailable, kindOf, lightGlow, tempUnit } from "./devices.ts";
import { callServiceSafe } from "./failure.ts";
import { formatNumber, translate, type I18nKey } from "./i18n.ts";
import { iconSvg, mdiIcon } from "./icons.ts";
import type { Building } from "./model.ts";
import { getPacks, packsVersion } from "./packs.ts";
import { effectSettings } from "./room-effects.ts";
import { pointInPolygon } from "./model.ts";
import type { HassEntity, HomeAssistant } from "./types.ts";
import type { DeviceMarker } from "./viewer/viewer3d.ts";

const t = (hass: HomeAssistant | undefined, key: I18nKey) => translate(hass, key);

/** Short, localised state text for a marker or a panel row. */
export function stateText(hass: HomeAssistant | undefined, st: HassEntity | undefined): string {
  if (!st || isUnavailable(st)) return t(hass, "state_unavailable");
  const a = st.attributes;
  switch (kindOf(st.entity_id)) {
    case "light":
      if (st.state !== "on") return t(hass, "state_off");
      return typeof a.brightness === "number" ? `${Math.round((a.brightness / 255) * 100)} %` : t(hass, "state_on");
    case "switch":
    case "fan":
      return t(hass, st.state === "on" ? "state_on" : "state_off");
    case "cover":
      if (typeof a.current_position === "number" && st.state !== "opening" && st.state !== "closing") return `${a.current_position} %`;
      return translateState(hass, st.state);
    case "climate": {
      const cur = typeof a.current_temperature === "number" ? `${formatNumber(hass, a.current_temperature, 1)} ${hass ? tempUnit(hass) : "°C"}` : null;
      if (st.state === "off") return cur ? `${cur} · ${t(hass, "state_off")}` : t(hass, "state_off");
      return cur ?? translateState(hass, st.state);
    }
    case "media": {
      // what is running: the app (Netflix, YouTube, …), else the title or the input source
      const running = st.state === "playing" || st.state === "paused" || st.state === "on" || st.state === "idle";
      const what = [a.app_name, a.media_title, a.source].find((v) => typeof v === "string" && v) as string | undefined;
      return running && what ? what : translateState(hass, st.state);
    }
    case "lock":
    case "camera":
      return translateState(hass, st.state);
    case "binary": {
      const opening = ["door", "window", "opening", "garage_door"].includes(a.device_class as string);
      if (opening) return t(hass, st.state === "on" ? "state_open" : "state_closed");
      return t(hass, st.state === "on" ? "state_detected" : "state_clear");
    }
    case "sensor": {
      const v = Number(st.state);
      const unit = (a.unit_of_measurement as string | undefined) ?? "";
      // the decimals set in Home Assistant win (a gas meter reads 1234.567 m³)
      const digits = hass?.entities?.[st.entity_id]?.display_precision ?? 1;
      return Number.isFinite(v) ? `${formatNumber(hass, v, digits)}${unit ? ` ${unit}` : ""}` : st.state;
    }
    default:
      return "";
  }
}

function translateState(hass: HomeAssistant | undefined, state: string): string {
  const key = `state_${state}` as I18nKey;
  const s = translate(hass, key);
  return s === key ? state : s;
}

const protectLooks = new Map<string, string | null>();

/** The pack camera model drawn for a UniFi Protect camera of a known model (#273); null: the built-in one. */
function protectLook(hass: HomeAssistant, id: string): string | null {
  const e = hass.entities?.[id];
  if (e?.platform !== "unifiprotect") return null;
  const key = `${packsVersion()}${hass.devices?.[e.device_id ?? ""]?.model}`;
  if (!protectLooks.has(key)) protectLooks.set(key, detectCameraModel(hass, id, getPacks()));
  return protectLooks.get(key)!;
}

/** Markers for every placed entity that still exists; `now` (epoch ms) for how long a camera stays red. */
export function buildMarkers(hass: HomeAssistant, building: Building, now = Date.now()): DeviceMarker[] {
  const out: DeviceMarker[] = [];
  const hold = effectSettings(building).camera_seconds * 1000;
  // cameras shown by a furniture item of their own (#779)
  const looks = new Set(building.floors.flatMap((f) => f.furniture.map((m) => m.look_of).filter((id): id is string => !!id)));
  for (const floor of building.floors) {
    for (const pl of floor.placements) {
      const kind = kindOf(pl.entity_id);
      const st = hass.states[pl.entity_id];
      if (!kind || !st) continue;
      const room = floor.rooms.find((r) => r.points.length >= 3 && pointInPolygon([pl.x, pl.z], r.points)) ?? null;
      const areaName = room?.area_id ? hass.areas?.[room.area_id]?.name : undefined;
      out.push({
        id: pl.entity_id,
        floorId: floor.id,
        roomId: room?.id ?? null,
        x: pl.x,
        z: pl.z,
        y: pl.y ?? defaultHeight(kind, floor.height, pl.mount ?? null),
        lamp: kind === "light" ? (pl.mount ?? "ceiling") : null,
        model: kind === "camera" ? (pl.mount === "ceiling" ? "camera_ceiling" : "camera_wall") : undefined,
        ...(kind === "camera" && looks.has(pl.entity_id) ? { ownLook: true } : kind === "camera" ? { camPack: protectLook(hass, pl.entity_id) ?? undefined } : {}),
        motion: kind === "camera" ? cameraRedUntil(hass, pl.entity_id, hold, now) !== null : undefined,
        fov: pl.fov ?? undefined,
        reach: pl.reach ?? undefined,
        tilt: pl.tilt ?? undefined,
        rotation: pl.rotation ?? 0,
        icon: pl.icon ? mdiIcon(pl.icon) : iconSvg(kind),
        name: pl.name || entityName(hass, pl.entity_id, areaName),
        ownName: pl.name || undefined,
        showName: !!pl.show_name,
        text: stateText(hass, st),
        active: isActive(st),
        unavailable: isUnavailable(st),
        glow: kind === "light" ? scaleGlow(lightGlow(st), pl.glow_scale) : null,
        show: pl.marker ?? undefined,
        fixed: !!pl.locked,
      });
    }
  }
  return out;
}

/** What a camera's detection sensor reports: a person, a vehicle, an animal or plain motion (by its id and name). */
export type DetectionKind = "person" | "car" | "pet" | "motion";

export function detectionKind(hass: HomeAssistant, sensorId: string): DetectionKind {
  // ids join their words with underscores: "driveway_car_occupancy"
  const text = `${sensorId} ${String(hass.states[sensorId]?.attributes.friendly_name ?? "")}`.toLowerCase().replace(/[_.-]/g, " ");
  if (/person|people|human|pedestrian/.test(text)) return "person";
  if (/\bcar\b|vehicle|truck|bus|motorcycle|bicycle|auto\b/.test(text)) return "car";
  if (/\bdog\b|\bcat\b|\bpet\b|animal|bird/.test(text)) return "pet";
  return "motion";
}

/** Whether a camera's device reports motion or a person right now (its motion/occupancy sensors). */
export function cameraMotion(hass: HomeAssistant, cameraId: string): boolean {
  return cameraMotionSensors(hass, cameraId).some((id) => hass.states[id]?.state === "on");
}

/**
 * When this browser saw each detection sensor take its present state (its own clock). The sensor's `last_changed`
 * is Home Assistant's clock: a wall tablet whose clock is minutes off would hold a camera red for that much longer
 * (or never show the hold), so a change seen live is timed by the browser's own clock.
 */
const seenChange = new Map<string, { changed: string; at: number }>();
/** Within this much of the wall clock `now` is the live moment (a replay's is in the past, in Home Assistant's own clock). */
const LIVE_MS = 60_000;

/**
 * Until when a camera is drawn red: while a detection sensor is on, and for `holdMs` after the last one went off
 * (epoch ms; Infinity while on, null = not red). A sensor whose time is unknown counts only while on.
 */
export function cameraRedUntil(hass: HomeAssistant, cameraId: string, holdMs: number, now: number): number | null {
  let until: number | null = null;
  const live = Math.abs(now - Date.now()) < LIVE_MS;
  for (const id of cameraMotionSensors(hass, cameraId)) {
    const st = hass.states[id];
    // a change seen while the page was open counts from the moment it was seen (the browser's own clock)
    let seen = Number.NaN;
    if (live && st) {
      const prev = seenChange.get(id);
      const changed = st.last_changed ?? "";
      if (!prev || prev.changed !== changed) seenChange.set(id, { changed, at: prev ? now : Number.NaN });
      seen = seenChange.get(id)!.at;
    }
    if (st?.state === "on") return Number.POSITIVE_INFINITY;
    if (st?.state !== "off" || holdMs <= 0) continue;
    // one already there when first looked at counts from Home Assistant's time, but never from the future
    const ha = Date.parse(st.last_changed ?? "");
    const off = Number.isFinite(seen) ? seen : live ? Math.min(ha, now) : ha;
    if (Number.isFinite(off) && off + holdMs > now && (until === null || off + holdMs > until)) until = off + holdMs;
  }
  return until;
}

/**
 * Detection sensors chosen by hand per camera (`detect_sensors` of its placement), from the plan. A camera of one
 * integration and the detection of another (Reolink's camera, Frigate's person sensor) are two devices; and a
 * camera's own sensors may be too eager to count (#815).
 */
let chosenSensors = new Map<string, string[]>();
export function setCameraSensors(building: Building | null | undefined): void {
  chosenSensors = new Map(building?.floors.flatMap((f) => f.placements.filter((p) => Array.isArray(p.detect_sensors)).map((p) => [p.entity_id, p.detect_sensors as string[]] as [string, string[]])) ?? []);
}

/** The detection sensors that count for a camera: the ones chosen by hand, else those of its own device. */
export function cameraMotionSensors(hass: HomeAssistant, cameraId: string): string[] {
  return chosenSensors.get(cameraId) ?? cameraOwnSensors(hass, cameraId);
}

/** The motion, occupancy and presence sensors of a camera's device. */
export function cameraOwnSensors(hass: HomeAssistant, cameraId: string): string[] {
  const device = hass.entities?.[cameraId]?.device_id;
  if (!device) return [];
  return (deviceBinarySensors(hass.entities ?? {}).get(device) ?? []).filter((id) => ["motion", "occupancy", "presence"].includes(String(hass.states[id]?.attributes.device_class)));
}

/**
 * The binary sensors of each device, found in one pass over the entity registry and kept while it stays the same object
 * (#389: every sync looked through the whole registry once per camera; a large home has thousands of entities).
 */
const binaryByDevice = new WeakMap<object, Map<string, string[]>>();
function deviceBinarySensors(entities: NonNullable<HomeAssistant["entities"]>): Map<string, string[]> {
  let map = binaryByDevice.get(entities);
  if (!map) {
    map = new Map();
    for (const e of Object.values(entities)) {
      if (!e.device_id || !e.entity_id.startsWith("binary_sensor.")) continue;
      let list = map.get(e.device_id);
      if (!list) map.set(e.device_id, (list = []));
      list.push(e.entity_id);
    }
    binaryByDevice.set(entities, map);
  }
  return map;
}

/** Entity ids placed anywhere in the building (to notice relevant state changes cheaply). */
export function placedEntities(building: Building): string[] {
  return building.floors.flatMap((f) => f.placements.map((p) => p.entity_id));
}

/** Opens Home Assistant's more-info dialog for an entity. */
export function openMoreInfo(from: HTMLElement, entityId: string): void {
  from.dispatchEvent(new CustomEvent("hass-more-info", { detail: { entityId }, bubbles: true, composed: true }));
}

/** Toggle an entity with its own domain's toggle service (light.toggle, switch.toggle, …). */
export function toggleEntity(hass: HomeAssistant, entityId: string): void {
  const domain = entityId.slice(0, entityId.indexOf("."));
  // a refused call shows the same notice as in the room panel (#208)
  callServiceSafe(hass, domain, "toggle", { entity_id: entityId }, (error) => translate(hass, "service_failed", { error }));
}

/** A glow made weaker or stronger by the lamp's own factor (#181): many LED strips need not outshine the room. */
export function scaleGlow<T extends { level: number }>(glow: T | null, scale: number | null | undefined): T | null {
  if (!glow || scale == null || scale === 1) return glow;
  return { ...glow, level: Math.max(0.02, Math.min(1.5, glow.level * scale)) };
}
