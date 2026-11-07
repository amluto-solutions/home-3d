// Loads the shipped bundles in a headless browser (#178): the panel from custom_components/home_3d/frontend (as
// built by `npm run build`) with a fake Home Assistant and a plan. It shows the house, walks through it, switches
// every look and the 2D plan, times the renderer's render and deletes the timing wrapper again (#213), opens the
// Extensions tab with the item editor, the Settings tab and the editor, and fails on any console error, page error
// or failed request. It loads like Home Assistant's page (#218): the main bundle first, then Home Assistant's scoped
// custom element registry polyfill, the panel created by name through a fake panel host from a second URL (two
// copies of the bundle, as on a page Home Assistant's service worker kept); at the end it leaves the panel and comes
// back twice without a reload, and does load-leave-return again with one copy and with the panel created before the
// start file's app has defined it (#357). It also measures, as in docs/performance.md: load, background load in view mode (5 hass
// updates a second), the renderer's render and editor selection; with --speed it fails when a measure is past its
// limit.
//
//   npm run smoke                     the CI check (SwiftShader, no GPU needed)
//   npm run speed                     the speed check at 1x
//   npm run speed -- --throttle 4     with DevTools CPU throttling (about a budget wall tablet)
//   options: --plan <file.json>  --bundles <dir>  --browser <path>  --gpu / --swiftshader (the GPU, or WebGL on the
//   CPU)  --json (one line of JSON instead of the table)  --latency <ms> (each request takes that much longer, as
//   through a proxy: a bundle split into more files shows in the editor's first open, #245)  --trace <file.json> (a
//   DevTools performance trace of the first load, with JS samples: open it in DevTools' Performance tab)  --cache (the
//   bundles with the integration's cache headers: the second load, "load again", takes what the first one kept)
//
// The browser is found at HOME3D_BROWSER, else the usual Chrome, Chromium or Edge paths. Nothing here talks to a real
// Home Assistant.

import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import puppeteer from "puppeteer-core";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
// another build's bundles (a before/after comparison): --bundles <its custom_components/home_3d/frontend>
const bundles = resolve(opt("bundles", resolve(here, "../../custom_components/home_3d/frontend")));
const flag = (name) => args.includes(`--${name}`);
const speed = flag("speed");
const throttle = Number(opt("throttle", "1"));
const latency = Number(opt("latency", "0"));
const cached = flag("cache");
// the smoke check draws with SwiftShader (CI has no GPU); the speed check uses the machine's GPU, as the numbers in
// docs/performance.md do (SwiftShader draws every 3D frame on the CPU, which swamps the measures)
const gpu = speed ? !flag("swiftshader") : flag("gpu");
const planFile = resolve(opt("plan", resolve(here, "../../custom_components/home_3d/sample/sample-home.json")));

// Thresholds. The smoke check (CI, SwiftShader: every 3D frame is drawn on the CPU) gates what is the same on every
// machine: no errors, and no render of the panel or the 3D view for a state they do not show (#177); its load limit
// only catches a hang. The speed check's limits are about 3x the times in docs/performance.md (#178, sample home,
// desktop GPU), so they catch a regression of the kind #130/#131/#177 fixed (a render on every update, a selection
// twice as slow), not noise. Times in ms, background load in ms per second.
// The large-floor editor measure (#389, #390: 3D beside on, ~330 items, 5 updates a second, an item selected) gates
// the long frames meanwhile and the longest frame after an arrow nudge, at the tickets' targets.
const SPEED_LIMITS = {
  1: { ready: 5000, selectLinked: 50, selectPlain: 35, viewMsPerS: 5, panelMsPerS: 5, big3dBgMsPerS: 10, big3dNudge: 50 },
  4: { ready: 15000, selectLinked: 300, selectPlain: 200, viewMsPerS: 20, panelMsPerS: 20, big3dBgMsPerS: 40, big3dNudge: 150 },
};
const limits = { rendersPerS: 0.5, ...(speed ? (SPEED_LIMITS[throttle] ?? {}) : { ready: 60000 }) };

function findBrowser() {
  const given = opt("browser", process.env.HOME3D_BROWSER);
  if (given) return given;
  const known = [
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "/usr/bin/google-chrome",
    "/usr/bin/google-chrome-stable",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    "/usr/bin/microsoft-edge",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  ];
  const hit = known.find((p) => existsSync(p));
  if (!hit) throw new Error("no Chrome, Chromium or Edge found: set HOME3D_BROWSER");
  return hit;
}

