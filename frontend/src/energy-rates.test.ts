// Rates and costs from Home Assistant's existing sensors (#323).

import assert from "node:assert/strict";
import { test } from "node:test";
import { cheapRate, looksCheap, priceNow, ratesFromSensors, tariffStates } from "./cheap-rate.ts";
import { energySummary } from "./energy.ts";
import { costTile, fetchCostsToday, formatMoney, prefsRates, readsState } from "./energy-rates.ts";
import { DEFAULT_ENERGY, emptyBuilding, normalizeBuilding, type Building } from "./model.ts";
import type { HassEntity, HomeAssistant } from "./types.ts";

const st = (entity_id: string, state: string, attributes: Record<string, unknown> = {}): HassEntity => ({ entity_id, state, attributes });
const states = (...list: HassEntity[]) => Object.fromEntries(list.map((s) => [s.entity_id, s]));
const at = (h: number) => new Date(2026, 10, 3, h, 0);

test("a plan from before #323 sets its rates up itself: the window and the cheap rate entity keep working", () => {
  const old = normalizeBuilding({ ...emptyBuilding(), energy: { ...DEFAULT_ENERGY, cheap_from: "23:00", cheap_to: "06:00" } } as Building);
  assert.equal(old.energy.rates_from, undefined, "nothing is written into an older plan");
  assert.equal(ratesFromSensors(old.energy), false);
  assert.equal(cheapRate(old.energy, {}, at(2)), true);
  assert.equal(cheapRate(old.energy, {}, at(12)), false);
});

test("with existing sensors the window is not used, only Home Assistant's tariff entity", () => {
  const energy = { ...DEFAULT_ENERGY, rates_from: "sensors" as const, cheap_from: "00:00", cheap_to: "23:59", cheap_rate: "binary_sensor.sample_cheap" };
  assert.equal(cheapRate(energy, states(st("binary_sensor.sample_cheap", "on")), at(2)), null, "nothing chosen: no badge");
  const utility = { ...energy, rate_entity: "select.sample_tariff" };
  const tariff = (state: string) => states(st("select.sample_tariff", state, { options: ["peak", "offpeak"] }));
  assert.equal(cheapRate(utility, tariff("offpeak"), at(12)), true, "an off-peak tariff name is guessed as cheap");
  assert.equal(cheapRate(utility, tariff("peak"), at(2)), false);
  assert.equal(cheapRate(utility, tariff("unavailable"), at(2)), false, "unavailable is not cheap");
  assert.equal(cheapRate(utility, {}, at(2)), false, "a missing entity is not cheap");
  // the states picked win over the guess
  const picked = { ...utility, cheap_states: ["peak"] };
  assert.equal(cheapRate(picked, tariff("peak"), at(2)), true);
  assert.equal(cheapRate(picked, tariff("offpeak"), at(2)), false);
  // an on/off entity: on is cheap
  const binary = { ...energy, rate_entity: "binary_sensor.sample_off_peak" };
  assert.equal(cheapRate(binary, states(st("binary_sensor.sample_off_peak", "on")), at(12)), true);
  assert.equal(cheapRate(binary, states(st("binary_sensor.sample_off_peak", "off")), at(2)), false);
});

test("tariff names and states: off-peak, night, low and cheap read as the cheap rate; a select lists its options", () => {
  for (const s of ["offpeak", "Off-Peak", "off_peak", "night", "Night rate", "low", "cheap", "economy7"]) assert.ok(looksCheap(s), s);
  for (const s of ["peak", "day", "standard", "high"]) assert.ok(!looksCheap(s), s);
  assert.deepEqual(tariffStates(st("select.t", "day", { options: ["day", "night"] })), ["day", "night"]);
  assert.deepEqual(tariffStates(st("sensor.t", "Peak")), ["Peak"]);
  assert.deepEqual(tariffStates(st("sensor.t", "unavailable")), []);
  assert.deepEqual(tariffStates(undefined), []);
});

