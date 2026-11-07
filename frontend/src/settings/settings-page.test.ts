// The Settings page (#139) built in plain Node, its lit templates flattened to text: every registered setting draws its
// row in its section, house rows lock for viewers who aren't editors, and search shows matches across sections.
import assert from "node:assert/strict";
import { test } from "node:test";
import { englishTable } from "../i18n.ts";
import { setAskHost } from "../ask.ts";
import type { HomeAssistant } from "../types.ts";
import { liveSections, settingsIn, type SettingsEnv } from "./registry.ts";
import { sampleBuilding } from "./settings.fixture.ts";

const { SettingsPage } = await import("./settings-page.ts");
const en = englishTable() as Record<string, string>;
const t = (k: string, vars: Record<string, string | number> = {}) => {
  let s = en[k] ?? k;
  for (const [n, v] of Object.entries(vars)) s = s.replace(`{${n}}`, String(v));
  return s;
};
const tr = t;

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

function hass(admin: boolean): HomeAssistant {
  return { language: "en", user: { id: "u1", is_admin: admin, name: "x" }, states: {}, connection: {}, callWS: async () => ({}), callService: async () => ({}) } as unknown as HomeAssistant;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function page(editor = true, admin = true): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (SettingsPage as any)();
  p.hass = hass(admin);
  p.building = sampleBuilding();
  p.canEdit = editor;
  p.t = t;
  p.homeName = "Sample Home";
  return p;
}

function sectionText(p: { _section: string; willUpdate(c: Map<string, unknown>): void; render(): unknown }, id: string): string {
  p._section = id;
  p.willUpdate(new Map());
  return flat(p.render());
}

test("every section draws a row for each of its settings, with its label", () => {
  const p = page();
  const env: SettingsEnv = { building: p.building, hass: p.hass, prefs: { get: () => null, set: () => undefined }, remote: {} };
  for (const sec of liveSections(env)) {
    const text = sectionText(p, sec.id);
    assert.match(text, new RegExp(tr(sec.title).replace(/[.*+?^${}()|[\]\\&]/g, "\\$&")), sec.id);
    for (const s of settingsIn(sec.id, env)) {
      assert.ok(text.includes(`data-id=${s.id}`) || text.includes(`data-id="${s.id}"`), `${s.id} row`);
      assert.ok(text.includes(tr(s.label)), `${s.id} label "${tr(s.label)}"`);
    }
  }
});

test("a viewer who isn't an editor sees the house rows locked, with one note", () => {
  const text = sectionText(page(false, false), "general");
  assert.ok(text.includes(tr("st_locked")));
  assert.ok(sectionText(page(true, false), "general").indexOf(tr("st_locked")) < 0);
});

test("search shows matching rows of every section at once", () => {
  const p = page();
  p._query = "doorbell";
  p.willUpdate(new Map());
  const text = flat(p.render());
  assert.ok(text.includes("data-id=director.doorbell") || text.includes('data-id="director.doorbell"'));
  assert.match(text, /st-hit/);
  p._query = "zzzz";
  assert.ok(flat(p.render()).includes(tr("st_search_none", { q: "zzzz" })));
});

test("a deep link opens its section and marks the row", () => {
  const p = page();
  p.section = "cameras";
  p.focusId = "effects.camera_seconds";
  p.willUpdate(new Map([["section", null], ["focusId", null]]));
  assert.equal(p._section, "cameras");
  assert.equal(p._flash, "effects.camera_seconds");
  clearTimeout(p.flashTimer);
});

test("every registered setting renders its own row, hidden ones included (their visible-when only hides them)", async () => {
  const { SETTINGS } = await import("./registry.ts");
  const p = page();
  for (const s of SETTINGS) {
    const text = flat(p.renderRow(s, false));
    assert.ok(text.includes(`data-id=${s.id}`) || text.includes(`data-id="${s.id}"`), `${s.id} row`);
    assert.ok(s.id === "editors" || text.includes(tr(s.label)), `${s.id} label`);
    // no badge on every row any more (#248): the page says once who it affects
    assert.doesNotMatch(text, /st-scope/, `${s.id}: no scope badge`);
  }
});

test("resetting this device's preferences removes every key a device row keeps, and only those", async () => {
  const { deviceKeys } = await import("./registry.ts");
  const store = new Map<string, string>([["home3d.quality", "low"], ["home3d.theme", "day"], ["home3d.director", "1"], ["home3d.clean", "1"], ["home3d.lab", "1"]]);
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  };
  try {
    const p = page();
    const events: string[] = [];
    p.dispatchEvent = (e: Event) => (events.push(e.type), true);
    // it asks first (#255): a No changes nothing
    const answers = [false, true];
    let asked = 0;
    setAskHost({ ask: async () => (asked++, { ok: answers.shift()!, value: "" }) });
    p.act({ id: "reset_device" }, "reset_device");
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(asked, 1);
    assert.equal(store.size, 5, "cancelled: nothing reset");
    assert.deepEqual(events, []);
    p.act({ id: "reset_device" }, "reset_device");
    await new Promise((r) => setTimeout(r, 0));
    assert.deepEqual([...store.keys()], ["home3d.lab"]);
    assert.deepEqual(events, ["device-change"]);
    assert.ok(deviceKeys().includes("quality") && deviceKeys().includes("voicePipeline"));
  } finally {
    setAskHost(null);
    delete (globalThis as Record<string, unknown>).localStorage;
  }
});

test("an imperial plan's length rows are text boxes in feet and inches (#117)", () => {
  const p = page();
  p.building = { ...p.building, settings: { ...p.building.settings, units: "imperial" } };
  const text = sectionText(p, "general");
  assert.match(text, /st-len/);
  assert.ok(text.includes('9.4"'), "exterior wall 0.24 m");
  assert.ok(!text.includes("(ft)"), "no unit on a length that shows its own marks (#344)");
  const metric = sectionText(page(), "general");
  assert.doesNotMatch(metric, /st-len/);
});
