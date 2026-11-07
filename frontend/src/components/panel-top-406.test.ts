// #406 (ORDER-5): a short panel (free wall, fence, lawn, pet) starts at the top of the side panel. The side panel is a
// flex column; a row in it that may grow takes the free height, and the back link sat in its middle, ~280 px down.

import assert from "node:assert/strict";
import { test } from "node:test";
import "./editor-harness.ts";

/** Every rule of the editor's styles as [selector, body], media blocks flattened. */
async function rules(): Promise<[string, string][]> {
  const { Fp3dEditor } = await import("./editor.ts");
  const list = (Fp3dEditor as unknown as { styles: { cssText: string }[] }).styles.flat(Infinity as 1);
  const text = list.map((s) => s.cssText).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");
  const out: [string, string][] = [];
  for (const m of text.matchAll(/([^{}]+)\{([^{}]*)\}/g)) out.push([m[1].trim(), m[2]]);
  return out;
}

const grows = (body: string) => /(?:^|;)\s*flex(?:-grow)?\s*:\s*(?:[1-9]|0?\.\d*[1-9])/.test(body);

test("no direct row of the side panel grows in its column: the first row stays at the top (#406)", async () => {
  const all = await rules();
  // what renderSide, renderPinRow and the panels put straight into the side column
  const tops = [".fp3d-nav-row", ".fp3d-pin-row", ".fp3d-item-panel", ".fp3d-item-head", ".fp3d-panel-head", ".fp3d-back", "section", ".fp3d-side > section"];
  const bad = all.filter(([sel, body]) => sel.split(",").some((s) => tops.includes(s.trim())) && grows(body));
  assert.deepEqual(bad, [], "a row straight in the side column must not take the free height");
  const nav = all.find(([sel]) => sel === ".fp3d-nav-row");
  assert.ok(nav && /flex:\s*0 0 auto/.test(nav[1]), "the navigation row keeps its own height");
  // beside the pin (3D beside) it still fills the row sideways
  assert.ok(all.some(([sel, body]) => sel === ".fp3d-pin-row > .fp3d-nav-row" && grows(body)));
  // and the side column itself packs its rows at the start
  for (const [sel, body] of all.filter(([s]) => s === ".fp3d-side")) assert.doesNotMatch(body, /justify-content:\s*(?:center|flex-end|space-)/, sel);
});

test("the short panels render the navigation row first and their form right under it (#406)", async () => {
  const { makeEditor, square } = await import("./editor-harness.ts");
  const ed = await makeEditor([square("r", 0, 0, 4, 4)]);
  ed._doc.floors[0].walls = [{ id: "w", a: [5, 0], b: [7, 0] }];
  ed.selectItem("wall", "w");
  const flat = (v: unknown): string => {
    if (v == null || typeof v !== "object") return typeof v === "string" || typeof v === "number" ? String(v) : "";
    if (Array.isArray(v)) return v.map(flat).join("");
    const t = v as { strings?: readonly string[]; values?: unknown[] };
    return t.strings ? t.strings.map((s, i) => s + (i < (t.values?.length ?? 0) ? flat(t.values![i]) : "")).join("") : "";
  };
  const side = flat(ed.renderAside(ed.floor));
  const nav = side.indexOf("fp3d-nav-row");
  const form = side.indexOf("<section");
  assert.ok(nav > -1 && form > nav, "the back row, then the wall's form");
  assert.doesNotMatch(side.slice(nav, form), /fp3d-spacer|flex:\s*1/, "nothing that fills the height between them");
});
