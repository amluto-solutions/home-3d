// Start a new house from the map (#465): on an empty ground floor an admin is offered the map (with the privacy text
// first, nothing fetched before the tap), the house's outline becomes the template (square to the grid, a corner at the
// origin, north set), its corners snap and the view fits it; "Align to the map" lays a floor-plan picture onto it with
// four taps. Uses the saved invented Overpass answer; no network.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { newFloor, type Background, type Building, type Floor, type Vec2 } from "../model.ts";
import { placeUnderPlan } from "../surround-align.ts";
import { loadSurroundings, type OsmElement } from "../surround-fetch.ts";
import { englishTable } from "../i18n.ts";
import { mapCorners, mapToPlan, ownOutline } from "../surroundings.ts";
import { makeEditor, square, type TestEditor } from "./editor-harness.ts";
import { MapStart, type Osm } from "./map-start.ts";

const ANSWER = JSON.parse(readFileSync(new URL("../overpass-answer.fixture.json", import.meta.url), "utf8")) as { elements: OsmElement[] };
const en = englishTable() as Record<string, string>;
const de = JSON.parse(readFileSync(new URL("../../../custom_components/home_3d/bundled_languages/amluto.lang-de/strings.json", import.meta.url), "utf8")) as Record<string, string>;
const t = (k: string, vars: Record<string, string | number> = {}) => Object.entries(vars).reduce((s, [n, v]) => s.replace(`{${n}}`, String(v)), en[k] ?? k);

function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "boolean" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(v);
}

const calls: string[] = [];
const fetcher = (async (url: string) => {
  calls.push(String(url));
  return new Response(JSON.stringify({ elements: ANSWER.elements }), { status: 200 });
}) as unknown as typeof fetch;
const osm: Osm = {
  loadSurroundings: (lat, lon, radius, b, signal) => loadSurroundings(lat, lon, radius, b, signal, fetcher),
};
const hass = (admin = true, located = true) => ({ states: {}, areas: {}, user: { is_admin: admin }, language: "en", locale: { language: "en" }, config: located ? { latitude: 45.5, longitude: 7.25 } : {} });

/** An editor on an empty ground floor (nothing drawn), as an admin. */
async function empty(admin = true): Promise<TestEditor> {
  const ed = await makeEditor([]);
  ed.hass = hass(admin);
  return ed;
}

/** The note as an element on `ed`'s plan. */
function note(ed: TestEditor): Record<string, any> {
  const el = new MapStart() as unknown as Record<string, any>;
  el.hass = ed.hass;
  el.building = ed._doc;
  el.t = t;
  el.osm = async () => osm;
  return el;
}

/** The plan the note sends back when its button is tapped on `ed`'s plan. */
async function loadFor(ed: TestEditor): Promise<Building> {
  const el = note(ed);
  let sent: Building | null = null;
  (el as unknown as EventTarget).addEventListener("map-start-loaded", (e) => (sent = (e as CustomEvent<{ building: Building }>).detail.building));
  await el.load();
  assert.ok(sent, "the note sent the plan with the map");
  return sent;
}

// ------------------------------------------------------------------ the note

test("the note is offered to an admin on an empty ground floor, and only there", async () => {
  const ed = await empty();
  assert.match(flat(ed.renderMapStart(ed.floor)), /<fp3d-map-start/);
  // not for an editor who is no Home Assistant admin: the map comes from public servers
  const other = await empty(false);
  assert.equal(flat(other.renderMapStart(other.floor)), "");
  // not once a room is drawn
  const drawn = await makeEditor([square("r", 0, 0, 4, 3)]);
  assert.equal(flat(drawn.renderMapStart(drawn.floor)), "");
  // not on another floor than the one closest to the ground
  const up = await empty();
  up._doc.floors.push({ ...newFloor("u", "Up", 2.7), rooms: [] } as Floor);
  up._floorId = "u";
  assert.equal(flat(up.renderMapStart(up.floor)), "");
  up._floorId = "f";
  assert.match(flat(up.renderMapStart(up.floor)), /<fp3d-map-start/);
  // put away: gone
  ed.mapStartOff();
  assert.equal(flat(ed.renderMapStart(ed.floor)), "");
});

