// The page side of the browser check (#178): mounts the shipped panel (home-3d.js from the built bundles) with the
// fake hass and offers the measures the Node script calls through `window.check`.

import { makeFakeHass } from "./fake-hass.js";

const longFrames = [];
try {
  new PerformanceObserver((list) => {
    for (const e of list.getEntries()) longFrames.push({ at: e.startTime, ms: e.duration, blocking: e.blockingDuration ?? 0 });
  }).observe({ type: "long-animation-frame", buffered: true });
} catch {
  // an older browser without long animation frames: the counts stay empty
}

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0)));
/** The quality, set the way Settings › Screen and controls sets it (#246): the device pref, then the panel reads it. */
const setQuality = (q) => {
  localStorage.setItem("home3d.quality", q);
  panel.readPrefs();
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)] : 0;
};
const stats = (xs) => ({ median: +median(xs).toFixed(1), worst: +Math.max(0, ...xs).toFixed(1), n: xs.length });

/** Counts and times every Lit update of the elements named (performUpdate covers willUpdate, render and updated). */
const counters = {};
function countUpdates(tag) {
  const cls = customElements.get(tag);
  if (!cls || cls.prototype.__checkWrapped) return;
  const c = (counters[tag] = { updates: 0, renders: 0, ms: 0 });
  const perform = cls.prototype.performUpdate;
  cls.prototype.performUpdate = function (...args) {
    const t0 = performance.now();
    try {
      return perform.apply(this, args);
    } finally {
      c.updates++;
      c.ms += performance.now() - t0;
    }
  };
  const render = cls.prototype.render;
  cls.prototype.render = function (...args) {
    c.renders++;
    return render.apply(this, args);
  };
  cls.prototype.__checkWrapped = true;
}
const snapshot = () => Object.fromEntries(Object.entries(counters).map(([k, v]) => [k, { ...v }]));

async function waitFor(fn, timeout = 60000, what = "condition") {
  const t0 = performance.now();
  for (;;) {
    const v = fn();
    if (v) return v;
    if (performance.now() - t0 > timeout) throw new Error(`timed out waiting for ${what}`);
    await sleep(20);
  }
}

/**
 * A large home from the sample (#389): its ground floor's items copied until it holds `target`, each copy set off a
 * little and linked to entities of its own (the same ids with "_dN" added), as a large real home has. Generic data only.
 */
function enlarge(plan, target) {
  const floor = plan.floors.reduce((a, f) => ((f.furniture?.length ?? 0) > (a.furniture?.length ?? 0) ? f : a), plan.floors[0]);
  const orig = [...floor.furniture];
  const places = [...(floor.placements ?? [])];
  let seed = 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 1.2 - 0.6;
  const own = (v, n) => (typeof v === "string" && /^(light|sensor|switch|binary_sensor|input_boolean|climate|media_player|camera|cover|lock)\.[a-z0-9_]+$/.test(v) ? `${v}_d${n}` : v);
  const relink = (o, n) => (Array.isArray(o) ? o.map((x) => relink(x, n)) : o && typeof o === "object" ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, relink(v, n)])) : own(o, n));
  for (let n = 1; floor.furniture.length < target && orig.length; n++) {
    for (const f of orig) {
      if (floor.furniture.length >= target) break;
      floor.furniture.push({ ...relink(structuredClone(f), n), id: `${f.id}_d${n}`, x: +(f.x + rnd()).toFixed(2), z: +(f.z + rnd()).toFixed(2) });
    }
    for (const d of places) floor.placements.push({ ...structuredClone(d), entity_id: `${d.entity_id}_d${n}`, x: +(d.x + rnd()).toFixed(2), z: +(d.z + rnd()).toFixed(2) });
  }
  // a circuit monitor (#389): 60 plain items on smart plugs, each plug on one of 12 monitored circuits, and the house's
  // grid, solar, battery and consumption sensors, as a large real home has (their values tick many times a second)
  const plain = floor.furniture.filter((f) => !f.entity && !f.power && !f.state_entity).slice(0, 60);
  for (const [i, f] of plain.entries()) {
    f.power = `sensor.sample_plug_${i}_power`;
    f.circuit = `sensor.sample_circuit_${i % 12}_power`;
  }
  plan.energy = { ...plan.energy, grid: plan.energy?.grid ?? "sensor.sample_grid_power", solar: plan.energy?.solar ?? "sensor.sample_solar_power", battery: plan.energy?.battery ?? "sensor.sample_battery_power", consumption: plan.energy?.consumption ?? "sensor.sample_house_power" };
  return plan;
}

