// What a floor's build modelled, kept in the browser between loads (run 6 speed): the furniture pieces and the light
// surface of each floor, in IndexedDB. The next load of the same home takes them instead of modelling every item
// again. A record belongs to one build of Home 3D (any change of the code that models starts afresh) and each piece and
// surface carries the key of what it was made from, so a moved item or another pack is modelled anew. Without
// IndexedDB (a private window, an old WebView) or on any error the load models everything, as before.

import type { GeoSlice, LineSlice } from "./geo.ts";
import type { LightSurface } from "./lighting.ts";

/** Which build this is (build.mjs); a dev or test build has none. */
declare const __FP3D_BUILD__: string;
const BUILD = typeof __FP3D_BUILD__ === "string" ? __FP3D_BUILD__ : "dev";

export interface StoredPiece {
  solid: GeoSlice;
  lines: LineSlice;
  shadow: GeoSlice;
}

/** One floor's record: its pieces by their stored key, and its light surface with the key it was made from. */
export interface StoredFloor {
  pieces: Map<string, StoredPiece>;
  light: { key: string; surface: LightSurface } | null;
}

const DB = "home-3d-geometry";
const STORE = "floors";
/**
 * A store that does not answer by then is left out: the floor is modelled as before. Its answer waits behind the
 * load's other tasks (on a slow tablet a few hundred milliseconds), so this is generous; a store that hangs is rare.
 */
const READ_WAIT_MS = 1500;

let opening: Promise<IDBDatabase | null> | null = null;

/** Opens the store (once a session): called as the viewer starts, so it is open by the time a floor is read. */
export function openStore(): Promise<IDBDatabase | null> {
  return open();
}

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  opening ??= new Promise((done) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => done(req.result);
      req.onerror = () => done(null);
      req.onblocked = () => done(null);
    } catch {
      done(null);
    }
  });
  return opening;
}

const recordKey = (floorId: string) => `${BUILD}|${floorId}`;

/** The floor's record from an earlier load of this build, or null (none, no store, or it took too long). */
export function readFloor(floorId: string): Promise<StoredFloor | null> {
  const read = open().then(
    (db) =>
      new Promise<StoredFloor | null>((done) => {
        if (!db) return done(null);
        try {
          const req = db.transaction(STORE, "readonly").objectStore(STORE).get(recordKey(floorId));
          req.onsuccess = () => {
            const v = req.result as { pieces?: [string, StoredPiece][]; light?: StoredFloor["light"] } | undefined;
            done(v && Array.isArray(v.pieces) ? { pieces: new Map(v.pieces), light: v.light ?? null } : null);
          };
          req.onerror = () => done(null);
        } catch {
          done(null);
        }
      }),
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<null>((done) => (timer = setTimeout(() => done(null), READ_WAIT_MS)));
  return Promise.race([read, late]).finally(() => clearTimeout(timer));
}

let swept = false;

/**
 * Keeps the floor's record for the next load, when the page is idle; records of other builds go then too (once a
 * session), so the store never holds more than the floors of the homes shown with this build.
 */
export function writeFloor(floorId: string, floor: StoredFloor): void {
  const write = () =>
    void open().then((db) => {
      if (!db) return;
      try {
        const store = db.transaction(STORE, "readwrite").objectStore(STORE);
        store.put({ pieces: [...floor.pieces], light: floor.light }, recordKey(floorId));
        if (!swept) {
          swept = true;
          const keys = store.getAllKeys();
          keys.onsuccess = () => {
            for (const k of keys.result) if (typeof k !== "string" || !k.startsWith(`${BUILD}|`)) store.delete(k);
          };
        }
      } catch {
        // full, or closed by the browser: the next load models the floor again
      }
    });
  if (typeof requestIdleCallback === "function") requestIdleCallback(write, { timeout: 10000 });
  else setTimeout(write, 2000);
}