const POLYFILL = resolve(here, "../node_modules/@webcomponents/scoped-custom-element-registry/scoped-custom-element-registry.min.js");
const TYPES = { ".js": "text/javascript", ".json": "application/json", ".html": "text/html", ".woff2": "font/woff2", ".txt": "text/plain" };
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>Home 3D browser check</title>
<style>html,body{margin:0;height:100%;background:#101418}fake-ha-panel-custom,home-3d-panel{display:block;height:100vh}</style></head>
<body><script type="module" src="/check/harness.js"></script></body></html>`;

/** Serves the bundles at /static/ (the lazy bundles load next to the main one), the harness and the plan. */
function serve() {
  const plan = readFileSync(planFile);
  const server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
    const send = (status, body, type = "text/plain", cache = "no-store") => {
      res.writeHead(status, { "content-type": type, "cache-control": cache });
      res.end(body);
    };
    if (path === "/") return send(200, PAGE, "text/html");
    if (path === "/favicon.ico") return send(204, "");
    if (path === "/plan.json") return send(200, plan, "application/json");
    // Home Assistant's own scoped custom element registry polyfill (#218), the version its frontend pins
    if (path === "/vendor/scoped-custom-element-registry.js") return send(200, readFileSync(POLYFILL), "text/javascript");
    // /old/: the same bundles under a second path, as the copy a cached page names (#218)
    const [root, rest] = path.startsWith("/static/") ? [bundles, path.slice(8)] : path.startsWith("/old/") ? [bundles, path.slice(5)] : path.startsWith("/check/") ? [join(here, "browser-check"), path.slice(7)] : [null, ""];
    const file = root && resolve(root, rest);
    if (!file || !file.startsWith(root) || !existsSync(file) || !statSync(file).isFile()) return send(404, "not found");
    // --cache: the bundles as the integration serves them (run 6 speed, __init__.py): kept when the URL names their
    // content, else checked on every load (the first load of the check starts with an empty cache either way); without
    // it nothing is kept, as the check always did
    const body = readFileSync(file);
    const v = new URL(req.url, "http://x").searchParams.get("v");
    const named = /^home-3d-[\w-]+-[A-Z0-9]{8}\.js$/.test(rest) || (!!v && /^[0-9a-f]{12}$/.test(v) && createHash("sha256").update(body).digest("hex").slice(0, 12) === v);
    send(200, body, TYPES[extname(file)] ?? "application/octet-stream", cached && root === bundles ? (named ? "public, max-age=31536000, immutable" : "no-cache") : "no-store");
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok(server)));
}

const problems = [];
const results = {};

const server = await serve();
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({
  executablePath: findBrowser(),
  headless: true,
  args: [
    "--no-first-run",
    "--no-default-browser-check",
    "--window-size=1280,800",
    // CI has no GPU: SwiftShader draws WebGL 2 on the CPU
    ...(gpu ? ["--ignore-gpu-blocklist"] : ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]),
    ...(process.env.CI ? ["--no-sandbox"] : []),
  ],
});
/** A page of the check, `copies` as in harness.js (#218); every problem it logs is labelled with it. */
async function openPage(copies, extra = "") {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800, deviceScaleFactor: 1 });
  const where = copies === "two" ? "" : ` [copies=${copies}${extra}]`;
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console${where}: ${m.text()}`);
  });
  page.on("pageerror", (e) => problems.push(`page error${where}: ${flag("stack") ? e.stack : e.message}`));
  page.on("requestfailed", (r) => problems.push(`request failed${where}: ${r.url()} (${r.failure()?.errorText})`));
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push(`HTTP ${r.status()}${where}: ${r.url()}`);
  });
  const cdp = await page.createCDPSession();
  if (throttle > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle });
  if (latency > 0) {
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency, downloadThroughput: -1, uploadThroughput: -1 });
  }
  await page.goto(`${origin}/?copies=${copies}${extra}`, { waitUntil: "load" });
  await page.waitForFunction(() => !!window.check, { timeout: 30000 });
  const run = (name, arg) => page.evaluate((n, a) => window.check[n](a), name, arg);
  return { page, run, where };
}

/** #218: Home Assistant's registry (its scoped-registry polyfill) knows our elements, although the bundle ran first. */
function checkKnown(load, where) {
  for (const [tag, known] of Object.entries(load?.known ?? {})) if (!known) problems.push(`customElements.get("${tag}") is undefined after Home Assistant's polyfill loaded (#218)${where}`);
}

