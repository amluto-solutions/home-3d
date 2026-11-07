import assert from "node:assert/strict";
import { test } from "node:test";
import { clearReloadFlagLater, installChunkReloadGuard, isChunkLoadError, reloadForCurrentBuild, reloadOnceFor } from "./chunk-reload.ts";
import { guardImport } from "./guard-import.ts";

function fake() {
  const data = new Map<string, string>();
  const storage = { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), removeItem: (k: string) => void data.delete(k) };
  let reloads = 0;
  return { data, storage, reload: () => void reloads++, count: () => reloads };
}

test("the wordings of a failed import in each browser are recognised, other errors are not", () => {
  assert.ok(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/home-3d-chunk-AAAAAAAA.js")));
  assert.ok(isChunkLoadError(new TypeError("error loading dynamically imported module")));
  assert.ok(isChunkLoadError(new TypeError("Importing a module script failed.")));
  assert.ok(isChunkLoadError(Object.assign(new Error("x"), { name: "ChunkLoadError" })));
  assert.ok(!isChunkLoadError(new Error("boom")));
  assert.ok(!isChunkLoadError(undefined));
  assert.ok(!isChunkLoadError("Failed to fetch dynamically imported module"));
});

test("a failed chunk reloads the page once, the second failure does not (#340)", () => {
  const env = fake();
  const err = new TypeError("Failed to fetch dynamically imported module");
  assert.equal(reloadOnceFor(err, env), true);
  assert.equal(reloadOnceFor(err, env), false);
  assert.equal(env.count(), 1);
});

test("an error that is not a chunk failure never reloads", () => {
  const env = fake();
  assert.equal(reloadOnceFor(new Error("boom"), env), false);
  assert.equal(env.count(), 0);
  assert.equal(env.data.size, 0);
});

test("without usable storage nothing reloads, so there can be no loop", () => {
  const env = fake();
  const err = new TypeError("Importing a module script failed.");
  assert.equal(reloadOnceFor(err, { ...env, storage: null }), false);
  const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => undefined, removeItem: () => undefined };
  assert.equal(reloadOnceFor(err, { ...env, storage: broken }), false);
  assert.equal(env.count(), 0);
});

test("the flag is cleared after a quiet spell, so a later update can recover", () => {
  const env = fake();
  let timer: (() => void) | undefined;
  const err = new TypeError("Failed to fetch dynamically imported module");
  reloadOnceFor(err, env);
  clearReloadFlagLater({ ...env, later: (fn) => void (timer = fn) });
  timer?.();
  assert.equal(reloadOnceFor(err, env), true);
  assert.equal(env.count(), 2);
});

test("guardImport passes a value through and rethrows a failure", async () => {
  assert.equal(await guardImport(Promise.resolve(5)), 5);
  await assert.rejects(guardImport(Promise.reject(new Error("boom"))), /boom/);
});

test("a failed import in a lazy bundle reaches the guard the main bundle installed", async () => {
  const seen: unknown[] = [];
  installChunkReloadGuard();
  const hook = (globalThis as Record<string, unknown>).__fp3dImportFailed as (e: unknown) => void;
  assert.equal(typeof hook, "function");
  (globalThis as Record<string, unknown>).__fp3dImportFailed = (e: unknown) => void seen.push(e);
  const err = new TypeError("Failed to fetch dynamically imported module");
  await assert.rejects(guardImport(Promise.reject(err)), TypeError);
  assert.deepEqual(seen, [err]);
});

// #357: a copy of the main bundle that found the page run by another build (define.ts mayDefine)
test("the current build, kept out of a page an older build runs, reloads it once; a stale copy never does", async () => {
  const env = fake();
  const now = async () => "bbbbbbbbbbbb";
  assert.equal(await reloadForCurrentBuild("bbbbbbbbbbbb", { ...env, current: now, age: 500 }), true);
  // the reload landed on the old page again (its service worker answered first): no second reload, no loop
  assert.equal(await reloadForCurrentBuild("bbbbbbbbbbbb", { ...env, current: now, age: 500 }), false);
  assert.equal(env.count(), 1);
  // the copy that lost is the older one (a stale reference): the page already runs the current build
  const other = fake();
  assert.equal(await reloadForCurrentBuild("aaaaaaaaaaaa", { ...other, current: now, age: 500 }), false);
  assert.equal(await reloadForCurrentBuild("aaaaaaaaaaaa", { ...other, current: async () => null, age: 500 }), false);
  assert.equal(other.count(), 0);
});

test("a page that has been open a while is not reloaded under someone's hands (its update notice asks, #60)", async () => {
  const env = fake();
  assert.equal(await reloadForCurrentBuild("bbbbbbbbbbbb", { ...env, current: async () => "bbbbbbbbbbbb", age: 120_000 }), false);
  assert.equal(await reloadForCurrentBuild("bbbbbbbbbbbb", { ...env, storage: null, current: async () => "bbbbbbbbbbbb", age: 0 }), false);
  assert.equal(env.count(), 0);
});
