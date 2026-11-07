import assert from "node:assert/strict";
import { test } from "node:test";
import { makeEditor } from "./components/editor-harness.ts";
import { parsePinZoom, pinsShown, PLAN_PIN_ZOOM_DEFAULT, PLAN_PIN_ZOOM_MAX } from "./plan-pins.ts";

test("the cut-off reads from a stored number and falls back to the default (#220)", () => {
  assert.equal(parsePinZoom(null), PLAN_PIN_ZOOM_DEFAULT);
  assert.equal(parsePinZoom(""), PLAN_PIN_ZOOM_DEFAULT);
  assert.equal(parsePinZoom("abc"), PLAN_PIN_ZOOM_DEFAULT);
  assert.equal(parsePinZoom("-5"), PLAN_PIN_ZOOM_DEFAULT);
  assert.equal(parsePinZoom("55"), 55);
  assert.equal(parsePinZoom("0"), 0);
  assert.equal(parsePinZoom("9999"), PLAN_PIN_ZOOM_MAX);
});

test("markers show from the cut-off zoom up, and always at 0 (#220)", () => {
  assert.equal(pinsShown(20, 40), false);
  assert.equal(pinsShown(40, 40), true);
  assert.equal(pinsShown(120, 40), true);
  assert.equal(pinsShown(1, 0), true);
});

const room = (id: string, x: number) => ({ id, name: id, area_id: null, points: [[x, 0], [x + 4, 0], [x + 4, 3], [x, 3]], floor_material: "wood" }) as never;

/** How many markers a render of the editor's devices holds. */
const drawn = (el: Record<string, any>): number => {
  const list = el.renderDevices(el.floor).values[0] as unknown[];
  return list.filter((x) => typeof x === "object" && x !== null && "strings" in (x as object)).length;
};

test("the editor plan hides device markers zoomed out and keeps the selected room's and the selected device (#220)", async () => {
  (globalThis as Record<string, unknown>).localStorage = { getItem: () => null, setItem: () => undefined };
  const el = await makeEditor([room("a", 0), room("b", 6)]);
  el._doc.floors[0].placements.push(
    { entity_id: "light.sample_a", x: 1, z: 1 },
    { entity_id: "light.sample_b", x: 7, z: 1 },
    { entity_id: "light.sample_c", x: 8, z: 2 },
  );
  el._view = { scale: 100, ox: 0, oy: 0 };
  assert.equal(drawn(el), 3, "zoomed in: all");
  el._view = { scale: 20, ox: 0, oy: 0 };
  assert.equal(drawn(el), 0, "zoomed out: none");
  el._roomId = "b";
  assert.equal(drawn(el), 2, "the chosen room's stay");
  el._roomId = null;
  el._deviceId = "light.sample_a";
  assert.equal(drawn(el), 1, "the chosen device stays");
});

test("the read-only 2D plan hides pins zoomed out, but not the chosen room's or always-on ones (#220)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(new URL("./plan2d/viewer2d.ts", import.meta.url), "utf8");
  assert.match(src, /classList\.toggle\("fp3d-p2d-far", !pinsShown\(v\.k, this\.pinCut\)\)/);
  assert.match(src, /\.fp3d-p2d-far \.fp3d-p2d-pin:not\(\.fp3d-dev-full\):not\(\.fp3d-p2d-flash\) \{ display: none; \}/);
});
