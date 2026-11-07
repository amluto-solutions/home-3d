// The item panel by kind (#396 quick wins, #397 option A): vehicle routing, kind profiles, fold summaries and badges,
// accessible names on pickers, the constant "Lock position", the header and the slim navigation row.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { setPacks, type FurniturePack } from "../packs.ts";
import { itemProfile } from "../item-profile.ts";
import { EntityPicker } from "./entity-picker.ts";
import { panelUi, resetFolds, setFoldOpen } from "./editor/item-sections.ts";
import { makeEditor, square } from "./editor-harness.ts";

const PACK: FurniturePack = {
  id: "demo.cars",
  name: "Cars",
  publisher: "Demo",
  items: [
    { id: "leaf", name: { en: "Demo Leaf" }, size: [1.8, 4.5, 1.5], vehicle: true, electric: true, parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0.2, h: 0.4, color: "paint" }] },
    { id: "couch", name: { en: "Demo couch" }, size: [2, 0.9, 0.8], family: "fabric_sofa", tags: ["sofa"], parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 0.4, color: "fabric" }] },
    { id: "bedframe", name: { en: "Demo bed" }, size: [1.5, 2, 0.9], family: "wooden_bed", tags: ["bed"], parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 0.4, color: "wood" }] },
    { id: "raised", name: { en: "Raised bed" }, size: [1.2, 0.6, 0.3], family: "raised_bed", tags: ["bed", "garden"], parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 0.3, color: "wood" }] },
  ],
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
const st = (id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id: id, state, attributes: { friendly_name: id, ...attributes } });

/** A car with its device's entities: battery, charger power (3.6 kW), cable and a tracker. */
function carHass() {
  const ids = ["sensor.demo_car_battery", "sensor.demo_car_charge_power", "binary_sensor.demo_car_plug", "device_tracker.demo_car"];
  return {
    states: {
      "sensor.demo_car_battery": st("sensor.demo_car_battery", "78", { device_class: "battery", unit_of_measurement: "%", friendly_name: "Car battery" }),
      "sensor.demo_car_charge_power": st("sensor.demo_car_charge_power", "3.6", { unit_of_measurement: "kW", friendly_name: "Car charging power" }),
      "binary_sensor.demo_car_plug": st("binary_sensor.demo_car_plug", "on", { device_class: "plug" }),
      "device_tracker.demo_car": st("device_tracker.demo_car", "home"),
      "sensor.demo_charger_power": st("sensor.demo_charger_power", "3600", { unit_of_measurement: "W", device_class: "power", friendly_name: "Charger power" }),
    },
    entities: Object.fromEntries(ids.map((id) => [id, { entity_id: id, device_id: "car_device" }])),
    devices: {},
    areas: {},
    user: { is_admin: true },
    language: "en",
    locale: { language: "en" },
  };
}

async function editorWith(f: Furniture, hass: Record<string, unknown> = { states: {}, entities: {}, devices: {}, areas: {}, user: { is_admin: true }, language: "en", locale: { language: "en" } }) {
  const ed = await makeEditor([{ ...square("r", 0, 0, 6, 6), name: "Garage" }], [f]);
  ed.packs = [PACK];
  ed.hass = hass;
  ed.selectItem("furniture", f.id);
  return ed;
}

