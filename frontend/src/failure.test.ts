// A refused service call, a failed upload and a failed restore say so (#171).

import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { callServiceSafe, errorText, setFailureSink } from "./failure.ts";
import { makeEditor, square } from "./components/editor-harness.ts";
import type { HomeAssistant } from "./types.ts";

const shown: string[] = [];
setFailureSink((t) => shown.push(t));
afterEach(() => (shown.length = 0));

const later = () => new Promise((r) => setTimeout(r, 0));

test("a refused service call shows a message with the reason", async () => {
  const hass = { callService: () => Promise.reject({ message: "Entity is unavailable" }) } as unknown as HomeAssistant;
  callServiceSafe(hass, "light", "turn_on", { entity_id: "light.sample_lounge" }, (e) => `failed: ${e}`);
  await later();
  assert.deepEqual(shown, ["failed: Entity is unavailable"]);
});

test("a service call that throws at once shows a message too, and a good one shows nothing", async () => {
  const bad = { callService: () => { throw new Error("offline"); } } as unknown as HomeAssistant;
  callServiceSafe(bad, "light", "turn_on", {}, (e) => e);
  const good = { callService: () => Promise.resolve() } as unknown as HomeAssistant;
  callServiceSafe(good, "light", "turn_on", {}, (e) => e);
  await later();
  assert.deepEqual(shown, ["offline"]);
});

test("errorText reads Home Assistant's error shapes", () => {
  assert.equal(errorText({ code: "not_found" }), "not_found");
  assert.equal(errorText({ error: { message: "boom" } }), "boom");
  assert.equal(errorText("plain"), "plain");
});

test("a restore point that cannot be restored is told, not swallowed", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)]);
  ed.hass = { ...ed.hass, callWS: async () => { throw { message: "disk full" }; } };
  const told: string[] = [];
  ed.ask = async () => true;
  ed.tell = async (text: string) => void told.push(text);
  await ed.restoreFromHistory({ id: "p1", revision: 3, saved_at: 1_700_000_000, floors: 1, rooms: 1, furniture: 0, missing_pictures: 0 });
  assert.equal(told.length, 1);
  assert.match(told[0], /could not be restored: disk full/);
  assert.equal(ed._notice ?? null, null);
});

test("a background that cannot be stored is told", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)]);
  const told: string[] = [];
  ed.tell = async (text: string) => void told.push(text);
  const prev = (globalThis as Record<string, unknown>).createImageBitmap;
  (globalThis as Record<string, unknown>).createImageBitmap = async () => { throw new Error("not an image"); };
  try {
    await ed.uploadBackground({ target: { files: [{}], value: "x" } });
  } finally {
    (globalThis as Record<string, unknown>).createImageBitmap = prev;
  }
  assert.match(told[0], /could not be saved: not an image/);
  assert.equal(ed.floor.background ?? null, null);
});

test("Home Assistant is asked not to toast as well: one failed press, one message (#243)", async () => {
  const args: unknown[][] = [];
  const hass = { callService: (...a: unknown[]) => (args.push(a), Promise.reject({ message: "Validation error" })) } as unknown as HomeAssistant;
  callServiceSafe(hass, "cover", "close_cover", { entity_id: "cover.sample_blind" }, (e) => `That did not work: ${e}`);
  await later();
  assert.deepEqual(args, [["cover", "close_cover", { entity_id: "cover.sample_blind" }, undefined, false]]);
  assert.deepEqual(shown, ["That did not work: Validation error"]);
});

test("a long message is cut short at a word; a short one stays whole (#243)", async () => {
  const { shortFailure, FAILURE_CHARS } = await import("./failure.ts");
  assert.equal(shortFailure("Entity is unavailable"), "Entity is unavailable");
  const long = `Validation error: ${"word ".repeat(80)}end`;
  const short = shortFailure(long);
  assert.ok(short.length <= FAILURE_CHARS + 2 && short.endsWith(" …"), short);
  assert.ok(long.startsWith(short.slice(0, -2)));
});

test("our message sits at the top, clear of Home Assistant's toasts at the bottom centre (#243)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./failure.ts", import.meta.url), "utf8");
  assert.match(src, /position:fixed;left:50%;top:/);
  assert.doesNotMatch(src, /bottom:24px/);
});
