import assert from "node:assert/strict";
import { test } from "node:test";
import type { Floor, Furniture } from "./model.ts";
import { CLIPBOARD_SHORTCUTS, clipboardKey, copyItems, pasteItems, withKeys } from "./clipboard.ts";

const item = (id: string, extra: Partial<Furniture> = {}): Furniture =>
  ({ id, type: "tv", x: 1, z: 2, rotation: 90, w: 1, d: 0.2, h: 0.6, variant: null, ...extra }) as Furniture;

const floor = (id: string, furniture: Furniture[] = []): Floor =>
  ({ id, name: id, elevation: 0, height: 2.5, cut_height: 1.2, rooms: [], openings: [], furniture, placements: [], background: null, outdoor: [], ha_floor: null }) as Floor;

/** Ids as the editor makes them, but predictable. */
function ids() {
  let n = 0;
  return (prefix: string) => `${prefix}_${++n}`;
}

test("a copy pasted on another floor lands right above or below the original, with new ids and its links (#74)", () => {
  const ground = floor("ground", [item("tv", { entity: "media_player.sample_tv", name: "Big TV" }), item("sofa")]);
  const clip = copyItems(ground, ["tv"])!;
  const [copy] = pasteItems(clip, "first", ids());
  assert.equal(copy.id, "furniture_1");
  assert.deepEqual([copy.x, copy.z, copy.rotation], [1, 2, 90]);
  assert.equal(copy.entity, "media_player.sample_tv");
  assert.equal(copy.name, "Big TV");
});

test("pasted on the floor it came from, each paste sits a little further off so none hides another (#74)", () => {
  const clip = copyItems(floor("ground", [item("tv")]), ["tv"])!;
  const next = ids();
  const a = pasteItems(clip, "ground", next)[0];
  const b = pasteItems(clip, "ground", next)[0];
  const up = pasteItems(clip, "first", next)[0];
  const up2 = pasteItems(clip, "first", next)[0];
  assert.deepEqual([a.x, a.z], [1.3, 2.3]);
  assert.deepEqual([b.x, b.z], [1.6, 2.6]);
  assert.deepEqual([up.x, up.z], [1, 2]);
  assert.deepEqual([up2.x, up2.z], [1.3, 2.3]);
});

test("the clipboard holds the items as they were copied, not as they are edited later (#74)", () => {
  const ground = floor("ground", [item("tv")]);
  const clip = copyItems(ground, ["tv"])!;
  ground.furniture[0].x = 4;
  ground.furniture[0].name = "Moved";
  const [copy] = pasteItems(clip, "first", ids());
  assert.equal(copy.x, 1);
  assert.equal(copy.name, undefined);
});

test("a copied block pastes as a block of its own, and pasted items are never fixed (#74)", () => {
  const ground = floor("ground", [item("k1", { group: "kitchen", locked: true }), item("k2", { group: "kitchen" }), item("chair")]);
  const clip = copyItems(ground, ["k1", "k2", "chair"])!;
  const next = ids();
  const copies = pasteItems(clip, "first", next);
  assert.equal(copies.length, 3);
  const [k1, k2, chair] = copies;
  assert.ok(k1.group && k1.group !== "kitchen");
  assert.equal(k1.group, k2.group);
  assert.equal(chair.group ?? null, null);
  assert.ok(copies.every((c) => !c.locked));
  const again = pasteItems(clip, "first", next);
  assert.notEqual(again[0].group, k1.group);
});

test("nothing chosen: nothing to copy (#74)", () => {
  assert.equal(copyItems(floor("ground", [item("tv")]), []), null);
  assert.equal(copyItems(floor("ground", [item("tv")]), ["gone"]), null);
});

test("the shortcuts are listed for the help overlay and the button tooltips name them (#74)", () => {
  assert.deepEqual(
    CLIPBOARD_SHORTCUTS.map((s) => s.keys),
    [["Ctrl+C"], ["Ctrl+V"], ["Ctrl+A"]],
  );
  assert.equal(withKeys("Copy", ["Ctrl+C"]), "Copy (Ctrl+C)");
  assert.equal(withKeys("Rotate left", ["Shift+R"]), "Rotate left (Shift+R)");
});

test("Ctrl or Cmd with C, V or A are the clipboard keys; with Shift or Alt, or without Ctrl, they are not (#74)", () => {
  const k = (key: string, mods: Partial<Record<"ctrlKey" | "metaKey" | "shiftKey" | "altKey", boolean>> = {}) => clipboardKey({ key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...mods });
  assert.equal(k("c", { ctrlKey: true }), "copy");
  assert.equal(k("C", { metaKey: true }), "copy");
  assert.equal(k("v", { ctrlKey: true }), "paste");
  assert.equal(k("a", { ctrlKey: true }), "select_all");
  assert.equal(k("c"), null);
  assert.equal(k("v", { ctrlKey: true, shiftKey: true }), null);
  assert.equal(k("a", { ctrlKey: true, altKey: true }), null);
  assert.equal(k("r"), null);
});