test("kind profiles: a car, a sofa, a lamp and a bed get their own sections and folds (#397)", () => {
  const car = itemProfile("pack:demo.cars:leaf");
  assert.equal(car.kind, "car");
  assert.equal(car.main, "car");
  assert.deepEqual(car.folds, ["appearance", "size", "energy", "taps", "more"]);
  assert.equal(car.mirror, false, "no Mirror on a car");
  assert.equal(car.secondState, false);
  assert.equal(car.consumable, false, "no consumable on a car");
  assert.equal(car.confirm, false, "no Ask before switching on a car");

  for (const type of ["sofa", "pack:demo.cars:couch"]) {
    const sofa = itemProfile(type);
    assert.equal(sofa.kind, "seating", type);
    assert.equal(sofa.main, null);
    assert.deepEqual(sofa.folds, ["appearance", "size", "glow", "taps", "more"]);
    assert.equal(sofa.openFirst, "appearance", "a sofa opens Appearance first");
    assert.equal(sofa.secondState, true, "a sofa has two halves too (#414)");
  }

  const lamp = itemProfile("lamp_floor");
  assert.equal(lamp.kind, "lamp");
  assert.equal(lamp.main, "lamp");
  assert.ok(!lamp.folds.includes("energy") && !lamp.folds.includes("glow"));
  assert.equal(lamp.mirror, false);

  for (const type of ["bed", "bunk_bed", "pack:demo.cars:bedframe"]) {
    const bed = itemProfile(type);
    assert.equal(bed.kind, "bed", type);
    assert.equal(bed.secondState, true);
    assert.ok(bed.folds.includes("glow"));
  }
  assert.notEqual(itemProfile("pack:demo.cars:raised").kind, "bed", "a raised garden bed is no bed");

  assert.equal(itemProfile("tv_wall").kind, "screen");
  assert.ok(itemProfile("tv_wall").folds.includes("screen"));
  assert.equal(itemProfile("washer").kind, "appliance");
  assert.equal(itemProfile("washer").consumable, true);
  assert.equal(itemProfile("parking").main, "parking");
  assert.equal(itemProfile("rug").folds.includes("glow"), false, "a rug links nothing that glows");
});

test("a vehicle item gets the car form, not the appliance form, and no appliance-only fields (#396 win 1)", async () => {
  resetFolds();
  const ed = await editorWith(item("c", "pack:demo.cars:leaf", { entity: "sensor.demo_car_battery", w: 1.8, d: 4.5, h: 1.5 }), carHass());
  const p = itemProfile("pack:demo.cars:leaf");
  for (const fold of p.folds) setFoldOpen(p, fold, true, panelUi(ed, "c").folds);
  const form = flat(ed.renderFurnitureForm(ed.furnitureItem));
  assert.match(form, /fp3d-car-main/);
  assert.match(form, /Car device/);
  assert.match(form, /Change what was found/);
  // what was found beside the battery, read-only
  for (const role of ["Charge \\(%\\)", "Charging", "Cable plugged in", "Location"]) assert.match(form, new RegExp(`<dt>${role}`), role);
  // what was not found is in "Add a reading", not in "Not found" rows (#415)
  for (const role of ["Range", "Lock", "Climate"]) assert.doesNotMatch(form, new RegExp(`<dt>${role}`), role);
  assert.match(form, /4 readings/);
  for (const gone of ["Mirror", "Second half", "Ask before switching", "Consumable", "hh_service", "Select several", "FURNITURE"]) assert.ok(!form.includes(gone), `no ${gone} on a car`);
  // the role pickers only after "Change what was found"
  assert.doesNotMatch(form, /Location \(device_tracker\)<fp3d-entity-picker/);
  resetFolds();
});

test("the header names the item, its kind and room; the live state shows for a linked car (#396 win 2, #397)", async () => {
  resetFolds();
  const ed = await editorWith(item("c", "pack:demo.cars:leaf", { entity: "sensor.demo_car_battery" }), carHass());
  const form = flat(ed.renderFurnitureForm(ed.furnitureItem));
  assert.match(form, /<h2>Demo Leaf<\/h2>/);
  assert.match(form, /Car · Garage/);
  assert.match(form, /Charging 3\.6 kW/);
  assert.match(form, /78 %/);
  assert.doesNotMatch(form, /<h3>Furniture<\/h3>/);
});

test("closed folds show their set values and an N set badge, and render no body (#396 win 13)", async () => {
  resetFolds();
  const ed = await editorWith(item("c", "pack:demo.cars:leaf", { entity: "sensor.demo_car_battery", power: "sensor.demo_charger_power" }), carHass());
  const form = flat(ed.renderFurnitureForm(ed.furnitureItem));
  const energy = form.slice(form.indexOf("data-fold=energy"), form.indexOf("data-fold=taps"));
  assert.match(energy, /aria-expanded=false/);
  assert.match(energy, /Energy/);
  assert.match(energy, /1 set/);
  assert.match(energy, /Charger power/);
  assert.match(energy, /3600 W now/);
  assert.doesNotMatch(form, /Fuse circuit/, "a closed fold renders nothing of its body");
  // opened (for this selection, #407), the fields are there and the summary steps aside
  setFoldOpen(itemProfile("pack:demo.cars:leaf"), "energy", true, panelUi(ed, "c").folds);
  const open = flat(ed.renderFurnitureForm(ed.furnitureItem));
  assert.match(open, /Fuse circuit/);
  assert.match(open, /Counts as on above/);
  assert.match(open.slice(open.indexOf("data-fold=energy")), /aria-expanded=true/);
  // no circuit monitor in this home: no double-count warning
  assert.doesNotMatch(open, /counted twice/);
  resetFolds();
});

