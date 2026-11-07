// Part 5 of the menus and settings redesign (#250, drawings signed off on #219): the phone editor. A bottom bar (Select,
// Build, Furniture, Undo, Redo, More) with roving focus, the floor menu as a floating chip, a details sheet with peek,
// half and full heights, a one-line hint only while nothing is chosen, Android's back gesture closing the sheet, a
// menu, then the View panel; and the "Show the floor pictures panel" switch in Settings › Screen and controls.
// The owner's decision: a phone is for quick changes first, but every change the desktop can make must be reachable
// on a phone at 390 px, even if slower. The first test proves it for every control of the desktop toolbar.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { css, html, LitElement, nothing } from "lit";
import { emptyBuilding, newFloor } from "./model.ts";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";

// a page with a history the back stack can use: pushState adds an entry, back() pops one and fires popstate
const listeners: ((e: { state: unknown }) => void)[] = [];
const entries: unknown[] = [null];
g.window ??= {};
Object.assign(g.window as object, {
  addEventListener: (type: string, fn: (e: { state: unknown }) => void) => type === "popstate" && listeners.push(fn),
  removeEventListener: () => undefined,
});
g.location = { search: "", hash: "", pathname: "/home_3d" };
const history = {
  get state() {
    return entries[entries.length - 1];
  },
  pushState: (state: unknown) => void entries.push(state),
  replaceState: (state: unknown) => void (entries[entries.length - 1] = state),
  back: () => {
    entries.pop();
    for (const fn of listeners) fn({ state: history.state });
  },
};
g.history = history;

const { Fp3dEditor } = (await import("./components/editor.ts")) as unknown as { Fp3dEditor: new () => Record<string, any> };
const { definePhoneBar, BUILD_TOOLS } = await import("./components/editor/phone-bar.ts");
const { uiIcon } = await import("./ui-icons.ts");
const { defineElement } = await import("./define.ts");
const { openBackLayer, BackLayers } = await import("./back-stack.ts");
const { settingById, SETTINGS } = await import("./settings/registry.ts");
const { englishTable } = await import("./i18n.ts");
const { touchWording } = await import("./editor-hint.ts");

const PhoneBar = definePhoneBar({ LitElement, html, css, nothing, uiIcon, defineElement }) as unknown as new () => Record<string, any>;
const en = englishTable() as Record<string, string>;
const src = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol" || typeof v === "boolean") return "";
  if (typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(v);
}

/** A phone-wide editor (390 px) with two floors, a kitchen, a garden, a lamp and a placed device. */
function editor(): Record<string, any> {
  const b = emptyBuilding();
  const ground = newFloor("f1", "Ground", 0);
  ground.rooms.push({ id: "k", name: "Kitchen", area_id: null, points: [[0, 0], [5, 0], [5, 4], [0, 4]], floor_material: "wood" } as never);
  ground.outdoor.push({ id: "lawn", type: "lawn", area_id: "garden", name: "Garden", points: [[-5, -5], [10, -5], [10, 10], [-5, 10]] } as never);
  ground.furniture.push({ id: "lamp", type: "lamp_floor", x: 1, z: 1, rotation: 0, w: 0.4, d: 0.4, h: 1.6, variant: null, entity: null, power: null } as never);
  ground.placements.push({ entity_id: "light.sample_lounge", x: 2, z: 2, y: null, mount: null } as never);
  const upper = newFloor("f2", "Upper", 2.5);
  b.floors.push(ground, upper);
  const el = new Fp3dEditor();
  el.hass = { states: {}, areas: {}, user: { is_admin: true }, language: "en", locale: { language: "en" } };
  el._doc = b;
  el._floorId = "f1";
  el.canEdit = true;
  el._size = { w: 390, h: 640 };
  el._view = { scale: 40, ox: 0, oy: 0 };
  el._phone = true;
  el._sheeted = true;
  return el;
}

