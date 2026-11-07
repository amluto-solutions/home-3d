import assert from "node:assert/strict";
import { test } from "node:test";
import { bareIconName, COMMON_ICONS, filterIcons, parseIconList } from "./icon-list.ts";

const list = parseIconList([{ name: "lightbulb", keywords: ["lamp"] }, { name: "lightbulb-on", keywords: [] }, "water-alert", { name: "thermometer", keywords: ["temperature", "heat"] }, { nope: 1 }, 5]);

test("a downloaded icon list keeps only usable entries", () => {
  assert.deepEqual(list.map((e) => e.name), ["lightbulb", "lightbulb-on", "water-alert", "thermometer"]);
  assert.deepEqual(parseIconList({ not: "a list" }), []);
});

test("the search matches names and keywords, best match first, and respects the limit", () => {
  assert.deepEqual(filterIcons(list, "lamp").map((e) => e.name), ["lightbulb"]);
  assert.deepEqual(filterIcons(list, "mdi:lightbulb").map((e) => e.name), ["lightbulb", "lightbulb-on"]);
  assert.deepEqual(filterIcons(list, "water alert").map((e) => e.name), ["water-alert"]);
  assert.deepEqual(filterIcons(list, "temp").map((e) => e.name), ["thermometer"]);
  assert.equal(filterIcons(list, "").length, 4);
  assert.equal(filterIcons(list, "", 2).length, 2);
  assert.deepEqual(filterIcons(list, "zzz"), []);
});

test("typed names lose their mdi: prefix", () => {
  assert.equal(bareIconName(" mdi:thermometer "), "thermometer");
  assert.equal(bareIconName("mdi:"), null);
  assert.equal(bareIconName(null), null);
  assert.ok(COMMON_ICONS.length > 100 && new Set(COMMON_ICONS).size === COMMON_ICONS.length);
});
