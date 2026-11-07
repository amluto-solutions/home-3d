// The settings registry (#139): every entry reads, writes and reads back what it wrote, its texts exist in English
// and German, search and deep links find it, and the Settings page draws its row.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { englishTable } from "../i18n.ts";
import { de } from "../german.fixture.ts";
import type { Building } from "../model.ts";
import {
  audienceOf,
  easterEggsOn,

  liveSections,
  mayChange,
  parseSettingsHash,
  searchSettings,
  SECTIONS,
  SETTINGS,
  settingById,
  settingsHash,
  settingsIn,
  shown,
  type DevicePrefs,
  type Setting,
  type SettingsEnv,
} from "./registry.ts";
import { isDevicePrefKey, KEEP_ON_RESET, resetDevicePrefs } from "./reset.ts";
import { sampleBuilding, sampleHass } from "./settings.fixture.ts";

const en = englishTable() as Record<string, string>;
const text = (k: string, vars: Record<string, string | number> = {}) => Object.entries(vars).reduce((s, [n, v]) => s.replace(`{${n}}`, String(v)), en[k] ?? k);
const deTable = de as Record<string, string>;
const SETTINGS_EN = Object.fromEntries(Object.entries(en).filter(([k]) => k.startsWith("st_")));
const SETTINGS_DE = Object.fromEntries(Object.entries(deTable).filter(([k]) => k.startsWith("st_")));

function memoryPrefs(): DevicePrefs & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return { map, get: (k) => map.get(k) ?? null, set: (k, v) => (v === null ? map.delete(k) : map.set(k, v)) };
}

function env(prefs = memoryPrefs()): SettingsEnv {
  return { building: sampleBuilding(), hass: sampleHass(), prefs, lastView: { theta: 1, phi: 0.9, radius: 12 }, remote: {} };
}

/** A value for a setting's control that differs from what it reads now (null: the control writes nothing testable). */
function otherValue(s: Setting, e: SettingsEnv): unknown {
  const now = s.read(e);
  const c = s.control;
  switch (c.kind) {
    case "switch":
      return !now;
    case "number": {
      const lo = c.min ?? 0;
      const hi = c.max ?? lo + 100;
      let v = typeof now === "number" ? now + c.step : lo + c.step;
      if (v > hi) v = lo;
      return Math.round(v * 1000) / 1000;
    }
    case "segment":
    case "select": {
      const opts = typeof c.options === "function" ? c.options(e) : c.options;
      return opts.find((o) => o.value !== now)?.value ?? null;
    }
    case "entity":
      return Object.keys(e.hass!.states).find((id) => c.filter(id, e) && id !== now) ?? null;
    case "text":
      return "Kitchen";
    case "time":
      return "05:30";
    case "hour":
      return now === 5.5 ? 6 : 5.5;
    case "colour":
      return "#123456";
    case "range":
      return c.min === now ? c.max : c.min;
    case "checks":
      return [c.options[0].value];
    case "list":
      return [];
    case "action":
      return c.action === "start_view" ? e.lastView : null;
    case "embed":
      return null;
  }
}

test("every setting has a unique id, a known section and card, and its texts in English and German", () => {
  const ids = new Set<string>();
  for (const s of SETTINGS) {
    assert.ok(!ids.has(s.id), `${s.id} twice`);
    ids.add(s.id);
    const sec = SECTIONS.find((x) => x.id === s.section);
    assert.ok(sec, `${s.id}: section ${s.section}`);
    assert.ok(sec!.cards.some((c) => c.id === s.card), `${s.id}: card ${s.card}`);
    for (const key of [s.label, s.hint].filter((k): k is string => !!k)) {
      if (key.startsWith("st_")) assert.ok(SETTINGS_EN[key] && SETTINGS_DE[key], `${s.id}: ${key}`);
      else assert.ok(en[key] && (de as Record<string, string>)[key], `${s.id}: main text ${key}`);
    }
    if (s.permission === "everyone") assert.equal(s.scope, "device", `${s.id}: only device rows are open to everyone`);
  }
  for (const sec of SECTIONS) for (const key of [sec.title, sec.hint, ...sec.cards.map((c) => c.title)]) assert.ok(SETTINGS_EN[key] && SETTINGS_DE[key], key);
});