let fake;
let panel;
let host;

// Which copies of the main bundle the page loads (#218), from the page's ?copies=:
// - "two" (the default): the extra module from a page Home Assistant's service worker kept from before an update
//   names another URL (another path: its own chunks and Lit too) than the panel's module_url, so two copies run;
// - "one": one URL for both, as the integration registers them;
// - "early" (#357): no extra module first (a cold load straight onto the panel). The start file waits for build.json
//   before it imports the app, and a module script's load event does not wait for that, so the panel host creates the
//   panel element before it is defined and Home Assistant's polyfill upgrades it once the app defines it.
// (A copy that keeps no record of its elements, a build before #218, counts as another build since #357: the current
// one then stays out of the page and reloads it once, chunk-reload.ts; define-builds.test.ts covers it.)
const COPIES = new URLSearchParams(location.search).get("copies") ?? "two";
const PANEL_URL = "/static/home-3d.js";
const EXTRA_URL = COPIES === "one" ? PANEL_URL : "/old/home-3d.js?v=cached";

/**
 * Home Assistant's page as far as the panel is concerned (#218). Its index page imports the extra modules (our main
 * bundle) next to its own app script, which installs the scoped custom element registry polyfill first thing and then
 * defines <home-assistant>: our bundle can run first, against the browser's own registry (see COPIES for the copies).
 * Its custom panel host (ha-panel-custom) then loads module_url with a script tag and creates the panel element by
 * name; when the user goes to another sidebar page it is detached and empties itself, and coming back fills it again
 * with a NEW panel element.
 */
async function loadLikeHomeAssistant() {
  if (COPIES !== "early") {
    await import(EXTRA_URL);
    // the dashboard card's loader (a Lovelace resource) imports the bundle as well
    await import(EXTRA_URL);
  }
  await import("/vendor/scoped-custom-element-registry.js");
  customElements.define("home-assistant", class extends HTMLElement {});
  customElements.define(
    "fake-ha-panel-custom",
    class extends HTMLElement {
      connectedCallback() {
        const script = document.createElement("script");
        script.type = "module";
        script.src = PANEL_URL;
        script.onload = () => {
          if (!this.isConnected || this.firstElementChild) return;
          try {
            const element = document.createElement("home-3d-panel");
            Object.assign(element, { panel: { config: {} }, hass: fake.hass, narrow: false, route: { prefix: "/home_3d", path: "" } });
            this.appendChild(element);
          } catch (err) {
            console.error(`the panel element could not be created: ${err.message}`);
          }
        };
        document.body.appendChild(script);
      }
      disconnectedCallback() {
        while (this.lastChild) this.removeChild(this.lastChild);
      }
    },
  );
  host = document.createElement("fake-ha-panel-custom");
}

/** Show the panel (again) through the fake panel host; resolves with the panel once its 3D view has built the plan. */
async function showPanel() {
  document.body.append(host);
  panel = await waitFor(() => host.querySelector("home-3d-panel"), 30000, "the panel element");
  const view = await waitFor(() => panel.shadowRoot?.querySelector("fp3d-view3d"), 60000, "the 3D view element");
  await waitFor(() => view.viewer && view.shadowRoot?.querySelector("canvas"), 60000, "the 3D viewer");
  // the plan is built floor by floor and its shaders compile in the background (#131): ready once the viewer is not
  // busy any more and a frame went by
  await waitFor(() => view.viewer.busy && !view.viewer.busy(), 60000, "the 3D view to finish building");
  await nextFrame();
  return panel;
}

