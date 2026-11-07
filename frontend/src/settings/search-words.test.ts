// The search words of every setting (#286): 3 to 8 English words each, no repeats, no list for a setting that doesn't
// exist, and a word finds its setting only once the page has loaded the words (they are a chunk of their own).
import assert from "node:assert/strict";
import { test } from "node:test";
import { englishTable } from "../i18n.ts";
import { SETTINGS, searchSettings, type SettingsEnv } from "./registry.ts";
import { SEARCH_WORDS } from "./search-words.ts";
import { sampleBuilding, sampleHass } from "./settings.fixture.ts";

const en = englishTable() as Record<string, string>;
const text = (k: string) => en[k] ?? k;
const prefs = new Map<string, string>();
const env = (): SettingsEnv => ({ building: sampleBuilding(), hass: sampleHass(), prefs: { get: (k) => prefs.get(k) ?? null, set: (k, v) => void (v === null ? prefs.delete(k) : prefs.set(k, v)) } });

test("every setting has 3 to 8 English search words, none repeated", () => {
  assert.equal(new Set(SETTINGS.map((s) => s.id)).size, SETTINGS.length, "setting ids are unique");
  for (const s of SETTINGS) {
    const words = SEARCH_WORDS[s.id];
    assert.ok(words, `${s.id} has search words`);
    assert.ok(words.length >= 3 && words.length <= 8, `${s.id} has ${words.length} words`);
    assert.equal(new Set(words).size, words.length, `${s.id} repeats a word`);
    for (const w of words) assert.match(w, /^[a-z]+(-[a-z]+)?$/, `${s.id}: "${w}" is not a plain English word`);
  }
});

test("the search words list no setting that does not exist", () => {
  const ids = new Set(SETTINGS.map((s) => s.id));
  for (const id of Object.keys(SEARCH_WORDS)) assert.ok(ids.has(id), `${id} is not a setting`);
});

test("a search word finds its setting once the words are loaded, not before", () => {
  for (const [q, id] of [
    ["pir", "effects.motion_seconds"],
    ["cupid", "seasons.valentines"],
    ["dusk", "window_glow"],
  ] as const) {
    assert.ok(searchSettings(q, env(), text, SEARCH_WORDS).some((s) => s.id === id), `${q} finds ${id}`);
    assert.ok(!searchSettings(q, env(), text).some((s) => s.id === id), `${q} needs the words to find ${id}`);
  }
});