test("the page's own texts are complete in German, with the same placeholders", () => {
  const holes = (t: string) => (t.match(/\{[a-z_]+\}/g) ?? []).sort().join();
  for (const [k, v] of Object.entries(SETTINGS_EN)) {
    assert.equal(typeof SETTINGS_DE[k], "string", `de: ${k}`);
    assert.equal(holes(SETTINGS_DE[k]!), holes(v), `de: ${k} placeholders`);
  }
  for (const k of Object.keys(SETTINGS_DE)) assert.ok(k in SETTINGS_EN, `de only: ${k}`);
});

for (const s of SETTINGS) {
  test(`${s.id}: reads its default, writes and reads back`, () => {
    const prefs = memoryPrefs();
    const e = env(prefs);
    const before = JSON.stringify(e.building);
    const now = s.read(e);
    if (s.scope === "device" && s.prefKeys?.length) assert.deepEqual(now, s.default, "an empty browser reads the default");
    if (!s.write) return;
    const value = otherValue(s, e);
    if (value === null && s.control.kind !== "list" && s.control.kind !== "entity") return;
    const result = s.write(e, value as never);
    assert.equal(JSON.stringify(e.building), before, "the plan itself is not changed");
    if (s.scope === "house" && result && typeof result === "object" && "floors" in result) {
      const after = { ...e, building: result as Building };
      assert.deepEqual(s.read(after), value);
    } else if (result && typeof (result as Promise<unknown>).then === "function") {
      // kept outside the plan (pack updates, voice sentences): the page reloads it
    } else {
      assert.equal(s.scope, "device", `${s.id}: a house setting returns the new plan`);
      assert.deepEqual(s.read(e), value);
    }
  });
}

test("search finds settings by label, hint and keyword across sections", () => {
  const e = env();
  const ids = (q: string) => searchSettings(q, e, text).map((s) => s.id);
  assert.ok(ids("ghost").includes("halloween.ghost"));
  assert.ok(ids("ghost").includes("easter_eggs"));
  assert.ok(ids("doorbell").includes("director.doorbell"));
  assert.ok(ids("red camera").includes("effects.camera_seconds"));
  assert.ok(ids("battery").includes("alert_unavailable"));
  assert.deepEqual(ids("  "), []);
  assert.deepEqual(ids("zzz-nothing"), []);
});

test("deep links: #settings/<section>/<id> round-trips, an unknown section or id is dropped", () => {
  assert.equal(settingsHash("warnings", "alert_unavailable"), "#settings/warnings/alert_unavailable");
  assert.deepEqual(parseSettingsHash("#settings/warnings/alert_unavailable"), { section: "warnings", id: "alert_unavailable" });
  assert.deepEqual(parseSettingsHash("#settings"), { section: null, id: null });
  assert.deepEqual(parseSettingsHash("#settings/nope"), { section: null, id: null });
  assert.deepEqual(parseSettingsHash("#settings/nope/effects.camera_seconds"), { section: "cameras", id: "effects.camera_seconds" });
  assert.equal(parseSettingsHash("#other"), null);
  for (const s of SETTINGS) assert.deepEqual(parseSettingsHash(settingsHash(s.section, s.id)), { section: s.section, id: s.id });
});

test("who may change what: device rows anyone, house rows editors, admin rows HA admins", () => {
  const viewer = { editor: false, haAdmin: false };
  assert.equal(mayChange({ permission: "everyone" }, viewer), true);
  assert.equal(mayChange({ permission: "editor" }, viewer), false);
  assert.equal(mayChange({ permission: "editor" }, { editor: true, haAdmin: false }), true);
  assert.equal(mayChange({ permission: "ha_admin" }, { editor: true, haAdmin: false }), false);
  assert.equal(mayChange({ permission: "ha_admin" }, { editor: true, haAdmin: true }), true);
});

test("the easter eggs switch is house-wide and on by default; off hides the ghost's row too", () => {
  assert.equal(easterEggsOn(undefined), true);
  assert.equal(easterEggsOn({}), true);
  assert.equal(easterEggsOn({ easter_eggs: false }), false);
  const e = env();
  const off = settingById("easter_eggs")!.write!(e, false) as Building;
  assert.equal(off.settings.easter_eggs, false);
  assert.equal(shown(settingById("halloween.ghost")!, { ...e, building: off }), false);
  assert.equal(shown(settingById("halloween.ghost")!, e), true);
});

