// The item panel's colour rows (#410, option A of the #405 review with option C's preset tiles): one row per part
// with the shared hex field and a finish chip, the swatch popover (presets, hex, finish, reset), and the glow colour
// moved to the link section.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { setPacks, type FurniturePack } from "../packs.ts";
import { makeEditor, square } from "./editor-harness.ts";

const PACK: FurniturePack = {
  id: "demo.rows",
  name: "Rows",
  publisher: "Demo",
  items: [
    {
      id: "hatch",
      name: { en: "Hatch" },
      size: [1.8, 4, 1.5],
      vehicle: true,
      colors: { paint: "#a51c2c" },
      parts: (["dark", "metal", "glass", "paint"] as const).map((color) => ({ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 0.2, color })),
    },
  ],
} as unknown as FurniturePack;

/** Every string and value of a lit template, flattened into one text. */
function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function" || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return typeof v === "object" ? "" : String(v);
}

type Tpl = { strings: readonly string[]; values: unknown[] };

/** The templates under `v` whose markup matches `re`, depth first. */
function templates(v: unknown, re: RegExp, out: Tpl[] = []): Tpl[] {
  if (Array.isArray(v)) v.forEach((x) => templates(x, re, out));
  else if (v && typeof v === "object" && "strings" in (v as object)) {
    const t = v as Tpl;
    if (re.test(t.strings.join(""))) out.push(t);
    t.values.forEach((x) => templates(x, re, out));
  }
  return out;
}

/** The value bound right after the attribute `name=` in a template. */
function bound(t: Tpl, name: string): unknown {
  const i = t.strings.findIndex((s) => s.trimEnd().endsWith(`${name}=`));
  return i < 0 ? undefined : t.values[i];
}

const car = (extra: Partial<Furniture> = {}): Furniture => ({ id: "car", type: "pack:demo.rows:hatch", x: 1.5, z: 1.5, rotation: 0, w: 1.8, d: 4, h: 1.5, variant: null, ...extra });

async function editor(f: Furniture = car()) {
  setPacks([PACK]);
  const ed = await makeEditor([square("r1", 0, 0, 6, 6)], [f]);
  ed.packs = [PACK];
  ed.selectItem("furniture", f.id);
  return ed;
}
const item = (ed: Awaited<ReturnType<typeof editor>>) => ed._doc.floors[0].furniture[0] as Furniture;