try {
  // the full check runs with two copies of the main bundle, as on a page Home Assistant's service worker kept (#218)
  const { page, run } = await openPage("two");
  const trace = opt("trace");
  if (trace) await page.tracing.start({ path: resolve(trace), categories: ["devtools.timeline", "v8.execute", "disabled-by-default-devtools.timeline", "disabled-by-default-devtools.timeline.frame", "disabled-by-default-v8.cpu_profiler", "blink.user_timing", "loading"] });
  results.load = await run("start");
  if (trace) await page.tracing.stop();
  checkKnown(results.load, "");
  results.render = await run("renderInfo");
  if (!results.render) problems.push("the 3D view has no renderer");
  if (speed) {
    results.idleView = await run("idle", { seconds: 6, rate: 5 });
    results.idleWatched = await run("idle", { seconds: 6, rate: 5, watchedEvery: 5 });
  } else {
    results.idleView = await run("idle", { seconds: 2, rate: 5 });
  }
  // every lazy part once: a bundle or chunk that fails to load shows as a failed request or a console error, a
  // shader that does not compile as a console error
  await run("walk");
  await run("roomPanel");
  await run("looks");
  // #213: a timing wrapper around the renderer's render, "restored" with delete, on the first renderer and on the one
  // a quality change swaps in; a renderer left without render throws on the next frame (a page error)
  results.renderTrap = [await run("renderTrap", { n: 10 }), await run("renderTrap", { n: 10, quality: "low" })];
  for (const [i, r] of results.renderTrap.entries()) if (r.after !== "function") problems.push(`renderer ${i + 1} lost its render after a timing wrapper was deleted (#213)`);
  await run("itemEditor");
  await run("tab", "settings");
  await new Promise((r) => setTimeout(r, 500));
  await run("editor");
  results.select = await run("select", { n: speed ? 15 : 3 });
  // #398: an item dragged on the plan, its floating toolbar following
  results.drag = await run("drag", { n: speed ? 40 : 5 });
  if (!results.drag.moved) problems.push("a drag on the plan did not move the item (#398)");
  // #196: the help overlay takes the focus, keeps Tab and Shift+Tab inside and gives the focus back when it closes
  results.help = await run("helpDialog", { step: "open" });
  if (results.help.modal !== "true") problems.push("the help overlay is not aria-modal (#196)");
  if (results.help.lang !== "en") problems.push(`the panel's lang is ${results.help.lang}, not en (#196)`);
  if (!results.help.title || /^[a-z_]+$/.test(results.help.title)) problems.push(`the editor shows "${results.help.title}", not its English text (#196)`);
  for (const shift of [false, true]) {
    for (let i = 0; i < 40; i++) {
      if (shift) await page.keyboard.down("Shift");
      await page.keyboard.press("Tab");
      if (shift) await page.keyboard.up("Shift");
    }
    const where = await run("helpDialog", { step: "where" });
    if (!where.inside) problems.push(`${shift ? "Shift+" : ""}Tab left the help overlay (on ${where.on}, #196)`);
  }
  await page.keyboard.press("Escape");
  const closed = await run("helpDialog", { step: "closed" });
  if (closed.open || closed.back !== results.help.opener) problems.push(`the help overlay did not give the focus back (${JSON.stringify(closed)}, #196)`);
  await run("tab", 0);
  // #218: leave the panel for another sidebar page and come back, twice, without a reload: a new panel element each
  // time, which must start (it stayed blank with "Illegal constructor" from the polyfill)
  await run("reenter", { times: 2 });
  results.unknownCalls = await run("unknownCalls");
  await page.close();
  // #389: the editor with 3D beside on a large floor (the sample's ground floor copied to ~330 items)
  if (speed) {
    const bigPage = await openPage("one", "&big=330");
    try {
      await bigPage.run("start");
      await bigPage.run("editor");
      // a circuit monitor's readings at 8 a second, every fourth update a lamp
      results.big3d = await bigPage.run("editor3d", { seconds: 6, rate: 8, nudges: 4, powerTicks: true });
      if (!results.big3d.follows) problems.push("the 3D beside the plan does not show the nudged item where the plan has it (#390)");
    } catch (err) {
      problems.push(`check failed${bigPage.where}: ${err.message}`);
    } finally {
      await bigPage.page.close();
    }
  }
  // #218: the other ways the bundle can be on the page, each loaded and left and entered again
  for (const copies of ["one", "early"]) {
    const other = await openPage(copies);
    try {
      const loaded = await other.run("start");
      checkKnown(loaded, other.where);
      // #245: the editor's first open, timed on a page that has not loaded it yet
      // run 6 speed: the second load in this browser (its cache holds what the first one kept)
      if (copies === "one") results.loadAgain = loaded;
      if (copies === "one") results.editorOpen = await other.run("editorOpen");
      await other.run("reenter", { times: 2 });
    } catch (err) {
      problems.push(`check failed${other.where}: ${err.message}`);
    } finally {
      await other.page.close();
    }
  }
} catch (err) {
  problems.push(`check failed: ${err.message}`);
} finally {
  await browser.close();
  server.close();
}

