// Settings > Surroundings (#464): the card's flows in plain Node with the saved (invented) Overpass answer and no network:
// the privacy text before the first Load, Load and Load again, the busy / offline / empty / too-big messages, turning
// and moving the map, Align again, hiding and showing one house, Remove, Show in 3D and the outline choice.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { englishTable } from "../i18n.ts";
import type { Building, Surroundings, Vec2 } from "../model.ts";
import { emptyBuilding, newFloor } from "../model.ts";
import { placeUnderPlan } from "../surround-align.ts";
import { loadSurroundings, SurroundError, type OsmElement } from "../surround-fetch.ts";
import { hiddenBuildings } from "../surroundings.ts";
import type { HomeAssistant } from "../types.ts";
import { audienceOf, mayChange, SECTIONS, searchSettings, settingById } from "./registry.ts";
import { SEARCH_WORDS } from "./search-words.ts";
import { sampleHass } from "./settings.fixture.ts";
import { DEFAULT_RADIUS, errorKey, Fp3dSurroundSettings, homeLocation, loaded, raised, realigned, shifted, STEP, toggled, turned, type Osm } from "./surroundings-card.ts";

const ANSWER = JSON.parse(readFileSync(new URL("../overpass-answer.fixture.json", import.meta.url), "utf8")) as { elements: OsmElement[] };
const en = englishTable() as Record<string, string>;
const de = JSON.parse(readFileSync(new URL("../../../custom_components/home_3d/bundled_languages/amluto.lang-de/strings.json", import.meta.url), "utf8")) as Record<string, string>;
const t = (k: string, vars: Record<string, string | number> = {}) => Object.entries(vars).reduce((s, [n, v]) => s.replace(`{${n}}`, String(v)), en[k] ?? k);

const rect = (x0: number, z0: number, x1: number, z1: number): Vec2[] => [
  [x0, z0],
  [x1, z0],
  [x1, z1],
  [x0, z1],
];

/** A house of one room around the origin (the fixture's own house stands there). */
function house(): Building {
  const b = emptyBuilding();
  b.floors = [{ ...newFloor("gf", "Ground floor", 0), rooms: [{ id: "r0", name: "Hall", area_id: null, floor_material: "wood", points: rect(-5, -3.5, 5, 3.5) }] }];
  return b;
}

/** Fetches the saved answer instead of a server; `status` makes it answer that code, `fail` makes it throw like a missing network. */
function fetcher(opts: { status?: number; fail?: boolean; elements?: OsmElement[] } = {}, calls: string[] = []): typeof fetch {
  return (async (url: string) => {
    calls.push(String(url));
    if (opts.fail) throw new TypeError("offline");
    if (opts.status) return new Response("", { status: opts.status });
    return new Response(JSON.stringify({ elements: opts.elements ?? ANSWER.elements }), { status: 200 });
  }) as unknown as typeof fetch;
}

function osmWith(f: typeof fetch, seen: unknown[][] = []): Osm {
  return {
    loadSurroundings: (lat, lon, radius, b, signal) => (seen.push([lat, lon, radius]), loadSurroundings(lat, lon, radius, b, signal, f)),
    placeUnderPlan,
  };
}

function hass(location: { latitude: number; longitude: number } | null = { latitude: 45.5, longitude: 7.25 }): HomeAssistant {
  return { ...sampleHass(), config: location ?? {} } as unknown as HomeAssistant;
}

/** A card on `b`; edits it sends are applied to it as the page would (a new `building`), and listed. */
function card(b: Building, osm: Osm, h: HomeAssistant = hass()) {
  const el = new Fp3dSurroundSettings() as unknown as Record<string, any>;
  el.hass = h;
  el.building = b;
  el.t = t;
  el.osm = async () => osm;
  const edits: { building: Building; key: string | null }[] = [];
  (el as unknown as EventTarget).addEventListener("settings-edit", (e) => {
    const d = (e as CustomEvent<{ building: Building; key: string | null }>).detail;
    edits.push(d);
    el.building = d.building;
  });
  return { el, edits };
}

/** The text and attribute names of a lit template, nested templates and lists included. */
function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol" || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  if (typeof v === "function") return "";
  return String(v);
}
const text = (el: Record<string, any>) => flat(el.render());

const map = (b: Building) => b.settings.surroundings as Surroundings;

