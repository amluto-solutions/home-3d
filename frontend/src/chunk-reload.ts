// After an update the old hashed chunks are gone. A page that still runs the old entry (a proxy or browser kept it) then
// imports a file that is not there. Reload once so the new entry is fetched, instead of a broken panel (#340). The flag
// in sessionStorage stops a loop (a real outage reloads once, then shows the error); it is cleared after a quiet spell,
// so a later update can recover the same way.

import { bootBase, currentBuild } from "./boot-core.ts";
import { IMPORT_FAILED } from "./guard-import.ts";

const KEY = "fp3d_chunk_reload";
const QUIET_MS = 30_000;

const CHUNK_ERROR = /dynamically imported module|importing a module script failed|ChunkLoadError|Loading chunk .* failed/i;

/** Whether an error is a failed dynamic import (404 or network): Chrome, Firefox and Safari word it differently. */
export function isChunkLoadError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const { name, message } = err as { name?: unknown; message?: unknown };
  return name === "ChunkLoadError" || (typeof message === "string" && CHUNK_ERROR.test(message));
}

export interface ReloadEnv {
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem"> | null;
  reload?: () => void;
  later?: (fn: () => void, ms: number) => void;
}

function defaults(): Required<ReloadEnv> {
  let storage: Storage | null = null;
  try {
    storage = globalThis.sessionStorage ?? null;
  } catch {
    storage = null; // blocked storage: no reload, because nothing could stop a loop
  }
  return { storage, reload: () => globalThis.location?.reload(), later: (fn, ms) => {
      const timer = setTimeout(fn, ms) as unknown as { unref?: () => void };
      timer.unref?.(); // Node (tests) must not wait for it
    },
  };
}

/** Reloads the page once for a failed chunk import. Returns whether it reloaded. */
export function reloadOnceFor(err: unknown, env: ReloadEnv = {}): boolean {
  if (!isChunkLoadError(err)) return false;
  const { storage, reload } = { ...defaults(), ...env };
  if (!storage) return false;
  try {
    if (storage.getItem(KEY)) return false;
    storage.setItem(KEY, String(Date.now()));
  } catch {
    return false;
  }
  reload();
  return true;
}

/** Forgets the flag after a quiet spell without a failure, so a later update can reload once again. */
export function clearReloadFlagLater(env: ReloadEnv = {}): void {
  const { storage, later } = { ...defaults(), ...env };
  later(() => {
    try {
      storage?.removeItem(KEY);
    } catch {
      /* nothing to clear */
    }
  }, QUIET_MS);
}

/** Catches the imports nobody guarded (an import() in a module that is not routed through guardImport). */
export function installChunkReloadGuard(): void {
  // the lazy bundles (settings, editor …) hand a failed import to the main bundle's guard through guardImport
  (globalThis as { [IMPORT_FAILED]?: (err: unknown) => void })[IMPORT_FAILED] = (err) => void reloadOnceFor(err);
  if (typeof addEventListener !== "function") return;
  addEventListener("unhandledrejection", (event) => void reloadOnceFor((event as PromiseRejectionEvent).reason));
  clearReloadFlagLater();
}

const BUILD_KEY = "fp3d_build_reload";
/** How long after the page started a copy that lost the page to another build may still reload it (#357). */
const YOUNG_MS = 60_000;

export interface BuildReloadEnv extends ReloadEnv {
  /** The build Home Assistant serves now (boot-core.ts currentBuild), null when unknown. */
  current?: () => Promise<string | null>;
  /** Milliseconds since the page started. */
  age?: number;
}

/**
 * This copy of the main bundle found the page claimed by another build (#357, define.ts mayDefine): a page that named
 * an older entry runs that one, and this copy defines nothing. When this copy is the build Home Assistant serves now, the
 * page reloads once so it runs this one, only while the page is young (later, the running copy's "updated, reload"
 * notice asks, #60) and once per build per tab (sessionStorage), so a page that keeps naming the old entry cannot loop.
 * A copy that is not the current build leaves the page alone. Returns whether it reloaded.
 */
export async function reloadForCurrentBuild(own: string, env: BuildReloadEnv = {}): Promise<boolean> {
  const { storage, reload } = { ...defaults(), ...env };
  const age = env.age ?? globalThis.performance?.now() ?? 0;
  if (!storage || age > YOUNG_MS) return false;
  const current = env.current ?? (() => currentBuild(bootBase(import.meta.url)));
  if ((await current().catch(() => null)) !== own) return false;
  try {
    if (storage.getItem(BUILD_KEY) === own) return false;
    storage.setItem(BUILD_KEY, own);
  } catch {
    return false;
  }
  reload();
  return true;
}
