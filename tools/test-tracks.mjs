// Tests options/_shared/track-actions.js against the live demo (the real panel and the fake Home Assistant).
// A small page (served from memory) embeds the demo with mountLive, as the site does, and runs each of the eight
// tracks in order, then in a rapid random order (the newest call must win and leave nothing of the others behind).
// Passes: the compact embed at desktop width, the editor build (?edit=1), and the compact embed at phone width with
// reduced motion. Each track must resolve true, change at least MIN_CHANGE of the view's pixels, and no frame may log
// a console error or a page error. Before/after JPEGs go to demo/_track-shots/.
// Run: node tools/test-tracks.mjs [compact|editor|phone ...]   (no argument: all three passes)
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const require = createRequire("C:/git/h3d-wt/logo-9a/frontend/package.json");
const puppeteer = require("puppeteer-core");
const root = resolve(import.meta.dirname, "..");
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".png": "image/png", ".txt": "text/plain" };
const HARNESS = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="icon" href="data:,"><link rel="stylesheet" href="live-embed.css"><style>html,body{margin:0;height:100%;background:#0A1B31}#live{height:100vh}</style></head>
<body><div id="live"></div><script type="module">
import { mountLive } from "./live-embed.js";
import { runTrack, TRACKS, trackNote } from "./track-actions.js";
const src = new URLSearchParams(location.search).get("src");
window.live = mountLive(document.querySelector("#live"), src ? { src } : {});
window.runTrack = (name, options) => runTrack(name, window.live, options);
window.TRACKS = TRACKS;
window.trackNote = trackNote;
window.probe = () => new Promise((ok) => {
  const on = (e) => { if (e.source === window.live.frame.contentWindow && e.data?.home3d === "probe" && e.data.id === "test") { removeEventListener("message", on); ok(e.data); } };
  addEventListener("message", on);
  window.live.frame.contentWindow.postMessage({ home3d: "cmd", cmd: "probe", id: "test" }, "*");
  setTimeout(() => ok(null), 2000);
});
/** Share of pixels that differ clearly between two JPEG data URLs. */
window.diff = async (a, b) => {
  const load = (src) => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const [x, y] = await Promise.all([load(a), load(b)]);
  const w = 240, h = Math.round((240 * x.height) / x.width);
  const px = (img) => { const c = new OffscreenCanvas(w, h); const g = c.getContext("2d"); g.drawImage(img, 0, 0, w, h); return g.getImageData(0, 0, w, h).data; };
  const p = px(x), q = px(y);
  let n = 0;
  for (let i = 0; i < p.length; i += 4) if (Math.abs(p[i] - q[i]) + Math.abs(p[i + 1] - q[i + 1]) + Math.abs(p[i + 2] - q[i + 2]) > 60) n++;
  return n / (w * h);
};
</script></body></html>`;

const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/options/_shared/__tracks.html") {
    res.writeHead(200, { "content-type": "text/html", "cache-control": "no-store" });
    return res.end(HARNESS);
  }
  if (p.endsWith("/")) p += "index.html";
  const f = resolve(join(root, p));
  if (!f.startsWith(root) || !existsSync(f) || !statSync(f).isFile()) {
    res.writeHead(404);
    return res.end();
  }
  res.writeHead(200, { "content-type": TYPES[extname(f)] ?? "application/octet-stream", "cache-control": "no-store" });
  res.end(readFileSync(f));
});
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const origin = `http://127.0.0.1:${server.address().port}`;
const shots = resolve(root, "demo/_track-shots");
mkdirSync(shots, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const PASSES = {
  compact: { width: 900, height: 560, src: null, reduce: false },
  editor: { width: 1200, height: 760, src: "../../demo/index.html?edit=1", reduce: false },
  phone: { width: 390, height: 700, src: null, reduce: true, mobile: true },
};
const MIN_CHANGE = 0.02;
const wanted = process.argv.slice(2).filter((a) => PASSES[a]);
const passes = wanted.length ? wanted : Object.keys(PASSES);

const browser = await puppeteer.launch({
  executablePath: "C:/Program Files/Google/Chrome Beta/Application/chrome.exe",
  headless: true,
  args: ["--no-first-run", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--hide-scrollbars"],
});
const failures = [];
const fail = (msg) => {
  failures.push(msg);
  console.log(`FAIL ${msg}`);
};

for (const name of passes) {
  const pass = PASSES[name];
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setCacheEnabled(false);
  await page.setViewport({ width: pass.width, height: pass.height, deviceScaleFactor: 1, isMobile: !!pass.mobile, hasTouch: !!pass.mobile });
  await page.emulateMediaFeatures([{ name: "prefers-reduced-motion", value: pass.reduce ? "reduce" : "no-preference" }]);
  const errors = [];
  page.on("pageerror", (e) => errors.push(`page error: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));
  page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()}`));
  page.on("response", (r) => r.status() >= 400 && errors.push(`HTTP ${r.status()}: ${r.url()}`));
  const url = `${origin}/options/_shared/__tracks.html${pass.src ? `?src=${encodeURIComponent(pass.src)}` : ""}`;
  await page.goto(url, { waitUntil: "load" });
  // the demo is ready when it answers a probe
  let ready = null;
  for (let i = 0; i < 60 && !ready; i++) {
    await sleep(500);
    ready = await page.evaluate(() => window.probe?.());
  }
  if (!ready) {
    fail(`${name}: the demo did not start`);
    await ctx.close();
    continue;
  }
  await sleep(2500);
  const shot = async () => `data:image/jpeg;base64,${await page.screenshot({ type: "jpeg", quality: 55, encoding: "base64" })}`;
  const save = (file, dataUrl) => writeFileSync(join(shots, file), Buffer.from(dataUrl.split(",")[1], "base64"));
  const tracks = await page.evaluate(() => window.TRACKS);
  const reducedMotion = pass.reduce;

  // 1. each track in order: true, and the view changed
  console.log(`== ${name} (${pass.width}x${pass.height}${pass.reduce ? ", reduced motion" : ""}): in order`);
  let before = await shot();
  for (const track of tracks) {
    const t0 = Date.now();
    const ok = await page.evaluate((n, r) => window.runTrack(n, { reducedMotion: r }), track, reducedMotion);
    await sleep(700);
    const after = await shot();
    const change = await page.evaluate((a, b) => window.diff(a, b), before, after);
    const state = await page.evaluate(() => window.probe());
    save(`${name}-${track}-before.jpg`, before);
    save(`${name}-${track}-after.jpg`, after);
    console.log(`  ${track.padEnd(8)} ok=${ok} change=${(change * 100).toFixed(1)}% ${Date.now() - t0} ms  ${JSON.stringify({ floor: state?.floor, room: state?.room, plan2d: state?.plan2d, tt: state?.timeTravel, wall: state?.cameraWall, through: state?.through, walk: state?.walk, editor: state?.editor, library: state?.library, flows: state?.flows, cheap: state?.cheapRate, solar: state?.solarCard, heat: state?.heat, alerts: state?.alerts?.length, lightsOn: state?.lightsOn, answer: state?.answer })}`);
    if (ok !== true) fail(`${name}/${track}: runTrack resolved ${ok}`);
    if (!(change >= MIN_CHANGE)) fail(`${name}/${track}: the view changed only ${(change * 100).toFixed(1)}%`);
    before = after;
  }

  // 2. a rapid random order, twice: only the newest call may resolve true, and only its own effects remain
  for (let round = 1; round <= 2; round++) {
    const order = [...tracks];
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    console.log(`== ${name}: rapid round ${round}: ${order.join(", ")}`);
    // each run's result, and whether a newer call came while it was still running (then it must not resolve true)
    const runs = await page.evaluate(async (list, r) => {
      const out = list.map(() => ({ called: 0, done: 0, ok: null }));
      const all = [];
      for (let i = 0; i < list.length; i++) {
        out[i].called = performance.now();
        all.push(window.runTrack(list[i], { reducedMotion: r }).then((ok) => Object.assign(out[i], { ok, done: performance.now() })));
        await new Promise((ok) => setTimeout(ok, 120 + Math.random() * 250));
      }
      await Promise.all(all);
      return out.map((x, i) => ({ ok: x.ok, overtaken: i < out.length - 1 && out[i + 1].called < x.done }));
    }, order, reducedMotion);
    const results = runs.map((x) => x.ok);
    const last = order[order.length - 1];
    await sleep(700);
    const state = await page.evaluate(() => window.probe());
    save(`${name}-rapid${round}-${last}.jpg`, await shot());
    console.log(`  results ${JSON.stringify(results)} last=${last} ${JSON.stringify({ floor: state?.floor, tt: state?.timeTravel, wall: state?.cameraWall, through: state?.through, walk: state?.walk, plan2d: state?.plan2d, editor: state?.editor, leak: state?.leak })}`);
    if (results[results.length - 1] !== true) fail(`${name}/rapid${round}: the last track (${last}) resolved ${results[results.length - 1]}`);
    if (runs.some((x) => x.overtaken && x.ok === true)) fail(`${name}/rapid${round}: an overtaken track still resolved true`);
    // nothing of the overtaken tracks may stay: each of these belongs to one track only
    const own = { time: state?.timeTravel, draw: state?.plan2d || (pass.src && state?.editor && !state?.library), furnish: state?.walk || state?.library };
    for (const [track, on] of Object.entries(own)) if (on && track !== last) fail(`${name}/rapid${round}: ${track} is still showing after ${last}`);
    if (state?.leak === "on" && last !== "sense") fail(`${name}/rapid${round}: the leak is still wet after ${last}`);
  }

  // 3. back to the plain view: a reset leaves the whole house in 3D
  const plain = await page.evaluate(async () => {
    const win = window.live.frame.contentWindow;
    return new Promise((ok) => {
      const on = (e) => { if (e.source === win && e.data?.home3d === "scenario" && e.data.id === "plain") { removeEventListener("message", on); ok(e.data.ok); } };
      addEventListener("message", on);
      win.postMessage({ home3d: "cmd", cmd: "scenario", name: "reset", lights: true, id: "plain" }, "*");
      setTimeout(() => ok(false), 6000);
    });
  });
  const end = await page.evaluate(() => window.probe());
  if (!plain || end?.floor !== "Whole house" || end?.timeTravel || end?.cameraWall || end?.plan2d || end?.room || end?.walk) fail(`${name}: reset did not return to the whole house (${JSON.stringify(end)})`);

  // the page must not scroll sideways at this width
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  if (sideways) fail(`${name}: the page scrolls sideways`);
  const real = errors.filter((e) => !/GL Driver Message|KHR_parallel_shader_compile/.test(e));
  for (const e of real) fail(`${name}: ${e}`);
  await ctx.close();
}

await browser.close();
server.close();
console.log(failures.length ? `\n${failures.length} failure(s)` : "\nAll track tests passed.");
process.exit(failures.length ? 1 : 0);