test("the note says what is sent, when and to whom before the first load, and fetches nothing until the tap", async () => {
  calls.length = 0;
  const ed = await empty();
  const el = note(ed);
  const out = flat(el.render());
  assert.match(out, /sends one request to the public OpenStreetMap servers overpass-api\.de/);
  assert.match(out, /nothing is sent until you tap Load/);
  assert.ok(out.indexOf("overpass-api.de") < out.indexOf("Load the map</button>"), "the privacy text stands above the button");
  assert.match(out, /Not now/);
  assert.deepEqual(calls, [], "looking at the note fetches nothing");
  // no location in Home Assistant: says so, and no request goes out
  el.hass = hass(true, false);
  assert.match(flat(el.render()), /has no location set/);
  await el.load();
  assert.deepEqual(calls, [], "no location, no request");
});

test("a busy or missing server is told, and the plan stays as it was", async () => {
  const ed = await empty();
  const el = note(ed);
  el.osm = async () => ({ loadSurroundings: async () => Promise.reject(Object.assign(new Error("busy"), { kind: "busy" })) });
  let sent = false;
  (el as unknown as EventTarget).addEventListener("map-start-loaded", () => (sent = true));
  await el.load();
  assert.equal(sent, false);
  assert.match(flat(el.render()), /map servers are busy/);
});

// ------------------------------------------------------------------ the template

