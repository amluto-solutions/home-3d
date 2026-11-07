// A reload that gets the new bundle (#223). The main bundle and the card loader keep one URL for every build (#218),
// and Home Assistant sends them with no-cache, but a proxy in front of it can replace that: behind Cloudflare the
// browser gets "max-age=14400" and keeps the old main bundle for four hours. A plain reload then runs the same old
// JavaScript again (the update notice comes back, and the old bundle's chunks that are gone leave the plan blank),
// until the four hours are up or the cache is cleared by hand. So before the page reloads, those two files are fetched
// once past the browser cache (`cache: "reload"`), which puts the new ones in it; every other file has its content
// hash in its name or URL and is never taken stale. Since #357 home-3d.js is the start file (boot.ts): it asks for the
// current build each time, so a stale copy of it still runs the new app; refreshing it is only tidiness.

/** The files that keep one URL for every build. */
const FIXED = ["home-3d.js", "home-3d-loader.js"];
/** Where Home Assistant serves them (const.py URL_BASE): the panel, the extra module and the dashboard loader name it. */
const BASE = "/api/home_3d/static/";

/** The fixed-URL files next to `here` (the module asking: its folder may be the path before #218) and under BASE. */
export function fixedUrls(here: string): string[] {
  const urls = new Set<string>();
  for (const dir of [new URL(".", here), new URL(BASE, here)]) for (const file of FIXED) urls.add(new URL(file, dir).href);
  return [...urls];
}

type Fetch = (url: string, init: RequestInit) => Promise<{ blob(): Promise<unknown> }>;

/**
 * Fetch the fixed-URL files past the browser cache, so the next load runs the bundle Home Assistant serves now. Never
 * fails and never waits longer than `timeout` ms: a reload is better than none.
 */
export async function refreshBundles(fetcher: Fetch = (url, init) => fetch(url, init), here: string = import.meta.url, timeout = 5000): Promise<void> {
  let urls: string[];
  try {
    urls = fixedUrls(here);
  } catch {
    return;
  }
  // the body is read so the browser keeps the whole new file
  const all = Promise.allSettled(urls.map((url) => fetcher(url, { cache: "reload", credentials: "same-origin" }).then((res) => res.blob())));
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([all, new Promise((done) => (timer = setTimeout(done, timeout)))]);
  clearTimeout(timer);
}

/** Refresh the fixed-URL files, then reload the page (the notices' Reload buttons). */
export async function freshReload(reload: () => void = () => location.reload(), refresh: () => Promise<void> = refreshBundles): Promise<void> {
  await refresh().catch(() => undefined);
  reload();
}
