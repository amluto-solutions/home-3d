// #357: the start file (home-3d.js) asks which build is served and imports that build's app.
import { test } from "node:test";
import assert from "node:assert/strict";
import { appUrl, bootBase, currentBuild, loadApp, retryUrl } from "./boot-core.ts";

const BASE = "https://ha.example/api/home_3d/static/";
const answer = (body: unknown, ok = true) => async () => ({ ok, json: async () => body });

test("a page that names the previous build's entry or loader imports the current build's app", async () => {
  // the start file as a cached page names it (an old ?v=), through the loader's retry, or on the path before #218
  for (const here of [`${BASE}home-3d.js?v=ffffffffffff`, `${BASE}home-3d.js?retry=2`, "https://ha.example/home_3d_static/home-3d.js?v=1"]) {
    const base = bootBase(here);
    assert.equal(base, BASE);
    const asked: string[] = [];
    const build = await currentBuild(base, async (url, init) => {
      asked.push(url);
      assert.equal(init.cache, "no-store");
      return { ok: true, json: async () => ({ build: "0123456789ab", version: "1.0.0" }) };
    }, 42);
    // build.json at a URL no cache has seen, so neither the browser nor a proxy answers with an old one
    assert.deepEqual(asked, [`${BASE}build.json?t=42`]);
    assert.equal(appUrl(base, build), `${BASE}home-3d-app.js?v=0123456789ab`);
  }
});

test("two copies of the start file (cached page and panel) import the same app URL: one copy of the app", async () => {
  const urls = await Promise.all(
    ["https://ha.example/home_3d_static/home-3d.js", `${BASE}home-3d.js`].map(async (here) => appUrl(bootBase(here), await currentBuild(bootBase(here), answer({ build: "abc" })))),
  );
  assert.equal(urls[0], urls[1]);
});

test("without an answer in time the plain app URL is taken (checked on each load)", async () => {
  assert.equal(await currentBuild(BASE, answer({}, false)), null);
  assert.equal(await currentBuild(BASE, answer({ build: 7 })), null);
  assert.equal(await currentBuild(BASE, answer({ build: "../x" })), null);
  assert.equal(await currentBuild(BASE, async () => Promise.reject(new Error("offline"))), null);
  assert.equal(await currentBuild(BASE, () => new Promise(() => undefined), 1, 10), null);
  assert.equal(appUrl(BASE, null), `${BASE}home-3d-app.js`);
});

test("another folder (the browser check's /static/) keeps its own", () => {
  assert.equal(bootBase("http://127.0.0.1:9/static/home-3d.js"), "http://127.0.0.1:9/static/");
});

/** An importer that fails the URLs in `fail` and records every URL asked for. */
function importer(fail: (url: string, n: number) => boolean) {
  const asked: string[] = [];
  const load = async (url: string) => {
    asked.push(url);
    if (fail(url, asked.length)) throw new TypeError(`Failed to fetch dynamically imported module: ${url}`);
    return {};
  };
  return { asked, load };
}

const noWait = { wait: async () => undefined };

test("#360: a failed app import is tried again under a URL the browser has not failed on, by the start file", async () => {
  const page = {};
  const waited: number[] = [];
  const app = importer((_url, n) => n === 1);
  await loadApp(BASE, app.load, { page, build: async () => "abc", wait: async (ms) => void waited.push(ms) });
  assert.deepEqual(app.asked, [`${BASE}home-3d-app.js?v=abc`, `${BASE}home-3d-app.js?v=abc&retry=1`]);
  assert.deepEqual(waited, [1000]);
  // without a build id too
  const plain = importer((_url, n) => n === 1);
  await loadApp(BASE, plain.load, { page: {}, build: async () => null, ...noWait });
  assert.deepEqual(plain.asked, [`${BASE}home-3d-app.js`, `${BASE}home-3d-app.js?retry=1`]);
});

test("#360: after the start file gave up, the loader's retry (a new copy of it) imports the app under a new URL", async () => {
  const page = {};
  let down = true;
  const app = importer(() => down);
  const env = { page, build: async () => "abc", ...noWait };
  await assert.rejects(loadApp(BASE, app.load, env), /dynamically imported module/);
  assert.deepEqual(app.asked, [0, 1, 2].map((n) => `${BASE}home-3d-app.js?v=abc${n ? `&retry=${n}` : ""}`));
  assert.equal(new Set(app.asked).size, app.asked.length, "no URL is asked twice");
  down = false; // Home Assistant is up again: `home-3d.js?retry=1` runs another copy of the start file
  await loadApp(BASE, app.load, env);
  assert.equal(app.asked.at(-1), `${BASE}home-3d-app.js?v=abc&retry=3`);
});

test("#360: one app instance per page: a loaded app is never imported again, nor twice at once", async () => {
  const page = {};
  const app = importer((_url, n) => n === 1);
  const env = { page, build: async () => "abc", ...noWait };
  // the extra module and the panel start together; the first import fails, one retry serves both
  await Promise.all([loadApp(BASE, app.load, env), loadApp(BASE, app.load, env)]);
  assert.deepEqual(app.asked, [`${BASE}home-3d-app.js?v=abc`, `${BASE}home-3d-app.js?v=abc&retry=1`]);
  // later copies (the card loader, a legacy path) find the app loaded and import nothing
  await loadApp(BASE, app.load, env);
  await loadApp(bootBase("https://ha.example/home_3d_static/home-3d.js"), app.load, env);
  assert.equal(app.asked.length, 2);
});

test("#360: the retry marker is added to the app URL", () => {
  assert.equal(retryUrl(`${BASE}home-3d-app.js?v=abc`, 0), `${BASE}home-3d-app.js?v=abc`);
  assert.equal(retryUrl(`${BASE}home-3d-app.js?v=abc`, 4), `${BASE}home-3d-app.js?v=abc&retry=4`);
  assert.equal(retryUrl(`${BASE}home-3d-app.js`, 1), `${BASE}home-3d-app.js?retry=1`);
});

test("#361: every start-file copy on a page imports the app URL the first one chose", async () => {
  const page = {};
  const app = importer(() => false);
  let late!: (build: string | null) => void;
  // the extra module's build.json does not answer in time (plain URL); the panel's copy gets the build
  const first = loadApp(BASE, app.load, { page, build: () => new Promise((done) => (late = done)), ...noWait });
  const second = loadApp(BASE, app.load, { page, build: async () => "abc", ...noWait });
  late(null);
  await Promise.all([first, second]);
  await loadApp(BASE, app.load, { page, build: async () => "abc", ...noWait });
  assert.deepEqual(app.asked, [`${BASE}home-3d-app.js`]);
});

test("#361: a retry keeps the page's chosen URL, so a late build id cannot start a second instance", async () => {
  const page = {};
  const app = importer((_url, n) => n <= 3);
  await assert.rejects(loadApp(BASE, app.load, { page, build: async () => null, ...noWait }));
  await loadApp(BASE, app.load, { page, build: async () => "abc", ...noWait });
  assert.deepEqual(app.asked, [0, 1, 2, 3].map((n) => `${BASE}home-3d-app.js${n ? `?retry=${n}` : ""}`));
});
