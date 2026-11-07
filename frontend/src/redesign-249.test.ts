// Part 4 of the menus and settings redesign (#249, drawings signed off on #219): one header row (one home control,
// underlined tabs, the save line, notices as a badge and a pop-up), the floor bar (floors in one row, a searchable Rooms
// picker, option B), "Edit room" / "Edit floor" into the editor, and one editor toolbar row (one Fit, More) with the ⚙
// menu gone. Every control the drawings' inventory lists for these areas is still reachable.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { emptyBuilding, newFloor } from "./model.ts";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener: () => undefined, removeEventListener: () => undefined });
g.location = { search: "", hash: "", pathname: "/home_3d" };
g.history = { state: null, replaceState: () => undefined };

const { Floorplan3dPanel } = await import("./panel.ts");
const { Fp3dRoomPanel } = await import("./components/room-panel.ts");
const { filterRooms } = await import("./components/rooms-picker.ts");
const { Fp3dEditor } = (await import("./components/editor.ts")) as unknown as { Fp3dEditor: new () => Record<string, any> };
const { editorSource } = await import("./components/editor-source.ts");
const { settingById } = await import("./settings/registry.ts");
const { englishTable } = await import("./i18n.ts");
const { cardsOf } = await import("./tool-cards.ts");

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

/** The click handlers in a template whose attribute text matches `re`, in order. */
function handlers(v: unknown, re: RegExp, out: ((e?: unknown) => void)[] = []): ((e?: unknown) => void)[] {
  if (Array.isArray(v)) v.forEach((x) => handlers(x, re, out));
  else if (v && typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    r.values.forEach((x, i) => {
      if (typeof x === "function" && re.test(r.strings[i])) out.push(x as () => void);
      handlers(x, re, out);
    });
  }
  return out;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function panel(floorId: string | null = null): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (Floorplan3dPanel as any)();
  p.hass = { language: "en", user: { id: "u", is_admin: true, name: "x" }, states: {}, themes: { darkMode: true } };
  const b = emptyBuilding();
  const room = (id: string, name: string) => ({ id, name, points: [[0, 0], [4, 0], [4, 3], [0, 3]], area_id: null });
  b.floors = [
    { id: "f1", name: "Ground", rooms: [room("k", "Kitchen"), room("b1", "Bedroom")], furniture: [], placements: [], openings: [], walls: [], outdoor: [], height: 2.5, elevation: 0 },
    { id: "f2", name: "Upper", rooms: [room("b2", "Bedroom"), room("s", "Study")], furniture: [], placements: [], openings: [], walls: [], outdoor: [], height: 2.5, elevation: 2.5 },
  ] as unknown as typeof b.floors;
  p.data.building = b;
  p.data.canEdit = true;
  p.willUpdate(new Map());
  p._floorId = floorId;
  return p;
}

// ---- the header

test("one header row: HA's menu, the title, one home control, the tabs as navigation, the save line; no version", () => {
  const p = panel();
  const out = flat(p.render());
  const header = out.slice(out.indexOf('<header class="fp3d-header">'), out.indexOf("</header>"));
  assert.match(header, /<ha-menu-button/);
  assert.match(header, /<h1>Home 3D<\/h1>/);
  assert.equal(header.split("<fp3d-home-switcher").length, 2, "one home indicator (the chip for a home that is not on the displays, #296)");
  assert.match(header, /<nav class="fp3d-tabs" aria-label=Mode>/);
  for (const tab of ["fp3d-tab-view", "fp3d-tab-editor", "fp3d-tab-ext", "fp3d-tab-settings"]) assert.match(header, new RegExp(`class="fp3d-tab ${tab}"`), tab);
  assert.match(header, /class="fp3d-save[^"]*" role="status" aria-live="polite"/);
  assert.doesNotMatch(out, /fp3d-version/, "the version is in Settings › Advanced › About");
  assert.equal(settingById("about.version")?.section, "advanced");
  // the header's View popover is gone (#247): the one View button is on the stage
  assert.doesNotMatch(header, /fp3d-view-btn/);
  assert.match(out, /fp3d-view-btn/);
});

test("the home actions moved from the header to Settings > Homes, every action kept (#296)", async () => {
  const { rowActions } = await import("./settings/homes.ts");
  const homes = [
    { id: "a", name: "A" },
    { id: "b", name: "B" },
  ] as never[];
  const actions = rowActions(homes[1]!, homes, "a", "a");
  for (const v of ["open", "show", "rename", "duplicate", "delete"]) assert.ok(actions.includes(v as never), v);
  for (const k of ["st_homes_new", "home_sample", "st_homes_open", "st_homes_show", "st_homes_rename", "st_homes_duplicate", "st_homes_delete"]) assert.ok(en[k], k);
});

