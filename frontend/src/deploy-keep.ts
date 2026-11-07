// Which old files a deploy leaves in Home Assistant (#223, scripts/deploy.mjs). A browser can still run the previous
// main bundle for a while after a deploy (a proxy told it to keep the fixed-URL home-3d.js, see fresh-reload.ts), and
// that bundle imports its own chunks by their content-hashed names. Removed at once, they answer 404 and the page
// shows no plan under its "updated, reload" notice; kept for a while, the old page still draws the plan.

/** How long a chunk the new build no longer ships stays (from the last deploy that shipped it). */
export const KEEP_CHUNKS_MS = 2 * 24 * 3600 * 1000;

/** A chunk of the main bundle or of the editor (#245: an open editor loads its lazy chunks later; build.mjs CHUNK), by
 * its path in the integration folder. */
const CHUNK = /^frontend[\\/]home-3d-[\w-]+-[A-Z0-9]{8}\.js$/;

/**
 * Whether a file the new build lacks stays: only a chunk, and only while it is younger than KEEP_CHUNKS_MS.
 * Its modification time is when a deploy last copied it, so the time counts from the last build that shipped it.
 */
export function keepOldFile(rel: string, modified: number, now: number): boolean {
  return CHUNK.test(rel) && now - modified < KEEP_CHUNKS_MS;
}
