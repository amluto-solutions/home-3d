// Every colour picker has a reset to its default, shown only while the colour differs from it (#230).
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { itemColourRoles, setRoleColour } from "./colour-roles.ts";
import { ACCENT_DEFAULT, colourDiffers, colourReset, sameColour } from "./colour-reset.ts";
import { makeEditor, square } from "./components/editor-harness.ts";
import type { Furniture } from "./model.ts";

const flat = (v: unknown): string => {
  if (v == null || typeof v === "boolean" || typeof v === "symbol") return "";
  if (typeof v === "function") return "<fn>";
  if (Array.isArray(v)) return v.map(flat).join("");
  const t = v as { strings?: readonly string[]; values?: unknown[] };
  if (typeof v === "object") return t.strings ? t.strings.map((s, i) => s + (i < t.values!.length ? flat(t.values![i]) : "")).join("") : "";
  return String(v);
};

test("a colour is the default when its hex text is, whatever the case (#230)", () => {
  assert.ok(sameColour("#37E0FF", "#37e0ff"));
  assert.ok(sameColour(null, undefined));
  assert.ok(!sameColour("#48cdea", ACCENT_DEFAULT));
  assert.ok(!colourDiffers(null, ACCENT_DEFAULT), "nothing set: nothing to reset");
  assert.ok(!colourDiffers("#48CDEB", ACCENT_DEFAULT), "set to the default: nothing to reset");
  assert.ok(colourDiffers("#ff0000", ACCENT_DEFAULT));
  assert.ok(colourDiffers("#ff0000", null), "a default of no colour of its own: any colour can go back");
});

test("the reset button shows only while the colour differs, and calls its reset (#230)", () => {
  let resets = 0;
  const base = { fallback: ACCENT_DEFAULT, label: "Back to cyan", onReset: () => resets++ };
  assert.equal(flat(colourReset({ ...base, value: ACCENT_DEFAULT })), "");
  assert.equal(flat(colourReset({ ...base, value: null })), "");
  const out = colourReset({ ...base, value: "#ff0000" }) as { values: unknown[] };
  assert.match(flat(out), /fp3d-colour-reset/);
  assert.match(flat(out), /aria-label=Back to cyan/);
  const click = out.values.find((v) => typeof v === "function") as (e: Event) => void;
  let stopped = 0;
  click({ preventDefault: () => stopped++, stopPropagation: () => stopped++ } as unknown as Event);
  assert.equal(resets, 1);
  assert.equal(stopped, 2, "inside a label the click does not reopen the picker");
});

const bin = (extra: Partial<Furniture> = {}): Furniture => ({ id: "bin", type: "waste_bin", x: 1.5, z: 1.5, rotation: 0, w: 0.58, d: 0.72, h: 1.07, variant: null, ...extra });
const resetsIn = (html: string) => (html.match(/fp3d-colour-reset/g) ?? []).length;

test("a bin's colour pickers get a reset only for a colour of their own (#230)", async () => {
  const ed = await makeEditor([square("r1", 0, 0, 6, 6)], [bin()]);
  ed.selectItem("furniture", "bin");
  assert.equal(resetsIn(flat(ed.renderHouseholdForm(ed.furnitureItem))), 0, "the kind's usual colours: nothing to reset");
  ed.updateFurniture({ bin_color: "#123456" });
  assert.equal(resetsIn(flat(ed.renderHouseholdForm(ed.furnitureItem))), 1, "a body of its own: reset on the body");
  ed.updateFurniture({ bin_lid: "#654321" });
  assert.equal(resetsIn(flat(ed.renderHouseholdForm(ed.furnitureItem))), 2, "and a lid of its own: reset on the lid too");
  // the reset goes back to the kind's colours: both fields empty
  ed.updateFurniture({ bin_color: null, bin_lid: null });
  assert.equal(resetsIn(flat(ed.renderHouseholdForm(ed.furnitureItem))), 0);
});

test("an item's colour roles and paint reset to the look (#230)", async () => {
  const ed = await makeEditor([square("r1", 0, 0, 6, 6)], [{ id: "s", type: "sofa", x: 1, z: 1, rotation: 0, w: 2, d: 0.9, h: 0.8, variant: null }]);
  ed.selectItem("furniture", "s");
  const none = flat(ed.renderColourRoles(ed.furnitureItem));
  assert.match(none, /<fp3d-colour-field/);
  assert.equal(resetsIn(none), 0, "following the look: nothing to reset");
  const role = itemColourRoles("sofa")[0];
  ed.updateFurniture({ colors: setRoleColour(ed.furnitureItem.colors, role, "#123456") });
  const own = flat(ed.renderColourRoles(ed.furnitureItem));
  assert.equal(resetsIn(own), 1, "a colour of its own: one reset");
  assert.match(own, /aria-label=Back to the default colour/);
});

test("every colour field in the source has a reset beside it (#230), and every one is the shared field (#403)", () => {
  const src = fileURLToPath(new URL(".", import.meta.url));
  const files: string[] = [];
  const walk = (dir: string): void => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".ts") && !p.endsWith(".test.ts") && !p.endsWith("colour-reset.ts") && !p.endsWith("colour-text.ts")) files.push(p);
    }
  };
  walk(src);
  const bad: string[] = [];
  let pickers = 0;
  for (const f of files) {
    const text = readFileSync(f, "utf8");
    // the browser's own picker only inside the shared field; everywhere else the field (colourField)
    const bare = (text.match(/type="color"/g) ?? []).length - (text.match(/input\[type="color"\]/g) ?? []).length;
    if (bare && !f.endsWith("colour-field.ts")) bad.push(`${f.slice(src.length)}: a bare colour picker`);
    if (f.endsWith("colour-field.ts")) continue;
    const n = (text.match(/colourField\(\{/g) ?? []).length;
    if (!n) continue;
    pickers += n;
    const resets = (text.match(/colourReset\(/g) ?? []).length;
    if (resets < n) bad.push(`${f.slice(src.length)}: ${n} pickers, ${resets} resets`);
  }
  assert.ok(pickers >= 8, `found the pickers (${pickers})`);
  assert.deepEqual(bad, []);
});