test("loaded, the house from the map is the template: square to the grid, a corner at the origin, north set; the view fits it", async () => {
  calls.length = 0;
  const ed = await empty();
  const next = await loadFor(ed);
  assert.ok(calls.length > 0 && calls.every((u) => /^https:\/\/(overpass-api\.de|overpass\.kumi\.systems)\//.test(u)), "only the public map servers are asked");
  ed.mapStartLoaded(next);
  const out = ownOutline(ed._doc)!;
  assert.ok(out, "the own house is the template");
  const xs = out.map((p) => p[0]);
  const zs = out.map((p) => p[1]);
  assert.ok(Math.abs(Math.min(...xs)) < 0.02 && Math.abs(Math.min(...zs)) < 0.02, `a corner at the origin: ${JSON.stringify(out)}`);
  // square to the grid: every edge runs along x or z
  out.forEach((p, i) => {
    const q = out[(i + 1) % out.length];
    assert.ok(Math.abs(p[0] - q[0]) < 0.05 || Math.abs(p[1] - q[1]) < 0.05, `edge ${i} runs along an axis`);
  });
  assert.equal(typeof ed._doc.settings.north, "number");
  // the view shows the whole outline
  for (const [x, z] of out) {
    const [sx, sy] = ed.toScreen([x, z]);
    assert.ok(sx > 0 && sy > 0 && sx < ed._size.w && sy < ed._size.h, "on screen");
  }
  // one undo step takes the map out again
  ed.undo();
  assert.equal(ownOutline(ed._doc), null);
  assert.equal(ed._doc.settings.surroundings ?? null, null);
});

test("the template is drawn dashed with its corners while the floor is empty, not once rooms are drawn", async () => {
  const ed = await empty();
  ed.mapStartLoaded(await loadFor(ed));
  const drawn = flat(ed.renderMapTemplate(ed.floor));
  assert.match(drawn, /stroke-dasharray/);
  assert.equal((drawn.match(/<circle/g) ?? []).length, ownOutline(ed._doc)!.length, "a mark on every corner");
  // the note now says how to go on, with one button
  const done = flat(note(ed).render());
  assert.match(done, /dashed yellow/);
  assert.doesNotMatch(done, /Load the map/);
  ed.change((_: Building, f: Floor) => f.rooms.push(square("r", 0, 0, 4, 3)));
  assert.equal(flat(ed.renderMapTemplate(ed.floor)), "", "a drawn floor shows the faint map only");
});

test("a map without a house at the location says so instead of offering the load again", async () => {
  const ed = await empty();
  const next = await loadFor(ed);
  next.settings.surroundings!.own = null;
  ed._doc = next;
  const out = flat(note(ed).render());
  assert.match(out, /no house at your location/);
  assert.doesNotMatch(out, /Load the map/);
});

test("while drawing, a corner of the map's houses pulls the point to it, on a floor at the ground floor's level", async () => {
  const ed = await empty();
  ed.mapStartLoaded(await loadFor(ed));
  const corner = ownOutline(ed._doc)![1];
  // a few centimetres away: well inside the snap distance, on no grid line
  const near: Vec2 = [corner[0] + 0.037, corner[1] - 0.041];
  assert.deepEqual(ed.snap(near), corner, "snapped to the map's corner");
  assert.deepEqual(ed._guides.point, corner);
  assert.ok(mapCorners(ed._doc).some((p) => p[0] === corner[0] && p[1] === corner[1]));
  // a floor high above the ground does not snap to the map
  ed._doc.floors.push({ ...newFloor("u", "Up", 5), rooms: [] } as Floor);
  ed._floorId = "u";
  assert.notDeepEqual(ed.snap(near), corner);
});

// ------------------------------------------------------------------ align the picture

/** An editor with the map loaded under an empty ground floor and a 20 x 10 m picture on it. */
async function withPicture(): Promise<TestEditor> {
  const ed = await empty();
  ed.mapStartLoaded(await loadFor(ed));
  ed.updateFloor({ background: { image_id: "plan", x: -2, z: -1, width: 20, opacity: 0.6, rotation: 15 } });
  ed._images = { plan: { url: "x", aspect: 0.5 } };
  return ed;
}

const tap = (ed: TestEditor, p: Vec2) => {
  const [sx, sy] = ed.toScreen(p);
  ed.press(sx, sy);
  ed.release(sx, sy);
};

/** Where a point of the picture (u across, v down, 0 … 1) lies in the plan: the picture turns about its middle. */
function lies(g: Background, u: number, v: number): Vec2 {
  const h = g.width * 0.5;
  const cx = g.x + g.width / 2;
  const cz = g.z + h / 2;
  const r = ((g.rotation ?? 0) * Math.PI) / 180;
  const dx = g.x + u * g.width - cx;
  const dz = g.z + v * h - cz;
  return [cx + dx * Math.cos(r) - dz * Math.sin(r), cz + dx * Math.sin(r) + dz * Math.cos(r)];
}

/** The picture point (u, v) that lies at plan point `p`. */
function under(g: Background, p: Vec2): [number, number] {
  const h = g.width * 0.5;
  const cx = g.x + g.width / 2;
  const cz = g.z + h / 2;
  const r = -((g.rotation ?? 0) * Math.PI) / 180;
  const dx = p[0] - cx;
  const dz = p[1] - cz;
  return [(cx + dx * Math.cos(r) - dz * Math.sin(r) - g.x) / g.width, (cz + dx * Math.sin(r) + dz * Math.cos(r) - g.z) / h];
}

test("Align to the map is offered in the template section only with a house on the map, on the ground floor", async () => {
  const none = await empty();
  none.updateFloor({ background: { image_id: "plan", x: 0, z: 0, width: 10, opacity: 1 } });
  assert.equal(flat(none.renderBgMapButton(none.floor)), "", "no map, no button");
  const ed = await withPicture();
  const form = flat(ed.renderBgMapButton(ed.floor));
  assert.match(form, /Align to the map/);
  assert.match(form, /Tap two corners in the picture, then the same two on the house from the map/);
  ed._doc.floors.push({ ...newFloor("u", "Up", 5), rooms: [] } as Floor);
  assert.equal(flat(ed.renderBgMapButton(ed._doc.floors[1])), "", "not on an upper floor");
});

test("four taps lay the picture onto the map at once: scaled, turned and moved, in one undo step", async () => {
  const ed = await withPicture();
  const own = ownOutline(ed._doc)!;
  const [c1, c2] = [own[0], own[1]];
  const before = ed.floor.background as Background;
  // two corners of the house in the picture (where the picture shows them now)
  const p1: Vec2 = [3, 2];
  const p2: Vec2 = [9, 5];
  ed._bgMap = [];
  assert.equal(ed.hintText(), t("bg_map_1"));
  tap(ed, p1);
  assert.equal(ed._bgMap.length, 1);
  assert.equal(ed.hintText(), t("bg_map_2"));
  tap(ed, p2);
  assert.equal(ed.hintText(), t("bg_map_3"));
  assert.equal(ed.floor.background, before, "nothing moves before the fourth tap");
  // the third and fourth tap are a little off the corners: they land on them
  tap(ed, [c1[0] + 0.2, c1[1] - 0.15]);
  assert.equal(ed.hintText(), t("bg_map_4"));
  tap(ed, [c2[0] - 0.1, c2[1] + 0.2]);
  assert.equal(ed._bgMap, null, "done");
  const bg = ed.floor.background as Background;
  assert.notDeepEqual(bg, before);
  const k = Math.hypot(c2[0] - c1[0], c2[1] - c1[1]) / Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  assert.ok(Math.abs(bg.width - 20 * k) < 0.02, "scaled by the ratio of the two stretches");
  // the picture points that lay under the two taps lie under the map's two corners now
  const [u1, v1] = under(before, p1);
  const [u2, v2] = under(before, p2);
  const a = lies(bg, u1, v1);
  const b = lies(bg, u2, v2);
  assert.ok(Math.hypot(a[0] - c1[0], a[1] - c1[1]) < 0.03, `the first corner lies on the map's: ${a} vs ${c1}`);
  assert.ok(Math.hypot(b[0] - c2[0], b[1] - c2[1]) < 0.03, `the second corner lies on the map's: ${b} vs ${c2}`);
  ed.undo();
  assert.deepEqual(ed.floor.background, before, "one undo step");
});

test("the note steps aside while a picture is aligned, so it covers no corner to tap", async () => {
  const ed = await withPicture();
  assert.match(flat(ed.renderMapStart(ed.floor)), /<fp3d-map-start/);
  ed._bgMap = [];
  assert.equal(flat(ed.renderMapStart(ed.floor)), "");
  // and so does the empty home's checklist, so the hint bar can say which corner to tap
  assert.equal(ed.startShowing(), false);
  assert.match(flat(ed.renderHint()), /fp3d-hint/);
  assert.match(ed.hintText(), /Tap a corner of the house in the floor-plan picture/);
  ed._bgMap = null;
  assert.equal(ed.startShowing(), true);
  assert.match(flat(ed.renderMapStart(ed.floor)), /<fp3d-map-start/);
});

test("with aligning off, taps on the plan leave the picture alone", async () => {
  const ed = await withPicture();
  const before = ed.floor.background;
  tap(ed, [4, 4]);
  assert.deepEqual(ed.floor.background, before);
  assert.equal(ed._bgMap, null);
});

test("every new text is in English and German, with the same placeholders", () => {
  for (const k of ["map_start_title", "map_start_text", "map_start_load", "map_start_later", "map_start_ready", "map_start_nohouse", "map_start_ok", "bg_map", "bg_map_cancel", "bg_map_hint", "bg_map_1", "bg_map_2", "bg_map_3", "bg_map_4"]) {
    assert.ok(en[k], `en: ${k}`);
    assert.ok(de[k], `de: ${k}`);
    assert.equal((de[k]!.match(/\{[a-z]+\}/g) ?? []).sort().join(), (en[k]!.match(/\{[a-z]+\}/g) ?? []).sort().join(), `${k} placeholders`);
  }
});

test("the template outline is the map's own house turned by the plan's north", async () => {
  const ed = await empty();
  ed.mapStartLoaded(await loadFor(ed));
  const s = ed._doc.settings.surroundings;
  const own = s.buildings[s.own];
  assert.deepEqual(
    own.p.map((p: Vec2) => mapToPlan(s, ed._doc.settings.north, p)),
    ownOutline(ed._doc),
  );
  assert.ok(placeUnderPlan, "the alignment lives in the map bundle");
});
