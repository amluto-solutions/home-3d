import assert from "node:assert/strict";
import { mock, test } from "node:test";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = (await import("./view3d.ts")) as unknown as { Fp3dView3d: { new (): Record<string, any>; styles: unknown } };

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

const css = (() => {
  const s = Fp3dView3d.styles as { cssText?: string } | { cssText?: string }[];
  return (Array.isArray(s) ? s : [s]).map((x) => x.cssText ?? "").join("\n");
})();

const MAIN = { kind: "main", name: "Solar", w: null, dayIds: [], battery: null };

/** Noon (local) of today + `days`, as the forecast's ISO key. */
function noon(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(12, 0, 0, 0);
  return d.toISOString();
}

/** A viewer with a solar plant; `prefs` is what the energy dashboard knows, `calls` records the websocket calls. */
function viewer(prefs: Record<string, unknown>, opts: { soc?: number | null } = {}) {
  const calls: string[] = [];
  const el = new Fp3dView3d();
  el.hass = {
    language: "en",
    locale: { language: "en", number_format: "language" },
    states: {},
    config: { unit_system: {} },
    callWS: async (msg: { type: string }) => {
      calls.push(msg.type);
      if (msg.type === "energy/get_prefs") return prefs;
      if (msg.type === "energy/solar_forecast") return { fc: { wh_hours: { [noon(0)]: 3000, [noon(1)]: 5000 } } };
      if (msg.type === "recorder/statistics_during_period") return { "sensor.pv": [{ change: 8 }], "sensor.out": [{ change: 2 }] };
      throw new Error(msg.type);
    },
  };
  el._energy = { consumption: 800, grid: -1200, solar: 2000, battery: opts.soc == null ? null : 0, soc: opts.soc ?? null, tariff: null };
  return { el, calls };
}

const card = (el: Record<string, any>) => flat(el.renderHoloCard(MAIN, 0, el._energy));
const cls = (el: Record<string, any>) => card(el).match(/class="(fp3d-holo [^"]*)"/)![1];
const settle = () => new Promise((r) => setTimeout(r, 0));

const FULL = {
  energy_sources: [
    { type: "solar", stat_energy_from: "sensor.pv", config_entry_solar_forecast: ["fc"] },
    { type: "grid", flow_to: [{ stat_energy_to: "sensor.out" }] },
  ],
};

test("a touch grows the solar card and a second touch shrinks it (#144)", async () => {
  const { el } = viewer(FULL);
  assert.doesNotMatch(cls(el), /fp3d-holo-grown/);
  el.holoPress = "touch";
  el.renderHoloCard(MAIN, 0, el._energy);
  el.growHolo(!el._holoBig, 0, true);
  assert.match(cls(el), /fp3d-holo-grown/);
  el.growHolo(false, 0);
  assert.doesNotMatch(cls(el), /fp3d-holo-grown/);
  clearTimeout(el.holoBigTimer);
  await settle();
});

test("a tapped solar card shrinks again by itself after a while (#144)", () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const { el } = viewer(FULL);
    el._solarMore = { at: Date.now(), prefs: { solar: [], export: [], forecast: [] }, forecast: null, change: null };
    el.growHolo(true, 0, true);
    assert.equal(el._holoBig, true);
    mock.timers.tick(19000);
    assert.equal(el._holoBig, true);
    mock.timers.tick(2000);
    assert.equal(el._holoBig, false);
  } finally {
    mock.timers.reset();
  }
});

test("the grown card shows the forecast, tomorrow and self-use against export; fetched only when it grows, once (#144)", async () => {
  const { el, calls } = viewer(FULL);
  card(el);
  assert.deepEqual(calls, [], "nothing is fetched for the small card");
  el.growHolo(true, 0);
  await settle();
  await settle();
  const out = card(el);
  assert.match(out, /Forecast tomorrow<\/span><b>5(\.0)? kWh/);
  assert.match(out, /Used at home today<\/span><b>6(\.0)? kWh/);
  assert.match(out, /Exported today<\/span><b>2(\.0)? kWh/);
  assert.match(out, /fp3d-holo-fc/, "the forecast curve");
  assert.deepEqual(calls.sort(), ["energy/get_prefs", "energy/solar_forecast", "recorder/statistics_during_period"]);
  // shrink and grow again: the cached figures are used
  el.growHolo(false, 0);
  el.growHolo(true, 0);
  await settle();
  assert.equal(calls.length, 3);
});

test("without a forecast integration or an export meter those rows are left out, never placeholders (#144)", async () => {
  const { el, calls } = viewer({ energy_sources: [{ type: "solar", stat_energy_from: "sensor.pv", config_entry_solar_forecast: null }] });
  el.growHolo(true, 0);
  await settle();
  await settle();
  const out = card(el);
  assert.doesNotMatch(out, /Forecast/);
  assert.doesNotMatch(out, /Used at home|Exported today/);
  assert.doesNotMatch(out, /fp3d-holo-more"/);
  assert.match(out, /Today <b>8(\.0)? kWh/, "today's yield from the production statistic");
  assert.ok(!calls.includes("energy/solar_forecast"));
});

test("the grown card shows the battery's charge when there is a battery, and none without (#144)", () => {
  const withBat = viewer(FULL, { soc: 64 }).el;
  withBat._holoBig = true;
  assert.match(card(withBat), /fp3d-holo-bat[\s\S]*64 %/);
  const without = viewer(FULL).el;
  without._holoBig = true;
  assert.doesNotMatch(card(without), /fp3d-holo-bat/);
});

test("a folded solar card shows everything while it is grown (#144)", () => {
  const { el } = viewer(FULL);
  el.holoFolded.add(0);
  assert.match(cls(el), /fp3d-holo-min/);
  el._holoBig = true;
  assert.doesNotMatch(cls(el), /fp3d-holo-min/);
});

test("the grown card overlays its neighbours and animates only when motion is welcome and not on the tablet level (#144)", () => {
  assert.match(css, /\.fp3d-holo-grown\s*\{[^}]*z-index: 6/);
  assert.match(css, /\.fp3d-holo-plain\.fp3d-holo-grown \.fp3d-holo-body\s*\{\s*animation: none/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.fp3d-holo-grown \.fp3d-holo-body\s*\{\s*animation: none/);
});
