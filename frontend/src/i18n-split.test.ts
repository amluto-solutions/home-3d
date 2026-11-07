import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { test } from "node:test";
import { bundledLanguages } from "./bundled-languages.fixture.ts";
import { de } from "./german.fixture.ts";
import { englishTable, languageCode, languageReady, loadLanguage, translate, useLanguage } from "./i18n.ts";
import type { HomeAssistant } from "./types.ts";

// #134: the German table is not built into the bundles. #196: it is a language pack that comes with Home 3D, sent by
// Home Assistant (home_3d/languages/get) like any installed language pack; English is the fallback for every key.

// The English table (the bundles carry only this one) and the source, to check no German is left in it.
const src = readFileSync(new URL("./i18n.ts", import.meta.url), "utf8") + readFileSync(new URL("./i18n-late.ts", import.meta.url), "utf8");
const en: Record<string, string> = englishTable();
const holes = (s: string) => (s.match(/\{[a-z_]+\}/g) ?? []).sort().join();
const DE = { language: "de" } as unknown as HomeAssistant;

/** A Home Assistant that answers languages/get from `packs` (language -> texts), and notes what it was asked. */
function packHass(packs: Record<string, Record<string, string>>) {
  const asked: Record<string, unknown>[] = [];
  const hash = (strings: Record<string, string>) => `h${Object.keys(strings).length}:${Object.values(strings).join("").length}`;
  return {
    asked,
    callWS: async <T,>(msg: Record<string, unknown>): Promise<T> => {
      asked.push(msg);
      const strings = packs[msg.language as string] ?? {};
      const h = hash(strings);
      return (msg.hash === h ? { language: msg.language, hash: h } : { language: msg.language, hash: h, strings }) as T;
    },
  };
}

/** localStorage in Node, as a browser has it. */
const stored = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage ??= {
  getItem: (k: string) => stored.get(k) ?? null,
  setItem: (k: string, v: string) => void stored.set(k, v),
  removeItem: (k: string) => void stored.delete(k),
};

test("German comes from its language pack in Home Assistant, not from a bundle or a file (#134, #196)", async () => {
  assert.equal(languageCode("de"), "de");
  assert.equal(languageCode("de-AT"), "de");
  assert.equal(languageCode("en-GB"), null);
  assert.equal(languageCode("no"), "nb");
  // any language can have a pack, not only the ones with a file
  assert.equal(languageCode("uk-UA"), "uk");
  assert.equal(languageReady("de"), false);
  // before its texts are there, German reads English rather than a key
  assert.equal(translate(DE, "rack_edit"), "Edit rack");
  for (const k of ["rack_edit", "no_building", "open_editor"] as const) assert.ok(!src.includes(JSON.stringify(de[k])), `the pack text of ${k} is not in i18n.ts`);

  const fetched: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (url: string) => {
    fetched.push(String(url));
    return { ok: false, json: async () => ({}) };
  }) as unknown as typeof fetch;
  const hass = packHass({ de });
  try {
    await loadLanguage("de-DE", hass);
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(fetched, [], "German has no file any more");
  assert.deepEqual(hass.asked, [{ type: "home_3d/languages/get", language: "de" }]);
  assert.equal(languageReady("de"), true);
  assert.equal(translate(DE, "rack_edit"), de.rack_edit);
  assert.notEqual(translate(DE, "rack_edit"), "Edit rack");

  // loaded again (a pack was installed): the browser sends the hash of what it kept and gets no texts back
  await loadLanguage("de", hass, true);
  assert.ok((hass.asked[1] as { hash?: string }).hash, "the kept texts' hash is sent");
  assert.equal(translate(DE, "rack_edit"), de.rack_edit);
});

