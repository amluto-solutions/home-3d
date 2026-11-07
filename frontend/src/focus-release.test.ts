import assert from "node:assert/strict";
import { test } from "node:test";
import { beforeSelectionChange, releaseTyping } from "./focus-release.ts";

/** A stand-in for an element: a tag, maybe its own shadow root, and a record of being blurred. */
function el(tagName: string, shadow?: { activeElement: unknown }) {
  const e = { tagName, shadowRoot: shadow ?? null, blurred: 0, blur() {
    e.blurred++;
  } };
  return e;
}

test("a number box with the cursor in it lets go", () => {
  const input = el("INPUT");
  assert.equal(releaseTyping({ activeElement: input }), true);
  assert.equal(input.blurred, 1);
});

test("the cursor is found inside nested shadow roots (the library's search box)", () => {
  const search = el("INPUT");
  const library = el("FP3D-LIBRARY", { activeElement: search });
  assert.equal(releaseTyping({ activeElement: library }), true);
  assert.equal(search.blurred, 1);
  assert.equal(library.blurred, 0);
});

test("selects and text areas let go too", () => {
  for (const tag of ["SELECT", "TEXTAREA"]) {
    const box = el(tag);
    releaseTyping({ activeElement: box });
    assert.equal(box.blurred, 1, tag);
  }
});

test("a button keeps its keyboard focus (it doesn't swallow shortcuts)", () => {
  const button = el("BUTTON");
  assert.equal(releaseTyping({ activeElement: button }), false);
  assert.equal(button.blurred, 0);
});

test("nothing focused: nothing happens", () => {
  assert.equal(releaseTyping({ activeElement: null }), false);
});

test("a value typed for the old item lands on the old item when the selection moves", () => {
  // the editor has already switched to the new item when it hears of the change; the typed value must not go there
  const host: Record<string, unknown> = { _furnitureId: "sofa" };
  const landed: unknown[] = [];
  const input = el("INPUT");
  input.blur = () => void landed.push(host._furnitureId);
  host._furnitureId = "lamp";
  beforeSelectionChange(host, "_furnitureId", "sofa", { activeElement: input });
  assert.deepEqual(landed, ["sofa"]);
  assert.equal(host._furnitureId, "lamp");
});

test("other properties changing don't touch the cursor (typing in a box changes the plan all the time)", () => {
  const input = el("INPUT");
  const host: Record<string, unknown> = { _doc: 2 };
  beforeSelectionChange(host, "_doc", 1, { activeElement: input });
  beforeSelectionChange(host, "_tool", "select", { activeElement: input });
  assert.equal(input.blurred, 0);
});

test("every kind of selection counts: rooms, openings, devices, outdoor areas, walls and multi selections", () => {
  for (const key of ["_roomId", "_openingId", "_furnitureId", "_deviceId", "_outdoorId", "_wallId", "_multi"]) {
    const input = el("INPUT");
    beforeSelectionChange({ [key]: "b" }, key, "a", { activeElement: input });
    assert.equal(input.blurred, 1, key);
  }
});

test("choosing the same thing again (a fresh empty multi selection) is no change", () => {
  const input = el("INPUT");
  beforeSelectionChange({ _multi: [] }, "_multi", [], { activeElement: input });
  beforeSelectionChange({ _furnitureId: "sofa" }, "_furnitureId", "sofa", { activeElement: input });
  assert.equal(input.blurred, 0);
});

test("another floor is another selection too", () => {
  const input = el("INPUT");
  beforeSelectionChange({ _floorId: "first" }, "_floorId", "ground", { activeElement: input });
  assert.equal(input.blurred, 1);
});

test("putting the old value back for a moment doesn't start the release again (the editor hears every set)", () => {
  const input = el("INPUT");
  const root = { activeElement: input };
  let value: unknown = "lamp";
  let sets = 0;
  const host = {
    get _furnitureId() {
      return value;
    },
    set _furnitureId(v: unknown) {
      const old = value;
      value = v;
      if (++sets > 10) throw new Error("loops");
      beforeSelectionChange(host, "_furnitureId", old, root);
    },
  };
  beforeSelectionChange(host, "_furnitureId", "sofa", root);
  assert.equal(input.blurred, 1);
  assert.equal(host._furnitureId, "lamp");
});
