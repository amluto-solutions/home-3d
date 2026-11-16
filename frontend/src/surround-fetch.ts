// Loading the neighbourhood from OpenStreetMap (see surroundings.ts, #462): the Overpass query, reading its answer
// into map metres, and asking the public servers again when they are busy. The entry of a bundle of its own
// (home-3d-osm.js, load-osm.ts) that loads only when an admin taps Load surroundings.
//
// Hosts rule (owner, run 15): the only servers this calls are the two public Overpass servers below, only on that
// tap, with the box around Home Assistant's location in one query. hosts.test.ts fails on any other host.
// Map data © OpenStreetMap contributors, under the Open Database Licence. Ported from NeonPlan 3D 3.4.1 (MIT, Mastershort).

import type { Building, SurroundArea, SurroundBuilding, Surroundings, SurroundWay, Vec2 } from "./model.ts";
import { placeUnderPlan } from "./surround-align.ts";
import { homeBuilding } from "./surroundings.ts";

export { placeUnderPlan } from "./surround-align.ts";
export type { MapPlace } from "./surround-align.ts";

/** Public Overpass servers, tried in this order. */
export const OVERPASS_SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"] as const;

/** The map data of the neighbourhood, without how it lies under the plan. */
export type SurroundData = Omit<Surroundings, "on" | "at" | "x" | "z" | "own" | "hide" | "show" | "flat">;

/**
 * The Overpass query for everything around a point within `radius` metres. A box is far quicker for the server than a
 * circle; what lies outside the circle is dropped when the answer is read.
 */
export function overpassQuery(lat: number, lon: number, radius: number): string {
  const k = Math.PI / 180;
  const dLat = radius / (6378137 * k);
  const dLon = radius / (6378137 * k * Math.max(0.05, Math.cos(lat * k)));
  const box = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].map((v) => v.toFixed(6)).join(",");
  return (
    `[out:json][timeout:60][bbox:${box}];(` +
    `way["building"];relation["building"];` +
    `way["highway"];way["railway"~"^(rail|light_rail|tram|subway|narrow_gauge)$"];` +
    `way["waterway"~"^(river|stream|canal|ditch)$"];` +
    `way["natural"~"^(water|wood)$"];way["landuse"~"^(forest|grass|meadow|recreation_ground|village_green|reservoir|basin)$"];` +
    `way["leisure"~"^(park|garden|pitch|playground)$"];` +
    `node["natural"="tree"];` +
    `);out tags geom;`
  );
}

interface OsmLatLon {
  lat: number;
  lon: number;
}
/** One element of an Overpass answer (`out tags geom`). */
export interface OsmElement {
  type: "node" | "way" | "relation";
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
  geometry?: (OsmLatLon | null)[];
  members?: { type: string; role: string; geometry?: (OsmLatLon | null)[] }[];
}

/** Metres east and north of the origin (a flat map: good to a few centimetres within a few hundred metres). */
export function toMetres(lat0: number, lon0: number, lat: number, lon: number): Vec2 {
  const k = Math.PI / 180;
  const east = (lon - lon0) * k * 6378137 * Math.cos(lat0 * k);
  const north = (lat - lat0) * k * 6378137;
  return [Math.round(east * 100) / 100, Math.round(north * 100) / 100];
}

