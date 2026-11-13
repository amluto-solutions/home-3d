// #449 (NeonPlan 3D 3.1.1, MIT, Mastershort): a fixed device is chosen by a press and release on it, and a chosen
// outdoor area shows a number at each corner and the length of each edge.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { OutdoorArea, Placement } from "../model.ts";
import { makeEditor, planEl, square } from "./editor-harness.ts";

const PLUG = "switch.sample_plug";

function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function" || typeof v === "boolean") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return typeof v === "object" ? "" : String(v);
}

test("a press and release on a fixed device chooses it (#449)", async () => {
  const el = await makeEditor([square("r", 0, 0, 6, 6)]);
  el._doc.floors[0].placements.push({ entity_id: PLUG, x: 2, z: 2, y: null, rotation: 0, locked: true } as unknown as Placement);
  assert.equal(el._deviceId, null);
  const on = planEl({ "data-device": PLUG });
  // the real press handler (the harness's press skips it, and with it the fixed-item guard)
  const ev = (): PointerEvent => ({ clientX: 200, clientY: 200, button: 0, pointerId: 1, pointerType: "mouse", altKey: false, shiftKey: false, ctrlKey: false, metaKey: false, target: on, currentTarget: el.renderRoot.querySelector("svg"), preventDefault() {}, stopPropagation() {} }) as unknown as PointerEvent;
  el.onPointerDown(ev());
  el.onPointerUp(ev());
  assert.equal(el._deviceId, PLUG);
  assert.equal(el._doc.floors[0].placements[0].x, 2, "it did not move");
});

test("a chosen outdoor area shows a number per corner and a length per edge (#449)", async () => {
  const el = await makeEditor([square("r", 0, 0, 5, 4)]);
  const lawn: OutdoorArea = { id: "lawn", type: "lawn", points: [[6, 0], [10, 0], [10, 3], [6, 3]] };
  el._doc.floors[0].outdoor = [lawn];
  el.selectItem("outdoor", "lawn");
  const out = flat(el.renderOutdoorHandles(el.floor));
  assert.equal((out.match(/class="fp3d-vertex-no"/g) ?? []).length, 4);
  assert.equal((out.match(/class="fp3d-dim"/g) ?? []).length, 4);
  assert.match(out, /4(\.00)? ?m|>4</, "the top edge is 4 m");
});