test("the save line says who it saved for on every tab but Settings (which has its own)", () => {
  const p = panel();
  p.data.saveState = "saved";
  assert.match(flat(p.render()), /Saved for the whole home/);
  p._mode = "extensions";
  assert.match(flat(p.renderHeader(0)), /Saved for the whole home/);
  p._mode = "settings";
  assert.doesNotMatch(flat(p.renderHeader(0)), /Saved for the whole home/);
});

test("notices are a badge on the save line plus a strip under the header (#258); Hide puts them away, the badge brings them back (#223)", () => {
  const p = panel();
  p.data.saveState = "error";
  p.data.saveError = "offline";
  let out = flat(p.render());
  assert.match(out, /class="fp3d-note-badge"[^>]*aria-expanded=true/);
  assert.match(out, /<div class="fp3d-notices" role="region"/);
  assert.match(out, /Saving failed: offline/);
  // since #258 the notices sit in a strip of their own under the header (as pop-ups they covered controls): the plan
  // only gets shorter, it is never covered (run4-viewing.test.ts)
  const css = (Floorplan3dPanel as unknown as { styles: { cssText?: string }[] }).styles.map((s) => s.cssText ?? "").join("");
  assert.match(css, /\.fp3d-notices \{\s*flex: none;/);
  for (const h of handlers(p.renderNotices(p.noticeList(false)), /fp3d-notices-hide" @click=$/)) h();
  out = flat(p.render());
  assert.doesNotMatch(out, /<div class="fp3d-notices"/);
  assert.match(out, /class="fp3d-note-badge"[^>]*aria-expanded=false/);
  for (const h of handlers(p.renderHeader(1), /^\s*@click=$/).slice(-1)) h();
  assert.match(flat(p.render()), /<div class="fp3d-notices"/);
});

// ---- the floor bar and the Rooms picker (option B)

test("the floor bar: Whole house and the floors in one row, a Rooms picker, no room chips and no wrap toggle", () => {
  const out = flat(panel().render());
  const bar = out.slice(out.indexOf('<nav class="fp3d-nav"'), out.indexOf("</nav>", out.indexOf('<nav class="fp3d-nav"')));
  assert.match(bar, /Whole house/);
  assert.ok(bar.indexOf("Upper") < bar.indexOf("Ground"), "the top floor first");
  assert.match(bar, /fp3d-rooms-btn/);
  assert.doesNotMatch(out, /fp3d-room-chip|fp3d-nav-toggle/);
  assert.equal(settingById("nav_wrap"), undefined, "the wrap switch went with the chips");
  // the floor pictures are a second floor picker beside the 3D view: off unless Settings › Screen and controls says so (#250)
  assert.match(src("./panel.ts"), /\.floorThumbs=\$\{this\._floorPics\}/);
});

test("the Rooms picker lists the floor's rooms, or every floor's grouped by floor; search matches any part of a name", () => {
  const p = panel();
  const all = p.roomGroups(p.data.building, undefined);
  assert.deepEqual(
    all.map((g: { name: string; rooms: { name: string }[] }) => [g.name, g.rooms.map((r) => r.name)]),
    [
      ["Upper", ["Bedroom", "Study"]],
      ["Ground", ["Kitchen", "Bedroom"]],
    ],
    "two rooms called Bedroom show their floor",
  );
  assert.deepEqual(filterRooms(all, "bed").map((g) => g.rooms.map((r) => r.id)), [["b2"], ["b1"]]);
  assert.deepEqual(filterRooms(all, "KIT").map((g) => g.id), ["f1"], "a floor with no match goes");
  assert.deepEqual(filterRooms(all, "zzz"), []);
  assert.deepEqual(p.roomGroups(p.data.building, p.data.building.floors[1]).map((g: { id: string }) => g.id), ["f2"]);
});

test("picking a room opens it on its floor; the picker closes; Edit floor goes to the editor", () => {
  const p = panel("f1");
  p._roomsOpen = true;
  const out = p.renderFloorBar(p.data.building, p.data.building.floors[0]);
  const text = flat(out);
  assert.match(text, /<fp3d-rooms-picker/);
  const [pick] = handlers(out, /@room-pick=$/);
  pick!({ detail: { floorId: "f2", roomId: "s" } });
  assert.equal(p._floorId, "f2");
  assert.equal(p._roomId, "s");
  assert.equal(p._roomsOpen, false);
  const opened: [string | null, string | null][] = [];
  p.openInEditor = (f: string | null, r: string | null) => opened.push([f, r]);
  p._roomsOpen = true;
  const [edit] = handlers(p.renderFloorBar(p.data.building, p.data.building.floors[0]), /@edit-floor=$/);
  edit!({ detail: { floorId: "f1" } });
  assert.deepEqual(opened, [["f1", null]]);
});

test("a wall tablet's floor bar has the floors only: no Rooms picker (#92)", () => {
  const p = panel();
  p._tablet = true;
  assert.doesNotMatch(flat(p.renderFloorBar(p.data.building, undefined)), /fp3d-rooms-btn/);
});

// ---- Edit room / Edit floor

function roomPanel(canEdit: boolean, readOnly = false) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = new (Fp3dRoomPanel as any)();
  el.hass = { language: "en", areas: {}, entities: {}, devices: {}, states: {} };
  el.room = { id: "k", name: "Kitchen", area_id: null, points: [[0, 0], [4, 0], [4, 4], [0, 4]] };
  el.floor = { id: "f1", rooms: [el.room], furniture: [], openings: [], placements: [] };
  el.canEdit = canEdit;
  el.readOnly = readOnly;
  const events: { type: string; detail: unknown }[] = [];
  el.dispatchEvent = (e: CustomEvent) => (events.push({ type: e.type, detail: e.detail }), true);
  return { el, events };
}

test("the room panel has no Edit room or Edit floor buttons (#355); editing stays on the Edit tab", () => {
  const { el } = roomPanel(true);
  const out = flat(el.render());
  assert.doesNotMatch(out, /fp3d-edit-room|fp3d-edit-floor/);
  assert.doesNotMatch(src("./panel.ts"), /@edit-room=/);
  assert.match(src("./panel.ts"), /ed\?\.goToRoom\(floorId, roomId\)/);
});

function editor(): Record<string, any> {
  const b = emptyBuilding();
  const ground = newFloor("f1", "Ground", 0);
  ground.rooms.push({ id: "k", name: "Kitchen", area_id: null, points: [[0, 0], [5, 0], [5, 4], [0, 4]], floor_material: "wood" } as never);
  ground.outdoor.push({ id: "lawn", type: "lawn", area_id: "garden", name: "Garden", points: [[-5, -5], [10, -5], [10, 10], [-5, 10]] } as never);
  const upper = newFloor("f2", "Upper", 2.5);
  upper.rooms.push({ id: "s", name: "Study", area_id: null, points: [[0, 0], [3, 0], [3, 3], [0, 3]], floor_material: "wood" } as never);
  b.floors.push(ground, upper);
  const el = new Fp3dEditor();
  el.hass = { states: {}, areas: {}, user: { is_admin: true }, language: "en", locale: { language: "en" } };
  el._doc = b;
  el._floorId = "f1";
  el.canEdit = true;
  el._size = { w: 800, h: 600 };
  return el;
}

test("the editor opens at the room: its floor, Select, the room chosen and its panel open (or the floor's settings)", () => {
  const el = editor();
  el._tool = "wall";
  assert.equal(el.goToRoom("f2", "s"), true);
  assert.equal(el._floorId, "f2");
  assert.equal(el._tool, "select");
  assert.equal(el._roomId, "s");
  assert.equal(el._sideOpen, true);
  // a garden acting as a room is an outdoor area in the editor
  assert.equal(el.goToRoom(null, "lawn"), true);
  assert.equal(el._floorId, "f1");
  assert.equal(el._outdoorId, "lawn");
  // Edit floor: the floor's settings (nothing chosen)
  assert.equal(el.goToRoom("f2", null), true);
  assert.equal(el._roomId, null);
  assert.equal(el.goToRoom("gone", null), false);
});

// ---- the editor toolbar

test("one toolbar row: floor, the tools with icons, Wall view, Undo/Redo, then 3D beside and More (no Fit: the plan has one, #321)", () => {
  const el = editor();
  const bar = flat(el.renderToolBar(el.floor));
  const order = ["Select", "Build", "Outside", "Furniture", "Energy", "Wall view", "Undo", "Redo", "fp3d-tb-grow", "3D beside", "fp3d-more-btn"];
  let at = -1;
  for (const w of order) {
    const i = bar.indexOf(w, at + 1);
    assert.ok(i > at, `${w} comes after the one before`);
    at = i;
  }
  assert.equal(bar.match(/class="fp3d-ui-icon"/g)!.length >= 9, true, "every tool and view button has a line icon");
  assert.doesNotMatch(bar, /fp3d-fit-btn/, "the plan's own Fit sits beside the zoom buttons (#321)");
  assert.doesNotMatch(bar, /fp3d-help-btn|>\?</, "the toolbar '?' repeated Help");
  assert.doesNotMatch(bar, /fp3d-seg-settings|⚙/, "the ⚙ menu is gone");
  assert.ok(!editorSource().includes("renderSettingsMenu"));
  // the floor menu keeps every floor, Add floor and Floor settings
  el._toolMenu = "floor";
  const floors = flat(el.renderFloorMenu());
  for (const w of ["Ground", "Upper", en.add_floor, en.floor_settings]) assert.ok(floors.includes(w), w);
});

test("Build and Outside keep every drawing tool and choice: each panel has a card for it (#402)", () => {
  const el = editor();
  for (const [menu, tools] of [
    ["build", ["rect", "polygon", "measure", "wall", "opening", "hole", "roof"]],
    ["outside", ["outdoor", "pool"]],
  ] as const) {
    el._toolMenu = menu;
    assert.match(flat(el.renderToolBar(el.floor)), /<fp3d-tool-panel/);
    for (const t of tools) assert.ok(cardsOf(menu, true).some((c) => c.tool === t), t);
  }
});

test("More: Fit with garden (something stands outside), 3D beside, Help and shortcuts, Settings for this home", () => {
  const el = editor();
  el._toolMenu = "more";
  const more = flat(el.renderMoreMenu(() => undefined));
  for (const w of ["Fit with garden", "3D beside", "Help and shortcuts", "Settings for this home"]) assert.ok(more.includes(w), w);
  assert.match(more, /role="menuitemcheckbox" aria-checked=false class="fp3d-menu-item fp3d-more-split"/);
  const opened: unknown[] = [];
  el.dispatchEvent = (e: CustomEvent) => (opened.push(e.detail), true);
  const runs = handlers(el.renderMoreMenu(() => undefined), /^" @click=$/);
  runs[runs.length - 1]!();
  assert.deepEqual(opened, [{ section: "general", id: null }]);
  runs[runs.length - 2]!();
  assert.equal(el._help, true, "Help opens the help sheet");
  // Help is also on the hint bar, as before
  assert.match(flat(el.renderHint()), /fp3d-hint-help/);
});

test("every place the old ⚙ menu led to is reachable from the editor: the floor page's links, and Locating in Settings › People", () => {
  const el = editor();
  Object.defineProperty(el, "isHaAdmin", { get: () => true });
  const links = el.renderHomeLinks();
  const opened: unknown[] = [];
  el.dispatchEvent = (e: CustomEvent) => (opened.push(e.detail), true);
  for (const h of handlers(links, /@click=$/)) h();
  const want = [
    { section: "general", id: null },
    { section: "scene", id: "weather_entity" },
    { section: "cameras", id: "director.doorbell" },
    { section: "voice", id: null },
    { section: "people", id: "locate" },
    { section: "favourites", id: null },
    { section: "scene", id: "backdrop.kind" },
    { section: "scene", id: "terrain.level" },
    { section: "backup", id: null },
    { section: "access", id: null },
  ];
  assert.deepEqual(opened, want);
  // each goes somewhere that exists
  for (const w of want) if (w.id) assert.ok(settingById(w.id), w.id);
  // the Locating assistant is a row of Settings › People that the panel opens
  const locate = settingById("locate")!;
  assert.equal(locate.section, "people");
  assert.deepEqual(locate.control, { kind: "action", button: "st_open", action: "locate" });
  assert.match(src("./panel.ts"), /action === "locate" && this\.hass/);
  // the deep links the panels had stay (energy, the bins' kerb); the plan lock is the floor header's lock now (#409)
  assert.ok((editorSource().match(/this\.renderSettingsLink\(/g) ?? []).length >= 2);
  // the floor page shows the links
  assert.match(src("./components/editor/side-panel.ts"), /\$\{this\.renderHomeLinks\(\)\}/);
});

test("the new texts are in English and German", async () => {
  const { bundledLanguages } = await import("./bundled-languages.fixture.ts");
  const de = bundledLanguages().find((p) => p.language === "de")!.strings as Record<string, string>;
  for (const k of ["editor_short", "notices", "notices_badge", "notices_hide", "rooms_open", "rooms_find", "rooms_none", "edit_room", "edit_floor", "tools", "more", "help_and_shortcuts", "settings_home"]) {
    assert.ok(en[k], `en: ${k}`);
    assert.ok(de[k], `de: ${k}`);
  }
  assert.equal(en.all_floors, "Whole house");
  assert.equal(en.fit, "Fit");
  assert.equal(en.fit_all, "Fit with garden");
});
