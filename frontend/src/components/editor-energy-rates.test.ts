// Settings > Energy, rates and costs (#323): set up here (the default) or Home Assistant's existing sensors.

import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_ENERGY, emptyBuilding, type Building } from "../model.ts";
import type { HomeAssistant } from "../types.ts";

for (const name of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${name}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dEditor } = await import("./editor.ts");

/** Every string and value of a lit template, flattened into one text. */
function flat(v: unknown): string {
  if (v == null || typeof v === "symbol" || typeof v === "function") return "";
  if (Array.isArray(v)) return v.map(flat).join("");
  if (typeof v === "object" && "strings" in (v as object)) {
    const t = v as { strings: readonly string[]; values: unknown[] };
    return t.strings.map((s, i) => s + (i < t.values.length ? flat(t.values[i]) : "")).join("");
  }
  return String(v);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function editor(energy: Partial<Building["energy"]>, ws: (msg: Record<string, unknown>) => unknown = () => ({})): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const el = new Fp3dEditor() as any;
  el.hass = {
    language: "en",
    user: { is_admin: true },
    states: { "select.sample_tariff": { entity_id: "select.sample_tariff", state: "peak", attributes: { options: ["peak", "offpeak"] } } },
    areas: {},
    config: { currency: "GBP" },
    callWS: async (msg: Record<string, unknown>) => ws(msg),
  } as unknown as HomeAssistant;
  el._doc = { ...emptyBuilding(), energy: { ...DEFAULT_ENERGY, ...energy } };
  return el;
}

