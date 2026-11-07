// The recipes of library items, fetched on demand (#44): `packs/list` brings only an index of the items. Whatever
// draws a library item that is not placed yet (a card's picture, the preview, an item just added) asks for its
// recipe here first. Requests made within a moment of each other go out as one per pack; a recipe is fetched once and
// kept in the listed item while its pack's hash stays (packs.ts), and in the browser by pack and hash (#48,
// recipe-cache.ts), so a reload asks only for what is not kept. Placed items draw from the plan's copies (#2), so
// views that only show the plan never come here.

import { fetchPackRecipes } from "./api.ts";
import type { Building } from "./model.ts";
import { addRecipes, getPacks, isPackType, missingRecipes } from "./packs.ts";
import { browserRecipeStore, type RecipeStore } from "./recipe-cache.ts";
import type { HomeAssistant } from "./types.ts";

export type { RecipeStore } from "./recipe-cache.ts";

let store: RecipeStore = browserRecipeStore;

/** Keep recipes in another store (a test's); null: the browser's again. */
export function setRecipeStore(next: RecipeStore | null): void {
  store = next ?? browserRecipeStore;
}

/** Hand the recipes of `ids` kept in the browser for the pack as listed now to the library; the ids still missing
 * (all of them when nothing is kept or storage fails). */
async function keptRecipes(packId: string, ids: string[]): Promise<string[]> {
  const hash = getPacks().find((p) => p.id === packId)?.hash;
  if (!hash) return ids;
  try {
    const kept = await store.read(packId, hash);
    const found = ids.filter((id) => kept[id]).map((id) => kept[id]);
    if (found.length) addRecipes(packId, hash, found);
    return ids.filter((id) => !kept[id]);
  } catch {
    return ids;
  }
}

/** How long requests gather before they go out (ms): the library asks for its cards one by one. */
const GATHER = 15;

interface Batch {
  hass: HomeAssistant;
  /** Item ids by pack id. */
  wanted: Map<string, Set<string>>;
  done: Promise<void>;
}

let batch: Batch | null = null;
/** Items being fetched, by "pack id/item id": asked for again, they wait for the same request. */
const inFlight = new Map<string, Promise<void>>();

/**
 * Make sure the listed items of `types` have their recipes. Never fails: an item whose recipe could not be fetched
 * stays without one (and is asked for again next time). Types that are no listed pack item are ignored.
 */
export async function ensureRecipes(hass: HomeAssistant, types: readonly string[]): Promise<void> {
  const waits: Promise<void>[] = [];
  for (const [packId, ids] of missingRecipes(types)) {
    for (const id of ids) {
      const key = `${packId}/${id}`;
      let wait = inFlight.get(key);
      if (!wait) {
        wait = gather(hass, packId, id).finally(() => inFlight.delete(key));
        inFlight.set(key, wait);
      }
      waits.push(wait);
    }
  }
  await Promise.all(waits);
}

function gather(hass: HomeAssistant, packId: string, id: string): Promise<void> {
  if (!batch) {
    const next: Batch = { hass, wanted: new Map(), done: Promise.resolve() };
    next.done = new Promise<void>((resolve) => setTimeout(resolve, GATHER)).then(() => send(next));
    batch = next;
  }
  batch.wanted.set(packId, (batch.wanted.get(packId) ?? new Set<string>()).add(id));
  return batch.done;
}

async function send(sent: Batch): Promise<void> {
  if (batch === sent) batch = null;
  await Promise.all(
    [...sent.wanted].map(async ([packId, ids]) => {
      try {
        const missing = await keptRecipes(packId, [...ids]);
        if (!missing.length) return;
        const res = await fetchPackRecipes(sent.hass, packId, missing);
        addRecipes(packId, res.hash, res.items);
        if (res.hash) await store.write(packId, res.hash, res.items).catch(() => undefined);
      } catch {
        // offline, an older backend or a pack removed meanwhile: the item stays without its recipe
      }
    }),
  );
}

/** The pack item types a plan shows: its furniture, the vehicles of its parking spots and the gear in its racks (#113)
 * (recipes.py used_pack_types). */
export function packTypesIn(building: Pick<Building, "floors">): string[] {
  const used = new Set<string>();
  for (const floor of building.floors)
    for (const f of floor.furniture)
      for (const type of [f.type, f.vehicle, ...(f.types ?? []).map((t) => t.vehicle), ...(f.rack?.slots ?? []).map((s) => s.type)]) if (type && isPackType(type)) used.add(type);
  return [...used];
}
