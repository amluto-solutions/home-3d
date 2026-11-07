import assert from "node:assert/strict";
import { test } from "node:test";
import type { LibraryEntry } from "../library-index.ts";

const { FurnitureLibrary } = await import("./library.ts");

const stool = { key: "stool", type: "stool", label: "Stool", kind: "seating", rooms: ["kitchen"], electric: false, light: false, outdoor: false, search: "stool", size: [0.4, 0.4, 0.6] } as unknown as LibraryEntry;

/** A library opened in a kitchen, with every filter switched on. */
function filtered() {
  const lib = new FurnitureLibrary() as unknown as Record<string, any>;
  lib.entries = [stool];
  lib.roomHint = "kitchen";
  lib.willUpdate(new Map([["roomHint", null], ["entries", null]]));
  lib.setRoom("bath");
  lib._electric = lib._light = lib._outdoor = true;
  lib._pack = "acme.mixed";
  lib._query = "stool";
  return lib;
}

test("Clear filters switches every chip off and shows all rooms, the typed words stay (#77)", () => {
  const lib = filtered();
  assert.deepEqual(lib.activeFilters, ["room", "pack", "electric", "light", "outdoor"]);
  lib.clearFilters();
  assert.deepEqual(lib.filter, { query: "stool", room: null, electric: false, light: false, outdoor: false, pack: null });
  assert.deepEqual(lib.activeFilters, []);
});

test("placing an item resets the filters: chips off, the room chip back on the open room (#77)", () => {
  const lib = filtered();
  const added: unknown[] = [];
  lib.addEventListener("library-add", (e: Event) => added.push((e as CustomEvent).detail));
  lib.pick(stool);
  assert.deepEqual(added, [{ type: "stool", mirror: false }]);
  assert.deepEqual(lib.filter, { query: "stool", room: "kitchen", electric: false, light: false, outdoor: false, pack: null });
  // the preset follows the open room again
  lib.roomHint = "bath";
  lib.willUpdate(new Map([["roomHint", "kitchen"]]));
  assert.equal(lib.filter.room, "bath");
});

test("the Recently used block folds away and back, and starts open (#78)", () => {
  const lib = new FurnitureLibrary() as unknown as Record<string, any>;
  assert.equal(lib._recentShut, false);
  const open = (): boolean => {
    const t = lib.section("recent", "Recently used", [], false);
    return t.values.some((v: unknown) => v === true);
  };
  assert.equal(open(), true);
  lib.toggleRecent();
  assert.equal(lib._recentShut, true);
  assert.equal(open(), false);
  lib.toggleRecent();
  assert.equal(lib._recentShut, false);
});

/** A library with two sections (sofas and seating) and one favourite, as the headers see it (#211). */
function sectioned() {
  const mk = (key: string, kind: string, label: string) => ({ ...stool, key, type: key, kind, label, rooms: [], search: label.toLowerCase() }) as unknown as LibraryEntry;
  const lib = new FurnitureLibrary() as unknown as Record<string, any>;
  lib.entries = [mk("couch", "sofa", "Couch"), mk("chair", "seating", "Chair")];
  lib._open = null;
  lib._fav = ["couch"];
  lib._shut = new Set();
  lib._searchShut = new Set();
  lib.render();
  return lib;
}

test("the first section is open by default and can be closed (#211)", () => {
  const lib = sectioned();
  assert.equal(lib.isOpen("sofa", false), true);
  assert.equal(lib.isOpen("seating", false), false);
  lib.toggleOpen("sofa", false);
  assert.equal(lib.isOpen("sofa", false), false);
  lib.toggleOpen("sofa", false);
  assert.equal(lib.isOpen("sofa", false), true);
});

test("opening one section leaves the others as they are, any number open at once (#211)", () => {
  const lib = sectioned();
  lib.toggleOpen("seating", false);
  assert.equal(lib.isOpen("sofa", false), true);
  assert.equal(lib.isOpen("seating", false), true);
  lib.toggleOpen("sofa", false);
  assert.equal(lib.isOpen("sofa", false), false);
  assert.equal(lib.isOpen("seating", false), true);
});

test("Favourites and Other rooms headers fold away and back (#211)", () => {
  const lib = sectioned();
  for (const key of ["fav", "other-rooms"]) {
    assert.equal(lib.isOpen(key, false), true);
    lib.toggleOpen(key, false);
    assert.equal(lib.isOpen(key, false), false);
    lib.toggleOpen(key, false);
    assert.equal(lib.isOpen(key, false), true);
  }
});