test("an existing home keeps setting its rates up here: the cheap window is asked for, as before", () => {
  const out = flat(editor({ cheap_from: "23:00", cheap_to: "06:00" }).renderEnergyRates([], []));
  assert.match(out, /aria-pressed=true[^>]*>Set up rates here/);
  assert.match(out, /Cheap from/);
  assert.doesNotMatch(out, /Use Home Assistant's Energy dashboard setup/);
});

test("with existing sensors no rates are asked for: price, tariff entity with its cheap states, cost sensors", () => {
  const el = editor({ rates_from: "sensors", rate_entity: "select.sample_tariff", cost_sensors: ["sensor.sample_gone_cost"] });
  const out = flat(el.renderEnergyRates([], []));
  assert.match(out, /aria-pressed=true[^>]*>Use existing sensors/);
  assert.doesNotMatch(out, /Cheap from/);
  assert.match(out, /Use Home Assistant's Energy dashboard setup/);
  assert.match(out, /Current price/);
  assert.match(out, /Cheap rate when it is/);
  assert.match(out, /offpeak/);
  assert.match(out, /None ticked/);
  assert.match(out, /Not found or unavailable right now: sensor.sample_gone_cost|Not found or unavailable right now: .*gone/i);
});

test("switching to existing sensors takes the cheap rate entity along as the tariff entity", () => {
  const el = editor({ cheap_rate: "binary_sensor.sample_off_peak" });
  const out = el.renderEnergyRates([], []);
  // the second segment button switches
  const values = (function walk(v: unknown, found: unknown[] = []): unknown[] {
    if (Array.isArray(v)) v.forEach((x) => walk(x, found));
    else if (v && typeof v === "object" && "values" in (v as object)) walk((v as { values: unknown[] }).values, found);
    else if (typeof v === "function") found.push(v);
    return found;
  })(out);
  (values[1] as () => void)();
  assert.equal(el._doc.energy.rates_from, "sensors");
  assert.equal(el._doc.energy.rate_entity, "binary_sensor.sample_off_peak");
});

test("switching the mode keeps the other side's choices", () => {
  const el = editor({ cheap_from: "23:00", cheap_to: "06:00" });
  el.setEnergy({ rates_from: "sensors" });
  el.setEnergy({ rates_from: "here" });
  assert.equal(el._doc.energy.cheap_from, "23:00");
  assert.equal(el._doc.energy.rates_from, "here");
});

test("one tap takes the Energy dashboard's price and cost sources and switches to existing sensors", async () => {
  const el = editor({ tariff: null }, (msg) =>
    msg.type === "energy/get_prefs"
      ? { energy_sources: [{ type: "grid", flow_from: [{ stat_energy_from: "sensor.sample_import", stat_cost: null, entity_energy_price: "sensor.sample_price" }], flow_to: [] }] }
      : { cost_sensors: { "sensor.sample_import": "sensor.sample_import_cost" } },
  );
  await el.importRatePrefs();
  const e = el._doc.energy;
  assert.equal(e.rates_from, "sensors");
  assert.equal(e.tariff, "sensor.sample_price");
  assert.deepEqual(e.cost_sensors, ["sensor.sample_import_cost"]);
  assert.equal(el._energyNote, "Taken from the Energy dashboard – costs: sensor.sample_import_cost. Price: sensor.sample_price.");
});

test("an Energy dashboard without prices or costs changes nothing and says so; one that is not set up too", async () => {
  const el = editor({ cheap_from: "23:00" }, () => ({ energy_sources: [] }));
  await el.importRatePrefs();
  assert.equal(el._doc.energy.rates_from, undefined);
  assert.match(el._energyNote, /no price or costs/);
  const failing = editor({}, () => {
    throw new Error("not set up");
  });
  await failing.importRatePrefs();
  assert.equal(failing._doc.energy.rates_from, undefined);
  assert.match(failing._energyNote, /not set up/);
});

test("the Energy dashboard's flat grid layout: one cost statistic, no price; the note says to choose one (#323)", async () => {
  const grid = {
    type: "grid",
    name: "Grid",
    stat_energy_from: "sensor.sample_import_energy",
    stat_energy_to: "sensor.sample_export_energy",
    stat_cost: "sensor.sample_import_cost",
    entity_energy_price: null,
    number_energy_price: null,
    stat_compensation: null,
    entity_energy_price_export: null,
    number_energy_price_export: null,
    cost_adjustment_day: 0,
  };
  const el = editor({ tariff: "number.sample_price_now" }, (msg) => (msg.type === "energy/get_prefs" ? { energy_sources: [grid] } : { cost_sensors: {} }));
  await el.importRatePrefs();
  const e = el._doc.energy;
  assert.equal(e.rates_from, "sensors");
  assert.deepEqual([e.cost_sensors, e.earning_sensors, e.price_fixed], [["sensor.sample_import_cost"], [], null]);
  assert.equal(e.tariff, "number.sample_price_now", "the chosen price stays");
  assert.equal(el._energyNote, "Taken from the Energy dashboard – costs: sensor.sample_import_cost. It sets no price: choose one below.");
});

test("peak price + cheap price: two price fields, each an entity or a typed number (#323)", () => {
  const el = editor({ rates_from: "sensors", rate_entity: "binary_sensor.sample_cheap", price_mode: "split", price_peak: "input_number.sample_peak", price_cheap: 0.07 });
  const out = flat(el.renderEnergyRates([], []));
  assert.match(out, /aria-pressed=true[^>]*>Peak price \+ cheap price/);
  assert.match(out, /Peak price \(per kWh\)/);
  assert.match(out, /Cheap price \(per kWh\)/);
  assert.match(out, /or a fixed price/);
  assert.doesNotMatch(out, /Current price/);
});

test("many missing sensors: three names and how many more (#323)", () => {
  const ids = Array.from({ length: 7 }, (_, i) => `sensor.sample_${i}_energy_cost`);
  const out = flat(editor({ rates_from: "sensors", cost_sensors: ids }).renderEnergyRates([], []));
  assert.match(out, /Not found or unavailable right now: sensor.sample_0_energy_cost, sensor.sample_1_energy_cost, sensor.sample_2_energy_cost and 4 more/);
});