const over = [];
const gate = (name, value, limit) => {
  if (value !== undefined && limit !== undefined && value > limit) over.push(`${name}: ${value} (limit ${limit})`);
};
gate("load ready ms", results.load?.ready, limits.ready);
// #177: a state the view does not show renders neither the panel nor the 3D view (counts, so the same on every machine)
gate("view mode, fp3d-view3d renders/s on unwatched states", results.idleView?.["fp3d-view3d"]?.rendersPerS ?? Infinity, limits.rendersPerS);
gate("view mode, home-3d-panel renders/s on unwatched states", results.idleView?.["home-3d-panel"]?.rendersPerS ?? Infinity, limits.rendersPerS);
if (speed) {
  gate("view mode, fp3d-view3d ms/s", results.idleView?.["fp3d-view3d"]?.msPerS, limits.viewMsPerS);
  gate("view mode, home-3d-panel ms/s", results.idleView?.["home-3d-panel"]?.msPerS, limits.panelMsPerS);
  gate("editor selection, linked item median ms", results.select?.linked.median, limits.selectLinked);
  gate("editor selection, plain item median ms", results.select?.plain.median, limits.selectPlain);
  gate("editor, 3D beside, large floor: long-frame ms/s at 8 power/lamp updates/s", results.big3d?.background.longFrameMsPerS, limits.big3dBgMsPerS);
  gate("editor, 3D beside, large floor: longest frame after a nudge, median ms", results.big3d?.nudge.median, limits.big3dNudge);
}

if (flag("json")) console.log(JSON.stringify({ throttle, plan: planFile, ...results, problems, over }));
else {
  const l = results.load ?? {};
  const row = (name, v) => console.log(`| ${name} | ${v} |`);
  console.log(`\nHome 3D browser check: ${speed ? "speed" : "smoke"}, CPU ${throttle}x, ${gpu ? "GPU" : "SwiftShader"}, ${l.items ?? "?"} items, ${l.entities ?? "?"} states\n`);
  console.log("| Measure | Value |\n|---|---|");
  row("Load: ready / longest task / total blocking", `${l.ready} / ${l.longestTask} / ${l.blocking} ms`);
  if (l.firstPicture !== undefined) row("Load: first picture of the house", `${l.firstPicture} ms`);
  const a = results.loadAgain;
  if (a) row("Load again (same browser): ready / first picture / longest task / total blocking", `${a.ready} / ${a.firstPicture} / ${a.longestTask} / ${a.blocking} ms`);
  if (results.render) row("3D: draw calls / triangles", `${results.render.calls} / ${results.render.triangles}`);
  for (const [key, label] of [["idleView", "unwatched states"], ["idleWatched", "1 in 5 watched"]]) {
    const r = results[key];
    if (!r) continue;
    for (const tag of ["home-3d-panel", "fp3d-view3d"]) if (r[tag]) row(`View mode, 5 updates/s (${label}): ${tag}`, `${r[tag].rendersPerS} renders/s (${r[tag].updatesPerS} updates), ${r[tag].msPerS} ms/s`);
    row(`View mode (${label}): long frames`, `${r.longFramesPerS}/s, ${r.longFrameMsPerS} ms/s`);
  }
  if (results.renderTrap) row("3D: renderer.render, auto / low quality (median / worst)", results.renderTrap.map((r) => `${r.frames.median} / ${r.frames.worst} ms`).join(", "));
  if (results.editorOpen !== undefined) row(`Editor first open (button to plan drawn${latency ? `, +${latency} ms a request` : ""})`, `${results.editorOpen} ms`);
  const b3 = results.big3d;
  if (b3) {
    row(`Editor, 3D beside, ${b3.items} items, 8 power/lamp updates/s: long frames`, `${b3.background.longFramesPerS}/s, ${b3.background.longFrameMsPerS} ms/s (worst ${b3.background.worst} ms)`);
    for (const tag of ["fp3d-editor", "fp3d-view3d"]) if (b3.background[tag]) row(`Editor, 3D beside, large floor, 8 updates/s: ${tag}`, `${b3.background[tag].updatesPerS} updates/s, ${b3.background[tag].msPerS} ms/s`);
    row("Editor, 3D beside, large floor: longest frame after a nudge (median / worst)", `${b3.nudge.median} / ${b3.nudge.worst} ms`);
  }
  if (results.drag) row("Editor drag of an item, per move (median / worst; editor update ms)", `${results.drag.median} / ${results.drag.worst} ms; ${results.drag.editorMsPerMove} ms`);
  if (results.select) row("Editor selection, linked / plain (median / worst)", `${results.select.linked.median} / ${results.select.linked.worst} ms, ${results.select.plain.median} / ${results.select.plain.worst} ms`);
  if (results.unknownCalls?.length) console.log(`\nCalls the fake backend has no answer for: ${results.unknownCalls.join(", ")}`);
  for (const p of problems) console.log(`PROBLEM ${p}`);
  for (const o of over) console.log(`OVER ${o}`);
  console.log(problems.length || over.length ? "\nFAILED" : "\nok");
}
process.exit(problems.length || over.length ? 1 : 0);