test("each holiday has its own switch, on by default, stored as false when off (#239)", () => {
  const e = env();
  const id = "seasons.christmas";
  assert.equal(settingById(id)!.read(e), true);
  const off = settingById(id)!.write!(e, false) as Building;
  assert.deepEqual(off.settings.seasons, { christmas: false });
  assert.equal(settingById(id)!.read({ ...e, building: off }), false);
  assert.equal(settingById("seasons.easter")!.read({ ...e, building: off }), true, "the others stay on");
  const on = settingById(id)!.write!({ ...e, building: off }, true) as Building;
  assert.deepEqual(on.settings.seasons, {});
  assert.equal(shown(settingById(id)!, { ...e, building: off }), true);
  const noEggs = settingById("easter_eggs")!.write!(e, false) as Building;
  assert.equal(shown(settingById(id)!, { ...e, building: noEggs }), false);
});

test("settings shown only when they apply: the doorbell's entity only with the doorbell on", () => {
  const e = env();
  const bell = settingById("director.doorbell_entity")!;
  assert.equal(shown(bell, e), true);
  const off = settingById("director.doorbell")!.write!(e, false) as Building;
  assert.equal(shown(bell, { ...e, building: off }), false);
  assert.ok(settingsIn("cameras", { ...e, building: off }).every((s) => s.id !== bell.id));
});

test("only sections with settings are listed", () => {
  const sections = liveSections(env()).map((s) => s.id);
  for (const id of sections) assert.ok(settingsIn(id, env()).length > 0);
  assert.ok(sections.includes("general"));
});

test("length rows show and take feet and inches on an imperial plan, metres stay stored (#117)", async () => {
  const { lengthLabel, planUnit, shownLength, typedLength } = await import("./registry.ts");
  const e = env();
  const imperial = { ...e, building: settingById("units")!.write!(e, "imperial") as Building };
  assert.equal(planUnit(imperial), "imperial");
  const lengths = SETTINGS.filter((s) => s.control.kind === "number" && s.control.length).map((s) => s.id);
  assert.deepEqual(lengths.sort(), ["grid", "terrain.level", "wall_exterior", "wall_interior"]);
  // shown: the stored metres in feet and inches, labelled in feet
  const wall = settingById("wall_exterior")!;
  assert.equal(shownLength(imperial, wall.read(imperial) as number), '9.4"');
  assert.equal(lengthLabel(imperial, "Exterior wall (m)"), "Exterior wall");
  // typed: feet and inches go in as metres
  const typed = typedLength(imperial, "1' 2\"");
  assert.ok(typed !== null && Math.abs(typed - 0.3556) < 1e-9);
  const next = wall.write!(imperial, typed as never) as Building;
  assert.ok(Math.abs(next.settings.wall_exterior - 0.3556) < 1e-9);
  assert.equal(shownLength({ ...imperial, building: next }, next.settings.wall_exterior), "1' 2\"");
  const ground = typedLength(imperial, "-4'");
  assert.ok(Math.abs((settingById("terrain.level")!.write!(imperial, ground as never) as Building).settings.terrain!.level! - -1.2192) < 1e-9);
  assert.equal(typedLength(imperial, "a lot"), null);
  // a metric plan keeps plain metres
  assert.equal(shownLength(e, 0.24), "0.24");
  assert.equal(typedLength(e, "0.3"), 0.3);
});

// ---- #198: labels and the device reset tell the truth

test("rows kept by Home Assistant outside the plan carry the install scope, not 'house' (#198)", () => {
  for (const s of SETTINGS) {
    if (s.loader && s.scope !== "device") assert.equal(s.scope, "install", `${s.id}: its value lives outside the plan`);
  }
  assert.equal(SETTINGS.find((s) => s.id === "voice_sentences")?.scope, "install");
  assert.equal(SETTINGS.find((s) => s.id === "pack_updates.frequency")?.scope, "install");
  // said in words since #248 (no badges): the page's sentence or the row's own line
  assert.ok(SETTINGS_EN.st_page_install && SETTINGS_DE.st_page_install && SETTINGS_EN.st_row_install && SETTINGS_DE.st_row_install);
  assert.doesNotMatch(SETTINGS_EN.st_row_install, /saved in the plan/i);
});

function fakeStore(keys: string[]) {
  const m = new Map(keys.map((k) => [k, "x"]));
  return {
    m,
    get length() {
      return m.size;
    },
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
  };
}

