// The item editor's paste box, brief and preview look (#84), driven as a user would in plain Node (no DOM).

import assert from "node:assert/strict";
import { test } from "node:test";
import { setAskHost, type AskRequest } from "../ask.ts";
import type { HomeAssistant } from "../types.ts";

(globalThis as Record<string, unknown>).__FP3D_VIEWER_HASH__ = "test";
const { ItemEditor } = await import("./item-editor.ts");

const stool = { id: "stool", name: { en: "Stool" }, size: [0.3, 0.3, 0.45], parts: [{ shape: "cyl", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "wood" }] };
const bench = { ...stool, id: "bench", name: { en: "Bench" } };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function editor(): { el: any; saved: unknown[] } {
  const saved: unknown[] = [];
  const hass = {
    language: "en",
    callWS: async (msg: { type: string; item: { id: string } }) => {
      if (msg.item.id === "broken") throw new Error("bad item");
      saved.push(msg.item);
      return { item: msg.item };
    },
  } as unknown as HomeAssistant;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = new ItemEditor() as any;
  el.options = { hass, t: (k: string, v?: object) => (v ? `${k} ${JSON.stringify(v)}` : k), items: [], kinds: ["seating"], rooms: ["living"], roles: ["wood"], changed: () => {} };
  return { el, saved };
}

test("a pasted list of items imports every one, and the paste box stays open, emptied, for the next (#84)", async () => {
  const { el, saved } = editor();
  el._paste = "Here you go:\n```json\n" + JSON.stringify([stool, bench]) + "\n```";
  await el.importPasted();
  assert.deepEqual(
    saved.map((i) => (i as { id: string }).id),
    ["stool", "bench"],
  );
  assert.deepEqual(
    el._items.map((i: { id: string }) => i.id),
    ["stool", "bench"],
  );
  assert.equal(el._paste, "", "open and empty");
  assert.equal(el._msg.ok, true);
});

test("a paste that fails to import keeps its text in the open box (#84)", async () => {
  const { el } = editor();
  el._paste = JSON.stringify([stool, { ...stool, id: "broken" }]);
  await el.importPasted();
  assert.equal(el._paste, JSON.stringify([stool, { ...stool, id: "broken" }]));
  assert.equal(el._msg.ok, false);
  assert.match(el._msg.text, /bad item/);
});

test("the brief for an LLM opens in a dialog to read, and Copy puts it on the clipboard (#84)", async () => {
  const { el } = editor();
  const asked: AskRequest[] = [];
  const answers = [false, true];
  setAskHost({ ask: async (req) => (asked.push(req), { ok: answers.shift()!, value: "" }) });
  const copied: string[] = [];
  Object.defineProperty(globalThis.navigator, "clipboard", { configurable: true, value: { writeText: async (t: string) => void copied.push(t) } });
  try {
    await el.showBrief();
    assert.match(asked[0].detail ?? "", /"parts"/, "the brief itself is shown");
    assert.equal(asked[0].ok, "ie_brief_copy");
    assert.deepEqual(copied, [], "closed without copying");
    await el.showBrief();
    assert.deepEqual(copied, [asked[1].detail]);
    assert.equal(el._note.ok, true);
  } finally {
    setAskHost(null);
    delete (globalThis.navigator as unknown as Record<string, unknown>).clipboard;
  }
});

test("the preview switches between the dark look and a light one, remembered in this browser (#84)", async () => {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) } });
  try {
    const { el } = editor();
    const drawn: boolean[] = [];
    el.picture = async (_item: unknown, _size: number, _yaw: number, _pitch: number, light: boolean) => (drawn.push(light), "data:");
    el._draft = structuredClone(stool);
    await el.draw("a");
    assert.equal(el._light, false, "dark by default, like the rest of the editor");
    el.setLight(true);
    await el.draw("b");
    assert.deepEqual(drawn, [false, true], "the light picture is a light render, not just a light background");
    // a new editor opens in the look picked last
    assert.equal(editor().el._light, true);
  } finally {
    delete (globalThis as Record<string, unknown>).localStorage;
  }
});
