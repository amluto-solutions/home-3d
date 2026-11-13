import assert from "node:assert/strict";
import { test } from "node:test";
import { contrast, contrastChrome, DARK, LIGHT, lightChrome } from "./scheme.ts";

test("contrast ratios follow WCAG: black on white 21, a colour on itself 1", () => {
  assert.equal(Math.round(contrast("#000000", "#ffffff") * 10) / 10, 21);
  assert.equal(contrast("#37e0ff", "#37e0ff"), 1);
  // the classic grey that just passes AA on white
  assert.ok(Math.abs(contrast("#767676", "#ffffff") - 4.54) < 0.01);
});

test("only the Day look gets light viewer chrome; neon, high contrast and realistic keep the dark one (#85)", () => {
  assert.equal(lightChrome("day"), true);
  assert.equal(lightChrome("neon"), false);
  assert.equal(lightChrome("blueprint"), false);
  assert.equal(lightChrome("realistic"), false);
});

test("styles take the chrome of the look they are built on: light on Day, dark on Neon and Realistic (#435)", () => {
  for (const id of ["cozy", "model", "pastel", "warm"]) assert.equal(lightChrome(id), true, id);
  for (const id of ["evening", "winter", "focus", "synthwave", "realistic", "nonsense"]) assert.equal(lightChrome(id), false, id);
  assert.equal(contrastChrome("cozy"), false);
});

for (const [name, s] of [
  ["dark", DARK],
  ["light", LIGHT],
] as const) {
  test(`the ${name} chrome's text passes AA on its backgrounds (#85, #88)`, () => {
    for (const bg of [s.bg, s.bg2, s.chromeSolid]) {
      assert.ok(contrast(s.text, bg) >= 7, `text on ${bg}`);
      assert.ok(contrast(s.muted, bg) >= 4.5, `muted on ${bg}`);
    }
    assert.ok(contrast(s.accentText, s.accent) >= 4.5, "text on the accent");
  });
}

// ---- High contrast chrome and room labels in every look (#216) ----
import { HIGH } from "./scheme.ts";

test("only the High contrast look (stored as blueprint) gets the high contrast chrome (#216)", () => {
  assert.equal(contrastChrome("blueprint"), true);
  for (const t of ["neon", "day", "realistic"] as const) assert.equal(contrastChrome(t), false);
});

test("the high contrast chrome's text is 7:1 on its backgrounds, muted text too (#216)", () => {
  for (const bg of [HIGH.bg, HIGH.bg2, HIGH.chromeSolid]) {
    assert.ok(contrast(HIGH.text, bg) >= 7, `text on ${bg}`);
    assert.ok(contrast(HIGH.muted, bg) >= 7, `muted on ${bg}`);
  }
  assert.ok(contrast(HIGH.accentText, HIGH.accent) >= 7, "text on the accent");
  assert.ok(contrast(HIGH.accent, HIGH.chromeSolid) >= 7, "the accent as text or an outline");
});

