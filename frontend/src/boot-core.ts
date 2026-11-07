// The entry Home Assistant loads (home-3d.js) is a small start file, and the app is home-3d-app.js (#357).
//
// Every page names home-3d.js: the extra module of Home Assistant's own page (which its service worker may have kept
// from before an update), the panel's module_url and the dashboard card's loader. That one URL never changes, and a
// cache may keep it: a proxy that turns no-cache into hours (#340) or a page that never reloads. So this file holds no
// build of its own. It asks which build Home Assistant serves now (build.json, at a URL no cache has seen) and imports
// that build's app, `home-3d-app.js?v=<build>`, which the browser keeps for a year: a new build is a new URL, an old
// page asks again at its next load. A stale copy of this file still lands on the current build.

/** The app's file, next to this one. */
export const APP_FILE = "home-3d-app.js";
/** Where Home Assistant serves the frontend (const.py URL_BASE), and the path before #218 (LEGACY_URL_BASE). */
const BASE = "/api/home_3d/static/";
const LEGACY = "/home_3d_static/";
/** How long the start waits for build.json before it takes the app without a build id. */
const ASK_MS = 4000;

/**
 * The folder the app is imported from: the one of this file, but the path before #218 goes to the current one, so a
 * cached page or an old dashboard resource naming that path imports the same app URL as the panel (one copy).
 */
export function bootBase(here: string): string {
  const dir = new URL(".", here);
  if (dir.pathname.endsWith(LEGACY)) dir.pathname = `${dir.pathname.slice(0, -LEGACY.length)}${BASE}`;
  return dir.href;
}

type Fetch = (url: string, init: RequestInit) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/**
 * The build Home Assistant serves now, from build.json past every cache (a URL of its own each time, `no-store`); null
 * when it cannot be had in time (a development checkout, a network blip).
 */
export async function currentBuild(base: string, fetcher: Fetch = (url, init) => fetch(url, init), now = Date.now(), wait = ASK_MS): Promise<string | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ask = (async () => {
    const res = await fetcher(new URL(`build.json?t=${now}`, base).href, { cache: "no-store", credentials: "same-origin" });
    if (!res.ok) return null;
    const build = ((await res.json()) as { build?: unknown } | null)?.build;
    return typeof build === "string" && /^[\w-]{1,64}$/.test(build) ? build : null;
  })().catch(() => null);
  const late = new Promise<null>((done) => (timer = setTimeout(() => done(null), wait)));
  try {
    return await Promise.race([ask, late]);
  } finally {
    clearTimeout(timer);
  }
}

/** The app's URL for a build (kept for a year by the browser); without one the plain URL, checked on each load. */
export function appUrl(base: string, build: string | null): string {
  return new URL(build ? `${APP_FILE}?v=${encodeURIComponent(build)}` : APP_FILE, base).href;
}

/** The app's import on this page, shared by every copy of the start file (the extra module, the panel, the loader's
 * retries `home-3d.js?retry=n`: each a module of its own). */
const BOOT = Symbol.for("home-3d.boot");
/** How long the start file waits before it tries a failed import again (twice); the card loader tries for longer. */
const AGAIN_MS = [1000, 3000];

interface Boot {
  /** The app URL the first copy chose (#361): every copy imports this one, so a copy whose build.json was late and one
   * that got the build never import two instances (`home-3d-app.js` and `home-3d-app.js?v=<build>`). */
  url?: Promise<string>;
  /** The import under way or done: a loaded app is never imported again. */
  load?: Promise<unknown>;
  /** Failed imports so far (#360). The browser keeps a failed module import under its URL for the page's life, so the
   * next try adds `retry=<n>`: a URL it has not failed on. */
  failed: number;
}

export interface BootEnv {
  /** where the shared import is kept (the page; an object of its own in tests) */
  page?: object;
  /** the build served now (currentBuild) */
  build?: () => Promise<string | null>;
  wait?: (ms: number) => Promise<void>;
  again?: readonly number[];
}

/** The app URL for the n-th try: the chosen one, then with `retry=<n>`. */
export function retryUrl(url: string, n: number): string {
  if (!n) return url;
  const u = new URL(url);
  u.searchParams.set("retry", String(n));
  return u.href;
}

/**
 * Imports the app once per page: the first copy chooses the URL (#361), every copy waits for the same import, and a
 * failed one is tried again under a new URL (#360), by this copy after a short wait and by any later copy (the card
 * loader's retries). Rejects when this copy's tries all failed.
 */
export async function loadApp(base: string, importer: (url: string) => Promise<unknown>, env: BootEnv = {}): Promise<void> {
  const page = (env.page ?? globalThis) as Record<symbol, Boot | undefined>;
  const s = (page[BOOT] ??= { failed: 0 });
  s.url ??= (env.build ?? (() => currentBuild(base)))().catch(() => null).then((build) => appUrl(base, build));
  const url = await s.url;
  const again = env.again ?? AGAIN_MS;
  const wait = env.wait ?? ((ms) => new Promise<void>((done) => setTimeout(done, ms)));
  for (let tries = 0; ; tries++) {
    s.load ??= importer(retryUrl(url, s.failed)).catch((err: unknown) => {
      s.failed++;
      s.load = undefined;
      throw err;
    });
    try {
      await s.load;
      return;
    } catch (err) {
      if (tries >= again.length) throw err;
      await wait(again[tries]);
    }
  }
}