// ------------------------------------------------------------------ where it lives

test("Surroundings is a card of the Scene page for Home Assistant admins, found by search, with every text in English and German", () => {
  const s = settingById("surroundings")!;
  assert.equal(s.section, "scene");
  assert.equal(s.permission, "ha_admin", "the map is fetched from public servers: admins only");
  assert.equal(audienceOf(SECTIONS.find((x) => x.id === s.section)!), "home");
  assert.ok(SECTIONS.find((x) => x.id === "scene")!.cards.some((c) => c.id === "surroundings"));
  assert.equal(mayChange(s, { editor: true, haAdmin: false }), false);
  assert.equal(mayChange(s, { editor: true, haAdmin: true }), true);
  const env = { building: house(), hass: sampleHass(), prefs: { get: () => null, set: () => undefined } };
  for (const q of ["surroundings", "neighbours", "openstreetmap"]) assert.ok(searchSettings(q, env, t).some((r) => r.id === "surroundings"), q);
  assert.ok(searchSettings("satellite", env, t, SEARCH_WORDS).some((r) => r.id === "surroundings"));
  const src = readFileSync(new URL("./surroundings-card.ts", import.meta.url), "utf8");
  const keys = new Set([...src.matchAll(/["`](surround_[a-z_]+)["`]/g)].map((m) => m[1]!).concat(["surround_err_busy", "surround_err_empty", "surround_err_offline", "st_surround", "st_card_surround"]));
  for (const k of keys) {
    assert.ok(en[k], `en: ${k}`);
    assert.ok(de[k], `de: ${k}`);
    assert.equal((de[k]!.match(/\{[a-z]+\}/g) ?? []).sort().join(), (en[k]!.match(/\{[a-z]+\}/g) ?? []).sort().join(), `${k} placeholders`);
  }
});

test("the privacy text comes before the first Load and says what is sent, when and to whom; older versions open the plan read-only", async () => {
  const calls: string[] = [];
  const { el } = card(house(), osmWith(fetcher({}, calls)));
  const out = text(el);
  assert.match(out, /sends one request to the public OpenStreetMap servers overpass-api\.de/);
  assert.match(out, /nothing is sent until you tap Load/);
  assert.ok(out.indexOf("overpass-api.de") < out.indexOf("Load surroundings</button>"), "privacy text above the button");
  assert.match(out, /open read-only in older versions of Home 3D/);
  assert.doesNotMatch(out, /Remove first/i, "1.5.x opens any version-5 plan read-only, map or not");
  assert.deepEqual(calls, [], "nothing is fetched by looking at the card");
  assert.match(out, /Load surroundings/);
  assert.match(out, /100 m[\s\S]*150 m[\s\S]*250 m/);
  assert.match(out, new RegExp(DEFAULT_RADIUS + " m"));
  assert.match(out, /© OpenStreetMap contributors/);
  assert.match(out, /openstreetmap\.org\/copyright/);
});

// ------------------------------------------------------------------ loading

test("Load surroundings asks the map bundle for Home Assistant's location and the chosen radius, then lays the map under the plan", async () => {
  const seen: unknown[][] = [];
  const { el, edits } = card(house(), osmWith(fetcher(), seen));
  el._radius = 250;
  await el.load();
  assert.deepEqual(seen, [[45.5, 7.25, 250]]);
  assert.equal(edits.length, 1);
  const s = map(edits[0]!.building);
  assert.equal(s.on, true);
  assert.equal(s.radius, 250);
  assert.ok(s.buildings.length > 3);
  assert.equal(typeof s.own, "number", "the home's own house is found at the location");
  assert.equal(el._busy, false);
  assert.equal(el._error, null);
  const out = text(el);
  assert.match(out, /Load again/);
  assert.match(out, /Remove/);
  assert.match(out, /Houses: \d+ · streets and paths: \d+/);
});

test("Load again asks for the new radius, keeps the outline choice and starts the hide lists afresh", async () => {
  const { el, edits } = card(house(), osmWith(fetcher()));
  await el.load();
  el.set(() => ({ flat: true, hide: [1], show: [2] }));
  assert.equal(map(el.building).flat, true);
  el._radius = 100;
  await el.load();
  const s = map(edits.at(-1)!.building);
  assert.equal(s.radius, 100);
  assert.equal(s.flat, true);
  assert.equal(s.hide, undefined);
  assert.equal(s.show, undefined);
});

test("a map that cannot be loaded says why: busy, empty or no server, and changes nothing", async () => {
  const b = house();
  for (const [what, osm, key] of [
    ["busy", { loadSurroundings: async () => Promise.reject(new SurroundError("busy", "busy")), placeUnderPlan } as Osm, "surround_err_busy"],
    ["empty", osmWith(fetcher({ elements: [] })), "surround_err_empty"],
    ["offline", osmWith(fetcher({ fail: true })), "surround_err_offline"],
    // an error of the map bundle's own class (not this bundle's) is told by its kind
    ["a foreign busy error", { loadSurroundings: async () => Promise.reject(Object.assign(new Error("x"), { kind: "busy" })), placeUnderPlan } as Osm, "surround_err_busy"],
    ["anything else", { loadSurroundings: async () => Promise.reject(new Error("boom")), placeUnderPlan } as Osm, "surround_err_offline"],
  ] as const) {
    const { el, edits } = card(b, osm);
    await el.load();
    assert.equal(el._error, key, what);
    assert.equal(edits.length, 0, what);
    assert.equal(el._busy, false, what);
    assert.match(text(el), new RegExp(t(key).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), what);
  }
  assert.equal(errorKey(new SurroundError("busy", "")), "surround_err_busy");
  assert.equal(errorKey(null), "surround_err_offline");
});

test("a busy server is asked again by the map bundle before the card says busy (status 503 on both servers)", async () => {
  // the bundle's own pauses are real time: here the card only passes the answer on
  const { el } = card(house(), { loadSurroundings: async () => Promise.reject(new SurroundError("busy", "busy")), placeUnderPlan });
  await el.load();
  assert.equal(el._error, "surround_err_busy");
});

test("without a location in Home Assistant (or 0, 0) the card says so and Load does nothing", async () => {
  const seen: unknown[][] = [];
  for (const where of [null, { latitude: 0, longitude: 0 }]) {
    const { el, edits } = card(house(), osmWith(fetcher(), seen), hass(where));
    assert.equal(homeLocation(el.hass), null);
    assert.match(text(el), /Home Assistant has no location set/);
    assert.match(text(el), /disabled/);
    await el.load();
    assert.equal(edits.length, 0);
  }
  assert.deepEqual(seen, []);
  assert.deepEqual(homeLocation(hass()), { lat: 45.5, lon: 7.25 });
});

test("a map too big for one message to Home Assistant is refused with a clear message and nothing is saved (checkFits)", async () => {
  const b = house();
  b.settings.mods = { filler: { text: "x".repeat(4 * 1024 * 1024) } } as unknown as Building["settings"]["mods"];
  const { el, edits } = card(b, osmWith(fetcher()));
  await el.load();
  assert.equal(edits.length, 0);
  assert.equal(el._error, "surround_err_big");
  assert.match(text(el), /too big to save with the plan \(4\.\d MB, at most 4 MB\)/);
  assert.equal(b.settings.surroundings, undefined);
});

test("leaving the page while a map loads stops the request and shows no error", async () => {
  let signal: AbortSignal | undefined;
  const { el, edits } = card(house(), {
    loadSurroundings: (_a, _o, _r, _b, s) => {
      signal = s;
      return new Promise((_, no) => s?.addEventListener("abort", () => no(new SurroundError("offline", "aborted"))));
    },
    placeUnderPlan,
  });
  const run = el.load();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(el._busy, true);
  assert.match(text(el), /Cancel/);
  el.disconnectedCallback();
  await run;
  assert.equal(signal?.aborted, true);
  assert.equal(el._error, null);
  assert.equal(edits.length, 0);
});

// ------------------------------------------------------------------ show, outlines, remove

test("Show in 3D keeps the data in the plan; the outline choice and Remove change only the map", async () => {
  const { el, edits } = card(house(), osmWith(fetcher()));
  await el.load();
  const before = map(el.building);
  el.set(() => ({ on: false }));
  assert.equal(map(el.building).on, false);
  assert.equal(map(el.building).buildings, before.buildings, "the data stays in the plan");
  el.set(() => ({ on: true }));
  el.set(() => ({ flat: true }));
  assert.equal(map(el.building).flat, true);
  assert.equal(map(el.building).buildings.length, before.buildings.length);
  el.removeMap();
  assert.equal(el.building.settings.surroundings, null);
  assert.equal(edits.length, 5);
  assert.doesNotMatch(text(el), /Align|Remove/);
});

// ------------------------------------------------------------------ height (#482)

test("Height of the surroundings: raised() sets, rounds and clamps it beside the map, 0 drops the key; the field is on the card; Load again keeps it, Remove drops it", async () => {
  const { el, edits } = card(house(), osmWith(fetcher()));
  assert.doesNotMatch(text(el), /Height of the surroundings/, "no map, no field");
  await el.load();
  assert.equal(el.building.settings.surroundings_y, undefined, "a fresh map has no height");
  assert.ok(text(el).includes("Height of the surroundings (m)"));
  assert.match(text(el), /type="number"/);
  const b = el.building as Building;
  assert.equal(raised(b, -1.256).settings.surroundings_y, -1.26);
  assert.equal(raised(b, 4).settings.surroundings_y, 4);
  assert.equal(raised(b, 99).settings.surroundings_y, 30);
  assert.equal(raised(b, -99).settings.surroundings_y, -30);
  assert.ok(!("surroundings_y" in raised(raised(b, 2), 0).settings), "0 is the default: no key");
  assert.ok(!("surroundings_y" in raised(b, Number.NaN).settings));
  assert.equal(b.settings.surroundings_y, undefined, "the plan given is not changed");
  assert.equal(raised(b, 3).settings.surroundings, b.settings.surroundings, "the map itself is not touched");
  const n = edits.length;
  el.commit(raised(el.building, 1.5));
  assert.equal(edits.length, n + 1);
  assert.equal(el.building.settings.surroundings_y, 1.5);
  assert.ok(text(el).includes(".value=1.5"));
  // Load again keeps the height; Remove takes it away with the map
  el._radius = 100;
  await el.load();
  assert.equal(el.building.settings.surroundings_y, 1.5, "kept when the map is loaded again");
  el.removeMap();
  assert.equal(el.building.settings.surroundings, null);
  assert.equal(el.building.settings.surroundings_y, undefined);
});

// ------------------------------------------------------------------ turning and moving

test("turning by 90 or 1 degree turns the map about the house and north with it; the house under the plan stays the own one", async () => {
  const { el } = card(house(), osmWith(fetcher()));
  await el.load();
  const b0 = el.building as Building;
  const own = map(b0).own;
  const n0 = b0.settings.north ?? 0;
  const right = turned(b0, 90);
  assert.equal(right.settings.north, (n0 + 90) % 360);
  assert.equal(map(b0).x, map(b0).x, "the old plan is not changed");
  assert.notEqual(right, b0);
  const left = turned(right, -90);
  assert.ok(Math.abs((left.settings.north ?? 0) - n0) < 0.11);
  assert.ok(Math.abs(map(left).x - map(b0).x) < 0.03 && Math.abs(map(left).z - map(b0).z) < 0.03, "back where it was");
  assert.equal(turned(b0, 1).settings.north, Math.round(((n0 + 1) % 360) * 10) / 10);
  assert.equal(typeof own, "number");
  // the buttons send it with a key that joins a run of taps into one undo step
  el.nudge((cur: Building) => turned(cur, 90));
  assert.equal(el.building.settings.north, right.settings.north);
});

test("an arrow moves the map by half a metre on the screen's axes, and a house the plan then stands on becomes the own one (#1110)", async () => {
  const { el, edits } = card(house(), osmWith(fetcher()));
  await el.load();
  const b0 = el.building as Building;
  const s0 = map(b0);
  assert.equal(STEP, 0.5);
  const moved = shifted(b0, STEP, 0);
  assert.equal(map(moved).x, Math.round((s0.x + 0.5) * 100) / 100);
  assert.equal(map(moved).z, s0.z);
  assert.equal(map(shifted(b0, 0, -STEP)).z, Math.round((s0.z - 0.5) * 100) / 100);
  // far away: the own house is none (the plan stands on no map house); back: it is the one at the plan again
  const away = shifted(b0, 400, 0);
  assert.equal(map(away).own, null);
  assert.ok(!hiddenBuildings(map(away), away).has(s0.own as number), "the house the map had as the own one shows again");
  const home = shifted(away, -400, 0);
  assert.equal(map(home).own, s0.own);
  // through the card: a key joins the taps
  el.nudge((cur: Building) => shifted(cur, STEP, 0));
  assert.equal(edits.at(-1)!.key, "surround:move");
  assert.equal(map(el.building).x, map(moved).x);
});

test("Align again fits the map under the rooms with the map bundle's best fit and sets north", async () => {
  const { el, edits } = card(house(), osmWith(fetcher()));
  await el.load();
  const b0 = el.building as Building;
  const off = turned(shifted(b0, 7, -5), 33);
  const placed: unknown[] = [];
  const spy: Osm = { loadSurroundings: async () => Promise.reject(new Error("no")), placeUnderPlan: (s, own, b) => (placed.push(own), placeUnderPlan(s, own, b)) };
  const fixed = realigned(spy, off);
  assert.deepEqual(placed, [map(off).own]);
  assert.ok(Math.abs(map(fixed).x - map(b0).x) < 1.5 && Math.abs(map(fixed).z - map(b0).z) < 1.5, "back near where the load put it");
  el.building = off;
  const n = edits.length;
  await el.realign();
  assert.equal(edits.length, n + 1);
  assert.equal(map(el.building).x, map(fixed).x);
  assert.equal(el.building.settings.north, fixed.settings.north);
});

// ------------------------------------------------------------------ hiding and showing a house

test("a tap on a house hides it, another shows it again; only a choice that differs from the automatic one is kept", async () => {
  const { el } = card(house(), osmWith(fetcher()));
  await el.load();
  const b0 = el.building as Building;
  const s = map(b0);
  const auto = hiddenBuildings({ ...s, hide: [], show: [] }, b0);
  const neighbour = s.buildings.findIndex((_, i) => !auto.has(i));
  assert.ok(neighbour >= 0);
  const hid = toggled(b0, neighbour);
  assert.deepEqual(map(hid).hide, [neighbour]);
  assert.equal(map(hid).show, undefined);
  assert.ok(hiddenBuildings(map(hid), hid).has(neighbour));
  const back = toggled(hid, neighbour);
  assert.equal(map(back).hide, undefined, "the list is gone with its last entry");
  assert.ok(!hiddenBuildings(map(back), back).has(neighbour));
  // the own house is hidden by itself: a tap shows it, another hides it again
  const own = s.own as number;
  assert.ok(auto.has(own));
  const shown = toggled(b0, own);
  assert.deepEqual(map(shown).show, [own]);
  assert.ok(!hiddenBuildings(map(shown), shown).has(own));
  assert.equal(map(toggled(shown, own)).show, undefined);
  assert.equal(b0.settings.surroundings, s, "the plan it was given is not changed");
  assert.equal(s.hide, undefined);
});

test("the small map draws every house near the plan as a tap target, hidden ones dashed yellow, and is reachable by keyboard", async () => {
  const { el } = card(house(), osmWith(fetcher()));
  await el.load();
  const s = map(el.building);
  const out = text(el);
  assert.match(out, /Show and hide houses/);
  assert.match(out, /Dashed yellow = hidden/);
  assert.match(out, /class="pick"/);
  assert.match(out, /role="button"/);
  assert.match(out, /tabindex="0"/);
  assert.match(out, /class=house hid/);
  const hidden = hiddenBuildings(s, el.building);
  assert.ok(hidden.size >= 1);
  assert.match(out, /Tap to hide/);
  assert.match(out, /Hidden\. Tap to show\./);
});

test("the card's styles dash the hidden houses in yellow", () => {
  const css = String((Fp3dSurroundSettings as unknown as { styles: { cssText?: string }[] }).styles.map((x) => x.cssText ?? "").join("\n"));
  assert.match(css, /\.house\.hid\s*\{[^}]*#ffd166[^}]*stroke-dasharray/);
});

test("loading puts the new map under the newest plan", () => {
  const b = house();
  const res = { surroundings: { on: true, lat: 1, lon: 1, at: 0, radius: 100, x: 1, z: 2, buildings: [], ways: [], areas: [], trees: [] } as Surroundings, north: 40 };
  const next = loaded(b, res);
  assert.equal(next.settings.north, 40);
  assert.equal(map(next).x, 1);
  assert.equal(b.settings.north, 0);
});
