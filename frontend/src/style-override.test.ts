import assert from "node:assert/strict";
import { test } from "node:test";
import { isReset, keepOverride, liveOverride, overrideFor, readOverride, STYLE_OVERRIDE_KEY, styleIsForScreen } from "./style-override.ts";

const store = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k), m };
};

test("a style word makes an override, a reset ends it, an unknown word changes nothing", () => {
  assert.deepEqual(overrideFor("cozy", 30, 1000), { style: "cozy", until: 1000 + 30 * 60000 });
  assert.deepEqual(overrideFor("evening", null, 1000), { style: "evening", until: null });
  assert.deepEqual(overrideFor("Cozy evening", 0, 5, { evening: ["Cozy evening"] }), { style: "evening", until: null });
  assert.equal(overrideFor("reset", 5, 1), null);
  assert.equal(overrideFor("", 5, 1), null);
  assert.equal(isReset(" Reset "), true);
  assert.equal(overrideFor("no such style", 5, 1), undefined);
});

test("an override lasts until its time is up", () => {
  assert.equal(liveOverride({ style: "cozy", until: 2000 }, 1999), "cozy");
  assert.equal(liveOverride({ style: "cozy", until: 2000 }, 2000), null);
  assert.equal(liveOverride({ style: "cozy", until: null }, 9e15), "cozy");
  assert.equal(liveOverride(null, 0), null);
});

test("the screens named: a name matches without case, none named means every screen", () => {
  assert.equal(styleIsForScreen([], "Hall"), true);
  assert.equal(styleIsForScreen(undefined, ""), true);
  assert.equal(styleIsForScreen(["hall"], " Hall "), true);
  assert.equal(styleIsForScreen(["hall"], "Kitchen"), false);
  assert.equal(styleIsForScreen(["hall"], ""), false);
});

test("the override is kept under home3d.style_override and read back until it ends", () => {
  const s = store();
  keepOverride({ style: "cozy", until: 5000 }, s);
  assert.ok(s.m.has(STYLE_OVERRIDE_KEY));
  assert.deepEqual(readOverride(4000, s), { style: "cozy", until: 5000 });
  assert.equal(readOverride(6000, s), null);
  keepOverride(null, s);
  assert.equal(s.m.size, 0);
  s.setItem(STYLE_OVERRIDE_KEY, "{broken");
  assert.equal(readOverride(0, s), null);
  s.setItem(STYLE_OVERRIDE_KEY, JSON.stringify({ style: 3 }));
  assert.equal(readOverride(0, s), null);
});
