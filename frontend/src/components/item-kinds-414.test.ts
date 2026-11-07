// #414 (WORD-4, WORD-6, WORD-7, MANY-8): item kinds for cameras, sensors, heating, network, printers, kitchen units and
// floor openings. Each kind has its own kind line and main link, and leaves out the fields that cannot apply.

import assert from "node:assert/strict";
import { test } from "node:test";
import type { Furniture } from "../model.ts";
import { setPacks, type FurniturePack } from "../packs.ts";
import { hasOnOffState, itemProfile } from "../item-profile.ts";
import { linkField } from "../furniture-links.ts";
import { itemFolds } from "./editor/item-folds.ts";
import { panelUi, resetFolds, setFoldOpen } from "./editor/item-sections.ts";
import { makeEditor, square } from "./editor-harness.ts";

const part = { shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "white" };
const PACK: FurniturePack = {
  id: "demo.dev",
  name: "Devices",
  publisher: "Demo",
  items: [
    { id: "cam", name: { en: "Demo camera" }, size: [0.1, 0.2, 0.1], group: "tech", family: "unifi_camera", tags: ["camera"], electric: true, parts: [part] },
    { id: "smoke", name: { en: "Demo smoke alarm" }, size: [0.12, 0.12, 0.04], group: "tech", family: "smoke_alarm", tags: ["smoke alarm"], electric: true, parts: [part] },
    { id: "trv", name: { en: "Demo radiator" }, size: [0.7, 0.1, 0.6], group: "heating", family: "radiator_trv", tags: ["radiator", "trv"], parts: [part] },
    { id: "stat", name: { en: "Demo thermostat" }, size: [0.09, 0.03, 0.09], group: "tech", family: "thermostat", tags: ["thermostat"], electric: true, parts: [part] },
    { id: "3d_printer", name: { en: "Demo printer" }, size: [0.4, 0.4, 0.5], group: "tech", family: "3d_printer", tags: ["3d printer"], electric: true, parts: [part] },
    { id: "rack", name: { en: "Demo rack" }, size: [0.6, 0.45, 0.6], group: "network", family: "network_rack", tags: ["server rack"], electric: true, parts: [part] },
    { id: "battery", name: { en: "Demo battery" }, size: [0.6, 0.2, 0.8], group: "energy", family: "home_battery", tags: ["home battery"], electric: true, parts: [part] },
    { id: "couch", name: { en: "Demo couch" }, size: [2, 0.9, 0.8], family: "fabric_sofa", tags: ["sofa"], parts: [part] },
  ],
} as unknown as FurniturePack;
setPacks([PACK]);
const T = (id: string) => `pack:demo.dev:${id}`;

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
const HASS = (states: Record<string, ReturnType<typeof st>> = {}) => ({ states, entities: {}, devices: {}, areas: {}, user: { is_admin: true }, language: "en", locale: { language: "en" } });

async function formOf(f: Furniture, open: string[] = [], hass = HASS()) {
  resetFolds();
  const ed = await makeEditor([{ ...square("r", 0, 0, 6, 6), name: "Office" }], [f]);
  ed.packs = [PACK];
  ed.hass = hass;
  ed.selectItem("furniture", f.id);
  const p = itemProfile(f.type);
  for (const fold of open) setFoldOpen(p, fold as never, true, panelUi(ed, f.id).folds);
  return flat(ed.renderFurnitureForm(ed.furnitureItem));
}

test("each kind has its own kind line instead of Device or Stairs (#414, WORD-7)", async () => {
  const lines: [string, string, string][] = [
    [T("cam"), "camera", "Camera"],
    [T("smoke"), "sensor", "Sensor"],
    [T("trv"), "heating", "Heating"],
    [T("stat"), "heating", "Heating"],
    ["ac_unit", "heating", "Heating"],
    [T("3d_printer"), "printer", "3D printer"],
    [T("rack"), "network", "Network"],
    ["kitchen", "kitchen", "Kitchen unit"],
    ["stairwell", "opening", "Floor opening"],
  ];
  for (const [type, kind, line] of lines) {
    assert.equal(itemProfile(type).kind, kind, type);
    // the header (#409) leaves the kind out of "kind · place" when the title is the kind already (a kitchen unit)
    assert.match(await formOf(item("i", type)), new RegExp(`${line} · Office|<h2>${line}</h2>\\s*<span class="fp3d-sub">Office</span>`), type);
  }
  assert.equal(itemProfile(T("battery")).kind, "energy", "a home battery stays an energy device");
  assert.equal(itemProfile("stairs").kind, "stairs", "stairs are still stairs");
  assert.equal(itemProfile("washer").kind, "appliance");
});