/** A height in metres from a tag like "12", "12 m", "12.5m" or "40'" (feet); null when it is none. */
export function parseHeight(v: string | undefined): number | null {
  if (!v) return null;
  const m = /^\s*([0-9]+(?:[.,][0-9]+)?)\s*(m|ft|')?\s*$/i.exec(v);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  if (!(n > 0)) return null;
  return m[2] && m[2].toLowerCase() !== "m" ? n * 0.3048 : n;
}

const LOW = new Set(["garage", "garages", "carport", "shed", "hut", "kiosk", "roof", "greenhouse", "cabin", "service", "bunker", "toilets"]);
const FLATS = new Set(["apartments", "residential", "dormitory", "hotel"]);
const WORK = new Set(["commercial", "retail", "office", "industrial", "warehouse", "supermarket", "school", "public", "civic", "hospital", "university"]);
const WORSHIP = new Set(["church", "cathedral", "chapel", "mosque", "temple"]);
const FARM = new Set(["barn", "farm_auxiliary", "stable", "cowshed"]);

/** How tall a building is: its height tag, its storeys, else a guess from its kind. */
export function buildingHeight(tags: Record<string, string>): number {
  const h = parseHeight(tags.height) ?? parseHeight(tags["building:height"]);
  if (h) return Math.min(400, h);
  const levels = parseFloat(tags["building:levels"] ?? "");
  if (levels > 0) {
    const roof = parseFloat(tags["roof:levels"] ?? "") || 0;
    // storeys of 3 m, and a pitched roof on top of most houses
    return Math.min(400, levels * 3 + (roof > 0 ? roof * 2.5 : 1.5));
  }
  const kind = tags.building ?? "yes";
  if (LOW.has(kind)) return 3;
  if (FLATS.has(kind)) return 14;
  if (WORK.has(kind)) return 10;
  if (WORSHIP.has(kind)) return 16;
  if (FARM.has(kind)) return 6;
  return 7;
}

const WAY_WIDTH: Record<string, number> = {
  motorway: 14,
  trunk: 12,
  primary: 10,
  secondary: 8,
  tertiary: 7,
  motorway_link: 6,
  trunk_link: 6,
  primary_link: 6,
  secondary_link: 6,
  tertiary_link: 6,
  residential: 6,
  unclassified: 5.5,
  living_street: 5,
  road: 5,
  service: 3.5,
  pedestrian: 4,
  track: 3,
  busway: 6,
};
const PATHS = new Set(["footway", "path", "cycleway", "bridleway", "steps", "corridor"]);

/** A street, path, railway or stream from its tags, or null for anything else (an area, a proposed road …). */
export function wayKind(tags: Record<string, string>): { k: SurroundWay["k"]; w: number } | null {
  const hw = tags.highway;
  if (hw) {
    if (["proposed", "construction", "platform", "elevator", "raceway"].includes(hw) || tags.area === "yes") return null;
    if (tags.tunnel && tags.tunnel !== "no") return null;
    const width = parseHeight(tags.width);
    if (PATHS.has(hw)) return { k: "path", w: width ?? 1.8 };
    return { k: hw === "track" ? "path" : "road", w: width ?? WAY_WIDTH[hw] ?? 5 };
  }
  if (tags.railway) return tags.tunnel && tags.tunnel !== "no" ? null : { k: "rail", w: 3 };
  const ww = tags.waterway;
  if (ww) {
    if (tags.tunnel && tags.tunnel !== "no") return null;
    return { k: "water", w: parseHeight(tags.width) ?? (ww === "river" ? 10 : ww === "canal" ? 8 : ww === "stream" ? 2 : 1.2) };
  }
  return null;
}

/** An area of the neighbourhood from its tags, or null. */
export function areaKind(tags: Record<string, string>): SurroundArea["k"] | null {
  if (tags.natural === "water" || tags.landuse === "reservoir" || tags.landuse === "basin") return "water";
  if (tags.natural === "wood" || tags.landuse === "forest") return "wood";
  if (["grass", "meadow", "recreation_ground", "village_green"].includes(tags.landuse ?? "") || ["park", "garden", "pitch", "playground"].includes(tags.leisure ?? "")) return "green";
  return null;
}

/** Leaves out points closer than `tol` metres to the line through their neighbours (Douglas–Peucker). */
export function simplify(points: Vec2[], tol = 0.15): Vec2[] {
  if (points.length <= 2) return points;
  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = keep[points.length - 1] = true;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, az] = points[a];
    const [bx, bz] = points[b];
    const len = Math.hypot(bx - ax, bz - az) || 1;
    let worst = -1;
    let far = 0;
    for (let i = a + 1; i < b; i++) {
      const [px, pz] = points[i];
      const d = Math.abs((bx - ax) * (az - pz) - (ax - px) * (bz - az)) / len;
      if (d > far) {
        far = d;
        worst = i;
      }
    }
    if (worst >= 0 && far > tol) {
      keep[worst] = true;
      stack.push([a, worst], [worst, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** A ring without its closing point (OSM repeats the first point at the end). */
function openRing(points: Vec2[]): Vec2[] {
  if (points.length > 1) {
    const [a, b] = [points[0], points[points.length - 1]];
    if (Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01) return points.slice(0, -1);
  }
  return points;
}

/** A ring of at most 200 points (the plan's limit per shape): simplified harder until it fits, else empty. */
function fitRing(points: Vec2[], tol: number): Vec2[] {
  let ring = simplify(points, tol);
  for (const more of [1, 3]) if (ring.length > 200) ring = simplify(points, more);
  return ring.length <= 200 ? ring : [];
}

/** A line cut into pieces of at most `max` points (the plan keeps at most 200 points per shape). */
function chunks(points: Vec2[], max = 200): Vec2[][] {
  if (points.length <= max) return [points];
  const out: Vec2[][] = [];
  for (let i = 0; i < points.length - 1; i += max - 1) out.push(points.slice(i, i + max));
  return out;
}

/** The parts of a line inside the circle of radius `r` around the origin, each segment cut at the circle. */
export function clipLine(points: Vec2[], r: number): Vec2[][] {
  const out: Vec2[][] = [];
  let run: Vec2[] = [];
  const inside = (p: Vec2) => Math.hypot(p[0], p[1]) <= r;
  const end = () => {
    if (run.length >= 2) out.push(run);
    run = [];
  };
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    // the segment a + t (b - a) inside the circle: |a + t d|² <= r² for t in [t0, t1]
    const d: Vec2 = [b[0] - a[0], b[1] - a[1]];
    const A = d[0] * d[0] + d[1] * d[1];
    const B = 2 * (a[0] * d[0] + a[1] * d[1]);
    const C = a[0] * a[0] + a[1] * a[1] - r * r;
    const disc = B * B - 4 * A * C;
    if (A === 0 || disc <= 0) {
      end();
      continue;
    }
    const t0 = Math.max(0, (-B - Math.sqrt(disc)) / (2 * A));
    const t1 = Math.min(1, (-B + Math.sqrt(disc)) / (2 * A));
    if (t0 >= t1) {
      end();
      continue;
    }
    const at = (t: number): Vec2 => [Math.round((a[0] + t * d[0]) * 100) / 100, Math.round((a[1] + t * d[1]) * 100) / 100];
    if (!run.length) run.push(t0 > 0 ? at(t0) : a);
    run.push(t1 < 1 ? at(t1) : b);
    if (t1 < 1 || !inside(b)) end();
  }
  end();
  return out;
}

/** A polygon cut to the square |x|, |z| <= h (Sutherland–Hodgman): far-reaching woods and fields stay near. */
export function clipSquare(points: Vec2[], h: number): Vec2[] {
  let poly = points;
  const edges: [0 | 1, number][] = [
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
  ];
  for (const [axis, sign] of edges) {
    const keep = (p: Vec2) => sign * p[axis] <= h;
    const next: Vec2[] = [];
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const ka = keep(a);
      const kb = keep(b);
      if (ka) next.push(a);
      if (ka !== kb) {
        const t = (sign * h - a[axis]) / (b[axis] - a[axis]);
        next.push([Math.round((a[0] + t * (b[0] - a[0])) * 100) / 100, Math.round((a[1] + t * (b[1] - a[1])) * 100) / 100]);
      }
    }
    poly = next;
    if (poly.length < 3) return [];
  }
  return poly;
}

/** The most of each kind the plan keeps (the schema's limits in schema.py). */
export const SURROUND_LIMITS = { buildings: 3000, ways: 3000, areas: 500, trees: 3000 } as const;

/**
 * The neighbourhood from an Overpass answer (`out tags geom`), in map metres around (lat, lon). Only what lies at
 * least partly within `radius` is kept; buildings and areas are simplified a little. Lines are cut at a circle a
 * little beyond the radius, areas and buildings at a square around it, so nothing reaches kilometres away.
 */
export function parseOverpass(data: { elements?: OsmElement[] }, lat: number, lon: number, radius: number): SurroundData {
  const buildings: SurroundBuilding[] = [];
  const ways: SurroundWay[] = [];
  const areas: SurroundArea[] = [];
  const trees: Vec2[] = [];
  const reach = radius * 1.15;
  const near = (p: Vec2) => Math.hypot(p[0], p[1]) <= reach;
  // areas and buildings: cut at a square a bit wider than the circle (a field reaching out is cut, not dropped)
  const box = radius * 1.5;
  const line = (g: (OsmLatLon | null)[] | undefined): Vec2[] => (g ?? []).filter((q): q is OsmLatLon => !!q && Number.isFinite(q.lat) && Number.isFinite(q.lon)).map((q) => toMetres(lat, lon, q.lat, q.lon));
  for (const el of data.elements ?? []) {
    const tags = el.tags ?? {};
    if (el.type === "node") {
      if (tags.natural === "tree" && typeof el.lat === "number" && typeof el.lon === "number") {
        const p = toMetres(lat, lon, el.lat, el.lon);
        if (near(p)) trees.push(p);
      }
      continue;
    }
    if (tags.building && tags.building !== "no") {
      const h = buildingHeight(tags);
      // a building as a multipolygon: each outer ring is a block (courtyards stay filled – a block from afar)
      const rings = el.type === "relation" ? (el.members ?? []).filter((m) => m.role === "outer").map((m) => line(m.geometry)) : [line(el.geometry)];
      for (const r of rings) {
        const ring = clipSquare(fitRing(openRing(r), 0.1), box);
        if (ring.length >= 3 && ring.length <= 200 && ring.some(near)) buildings.push({ p: ring, h: Math.round(h * 10) / 10 });
      }
      continue;
    }
    if (el.type !== "way") continue;
    const pts = line(el.geometry);
    // a road passing by with its ends far away still counts: only a way wholly outside the square is skipped
    if (pts.length < 2 || pts.every(([x]) => x < -box) || pts.every(([x]) => x > box) || pts.every(([, z]) => z < -box) || pts.every(([, z]) => z > box)) continue;
    const kind = wayKind(tags);
    if (kind) {
      for (const piece of clipLine(simplify(pts, 0.3), reach)) for (const part of chunks(piece)) if (part.length >= 2) ways.push({ p: part, w: Math.min(60, kind.w), k: kind.k });
      continue;
    }
    const ak = areaKind(tags);
    if (ak) {
      const ring = clipSquare(fitRing(openRing(pts), 0.3), box);
      if (ring.length >= 3 && ring.length <= 200) areas.push({ p: ring, k: ak });
    }
  }
  const L = SURROUND_LIMITS;
  return { lat, lon, radius, buildings: buildings.slice(0, L.buildings), ways: ways.slice(0, L.ways), areas: areas.slice(0, L.areas), trees: trees.slice(0, L.trees) };
}

/** Why loading failed, for the message shown: the servers are busy, none was reached, or the map is empty there. */
export class SurroundError extends Error {
  readonly kind: "busy" | "offline" | "empty";
  constructor(kind: "busy" | "offline" | "empty", message: string) {
    super(message);
    this.kind = kind;
  }
}

/** The answers that mean "busy, ask again later". */
const BUSY = new Set([429, 502, 503, 504]);

/**
 * Fetches the neighbourhood around (lat, lon) from the public Overpass servers: a busy server (429, 502, 503, 504) is
 * asked again after a pause (4, 8, 16 s), then the next one. Throws a SurroundError.
 */
export async function fetchSurroundings(
  lat: number,
  lon: number,
  radius: number,
  signal?: AbortSignal,
  fetcher: typeof fetch = fetch,
  pause = (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
): Promise<SurroundData> {
  const body = new URLSearchParams({ data: overpassQuery(lat, lon, radius) });
  let busy = false;
  for (const url of OVERPASS_SERVERS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (signal?.aborted) throw new SurroundError("offline", "aborted");
      let res: Response;
      try {
        // no cookies, no referrer: the query is all the server gets
        res = await fetcher(url, { method: "POST", body, signal, credentials: "omit", referrerPolicy: "no-referrer" });
      } catch {
        break;
      }
      if (res.ok) {
        let data: { elements?: OsmElement[] };
        try {
          data = (await res.json()) as { elements?: OsmElement[] };
        } catch {
          break;
        }
        const out = parseOverpass(data, lat, lon, radius);
        if (!out.buildings.length && !out.ways.length) throw new SurroundError("empty", "nothing on the map here");
        return out;
      }
      if (!BUSY.has(res.status)) break;
      busy = true;
      if (attempt < 2) await pause(4000 * 2 ** attempt);
    }
  }
  throw new SurroundError(busy ? "busy" : "offline", busy ? "the map servers are busy" : "no map server reached");
}

/**
 * Lays freshly loaded map data under the plan: the home's own building on the map is found, the map is aligned onto
 * the ground floor (or made the template when nothing is drawn yet). The plan's `north` changes to `north`.
 */
export function placeSurroundings(data: SurroundData, b: Building, now = Date.now()): { surroundings: Surroundings; north: number } {
  const own = homeBuilding(data);
  const place = placeUnderPlan(data, own, b);
  return { surroundings: { on: true, at: Math.round(now / 1000), own, x: place.x, z: place.z, ...data }, north: place.north };
}

/** Load surroundings (the one call Settings makes on the tap): fetch, then lay the map under the plan `b`. */
export async function loadSurroundings(lat: number, lon: number, radius: number, b: Building, signal?: AbortSignal, fetcher: typeof fetch = fetch): Promise<{ surroundings: Surroundings; north: number }> {
  return placeSurroundings(await fetchSurroundings(lat, lon, radius, signal, fetcher), b);
}