test("the Energy dashboard's grid: cost statistics, Home Assistant's own cost sensors, earnings and the price", () => {
  const prefs = {
    energy_sources: [
      { type: "solar", stat_energy_from: "sensor.sample_pv" },
      {
        type: "grid",
        flow_from: [
          { stat_energy_from: "sensor.sample_import_day", stat_cost: null, entity_energy_price: "sensor.sample_price", number_energy_price: null },
          { stat_energy_from: "sensor.sample_import_night", stat_cost: "sensor.sample_night_cost", entity_energy_price: null, number_energy_price: null },
        ],
        flow_to: [{ stat_energy_to: "sensor.sample_export", stat_compensation: null, entity_energy_price: null, number_energy_price: 0.15 }],
      },
    ],
  };
  const info = { cost_sensors: { "sensor.sample_import_day": "sensor.sample_import_day_cost", "sensor.sample_export": "sensor.sample_export_compensation" } };
  assert.deepEqual(prefsRates(prefs, info), {
    tariff: "sensor.sample_price",
    price_fixed: null,
    cost_sensors: ["sensor.sample_import_day_cost", "sensor.sample_night_cost"],
    earning_sensors: ["sensor.sample_export_compensation"],
  });
  // a fixed price only, a grid that is the flow itself, and no energy/info
  const flat = { energy_sources: [{ type: "grid", stat_energy_from: "sensor.sample_import", stat_cost: "octopus:sample_cost", number_energy_price: 0.28 }] };
  assert.deepEqual(prefsRates(flat, null), { tariff: null, price_fixed: 0.28, cost_sensors: ["octopus:sample_cost"], earning_sensors: [] });
  assert.deepEqual(prefsRates(null, null), { tariff: null, price_fixed: null, cost_sensors: [], earning_sensors: [] });
  assert.deepEqual(prefsRates({ energy_sources: [{ type: "grid", flow_from: [{ stat_energy_from: "sensor.sample_import" }] }] }, {}).cost_sensors, []);
});

/** A Home Assistant with these states whose statistics answer with `rows`. */
function hassWith(list: HassEntity[], rows: Record<string, { change: number; state?: number }[]>, calls: Record<string, unknown>[] = []): HomeAssistant {
  return {
    language: "en",
    states: states(...list),
    config: { currency: "GBP" },
    callWS: async (msg: Record<string, unknown>) => {
      calls.push(msg);
      return rows;
    },
  } as unknown as HomeAssistant;
}

test("today's cost: counters from the short-term statistics, a 'cost today' sensor by its state, earnings taken off", async () => {
  const calls: Record<string, unknown>[] = [];
  const hass = hassWith(
    [
      st("sensor.sample_import_cost", "412.5", { state_class: "total_increasing", unit_of_measurement: "GBP", device_class: "monetary" }),
      st("sensor.sample_daily_cost", "1.10", { unit_of_measurement: "GBP" }),
      st("sensor.sample_export_compensation", "30", { state_class: "total", unit_of_measurement: "GBP" }),
    ],
    { "sensor.sample_import_cost": [{ change: 0.5 }, { change: 0.25 }], "sensor.sample_export_compensation": [{ change: 0.4 }], "octopus:sample_cost": [{ change: 1 }] },
    calls,
  );
  const got = await fetchCostsToday(hass, { cost_sensors: ["sensor.sample_import_cost", "sensor.sample_daily_cost", "octopus:sample_cost"], earning_sensors: ["sensor.sample_export_compensation"] });
  assert.deepEqual(got, { cost: 2.85, earned: 0.4, unit: "GBP" });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].period, "5minute");
  assert.deepEqual(calls[0].statistic_ids, ["sensor.sample_import_cost", "octopus:sample_cost", "sensor.sample_export_compensation"]);
  assert.deepEqual(costTile(hass, got!), { net: true, value: "£2.45" });
});

