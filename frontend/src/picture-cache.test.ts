// The screen-picture cache: failed lookups are retried, the size is bounded, clearing empties it (#384).
import assert from "node:assert/strict";
import { test } from "node:test";
import { PictureCache } from "./picture-cache.ts";

test("a new key is fetched; a loaded one is served without a fetch", () => {
  const c = new PictureCache();
  assert.deepEqual(c.get("a"), { url: null, fetch: true });
  c.set("a", null);
  assert.deepEqual(c.get("a"), { url: null, fetch: false });
  c.set("a", "data:x");
  assert.deepEqual(c.get("a"), { url: "data:x", fetch: false });
});

test("a failed lookup is tried again after the retry time, a loaded picture never needs it", () => {
  let t = 0;
  const c = new PictureCache(10, 60_000, () => t);
  c.set("bad", null);
  c.set("ok", "data:y");
  t = 59_999;
  assert.equal(c.get("bad").fetch, false);
  t = 60_000;
  assert.equal(c.get("bad").fetch, true);
  assert.equal(c.get("ok").fetch, false);
});

test("the cache is bounded: the oldest entries go", () => {
  const c = new PictureCache(3);
  for (const k of ["a", "b", "c", "d", "e"]) c.set(k, "data:" + k);
  assert.equal(c.size, 3);
  assert.equal(c.get("a").fetch, true);
  assert.equal(c.get("e").url, "data:e");
});

test("clear empties it", () => {
  const c = new PictureCache();
  c.set("a", "data:a");
  c.clear();
  assert.equal(c.size, 0);
  assert.equal(c.get("a").fetch, true);
});
