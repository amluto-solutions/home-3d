// One fold everywhere (#413, CONS-5, A11Y-2, MANY-6): the room, floor and rack sections, the car's "Change what was
// found" and the item's Tap / Hold / Double tap are the item panel's 44 px fold row, never a <details> or a link toggle.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { Furniture, Room } from "../model.ts";
import { setPacks, type FurniturePack } from "../packs.ts";
import { itemProfile } from "../item-profile.ts";
import { panelUi, resetFolds, setFoldOpen, setSideFold, sideFoldOpen } from "./editor/item-sections.ts";
import { makeEditor, square } from "./editor-harness.ts";

const PACK: FurniturePack = {
  id: "demo.cars",
  name: "Cars",
  publisher: "Demo",
  items: [{ id: "leaf", name: { en: "Demo Leaf" }, size: [1.8, 4.5, 1.5], vehicle: true, electric: true, parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0.2, h: 0.4, color: "paint" }] }],
} as unknown as FurniturePack;
setPacks([PACK]);

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

const item = (id: string, type: string, extra: Partial<Furniture> = {}): Furniture => ({ id, type, x: 1.5, z: 1.5, rotation: 0, w: 1, d: 1, h: 1, variant: null, ...extra }) as Furniture;
const lShape = (): Room => ({ id: "l", name: "Hall", area_id: null, points: [[0, 0], [4, 0], [4, 2], [2, 2], [2, 4], [0, 4]], floor_material: "wood" });

test("sideFold is the shared fold row: a button with aria-expanded, no body while closed, open per scope for this visit", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)]);
  const closed = flat(ed.sideFold("demo", "r", false, "Demo", "Summary", 2, () => "BODY"));
  assert.match(closed, /<section class="fp3d-fold" data-fold=demo/);
  assert.match(closed, /class="fp3d-fold-btn" aria-expanded=false/);
  assert.match(closed, /2 set/);
  assert.match(closed, /Summary/);
  assert.doesNotMatch(closed, /BODY/);
  setSideFold(ed, "demo:r", true);
  assert.equal(sideFoldOpen(ed, "demo:r", false), true);
  const open = flat(ed.sideFold("demo", "r", false, "Demo", "Summary", 2, () => "BODY"));
  assert.match(open, /aria-expanded=true/);
  assert.match(open, /BODY/);
  assert.doesNotMatch(open, /Summary/, "an open fold shows its fields, not the summary");
  // another room starts at its own default
  assert.doesNotMatch(flat(ed.sideFold("demo", "other", false, "Demo", "", 0, () => "BODY")), /BODY/);
});

test("the room panel has no <details> left; its corners, climate and sensors are folds (#413)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4), lShape()]);
  ed.hass = { ...ed.hass, entities: {}, devices: {} };
  ed._roomId = "r";
  const rect = flat(ed.renderRoomForm(ed.room, []));
  assert.doesNotMatch(rect, /<details|<summary/);
  for (const key of ["corners", "room-climate", "room-live"]) assert.match(rect, new RegExp(`data-fold=${key}`), key);
  // the corners start closed, also for an L shape (#416: the panel opens short; the plan's handles move them)
  assert.doesNotMatch(rect, /fp3d-point /);
  ed._roomId = "l";
  assert.doesNotMatch(flat(ed.renderRoomForm(ed.room, [])), /fp3d-point /);
  setSideFold(ed, "corners:l", true);
  assert.match(flat(ed.renderRoomForm(ed.room, [])), /fp3d-point /);
});

test("a chosen climate sensor shows in the closed fold's summary with its count (#413)", async () => {
  const ed = await makeEditor([{ ...square("r", 0, 0, 4, 4), climate: { temperature: "sensor.lounge_t" } } as Room]);
  ed.hass = { ...ed.hass, entities: {}, devices: {}, states: { "sensor.lounge_t": { entity_id: "sensor.lounge_t", state: "20", attributes: { friendly_name: "Lounge temperature", device_class: "temperature" } } } };
  ed._roomId = "r";
  setSideFold(ed, "room-climate:r", false);
  const out = flat(ed.renderRoomClimate(ed.room));
  assert.match(out, /Lounge temperature/);
  assert.match(out, /1 set/);
});