test("today's cost: unavailable sensors are left out, nothing readable is no tile, a failed fetch is no tile", async () => {
  const hass = hassWith([st("sensor.sample_daily_cost", "unavailable", { unit_of_measurement: "GBP" })], {});
  assert.equal(await fetchCostsToday(hass, { cost_sensors: ["sensor.sample_daily_cost"] }), null);
  assert.equal(await fetchCostsToday(hass, { cost_sensors: [], earning_sensors: [] }), null);
  const failing = { ...hass, callWS: async () => Promise.reject(new Error("no recorder")) } as unknown as HomeAssistant;
  assert.equal(await fetchCostsToday(failing, { cost_sensors: ["external:sample_cost"] }), null);
  const mixed = hassWith([st("sensor.sample_daily_cost", "unavailable"), st("sensor.sample_other_cost", "0.8")], {});
  assert.deepEqual(await fetchCostsToday(mixed, { cost_sensors: ["sensor.sample_daily_cost", "sensor.sample_other_cost"] }), { cost: 0.8, earned: null, unit: "GBP" });
});

test("money is written as the language writes the currency, a symbol in front, anything else after", () => {
  const hass = { language: "en" } as HomeAssistant;
  assert.equal(formatMoney(hass, 1.5, "GBP"), "£1.50");
  assert.equal(formatMoney(hass, 1.5, "£"), "£1.50");
  assert.equal(formatMoney(hass, -0.4, "£"), "-£0.40");
  assert.equal(formatMoney(hass, 2, "ct"), "2.00 ct");
  assert.equal(costTile(hass, { cost: 1.234, earned: null, unit: "GBP" }).net, false);
});

test("the tariff tile: the price sensor, else with existing sensors the Energy dashboard's fixed price; unavailable shows none", () => {
  const b = emptyBuilding();
  const hass = (list: HassEntity[]) => ({ language: "en", states: states(...list), config: { currency: "GBP" } }) as unknown as HomeAssistant;
  b.energy = { ...b.energy, rates_from: "sensors", price_fixed: 0.245 };
  assert.deepEqual(energySummary(hass([]), b, []).tariff, { value: 0.245, unit: "GBP/kWh" });
  b.energy = { ...b.energy, tariff: "sensor.sample_price" };
  assert.deepEqual(energySummary(hass([st("sensor.sample_price", "0.3", { unit_of_measurement: "GBP/kWh" })]), b, []).tariff, { value: 0.3, unit: "GBP/kWh" });
  assert.equal(energySummary(hass([st("sensor.sample_price", "unavailable")]), b, []).tariff, null);
  // set up here: no fixed price is shown
  b.energy = { ...b.energy, tariff: null, rates_from: "here" };
  assert.equal(energySummary(hass([]), b, []).tariff, null);
});

test("the Energy dashboard's flat grid layout (no flow lists, energy/info without cost sensors): one cost, no price (#323)", () => {
  const grid = {
    type: "grid",
    stat_energy_from: "sensor.sample_import_energy",
    stat_energy_to: "sensor.sample_export_energy",
    stat_cost: "sensor.sample_import_cost",
    entity_energy_price: null,
    number_energy_price: null,
    stat_compensation: null,
  };
  assert.deepEqual(prefsRates({ energy_sources: [grid] }, { cost_sensors: {} }), { tariff: null, price_fixed: null, cost_sensors: ["sensor.sample_import_cost"], earning_sensors: [] });
});

