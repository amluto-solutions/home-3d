// #452 (NeonPlan 3D 3.1.1, MIT, Mastershort): on a narrow card a module's glass card leaves its minor values out; a small
// "more" button shows them, "less" hides them again, kept on this device and through a re-render.
import assert from "node:assert/strict";
import { test } from "node:test";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
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

/** The handler bound to an attribute (e.g. "@click") of the first element whose class contains `cls`. */
function handler(v: unknown, cls: string): (() => void) | undefined {
  if (Array.isArray(v)) {
    for (const x of v) {
      const h = handler(x, cls);
      if (h) return h;
    }
    return undefined;
  }
  if (v && typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    for (let i = 0; i < t.values.length; i++) {
      if (t.strings[i]!.includes(`class="${cls}"`) && t.strings[i]!.trimEnd().endsWith("@click=") && typeof t.values[i] === "function") return t.values[i] as () => void;
      const h = handler(t.values[i], cls);
      if (h) return h;
    }
  }
  return undefined;
}

const card = {
  module: {
    id: "mod.sample_pump",
    anchor: { floorId: "f" },
    icon: "P",
    title: "Sample pump",
    rows: [
      { label: "Flow", value: "12 l/min" },
      { label: "Starts today", value: "7", minor: true },
    ],
  },
};

test("a narrow module card hides its minor rows, shows them after more, and keeps that through a re-render (#452)", () => {
  const store = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  try {
    const el = new Fp3dView3d();
    el.hass = { language: "en", locale: { language: "en" }, states: {}, config: { unit_system: {} } };
    Object.defineProperty(el, "clientWidth", { value: 420, configurable: true });
    el.requestUpdate = () => undefined;
    let tpl = el.renderModuleCard(card, 0);
    let out = flat(tpl);
    assert.match(out, /Flow/);
    assert.doesNotMatch(out, /Starts today/, "minor row hidden");
    assert.match(out, /class="fp3d-holo-minor-btn"[^>]*>more</);
    handler(tpl, "fp3d-holo-minor-btn")!();
    out = flat(el.renderModuleCard(card, 0));
    assert.match(out, /Starts today/, "shown after the tap");
    assert.match(out, /class="fp3d-holo-minor-btn"[^>]*>less</);
    assert.equal(store.get("home3d.module_full"), '["mod.sample_pump"]');
    // kept after another render, and on a new view (this device)
    assert.match(flat(el.renderModuleCard(card, 0)), /Starts today/);
    const other = new Fp3dView3d();
    other.hass = el.hass;
    Object.defineProperty(other, "clientWidth", { value: 420, configurable: true });
    assert.match(flat(other.renderModuleCard(card, 0)), /Starts today/, "a new page on this device remembers it");
    tpl = el.renderModuleCard(card, 0);
    handler(tpl, "fp3d-holo-minor-btn")!();
    assert.doesNotMatch(flat(el.renderModuleCard(card, 0)), /Starts today/, "less hides them again");
    // a wide card needs no button and shows everything
    Object.defineProperty(el, "clientWidth", { value: 900, configurable: true });
    out = flat(el.renderModuleCard(card, 0));
    assert.match(out, /Starts today/);
    assert.doesNotMatch(out, /fp3d-holo-minor-btn/);
  } finally {
    delete (globalThis as Record<string, unknown>).localStorage;
  }
});
