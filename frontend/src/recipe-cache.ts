// The recipes of library items, kept in the browser (#48): IndexedDB, one record per pack holding its hash and the
// recipes fetched for it. A reload draws the library without asking again while the pack is the same; a new release
// (another hash) replaces the record. Everything here fails soft: without storage the recipes are fetched again.

import type { PackItem } from "./packs.ts";

/** Where fetched recipes are kept (pack-recipes.ts); a test hands in its own. */
export interface RecipeStore {
  /** The recipes kept for a pack at this hash, by item id (none when the pack's hash is another). */
  read(packId: string, hash: string): Promise<Record<string, PackItem>>;
  /** Keep recipes of a pack at a hash; recipes kept under another hash of the pack are dropped. */
  write(packId: string, hash: string, items: readonly PackItem[]): Promise<void>;
}

const DB = "home3d-recipes";
const STORE = "packs";
let dbPromise: Promise<IDBDatabase | null> | null = null;

interface Kept {
  hash: string;
  items: Record<string, PackItem>;
}

function open(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      if (typeof indexedDB === "undefined") return resolve(null);
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function get(packId: string): Promise<Kept | null> {
  const db = await open();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const req = db.transaction(STORE, "readonly").objectStore(STORE).get(packId);
      req.onsuccess = () => resolve(req.result && typeof req.result.hash === "string" ? (req.result as Kept) : null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** The browser's IndexedDB. */
export const browserRecipeStore: RecipeStore = {
  async read(packId, hash) {
    const kept = await get(packId);
    return kept && kept.hash === hash ? kept.items : {};
  },
  async write(packId, hash, items) {
    const db = await open();
    if (!db) return;
    const kept = await get(packId);
    const before = kept && kept.hash === hash ? kept.items : {};
    const record: Kept = { hash, items: { ...before, ...Object.fromEntries(items.map((i) => [i.id, i])) } };
    try {
      db.transaction(STORE, "readwrite").objectStore(STORE).put(record, packId);
    } catch {
      // storage full or blocked: the recipes live in memory for this page
    }
  },
};