test("the main link is named after the kind; a kitchen unit has none (#414, WORD-6)", async () => {
  assert.equal(linkField(T("3d_printer")).label, "furn_entity_printer");
  assert.equal(linkField(T("rack")).label, "furn_entity_rack");
  assert.equal(linkField(T("battery")).label, "furn_entity_battery");
  assert.equal(linkField("home_battery").label, "furn_entity_battery");
  assert.equal(linkField(T("cam")).label, "furn_entity_camera");
  assert.equal(linkField(T("smoke")).label, "furn_entity_sensor");
  assert.equal(linkField(T("trv")).label, "furn_entity_climate");
  for (const [type, label] of [
    [T("3d_printer"), "3D printer"],
    [T("rack"), "Rack devices"],
    [T("battery"), "Home battery"],
  ]) {
    const form = await formOf(item("i", type));
    assert.match(form, new RegExp(`fp3d-main-h[\\s\\S]*${label}\\s*<fp3d-entity-picker`), type);
    assert.doesNotMatch(form, /Device \(switch, plug/, type);
  }
  const kitchen = await formOf(item("k", "kitchen"));
  assert.equal(itemProfile("kitchen").main, null);
  assert.doesNotMatch(kitchen, /fp3d-main-h/, "no main link on a kitchen unit");
  // one linked before keeps its link, so it can be changed or set to none
  assert.match(await formOf(item("k", "kitchen", { entity: "switch.sample_plinth" })), /fp3d-main-h/);
});

test("a floor opening shows Position, Size (width and depth) and the hole's help only (#414, MANY-8)", async () => {
  const p = itemProfile("stairwell");
  assert.deepEqual(p.folds, ["size"]);
  assert.equal(p.mirror, false);
  assert.equal(p.confirm, false);
  const form = await formOf(item("h", "stairwell", { w: 1, d: 2.5 }), ["size"]);
  assert.deepEqual([...form.matchAll(/data-fold=(\w+)/g)].map((m) => m[1]), ["size"]);
  assert.match(form, /A hole in this floor/);
  for (const gone of ["Mirror", "Taps and visibility", "More options", "Colour while active", "Appearance", "Show the name"]) assert.ok(!form.includes(gone), `no ${gone} on a floor opening`);
  const size = form.slice(form.indexOf("data-fold=size"));
  assert.equal((size.match(/<label/g) ?? []).length >= 2, true, "width and depth");
  // no Rename in the menu: there is no name field to open
  const ed = await makeEditor([square("r", 0, 0, 6, 6)], [item("h", "stairwell")]);
  ed.selectItem("furniture", "h");
  assert.ok(!ed.itemMenuActions(ed.furnitureItem, p).some((a: { label: string }) => a.label === "Rename"));
});

test("no power sensor, Ask before switching or consumable on a TRV radiator, a thermostat or a smoke alarm (#414, MANY-8)", async () => {
  for (const type of [T("trv"), T("stat"), T("smoke"), "radiator"]) {
    const p = itemProfile(type);
    assert.ok(!p.folds.includes("energy"), `${type}: no Energy fold`);
    assert.equal(p.confirm, false, `${type}: no Ask before switching`);
    assert.equal(p.consumable, false, `${type}: no consumable`);
    const form = await formOf(item("i", type), p.folds);
    for (const gone of ["Power sensor", "Ask before switching", "Consumable"]) assert.ok(!form.includes(gone), `${type}: no ${gone}`);
  }
  // a boiler-like heater and an air conditioner keep power and service; a printer keeps its consumable
  assert.ok(itemProfile("ac_unit").folds.includes("energy"));
  assert.equal(itemProfile("ac_unit").consumable, true);
  assert.equal(itemProfile(T("3d_printer")).consumable, true);
  // a power sensor set before stays in sight (never hide a link that is set)
  assert.deepEqual(itemFolds({ power: "sensor.sample_trv_power" }, itemProfile(T("trv"))), ["appearance", "size", "energy", "taps", "more"]);
  assert.deepEqual(itemFolds({ power: "sensor.sample_power" }, itemProfile("stairwell")), ["size"]);
  assert.deepEqual(itemFolds({ power: null }, itemProfile(T("trv"))), itemProfile(T("trv")).folds);
});

test("Glows when on warns for an entity without on and off; Second half only on beds and sofas (#414, WORD-4)", async () => {
  assert.equal(hasOnOffState(st("sensor.sample_temp", "20.5", { unit_of_measurement: "°C" }) as never), false);
  assert.equal(hasOnOffState(st("sensor.sample_count", "3") as never), false);
  assert.equal(hasOnOffState(st("sensor.sample_status", "printing") as never), true);
  assert.equal(hasOnOffState(st("binary_sensor.sample_seat", "off") as never), true);
  assert.equal(hasOnOffState(st("switch.sample_plug", "on") as never), true);
  assert.equal(hasOnOffState(st("input_number.sample_level", "4") as never), false);

  const temp = st("sensor.sample_temp", "20.5", { unit_of_measurement: "°C" });
  const warm = await formOf(item("s", "sofa", { state_entity: "sensor.sample_temp" }), ["glow"], HASS({ "sensor.sample_temp": temp }));
  assert.match(warm, /never on or off/);
  const seat = await formOf(item("s", "sofa", { state_entity: "binary_sensor.sample_seat" }), ["glow"], HASS({ "binary_sensor.sample_seat": st("binary_sensor.sample_seat", "on") }));
  assert.doesNotMatch(seat, /never on or off/);
  assert.match(seat, /Glows when on/);
  assert.match(seat, /Second half/, "a sofa offers the other half");
  assert.equal(itemProfile(T("couch")).secondState, true, "a pack sofa too");
  assert.equal(itemProfile("chair").secondState, false, "a chair has no halves");
  resetFolds();
});
