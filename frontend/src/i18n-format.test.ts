import assert from "node:assert/strict";
import { test } from "node:test";
import { formatNumber } from "./i18n-core.ts";
import type { HomeAssistant } from "./types.ts";

const hass = (language: string) => ({ language }) as unknown as HomeAssistant;

test("numbers are formatted in the user's language, with the digits asked for (run 6 speed: one format kept per language)", () => {
  assert.equal(formatNumber(hass("en"), 1234.567, 1), "1,234.6");
  assert.equal(formatNumber(hass("de"), 1234.567, 1), "1.234,6");
  assert.equal(formatNumber(hass("de"), 1234.567, 2), "1.234,57");
  assert.equal(formatNumber(hass("en"), 2, 2), "2");
  // again: the kept format gives the same
  assert.equal(formatNumber(hass("de"), 0.5, 1), "0,5");
  assert.equal(formatNumber(undefined, 3.25, 1), (3.25).toLocaleString(undefined, { maximumFractionDigits: 1 }));
});

test("a language tag the browser does not know falls back to its own format instead of throwing", () => {
  assert.equal(formatNumber(hass("not a tag!"), 1.5, 1), (1.5).toLocaleString(undefined, { maximumFractionDigits: 1 }));
});
