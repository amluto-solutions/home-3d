import assert from "node:assert/strict";
import { test } from "node:test";
import { hintKey, touchOnly, touchWording, type HintState } from "./editor-hint.ts";
import { translate } from "./i18n.ts";
import type { HomeAssistant } from "./types.ts";

const base: HintState = { tool: "select", hasFloor: true, rooms: 3, selected: null };
const en = { language: "en" } as unknown as HomeAssistant;

test("first run: no floor asks for a floor, an empty floor for the first room (#96)", () => {
  assert.equal(hintKey({ ...base, hasFloor: false, rooms: 0 }), "hint_empty");
  assert.equal(hintKey({ ...base, rooms: 0 }), "hint_first_room");
  // drawing tools say how they work even on an empty floor
  assert.equal(hintKey({ ...base, rooms: 0, tool: "rect" }), "hint_rect");
});

test("the hint follows the tool, one string per tool (#96)", () => {
  for (const tool of ["select", "rect", "polygon", "measure", "wall", "opening", "hole", "roof", "energy", "furniture", "outdoor", "pool"] as const) {
    const key = hintKey({ ...base, tool });
    assert.equal(key, `hint_${tool}`);
    assert.notEqual(translate(en, key), key, `${key} has an English text`);
  }
});

test("in Select, the hint explains what can be done with the selected thing (#96)", () => {
  assert.equal(hintKey({ ...base, selected: "furniture" }), "hint_sel_furniture");
  assert.equal(hintKey({ ...base, selected: "opening" }), "hint_sel_opening");
  assert.equal(hintKey({ ...base, selected: "device" }), "hint_sel_device");
  assert.equal(hintKey({ ...base, selected: "room" }), "hint_select");
  // the furniture tool keeps its own hint
  assert.equal(hintKey({ ...base, tool: "furniture", selected: "furniture" }), "hint_furniture");
});

test("temporary states win over the tool hint (#96)", () => {
  assert.equal(hintKey({ ...base, wallPick: true }), "hint_wall_pick");
  assert.equal(hintKey({ ...base, kerbPick: true, selected: "furniture" }), "hint_kerb_pick");
  assert.equal(hintKey({ ...base, fixedHint: true, selected: "furniture" }), "fixed_drag_hint");
  assert.equal(hintKey({ ...base, tool: "outdoor", outdoorFree: true }), "hint_outdoor_free");
  assert.equal(hintKey({ ...base, tool: "pool", jointPlace: true }), "hint_joint_place");
  assert.equal(hintKey({ ...base, tool: "pool", pipeMode: true, poolArea: false }), "hint_pipe_pool");
  assert.equal(hintKey({ ...base, tool: "pool", pipeMode: true, poolArea: true }), "hint_pipe_start");
  assert.equal(hintKey({ ...base, tool: "pool", pipeMode: true, poolArea: true, pipeDraft: true }), "hint_pipe_next");
  assert.equal(hintKey({ ...base, tool: "pool", poolTech: true }), "hint_pool_tech");
});

test("an armed library card says what the next click places (#76)", () => {
  assert.equal(hintKey({ ...base, placing: true, wallPick: true, selected: "furniture" }), "hint_place");
  assert.equal(hintKey({ ...base, hasFloor: false, placing: true }), "hint_empty");
});

test("a touch-only device is told by its pointers: coarse and no fine one (#228)", () => {
  const mm = (coarse: boolean, fine: boolean) => (q: string) => ({ matches: q.includes("coarse") ? coarse : fine });
  assert.equal(touchOnly(mm(true, false)), true);
  assert.equal(touchOnly(mm(true, true)), false, "a touch laptop keeps its keyboard hints");
  assert.equal(touchOnly(mm(false, true)), false);
  assert.equal(touchOnly(undefined), false);
});

test("touch hints drop keyboard parts and click / Enter sentences; desktop text stays (#228)", () => {
  const t = (k: Parameters<typeof translate>[1], p?: Record<string, string | number>) => translate(en, k, p);
  const keys = /\b(?:Shift|Ctrl|Alt|Esc|Enter|Del|Backspace)\b|arrow keys|\bR turns|\bL fixes|click/i;
  for (const key of ["hint_select", "hint_sel_furniture", "hint_sel_opening", "hint_sel_device", "hint_polygon", "hint_outdoor_free", "hint_place", "hint_opening", "hint_snapped", "hint_wall", "hint_pipe_next", "hint_kerb_pick", "hint_wall_pick", "fixed_drag_hint", "multi_hint"] as const) {
    const touch = touchWording(true, key, t, { name: "Sofa", kind: "Door", what: "wall" });
    assert.ok(touch.length > 0 && !keys.test(touch), `${key}: ${touch}`);
  }
  assert.equal(touchWording(false, "hint_select", t), t("hint_select"));
  assert.match(touchWording(false, "hint_select", t), /arrow keys nudge · Del deletes/);
  assert.equal(touchWording(true, "hint_select", t), "Tap a room to select · drag corners · “+” on an edge inserts a corner");
});
