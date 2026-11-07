// A text equivalent of the scene (#195, A11Y-3): per room its name, how many lights are on, the temperature and the
// warnings about it. The 3D canvas and the 2D plan show this only as pixels; a screen reader or a keyboard reaches it here.

import { alertText, type Alert } from "./alerts.ts";
import { areaEntities, fromCelsius, kindOf, primaryEntities, roomClimateValue, tempUnit } from "./devices.ts";
import { formatNumber, translate } from "./i18n.ts";
import type { Building, Floor } from "./model.ts";
import { pointInPolygon, zonesOf } from "./model.ts";
import type { HomeAssistant } from "./types.ts";

export interface RoomSummary {
  floorId: string;
  roomId: string;
  name: string;
  lights: number;
  lightsOn: number;
  /** The room's temperature in the user's unit, with the unit; null without a sensor. */
  temperature: string | null;
  /** The texts of the warnings that concern this room (or the whole house or floor). */
  alerts: string[];
}

export interface FloorSummary {
  floorId: string;
  name: string;
  rooms: RoomSummary[];
}

/** The rooms of one floor (null: every floor) with their state. */
export function sceneSummary(hass: HomeAssistant, building: Building, alerts: readonly Alert[], floorId: string | null): FloorSummary[] {
  const out: FloorSummary[] = [];
  for (const floor of building.floors) {
    if (floorId && floor.id !== floorId) continue;
    const rooms = zonesOf(floor).map((room) => roomSummary(hass, building, floor, room.id, alerts));
    if (rooms.length) out.push({ floorId: floor.id, name: floor.name, rooms });
  }
  return out;
}

function roomSummary(hass: HomeAssistant, building: Building, floor: Floor, roomId: string, alerts: readonly Alert[]): RoomSummary {
  const room = zonesOf(floor).find((r) => r.id === roomId)!;
  // main entities only: a LED strip with 30 segment entities is one light
  const ids = new Set<string>();
  for (const id of primaryEntities(hass, areaEntities(hass, room.area_id))) if (kindOf(id) === "light") ids.add(id);
  for (const pl of floor.placements) if (kindOf(pl.entity_id) === "light" && room.points.length >= 3 && pointInPolygon([pl.x, pl.z], room.points)) ids.add(pl.entity_id);
  const t = roomClimateValue(hass, floor, room, "temperature");
  const concerning = alerts.filter((a) => !a.quiet && (a.roomId === room.id || (!a.roomId && (!a.floorId || a.floorId === floor.id))));
  return {
    floorId: floor.id,
    roomId: room.id,
    name: room.name,
    lights: ids.size,
    lightsOn: [...ids].filter((id) => hass.states[id]?.state === "on").length,
    temperature: t === null ? null : `${formatNumber(hass, fromCelsius(hass, t), 1)} ${tempUnit(hass)}`,
    alerts: concerning.map((a) => alertText(hass, building, a)),
  };
}

/** One room as a sentence for a screen reader: "Lounge: 2 of 3 lights on, 21.5 °C, Smoke detected". */
export function roomSentence(hass: HomeAssistant | undefined, r: RoomSummary): string {
  const parts: string[] = [];
  if (r.lights) parts.push(r.lightsOn ? translate(hass, "sr_lights_on", { on: r.lightsOn, total: r.lights }) : translate(hass, "sr_lights_off"));
  if (r.temperature) parts.push(r.temperature);
  parts.push(...r.alerts);
  return parts.length ? `${r.name}: ${parts.join(", ")}` : r.name;
}
