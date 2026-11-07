// #419 (MANY-3): a device pin's "Show as furniture" is a button that opens the furniture library's picker (search,
// filters, pictures) with the items that fit the device, not one select with every library item.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Placement } from "../model.ts";
import { setPacks, type FurniturePack } from "../packs.ts";
// The harness comes first: it sets the build-time globals that editor/furniture.ts (via load3d.ts) reads on load.
import { makeEditor, square } from "./editor-harness.ts";
import { furnitureFits } from "./editor/furniture.ts";

const part = { shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "white" };
/** A big library: 1,200 electric items and a lamp, as an installed set of packs can be. */
const BIG: FurniturePack = {
  id: "demo.big",
  name: "Big",
  publisher: "Demo",
  items: [
    ...Array.from({ length: 1200 }, (_, i) => ({ id: `gadget_${i}`, name: { en: `Gadget ${i}` }, size: [0.3, 0.3, 0.3], group: "tech", electric: true, parts: [part] })),
    { id: "glow_lamp", name: { en: "Glow lamp" }, size: [0.3, 0.3, 0.5], group: "lighting", light: { type: "point" }, parts: [part] },
  ],
} as unknown as FurniturePack;
setPacks([BIG]);

function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function" || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return typeof v === "object" ? "" : String(v);
}

/** The value bound to an attribute (e.g. "@pick") anywhere in a lit template. */
function bound(v: unknown, attr: string): unknown {
  if (Array.isArray(v)) {
    for (const x of v) {
      const hit = bound(x, attr);
      if (hit !== undefined) return hit;
    }
    return undefined;
  }
  if (v && typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    for (let i = 0; i < t.values.length; i++) {
      if (t.strings[i]!.trimEnd().endsWith(`${attr}=`)) return t.values[i];
      const hit = bound(t.values[i], attr);
      if (hit !== undefined) return hit;
    }
  }
  return undefined;
}

const PLUG = "switch.sample_plug";

async function pinEditor() {
  const ed = await makeEditor([{ ...square("r", 0, 0, 6, 6), name: "Office" }]);
  ed.packs = [BIG];
  ed.hass = { states: { [PLUG]: { entity_id: PLUG, state: "on", attributes: { friendly_name: "Sample plug" } } }, entities: {}, devices: {}, areas: {}, user: { is_admin: true }, language: "en", locale: { language: "en" } };
  const pl: Placement = { entity_id: PLUG, x: 2, z: 2, y: null, rotation: 0 } as Placement;
  ed._doc.floors[0].placements.push(pl);
  ed.selectItem("device", PLUG);
  return { ed, pl: ed._doc.floors[0].placements[0] as Placement };
}

test("the pin panel has a Show as furniture button, not a select of every library item (#419)", async () => {
  const { ed, pl } = await pinEditor();
  const form = flat(ed.renderDeviceForm(pl));
  const options = (form.match(/<option/g) ?? []).length;
  assert.ok(options < 50, `${options} options in the pin panel`);
  assert.match(form, /aria-haspopup="dialog"[^>]*>Show as furniture …/);
  assert.match(form, /aria-label=More about Show as furniture/, "the help is behind i, not only a tooltip");
  assert.doesNotMatch(form, /fp3d-item-picker/, "the library opens on demand");
  assert.doesNotMatch(form, /Gadget 1199/);
});

test("the picker offers the library cards that fit the device, titled Show as furniture (#419)", async () => {
  const { ed, pl } = await pinEditor();
  const entries = ed.furnitureEntriesFor(PLUG);
  assert.ok(entries.some((e: { type: string }) => e.type === "pack:demo.big:gadget_7"));
  assert.ok(!entries.some((e: { type: string }) => e.type === "pack:demo.big:glow_lamp"), "a plug is no lamp");
  assert.ok(ed.furnitureEntriesFor("light.sample_lamp").some((e: { type: string }) => e.type === "pack:demo.big:glow_lamp"));
  assert.equal(furnitureFits("climate.sample_trv")("radiator"), true);
  assert.equal(furnitureFits("climate.sample_trv")("pack:demo.big:gadget_1"), false);
  ed._itemPicker = true;
  const open = ed.renderDeviceForm(pl);
  assert.match(flat(open), /<fp3d-item-picker/);
  assert.equal(bound(open, ".heading"), "Show as furniture");
  assert.equal((bound(open, ".entries") as unknown[]).length, entries.length);
});

test("picking a library item turns the pin into that item, as the select did (#419)", async () => {
  const { ed, pl } = await pinEditor();
  ed._itemPicker = true;
  const pick = bound(ed.renderDeviceForm(pl), "@pick") as (e: unknown) => void;
  pick({ detail: { type: "pack:demo.big:gadget_7" } });
  const floor = ed._doc.floors[0];
  assert.equal(floor.placements.length, 0, "the pin is gone");
  const made = floor.furniture.find((f: { type: string }) => f.type === "pack:demo.big:gadget_7");
  assert.ok(made, "the item stands in its place");
  assert.equal(made.entity, PLUG);
  assert.deepEqual([made.x, made.z], [2, 2]);
  assert.equal(ed._itemPicker, false, "the picker closed");
});
