import assert from "node:assert/strict";
import { test } from "node:test";
import { forecastCurvePath, forecastSplit, solarMoreRows, solarPrefsInfo, type SolarForecast } from "./solar-more.ts";

/** Local time ISO text of today (+days) at the given hour. */
function at(day: Date, plusDays: number, hour: number): string {
  const d = new Date(day);
  d.setDate(d.getDate() + plusDays);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

const NOW = (() => {
  const d = new Date(2026, 5, 15, 12, 30, 0);
  return d;
})();

test("the energy dashboard's solar, export and forecast sources are found, old and new grid layouts (#144)", () => {
  const info = solarPrefsInfo({
    energy_sources: [
      { type: "solar", stat_energy_from: "sensor.pv_a", config_entry_solar_forecast: ["fc1"] },
      { type: "solar", stat_energy_from: "sensor.pv_b", config_entry_solar_forecast: null },
      { type: "grid", flow_from: [{ stat_energy_from: "sensor.grid_in" }], flow_to: [{ stat_energy_to: "sensor.grid_out" }] },
      { type: "grid", stat_energy_to: "sensor.grid_out2" },
      { type: "battery", stat_energy_from: "sensor.bat_out", stat_energy_to: "sensor.bat_in" },
    ],
  });
  assert.deepEqual(info, { solar: ["sensor.pv_a", "sensor.pv_b"], export: ["sensor.grid_out", "sensor.grid_out2"], forecast: ["fc1"] });
  assert.deepEqual(solarPrefsInfo(null), { solar: [], export: [], forecast: [] });
});

test("the forecast is split into the rest of today and tomorrow, added up over the chosen forecasts (#144)", () => {
  const fc: SolarForecast = {
    a: { wh_hours: { [at(NOW, 0, 10)]: 1000, [at(NOW, 0, 12)]: 2000, [at(NOW, 0, 13)]: 1500, [at(NOW, 1, 12)]: 3000 } },
    b: { wh_hours: { [at(NOW, 0, 13)]: 500, [at(NOW, 1, 13)]: 1000, [at(NOW, 2, 12)]: 9999 } },
    ignored: { wh_hours: { [at(NOW, 0, 14)]: 99999 } },
  };
  const s = forecastSplit(fc, ["a", "b"], NOW)!;
  // half of 12:00's 2 kWh is left at 12:30, plus 13:00's 2 kWh
  assert.equal(s.rest, 3);
  assert.equal(s.tomorrow, 4);
  assert.equal(s.hours[10], 1000);
  assert.equal(s.hours[13], 2000);
  assert.equal(s.hours[14], 0);
});

test("no forecast integration or no data means no forecast at all (#144)", () => {
  assert.equal(forecastSplit(null, ["a"], NOW), null);
  assert.equal(forecastSplit({ a: { wh_hours: {} } }, [], NOW), null);
  assert.equal(forecastSplit({ a: { wh_hours: {} } }, ["a"], NOW), null);
  assert.equal(forecastSplit({}, ["a"], NOW), null);
});

test("a forecast without tomorrow's hours shows only the rest of today (#144)", () => {
  const s = forecastSplit({ a: { wh_hours: { [at(NOW, 0, 15)]: 800 } } }, ["a"], NOW)!;
  assert.equal(s.tomorrow, null);
  assert.deepEqual(solarMoreRows({ forecast: s, produced: null, exported: null }).map((r) => r.key), ["forecast_rest"]);
});

test("a forecast with only tomorrow's hours shows no rest of today (#144)", () => {
  const s = forecastSplit({ a: { wh_hours: { [at(NOW, 1, 12)]: 4000 } } }, ["a"], NOW)!;
  assert.equal(s.rest, null);
  assert.deepEqual(solarMoreRows({ forecast: s, produced: null, exported: null }), [{ key: "forecast_tomorrow", kwh: 4 }]);
});

test("rows show only what is known: forecast, tomorrow and self-use against export (#144)", () => {
  const forecast = { rest: 2.5, tomorrow: 11, hours: new Array(24).fill(0) };
  assert.deepEqual(solarMoreRows({ forecast, produced: 10, exported: 4 }), [
    { key: "forecast_rest", kwh: 2.5 },
    { key: "forecast_tomorrow", kwh: 11 },
    { key: "self_use", self: 6, exported: 4, share: 60 },
  ]);
  // no forecast integration: no forecast rows, never a placeholder
  assert.deepEqual(solarMoreRows({ forecast: null, produced: 10, exported: 4 }).map((r) => r.key), ["self_use"]);
  // no export statistic or nothing produced yet: no self-use row
  assert.deepEqual(solarMoreRows({ forecast: null, produced: 10, exported: null }), []);
  assert.deepEqual(solarMoreRows({ forecast: null, produced: 0, exported: 0 }), []);
  assert.deepEqual(solarMoreRows({ forecast: null, produced: null, exported: 3 }), []);
});

test("export read a moment later than production never makes self-use negative (#144)", () => {
  assert.deepEqual(solarMoreRows({ forecast: null, produced: 5, exported: 5.2 }), [{ key: "self_use", self: 0, exported: 5, share: 0 }]);
});

test("the forecast curve has a point per hour within the card's box (#144)", () => {
  const hours = new Array(24).fill(0);
  hours[12] = 3000;
  const path = forecastCurvePath(hours, 3000);
  assert.equal(path.split(/[ML]/).filter(Boolean).length, 24);
  assert.match(path, /^M4\.6 42\.0/);
  assert.match(path, /L114\.6 6\.0/);
});
