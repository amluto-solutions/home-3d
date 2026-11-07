// Part 3 of the menus and settings redesign (#248, drawings signed off on #219): the Settings menu by who a change
// affects (This home, This device) then topics, search with the arrow keys, Enter and Escape, one sentence per page
// instead of a badge on every row, one save line, a Back link, line icons, the About card, and the "Sun and lights"
// sheet retired with every control it held still reachable (the inventory of the drawings).
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { englishTable } from "../i18n.ts";
import { clearModules, registerModule, type NeonModule } from "../modules.ts";
import type { HomeAssistant } from "../types.ts";
import { audienceOf, GROUPS, liveSections, parseSettingsHash, searchSettings, SECTIONS, sectionOf, SETTINGS, settingById, type SettingsEnv } from "./registry.ts";
import { SETTINGS_ICONS } from "./settings-icons.ts";
import { sampleBuilding, sampleHass } from "./settings.fixture.ts";

const { SettingsPage } = await import("./settings-page.ts");
const en = englishTable() as Record<string, string>;
const t = (k: string, vars: Record<string, string | number> = {}) => {
  let s = en[k] ?? k;
  for (const [n, v] of Object.entries(vars)) s = s.replace(`{${n}}`, String(v));
  return s;
};
const src = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

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

function handlers(v: unknown, re: RegExp, out: (() => void)[] = []): (() => void)[] {
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

const env = (): SettingsEnv => ({ building: sampleBuilding(), hass: sampleHass(), prefs: { get: () => null, set: () => undefined }, lastView: null, remote: {} });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function page(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (SettingsPage as any)();
  p.hass = sampleHass();
  p.building = sampleBuilding();
  p.canEdit = true;
  p.t = t;
  p.events = [];
  p.dispatchEvent = (e: CustomEvent) => (p.events.push({ type: e.type, detail: e.detail }), true);
  return p;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function show(p: any, section: string): string {
  p._section = section;
  p.willUpdate(new Map());
  return flat(p.render());
}

const key = (k: string) => ({ key: k, preventDefault: () => undefined, stopPropagation: () => undefined });

// ---- the menu

test("the menu shows who a change affects first, then topics: This home and This device (option B)", () => {
  const menu = (a: "home" | "device") => SECTIONS.filter((s) => !s.hidden && audienceOf(s) === a).map((s) => s.id);
  assert.deepEqual(menu("device"), ["look", "view3d", "screen", "voice"]);
  assert.deepEqual(menu("home"), ["general", "scene", "energy", "favourites", "warnings", "effects", "cameras", "household", "people", "homes", "access", "tablets", "packs", "backup", "advanced"]);
  for (const g of GROUPS) assert.ok(en[g.title], g.id);
  assert.deepEqual(
    GROUPS.filter((g) => g.audience === "device").map((g) => en[g.title]),
    ["How it looks", "How it works"],
  );
  // the page opens on the side of its section, and the other side's link switches over
  const p = page();
  let text = show(p, "general");
  assert.equal(p._audience, "home");
  assert.ok(text.includes(t("st_audience_home")) && text.includes(t("st_group_device")));
  assert.ok(text.includes(t("st_other_device")));
  assert.ok(!text.includes(`>${t("st_sec_voice")}<`), "the device side's pages are not listed on the home side");
  p.showSide("device");
  assert.equal(p._audience, "device");
  assert.equal(p._section, "look");
  text = flat(p.render());
  assert.ok(text.includes(t("st_sec_screen")) && text.includes(t("st_other_home")));
});

test("the fun switches left the menu for the Extensions tab, but search still finds them", () => {
  assert.ok(SECTIONS.find((s) => s.id === "fun")?.hidden);
  assert.ok(liveSections(env()).some((s) => s.id === "fun"), "its page still opens from a link");
  assert.ok(searchSettings("ghost", env(), t).some((s) => s.id === "halloween.ghost"));
  // the old link goes to the Extensions tab and does not open a second copy of the switches (#256)
  const p = page();
  p.section = "fun";
  p.willUpdate(new Map([["section", null]]));
  assert.ok(p.events.some((e: { detail: { action?: string } }) => e.detail.action === "extensions"));
  assert.notEqual(p._section, "fun");
  // an unknown name opens the menu, not the first page
  const q = page();
  q.section = "bogus";
  q.willUpdate(new Map([["section", null]]));
  assert.equal(q._drill, false);
});

test("every section has a line icon of the one family, no glyphs, and the page draws no glyph icons", () => {
  for (const s of SECTIONS) assert.ok(SETTINGS_ICONS.includes(s.icon), `${s.id}: ${s.icon}`);
  const code = src("./settings-page.ts");
  for (const glyph of ["⌕", "🔒", "⚙", "⌂", "◐", "★", "✦", "≋"]) assert.ok(!code.includes(glyph), `settings-page.ts still draws ${glyph}`);
  assert.match(flat(show(page(), "general")), /<fp3d-line-icon/);
  // the icons come with the page's pickers chunk (its first open stays in budget)
  assert.match(src("./pickers.ts"), /settings-icons\.ts/);
});

// ---- search

test("search: the arrow keys move through the hits, Enter opens the one marked at its row, Escape clears", () => {
  const p = page();
  p._query = "sun";
  p.willUpdate(new Map());
  const hits = p.hits("sun");
  assert.ok(hits.length > 2);
  let text = flat(p.render());
  assert.match(text, /id=st-hit-0/);
  assert.match(text, /aria-activedescendant=st-hit-0/);
  p.searchKey(key("ArrowDown"));
  assert.equal(p._cursor, 1);
  p.searchKey(key("ArrowUp"));
  p.searchKey(key("ArrowUp"));
  assert.equal(p._cursor, hits.length - 1, "up from the first goes round to the last");
  p.searchKey(key("ArrowDown"));
  p.searchKey(key("ArrowDown"));
  text = flat(p.render());
  assert.match(text, /st-active/);
  p.searchKey(key("Enter"));
  assert.equal(p._query, "");
  assert.equal(p._section, hits[1].section);
  assert.equal(p._flash, hits[1].id);
  clearTimeout(p.flashTimer);
  p._query = "walls";
  p.searchKey(key("Escape"));
  assert.equal(p._query, "");
});

test("a search hit says whose it is in words (there is no page sentence above it)", () => {
  const p = page();
  p._query = "frame rate";
  p.willUpdate(new Map());
  assert.ok(flat(p.render()).includes(t("st_row_device")));
});

// ---- the page

test("each page says once who it affects; a row with another rule says so; no badge on any row", () => {
  const p = page();
  for (const sec of liveSections(env())) {
    const text = show(p, sec.id);
    assert.doesNotMatch(text, /st-scope/, sec.id);
    const sentence = audienceOf(sec) === "device" ? "st_page_device" : sec.id === "packs" || sec.id === "homes" ? "st_page_install" : sec.id === "access" || sec.id === "tablets" ? null : "st_page_home";
    if (sentence) assert.ok(text.includes(t(sentence)), `${sec.id}: ${sentence}`);
  }
  // the live director's link sits with the cameras (a home page) and says the setting is this device's (#295)
  assert.ok(show(p, "cameras").includes(t("st_row_device")));
  // the Assist sentences are Home Assistant's, on the Voice page of this device
  assert.ok(show(p, "voice").includes(t("st_row_install")));
});

test("one save line says who the change was saved for, read out politely", () => {
  const p = page();
  p.saveState = "saved";
  let text = show(p, "general");
  assert.match(text, /aria-live="polite"/);
  assert.ok(text.includes(t("st_saved_home")));
  assert.ok(show(p, "screen").includes(t("st_saved_device")));
  // a house change being saved, then a device change
  p.apply(settingById("lock_plan")!, sampleBuilding());
  p.saveState = "saving";
  assert.ok(show(p, "screen").includes(t("st_saving")), "the line follows the last change, whatever the page");
  p._section = "general";
  p.apply(settingById("stats")!, undefined);
  assert.ok(show(p, "general").includes(t("st_saved_device")));
  assert.equal((text.match(/st-save /g) ?? []).length, 1, "one save line");
});

test("Back to 3D / Editor returns to where Settings was opened from", () => {
  const p = page();
  assert.ok(!show(p, "general").includes(t("st_back_to_3d")), "no link without a place to go back to");
  p.backTo = "editor";
  const tpl = p.renderBackTo();
  assert.ok(flat(tpl).includes(t("st_back_to_editor")));
  for (const h of handlers(tpl, /@click=$/)) h();
  assert.deepEqual(p.events.at(-1), { type: "settings-back", detail: { mode: "editor" } });
  p.backTo = "view";
  assert.ok(show(p, "general").includes(t("st_back_to_3d")));
});

test("Advanced holds an About card with the version", () => {
  const p = page();
  p.version = { frontend: "1.2.3", backend: "1.2.3" };
  const text = show(p, "advanced");
  assert.ok(text.includes(t("st_card_about")) && text.includes("v1.2.3"));
  assert.equal(searchSettings("version", env(), t)[0]?.id, "about.version");
});

// ---- links and the inventory

test("old links still open: every old section id, and rows that moved open their new page", () => {
  for (const old of ["general", "scene", "energy", "fun", "warnings", "effects", "cameras", "household", "favourites", "look", "screen", "voice", "access", "packs", "backup", "advanced"]) {
    assert.equal(parseSettingsHash(`#settings/${old}`)?.section, old, old);
  }
  const moved: [string, string][] = [
    ["#settings/advanced/locate", "people"],
    ["#settings/advanced/person_look", "people"],
    ["#settings/access/tablet_users", "tablets"],
    ["#settings/access/tablet_idle", "tablets"],
    ["#settings/look/walls", "view3d"],
    ["#settings/look/markers", "view3d"],
    ["#settings/look/dashboard_cards", "view3d"],
    ["#settings/screen/quality", "look"],
    ["#settings/look/clock", "look"],
  ];
  for (const [hash, section] of moved) assert.equal(parseSettingsHash(hash)?.section, section, hash);
  // the page opens a moved row's own section even when told the old one
  const p = page();
  p.section = "screen";
  p.focusId = "quality";
  p.willUpdate(new Map([["section", null], ["focusId", null]]));
  assert.equal(p._section, "look");
  assert.equal(p._audience, "device");
  clearTimeout(p.flashTimer);
});

test("every control the 'Sun and lights' sheet held is still reachable in Settings (the drawings' inventory)", () => {
  const sheet: [string, string][] = [
    ["sun_shadow", "scene"],
    ["window_glow", "view3d"],
    ["sun_patches", "scene"],
    ["rain_warning", "warnings"],
    ["alert_unavailable", "warnings"],
    ["alert_names", "warnings"],
    ["alert_ignored", "warnings"],
    ["effects.motion_seconds", "effects"],
    ["effects.radiator_cold", "effects"],
    ["effects.radiator_hot", "effects"],
    ["effects.tank_cold", "effects"],
    ["effects.tank_hot", "effects"],
  ];
  for (const [id, section] of sheet) {
    const s = settingById(id);
    assert.ok(s, id);
    assert.equal(s.section, section, id);
    assert.ok(!SECTIONS.find((x) => x.id === section)!.hidden, `${id} is in the menu`);
  }
  // the View menu's set-once rows (#246) are still where the drawings put them
  for (const [id, section] of [["quality", "look"], ["controls", "screen"], ["keep_view", "screen"], ["angle_lock", "screen"], ["floor_pictures", "screen"], ["stats", "screen"], ["start_view", "general"]] as const) assert.equal(settingById(id)?.section, section, id);
  // every setting appears once
  assert.equal(new Set(SETTINGS.map((s) => s.id)).size, SETTINGS.length);
});

test("the sheet is gone from the 3D view; the central menu and module sheets link to Settings and Extensions instead", () => {
  const code = src("../components/view3d.ts");
  for (const gone of ["renderSettings()", "_settingsOpen", "view_settings", "effectFields", "ignoredAlerts", "fp3d-set-module"]) assert.ok(!code.includes(gone), `view3d.ts still has ${gone}`);
  assert.match(code, /this\.openTab\("open-settings"/);
  assert.match(code, /this\.openTab\("open-extensions"/);
  const panel = src("../panel.ts");
  assert.match(panel, /addEventListener\("open-extensions"/);
  assert.match(panel, /@settings-back=/);
});

test("each extension's own settings are on its card on the Extensions tab, folded until opened; the editor draws them", async () => {
  const { Extensions } = await import("../components/extensions.ts");
  const { makeEditor } = await import("../components/editor-harness.ts");
  let set: boolean | null = null;
  registerModule({ id: "sample.module", settings: () => [{ kind: "check", label: "Sample speaker announcements", value: false, set: (v: boolean) => (set = v) }] } as unknown as NeonModule);
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = new Extensions() as any;
    Object.assign(el, { hass: { language: "en", user: { is_admin: true }, states: {} } as unknown as HomeAssistant, building: sampleBuilding(), canEdit: true, packs: [] });
    el._open = new Set();
    let text = flat(el.renderModules());
    assert.ok(text.includes("sample.module") && text.includes(t("ext_module_settings")));
    assert.ok(!text.includes("<fp3d-editor"), "folded");
    for (const h of handlers(el.renderModules(), /@click=$/)) h();
    assert.ok(el._open.has("mod:sample.module"));
    text = flat(el.renderModules());
    assert.match(text, /<fp3d-editor/);
    // the editor draws the module's fields for that topic, and a change goes to the module
    const ed = await makeEditor([]);
    const fields = ed.renderTopic("module:sample.module");
    assert.ok(flat(fields).includes("Sample speaker announcements"));
    for (const h of handlers(fields, /@change=$/)) (h as unknown as (e: unknown) => void)({ target: { checked: true } });
    assert.equal(set, true);
  } finally {
    clearModules();
  }
});

test("the fun extras' switches sit on the Extensions tab alone (no link back to Settings)", () => {
  const code = src("../components/extensions.ts");
  assert.ok(!code.includes('section: "fun"'), "no Settings link for the fun switches");
  assert.match(code, /funSwitch\(this\.building\.settings\.easter_eggs/);
});

// ---- search on a phone, word starts, scope once (#254)

test("search keeps its box: the page carries the search state so the phone layout shows the box above the results", () => {
  const p = page();
  p._query = "c";
  p.willUpdate(new Map());
  assert.match(flat(p.render()), /st-drill\s+st-query/);
  p._query = "";
  assert.doesNotMatch(flat(p.render()), /st-query/);
  const code = src("./settings-page.ts");
  assert.match(code, /\.st-drill\.st-query \.st-nav \{\s*display: flex/);
  assert.match(code, /\.st-drill\.st-query \.st-nav > :not\(\.st-search\) \{\s*display: none/);
});

test("search matches word starts, and a hint only by whole words", () => {
  const ids = (q: string) => searchSettings(q, env(), t).map((s) => s.id);
  assert.ok(ids("cloc").length > 0, "a word start matches");
  assert.equal(ids("lock").filter((id) => settingById(id)!.label.includes("clock")).length, 0, "no match inside a word");
  const north = SETTINGS.find((s) => s.hint && /clockwise/i.test(t(s.hint)));
  if (north) assert.ok(!ids("clock").includes(north.id), "a hint that says clockwise is not a clock hit");
});

test("a search hit group says whose a row is once per run of the same answer", () => {
  const p = page();
  p._query = "sun";
  p.willUpdate(new Map());
  const text = flat(p.render());
  const rows = (text.match(/class="st-row /g) ?? []).length;
  const said = (text.match(/class="st-rule"/g) ?? []).length;
  assert.ok(rows > 1 && said < rows, `${said} scope lines for ${rows} rows`);
});

// ---- the save line, the reset note and where people start (#255)

test("the save line names the page's own side, and a change only on the page it was made on", () => {
  const p = page();
  p._saved = "device";
  p._savedOn = "look";
  assert.ok(show(p, "household").includes(t("st_saved_home")), "a whole-home page does not say 'this device'");
  assert.ok(show(p, "look").includes(t("st_saved_device")));
  p._savedOn = "household";
  p._saved = "home";
  assert.ok(show(p, "look").includes(t("st_saved_device")), "a device page keeps its own side");
});

test("the reset note and the search clear when the side or page changes", () => {
  const p = page();
  p._note = "x";
  p.showSide("device");
  assert.equal(p._note, null);
  p._note = "x";
  p.renderRoot = {};
  p.open("look");
  assert.equal(p._note, null);
});

test("someone who cannot change the home starts on This device", () => {
  const viewer = page();
  viewer.canEdit = false;
  viewer.hass = { ...viewer.hass, user: { id: "u", name: "v", is_admin: false } };
  viewer.willUpdate(new Map([["hass", null]]));
  assert.equal(viewer._audience, "device");
  assert.equal(audienceOf(sectionOf(viewer._section)!), "device");
  const editor = page();
  editor.willUpdate(new Map([["hass", null]]));
  assert.equal(editor._audience, "home");
  const linked = page();
  linked.canEdit = false;
  linked.section = "household";
  linked.willUpdate(new Map([["hass", null], ["section", null]]));
  assert.equal(linked._section, "household", "a link still opens its page");
});

// ---- layout and wording polish (#256)

test("the clock's details show only while the clock does", () => {
  const rows = ["clock_hours", "clock_style", "clock_seconds", "clock_date"];
  const on = (v: string | null): SettingsEnv => ({ ...env(), prefs: { get: (k: string) => (k === "clock" ? v : null), set: () => undefined } });
  for (const id of rows) {
    assert.equal(settingById(id)!.visible!(on(null)), false, id);
    assert.equal(settingById(id)!.visible!(on("off")), false, id);
    assert.equal(settingById(id)!.visible!(on("tr")), true, id);
  }
});

test("Household has a calendar icon, the bin days box says always and days, wide controls stack, chips have big targets", () => {
  assert.equal(sectionOf("household")!.icon, "calendar");
  const days = settingById("household.bin_days")!.control as { empty?: string; unit?: string };
  assert.equal(days.empty, "bin_days_always");
  assert.equal(days.unit, "st_days");
  assert.match(src("./settings-page.ts"), /c\.kind === "segment" && this\.options\(c\)\.length > 2/);
  const chips = src("../components/multi-select.ts");
  assert.match(chips, /\.chip button::after \{\s*content: ""[^}]*inset: -8px -4px/);
  assert.match(chips, /min-height: 32px/);
  assert.equal(settingById("pack_updates.frequency")!.control.kind, "select");
  assert.ok(!t("st_sun_shadow_hint").includes("sun.sun") && !t("st_sun_patches_hint").includes("sun.sun") && !t("st_weather_hint").includes("sun.sun"));
  assert.equal(t("editors_reset"), "Let every admin edit");
});

test("who can edit draws one heading: the row's own label is hidden", () => {
  const text = show(page(), "access");
  assert.doesNotMatch(text, /class="st-lbl"/);
});