test("during a search every section shows expanded and its header still folds it (#211)", () => {
  const lib = sectioned();
  lib.setQuery("c");
  assert.equal(lib.isOpen("seating", true), true);
  assert.equal(lib.isOpen("fav", true), true);
  lib.toggleOpen("seating", true);
  assert.equal(lib.isOpen("seating", true), false);
  lib.toggleOpen("seating", true);
  assert.equal(lib.isOpen("seating", true), true);
  // folding during a search does not touch the remembered sections, and ends with the search
  lib.toggleOpen("sofa", true);
  assert.equal(lib.isOpen("sofa", false), true);
  lib.setQuery("");
  assert.equal(lib.isOpen("sofa", true), true);
});

test("the open sections are remembered per device, including all closed (#211)", () => {
  const store = new Map<string, string>();
  (globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  try {
    const lib = sectioned();
    lib.toggleOpen("sofa", false);
    assert.equal(store.get("home3d.lib.open"), "[]");
    const again = new FurnitureLibrary() as unknown as Record<string, any>;
    assert.equal(again.isOpen("sofa", false), false);
    lib.toggleOpen("fav", false);
    assert.equal(store.get("home3d.lib.shut"), '["fav"]');
  } finally {
    delete (globalThis as any).localStorage;
  }
});

test("a pack update draws its pictures again and queued items are asked for anew (#192)", () => {
  const lib = new FurnitureLibrary() as unknown as Record<string, any>;
  const v1 = { ...stool, packRelease: 1 } as LibraryEntry;
  const other = { ...stool, key: "bench", type: "bench", packRelease: 1 } as LibraryEntry;
  lib.entries = [v1, other];
  lib._thumbs = new Map([["stool|1", "data:stool"]]);
  // "bench" was queued but never drawn: it stays wanted unless the change resets it
  lib.wanted = new Set(["stool|1", "bench|1"]);
  lib.queue = [other];
  lib.thumb = async () => "data:x";
  // the pack is updated: release 2
  lib.entries = [{ ...v1, packRelease: 2 } as LibraryEntry, { ...other, packRelease: 1 } as LibraryEntry];
  lib.willUpdate(new Map([["entries", null]]));
  assert.equal(lib._thumbs.has("stool|1"), false, "the old release's picture is dropped");
  assert.equal(lib.wanted.has("bench|1"), false, "queued, never drawn: asked for again");
  assert.deepEqual(lib.queue, []);
  lib.want(lib.entries[1]);
  assert.equal(lib.queue.length + lib.drawing >= 1, true, "it can be queued again");
});

test("pictures of the unchanged items survive a change of the entries (#192)", () => {
  const lib = new FurnitureLibrary() as unknown as Record<string, any>;
  const e = { ...stool, packRelease: 3 } as LibraryEntry;
  lib.entries = [e];
  lib._thumbs = new Map([["stool|3", "data:stool"]]);
  lib.wanted = new Set(["stool|3"]);
  lib.willUpdate(new Map([["entries", null]]));
  assert.equal(lib._thumbs.get("stool|3"), "data:stool");
  assert.equal(lib.wanted.has("stool|3"), true);
});

test("the Recently used block is hidden while a search is typed (#192)", () => {
  const lib = new FurnitureLibrary() as unknown as Record<string, any>;
  lib.entries = [stool];
  lib._recent = ["stool"];
  const text = (v: unknown): string => JSON.stringify(v, (_k, x) => (typeof x === "function" ? undefined : x));
  assert.ok(text(lib.render()).includes("lib_recent"));
  lib._query = "stool";
  assert.equal(text(lib.render()).includes("lib_recent"), false);
});

test("the sticky search header is opaque and reaches up over the panel's top padding (#320)", async () => {
  const { readFileSync } = await import("node:fs");
  const css = readFileSync(new URL("./library.ts", import.meta.url), "utf8");
  const rule = css.slice(css.indexOf(".fp3d-lib-top {"), css.indexOf(".fp3d-lib-bar {"));
  assert.match(rule, /position: sticky/);
  assert.match(rule, /background: var\(--fp3d-chrome-solid/);
  assert.match(rule, /box-shadow: 0 -\d+px 0 var\(--fp3d-chrome-solid/, "the strip above the header is painted too");
});