test("a sofa opens Appearance with one swatch per part; its other folds stay closed (#397)", async () => {
  resetFolds();
  const ed = await editorWith(item("s", "sofa", { w: 2.2, d: 0.9, h: 0.82 }));
  const form = flat(ed.renderFurnitureForm(ed.furnitureItem));
  const folds = [...form.matchAll(/data-fold=(\w+)/g)].map((m) => m[1]);
  assert.deepEqual(folds, ["appearance", "size", "glow", "taps", "more"]);
  assert.match(form, /Occupancy sensor/);
  assert.match(form, /Taps and visibility/);
  assert.match(form, /More options/);
  assert.match(form, /<fp3d-colour-field/, "Appearance is open: the colour fields show");
  // one row per part with its finish chip (#410); no select, no "Finishes and presets" toggle
  assert.equal((form.match(/class="fp3d-part-row"/g) ?? []).length, 3);
  assert.doesNotMatch(form, /Finishes and presets|Fewer colour options|class="fp3d-material"/);
  assert.doesNotMatch(form, /Glows when on\s*<fp3d-entity-picker/, "the occupancy fold is closed");
});

test("a lamp's main section is its light; a bed's occupancy fold offers the second half (#397, #396 win 8)", async () => {
  resetFolds();
  const lamp = await editorWith(item("l", "lamp_floor", { entity: "light.sample_lamp" }), {
    states: { "light.sample_lamp": st("light.sample_lamp", "on") },
    entities: {},
    devices: {},
    areas: {},
    user: { is_admin: true },
    language: "en",
    locale: { language: "en" },
  });
  const lf = flat(lamp.renderFurnitureForm(lamp.furnitureItem));
  assert.match(lf, /<h3 id="fp3d-main-h">Light<\/h3>/);
  assert.match(lf, /Lamp · Garage/);
  assert.doesNotMatch(lf, /data-fold=energy/);

  const bed = await editorWith(item("b", "bed", { state_entity: "binary_sensor.sample_bed_left" }));
  setFoldOpen(itemProfile("bed"), "glow", true, panelUi(bed, "b").folds);
  const bf = flat(bed.renderFurnitureForm(bed.furnitureItem));
  assert.match(bf, /Glows when on/);
  assert.match(bf, /Second half/);
  const chair = await editorWith(item("a", "armchair", { state_entity: "binary_sensor.sample_seat" }));
  setFoldOpen(itemProfile("armchair"), "glow", true, panelUi(chair, "a").folds);
  assert.doesNotMatch(flat(chair.renderFurnitureForm(chair.furnitureItem)), /Second half/, "Second half only for beds and sofas");
  resetFolds();
});

test("entity pickers and colour preset selects have accessible names (#396 win 4)", async () => {
  const p = new EntityPicker() as unknown as Record<string, any>;
  p.options = [{ id: "sensor.demo_car_battery", label: "Car battery" }];
  p.fixed = [{ id: "none", label: "None" }];
  p.value = "sensor.demo_car_battery";
  p.label = "Car (any entity of the car)";
  p.live = "78 %";
  const out = flat(p.render());
  assert.match(out, /aria-label=Car \(any entity of the car\)/);
  // the friendly name with its live value; the raw id on hover
  assert.match(out, /Car battery · 78 %/);
  assert.match(out, /title=sensor\.demo_car_battery/);

  resetFolds();
  const ed = await editorWith(item("c", "pack:demo.cars:leaf", { entity: "sensor.demo_car_battery" }), carHass());
  const form = flat(ed.renderFurnitureForm(ed.furnitureItem));
  // the picker gets its visible label as its name, and the live value of the chosen entity
  assert.match(form, /Car device\s*<fp3d-entity-picker[\s\S]*?\.label=Car device/);
  const sofa = await editorWith(item("s", "sofa"));
  // a part's finish chip and its popover's presets and finishes are named after the part (#410)
  sofa.togglePart(sofa.furnitureItem, "fabric");
  const parts = flat(sofa.renderFurnitureForm(sofa.furnitureItem));
  assert.match(parts, /aria-label=Finish of Fabric: Fabric/);
  assert.match(parts, /aria-label=Colours for Fabric/);
});

