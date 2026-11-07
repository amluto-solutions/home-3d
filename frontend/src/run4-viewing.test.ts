// Run 4 UX pass, viewing (#257-#260): the time bar on a phone, notices, the phone 3D view and the Day look.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener: () => undefined, removeEventListener: () => undefined });
g.location = { search: "", hash: "", pathname: "/home_3d" };
g.history = { state: null, replaceState: () => undefined };

type Styled = { styles: unknown };
const text = (s: unknown): string => (Array.isArray(s) ? s.map(text).join("\n") : ((s as { cssText?: string })?.cssText ?? ""));
const src = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
function flat(v: unknown): string {
  if (v === null || v === undefined || typeof v === "symbol" || typeof v === "boolean" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const r = v as { strings: readonly string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(v);
}
/** The body of the first block that starts with `head` (a selector or an at-rule). */
function block(css: string, head: string, from = 0): string {
  const at = css.indexOf(head, from);
  assert.ok(at >= 0, `${head} not found`);
  let i = css.indexOf("{", at) + 1;
  const start = i;
  let depth = 1;
  while (depth && i < css.length) depth += css[i] === "{" ? 1 : css[i] === "}" ? -1 : 0, i++;
  return css.slice(start, i - 1);
}

const { Fp3dTimeBar, tickLabelFits, TICK_LABEL_ROOM } = await import("./components/time-bar.ts");
const { englishTable } = await import("./i18n.ts");
const en = englishTable() as Record<string, string>;

// ---- #257: time travel on a phone ----

const barCss = text((Fp3dTimeBar as unknown as Styled).styles);
const narrow = block(barCss, "@container fp3dtt");

test("#257 V01: on a phone the time bar grows upwards from the bottom edge, inside the safe area", () => {
  const bar = block(narrow, ".bar");
  assert.match(bar, /height:\s*auto/);
  assert.match(bar, /bottom:\s*calc\(8px \+ env\(safe-area-inset-bottom/);
});

test("#257 V01: the way back to the present shares the top row with the track, the buttons wrap below it", () => {
  // the track first, then Live, then a full-width break, then the buttons
  assert.match(block(narrow, ".track"), /order:\s*-2/);
  assert.match(block(narrow, ".live"), /order:\s*-1/);
  const brk = block(narrow, ".bar::after");
  assert.match(brk, /order:\s*-1/);
  assert.match(brk, /flex:\s*1 0 100%/);
  // the row of buttons fits a 390 px phone with 44 px targets: prev, play, next, the list (44 each), 24 h and the speed
  const row = 4 * 44 + 47 + 60 + 5 * 6;
  assert.ok(row <= 390 - 16 - 16 - 2, `${row}px`);
});

test("#257 V01: the panel reserves the two-row bar's real height and keeps the time travel chip on a phone", () => {
  const css = src("./panel.ts");
  const phone = css.slice(css.indexOf("/* phones: the time bar takes two rows"));
  assert.match(phone, /--fp3d-tt-h: calc\(120px \+ env\(safe-area-inset-bottom/);
  assert.match(phone, /@media \(pointer: coarse\)\s*\{\s*\.fp3d-tt > \*\s*\{\s*--fp3d-tt-h: calc\(138px/);
  // the two-row bar on a touch screen: padding 6 + label room 14 + track 44 + 6 + buttons 44 + padding 6 + border 2, and 16 below
  assert.ok(6 + 14 + 44 + 6 + 44 + 6 + 2 + 8 <= 138);
  // the switches (and with them the time travel chip) are no longer hidden while time travel is open
  assert.doesNotMatch(phone.slice(0, 600), /\.fp3d-tt \.fp3d-overlay \{\s*display: none/);
  assert.match(src("./card.ts"), /--fp3d-tt-h: calc\(138px/);
});

function session(over: Record<string, unknown> = {}) {
  return {
    t: (k: string, v?: Record<string, unknown>) => (en[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => String(v?.[n] ?? "")),
    state: "loading",
    progress: 0.5,
    playback: null,
    error: null,
    start: 0,
    end: 24 * 3600000,
    range: "24h",
    maxDays: 7,
    atNow: false,
    ...over,
  };
}

test("#257 V21: the Demo tag sits inside the clock card beside the title, and the panel's own Demo chip steps aside", () => {
  const bar = new Fp3dTimeBar() as unknown as { session: unknown; demo: boolean; render(): unknown };
  bar.session = session();
  bar.demo = true;
  const out = flat(bar.render());
  const badge = out.slice(out.indexOf('class="badge"'), out.indexOf("</span>", out.indexOf('class="badge"')));
  assert.match(badge, /class="demo"/);
  assert.ok(badge.includes(en.demo_chip));
  bar.demo = false;
  assert.doesNotMatch(flat(bar.render()), /class="demo"/);
  const panel = src("./panel.ts");
  assert.match(panel, /<fp3d-time-bar \.session=\$\{this\.tt\.session\} \?demo=\$\{showsDemo\(hass\)\}>/);
  assert.match(panel, /showsDemo\(hass\) && !this\.tt\.session \? html`<div class="fp3d-demo-chip"/);
});

test("#257 V22: a timeline label too near the end of the track is left out, and the track keeps a gutter before the chips", () => {
  assert.equal(tickLabelFits(1034, 998), false);
  assert.equal(tickLabelFits(1034, 1034 - TICK_LABEL_ROOM), true);
  assert.equal(tickLabelFits(288, 280), false);
  assert.match(block(barCss, ".track {"), /margin:\s*0 12px 0 4px/);
});

// ---- #258: notices never cover a control ----

const { Floorplan3dPanel, noticeTapTooSoon, NOTICE_ARM_MS } = await import("./panel.ts");
const { emptyBuilding } = await import("./model.ts");
const panelCss = text((Floorplan3dPanel as unknown as Styled).styles);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function panel(): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (Floorplan3dPanel as any)();
  p.hass = { language: "en", user: { id: "u", is_admin: true, name: "x" }, states: {}, themes: { darkMode: true } };
  const b = emptyBuilding();
  const room = (id: string, name: string) => ({ id, name, points: [[0, 0], [4, 0], [4, 3], [0, 3]], area_id: null });
  b.floors = [
    { id: "f1", name: "Ground", rooms: [room("k", "Kitchen"), room("b1", "Bedroom")], furniture: [], placements: [], openings: [], walls: [], outdoor: [], height: 2.5, elevation: 0 },
    { id: "f2", name: "Upper", rooms: [room("b2", "Bedroom"), room("s", "Study")], furniture: [], placements: [], openings: [], walls: [], outdoor: [], height: 2.5, elevation: 2.5 },
  ] as unknown as typeof b.floors;
  p.data.building = b;
  p.data.canEdit = true;
  p.willUpdate(new Map());
  return p;
}

test("#258 V02/V03/E03: notices sit in a strip of their own under the header, never over the page's controls", () => {
  const strip = block(panelCss, ".fp3d-notices {");
  assert.match(strip, /flex:\s*none/);
  assert.doesNotMatch(strip, /position:\s*absolute/);
  assert.doesNotMatch(panelCss, /\.fp3d-notices \{[^}]*position:\s*(absolute|fixed)/);
  const p = panel();
  p.data.saveState = "error";
  p.data.saveError = "offline";
  const out = flat(p.render());
  // in the page's flow between the header and the view: the floors row, Walk and the editor's toolbar come below it
  const header = out.indexOf('<header class="fp3d-header');
  const notices = out.indexOf('<div class="fp3d-notices"');
  const nav = out.indexOf('<nav class="fp3d-nav"');
  assert.ok(header >= 0 && notices > header && nav > notices, `${header} ${notices} ${nav}`);
});

test("#258 V03: a tap that lands on a notice just after it appeared does nothing (it was aimed at what was there)", () => {
  assert.equal(noticeTapTooSoon(1000, 1000 + NOTICE_ARM_MS - 1), true);
  assert.equal(noticeTapTooSoon(1000, 1000 + NOTICE_ARM_MS), false);
  assert.ok(NOTICE_ARM_MS >= 500 && NOTICE_ARM_MS <= 1500);
  const p = panel();
  p.data.saveState = "error";
  p.data.saveError = "offline";
  p.noticeKey = "save";
  const before = performance.now();
  const tpl = p.renderNotices([{ key: "save", body: "x" }]) as { values: unknown[] };
  assert.ok(p.noticeShownAt >= before, "the time it appeared is kept");
  // the strip listens in the capture phase, so the swallowed tap never reaches its buttons
  const listener = tpl.values.find((v) => v && typeof v === "object" && "handleEvent" in (v as object)) as { capture: boolean; handleEvent(e: unknown): void };
  assert.equal(listener.capture, true);
  let stopped = 0;
  const ev = { stopPropagation: () => stopped++, preventDefault: () => undefined };
  listener.handleEvent(ev);
  assert.equal(stopped, 1, "too soon: swallowed");
  p.noticeShownAt -= NOTICE_ARM_MS;
  listener.handleEvent(ev);
  assert.equal(stopped, 1, "later: the tap goes through");
  // the same notices again keep their time; a new one starts it afresh
  const at = p.noticeShownAt;
  p.renderNotices([{ key: "save", body: "x" }]);
  assert.equal(p.noticeShownAt, at);
  p.noticeKey = "save|restart";
  p.renderNotices([{ key: "save", body: "x" }]);
  assert.ok(p.noticeShownAt > at);
});

// ---- #259: the phone 3D view ----

const { navEdges } = await import("./panel.ts");
const { Fp3dView3d } = await import("./components/view3d.ts");
const { Fp3dViewPanel, moreBelow } = await import("./components/view-panel.ts");
const { roomFocusView } = await import("./plan2d/scene.ts");
const view3dCss = text((Fp3dView3d as unknown as Styled).styles);

test("#259 V12/ND-11: the floors row fades out at an end with more chips, and the chosen chip scrolls clear of the fade", () => {
  assert.deepEqual(navEdges(0, 343, 247), { start: false, end: true });
  assert.deepEqual(navEdges(96, 343, 247), { start: true, end: false });
  assert.deepEqual(navEdges(40, 343, 247), { start: true, end: true });
  assert.deepEqual(navEdges(0, 247, 247), { start: false, end: false });
  assert.match(panelCss, /\.fp3d-floors\[data-more-end\] \{\s*mask-image: linear-gradient\(to right/);
  assert.match(panelCss, /\.fp3d-floors\[data-more-start\] \{\s*mask-image: linear-gradient\(to left/);
  assert.match(panelCss, /\.fp3d-floors \{\s*scroll-padding-inline: 28px/);
  // marked when the row scrolls and after every render (a new floor, a room name on the Rooms button)
  const panel = src("./panel.ts");
  assert.match(panel, /@wheel=\$\{this\.onNavWheel\} @scroll=\$\{this\.markNavEdges\}/);
  assert.match(panel, /this\.markNavEdges\(\);/);
});

test("#259 V04/V08: the search field (a card's floating one) opens named, focused and with one cross", () => {
  const v = new Fp3dView3d() as unknown as Record<string, any>;
  v.openFind();
  assert.equal(v._find, "");
  const view3d = src("./components/view3d.ts");
  assert.match(view3d, /class="fp3d-find-btn"[^>]*@click=\$\{\(\) => this\.openFind\(\)\}/);
  const find = src("./components/find.ts");
  assert.match(find, /type="search"\s*aria-label=\$\{translate\(hass, "find"\)\}/);
  assert.match(find, /input::-webkit-search-cancel-button \{[^}]*display: none/);
  assert.match(find, /firstUpdated\(\): void \{\s*this\.renderRoot\.querySelector<HTMLInputElement>\("input"\)\?\.focus\(\)/);
});

test("#259 V13: a room chosen in 2D under the phone's room sheet is zoomed to above the sheet; beside a panel the plan stays", () => {
  const floor = {
    id: "f",
    rooms: [
      { id: "a", name: "A", points: [[0, 0], [4, 0], [4, 3], [0, 3]] },
      { id: "b", name: "B", points: [[4, 0], [12, 0], [12, 9], [4, 9]] },
    ],
    outdoor: [],
    furniture: [],
    placements: [],
  } as never;
  const size = { w: 390, h: 733 };
  assert.equal(roomFocusView(floor, "a", size, 0), null, "nothing covers the plan");
  assert.equal(roomFocusView(floor, null, size, 411), null);
  assert.equal(roomFocusView(floor, "nope", size, 411), null);
  const v = roomFocusView(floor, "a", size, 411)!;
  // the room's corners on screen: inside the width, between the energy chips (60 px) and the top of the sheet
  const top = 0 * v.k + v.ty;
  const bottom = 3 * v.k + v.ty;
  const left = 0 * v.k + v.tx;
  const right = 4 * v.k + v.tx;
  assert.ok(left >= 0 && right <= size.w, `${left} ${right}`);
  assert.ok(top >= 60 && bottom <= size.h - 411 - 8 + 0.5, `${top} ${bottom}`);
  // zoomed in: far larger than the whole floor fitted in the same space
  const whole = 12;
  assert.ok(v.k > (size.w - 72) / whole, `${v.k}`);
  const viewer = src("./plan2d/viewer2d.ts");
  assert.match(viewer, /if \(this\.roomZoomed \|\| this\.roomView\(\)\) this\.fit\(\);/);
  assert.match(viewer, /const room = this\.roomView\(\);\s*this\.roomZoomed = !!room;\s*if \(room\) return this\.applyView\(room\);/);
});

test("#259 V14: on a narrow stage the energy row stops before the Walk button", () => {
  const narrow3d = block(view3dCss, "@container fp3d (max-width: 900px)");
  assert.match(narrow3d, /\.fp3d-stage:has\(> \.fp3d-walk-btn\) \.fp3d-energy \{\s*max-width: calc\(100% - 20px - var\(--fp3d-walk-right, 12px\) - var\(--fp3d-walk-w, 96px\)\)/);
  assert.match(view3dCss, /\.fp3d-stage \{\s*--fp3d-walk-w: 44px;\s*\}\s*\.fp3d-walk-btn \{\s*z-index: 5;\s*width: 44px;/);
});

test("#259 V17: a View panel taller than the screen shows it scrolls: a scroll bar and a fading foot while there is more", () => {
  assert.equal(moreBelow(0, 500, 800), true);
  assert.equal(moreBelow(300, 500, 800), false);
  assert.equal(moreBelow(0, 800, 800), false);
  const css = text((Fp3dViewPanel as unknown as Styled).styles);
  assert.match(block(css, ".vp-body {"), /scrollbar-width: thin/);
  assert.match(block(css, ".vp-body[data-more]::after"), /position: sticky/);
  assert.match(src("./components/view-panel.ts"), /<div class="vp-body" @scroll=\$\{this\.markMore\}>/);
});

test("#259 V19: a room chosen from the Rooms picker takes the focus to the room panel's name", async () => {
  const { Fp3dRoomPanel } = await import("./components/room-panel.ts");
  const rp = new Fp3dRoomPanel() as unknown as Record<string, any>;
  let focused = false;
  rp.renderRoot = { querySelector: (sel: string) => (sel === ".fp3d-rp-head h2" ? { focus: () => (focused = true) } : null) };
  Object.defineProperty(rp, "updateComplete", { value: Promise.resolve(true) });
  await rp.focusHeading();
  assert.ok(focused);
  assert.match(src("./components/room-panel.ts"), /<h2 tabindex="-1">\$\{room\.name\}<\/h2>/);
  assert.match(src("./panel.ts"), /this\._roomsOpen = false;\s*void this\.focusRoomPanel\(\);/);
});

// ---- #260: the Day look and the room panel ----

/** Relative luminance and contrast (WCAG 2). */
const lum = (hex: string) => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const contrast = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

test("#260 V06: in the Day look the clock is dark text on a light box that clears 4.5:1", () => {
  const day = block(view3dCss, ":host([light]) .fp3d-clock {");
  assert.match(day, /background: rgba\(255, 255, 255, 0\.88\)/);
  assert.match(day, /color: #0f1c2e/);
  assert.match(block(view3dCss, ":host([light]) .fp3d-clock span"), /color: #3d4d63/);
  // the box over the palest Day sky (white at 88 % over #c8d4e4 is about #f6f8fb)
  assert.ok(contrast("#0f1c2e", "#f6f8fb") >= 4.5);
  assert.ok(contrast("#3d4d63", "#f6f8fb") >= 4.5);
});

test("#260 V07: on a touch screen the room panel's 44 px icon has a column as wide, clear of the name", async () => {
  const { Fp3dRoomPanel } = await import("./components/room-panel.ts");
  const css = text((Fp3dRoomPanel as unknown as Styled).styles);
  const coarse = css.slice(css.lastIndexOf("@media (pointer: coarse)"));
  assert.match(coarse, /\.fp3d-rp-icon[^{]*\{\s*width: 44px;/);
  assert.match(coarse, /\.fp3d-rp-row \{\s*grid-template-columns: 44px 1fr auto auto;/);
});

test("#260 V16: people who cannot edit are not told to use the editor; editors still are", async () => {
  for (const k of ["panel_no_area_viewer", "panel_empty_viewer", "central_no_favorites_viewer"]) {
    assert.ok(en[k], k);
    assert.doesNotMatch(en[k], /editor/i, k);
  }
  assert.match(en.panel_no_area, /editor/);
  const { Fp3dRoomPanel } = await import("./components/room-panel.ts");
  const rp = new Fp3dRoomPanel() as unknown as Record<string, any>;
  rp.hass = { language: "en", states: {}, entities: {}, devices: {}, areas: {} };
  rp.room = { id: "r", name: "Den", points: [[0, 0], [1, 0], [1, 1]], area_id: null };
  rp.floor = { id: "f", rooms: [rp.room], placements: [], furniture: [], openings: [], walls: [], outdoor: [] };
  rp.canEdit = false;
  const viewer = flat(rp.render());
  assert.ok(viewer.includes(en.panel_no_area_viewer), "viewer wording");
  rp.canEdit = true;
  assert.ok(flat(rp.render()).includes(en.panel_no_area), "editor wording");
  assert.match(src("./components/view3d.ts"), /t\(this\.mayEdit \? "central_no_favorites" : "central_no_favorites_viewer"\)/);
});
