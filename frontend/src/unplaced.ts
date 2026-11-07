/**
 * Unplaced Home Assistant entities (#83): the devices of each HA area that the plan does not show yet – not placed
 * as a pin, not linked to an item, a door or a window – with the room that stands for the area, suggested links to
 * the room's items, and the list of entities hidden from it.
 */
import { areaEntities, entityAreaId, entityName, groupByDevice, isPlaceable, kindOf, type FurnitureLinks } from "./devices.ts";
import { isCameraItem, isThermostatItem, isTvLike, mainLinkAccepts } from "./furniture-links.ts";
import { isLamp, pointInPolygon, type Building, type BuildingSettings, type Furniture } from "./model.ts";
import { isElectric, isRobotVacuum, packMotion } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";

export interface UnplacedArea {
  areaId: string;
  name: string;
  /** The room (and its floor) linked to this area; null when no room stands for it yet. */
  floorId: string | null;
  roomId: string | null;
  /** One entity per device, in the area's order (by kind, then name). */
  ids: string[];
}

const ENTITY_ID = /^[a-z_]+\.[a-z0-9_]+$/;

/** Every entity id an object names (an item's links, a door's cover and contacts, a wall switch's gangs …). */
function collectIds(value: unknown, out: Set<string>): void {
  if (typeof value === "string") {
    if (ENTITY_ID.test(value)) out.add(value);
  } else if (Array.isArray(value)) for (const v of value) collectIds(v, out);
  else if (value && typeof value === "object") for (const v of Object.values(value)) collectIds(v, out);
}

/**
 * Entities the plan shows already: placed pins, and every entity an item, a door or a window links; `extra` adds the
 * ones linked automatically (furnitureEntities).
 */
export function placedEntities(b: Building, extra: Iterable<string> = []): Set<string> {
  const out = new Set<string>(extra);
  for (const f of b.floors) {
    for (const p of f.placements) out.add(p.entity_id);
    collectIds(f.furniture, out);
    collectIds(f.openings, out);
  }
  return out;
}

/**
 * The unplaced devices of every HA area, by area name. A device counts as placed when any of its entities is
 * (a camera placed brings its motion sensor along). Hidden entities (the plan's `unplaced_hidden`) are left out.
 */
export function unplacedByArea(hass: HomeAssistant, b: Building, opts: { hidden?: Iterable<string>; linked?: Iterable<string> } = {}): UnplacedArea[] {
  const placed = placedEntities(b, opts.linked);
  const hidden = new Set(opts.hidden ?? b.settings.unplaced_hidden ?? []);
  const deviceOf = (id: string) => hass.entities?.[id]?.device_id ?? null;
  const placedDevices = new Set([...placed].map(deviceOf).filter((d): d is string => !!d));
  const rooms = new Map<string, { floorId: string; roomId: string }>();
  for (const f of b.floors) for (const r of f.rooms) if (r.area_id && !rooms.has(r.area_id)) rooms.set(r.area_id, { floorId: f.id, roomId: r.id });
  const out: UnplacedArea[] = [];
  for (const areaId of Object.keys(hass.areas ?? {})) {
    const ids = areaEntities(hass, areaId).filter((id) => isPlaceable(kindOf(id)));
    const free = groupByDevice(hass, ids)
      .filter((g) => ![g.primary, ...g.others].some((id) => placed.has(id) || placedDevices.has(deviceOf(id) ?? "")))
      .map((g) => g.primary)
      .filter((id) => !hidden.has(id));
    if (!free.length) continue;
    const room = rooms.get(areaId);
    out.push({ areaId, name: hass.areas?.[areaId]?.name ?? areaId, floorId: room?.floorId ?? null, roomId: room?.roomId ?? null, ids: free });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Where a suggested link goes: the item on its floor. */
export interface LinkSuggestion {
  floorId: string;
  furnitureId: string;
}

/** The one domain an item stands for (a lamp its light, a radiator its thermostat …); null for any device. */
function ownDomain(type: string): string | null {
  if (isLamp(type)) return "light";
  if (type === "ac_unit" || isThermostatItem(type)) return "climate";
  if (isCameraItem(type)) return "camera";
  if (isTvLike(type)) return "media_player";
  if (isRobotVacuum(type)) return "vacuum";
  const motion = packMotion(type);
  if (type === "awning" || motion === "curtain" || motion === "blind") return "cover";
  return null;
}

/** Words of a name worth comparing (3+ letters). */
function words(text: string): Set<string> {
  return new Set(text.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 3));
}

/**
 * One-tap links (#83): for each unplaced entity, an item without a link in a room of the entity's area that may
 * take it (the Device field would offer it) and fits – by its kind (a lamp and a light, a radiator and a thermostat,
 * a camera item and a camera) or by two shared name words. Each item is suggested once, the best fit first.
 * `links` are the items' links as resolved (furnitureEntities): an item linked automatically is not suggested.
 */
export function suggestLinks(hass: HomeAssistant, b: Building, areas: readonly UnplacedArea[], links: ReadonlyMap<string, FurnitureLinks> = new Map()): Map<string, LinkSuggestion> {
  const pairs: { entity: string; floorId: string; f: Furniture; score: number }[] = [];
  for (const a of areas) {
    const items = b.floors.flatMap((floor) =>
      floor.rooms
        .filter((r) => r.area_id === a.areaId && r.points.length >= 3)
        .flatMap((r) => floor.furniture.filter((f) => pointInPolygon([f.x, f.z], r.points)).map((f) => ({ floorId: floor.id, f }))),
    );
    for (const { floorId, f } of items) {
      if (f.entity != null || links.get(f.id)?.entity || !isElectric(f.type)) continue;
      const itemWords = words(`${f.name ?? ""} ${f.type.split(":").pop()!.replace(/_/g, " ")}`);
      const own = ownDomain(f.type);
      for (const id of a.ids) {
        if (!mainLinkAccepts(hass, f.type, id)) continue;
        const shared = [...words(`${entityName(hass, id)} ${id.split(".")[1].replace(/_/g, " ")}`)].filter((w) => itemWords.has(w)).length;
        const score = (own && id.startsWith(`${own}.`) ? 2 : 0) + shared;
        if (score >= 2) pairs.push({ entity: id, floorId, f, score });
      }
    }
  }
  pairs.sort((x, y) => y.score - x.score);
  const out = new Map<string, LinkSuggestion>();
  const used = new Set<string>();
  for (const p of pairs) {
    if (out.has(p.entity) || used.has(p.f.id)) continue;
    used.add(p.f.id);
    out.set(p.entity, { floorId: p.floorId, furnitureId: p.f.id });
  }
  return out;
}

/** The plan's hidden list with one entity hidden (`on`) or shown again. */
export function setUnplacedHidden(settings: Pick<BuildingSettings, "unplaced_hidden">, id: string, on: boolean): string[] {
  const list = (settings.unplaced_hidden ?? []).filter((x) => x !== id);
  return on ? [...list, id] : list;
}

/** The Hidden view: entities hidden from the list that Home Assistant still has, with their area's name, by name. */
export function hiddenUnplaced(hass: HomeAssistant, b: Building): { id: string; area: string | null }[] {
  return (b.settings.unplaced_hidden ?? [])
    .filter((id) => !!hass.states[id])
    .map((id) => {
      const area = entityAreaId(hass, id);
      return { id, area: area ? (hass.areas?.[area]?.name ?? area) : null };
    })
    .sort((x, y) => entityName(hass, x.id).localeCompare(entityName(hass, y.id)));
}
