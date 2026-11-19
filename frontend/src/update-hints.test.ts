import assert from "node:assert/strict";
import { test } from "node:test";
import { lateEnglish } from "./i18n-late.ts";
import { englishTable } from "./i18n.ts";

// Home Assistant 2026.11 made the Marketplace the home of HACS (#486): a hint that says "update Home 3D" points to
// Settings > System > Updates, which works with the Marketplace and with HACS, and names no HACS menu path.
const main: Record<string, string> = englishTable();
const late: Record<string, string> = lateEnglish;
const HINTS: Array<[string, string]> = [
  ["pack_error_needs_update", "late"],
  ["import_error_too_new", "late"],
  ["plan_too_new", "main"],
];

test("update hints point to Settings > System > Updates and name no HACS menu", () => {
  for (const [key, table] of HINTS) {
    const text = (table === "late" ? late : main)[key];
    assert.ok(text, key);
    assert.match(text, /Settings › System › Updates/, key);
    assert.doesNotMatch(text, /HACS/i, key);
  }
});

test("no English text sends people to a HACS menu", () => {
  for (const table of [main, late]) {
    for (const [key, text] of Object.entries(table)) assert.doesNotMatch(String(text), /HACS/i, key);
  }
});