test("the device reset removes the toggles written straight to the browser and the time-travel choices, keeping unlocks and drafts (#198)", () => {
  const store = fakeStore([
    "home3d.flows", "home3d.holos", "home3d.solarDim", "home3d.sidePinned", "home3d.sideWidth", "home3d.sideMin", "home3d.thumbs_compact",
    "home3d.editorSplit", "home3d.lib.open", "home3d.card_walls", "home3d.wallRecent", "fp3d-tt-follow", "fp3d-tt-stop", "fp3d-tt-closed",
    "home3d.lab", "home3d.projection", "home3d.unsaved", "home3d.unsaved.h1", "home3d.home.u1", "unrelated", "floorplan-3d.unsaved",
  ]);
  resetDevicePrefs(store);
  assert.deepEqual([...store.m.keys()].sort(), ["floorplan-3d.unsaved", "home3d.home.u1", "home3d.lab", "home3d.projection", "home3d.unsaved", "home3d.unsaved.h1", "unrelated"]);
});

test("every home3d.* or fp3d-tt-* key the code writes is removed by the reset unless it is on the keep list (#198)", () => {
  const root = fileURLToPath(new URL("..", import.meta.url));
  const found = new Set<string>();
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.ts$/.test(e.name) && !/\.(test|fixture)\.ts$/.test(e.name)) for (const m of readFileSync(p, "utf8").matchAll(/"((?:home3d\.|fp3d-tt-)[A-Za-z0-9_.-]+)"/g)) found.add(m[1]);
    }
  };
  walk(root);
  assert.ok(found.has("home3d.flows") && found.has("home3d.sideWidth"), "the scan finds the direct keys");
  for (const k of found) {
    const kept = KEEP_ON_RESET.some((x) => (x.endsWith(".") ? k.startsWith(x) : k === x));
    assert.equal(isDevicePrefKey(k), !kept, `${k}`);
  }
  // the time-travel keys are built as `fp3d-tt-${key}`: the prefix covers them
  assert.ok(isDevicePrefKey("fp3d-tt-anything"));
  for (const k of ["home3d.mic"]) assert.ok(isDevicePrefKey(k));
});

// ---- Screen and controls (#246) ----

test("Screen and controls holds the old View menu's Controls row and FPS, Appearance its Quality, under the same stored keys (#246, #248)", () => {
  const screen = SETTINGS.filter((s) => s.section === "screen");
  assert.deepEqual(
    screen.map((s) => s.id).filter((id) => id !== "director_here" && id !== "reset_device"),
    // the floor bar's wrap switch went with the room chips (#249, Rooms picker option B); the floor pictures panel's
    // switch came (#250)
    ["stats", "controls", "keep_view", "angle_lock", "floor_pictures"],
  );
  // Quality sits on Appearance, as drawn (#248)
  assert.equal(settingById("quality")!.section, "look");
  assert.deepEqual(settingById("quality")!.prefKeys, ["quality"]);
  assert.equal(audienceOf(SECTIONS.find((s) => s.id === "screen")!), "device");
  for (const s of screen) {
    assert.equal(s.scope, "device", s.id);
    if (s.id !== "director_here" && s.id !== "reset_device") assert.deepEqual(s.prefKeys, [s.id], `${s.id} keeps its key`);
  }
  // device-only rows that sat under This home moved here (#295), the old places keep a link
  assert.deepEqual(settingById("director_here")!.prefKeys, ["director"]);
  assert.equal(settingById("director_here")!.section, "screen");
  assert.equal(settingById("reset_device")!.section, "screen");
  // full labels, no glyphs
  assert.equal(text(settingById("controls")!.label), "On-screen buttons");
  assert.equal(text(settingById("keep_view")!.label), "Keep the camera when changing floor");
  assert.equal(text(settingById("angle_lock")!.label), "Lock the viewing angle");
  assert.equal(text(settingById("stats")!.label), "Show the frame rate (FPS)");
  assert.equal(text(settingById("quality")!.label), "Quality");
  for (const s of screen) assert.ok(!/[◧◨⌖🔒📌]/u.test(text(s.label)), s.id);
  // and nowhere else any more
  for (const id of ["quality", "stats", "controls", "keep_view", "angle_lock"]) assert.equal(SETTINGS.filter((s) => s.id === id).length, 1);
  assert.ok(!SETTINGS.some((s) => s.section === "look" && ["controls", "keep_view", "angle_lock"].includes(s.id)));
  assert.ok(!SETTINGS.some((s) => s.section === "advanced" && s.id === "stats"));
});

