import assert from "node:assert/strict";
import { test } from "node:test";
import { ensureRecipes, packTypesIn, setRecipeStore, type RecipeStore } from "./pack-recipes.ts";
import type { Building } from "./model.ts";
import { furnitureSize, isElectric, packInfo, packItem, setPacks, type FurniturePack, type PackItem } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";

// The library in a light form (#44): `packs/list` brings an index of the items, `packs/items` their recipes on demand.

const PART = { shape: "box" as const, x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "wood" };
const RECIPES: Record<string, { size: [number, number, number]; parts: (typeof PART)[] }> = {
  lamp: { size: [0.3, 0.3, 1.6], parts: [PART, { ...PART, y: 0.9, h: 0.1 }] },
  sofa: { size: [2, 0.9, 0.8], parts: [PART] },
  tv: { size: [1.2, 0.1, 0.7], parts: [PART] },
};

/** The light form of the demo pack, as `packs/list` sends it. */
function listed(hash = "sha256:one"): FurniturePack[] {
  return [
    {
      id: "demo.pack",
      name: "Demo",
      publisher: "Demo",
      release: 1,
      hash,
      items: [
        { id: "lamp", name: { en: "Floor lamp" }, size: [0.3, 0.3, 1.6], light: "floor" },
        { id: "sofa", name: { en: "Sofa" }, size: [2, 0.9, 0.8] },
        { id: "tv", name: { en: "TV" }, size: [1.2, 0.1, 0.7], electric: true },
      ],
    },
  ];
}

/** A backend answering `packs/items` for the demo pack, counting the calls. */
function backend(hash = "sha256:one") {
  const calls: { pack_id: string; items?: string[] }[] = [];
  const hass = {
    callWS: async (msg: { type: string; pack_id: string; items?: string[] }) => {
      if (msg.type !== "home_3d/packs/items") throw new Error(`unexpected ${msg.type}`);
      calls.push({ pack_id: msg.pack_id, items: msg.items });
      const ids = msg.items ?? Object.keys(RECIPES);
      return { pack_id: msg.pack_id, release: 1, hash, items: ids.filter((id) => RECIPES[id]).map((id) => ({ id, name: { en: id }, ...RECIPES[id] })) };
    },
  } as unknown as HomeAssistant;
  return { hass, calls };
}

const SOFA = "pack:demo.pack:sofa";
const LAMP = "pack:demo.pack:lamp";
const TV = "pack:demo.pack:tv";

test("a listed item is known by its index before its recipe is there", () => {
  setPacks(listed());
  assert.deepEqual(furnitureSize(TV), [1.2, 0.1, 0.7]);
  assert.equal(isElectric(TV), true);
  assert.equal(isElectric(LAMP), true, "a lamp links a light");
  assert.equal(packInfo(SOFA)?.name.en, "Sofa");
  // nothing draws an item without its recipe
  assert.equal(packItem(SOFA), undefined);
});

test("recipes come on demand, once, and only for the items asked for", async () => {
  const packs = listed();
  setPacks(packs);
  const { hass, calls } = backend();
  await ensureRecipes(hass, [SOFA, "sofa", "pack:other.pack:chair"]);
  assert.deepEqual(calls, [{ pack_id: "demo.pack", items: ["sofa"] }]);
  assert.equal(packItem(SOFA)?.parts.length, 1);
  assert.equal(packItem(LAMP), undefined);

  await ensureRecipes(hass, [SOFA]);
  assert.equal(calls.length, 1, "a recipe that is there is not fetched again");
  // the packs handed on to the other bundles carry the recipe too
  assert.equal(packs[0].items.find((i) => i.id === "sofa")?.parts?.length, 1);
});

test("items asked for together come in one request per pack", async () => {
  setPacks(listed());
  const { hass, calls } = backend();
  await Promise.all([ensureRecipes(hass, [LAMP]), ensureRecipes(hass, [TV]), ensureRecipes(hass, [LAMP])]);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].items?.sort(), ["lamp", "tv"]);
  assert.equal(packItem(LAMP)?.parts.length, 2);
  assert.equal(packItem(TV)?.parts.length, 1);
});

test("fetched recipes stay while the pack's hash does, and go when it changes", async () => {
  setPacks(listed());
  const first = backend();
  await ensureRecipes(first.hass, [SOFA]);

  setPacks(listed());
  const again = backend();
  await ensureRecipes(again.hass, [SOFA]);
  assert.equal(again.calls.length, 0, "the same pack again: the recipe is kept");
  assert.equal(packItem(SOFA)?.parts.length, 1);

  setPacks(listed("sha256:two"));
  assert.equal(packItem(SOFA), undefined, "a changed pack: the old recipe is gone");
  const changed = backend("sha256:two");
  await ensureRecipes(changed.hass, [SOFA]);
  assert.equal(changed.calls.length, 1);
});

