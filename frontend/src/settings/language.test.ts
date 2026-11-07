// The language setting (#292): found by search, on This device, Automatic follows Home Assistant, a choice overrides it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { englishTable } from "../i18n.ts";
import { languageCode, setChosenLanguage, uiLanguage } from "../i18n-core.ts";
import { audienceOf, searchSettings, sectionOf, settingById, type SettingsEnv } from "./registry.ts";
import { languageOptions } from "./language.ts";
import { sampleBuilding, sampleHass } from "./settings.fixture.ts";

const en = englishTable() as Record<string, string>;
const prefs = new Map<string, string>();
const env = (): SettingsEnv => ({ building: sampleBuilding(), hass: sampleHass(), prefs: { get: (k) => prefs.get(k) ?? null, set: (k, v) => void (v === null ? prefs.delete(k) : prefs.set(k, v)) } });

test("the language row is a device setting that search finds by language, translation and language names", () => {
  const s = settingById("language")!;
  assert.equal(s.scope, "device");
  assert.equal(audienceOf(sectionOf(s.section)!), "device");
  for (const q of ["language", "translation", "french", "francais"]) {
    assert.ok(searchSettings(q, env(), (k) => en[k] ?? k).some((r) => r.id === "language"), q);
  }
  assert.match(en.st_language_auto!, /Home Assistant/);
});

test("Automatic follows Home Assistant, a chosen language overrides it", () => {
  const s = settingById("language")!;
  const e = env();
  assert.equal(s.read(e), "auto");
  assert.ok(languageOptions().some((o) => o.value === "fr" && o.label === "Français"));
  setChosenLanguage(null);
  assert.equal(languageCode("nl"), "nl");
  s.write!(e, "fr" as never);
  setChosenLanguage(e.prefs.get("language"));
  assert.equal(languageCode("nl"), "fr");
  assert.equal(uiLanguage({ language: "nl" } as never), "en"); // French texts are not loaded here
  setChosenLanguage("auto");
  assert.equal(languageCode("nl"), "nl");
});
