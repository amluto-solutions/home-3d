import assert from "node:assert/strict";
import { test } from "node:test";
import { uiLanguage, useLanguage } from "./i18n.ts";
import type { HomeAssistant } from "./types.ts";

// #196 (A11Y-10): the panel, cards and card editor carry a `lang` attribute naming the language their texts are in,
// so a screen reader reads German texts with a German voice and the English fallback with an English one.

const hass = (language: string) => ({ language }) as unknown as HomeAssistant;

test("the page language is Home Assistant's when its texts are here, else English", () => {
  assert.equal(uiLanguage(hass("en-GB")), "en-GB");
  // no texts for Swedish yet: the page shows English, and says so
  assert.equal(uiLanguage(hass("sv")), "en");
  useLanguage("sv", {});
  assert.equal(uiLanguage(hass("sv")), "en", "an empty table is English too");
  useLanguage("sv", { view: "Vy" });
  assert.equal(uiLanguage(hass("sv")), "sv");
  assert.equal(uiLanguage(hass("sv-FI")), "sv-FI");
});