test("the floor page's lists, unplaced entities and background are folds, not <details> (#413, A11Y-2)", async () => {
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [item("a", "sofa")]);
  ed.hass = { ...ed.hass, entities: {}, devices: {} };
  const floor = ed.floor;
  const parts = [ed.renderItemsList(floor.furniture, true), ed.renderUnplaced(), ed.renderBackgroundForm(floor)].map(flat).join("");
  assert.doesNotMatch(parts, /<details|<summary/);
  for (const key of ["items", "unplaced", "background"]) assert.match(parts, new RegExp(`data-fold=${key}`), key);
  // the open state of Unplaced is still the editor's (it walks every area only while open)
  ed._unplacedOpen = true;
  assert.match(flat(ed.renderUnplaced()), /aria-expanded=true/);
});

test("the car's 'Change what was found' is a fold with no 'Done' link (#413)", async () => {
  resetFolds();
  const ed = await makeEditor([{ ...square("r", 0, 0, 6, 6), name: "Garage" }], [item("c", "pack:demo.cars:leaf", { entity: "sensor.car_battery", w: 1.8, d: 4.5, h: 1.5 })]);
  ed.packs = [PACK];
  // the fold only shows when readings were found on the car's device (#415), so the car reports two
  ed.hass = {
    ...ed.hass,
    entities: { "sensor.car_battery": { entity_id: "sensor.car_battery", device_id: "leaf" }, "lock.car_doors": { entity_id: "lock.car_doors", device_id: "leaf" } },
    devices: { leaf: { id: "leaf", name: "Leaf" } },
    states: {
      ...ed.hass.states,
      "sensor.car_battery": { entity_id: "sensor.car_battery", state: "80", attributes: { friendly_name: "Leaf battery", device_class: "battery", unit_of_measurement: "%" } },
      "lock.car_doors": { entity_id: "lock.car_doors", state: "locked", attributes: { friendly_name: "Leaf doors" } },
    },
  };
  ed.selectItem("furniture", "c");
  const closed = flat(ed.renderCarMain(ed.furnitureItem, true));
  assert.match(closed, /data-fold=car-found/);
  assert.match(closed, /Change what was found/);
  assert.doesNotMatch(closed, /fp3d-found-toggle|>Done</);
  panelUi(ed, "c").found = true;
  assert.match(flat(ed.renderCarMain(ed.furnitureItem, true)), /aria-expanded=true aria-controls=fp3d-fold-car-found/);
});

test("Tap, Hold and Double tap sit behind one 'Taps: Default' row (#413, MANY-6)", async () => {
  resetFolds();
  const ed = await makeEditor([square("r", 0, 0, 4, 4)], [item("s", "sofa")]);
  ed.selectItem("furniture", "s");
  const p = itemProfile("sofa");
  setFoldOpen(p, "taps", true, panelUi(ed, "s").folds);
  const closed = flat(ed.renderFurnitureForm(ed.furnitureItem));
  assert.match(closed, /data-fold=taps-gestures/);
  assert.match(closed, /Taps<\/span>[\s\S]*Default/);
  assert.doesNotMatch(closed, /data-gesture/);
  setSideFold(ed, "taps-gestures:s", true);
  const open = flat(ed.renderFurnitureForm(ed.furnitureItem));
  for (const g of ["tap", "hold", "double_tap"]) assert.match(open, new RegExp(`data-gesture=${g}`), g);
  resetFolds();
});

test("no side panel source draws a <details> any more (#413)", () => {
  const files = ["rooms.ts", "walls.ts", "openings.ts", "side-panel.ts", "device-panel.ts", "floors.ts", "outdoor-find.ts", "racks.ts"];
  for (const f of files) assert.doesNotMatch(readFileSync(new URL(`./editor/${f}`, import.meta.url), "utf8"), /<details/, f);
  // Settings: only the Settings page's own topics keep theirs; the floor page's Presence is a fold
  const settings = readFileSync(new URL("./editor/settings.ts", import.meta.url), "utf8");
  assert.match(settings, /this\.sideFold\("presence"/);
});