const check = {
  /** Mount the panel; resolves when the 3D view has built the plan. Times in ms from mounting the panel. */
  async start() {
    const [plan, build] = await Promise.all([fetch("/plan.json").then((r) => r.json()), fetch("/static/build.json").then((r) => r.json())]);
    // ?big=330: the large home of the editor speed measure (#389)
    const big = Number(new URLSearchParams(location.search).get("big") ?? 0);
    if (big > 0) enlarge(plan, big);
    fake = makeFakeHass(plan, build);
    await loadLikeHomeAssistant();
    countUpdates("home-3d-panel");
    // the 3D view is a chunk of its own (#179): it is counted once its code is there
    void customElements.whenDefined("fp3d-view3d").then(() => countUpdates("fp3d-view3d"));
    const t0 = performance.now();
    // the first picture of the house (run 6 speed): the first frame after a floor is built and its shaders compiled;
    // the other floors may still come in after it
    let firstPicture;
    const watch = () => {
      const v = host.querySelector("home-3d-panel")?.shadowRoot?.querySelector("fp3d-view3d")?.viewer;
      if (v?.floors?.length && !v.warming) requestAnimationFrame(() => (firstPicture = performance.now() - t0));
      else requestAnimationFrame(watch);
    };
    requestAnimationFrame(watch);
    await showPanel();
    const ready = performance.now() - t0;
    // Home Assistant asks its registry (the polyfill's) for our elements: the dashboard card and the loader look the
    // card up by name (#218); by now every copy of the bundle has run
    const known = Object.fromEntries(["home-3d-panel", "home-3d-card"].map((tag) => [tag, !!customElements.get(tag)]));
    // long animation frames are reported a little later
    await sleep(300);
    const during = longFrames.filter((f) => f.at + f.ms >= t0 && f.at <= t0 + ready);
    return {
      ready: +ready.toFixed(0),
      firstPicture: firstPicture === undefined ? undefined : +firstPicture.toFixed(0),
      longestTask: +Math.max(0, ...during.map((f) => f.ms)).toFixed(0),
      blocking: +during.reduce((s, f) => s + f.blocking, 0).toFixed(0),
      entities: Object.keys(fake.hass.states).length,
      items: plan.floors.reduce((n, f) => n + (f.furniture?.length ?? 0), 0),
      known,
    };
  },

  /**
   * Leave the panel for another sidebar page and come back without a reload (#218): the panel host is detached and
   * empties itself, then attached again and creates a new panel element. Resolves once the new panel shows the house.
   */
  async reenter({ times = 2 } = {}) {
    for (let i = 0; i < times; i++) {
      const old = panel;
      host.remove();
      await sleep(300);
      await showPanel();
      if (panel === old) throw new Error("the panel host kept the old panel element");
    }
    return true;
  },

  /**
   * Background load while nothing happens (#177): `rate` hass updates a second for `seconds`, each a filler sensor no
   * plan links; every `watchedEvery`-th one changes a state the plan shows instead (0: never).
   */
  async idle({ seconds = 5, rate = 5, watchedEvery = 0 } = {}) {
    await nextFrame();
    const before = snapshot();
    const lf0 = longFrames.length;
    const t0 = performance.now();
    const shown = fake.linked.filter((id) => id.startsWith("sensor.") || id.startsWith("light."));
    for (let i = 1; i <= seconds * rate; i++) {
      const id = watchedEvery && i % watchedEvery === 0 ? shown[i % shown.length] : undefined;
      panel.hass = fake.tick(id);
      await sleep(1000 / rate);
    }
    await nextFrame();
    const secs = (performance.now() - t0) / 1000;
    const after = snapshot();
    const per = {};
    for (const [tag, c] of Object.entries(after)) {
      const b = before[tag] ?? { updates: 0, renders: 0, ms: 0 };
      per[tag] = { updatesPerS: +((c.updates - b.updates) / secs).toFixed(1), rendersPerS: +((c.renders - b.renders) / secs).toFixed(1), msPerS: +((c.ms - b.ms) / secs).toFixed(1) };
    }
    const lf = longFrames.slice(lf0);
    return { ...per, longFramesPerS: +(lf.length / secs).toFixed(2), longFrameMsPerS: +(lf.reduce((s, f) => s + f.ms, 0) / secs).toFixed(1) };
  },

  /** Walk through the house and back (#179: walking is a chunk of its own that loads now). */
  async walk() {
    const view = panel.shadowRoot.querySelector("fp3d-view3d");
    await view.startWalk();
    await waitFor(() => view.walker, 30000, "walking to start");
    await nextFrame();
    view.stopWalk();
    await view.updateComplete;
    return true;
  },

  /** A tapped room shows its room panel (#245: the panel's code is a chunk of its own that loads then or when idle). */
  async roomPanel() {
    const room = panel.data.building.floors.flatMap((f) => f.rooms)[0];
    if (!room) return false;
    panel._roomId = room.id;
    await panel.updateComplete;
    const el = await waitFor(() => customElements.get("fp3d-room-panel") && panel.shadowRoot.querySelector("fp3d-room-panel"), 30000, "the room panel");
    await el.updateComplete;
    if (!el.shadowRoot?.childElementCount) throw new Error("the room panel drew nothing");
    panel._roomId = null;
    await panel.updateComplete;
    return true;
  },

  /** Click a tab of the panel by its position (0 View, 1 Editor, 2 Extensions; underlined navigation since #249) or the
   * Settings tab. */
  async tab(which) {
    const root = panel.shadowRoot;
    const button = which === "settings" ? root.querySelector(".fp3d-tab-settings") : root.querySelectorAll("header .fp3d-tabs > button:not(.fp3d-tab-settings)")[which];
    if (!button) throw new Error(`no tab ${which}`);
    button.click();
    await panel.updateComplete;
    await nextFrame();
  },

  /** Open the editor and wait for its plan. */
  async editor() {
    await check.tab(1);
    const ed = await waitFor(() => panel.shadowRoot.querySelector("fp3d-editor"), 60000, "the editor");
    countUpdates("fp3d-editor");
    await waitFor(() => ed.shadowRoot?.querySelector("svg.fp3d-plan"), 60000, "the editor's plan");
    await ed.updateComplete;
    await sleep(300);
    return ed;
  },

  /**
   * The editor's first open on a page that has not loaded it yet (#245): ms from the Editor button to its plan drawn,
   * its bundle and chunks fetched on the way. Back in the view afterwards.
   */
  async editorOpen() {
    const t0 = performance.now();
    await check.tab(1);
    const ed = await waitFor(() => panel.shadowRoot.querySelector("fp3d-editor"), 60000, "the editor");
    await waitFor(() => ed.shadowRoot?.querySelector("svg.fp3d-plan"), 60000, "the editor's plan");
    await ed.updateComplete;
    await nextFrame();
    const ms = Math.round(performance.now() - t0);
    await sleep(300);
    await check.tab(0);
    return ms;
  },

  /**
   * Editor selection (as #97/#130): press an item in the plan, timed to the updated panel painted. Alternates a
   * linked item and a plain one, `n` presses each.
   */
  async select({ n = 10 } = {}) {
    const ed = panel.shadowRoot.querySelector("fp3d-editor") ?? (await check.editor());
    const svg = ed.shadowRoot.querySelector("svg.fp3d-plan");
    const floor = ed.floor;
    const items = floor?.furniture ?? [];
    const isLinked = (f) => !!(f.entity || f.power || f.state_entity);
    const linked = items.find((f) => isLinked(f) && f.w > 0.3 && f.d > 0.3);
    const plain = items.find((f) => !isLinked(f) && f.w > 0.4 && f.d > 0.4 && f !== linked);
    if (!linked || !plain) throw new Error("the plan's first floor needs a linked and a plain item");
    const press = async (f) => {
      // the editor's own view keeps its zoom: ask it where the item is now
      // (another item drawn over this one would take the press: the check below says so)
      const [sx, sy] = ed.toScreen([f.x, f.z]);
      const rect = svg.getBoundingClientRect();
      const opts = { bubbles: true, composed: true, pointerId: 1, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1, clientX: rect.left + sx, clientY: rect.top + sy };
      const target = ed.shadowRoot.elementFromPoint(opts.clientX, opts.clientY) ?? svg;
      const t0 = performance.now();
      target.dispatchEvent(new PointerEvent("pointerdown", opts));
      target.dispatchEvent(new PointerEvent("pointerup", { ...opts, buttons: 0 }));
      await ed.updateComplete;
      await nextFrame();
      const ms = performance.now() - t0;
      if (ed._furnitureId !== f.id) throw new Error(`a press on ${f.id} selected ${ed._furnitureId ?? "nothing"}`);
      return ms;
    };
    const times = { linked: [], plain: [] };
    // one press each first: the entity lists are built once (#130), later selections reuse them
    await press(linked);
    await press(plain);
    for (let i = 0; i < n; i++) {
      times.linked.push(await press(linked));
      await sleep(60);
      times.plain.push(await press(plain));
      await sleep(60);
    }
    return { linked: stats(times.linked), plain: stats(times.plain) };
  },

  /**
   * Dragging an item on the plan (#398): a plain item pressed, `n` pointer moves (each timed to the plan painted),
   * let go and undone. Also how many ms the editor's updates took per move (its whole render, the side panel and the
   * floating item toolbar included).
   */
  async drag({ n = 40 } = {}) {
    const ed = panel.shadowRoot.querySelector("fp3d-editor") ?? (await check.editor());
    const svg = ed.shadowRoot.querySelector("svg.fp3d-plan");
    const f = (ed.floor?.furniture ?? []).find((m) => !m.entity && !m.power && !m.state_entity && !m.locked && m.w > 0.4 && m.d > 0.4);
    if (!f) throw new Error("the plan's first floor needs a plain item");
    ed.selectItem("furniture", f.id);
    await ed.updateComplete;
    await nextFrame();
    const [sx, sy] = ed.toScreen([f.x, f.z]);
    const rect = svg.getBoundingClientRect();
    const base = { bubbles: true, composed: true, pointerId: 7, pointerType: "mouse", isPrimary: true, button: 0, buttons: 1 };
    const target = ed.shadowRoot.elementFromPoint(rect.left + sx, rect.top + sy) ?? svg;
    // a made-up pointer cannot be captured: the plan's capture calls do nothing for this drag
    svg.setPointerCapture = svg.releasePointerCapture = () => undefined;
    target.dispatchEvent(new PointerEvent("pointerdown", { ...base, clientX: rect.left + sx, clientY: rect.top + sy }));
    await ed.updateComplete;
    const c0 = snapshot()["fp3d-editor"] ?? { updates: 0, ms: 0 };
    const times = [];
    for (let i = 1; i <= n; i++) {
      const t0 = performance.now();
      svg.dispatchEvent(new PointerEvent("pointermove", { ...base, clientX: rect.left + sx + i * 3, clientY: rect.top + sy + (i % 2) }));
      await ed.updateComplete;
      await nextFrame();
      times.push(performance.now() - t0);
    }
    const c1 = snapshot()["fp3d-editor"] ?? { updates: 0, ms: 0 };
    svg.dispatchEvent(new PointerEvent("pointerup", { ...base, buttons: 0, clientX: rect.left + sx + n * 3, clientY: rect.top + sy }));
    await ed.updateComplete;
    const moved = ed.floor.furniture.find((m) => m.id === f.id).x !== f.x;
    delete svg.setPointerCapture;
    delete svg.releasePointerCapture;
    ed.undo();
    await ed.updateComplete;
    return { ...stats(times), editorMsPerMove: +((c1.ms - c0.ms) / n).toFixed(2), moved, toolbar: !!ed.shadowRoot.querySelector(".fp3d-itembar") };
  },

  /**
   * The editor with 3D beside on, on a large floor (#389, #390): an item selected, `rate` hass updates a second for
   * `seconds` (every `watchedEvery`-th a state the plan shows: lamps and sensors), long-frame ms a second meanwhile; then
   * `nudges` arrow nudges of the item, each with the longest frame in the 1.2 s after it (the 3D beside follows the
   * edit). The nudges are undone again.
   */
  async editor3d({ seconds = 6, rate = 5, watchedEvery = 5, nudges = 4, powerTicks = false } = {}) {
    const ed = panel.shadowRoot.querySelector("fp3d-editor") ?? (await check.editor());
    if (!ed._split) {
      ed._split = true;
      await ed.updateComplete;
    }
    const view = await waitFor(() => ed.shadowRoot.querySelector("fp3d-view3d"), 30000, "the 3D view beside the plan");
    await waitFor(() => view.viewer?.busy && !view.viewer.busy(), 60000, "the 3D view beside the plan to build");
    const items = ed.floor?.furniture ?? [];
    const item = items.find((f) => !f.entity && !f.power && !f.state_entity && f.w > 0.4 && f.d > 0.4) ?? items[0];
    ed.selectItem("furniture", item.id);
    await ed.updateComplete;
    await sleep(1500);
    const shown = fake.linked.filter((id) => id.startsWith("sensor.") || id.startsWith("light."));
    // powerTicks: every update a power reading of a plug, a circuit or the house (a circuit monitor), every fourth a lamp
    const power = fake.linked.filter((id) => id.endsWith("_power"));
    const lamps = fake.linked.filter((id) => id.startsWith("light."));
    const lf0 = longFrames.length;
    const t0 = performance.now();
    const before = snapshot();
    for (let i = 1; i <= seconds * rate; i++) {
      const id = powerTicks ? (i % 4 === 0 && lamps.length ? lamps[(i * 7) % lamps.length] : power[(i * 31) % power.length]) : watchedEvery && i % watchedEvery === 0 ? shown[(i * 31) % shown.length] : undefined;
      panel.hass = fake.tick(id);
      await sleep(1000 / rate);
    }
    await nextFrame();
    const secs = (performance.now() - t0) / 1000;
    const lf = longFrames.slice(lf0);
    const now = snapshot();
    const per = Object.fromEntries(Object.entries(now).map(([tag, c]) => [tag, { updatesPerS: +((c.updates - (before[tag]?.updates ?? 0)) / secs).toFixed(1), msPerS: +((c.ms - (before[tag]?.ms ?? 0)) / secs).toFixed(1) }]));
    const background = { ...per, longFramesPerS: +(lf.length / secs).toFixed(2), longFrameMsPerS: +(lf.reduce((s, f) => s + f.ms, 0) / secs).toFixed(1), worst: +Math.max(0, ...lf.map((f) => f.ms)).toFixed(0) };
    const after = [];
    for (let i = 0; i < nudges; i++) {
      const at = performance.now();
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
      await ed.updateComplete;
      await sleep(1200);
      after.push(Math.max(0, ...longFrames.filter((f) => f.at + f.ms >= at).map((f) => f.ms)));
    }
    // the 3D beside shows the item where the plan has it, after the nudges and after undoing them (#390)
    const shownAt = () => view.viewer.floors.find((fv) => fv.floor.id === ed.floor.id)?.floor.furniture.find((f) => f.id === item.id)?.x;
    const planAt = () => ed.floor.furniture.find((f) => f.id === item.id)?.x;
    const follows = [];
    follows.push(Math.abs((shownAt() ?? NaN) - planAt()) < 1e-6);
    for (let i = 0; i < nudges; i++) window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true }));
    await ed.updateComplete;
    await sleep(1500);
    follows.push(Math.abs((shownAt() ?? NaN) - planAt()) < 1e-6 && planAt() === item.x);
    return { items: items.length, background, nudge: stats(after), follows: follows.every(Boolean) };
  },

  /** The 3D view's renderer counters after load. */
  renderInfo() {
    const view = panel.shadowRoot.querySelector("fp3d-view3d");
    const info = view?.viewer?.renderer?.info;
    return info ? { calls: info.render.calls, triangles: info.render.triangles, geometries: info.memory.geometries, textures: info.memory.textures } : null;
  },

  /**
   * Time the renderer's `render` the way a hand-written live speed check did (#213): wrap it, draw `n` frames, then
   * "restore" it with `delete`. three.js gives each renderer its own `render` (none on the prototype), so before #213
   * the delete left the renderer without one and every later frame and floor picture threw "this.renderer.render is
   * not a function". Then a frame and the floor pictures are drawn; a page error fails the check. `quality`: switch
   * to it first, so the renderer a quality change swaps in (#131) is tried as well.
   */
  async renderTrap({ n = 10, quality } = {}) {
    const view = panel.shadowRoot.querySelector("fp3d-view3d");
    if (quality) {
      setQuality(quality);
      await panel.updateComplete;
      await waitFor(() => !view.viewer.busy(), 60000, `the ${quality} quality`);
      await nextFrame();
    }
    const viewer = view.viewer;
    const rd = viewer.renderer;
    const orig = rd.render;
    const times = [];
    rd.render = function (...a) {
      const t0 = performance.now();
      try {
        return orig.apply(this, a);
      } finally {
        times.push(performance.now() - t0);
      }
    };
    for (let i = 0; i < n; i++) {
      viewer.invalidate();
      await nextFrame();
    }
    // a sloppy script's delete; a strict one would throw now that render cannot be deleted
    const removed = Reflect.deleteProperty(rd, "render");
    const after = typeof rd.render;
    viewer.invalidate();
    await nextFrame();
    const thumbs = viewer.floorThumbnails(150, 112).length;
    if (quality) {
      setQuality("auto");
      await panel.updateComplete;
      await waitFor(() => !view.viewer.busy(), 60000, "the auto quality");
    }
    return { frames: stats(times), removed, after, thumbs };
  },

  /**
   * Every look once (their shaders compile: a broken one logs an error), then back to the first; and the read-only 2D
   * plan, which is a bundle of its own.
   */
  async looks() {
    const view = panel.shadowRoot.querySelector("fp3d-view3d");
    const first = panel._theme;
    // and a homely style and a palette (#436): natural materials build the house once, a palette is shader numbers
    for (const look of ["day", "realistic", "blueprint", "cozy", "synthwave", first]) {
      panel._theme = look;
      await panel.updateComplete;
      await view.updateComplete;
      await waitFor(() => !view.viewer.busy(), 60000, `the ${look} look`);
      await nextFrame();
    }
    // the "2D or 3D" switch beside the View menu
    const button = (label) => [...panel.shadowRoot.querySelectorAll('.fp3d-seg[aria-label="2D or 3D"] button')].find((b) => b.textContent.trim() === label);
    const flat = button("2D");
    if (!flat) throw new Error("no 2D button");
    // the panel may draw another view element for the plan: ask for it each time
    const shown = () => panel.shadowRoot.querySelector("fp3d-view3d");
    flat.click();
    await waitFor(() => shown()?.plan2d, 10000, "the 2D plan");
    // its bundle loads now: a failed download shows as a failed request or a console error
    await sleep(1500);
    button("3D").click();
    await waitFor(() => shown()?.viewer?.busy && !shown().plan2d && !shown().viewer.busy(), 60000, "the 3D view back");
    await sleep(500);
    return true;
  },

  /** The item editor (a bundle of its own, opened from the Extensions tab), opened and closed again. */
  async itemEditor() {
    await check.tab(2);
    const ext = await waitFor(() => panel.shadowRoot.querySelector("fp3d-extensions"), 60000, "the Extensions tab");
    await ext.updateComplete;
    await ext.openItemEditor();
    const dialog = await waitFor(() => document.querySelector("fp3d-item-editor"), 30000, "the item editor");
    await dialog.updateComplete;
    await sleep(500);
    dialog.remove();
    return true;
  },

  /**
   * The editor's help overlay (#196), opened from the hint bar's Help button (the toolbar's "?" went in #249): whether it took the focus, and (`step: "where"`)
   * whether the focus is still inside it, or (`step: "closed"`) back on the button. The Node script presses the keys.
   */
  async helpDialog({ step }) {
    const ed = panel.shadowRoot.querySelector("fp3d-editor") ?? (await check.editor());
    const root = ed.shadowRoot;
    const box = () => root.querySelector(".fp3d-help-overlay");
    if (step === "open") {
      const button = root.querySelector(".fp3d-hint-help");
      if (!button) throw new Error("no help button");
      button.focus();
      button.click();
      await ed.updateComplete;
      await waitFor(() => box() && root.activeElement && box().contains(root.activeElement), 5000, "the help overlay to take the focus");
      // the editor bundle borrows the main bundle's English texts (#196): a missing table would show the key
      return { modal: box().getAttribute("aria-modal"), lang: panel.getAttribute("lang"), title: box().querySelector("h3")?.textContent ?? "", opener: button.textContent.trim() };
    }
    if (step === "where") return { inside: !!box() && box().contains(root.activeElement), on: root.activeElement?.className ?? root.activeElement?.tagName };
    await ed.updateComplete;
    await nextFrame();
    return { open: !!box(), back: root.activeElement?.textContent?.trim() ?? null };
  },

  /** The page's announcements so far (#196): the live region's text. */
  announced: () => document.getElementById("fp3d-announce")?.textContent ?? null,

  /** What the fake backend was asked that it has no answer for. */
  unknownCalls: () => [...(fake?.unknown ?? [])],
};

window.check = check;
