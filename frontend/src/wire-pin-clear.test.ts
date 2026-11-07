// A pin that also has an energy cable dot always switches when tapped: the dot and its hit area sit clear of the pin (#207).
import assert from "node:assert/strict";
import { test } from "node:test";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR", "SETTINGS"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener: () => undefined, removeEventListener: () => undefined });
g.location = { search: "", hash: "", pathname: "/home_3d" };
g.history = { state: null, replaceState: () => undefined };

const { Fp3dView3d } = await import("./components/view3d.ts");
const text = (s: unknown): string => (Array.isArray(s) ? s.map(text).join("\n") : ((s as { cssText?: string })?.cssText ?? ""));
const css = text((Fp3dView3d as unknown as { styles: unknown }).styles);

/** The declarations of the first rule that starts with exactly this selector. */
const rule = (selector: string): string => {
  const at = css.search(new RegExp(`${selector.replace(/[.:]/g, (c) => `\\${c}`)}\\s*\\{`));
  const m = at < 0 ? null : css.slice(at).match(/\{([^}]*)\}/);
  assert.ok(m, `${selector} has a rule`);
  return m[1];
};

test("the cable dot and its hit area end above the pin for every symbol size, mouse or touch (#207)", () => {
  const dot = rule(".fp3d-wire");
  const before = rule(".fp3d-wire::before");
  const size = Number(dot.match(/\bheight:\s*(\d+)px/)?.[1]);
  const reach = Number(before.match(/inset:\s*-(\d+)px/)?.[1]);
  const m = dot.match(/margin-top:\s*calc\(-(\d+)px \* var\(--fp3d-pin-k, 1\) - (\d+)px\)/);
  assert.ok(m, "the dot is lifted by a calc of the symbol size");
  for (const k of [0.8, 1, 1.25]) {
    const dotCentre: number = Number(m[1]) * k + Number(m[2]); // above the pin's centre
    const dotBottom: number = dotCentre - (size / 2 + reach); // lowest point a tap on the dot can land
    // a pin is 24k + 8 + 2 high; the coarse-pointer padding adds 2 each side
    const pinTop = (24 * k + 8 + 2 + 4) / 2;
    assert.ok(dotBottom >= pinTop, `k=${k}: the dot's hit area ends ${dotBottom}px above the centre, the pin's top is ${pinTop}px`);
  }
});
