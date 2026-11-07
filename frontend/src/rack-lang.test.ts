import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { bundledLanguages } from "./bundled-languages.fixture.ts";
import { translate } from "./i18n.ts";
import type { HomeAssistant } from "./types.ts";

// The rack strings (#122) in the English table, read from the source.
const src = readFileSync(new URL("./i18n.ts", import.meta.url), "utf8") + readFileSync(new URL("./i18n-late.ts", import.meta.url), "utf8");
const en: Record<string, string> = {};
for (const m of src.slice(src.indexOf("const en")).matchAll(/^ {2}([a-z0-9_]+): ("(?:[^"\\]|\\.)*"),?$/gm)) en[m[1]!] = JSON.parse(m[2]!);
const keys = Object.keys(en).filter((k) => /^(rack_|voice_rack_|card_rack_)/.test(k));
const holes = (s: string) => (s.match(/\{[a-z]+\}/g) ?? []).sort().join();

test("every bundled language pack has the rack strings with the same placeholders", () => {
  assert.ok(keys.length > 60);
  for (const { folder, strings: table } of bundledLanguages()) {
    for (const k of keys) {
      assert.equal(typeof table[k], "string", `${folder}: ${k} missing`);
      assert.equal(holes(table[k]!), holes(en[k]!), `${folder}: ${k} placeholders`);
    }
  }
});

test("a language without the strings falls back to English, not to a key", () => {
  const hass = { language: "xx" } as unknown as HomeAssistant;
  assert.equal(translate(hass, "rack_edit"), "Edit rack");
  assert.equal(translate(hass, "voice_rack_online", { name: "Rack", on: 2, total: 3 }), "Rack: 2 of 3 devices are online.");
});