test("an old deep link to a moved row still finds its row (#246, #248)", () => {
  assert.deepEqual(parseSettingsHash("#settings/look/quality"), { section: "look", id: "quality" });
  assert.deepEqual(parseSettingsHash("#settings/screen/quality"), { section: "look", id: "quality" });
  assert.deepEqual(parseSettingsHash("#settings/x/keep_view"), { section: "screen", id: "keep_view" });
  assert.equal(searchSettings("frame rate", env(), text)[0]?.id, "stats");
});

test("Start view is a labelled row for the whole home: house scope, editors only, no pin glyph (#246)", () => {
  const s = settingById("start_view")!;
  assert.equal(s.scope, "house");
  assert.equal(s.permission, "editor");
  assert.equal(text(s.label), "Start view");
  assert.match(text(s.hint!), /whole home/);
  assert.equal(searchSettings("remember start", env(), text)[0]?.id, "start_view");
});

test("no This home page holds a device setting; only link rows point to where one moved (#295)", () => {
  for (const s of SETTINGS) {
    if (audienceOf(SECTIONS.find((x) => x.id === s.section)!) !== "home" || s.scope !== "device") continue;
    assert.ok(s.control.kind === "action" && s.control.action.startsWith("goto:"), `${s.id} is a device row on a This home page`);
    const [section, id] = s.control.action.slice(5).split(":");
    assert.equal(audienceOf(SECTIONS.find((x) => x.id === section)!), "device", `${s.id} points to a This device page`);
    assert.equal(settingById(id!)!.section, section);
  }
});

test("the feet-and-inches typing tip shows only when lengths show in feet and inches (#324)", async () => {
  const { planUnit } = await import("./registry.ts");
  const e = env();
  const s = settingById("units")!;
  assert.equal(s.hintImperial, "units_tip");
  const metric = { ...e, building: s.write!(e, "metric") as Building };
  assert.equal(planUnit(metric), "metric");
  assert.equal(planUnit(e), "metric");
  const imperial = { ...e, building: s.write!(e, "imperial") as Building };
  assert.equal(planUnit(imperial), "imperial");
  assert.ok(!(englishTable() as Record<string, string>)[s.hint!].includes("8' 2"));
});

test("Ground height is under Plan and units, keeps its stored key and its default shows in the Lengths format (#325)", async () => {
  const { shownLength } = await import("./registry.ts");
  const s = settingById("terrain.level")!;
  assert.equal(s.section, "general");
  assert.equal(s.card, "plan");
  assert.equal((englishTable() as Record<string, string>)[s.label], "Ground height");
  const e = env();
  const imperial = { ...e, building: settingById("units")!.write!(e, "imperial") as Building };
  assert.equal(shownLength(imperial, s.default as number), '-7.9"');
  assert.equal(shownLength(e, s.default as number), "-0.2");
  const next = s.write!(e, -1 as never) as Building;
  assert.equal(next.settings.terrain!.level, -1);
});

test("the room climate setting says what each choice does on the view (#331)", () => {
  const s = settingById("heat")!;
  const en = englishTable() as Record<string, string>;
  assert.equal(s.control.kind, "select");
  const labels = (s.control as { options(e: unknown): { value: string; label: string }[] }).options(env()).map((o) => en[o.label]);
  assert.deepEqual(labels, ["Nothing", "Floor colour: temperature", "Floor colour: humidity", "Floor colour: CO₂", "Numbers at the room names"]);
  assert.equal(en[s.label], "Show room climate as");
  assert.ok(s.hint && /colour scale/.test(en[s.hint]) && /instead/.test(en[s.hint]));
  assert.deepEqual(s.prefKeys, ["heat"], "the stored key is unchanged");
});

test("the two device switches are named after their feature, not after being switched on (#334)", () => {
  const en = englishTable() as Record<string, string>;
  assert.equal(en[settingById("director_here")!.label], "Live director on this screen");
  assert.equal(en[settingById("voice_here")!.label], "Voice button on this screen");
  assert.equal(en.director_here, "Live director on this screen");
  assert.equal(en.voice_here, "Voice button on this screen");
  for (const v of Object.values(en)) assert.ok(!/Switch on on this/.test(v), "no label of that old kind is left");
});
