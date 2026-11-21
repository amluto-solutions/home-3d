// The rooms as the phone view shows them (#493, ported from NeonPlan 3D 4.0.0, MIT, Mastershort): a tile per room with
// its temperature, the lights on, the open windows and doors, a player that plays, and the room's blinds. The room's
// entities are the room panel's own choice (roomPanelEntities), so tile and panel agree. What a room holds is worked out
// once per registry and plan; a state change only reads the states again.
import { fromCelsius, kindOf, roomClimateValue, roomPanelEntities } from "./devices.ts";
import { zonesOf, type Building, type Floor, type Room } from "./model.ts";
import { roofWindowsOver } from "./solar.ts";
import type { HomeAssistant } from "./types.ts";

export interface RoomTile {
  floorId: string;
  roomId: string;
  name: string;
  /** In Home Assistant's unit; null without a sensor or a thermostat that tells it. */
  temp: number | null;
  /** The room's lights, and those of them that are on. */
  lights: string[];
  lightsOn: string[];
  /** Windows and doors with a contact that report open. */
  open: number;
  /** A player in the room plays (a paused one does not count: many speakers stay paused all day). */
  playing: boolean;
  /** The room's blinds and covers. */
  covers: string[];
  /** The room's thermostats (the phone bar's own place "climate", #494). */
  climates: string[];
  /** Something is on, open or playing: the tile is lit. */
  active: boolean;
}

/** Contact classes that tell an open window or door. */
const OPENINGS = new Set(["window", "door", "opening", "garage_door"]);

let memo: { entities: unknown; building: Building; rooms: Map<string, string[]> } | null = null;

function roomEntities(hass: HomeAssistant, b: Building, floor: Floor, room: Room): string[] {
  if (!memo || memo.entities !== hass.entities || memo.building !== b) memo = { entities: hass.entities, building: b, rooms: new Map() };
  let ids = memo.rooms.get(room.id);
  if (!ids) {
    ids = roomPanelEntities(hass, floor, room, roofWindowsOver(b, room.id)).shown;
    memo.rooms.set(room.id, ids);
  }
  return ids;
}

/** The tiles of one floor, or of every floor from the lowest up (`floorId` null). Rooms without a name have none. */
export function roomTiles(hass: HomeAssistant, b: Building, floorId: string | null): RoomTile[] {
  const floors = floorId ? b.floors.filter((f) => f.id === floorId) : [...b.floors].sort((p, q) => p.elevation - q.elevation);
  const out: RoomTile[] = [];
  for (const floor of floors) {
    const zones = zonesOf(floor);
    for (const [i, room] of zones.entries()) {
      // the parts of one garden (same area, same name) share one tile
      if (!room.name?.trim() || (room.outdoor && zones.findIndex((x) => x.outdoor && x.area_id === room.area_id && x.name === room.name) < i)) continue;
      const ids = roomEntities(hass, b, floor, room);
      const lights = ids.filter((id) => kindOf(id) === "light" && hass.states[id]);
      const lightsOn = lights.filter((id) => hass.states[id].state === "on");
      const open = ids.filter((id) => {
        const st = hass.states[id];
        return kindOf(id) === "binary" && st?.state === "on" && OPENINGS.has(String(st.attributes.device_class ?? ""));
      }).length;
      const playing = ids.some((id) => kindOf(id) === "media" && hass.states[id]?.state === "playing");
      const covers = ids.filter((id) => kindOf(id) === "cover" && hass.states[id]);
      const climates = ids.filter((id) => kindOf(id) === "climate" && hass.states[id]);
      const c = roomClimateValue(hass, floor, room, "temperature");
      let temp = c === null ? null : fromCelsius(hass, c);
      if (temp === null && room.climate?.temperature !== "none") {
        const t = ids.filter((id) => kindOf(id) === "climate").map((id) => hass.states[id]?.attributes.current_temperature).find((v) => typeof v === "number");
        if (typeof t === "number") temp = t;
      }
      out.push({ floorId: floor.id, roomId: room.id, name: room.name, temp, lights, lightsOn, open, playing, covers, climates, active: lightsOn.length > 0 || open > 0 || playing });
    }
  }
  return out;
}