test("Lock position keeps one name, says its state by aria-pressed, and has no emoji (#396 win 6)", async () => {
  const ed = await editorWith(item("s", "sofa"));
  const before = flat(ed.lockPositionButton(ed.furnitureItem));
  assert.match(before, /aria-label=Lock position/);
  assert.match(before, /aria-pressed=false/);
  ed.toggleFixed("furniture", "s");
  const after = flat(ed.lockPositionButton(ed.furnitureItem));
  assert.match(after, /aria-label=Lock position/);
  assert.match(after, /aria-pressed=true/);
  for (const text of [before, after]) assert.doesNotMatch(text, /🔒|🔓|Fix|Release/);
});

test("turn buttons sit beside Turn; Rotate, Duplicate, Delete and Select several left the bottom of the form (#396 wins 7, 12)", async () => {
  resetFolds();
  const ed = await editorWith(item("s", "sofa"));
  const form = flat(ed.renderFurnitureForm(ed.furnitureItem));
  const pos = form.slice(form.indexOf("fp3d-item-pos"), form.indexOf("data-fold=appearance"));
  assert.match(pos, /aria-label=Turn left 90 degrees/);
  assert.match(pos, /aria-label=Turn right 90 degrees/);
  assert.match(pos, /Drag it on the plan to move it\. Drag the dot to turn it\./);
  assert.doesNotMatch(form, /fp3d-multi-toggle|Select several|↺ 90°/);
  // the header's "⋯" has the actions
  const s = (await import("./editor/item-sections.ts")).panelUi(ed, "s");
  s.menu = true;
  const menu = flat(ed.renderFurnitureForm(ed.furnitureItem));
  for (const label of ["Rename", "Duplicate", "Copy", "Wall view", "Delete"]) assert.match(menu, new RegExp(`role="menuitem"[^>]*><span>${label}`), label);
  assert.match(menu, /<kbd>Ctrl\+D<\/kbd>/);
  ed.rotateFurniture(90);
  assert.equal(ed.furnitureItem.rotation, 90);
});

test("one slim navigation row: '‹ room' and a collapse icon, not two full buttons (#396 win 3)", async () => {
  const ed = await editorWith(item("s", "sofa"));
  ed.selectItem("room", "r");
  ed.selectItem("furniture", "s");
  const row = flat(ed.renderPinRow());
  assert.match(row, /‹ Garage/);
  assert.match(row, /aria-label=Back to Garage/);
  assert.match(row, /fp3d-side-fold/);
  assert.doesNotMatch(row, /Collapse ›/);
  assert.doesNotMatch(flat(ed.renderSide(ed.floor)), /fp3d-btn fp3d-back/, "no second back button in the panel");
});

test("help opens by click (a button, so also by keyboard), at most one line shows under a field (#396 win 5)", async () => {
  resetFolds();
  const ed = await editorWith(item("s", "sofa"));
  setFoldOpen(itemProfile("sofa"), "more", true, panelUi(ed, "s").folds);
  const closed = flat(ed.renderFurnitureForm(ed.furnitureItem));
  assert.match(closed, /class="fp3d-info" aria-expanded=false[^>]*aria-label=More about Other names/);
  assert.doesNotMatch(closed, /title=Further names|so you ask for/);
  const s = (await import("./editor/item-sections.ts")).panelUi(ed, "s");
  s.help = "aliases_hint";
  const open = flat(ed.renderFurnitureForm(ed.furnitureItem));
  assert.match(open, /aria-expanded=true[^>]*aria-label=More about Other names/);
  assert.match(open, /so you ask for/);
  resetFolds();
});