/** The bottom bar as the editor hands it its state (renderPhoneBar). */
function bar(el: Record<string, any>): Record<string, any> {
  const b = new PhoneBar();
  Object.assign(b, { ed: el, tool: el._tool, menu: el._toolMenu, canUndo: el._canUndo, canRedo: el._canRedo, split: el._split, wallPick: el._wallPick, hasFloor: !!el.floor, editable: el.isEditor, outside: el.hasOutside(el.floor), lang: "en" });
  return b;
}

/** Runs a bar button or More row by its id; returns the editor afterwards. */
function press(el: Record<string, any>, id: string): Record<string, any> {
  const b = bar(el);
  const hit = [...b.buttons(), ...b.moreRows()].find((x: { id: string }) => x.id === id);
  assert.ok(hit, `${id} is on the bar or in More`);
  assert.ok(!hit.disabled, `${id} can be pressed`);
  // the bar hands itself to Wall view, which places its tip by it (a page element in the browser)
  Object.assign(b, { closest: () => null, getBoundingClientRect: () => ({ left: 0, top: 0, width: 60, height: 60, bottom: 60 }) });
  hit.run();
  return el;
}

// ---- every editor action reachable at 390 px (the owner's decision)

test("every control of the desktop toolbar and its menus is reachable on a phone: the bar, More, the Build and Outside menus, the floor chip", () => {
  const el = editor();
  // the pool module's "Draw a pipe" is in the Outside menu when the extension is there: on a phone too
  Object.defineProperty(el, "pipeRules", { get: () => ({}) });
  // what a phone shows: the bar's buttons, More's rows, the toolbar's own menus (drawn as sheets above the bar) and
  // the floor chip with its menu
  const b = bar(el);
  let phone = [...b.buttons(), ...b.moreRows()].map((x: { label: string; sub?: string }) => `${x.label} ${x.sub ?? ""}`).join(" | ");
  for (const menu of ["build", "outside", "floor"]) {
    el._toolMenu = menu;
    for (const open of [null, "rect", "outdoor", "pool"]) {
      el._toolOpen = open;
      el._floorMenu = true;
      phone += flat(el.renderToolBar(el.floor)) + flat(el.renderFloorMenu());
    }
  }
  el._toolMenu = null;
  // every label the desktop toolbar and its More menu use (their text keys, read from the source)
  const toolbar = src("./components/editor/toolbar.ts");
  const body = toolbar.slice(toolbar.indexOf("renderToolBar(this"), toolbar.indexOf("renderSettingsLink(this"));
  const keys = new Set([...body.matchAll(/this\.t\("([a-z0-9_]+)"/g)].map((m) => m[1]!));
  // tooltips and the group's own name repeat a label that is checked
  for (const k of ["tools", "fit_hint", "split_3d_hint", "wall_view_open"]) keys.delete(k);
  assert.ok(keys.size >= 14, `${keys.size} toolbar labels`);
  for (const k of keys) assert.ok(phone.includes(en[k]!), `${k} ("${en[k]}") is reachable on a phone`);
  // the floor menu: every floor, Add floor (from Home Assistant or empty), Floor settings
  for (const w of ["Ground", "Upper", en.add_floor, en.floor_settings]) assert.ok(phone.includes(w), w);
});

test("each bar button and More row does what the desktop control does", () => {
  const calls: string[] = [];
  const el = editor();
  for (const m of ["undo", "redo", "fit", "toggleSplit", "openSettings"]) {
    const orig = el[m];
    el[m] = (...a: unknown[]) => (calls.push(`${m}${a.length ? `:${JSON.stringify(a)}` : ""}`), m === "openSettings" ? undefined : orig?.apply?.(el, a));
  }
  el._canUndo = true;
  el._canRedo = true;
  press(el, "build");
  assert.equal(el._toolMenu, "build", "Build opens the toolbar's Build menu");
  press(el, "build");
  assert.equal(el._toolMenu, null);
  press(el, "furniture");
  assert.equal(el._tool, "furniture");
  press(el, "select");
  assert.equal(el._tool, "select");
  press(el, "undo");
  press(el, "redo");
  press(el, "more");
  assert.equal(el._toolMenu, "phone-more");
  press(el, "outside");
  assert.equal(el._toolMenu, "outside", "More › Outside opens the toolbar's Outside menu");
  press(el, "energy");
  assert.equal(el._tool, "energy");
  press(el, "select");
  press(el, "wall-view");
  assert.equal(el._wallPick, true, "Wall view: the next tap on a wall opens it");
  press(el, "split");
  press(el, "fit");
  press(el, "fit-all");
  press(el, "help");
  assert.equal(el._help, true);
  press(el, "settings");
  assert.deepEqual(calls, ["undo", "redo", "toggleSplit", "fit", "fit:[true]", 'openSettings:["general"]']);
});

test("Fit with garden shows only when something stands outside; drawing tools wait for a floor and an editor", () => {
  const el = editor();
  el._doc.floors[0].outdoor = [];
  el._doc.floors[0].furniture = [];
  el._doc.floors[0].placements = [];
  assert.ok(!bar(el).moreRows().some((r: { id: string }) => r.id === "fit-all"));
  el.canEdit = false;
  const b = bar(el);
  for (const id of ["build", "furniture"]) assert.equal(b.buttons().find((x: { id: string }) => x.id === id).disabled, true, id);
  assert.equal(b.moreRows().find((x: { id: string }) => x.id === "outside").disabled, true);
});

test("the bar is a toolbar with roving focus: one tab stop, arrows, Home and End; tools say pressed, menus expanded", () => {
  const el = editor();
  el._toolMenu = "build";
  const out = flat(bar(el).render());
  assert.match(out, /<div class="bar" role="toolbar" aria-label=Tools/);
  assert.equal(out.match(/tabindex=0/g)?.length, 1, "one tab stop");
  assert.equal(out.match(/tabindex=-1/g)?.length, 5);
  assert.match(out, /class="btn-select on"[^>]*aria-pressed=true/);
  assert.match(out, /class="btn-build on"[^>]*aria-haspopup=menu\s+aria-expanded=true/);
  // the words and line icons as drawn
  for (const w of ["Select", "Build", "Furniture", "Undo", "Redo", "More"]) assert.ok(out.includes(`<span>${w}</span>`), w);
  assert.equal(out.match(/class="fp3d-ui-icon"/g)?.length, 6);
  // the Build button is lit for every tool of the Build menu
  for (const t of ["rect", "polygon", "measure", "wall", "opening", "hole", "roof"]) assert.ok(BUILD_TOOLS.includes(t as never), t);
  // More: a menu of rows; 3D beside and Wall view say whether they are on
  el._toolMenu = "phone-more";
  const more = flat(bar(el).render());
  assert.match(more, /<div class="more" role="menu" aria-label=More/);
  assert.match(more, /role=menuitemcheckbox\s+aria-checked=false\s+class="row row-split"/);
  const order = ["Outside", "Energy", "Wall view", "3D beside", "Fit", "Fit with garden", "Help and shortcuts", "Settings for this home"];
  let at = -1;
  for (const w of order) {
    const i = more.indexOf(w, at + 1);
    assert.ok(i > at, `${w} in More, in the drawn order`);
    at = i;
  }
});

// ---- the details sheet

test("choosing something pulls the sheet up to its title row; Details goes to half, then full; Close lets go", () => {
  const el = editor();
  el.syncSheet();
  assert.equal(el._sheet, "closed", "nothing chosen: no sheet");
  el.selectItem("room", "k");
  el.syncSheet();
  assert.equal(el._sheet, "peek");
  const head = flat(el.renderSheet(el.floor));
  assert.match(head, /<aside class="fp3d-side fp3d-sheet" data-sheet=peek role="region" aria-label=Kitchen>/);
  // the panel's own header is the sheet's title row (#420, CONS-9): the name once, then lock, "⋯" and Close
  assert.match(head, /fp3d-sheet-row fp3d-sheet-own"><header\s+class="fp3d-item-head fp3d-panel-head[^]*<h2>Kitchen<\/h2>[^]*fp3d-sheet-close" aria-label=Close/);
  assert.equal(head.match(/>Kitchen</g)?.length, 1, "the name shows once");
  // the grab bar sizes the sheet: a button named for what it does
  assert.match(head, /<button type="button" class="fp3d-sheet-grab" aria-label=Details aria-expanded=false/);
  assert.doesNotMatch(head, /fp3d-sheet-size/);
  // the sheet holds the very side panel the desktop shows: every field and button of it is reachable
  const side = flat(el.renderSide(el.floor));
  assert.ok(head.includes(side.slice(side.indexOf("</header>") + "</header>".length)));
  el.renderSheet(el.floor);
  el._sheet = "half";
  assert.match(flat(el.renderSheet(el.floor)), /fp3d-sheet-grab" aria-label=Expand panel/);
  el._sheet = "full";
  assert.match(flat(el.renderSheet(el.floor)), /fp3d-sheet-grab" aria-label=Shrink panel/);
  // another selection keeps the height
  el.selectItem("furniture", "lamp");
  el.syncSheet();
  assert.equal(el._sheet, "full");
  // the sheet names the kind of item (#397): a floor lamp is a Lamp
  assert.match(flat(el.renderSheet(el.floor)), /<span class="fp3d-sub">Lamp · Kitchen/);
  el.closeSheet();
  el.syncSheet();
  assert.equal(el._sheet, "closed");
  assert.equal(el._furnitureId, null);
  assert.equal(el._roomId, null);
});

test("the sheet shows every kind of selection and every tool's panel (devices, gardens, the library, the floor's settings)", () => {
  const el = editor();
  el.selectItem("device", "light.sample_lounge");
  el.syncSheet();
  assert.match(flat(el.renderSheet(el.floor)), /<h2>light\.sample_lounge<\/h2>\s*<span class="fp3d-sub">Device/);
  el.closeSheet();
  el.selectItem("outdoor", "lawn");
  el.syncSheet();
  assert.match(flat(el.renderSheet(el.floor)), /<h2>Lawn<\/h2>\s*<span class="fp3d-sub">Outdoor area/, "the outdoor panel's own header");
  el.closeSheet();
  el.syncSheet();
  // the furniture tool: its library at peek, so the plan it tells you to tap stays in view (#262)
  el.phoneTool("furniture");
  el.syncSheet();
  assert.equal(el._sheet, "peek");
  assert.match(flat(el.renderSheet(el.floor)), /<b>Furniture<\/b>/, "titled Furniture, not by what lies under the last tap (#262)");
  el.closeSheet();
  el.syncSheet();
  assert.equal(el._sheet, "closed", "shut by hand, it stays shut while the tool stays");
  el.phoneTool("furniture");
  assert.equal(el._sheet, "peek", "the bar's Furniture brings it back");
  // a drawing tool: its name and hint in the title row
  el.closeSheet();
  el.phoneTool("wall");
  el.syncSheet();
  const wall = flat(el.renderSheet(el.floor));
  assert.match(wall, /<b>Wall<\/b>/);
  assert.match(wall, /fp3d-sheet-hint fp3d-hint-text/);
  // the floor menu's Floor settings: the floor's page at half height
  el.closeSheet();
  el.phoneTool("select");
  el.syncSheet();
  el._toolMenu = "floor";
  const settings = (function find(v: unknown): (() => void) | undefined {
    if (v && typeof v === "object" && "strings" in (v as object)) {
      const r = v as { strings: readonly string[]; values: unknown[] };
      for (let i = 0; i < r.values.length; i++) {
        const next = r.values[i + 1];
        if (typeof r.values[i] === "function" && flat(next).includes(en.floor_settings!)) return r.values[i] as () => void;
        const f = find(r.values[i]);
        if (f) return f;
      }
    } else if (Array.isArray(v)) for (const x of v) {
      const f = find(x);
      if (f) return f;
    }
    return undefined;
  })(el.renderFloorMenu());
  assert.ok(settings, "Floor settings in the floor menu");
  settings!();
  el.syncSheet();
  assert.equal(el._sheet, "half");
  assert.match(flat(el.renderSheet(el.floor)), /fp3d-sheet-own"><header[^]*<h2>Ground<\/h2>/);
  assert.match(flat(el.renderSheet(el.floor)), /fp3d-home-links/, "with the Settings for this home links");
});

test("the plan moves so the selection stays above the sheet", () => {
  const el = editor();
  el.selectItem("furniture", "lamp");
  el._sheet = "half";
  el._view = { scale: 40, ox: 0, oy: 560 };
  const sheet = { offsetHeight: 320, querySelector: () => null };
  Object.defineProperty(el, "renderRoot", { value: { querySelector: (s: string) => (s === ".fp3d-sheet" ? sheet : null) }, configurable: true });
  el.afterPhoneRender(new Map([["_sheet", "peek"]]));
  const [, sy] = el.toScreen([1, 1]);
  assert.ok(sy < 640 - 320, `the lamp at ${sy} px is above the sheet`);
  el.backLayers.closeAll();
});

// ---- the hint

test("the hint shows on one line only while nothing is chosen; ✕ hides it for good, Help brings it back", () => {
  const el = editor();
  let hint = flat(el.renderHint());
  assert.match(hint, /fp3d-hint-hide" aria-label=Hide the hint/);
  assert.doesNotMatch(hint, /\? Help/, "Help is in More on a phone");
  el.selectItem("room", "k");
  el.syncSheet();
  assert.equal(flat(el.renderHint()), "", "a selection: the sheet's title row says what it is");
  el.closeSheet();
  el.syncSheet();
  el.setHintOff(true);
  assert.equal(flat(el.renderHint()), "");
  press(el, "help");
  hint = flat(el.renderHint());
  assert.match(hint, /fp3d-hint-text/);
  // the desktop keeps its hint bar with Help
  el._phone = false;
  el._sheeted = false;
  assert.match(flat(el.renderHint()), /fp3d-hint-help/);
});

// ---- Android's back gesture

test("Back closes the newest layer first: the sheet, then a menu, then the View panel; a layer shut by hand gives its entry back", () => {
  const shut: string[] = [];
  const start = entries.length;
  openBackLayer(() => shut.push("view"));
  const layers = new BackLayers();
  layers.sync("menu", true, () => shut.push("menu"));
  layers.sync("sheet", true, () => shut.push("sheet"));
  assert.equal(entries.length, start + 3);
  history.back();
  history.back();
  history.back();
  assert.deepEqual(shut, ["sheet", "menu", "view"]);
  // a menu closed by its own button: its entry goes, so the next Back is not used up on it
  layers.sync("menu", true, () => shut.push("menu again"));
  assert.equal(entries.length, start + 1);
  layers.sync("menu", false, () => undefined);
  assert.equal(entries.length, start);
  assert.deepEqual(shut, ["sheet", "menu", "view"]);
});

test("the phone editor's sheet, menus and help follow Back; the View panel too (#247 did not close on Android back)", () => {
  const el = editor();
  const start = entries.length;
  el.selectItem("room", "k");
  el.syncSheet();
  el._toolMenu = "build";
  Object.defineProperty(el, "renderRoot", { value: { querySelector: () => null }, configurable: true });
  el.afterPhoneRender(new Map());
  assert.equal(entries.length, start + 2);
  history.back();
  assert.equal(el._toolMenu, null, "Back shuts the menu first");
  assert.equal(el._sheet, "peek");
  history.back();
  assert.equal(el._sheet, "closed", "then the sheet");
  assert.equal(el._roomId, null);
  el.afterPhoneRender(new Map());
  assert.equal(entries.length, start);
  // the panel keeps the View panel's layer in step with it
  assert.match(src("./panel.ts"), /row\("_viewOpen", "view", this\._viewOpen && this\._mode === "view", \(\) => this\.setViewOpen\(false, true\), \(\) => this\.setViewOpen\(true\)\)/);
  assert.match(src("./panel.ts"), /this\.backLayers\.closeAll\(\)/);
});

// ---- the floor pictures switch, stored keys, texts, bundle

test("Settings › Screen and controls has 'Show the floor pictures panel', off by default, kept on this device", () => {
  const row = settingById("floor_pictures")!;
  assert.equal(row.section, "screen");
  assert.equal(row.card, "controls");
  assert.equal(row.scope, "device");
  assert.equal(row.default, false);
  assert.deepEqual(row.prefKeys, ["floor_pictures"]);
  assert.equal(en[row.label as string], "Show the floor pictures panel");
  // the panel reads it and hands it to the 3D view; the pictures' fold keeps its own key
  assert.match(src("./panel.ts"), /this\._floorPics = prefs\.get\("floor_pictures"\) === "1"/);
  assert.match(src("./components/view3d.ts"), /localStorage\.getItem\("home3d\.thumbs_compact"\)/);
  // the rest of Screen and controls kept its keys
  for (const [id, key] of [["controls", "controls"], ["keep_view", "keep_view"], ["angle_lock", "angle_lock"], ["stats", "stats"]] as const) assert.deepEqual(settingById(id)!.prefKeys, [key]);
  assert.ok(SETTINGS.some((s) => s.id === "floor_pictures"));
});

test("the phone bar is a lazy chunk of its own that borrows Lit from the editor; the new texts are in English and German", async () => {
  const lazy = src("./components/editor/lazy.ts");
  assert.match(lazy, /loadPhoneBar = once\(\(\) => import\("\.\/phone-bar\.ts"\)/);
  const chunk = src("./components/editor/phone-bar.ts");
  assert.doesNotMatch(chunk.replace(/import type[^;]+;/g, ""), /^import /m, "the chunk imports types only");
  assert.match(src("../build.mjs"), /"home-3d-editor-phone-bar\.js": 12 \* 1024/);
  const { bundledLanguages } = await import("./bundled-languages.fixture.ts");
  const de = bundledLanguages().find((p) => p.language === "de")!.strings as Record<string, string>;
  for (const k of ["sheet_taller", "sheet_smaller", "sheet_opening", "sheet_outdoor", "outside_sub", "wall_view_sub", "hint_hide", "st_floor_pictures", "st_floor_pictures_hint"]) {
    assert.ok(en[k], `en: ${k}`);
    assert.ok(de[k], `de: ${k}`);
  }
});

test("with several items chosen the sheet says how many, and the hint matches the Select several switch (#261)", () => {
  const el = editor();
  el.floor.furniture.push({ id: "lamp2", type: "lamp_floor", x: 3, z: 1, rotation: 0, w: 0.4, d: 0.4, h: 1.6, variant: null, entity: null, power: null } as never);
  el.selectItem("furniture", "lamp");
  el._tool = "select";
  el._multi = ["lamp", "lamp2"];
  el._multiMode = true;
  el._sheet = "peek";
  el.renderAlignTools = () => nothing; // the lazy bundle does not exist under test
  const head = flat(el.renderSheet(el.floor));
  assert.match(head, /aria-label=2 items selected/);
  assert.doesNotMatch(head.slice(0, head.indexOf("fp3d-sheet-body")), /Furniture/, "no single item's name in the header");
});

test("phone wording and first-run steps of the editor (#262)", () => {
  // the library and door hints speak of what is below, not "on the right", on a touch device
  const touch = (k: string) => touchWording(true, k as never, (key, p) => (englishTable() as Record<string, string>)[key]!.replace(/\{(\w+)\}/g, (_: string, n: string) => String(p?.[n] ?? "")), { kind: "Door" });
  assert.doesNotMatch(touch("hint_furniture"), /right/);
  assert.doesNotMatch(touch("hint_opening"), /right/);
  // a new floor leaves a leftover tool: Select, whose hint is the next step
  const el = editor();
  el.setTool("opening");
  el.addFloor();
  assert.equal(el._tool, "select");
  // the floor chip of an empty home says so
  const empty = editor();
  empty._doc.floors.length = 0;
  empty._floorId = null;
  assert.match(flat(empty.renderFloorMenu()), /No floor yet/);
  // the checklist and the sidebar do not both offer the first floor
  assert.equal(empty.startShowing(), true);
  assert.doesNotMatch(flat(empty.renderSide(undefined)), /Add your first floor/);
  // the sheet size button is named for the sheet
  assert.equal(en.sheet_taller, "Expand panel");
  assert.equal(en.floor_settings_of, "{floor}");
});
