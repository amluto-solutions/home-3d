// Small controls reach 44 px on a touch screen, a tablet as much as a phone (#181).
import assert from "node:assert/strict";
import { test } from "node:test";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener: () => undefined, removeEventListener: () => undefined });
g.location = { search: "", hash: "", pathname: "/home_3d" };
g.history = { state: null, replaceState: () => undefined };

type Styled = { styles: unknown };
const text = (s: unknown): string => (Array.isArray(s) ? s.map(text).join("\n") : ((s as { cssText?: string })?.cssText ?? ""));

/** Everything inside the `@media (pointer: coarse)` blocks, with where each one starts. */
function coarse(css: string): { body: string; at: number }[] {
  const out: { body: string; at: number }[] = [];
  for (const m of css.matchAll(/@media \(pointer: coarse\)[^{]*\{/g)) {
    let depth = 1;
    let i = m.index! + m[0].length;
    const start = i;
    while (depth && i < css.length) depth += css[i] === "{" ? 1 : css[i] === "}" ? -1 : 0, i++;
    out.push({ body: css.slice(start, i - 1), at: m.index! });
  }
  return out;
}

/** The size a selector is given inside the coarse blocks: the last rule naming it wins. */
function coarseSize(css: string, selector: string): { prop: string; px: number } | null {
  let found: { prop: string; px: number } | null = null;
  for (const { body } of coarse(css)) {
    for (const rule of body.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!rule[1].split(",").some((s) => s.trim() === selector)) continue;
      // a size given by the touch token (#246) is its fallback in px
      for (const d of rule[2].matchAll(/(min-width|min-height|width|height):\s*(?:var\(--fp3d-touch,\s*)?(\d+)px/g)) found = { prop: d[1], px: Number(d[2]) };
    }
  }
  return found;
}

const { Floorplan3dPanel } = await import("./panel.ts");
const { Fp3dView3d } = await import("./components/view3d.ts");
const { Fp3dRoomPanel } = await import("./components/room-panel.ts");
const { Fp3dViewPanel } = await import("./components/view-panel.ts");
const { Fp3dQuickMenu } = await import("./components/quick-menu.ts");
const { Fp3dFind } = await import("./components/find.ts");
const { Fp3dDevicePopup } = await import("./components/device-popup.ts");
const { Fp3dTimeBar } = await import("./components/time-bar.ts");
const { formStyles } = await import("./components/editor/styles/forms.ts");
const { controls } = await import("./styles.ts");

const want = (name: string, css: string, selectors: string[]) =>
  test(`${name}: small controls reach 44 px on a touch screen (#181)`, () => {
    for (const sel of selectors) {
      const size = coarseSize(css, sel);
      assert.ok(size && size.px >= 44, `${sel} is ${size ? `${size.px}px` : "not in a coarse-pointer rule"}`);
    }
  });

want("shared controls", text(controls), [".fp3d-seg button", ".fp3d-chip", ".fp3d-btn", ".fp3d-field select", ".fp3d-swatch"]);
want("panel", text((Floorplan3dPanel as unknown as Styled).styles), [".fp3d-view-btn", ".fp3d-rooms-btn", ".fp3d-note-badge", ".fp3d-nav .fp3d-chip", ".fp3d-floors button", ".fp3d-tab"]);
want("View panel", text((Fp3dViewPanel as unknown as Styled).styles), [".vp-select", ".vp-seg button", ".vp-row", ".vp-link", ".vp-quiet", ".vp-close"]);
want("viewer", text((Fp3dView3d as unknown as Styled).styles), [".fp3d-alert-x", ".fp3d-eye", ".fp3d-sheet-x", ".fp3d-walk-btn", ".fp3d-sheet-chip", ".fp3d-holo-media-controls button", ".fp3d-thumbs-fold"]);
want("panel search", text((Floorplan3dPanel as unknown as Styled).styles), [".fp3d-find-toggle"]);
want("search field", text((Fp3dFind as unknown as Styled).styles), [".close", ".icon", "input"]);
want("room panel", text((Fp3dRoomPanel as unknown as Styled).styles), [".fp3d-rp-close", ".fp3d-rp-icon", ".fp3d-rp-swatch", ".fp3d-rp-small", ".fp3d-rp-sheet", ".fp3d-rp-chips .fp3d-chip", ".fp3d-rp-stepper .fp3d-btn"]);
want("quick menu", text((Fp3dQuickMenu as unknown as Styled).styles), [".qm-swatch"]);
want("device popup", text((Fp3dDevicePopup as unknown as Styled).styles), [".dp-swatch", ".dp-x", ".dp-btn", ".dp-chip", ".dp-power"]);
want("time bar", text((Fp3dTimeBar as unknown as Styled).styles), [".btn", ".x", ".chip", ".track"]);
want("editor", text(formStyles), [".fp3d-fix", ".fp3d-more-btn", ".fp3d-strip-btn", ".fp3d-3d-fold", ".fp3d-point .fp3d-btn", ".fp3d-wv-zoom .fp3d-btn", ".fp3d-presets .fp3d-chip"]);

test("the room panel's coarse rules come after the base sizes, so they are not overridden (#181)", () => {
  const css = text((Fp3dRoomPanel as unknown as Styled).styles);
  const last = Math.max(...coarse(css).map((c) => c.at));
  const base = css.lastIndexOf(".fp3d-rp-close {");
  assert.ok(base > -1 && last > base, "the coarse block sits before .fp3d-rp-close");
});

test("the floor bar never wraps: one row of floors that scrolls sideways, and the Rooms picker (#181, #249)", () => {
  const css = text((Floorplan3dPanel as unknown as Styled).styles);
  assert.doesNotMatch(css, /fp3d-nav-wrap|fp3d-nav-toggle/);
  assert.match(css, /\.fp3d-floors \{[^}]*overflow-x: auto/);
});
