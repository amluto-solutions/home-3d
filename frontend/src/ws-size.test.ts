import assert from "node:assert/strict";
import { test } from "node:test";
import { importPackFolder } from "./api.ts";
import { inParts } from "./backup-send.ts";
import { checkFits, messageBytes, MESSAGE_ROOM } from "./ws-size.ts";
import type { HomeAssistant } from "./types.ts";

test("a message is measured as UTF-8 JSON, the way Home Assistant receives it (#375)", () => {
  assert.equal(messageBytes({ a: "é" }), '{"a":"é"}'.length + 1);
  assert.equal(messageBytes({ a: 'say "hi"\n' }), JSON.stringify({ a: 'say "hi"\n' }).length);
  assert.ok(MESSAGE_ROOM < 4 * 1024 * 1024);
  assert.throws(() => checkFits({ files: { "a.json": "é".repeat(MESSAGE_ROOM / 2) } }), { code: "too_large" });
  checkFits({ files: { "a.json": "u".repeat(MESSAGE_ROOM / 2) } });
});

test("items are split into parts that each fit, in order; one item alone too large is named (#375)", () => {
  const items = ["a", "b", "c", "d"].map((id) => ({ id, text: "x".repeat(40) }));
  const split = inParts(items, 130);
  assert.ok("parts" in split);
  assert.deepEqual(split.parts.map((p) => p.map((i) => i.id)), [["a", "b"], ["c", "d"]]);
  for (const part of split.parts) assert.ok(messageBytes(part) <= 130);
  const huge = inParts([items[0], { id: "z", text: "x".repeat(500) }], 130);
  assert.ok("tooLarge" in huge && huge.tooLarge.id === "z");
});

test("a pack folder too large for one message is refused before it is sent (#375)", async () => {
  const calls: unknown[] = [];
  const hass = { callWS: async (msg: unknown) => (calls.push(msg), {}) } as unknown as HomeAssistant;
  await assert.rejects(importPackFolder(hass, { "pack.json": "{}", "big.json": "é".repeat(2_200_000) }), { code: "too_large" });
  assert.deepEqual(calls, []);
  await importPackFolder(hass, { "pack.json": "{}" });
  assert.equal(calls.length, 1);
});
