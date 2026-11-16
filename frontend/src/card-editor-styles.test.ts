import assert from "node:assert/strict";
import { test } from "node:test";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Floorplan3dCardEditor } = (await import("./card-editor.ts")) as unknown as { Floorplan3dCardEditor: { new (): Record<string, any> } };

/** The text of a lit template with its nested templates and arrays (the strings and the values, in order). */
function flat(t: unknown): string {
  if (t == null || t === false) return "";
  if (Array.isArray(t)) return t.map(flat).join("");
  if (typeof t === "object" && "strings" in (t as object)) {
    const r = t as { strings: string[]; values: unknown[] };
    return r.strings.map((s, i) => s + (i < r.values.length ? flat(r.values[i]) : "")).join("");
  }
  return String(t);
}

test("the card dialog's style list offers the plan's own styles (#1077)", () => {
  const el = new Floorplan3dCardEditor();
  el._config = { type: "custom:home-3d-card", theme: "my_abc123" };
  el.hass = { language: "en" };
  el._styles = [{ id: "my_abc123", name: "Sample cabin", base: "neon" }];
  const text = flat(el.styleSelect("theme", "theme", "my_abc123", { theme: true, auto: true, house: true }));
  assert.match(text, /Sample cabin/);
  assert.match(text, /<optgroup/);
  // the built-in styles are there too, and the homely and designed ones the old six-choice list lacked
  for (const id of ["neon", "realistic", "cozy", "model"]) assert.match(text, new RegExp(`value=${id}`), id);
  // the stored own style is the selected one
  assert.match(text, /value=my_abc123/);
});

test("a stored style the plan does not know stays listed, so opening the dialog never changes it", () => {
  const el = new Floorplan3dCardEditor();
  el.hass = { language: "en" };
  el._styles = [];
  const text = flat(el.styleSelect("theme_evening", "card_theme_evening", "my_gone01", { none: true }));
  assert.match(text, /my_gone01/);
});
