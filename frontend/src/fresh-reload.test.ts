// #223: one Reload loads the new bundle, also when a proxy told the browser to keep the old one, and a deploy leaves
// the old bundle's chunks for a while so a page still running it draws its plan.
import assert from "node:assert/strict";
import { test } from "node:test";
import { KEEP_CHUNKS_MS, keepOldFile } from "./deploy-keep.ts";
import { fixedUrls, freshReload, refreshBundles } from "./fresh-reload.ts";

const HERE = "https://ha.example/api/home_3d/static/home-3d-chunk-ABCD1234.js";

test("the files with one URL for every build are the main bundle and the card loader, where Home Assistant serves them", () => {
  assert.deepEqual(fixedUrls(HERE), ["https://ha.example/api/home_3d/static/home-3d.js", "https://ha.example/api/home_3d/static/home-3d-loader.js"]);
  // a copy loaded from the path before #218 refreshes that path too
  assert.deepEqual(fixedUrls("https://ha.example/home_3d_static/home-3d.js?v=1"), [
    "https://ha.example/home_3d_static/home-3d.js",
    "https://ha.example/home_3d_static/home-3d-loader.js",
    "https://ha.example/api/home_3d/static/home-3d.js",
    "https://ha.example/api/home_3d/static/home-3d-loader.js",
  ]);
});

test("the refresh fetches them past the browser cache and reads them whole", async () => {
  const seen: [string, RequestInit][] = [];
  let read = 0;
  await refreshBundles(async (url, init) => {
    seen.push([url, init]);
    return { blob: async () => void read++ };
  }, HERE);
  assert.deepEqual(
    seen.map(([u]) => u),
    fixedUrls(HERE),
  );
  for (const [, init] of seen) assert.equal(init.cache, "reload");
  assert.equal(read, 2);
});

test("a failed or hanging refresh never stops the reload", async () => {
  await refreshBundles(async () => {
    throw new Error("offline");
  }, HERE);
  const started = Date.now();
  await refreshBundles(() => new Promise(() => undefined), HERE, 30);
  assert.ok(Date.now() - started < 1000);
  const order: string[] = [];
  await freshReload(
    () => order.push("reload"),
    async () => {
      order.push("refresh");
      throw new Error("offline");
    },
  );
  assert.deepEqual(order, ["refresh", "reload"]);
});

test("a deploy keeps the old chunks of the main bundle and the editor for a while, nothing else", () => {
  const now = Date.UTC(2026, 10, 1);
  assert.equal(keepOldFile("frontend/home-3d-view3d-GBZ4N25E.js", now - 3600_000, now), true);
  assert.equal(keepOldFile("frontend\\home-3d-chunk-A24XFX3G.js", now - 3600_000, now), true);
  assert.equal(keepOldFile("frontend/home-3d-view3d-GBZ4N25E.js", now - KEEP_CHUNKS_MS - 1, now), false);
  // #245: the editor's chunks (an open editor loads its lazy ones later) and a chunk named after a hyphenated module
  assert.equal(keepOldFile("frontend/home-3d-editor-chunk-SXVCZ63C.js", now - 3600_000, now), true);
  assert.equal(keepOldFile("frontend/home-3d-editor-rack-sheet-3NSOP4HY.js", now - 3600_000, now), true);
  assert.equal(keepOldFile("frontend/home-3d-room-panel-ECKIMZIM.js", now - 3600_000, now), true);
  assert.equal(keepOldFile("frontend/home-3d-card-editor.js", now, now), false);
  // removed Python, a renamed bundle, a language pack: gone at once
  assert.equal(keepOldFile("websocket_old.py", now, now), false);
  assert.equal(keepOldFile("frontend/home-3d-old.js", now, now), false);
  assert.equal(keepOldFile("bundled_languages/x/strings.json", now, now), false);
});
