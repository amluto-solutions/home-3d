// The rack card (#120): a glass card over a rack with linked gear, with the chosen live values and sparklines.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Furniture } from "../model.ts";
import { setPacks, type FurniturePack, type PackItem } from "../packs.ts";

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

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}) => ({ entity_id, state, attributes });

/** A rack with a linked UPS and switch (generic ids). */
function linked(): Record<string, any> {
  const el = viewer();
  const rack = el.building.floors[0].furniture[0];
  rack.rack.slots = [
    { id: "s1", type: "pack:amluto.it:rack_switch_24_1u", u: 2, name: "Core switch", entity: "binary_sensor.switch_status", links: ["sensor.switch_temperature"] },
    { id: "s2", type: "pack:amluto.it:rack_switch_24_1u", u: 4, name: "UPS", entity: "sensor.ups_status", links: ["sensor.ups_load", "sensor.ups_battery_charge", "sensor.ups_battery_runtime"] },
  ];
  const states = [
    st("binary_sensor.switch_status", "on", { device_class: "connectivity" }),
    st("sensor.switch_temperature", "41.4", { unit_of_measurement: "°C", device_class: "temperature" }),
    st("sensor.ups_status", "OL"),
    st("sensor.ups_load", "23", { unit_of_measurement: "%" }),
    st("sensor.ups_battery_charge", "100", { unit_of_measurement: "%", device_class: "battery" }),
    st("sensor.ups_battery_runtime", "2400", { unit_of_measurement: "s", device_class: "duration" }),
  ];
  el.hass = { ...el.hass, states: Object.fromEntries(states.map((s) => [s.entity_id, s])), entities: {} };
  return el;
}

test("a rack with linked gear gets a card over its top with the default values; none without links or when switched off (#120)", () => {
  const el = linked();
  const [one, ...more] = el.rackHolos(el.hass, el.building);
  assert.equal(more.length, 0);
  assert.deepEqual(one.anchor.p.map((n: number) => +n.toFixed(2)), [1, 1.85, 1]);
  // (a wall cabinet: 1.2 m up the wall, 0.5 m tall, the card 15 cm above it)
  assert.equal(one.card.kind, "rack");
  assert.equal(one.card.name, "Hall rack");
  assert.deepEqual(one.card.rack.values.map((v: { key: string }) => v.key), ["sensor.ups_load", "sensor.ups_battery_charge", "sensor.ups_battery_runtime", "@hottest", "@online"]);
  // an empty pick: no card; the card option off: no cards
  el.building.floors[0].furniture[0].rack.card = { metrics: [] };
  assert.equal(el.rackHolos(el.hass, el.building).length, 0);
  el.building.floors[0].furniture[0].rack.card = null;
  el.rackCards = false;
  assert.equal(el.rackHolos(el.hass, el.building).length, 0);
  assert.equal(viewer().rackHolos(el.hass, viewer().building).length, 0);
});

test("the rack card shows a few values folded and every value with its sparkline unfolded (#120)", () => {
  const el = linked();
  el._holos = el.rackHolos(el.hass, el.building).map((h: { card: unknown }) => h.card);
  const folded = flat(el.renderRackCard(el._holos[0], 0));
  assert.match(folded, /Hall rack/);
  assert.match(folded, /2\/2/);
  assert.match(folded, /23 %/);
  assert.doesNotMatch(folded, /fp3d-holo-spark/);
  el.toggleRackCard("rack");
  el._rackRows = { "sensor.ups_load": [{ start: 1, mean: 20 }, { start: 2, mean: 25 }] };
  const open = flat(el.renderRackCard(el._holos[0], 0));
  assert.match(open, /Load/);
  assert.match(open, /Battery/);
  assert.match(open, /100 %/);
  assert.match(open, /40 min/);
  assert.match(open, /41.4 °C/);
  assert.match(open, /Core switch/);
  assert.match(open, /fp3d-holo-spark/);
  // the sparklines' statistics are those of the unfolded cards only
  assert.deepEqual(el.rackSparkIds(), ["sensor.ups_load", "sensor.ups_battery_charge", "sensor.ups_battery_runtime", "sensor.switch_temperature"]);
  el.toggleRackCard("rack");
  assert.deepEqual(el.rackSparkIds(), []);
});