test("a language pack's keys are its texts, and a key it lacks shows in English", async () => {
  const realFetch = globalThis.fetch;
  const fetched: string[] = [];
  globalThis.fetch = (async (url: string) => {
    fetched.push(String(url));
    return { ok: false, json: async () => ({}) };
  }) as unknown as typeof fetch;
  try {
    await loadLanguage("fr-CA", packHass({ fr: { view: "Vue 3D" } }));
    // a language without a pack, and an older Home Assistant that does not know languages/get
    await loadLanguage("uk", { callWS: async () => Promise.reject(new Error("unknown_command")) });
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.deepEqual(fetched, [], "no language has a file next to the bundles any more (#217)");
  const fr = { language: "fr-CA" } as unknown as HomeAssistant;
  assert.equal(translate(fr, "view"), "Vue 3D");
  assert.equal(translate(fr, "rack_edit"), "Edit rack");
  assert.equal(languageReady("uk"), true);
  assert.equal(translate({ language: "uk" } as unknown as HomeAssistant, "rack_edit"), "Edit rack");
});

test("useLanguage puts a table in place without fetching (tests, preloaded pages)", () => {
  useLanguage("fr", { view: "Vue 3D" });
  assert.equal(translate({ language: "fr" } as unknown as HomeAssistant, "view"), "Vue 3D");
  // a key the table lacks falls back to English
  assert.equal(translate({ language: "fr" } as unknown as HomeAssistant, "rack_edit"), "Edit rack");
});

test("the German table has every English key, no others, with the same placeholders", () => {
  assert.ok(Object.keys(en).length > 2000);
  const deTable = de as Record<string, string>;
  for (const k of Object.keys(en)) {
    assert.equal(typeof deTable[k], "string", `de: ${k} missing`);
    assert.equal(holes(deTable[k]!), holes(en[k]!), `de: ${k} placeholders`);
  }
  for (const k of Object.keys(deTable)) assert.ok(k in en, `de: ${k} is not an English key`);
});

test("every bundled language pack holds only known keys and no unknown placeholders; the rest falls back to English", () => {
  const packs = bundledLanguages();
  assert.ok(packs.length >= 17, `found ${packs.length} bundled language packs`);
  for (const { folder, pack, language, strings } of packs) {
    assert.equal(folder, `amluto.lang-${language}`);
    assert.equal(pack.id, folder);
    assert.equal(pack.kind, "language");
    for (const [k, v] of Object.entries(strings)) {
      assert.ok(k in en, `${folder}: ${k} is not an English key`);
      assert.equal(typeof v, "string", `${folder}: ${k}`);
      // a placeholder English does not have would show as "{x}"
      for (const h of v.match(/{[a-z_]+}/g) ?? []) assert.ok(en[k]!.includes(h), `${folder}: ${k} has ${h}`);
    }
    useLanguage(language, strings);
    const hass = { language } as unknown as HomeAssistant;
    for (const k of Object.keys(en)) assert.notEqual(translate(hass, k as never), k, `${language}: ${k} shows as a raw key`);
  }
});

// Every key the code names literally, by the table it is read from.
const sources = (dir: URL): URL[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(new URL(`${e.name}/`, dir)) : e.name.endsWith(".ts") && !e.name.endsWith(".test.ts") && e.name !== "i18n.ts" && e.name !== "i18n-late.ts" ? [new URL(e.name, dir)] : [],
  );
const CALL = /\b(?:this\.t|t|tr|translate)\(\s*(?:[\w.?]+\s*,\s*)?"([a-z][a-z0-9_]*)"/g;

test("every key the code names exists in English and German (main, editor, card editor, 2D, 3D, voice …)", () => {
  const missing: string[] = [];
  let seen = 0;
  for (const file of sources(new URL("./", import.meta.url))) {
    const text = readFileSync(file, "utf8");
    // files that name keys: they import i18n.ts, or are the editor's area modules (#202), which call the element's this.t
    if (!/\bi18n\.ts"|\bI18nKey\b|translate\(/.test(text) && !file.pathname.includes("/components/editor/")) continue;
    for (const m of text.matchAll(CALL)) {
      const key = m[1]!;
      seen++;
      if (!(key in en) || !(key in de)) missing.push(`${file.pathname.split("/src/")[1]}: ${key}`);
    }
  }
  assert.ok(seen > 1500, `found ${seen} keys`);
  assert.deepEqual(missing, []);
});

test("the item editor's keys are in the English table and the German pack (#217)", () => {
  const text = readdirSync(new URL("./items/", import.meta.url))
    .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"))
    .map((f) => readFileSync(new URL(`./items/${f}`, import.meta.url), "utf8"))
    .join("\n");
  const keys = [...text.matchAll(/"(ie_[a-z0-9_]+)"/g)].map((m) => m[1]!);
  assert.ok(keys.length > 20);
  for (const k of keys) {
    assert.equal(typeof en[k], "string", `en: ${k}`);
    assert.equal(typeof (de as Record<string, string>)[k], "string", `de: ${k}`);
  }
});

test("a language fetched by one bundle is at hand in the others (the editor bundle has its own copy of i18n.ts)", async () => {
  // a second copy of the module, as the editor and card-editor bundles carry one
  const second = "./i18n.ts?second-bundle";
  const copy = (await import(second)) as typeof import("./i18n.ts");
  useLanguage("sv", { view: "Vy" });
  assert.equal(copy.languageReady("sv"), true);
  assert.equal(copy.translate({ language: "sv" } as unknown as HomeAssistant, "view"), "Vy");
});