/** "rgba(r, g, b, a)" over a "#rrggbb" backdrop, as "#rrggbb": the glass a room label sits on. */
function over(glass: string, backdrop: string): string {
  const m = /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/.exec(glass);
  if (!m) return glass;
  const a = Number(m[4]);
  const b = parseInt(backdrop.slice(1), 16);
  const ch = [Number(m[1]), Number(m[2]), Number(m[3])].map((v, i) => Math.round(v * a + ((b >> (16 - 8 * i)) & 255) * (1 - a)));
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

for (const [name, s] of [
  ["dark", DARK],
  ["light", LIGHT],
  ["high contrast", HIGH],
] as const) {
  test(`room labels (pins) read in the ${name} chrome over the lightest and the darkest view behind them (#216)`, () => {
    for (const backdrop of ["#000000", "#ffffff", "#2a68b0"]) {
      const glass = over(s.chrome, backdrop);
      assert.ok(contrast(s.text, glass) >= 7, `label text on glass over ${backdrop}: ${contrast(s.text, glass).toFixed(2)}`);
    }
    // the open room's label: the accent with its own text
    assert.ok(contrast(s.accentText, s.accent) >= (name === "high contrast" ? 7 : 4.5));
  });
}

// ---- Brand tokens (#246): cyan for text and icons, blue for fills only ----
import { readdirSync, readFileSync } from "node:fs";
import { accentVars } from "./ha-theme.ts";

for (const [name, s] of [
  ["dark", DARK],
  ["light", LIGHT],
  ["high contrast", HIGH],
] as const) {
  test(`the ${name} chrome's accent reads as text and its primary fill carries its own text (#246)`, () => {
    assert.ok(contrast(s.accent, s.chromeSolid) >= 4.5, `accent as text: ${contrast(s.accent, s.chromeSolid).toFixed(2)}`);
    assert.ok(contrast(s.link, s.chromeSolid) >= 4.5, `link: ${contrast(s.link, s.chromeSolid).toFixed(2)}`);
    assert.ok(contrast(s.primaryText, s.primary) >= 4.5, `text on the primary fill: ${contrast(s.primaryText, s.primary).toFixed(2)}`);
    assert.ok(contrast(s.text, s.panel) >= 7, "text on a panel");
    for (const status of [s.danger, s.warning, s.success]) assert.ok(contrast(status, s.chromeSolid) >= 4.5, `status ${status}`);
  });
}

test("the dark scheme uses the brand values under Home 3D names: cyan text, blue fills, slate surfaces (#246)", () => {
  assert.equal(DARK.accent, "#48cdeb");
  assert.equal(DARK.primary, "#1e6ebc");
  assert.equal(DARK.primaryText, "#ffffff");
  assert.equal(DARK.chromeSolid, "#0f172a");
  assert.equal(DARK.panel, "#1e293b");
  assert.equal(DARK.text, "#e2e8f0");
  assert.equal(DARK.muted, "#94a3b8");
  assert.equal(DARK.link, "#5d97cf");
  // blue fails as text on the dark menus, which is why it is a fill only
  assert.ok(contrast(DARK.primary, DARK.chromeSolid) < 4.5);
});

test("the accent never stands in for alerts or warm (on) states: those keep their own colours (#246)", () => {
  for (const s of [DARK, LIGHT, HIGH]) {
    assert.notEqual(s.danger, s.accent);
    assert.notEqual(s.warm, s.accent);
    if (s !== HIGH) for (const c of [s.danger, s.warm, s.warning, s.success]) assert.notEqual(c, s.primary);
  }
});

test("a chosen accent (the device's own or its HA theme's) takes the primary fill too, with readable text (#246)", () => {
  assert.equal(accentVars(null), "");
  assert.equal(accentVars("#ff7a59"), "--fp3d-accent:#ff7a59;--fp3d-accent-text:#041018;--fp3d-primary:#ff7a59;--fp3d-primary-text:#041018");
  assert.match(accentVars("#123456"), /--fp3d-primary-text:#ffffff/);
});

/** Every source file that styles chrome (no tests, no fixtures). */
function sources(dir: URL): URL[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? sources(new URL(`${e.name}/`, dir)) : /\.ts$/.test(e.name) && !/\.(test|fixture)\.ts$/.test(e.name) ? [new URL(e.name, dir)] : [],
  );
}

test("the primary blue is never a text or icon colour anywhere: fills, borders and outlines only (#246)", () => {
  const bad: string[] = [];
  for (const file of sources(new URL("./", import.meta.url))) {
    const src = readFileSync(file, "utf8");
    for (const m of src.matchAll(/(?<![\w-])(color|fill|stroke):\s*var\(--fp3d-primary\)/g)) bad.push(`${file.pathname.split("/src/")[1]}: ${m[0]}`);
  }
  assert.deepEqual(bad, []);
});

test("chosen segments, chips, switches, ticked boxes and main buttons are primary fills (#246)", async () => {
  const { controls } = await import("./styles.ts");
  const css = controls.cssText;
  assert.match(css, /\.fp3d-chip\[aria-pressed="true"\]\s*\{\s*background: var\(--fp3d-primary\);\s*color: var\(--fp3d-primary-text\)/);
  assert.match(css, /\.fp3d-btn\.fp3d-primary\s*\{\s*background: var\(--fp3d-primary\);\s*color: var\(--fp3d-primary-text\)/);
  assert.match(css, /input\[type="checkbox"\],\s*input\[type="radio"\]\s*\{\s*accent-color: var\(--fp3d-primary\)/);
  const page = readFileSync(new URL("./settings/settings-page.ts", import.meta.url), "utf8");
  assert.match(page, /\.st-sw\[aria-checked="true"\]\s*\{\s*background: var\(--fp3d-primary\)/);
});
