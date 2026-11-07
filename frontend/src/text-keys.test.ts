// #238: every text the pages name has English words. The Settings page showed its keys (st_sec_general, st_group_house
// …) on a page whose main bundle was older than the Settings bundle; these tests fail when a key used anywhere has no
// English text, when two main bundles on one page lose each other's texts, and when the Settings page is lent texts
// without its own.
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { english, englishTable, registerEnglish, translate } from "./i18n.ts";
import { GROUPS, SECTIONS, SETTINGS, type Option, type SettingsEnv } from "./settings/registry.ts";
import { sampleBuilding, sampleHass } from "./settings/settings.fixture.ts";

const en = englishTable() as Record<string, string>;

/** The source files the bundles are built from (no tests, no fixtures). */
function sources(dir: URL): URL[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) return sources(new URL(`${e.name}/`, dir));
    return /\.ts$/.test(e.name) && !/\.(test|fixture)\.ts$/.test(e.name) ? [new URL(e.name, dir)] : [];
  });
}

test("every literal key a t(), tr() or translate() call names has English text", () => {
  const missing: string[] = [];
  let calls = 0;
  for (const file of sources(new URL("./", import.meta.url))) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/(?<![\w$])(?:t|tr|translate\([^,()]*,)\s*\(?\s*"([a-z][a-z0-9_]*)"/g)) {
      calls++;
      if (!(m[1] in en)) missing.push(`${file.pathname.split("/src/")[1]}: ${m[1]}`);
    }
    // the Settings page's keys sit in its registry as plain strings (TextKey), not in calls
    for (const m of src.matchAll(/"(st_[a-z0-9_]+)"/g)) if (!(m[1] in en)) missing.push(`${file.pathname.split("/src/")[1]}: ${m[1]}`);
  }
  assert.ok(calls > 500, `the scan found the calls (${calls})`);
  assert.deepEqual(missing, []);
});

test("every Settings group, section, card, row, button and choice has English text", () => {
  const env: SettingsEnv = { building: sampleBuilding(), hass: sampleHass(), prefs: { get: () => null, set: () => undefined }, lastView: null, remote: {} };
  const keys = new Set<string>();
  for (const g of GROUPS) keys.add(g.title);
  for (const s of SECTIONS) {
    keys.add(s.title);
    keys.add(s.hint);
    for (const c of s.cards) keys.add(c.title);
  }
  const labels = (options: Option[]) => options.filter((o) => !o.raw).forEach((o) => keys.add(o.label));
  for (const s of SETTINGS) {
    keys.add(s.label);
    if (s.hint) keys.add(s.hint);
    const c = s.control;
    if (c.kind === "action") keys.add(c.button);
    if (c.kind === "text" && c.placeholder) keys.add(c.placeholder);
    if (c.kind === "segment") labels(typeof c.options === "function" ? c.options(env) : c.options);
    if (c.kind === "select") labels(c.options(env));
    if (c.kind === "checks") labels(c.options);
  }
  assert.ok(keys.size > 100, `the registry was read (${keys.size} keys)`);
  assert.deepEqual([...keys].filter((k) => !(k in en)), []);
});

test("a second main bundle on the page keeps the first one's texts (merged, the later one's words first)", () => {
  const own = english();
  try {
    registerEnglish({ only_old: "Old", shared_key: "Old words" });
    registerEnglish({ only_new: "New", shared_key: "New words" });
    const hass = { language: "en" } as never;
    assert.equal(translate(hass, "only_old" as never), "Old");
    assert.equal(translate(hass, "only_new" as never), "New");
    assert.equal(translate(hass, "shared_key" as never), "New words");
    // the main bundle's own table is still all there
    assert.equal(translate(hass, "st_sec_general"), en.st_sec_general);
  } finally {
    registerEnglish(own);
  }
});

test("the Settings page lent texts without its own says the update is there, in words, instead of showing keys", async () => {
  const { SettingsPage } = await import("./settings/settings-page.ts");
  // an older main bundle's texts: no st_ keys (they moved into the main table in #217)
  const older = Object.fromEntries(Object.entries(en).filter(([k]) => !k.startsWith("st_")));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (SettingsPage as any)();
  p.hass = sampleHass();
  p.building = sampleBuilding();
  p.canEdit = true;
  p.t = (k: string) => older[k] ?? k;
  const flat = (v: unknown): string => {
    if (v === null || v === undefined || typeof v !== "object") return typeof v === "string" || typeof v === "number" ? String(v) : "";
    if (Array.isArray(v)) return v.map(flat).join("");
    const r = v as { strings?: readonly string[]; values?: unknown[] };
    return r.strings ? r.strings.map((s, i) => s + (i < r.values!.length ? flat(r.values![i]) : "")).join("") : "";
  };
  p.willUpdate(new Map());
  const text = flat(p.render());
  assert.ok(text.includes(en.update_ready), text);
  assert.ok(text.includes(en.reload_page));
  assert.doesNotMatch(text, /\bst_[a-z]/);
  // with the page's own texts it draws the settings
  p.t = (k: string) => en[k] ?? k;
  assert.match(flat(p.render()), new RegExp(en.st_sec_general));
});