test("which cost sensors are read by their state: daily ones by name or last_reset, and anything that is no counter", () => {
  const hass = (s: HassEntity) => ({ states: states(s) }) as unknown as HomeAssistant;
  const total = { state_class: "total", unit_of_measurement: "GBP" };
  assert.equal(readsState(hass(st("sensor.sample_cost_today", "1.2", total)), "sensor.sample_cost_today"), true);
  assert.equal(readsState(hass(st("sensor.sample_cost_daily", "1.2", total)), "sensor.sample_cost_daily"), true);
  assert.equal(readsState(hass(st("sensor.sample_x", "1.2", { ...total, friendly_name: "Electricity cost day" })), "sensor.sample_x"), true);
  assert.equal(readsState(hass(st("sensor.sample_x", "1.2", { ...total, last_reset: "2026-11-03T00:00:00+00:00" })), "sensor.sample_x"), true);
  assert.equal(readsState(hass(st("sensor.sample_import_cost", "412", total)), "sensor.sample_import_cost"), false);
  assert.equal(readsState(hass(st("sensor.sample_import_cost", "412", { state_class: "total_increasing" })), "sensor.sample_import_cost"), false);
  assert.equal(readsState(hass(st("sensor.sample_holiday_cost", "4", { state_class: "measurement" })), "sensor.sample_holiday_cost"), true);
  assert.equal(readsState(hass(st("sensor.sample_import_cost", "412", total)), "external:sample_cost"), false);
});

test("today's cost: a daily 'total' sensor by its state, a cumulative one by its change since midnight (#323)", async () => {
  const calls: Record<string, unknown>[] = [];
  const hass = hassWith(
    [
      st("sensor.sample_cost_today", "2.10", { state_class: "total", unit_of_measurement: "GBP" }),
      st("sensor.sample_import_cost", "640.5", { state_class: "total", unit_of_measurement: "GBP" }),
    ],
    { "sensor.sample_import_cost": [{ change: 0.6, state: 639.9 }, { change: 0.6, state: 640.5 }] },
    calls,
  );
  assert.deepEqual(await fetchCostsToday(hass, { cost_sensors: ["sensor.sample_cost_today"] }), { cost: 2.1, earned: null, unit: "GBP" });
  assert.equal(calls.length, 0, "a daily sensor needs no statistics");
  assert.deepEqual(await fetchCostsToday(hass, { cost_sensors: ["sensor.sample_import_cost"] }), { cost: 1.2, earned: null, unit: "GBP" });
  assert.deepEqual(calls[0].types, ["change", "state"]);
});

test("today's cost: a counter whose statistics fall to under half since midnight started again, so its state counts (#323)", async () => {
  const hass = hassWith(
    [st("sensor.sample_cost_counter", "0.90", { state_class: "total", unit_of_measurement: "GBP" })],
    { "sensor.sample_cost_counter": [{ change: 0.2, state: 3.4 }, { change: -3.4, state: 0 }, { change: 0.9, state: 0.9 }] },
  );
  assert.deepEqual(await fetchCostsToday(hass, { cost_sensors: ["sensor.sample_cost_counter"] }), { cost: 0.9, earned: null, unit: "GBP" });
});

test("peak price + cheap price: the tariff entity picks one; each is an entity or a typed number (#323)", () => {
  const energy = { ...DEFAULT_ENERGY, rates_from: "sensors" as const, price_mode: "split" as const, rate_entity: "binary_sensor.sample_cheap", price_peak: "input_number.sample_peak", price_cheap: 0.07 };
  const peak = st("input_number.sample_peak", "0.2745", { unit_of_measurement: "GBP/kWh" });
  assert.deepEqual(priceNow(energy, states(peak, st("binary_sensor.sample_cheap", "off")), "GBP"), { value: 0.2745, unit: "GBP/kWh" });
  assert.deepEqual(priceNow(energy, states(peak, st("binary_sensor.sample_cheap", "on")), "GBP"), { value: 0.07, unit: "GBP/kWh" });
  assert.deepEqual(priceNow(energy, states(peak), "GBP"), { value: 0.2745, unit: "GBP/kWh" }, "a missing tariff entity: peak");
  assert.equal(priceNow({ ...energy, price_cheap: "input_number.sample_gone" }, states(st("binary_sensor.sample_cheap", "on")), "GBP"), null);
  // a number entity without a unit as the one price
  const one = { ...DEFAULT_ENERGY, rates_from: "sensors" as const, tariff: "number.sample_price_now" };
  assert.deepEqual(priceNow(one, states(st("number.sample_price_now", "0.25")), "GBP"), { value: 0.25, unit: "GBP/kWh" });
});
