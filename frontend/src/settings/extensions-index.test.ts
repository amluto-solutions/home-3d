// The Settings search also finds what lives on the Extensions tab (#302): its cards and main rows have search words
// like the settings do, a hit says it is on the Extensions tab, and opening one asks the tab to scroll to its card.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { englishTable } from "../i18n.ts";
import type { HomeAssistant } from "../types.ts";
import { SEASON_IDS } from "../season-ids.ts";
import { extensionAnchor } from "./extension-anchor.ts";
import { EXTENSION_ENTRIES, extensionLabel, HOLIDAYS, searchExtensions } from "./extensions-index.ts";
import { sampleBuilding } from "./settings.fixture.ts";

const en = englishTable() as Record<string, string>;
const text = (k: string) => en[k] ?? k;
const anchors = (q: string) => searchExtensions(q, text).map((e) => e.anchor);

test("every Extensions entry has 3 to 8 plain English words, none repeated, and names that exist", () => {
  assert.ok(EXTENSION_ENTRIES.length > 20);
  for (const e of EXTENSION_ENTRIES) {
    const name = extensionLabel(e, text);
    assert.ok(e.words.length >= 3 && e.words.length <= 8, `${name} has ${e.words.length} words`);
    assert.equal(new Set(e.words).size, e.words.length, `${name} repeats a word`);
    for (const w of e.words) assert.match(w, /^[a-z]+(-[a-z]+)?$/, `${name}: "${w}"`);
    for (const k of e.label) assert.ok(en[k], `${k} is a text key`);
  }
});

test("the Settings page only imports the index's type, so the index stays in the search chunk", () => {
  const page = readFileSync(new URL("./settings-page.ts", import.meta.url), "utf8");
  assert.ok(!/^import \{[^}]*\} from "\.\/(extensions-index|search-words)\.ts"/m.test(page));
});

test("every anchor is a card or row the Extensions tab marks with data-ext", () => {
  const src = readFileSync(new URL("../components/extensions.ts", import.meta.url), "utf8") + readFileSync(new URL("../components/season-dates.ts", import.meta.url), "utf8");
  for (const a of new Set(EXTENSION_ENTRIES.map((e) => e.anchor))) {
    const season = /^season:(.+)$/.exec(a);
    if (season) assert.ok(SEASON_IDS.includes(season[1] as never), a);
    else assert.ok(src.includes(`data-ext="${a}"`), `${a} is marked on the tab`);
  }
  assert.ok(src.includes("data-ext=${`season:${v.id}`}"), "each holiday's dates are marked");
});

test("'holiday dates' finds the holidays' dates, which only the Extensions tab has", () => {
  assert.ok(anchors("holiday dates").includes("holidays"));
  assert.ok(anchors("holidays").includes("holidays"));
  assert.equal(extensionLabel(searchExtensions("holiday dates", text)[0], text), "Holidays · Dates");
});

test("the index lists the same holidays as the calendar", () => {
  assert.deepEqual(HOLIDAYS, [...SEASON_IDS]);
});

test("each holiday is found by its name with 'dates', and opens at its own row", () => {
  assert.ok(anchors("christmas dates").includes("season:christmas"));
  assert.deepEqual(anchors("halloween date"), ["season:halloween"]);
  for (const id of SEASON_IDS) assert.ok(anchors(`${text(`season_name_${id}`)} dates`).includes(`season:${id}`), id);
});

test("the other cards are found by their words", () => {
  const cases: [string, string][] = [
    ["pet eyes", "pets"],
    ["fur colour", "pets"],
    ["update how often", "updates"],
    ["github", "packs"],
    ["upload zip", "packs"],
    ["translation", "languages"],
    ["custom furniture", "items"],
    ["extension settings", "modules"],
    ["fun extras", "fun"],
  ];
  for (const [q, a] of cases) assert.ok(anchors(q).includes(a), `${q} finds ${a}`);
  assert.deepEqual(anchors("zzzz"), []);
  assert.deepEqual(anchors("  "), []);
});

test("the old fun page's settings open the tab at their card", () => {
  assert.equal(extensionAnchor("seasons.easter"), "season:easter");
  assert.equal(extensionAnchor("halloween.ghost"), "season:halloween");
  assert.equal(extensionAnchor("pets.list"), "pets");
  assert.equal(extensionAnchor("easter_eggs"), "fun");
  assert.equal(extensionAnchor("units"), null);
  assert.equal(extensionAnchor(null), null);
});

// ---- the page

const { SettingsPage } = await import("./settings-page.ts");

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function page(editor = true): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (SettingsPage as any)();
  p.hass = { language: "en", user: { id: "u1", is_admin: editor, name: "x" }, states: {}, connection: {}, callWS: async () => ({}), callService: async () => ({}) } as unknown as HomeAssistant;
  p.building = sampleBuilding();
  p.canEdit = editor;
  p.t = text;
  p.homeName = "Sample Home";
  p._extIndex = await import("./extensions-index.ts");
  return p;
}

const key = (k: string) => ({ key: k, preventDefault: () => undefined, stopPropagation: () => undefined }) as unknown as KeyboardEvent;

test("a search hit on the Extensions tab says so, and Enter opens the tab at its card", async () => {
  const p = await page();
  p._query = "holiday dates";
  p.willUpdate(new Map());
  const out = flat(p.render());
  assert.ok(out.includes("Holidays · Dates"));
  assert.ok(out.includes(`${text("ext_tab")} ›`), "the card is headed by the Extensions tab");
  assert.match(out, /data-ext-hit="?holidays/);
  const events: { action: string; focus?: string | null }[] = [];
  p.dispatchEvent = (e: CustomEvent) => (events.push(e.detail), true);
  p.searchKey(key("Enter"));
  assert.equal(events.length, 1);
  assert.equal(events[0].action, "extensions");
  assert.equal(events[0].focus, "holidays");
  assert.equal(p._query, "");
});

test("the arrow keys walk from the settings on to the Extensions hits", async () => {
  const p = await page();
  p._query = "pets";
  p.willUpdate(new Map());
  const settingsHits = p.hits("pets").length;
  assert.ok(settingsHits > 0 && p.extHits("pets").length > 0);
  p._cursor = 0;
  for (let i = 0; i < settingsHits; i++) p.searchKey(key("ArrowDown"));
  assert.equal(p._cursor, settingsHits, "the first Extensions hit");
  assert.match(flat(p.render()), new RegExp(`id="?st-hit-${settingsHits}`));
  p.searchKey(key("ArrowUp"));
  assert.equal(p._cursor, settingsHits - 1);
});

test("people who cannot edit do not get Extensions hits (they have no such tab)", async () => {
  const p = await page(false);
  assert.deepEqual(p.extHits("holiday dates"), []);
});

test("a hit on a setting of the old fun page opens the Extensions tab, naming the setting", async () => {
  const p = await page();
  const events: { id: string | null }[] = [];
  p.dispatchEvent = (e: CustomEvent) => (events.push(e.detail), true);
  p.open("fun", "seasons.easter");
  p.open("fun", "pets.list");
  p.open("fun");
  // the page names the setting; the panel turns it into the card (extensionAnchor, above)
  assert.deepEqual(events.map((e) => e.id ?? null), ["seasons.easter", "pets.list", null]);
});