test("a failed fetch leaves the item without a recipe and tries again next time", async () => {
  setPacks(listed());
  const broken = { callWS: async () => Promise.reject(new Error("gone")) } as unknown as HomeAssistant;
  await ensureRecipes(broken, [SOFA]);
  assert.equal(packItem(SOFA), undefined);
  const { hass, calls } = backend();
  await ensureRecipes(hass, [SOFA]);
  assert.equal(calls.length, 1);
  assert.equal(packItem(SOFA)?.parts.length, 1);
});

test("a whole pack (an older backend, the household's own items) needs no fetch", async () => {
  setPacks([{ id: "household.custom", name: "Own", publisher: "This home", custom: true, items: [{ id: "shelf", name: { en: "Shelf" }, size: [1, 0.3, 0.4], parts: [PART] }] }]);
  const { hass, calls } = backend();
  await ensureRecipes(hass, ["pack:household.custom:shelf"]);
  assert.equal(calls.length, 0);
  assert.equal(packItem("pack:household.custom:shelf")?.parts.length, 1);
});

test("the pack items a plan shows: its furniture and the vehicles of its parking spots", () => {
  const at = { x: 0, z: 0, rotation: 0, w: 1, d: 1, h: 1, variant: null };
  const building = {
    floors: [
      { furniture: [{ id: "a", type: SOFA, ...at }, { id: "b", type: "sofa", ...at }, { id: "c", type: "parking", vehicle: "pack:cars.uk:leaf", types: [{ state: "van", vehicle: "pack:cars.uk:van" }], ...at }] },
      { furniture: [{ id: "d", type: SOFA, ...at }] },
    ],
  } as unknown as Building;
  assert.deepEqual(packTypesIn(building).sort(), ["pack:cars.uk:leaf", "pack:cars.uk:van", SOFA]);
});

test("the pack items a plan shows include the gear in its racks (#113)", () => {
  const at = { x: 0, z: 0, rotation: 0, w: 1, d: 1, h: 1, variant: null };
  const rack = { id: "r", type: "pack:it:rack", ...at, rack: { slots: [{ id: "s1", type: "pack:it:switch", u: 1 }, { id: "s2", type: "pack:it:blank", u: 2 }] } };
  const building = { floors: [{ furniture: [rack] }] } as unknown as Building;
  assert.deepEqual(packTypesIn(building).sort(), ["pack:it:blank", "pack:it:rack", "pack:it:switch"]);
});

// Recipes are kept in the browser (#48): a reload draws the library without asking again while the pack is the same

/** A browser store in memory: by pack id, the hash and the recipes kept. */
function memoryStore() {
  const kept = new Map<string, { hash: string; items: Record<string, PackItem> }>();
  const store: RecipeStore = {
    async read(packId, hash) {
      const entry = kept.get(packId);
      return entry && entry.hash === hash ? { ...entry.items } : {};
    },
    async write(packId, hash, items) {
      const entry = kept.get(packId);
      const before = entry && entry.hash === hash ? entry.items : {};
      kept.set(packId, { hash, items: { ...before, ...Object.fromEntries(items.map((i) => [i.id, i])) } });
    },
  };
  return { store, kept };
}

/** A page load: the library arrives afresh, nothing fetched before is in memory. */
function reload(hash = "sha256:one"): void {
  setPacks([]);
  setPacks(listed(hash));
}

test("fetched recipes are kept in the browser by pack and hash and survive a reload", async () => {
  const { store, kept } = memoryStore();
  setRecipeStore(store);
  try {
    reload();
    const first = backend();
    await ensureRecipes(first.hass, [SOFA]);
    assert.equal(first.calls.length, 1);
    assert.deepEqual(Object.keys(kept.get("demo.pack")?.items ?? {}), ["sofa"]);

    reload();
    const again = backend();
    await ensureRecipes(again.hass, [SOFA, TV]);
    assert.deepEqual(again.calls, [{ pack_id: "demo.pack", items: ["tv"] }], "only the recipe not kept is fetched");
    assert.equal(packItem(SOFA)?.parts.length, 1);
    assert.equal(packItem(TV)?.parts.length, 1);

    // a new release of the pack (another hash): the kept recipes are dropped and fetched again
    reload("sha256:two");
    const changed = backend("sha256:two");
    await ensureRecipes(changed.hass, [SOFA]);
    assert.equal(changed.calls.length, 1);
    assert.equal(kept.get("demo.pack")?.hash, "sha256:two");
    assert.deepEqual(Object.keys(kept.get("demo.pack")?.items ?? {}), ["sofa"]);
  } finally {
    setRecipeStore(null);
  }
});

test("a browser store that fails falls back to fetching", async () => {
  const fail = async () => Promise.reject(new Error("quota"));
  setRecipeStore({ read: fail, write: fail });
  try {
    reload();
    const { hass, calls } = backend();
    await ensureRecipes(hass, [SOFA]);
    assert.equal(calls.length, 1);
    assert.equal(packItem(SOFA)?.parts.length, 1);
  } finally {
    setRecipeStore(null);
  }
});