test("one full-width row per part, paint first, named by part, each with the hex field and a finish chip; no select (#410, #411)", async () => {
  const ed = await editor();
  const out = ed.renderColourRoles(ed.furnitureItem);
  const html = flat(out);
  const rows = templates(out, /class="fp3d-part-row"/);
  assert.deepEqual(
    rows.map((r) => bound(r, "data-part")),
    ["paint", "metal", "dark", "glass"],
  );
  assert.deepEqual([...html.matchAll(/class="fp3d-part-name">([^<]+)</g)].map((m) => m[1]), ["Paint", "Wheels", "Tyres and trim", "Windows"]);
  assert.equal((html.match(/<fp3d-colour-field/g) ?? []).length, 4);
  assert.equal((html.match(/class=fp3d-part-finish/g) ?? []).length, 4);
  // the finishes say what the part has: its usual one while it has none of its own
  assert.match(html, /aria-label=Finish of Paint: Gloss/);
  assert.match(html, /aria-label=Finish of Windows: Glass/);
  assert.doesNotMatch(html, /<select|Finishes and presets|From the appearance|Usual \(|Colour while active/);
  // a part on its default shows the colour it has now: the colourway's paint, else its role's in the look
  assert.match(html, /\.base=#a51c2c/);
  setPacks([]);
});

test("the swatch opens the part's popover below its row: preset tiles, hex field, finishes; one at a time (#410)", async () => {
  const ed = await editor();
  const swatch = templates(ed.renderColourRoles(ed.furnitureItem), /^<fp3d-colour-field/)[0]!;
  // the row's field opens the popover from its swatch (menu mode) and says whether it is open
  (bound(swatch, "@colour-menu") as () => void)();
  assert.equal(ed.openPart(ed.furnitureItem), "paint");
  const open = flat(ed.renderColourRoles(ed.furnitureItem));
  assert.match(open, /class="fp3d-part-pop" id="fp3d-part-pop" role="group" aria-label=Paint/);
  assert.equal((open.match(/class="fp3d-tile"/g) ?? []).length, 10, "the ten car paints (#129)");
  assert.match(open, /aria-label=Colours for Paint/);
  assert.match(open, />Gloss \(default\)</);
  assert.match(open, />Metal</);
  assert.doesNotMatch(open, />Fabric</, "only finishes that fit the part");
  assert.doesNotMatch(open, /Reset to default/, "nothing to reset yet");
  // the colourway's own paint is none of the ten: no tile is pressed
  assert.doesNotMatch(open, /class="fp3d-tile" aria-pressed=true/);
  // another part's swatch moves the popover there; its own swatch again closes it
  ed.togglePart(ed.furnitureItem, "glass");
  assert.equal(ed.openPart(ed.furnitureItem), "glass");
  const glass = flat(ed.renderColourRoles(ed.furnitureItem));
  assert.equal((glass.match(/class="fp3d-part-pop"/g) ?? []).length, 1);
  assert.doesNotMatch(glass, />Oak<|>Green velvet</, "glass gets glass colours");
  assert.match(glass, />Clear</);
  ed.togglePart(ed.furnitureItem, "glass");
  assert.equal(ed.openPart(ed.furnitureItem), null);
  assert.doesNotMatch(flat(ed.renderColourRoles(ed.furnitureItem)), /fp3d-part-pop/);
  setPacks([]);
});

test("a tile, a finish and Reset to default are one undo step each (#410)", async () => {
  const ed = await editor();
  ed.togglePart(ed.furnitureItem, "metal");
  const tiles = templates(ed.renderColourRoles(ed.furnitureItem), /class="fp3d-tile"/);
  assert.ok(tiles.length >= 3);
  (bound(tiles[0]!, "@click") as () => void)();
  const chrome = item(ed).colors?.metal;
  assert.match(chrome!, /^#[0-9a-f]{6}$/);
  ed.setPartFinish(ed.furnitureItem, "metal", "gloss");
  assert.deepEqual(item(ed).materials, { metal: "gloss" });
  // the part's usual finish is no finish of its own
  ed.setPartFinish(ed.furnitureItem, "metal", "metal");
  assert.equal(item(ed).materials ?? null, null);
  ed.setPartFinish(ed.furnitureItem, "metal", "matt");
  assert.match(flat(ed.renderColourRoles(ed.furnitureItem)), /Reset to default/);
  ed.resetPart(ed.furnitureItem, "metal");
  assert.equal(item(ed).colors ?? null, null);
  assert.equal(item(ed).materials ?? null, null);
  ed.undo();
  assert.equal(item(ed).colors?.metal, chrome, "one undo brings colour and finish back together");
  assert.deepEqual(item(ed).materials, { metal: "matt" });
  ed.undo();
  ed.undo();
  ed.undo();
  ed.undo();
  assert.equal(item(ed).colors ?? null, null, "and each step before it was one undo");
  setPacks([]);
});

test("a paste into a row's hex field sets that part's colour in one undo step (#410)", async () => {
  const ed = await editor();
  const fields = templates(ed.renderColourRoles(ed.furnitureItem), /^<fp3d-colour-field/);
  // the second row is the wheels (metal); the field sends one colour-change for a paste
  (bound(fields[1]!, "@colour-change") as (e: Event) => void)({ detail: { value: "#1e6ebc" } } as unknown as Event);
  assert.deepEqual(item(ed).colors, { metal: "#1e6ebc" });
  ed.undo();
  assert.equal(item(ed).colors ?? null, null);
  setPacks([]);
});

test("the glow colour is no part: it sits with the link, only when there is one or it is set (#410, ORDER-3, DEF-2)", async () => {
  const ed = await editor();
  assert.doesNotMatch(flat(ed.renderColourRoles(ed.furnitureItem)), /Glow colour/);
  assert.equal(flat(ed.renderGlowColour(ed.furnitureItem, null)), "", "no link: nothing");
  const linked = flat(ed.renderGlowColour(ed.furnitureItem, "media_player.tv"));
  assert.match(linked, /Glow colour/);
  // on its default it shows the usual glow (the neon cyan), not a faded red
  assert.match(linked, /\.base=#38e0ff/);
  assert.doesNotMatch(linked, /ff3b30/);
  // a glow colour of its own stays in sight, link or not
  ed.updateFurniture({ active_color: "#22cc88" });
  assert.match(flat(ed.renderGlowColour(ed.furnitureItem, null)), /\.value=#22cc88/);
  setPacks([]);
});

test("an item with no colour parts shows no colour block (#410)", async () => {
  const ed = await editor({ id: "l", type: "lamp_ceiling", x: 1, z: 1, rotation: 0, w: 0.4, d: 0.4, h: 0.1, variant: null } as Furniture);
  assert.equal(flat(ed.renderColourRoles(ed.furnitureItem)), "");
  setPacks([]);
});
