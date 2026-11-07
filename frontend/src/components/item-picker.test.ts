// The item picker's list (#293): fuzzy search, pack and type filters, only the rows in view, driven in plain Node (no DOM).

import assert from "node:assert/strict";
import { test } from "node:test";
import type { LibraryEntry } from "../library-index.ts";

const { ItemPicker } = await import("./item-picker.ts");

function entry(type: string, label: string, kind: LibraryEntry["kind"], pack: string | null): LibraryEntry {
  return { type, key: type, label, search: `${label} ${type}`.toLowerCase(), tags: label.toLowerCase(), kind, rooms: [], electric: false, light: false, outdoor: false, size: [1, 1, 1], pack, packLabel: pack, packRelease: 1, family: null, variant: null, ikea: null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function picker(entries: LibraryEntry[]): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = new ItemPicker() as any;
  el.entries = entries;
  return el;
}

const many = Array.from({ length: 400 }, (_, i) => entry(`pack:acme:chair_${i}`, `Chair ${i}`, "seating", "acme"));
const all = [entry("sofa", "Sofa", "sofa", null), entry("lamp_floor", "Floor lamp", "lamp", null), entry("pack:acme:lamp_x", "Desk lamp", "lamp", "acme"), ...many];

test("typing finds items by name; the pack and type filters narrow the list (#293)", () => {
  const el = picker(all);
  el._q = "lamp";
  assert.deepEqual(new Set(el.hits.map((e: LibraryEntry) => e.type)), new Set(["lamp_floor", "pack:acme:lamp_x"]));
  el._pack = "~basic";
  assert.deepEqual(el.hits.map((e: LibraryEntry) => e.type), ["lamp_floor"]);
  el._q = "";
  el._pack = "acme";
  el._kind = "lamp";
  assert.deepEqual(el.hits.map((e: LibraryEntry) => e.type), ["pack:acme:lamp_x"]);
});

test("the list is virtual: a few hundred items put only the rows in view into the page, and the item in use comes first", () => {
  const el = picker(all);
  el.current = "pack:acme:chair_7";
  assert.equal(el.hits[0].type, "pack:acme:chair_7");
  const v = el.visible();
  assert.ok(v.rows.length < 20, `${v.rows.length} rows drawn`);
  assert.equal(v.before + v.after + v.rows.length * 48, el.hits.length * 48);
  el._top = 48 * 100;
  assert.ok(el.visible().before > 0);
});
