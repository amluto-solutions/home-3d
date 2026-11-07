import assert from "node:assert/strict";
import { test } from "node:test";
import { announce, announced, lookAnnouncement, viewChange, type AnnounceDoc } from "./announce.ts";
import { englishTable } from "./i18n.ts";

// #196 (A11Y-8): changes that only changed pixels are told to a screen reader through one polite live region.

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeDoc() {
  const appended: Record<string, unknown>[] = [];
  const body = {
    appendChild(el: Record<string, unknown>) {
      appended.push(el);
      el.parentNode = body;
    },
  };
  const doc = {
    body,
    createElement: (tag: string) => {
      const attrs: Record<string, string> = {};
      return { tag, attrs, textContent: "", parentNode: null, setAttribute: (k: string, v: string) => (attrs[k] = v) };
    },
  };
  return { doc: doc as unknown as AnnounceDoc, appended };
}

test("announce writes to one hidden polite live region, and the same text twice is read twice", async () => {
  const { doc, appended } = fakeDoc();
  announce("Floor Upstairs", doc);
  announce("Floor Upstairs", doc);
  assert.equal(appended.length, 1, "one region");
  const region = appended[0] as { attrs: Record<string, string> };
  assert.equal(region.attrs.role, "status");
  assert.equal(region.attrs["aria-live"], "polite");
  assert.match(region.attrs.style!, /clip/);
  // emptied first, filled a moment later: a screen reader hears the repeat
  assert.equal(announced(), "");
  await wait(90);
  assert.equal(announced(), "Floor Upstairs");
  announce("", doc);
  assert.equal(announced(), "Floor Upstairs", "an empty text says nothing");
});

test("a new home or floor is announced, the first load is not", () => {
  assert.equal(viewChange(null, { home: "a", floor: null }), null);
  assert.equal(viewChange({ home: "a", floor: null }, { home: "a", floor: "f1" }), "floor");
  assert.equal(viewChange({ home: "a", floor: "f1" }, { home: "a", floor: null }), "floor");
  // a home switch resets the floor too: the home is what is said
  assert.equal(viewChange({ home: "a", floor: "f1" }, { home: "b", floor: null }), "home");
  assert.equal(viewChange({ home: "a", floor: "f1" }, { home: "a", floor: "f1" }), null);
});

test("picking a look says it, and that the follow switch it turned off is off (F81)", () => {
  const en: Record<string, string> = englishTable();
  const t = (k: string, vars: Record<string, string> = {}) => Object.entries(vars).reduce((s, [a, b]) => s.replace(`{${a}}`, b), en[k] ?? k);
  assert.equal(lookAnnouncement("neon", "day", t), "Appearance: Day");
  assert.equal(lookAnnouncement("theme", "day", t), "Appearance: Day. Follow Home Assistant is off");
  assert.equal(lookAnnouncement("auto", "realistic", t), "Appearance: Realistic. Follow the sun is off");
});
