// The pack index (#336): what the Browse tab shows for a listed pack, its search and filters, and how the index is kept.

import assert from "node:assert/strict";
import { test } from "node:test";
import { allCategories, allPublishers, browsePacks, categoriesOf, forgetPackIndex, loadPackIndex, packStatus, updateCount, type IndexPack, type PackIndex } from "./pack-index.ts";
import type { FurniturePack } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";

function listed(id: string, extra: Partial<IndexPack> = {}): IndexPack {
  return {
    id,
    name: id.split(".")[1],
    description: "",
    publisher: id.split(".")[0],
    licence: "MIT",
    release: 2,
    url: `https://github.com/someone/packs/tree/main/${id}`,
    source: "community",
    kind: "furniture",
    items: 3,
    categories: { seating: 2, lamp: 1 },
    previews: [],
    ...extra,
  };
}

const installed = (id: string, release: number, bundled = false): FurniturePack => ({ id, name: id, publisher: "x", release, bundled, items: [] });

test("a listed pack is available, installed, or has an update; a bundled one cannot be removed", () => {
  const entry = listed("acme.chairs");
  assert.deepEqual(packStatus(entry, []), { state: "available", installed: null, removable: false });
  assert.deepEqual(packStatus(entry, [installed("acme.chairs", 2)]), { state: "installed", installed: 2, removable: true });
  assert.deepEqual(packStatus(entry, [installed("acme.chairs", 1)]), { state: "update", installed: 1, removable: true });
  // a newer release installed than the index lists (the index lags behind): installed, no update
  assert.equal(packStatus(entry, [installed("acme.chairs", 5)]).state, "installed");
  assert.equal(packStatus(entry, [installed("acme.chairs", 2, true)]).removable, false);
});

test("search finds every word in the name, description, publisher or a category; filters narrow by category and publisher", () => {
  const packs = [
    listed("acme.chairs", { description: "Dining chairs and stools" }),
    listed("acme.lights", { categories: { lamp: 4 } }),
    listed("bob.garden", { categories: { outdoor: 9 } }),
    listed("bob.french", { kind: "language", categories: {}, texts: 900 }),
  ];
  const none = { query: "", category: null, publisher: null };
  assert.equal(browsePacks(packs, none, []).length, 4);
  assert.deepEqual(browsePacks(packs, { ...none, query: "dining STOOLS" }, []).map((p) => p.id), ["acme.chairs"]);
  assert.deepEqual(browsePacks(packs, { ...none, query: "garden furniture" }, [], (c) => (c === "outdoor" ? "Garden furniture" : c)).map((p) => p.id), ["bob.garden"]);
  assert.deepEqual(browsePacks(packs, { ...none, category: "lamp" }, []).map((p) => p.id), ["acme.chairs", "acme.lights"]);
  assert.deepEqual(browsePacks(packs, { ...none, category: "language" }, []).map((p) => p.id), ["bob.french"]);
  assert.deepEqual(browsePacks(packs, { ...none, publisher: "bob" }, []).map((p) => p.id), ["bob.garden", "bob.french"]);
  // packs with an update come first
  assert.deepEqual(browsePacks(packs, none, [installed("bob.garden", 1)]).map((p) => p.id)[0], "bob.garden");
  assert.equal(updateCount(packs, [installed("bob.garden", 1), installed("acme.chairs", 2)]), 1);
});

test("the category and publisher lists cover the index, the biggest category first", () => {
  const packs = [listed("acme.chairs"), listed("bob.lights", { categories: { lamp: 10 } }), listed("bob.de", { kind: "language", categories: {} })];
  assert.deepEqual(allCategories(packs), ["lamp", "seating", "language"]);
  assert.deepEqual(allPublishers(packs), ["acme", "bob"]);
  assert.deepEqual(categoriesOf(listed("acme.mixed", { categories: { lamp: 1, decor: 5, bed: 1 } })), ["decor", "bed", "lamp"]);
});

test("the index is asked of Home Assistant once per page; a refresh asks again", async () => {
  forgetPackIndex();
  const calls: Record<string, unknown>[] = [];
  const index: PackIndex = { url: "https://raw.githubusercontent.com/x/y/main/index.json", fetched_at: 1, packs: [listed("acme.chairs")] };
  const hass = { callWS: async (msg: Record<string, unknown>) => (calls.push(msg), index) } as unknown as HomeAssistant;
  assert.equal(await loadPackIndex(hass), index);
  await loadPackIndex(hass);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], { type: "home_3d/packs/index" });
  await loadPackIndex(hass, true);
  assert.deepEqual(calls[1], { type: "home_3d/packs/index", refresh: true });
  forgetPackIndex();
});

test("without internet loading the index throws and nothing is kept", async () => {
  forgetPackIndex();
  const hass = { callWS: async () => Promise.reject({ code: "offline", message: "fetch_failed" }) } as unknown as HomeAssistant;
  await assert.rejects(loadPackIndex(hass), { code: "offline" });
});
