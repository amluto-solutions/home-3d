// The zoom, move and turn pad (#297, #307) and the View choice that shows it.
import assert from "node:assert/strict";
import { test } from "node:test";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dViewNav } = await import("./view-nav.ts");
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any> } };

function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return String(v);
}

test("the pad has turn left and right beside move back, labelled; the flat plan has none (#307)", () => {
  const el = new Fp3dViewNav() as unknown as { t: (k: string) => string; turn: boolean; render(): unknown };
  el.t = (k) => k;
  const out = flat(el.render());
  assert.ok(out.includes("nav_turn_left") && out.includes("nav_turn_right") && out.includes("↺") && out.includes("↻"));
  el.turn = false;
  const flatOut = flat(el.render());
  assert.ok(!flatOut.includes("nav_turn_left") && flatOut.includes("nav_pan_down"));
});

test("a button press says which move it is (#307)", () => {
  const el = new Fp3dViewNav() as unknown as { render(): { values: unknown[] }; dispatchEvent(e: Event): boolean };
  const seen: string[] = [];
  el.dispatchEvent = (e) => (seen.push((e as CustomEvent).detail), true);
  const fns: (() => void)[] = [];
  const walk = (v: unknown): void => {
    if (typeof v === "function") fns.push(v as () => void);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object" && "values" in (v as object)) (v as { values: unknown[] }).values.forEach(walk);
  };
  walk(el.render());
  fns.forEach((f) => f());
  assert.ok(seen.includes("turnLeft") && seen.includes("turnRight") && seen.includes("in"));
});

test("the pad is not drawn, and its chunk not asked for, unless the View option is on (#307)", () => {
  const el = new Fp3dView3d();
  el.hass = { language: "en", locale: { language: "en", number_format: "language" }, states: {}, config: { unit_system: {} } };
  assert.equal(el.navButtons, false);
  assert.equal(flat(el.renderViewNav()), "");
  el.navButtons = true;
  assert.ok(flat(el.renderViewNav()).includes("fp3d-view-nav"));
});
