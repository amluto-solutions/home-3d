// #412 field layout rules: units inside the input as a suffix and labels on one line (CUT-2), the "i" last on its label
// line (ORDER-2), sub-heads in a fold at label size (ORDER-1), check boxes as switch rows of 32 px (44 px on touch,
// A11Y-1), symbol buttons named by what they do (A11Y-4), and defaults that name their value (DEF-3).

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { Opening, RoofSection } from "../model.ts";
import { splitUnit } from "./editor/fields.ts";
import { makeEditor, square } from "./editor-harness.ts";

function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function" || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return typeof v === "object" ? "" : String(v);
}

/** The editor's style rules as [selector, body], comments out, media blocks kept in their selector's text. */
async function css(): Promise<string> {
  const { Fp3dEditor } = await import("./editor.ts");
  return (Fp3dEditor as unknown as { styles: { cssText: string }[] }).styles
    .flat(Infinity as 1)
    .map((s) => s.cssText)
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\//g, "");
}
const rule = (text: string, selector: string): string => {
  const at = text.split("}").find((r) => r.split("{")[0].split(",").some((s) => s.trim() === selector));
  return at ? at.split("{")[1] : "";
};

test("a unit at the end of a label goes into the input as a suffix; the label stays short (#412, CUT-2)", async () => {
  assert.deepEqual(splitUnit("Width (m)"), ["Width", "m"]);
  assert.deepEqual(splitUnit("Turn (°)"), ["Turn", "°"]);
  assert.deepEqual(splitUnit("Height above floor (m)"), ["Height above floor", "m"]);
  assert.deepEqual(splitUnit("Name"), ["Name", ""]);
  assert.deepEqual(splitUnit("Height offset (m, − = lower)"), ["Height offset (m, − = lower)", ""], "only a plain unit");
  const ed = await makeEditor([square("r", 0, 0, 4, 4)]);
  const field = flat(ed.num("Width (m)", 1.79, () => undefined));
  assert.match(field, /<span class="fp3d-field-label" title=Width \(m\)>Width<\/span>/);
  assert.match(field, /<span class="fp3d-unit-box"><input[^]*?aria-label=Width \(m\)[^]*?<span class="fp3d-unit" aria-hidden="true">m<\/span>/, "the input keeps the whole label as its name");
  const plain = flat(ed.num("Columns", 3, () => undefined));
  assert.doesNotMatch(plain, /fp3d-unit/);
  const text = await css();
  assert.match(rule(text, ".fp3d-field-label"), /white-space:\s*nowrap/, "a field label never wraps");
  assert.match(rule(text, ".fp3d-unit"), /position:\s*absolute/);
  assert.match(rule(text, ".fp3d-unit-box > input"), /padding-right/);
});

test("the 'i' is the last thing on its field's label line (#412, ORDER-2)", async () => {
  const text = await css();
  assert.match(rule(text, ".fp3d-with-info"), /display:\s*grid/);
  const info = rule(text, ".fp3d-with-info > .fp3d-info");
  assert.match(info, /grid-column:\s*2/);
  assert.match(info, /grid-row:\s*1/, "on the first line, at its end");
  assert.match(rule(text, ".fp3d-with-info > .fp3d-help-text"), /grid-column:\s*1 \/ -1/, "the help opens under the field");
});

test("sub-heads inside a fold are not bigger than the fold's title (#412, ORDER-1)", async () => {
  const text = await css();
  const size = (body: string) => Number(/font-size:\s*([\d.]+)px/.exec(body)?.[1]);
  const sub = rule(text, ".fp3d-fold-body h4");
  assert.ok(size(sub) <= size(rule(text, ".fp3d-fold-top")), "h4 in a fold at most the fold title's size");
  assert.equal(size(sub), 12, "label size");
  assert.match(sub, /text-transform:\s*none/);
});

test("check boxes are switch rows: 32 px with a mouse, 44 px on touch, the whole row the target (#412, A11Y-1)", async () => {
  const text = await css();
  const row = rule(text, ".fp3d-check");
  assert.match(row, /min-height:\s*32px/);
  assert.match(row, /cursor:\s*pointer/);
  assert.match(text, /@media \(pointer: coarse\)\s*\{\s*\.fp3d-check\s*\{\s*min-height:\s*44px/);
  const sw = rule(text, '.fp3d-check > input[type="checkbox"]');
  assert.match(sw, /appearance:\s*none/);
  assert.match(sw, /width:\s*36px/);
  assert.match(rule(text, '.fp3d-check > input[type="checkbox"]:focus-visible'), /outline/, "the keyboard focus shows");
});

test("symbol buttons in the side panels have names that say what happens (#412, A11Y-4)", () => {
  const files = ["walls.ts", "rooms.ts", "roof.ts", "solar.ts", "side-panel.ts", "item-form.ts", "pool.ts", "openings.ts", "device-panel.ts", "outdoor.ts"];
  const nameless: string[] = [];
  for (const f of files) {
    const src = readFileSync(new URL(`./editor/${f}`, import.meta.url), "utf8");
    for (const m of src.matchAll(/<button\b([^>]*)>\s*(?:[✂▦↑↓↺↻✕×]|[↺↻] 15°)\s*<\/button>/g)) if (!/aria-label=/.test(m[1])) nameless.push(`${f}: ${m[0].slice(0, 90)}`);
  }
  assert.deepEqual(nameless, []);
  const en = readFileSync(new URL("../i18n-late.ts", import.meta.url), "utf8");
  for (const text of ["Split this wall", "Move {room} up", "Turn left 15°"]) assert.ok(en.includes(text), text);
});

test("defaults name their value: door angle, window sill, roof end (#412, DEF-3)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 5, 4)]);
  const door = { id: "d", room_id: "r", edge: 0, offset: 2, width: 0.9, type: "door", sill: 0, height: 2.05, hinge: "left", leaves: 1, swing: "in", cover: "none", contact: "none", contact2: null, tilt: null } as Opening;
  const win = { ...door, id: "w", type: "window", offset: 4, sill: 0.9, height: 1.2 } as Opening;
  ed._doc.floors[0].openings = [door, win];
  ed.selectItem("opening", "d");
  assert.match(flat(ed.renderOpeningForm(ed.opening)), /Default \(43°\)/, "half open without a sensor");
  ed.updateOpening({ contact: "binary_sensor.door" });
  assert.match(flat(ed.renderOpeningForm(ed.opening)), /Default \(86°\)/, "fully open with one");
  ed.selectItem("opening", "w");
  assert.match(flat(ed.renderOpeningForm(ed.opening)), /Automatic \((window board and sill|inside only)\)/);
  ed.updateOpening({ sill: 0 });
  assert.match(flat(ed.renderOpeningForm(ed.opening)), /Automatic \(none\)/, "a window to the floor gets none");
  const sec = { id: "rs", x0: 0, x1: 4, z0: 0, z1: 4, axis: "x", shape: "gable", eave_a: 2.6, eave_b: 2.6, pitch_a: 35, pitch_b: 35, base: 2.6 } as unknown as RoofSection;
  ed._doc.settings.roof = { ...ed._doc.settings.roof, type: "custom", sections: [sec] } as never;
  ed.setTool("roof");
  ed._roofId = "rs";
  assert.match(flat(ed.renderRoofPanel()), /Same as the shape \(Gable\)/);
});
