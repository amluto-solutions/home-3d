// Tapping a rack in the 2D view (#115): a sheet shows the rack's front view with its gear, readable on a wall tablet.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Furniture } from "../model.ts";
import { setPacks, type FurniturePack, type PackItem } from "../packs.ts";
import { rackDraw } from "../plan2d/scene.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any> } };

const NETWORK = new URL("../../../custom_components/home_3d/bundled_packs/amluto.it/network/", import.meta.url);
const read = (id: string): PackItem => JSON.parse(readFileSync(new URL(`${id}.json`, NETWORK), "utf8"));
const PACK = { id: "amluto.it", name: "IT", publisher: "t", items: ["rack_wall_cabinet_9u", "rack_switch_24_1u"].map(read) } as unknown as FurniturePack;

const flat = (v: unknown): string => {
  if (v == null || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return String(v);
};

function viewer(): Record<string, any> {
  setPacks([PACK]);
  const el = new Fp3dView3d();
  el.hass = { language: "en", locale: { language: "en", number_format: "language" }, states: {}, config: { unit_system: {} } };
  const b = emptyBuilding();
  const floor = newFloor("g", "Ground", 0);
  const rack: Furniture = { id: "rack", type: "pack:amluto.it:rack_wall_cabinet_9u", name: "Hall rack", x: 1, z: 1, rotation: 0, w: 0.6, d: 0.45, h: 0.5, variant: null, rack: { slots: [{ id: "s1", type: "pack:amluto.it:rack_switch_24_1u", u: 2, name: "Core switch" }] } } as Furniture;
  floor.furniture = [rack];
  b.floors = [floor];
  el.building = b;
  return el;
}

test("a rack tapped in the plan opens a sheet with its front view; closing it hides the sheet (#115)", () => {
  const el = viewer();
  assert.equal(flat(el.renderRackView()), "");
  el.showRackView("rack", rackDraw(el.building.floors[0], "rack"));
  const sheet = flat(el.renderRackView());
  assert.match(sheet, /role="dialog"/);
  assert.match(sheet, /Hall rack/);
  assert.match(sheet, /1 of 9U used/);
  const view = el.rackViewOf();
  assert.match(view.svg, /Core switch/);
  // built once while the sheet stays open
  assert.equal(el.rackViewOf(), view);
  el.closeRackView();
  assert.equal(flat(el.renderRackView()), "");
});

test("a sheet whose rack is gone shows nothing (#115)", () => {
  const el = viewer();
  // the rack was deleted while its sheet was open
  el.showRackView("nope", rackDraw(el.building.floors[0], "rack"));
  assert.equal(flat(el.renderRackView()), "");
});

// ------------------------------------------------------------------------------------------------ #119

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes });

function linked(): Record<string, any> {
  const el = viewer();
  const rack = el.building.floors[0].furniture[0];
  rack.rack.slots = [
    { id: "s1", type: "pack:amluto.it:rack_switch_24_1u", u: 2, name: "Core switch", entity: "binary_sensor.switch_status", links: ["sensor.switch_temperature"] },
    { id: "s2", type: "pack:amluto.it:rack_switch_24_1u", u: 4, name: "Spare switch" },
  ];
  el.hass = {
    ...el.hass,
    states: { "binary_sensor.switch_status": st("binary_sensor.switch_status", "on", { device_class: "connectivity", friendly_name: "Switch status" }), "sensor.switch_temperature": st("sensor.switch_temperature", "41", { unit_of_measurement: "°C", friendly_name: "Switch temperature" }) },
  };
  return el;
}

test("the front view shows linked gear's status LED and follows its state (#119)", () => {
  const el = linked();
  el.showRackView("rack", rackDraw(el.building.floors[0], "rack"));
  assert.match(el.rackViewOf().svg, /fp3d-el-led-online[^>]*data-slot="s1"/);
  assert.doesNotMatch(el.rackViewOf().svg, /data-slot="s2"[^>]*fp3d-el-led|fp3d-el-led[^>]*data-slot="s2"/);
  el.hass = { ...el.hass, states: { ...el.hass.states, "binary_sensor.switch_status": st("binary_sensor.switch_status", "off", { device_class: "connectivity" }) } };
  assert.match(el.rackViewOf().svg, /fp3d-el-led-offline[^>]*data-slot="s1"/);
});

test("tapping gear (in 3D or in the front view) shows its details: status and linked entities to open (#119)", () => {
  const el = linked();
  el.showRackView("rack", rackDraw(el.building.floors[0], "rack"), "s1");
  const sheet = flat(el.renderRackView());
  assert.match(sheet, /fp3d-rack-detail/);
  assert.match(sheet, /Core switch/);
  assert.match(sheet, /Online/);
  assert.match(sheet, /Switch status/);
  assert.match(sheet, /Switch temperature/);
  assert.match(sheet, /41/);
  // read-only: no pickers in the viewer, whoever looks
  assert.doesNotMatch(sheet, /fp3d-entity-picker|<select|<input/);
  // a tap on a linked entity opens HA's more-info
  const sent: string[] = [];
  el.dispatchEvent = (e: CustomEvent) => (sent.push(`${e.type}:${e.detail?.entityId}`), true);
  el.openRackEntity("sensor.switch_temperature");
  assert.deepEqual(sent, ["hass-more-info:sensor.switch_temperature"]);
  // a tap on other gear in the drawing chooses it; unlinked gear says so
  el.tapRackDrawing("s2");
  assert.match(flat(el.renderRackView()), /Spare switch[\s\S]*Not linked/);
});
