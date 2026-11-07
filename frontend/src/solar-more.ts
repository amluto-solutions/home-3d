// The solar hologram's grown view (#144): what Home Assistant's energy dashboard knows beyond the live figures –
// the forecast (Forecast.Solar, Solcast … through `energy/solar_forecast`), and today's production and export
// statistics for self-use against export. Pure functions; the view fetches only when the card grows.

import type { EnergyPrefs } from "./energy.ts";

/** What the grown card needs from the energy dashboard's settings. */
export interface SolarPrefsInfo {
  /** Statistics of the solar production (kWh counters). */
  solar: string[];
  /** Statistics of what went to the grid (kWh counters). */
  export: string[];
  /** Config entries of the forecast integrations chosen for the solar sources. */
  forecast: string[];
}

/** The solar, export and forecast sources of the energy dashboard (older and newer grid layouts). */
export function solarPrefsInfo(prefs: EnergyPrefs | null): SolarPrefsInfo {
  const out: SolarPrefsInfo = { solar: [], export: [], forecast: [] };
  for (const s of prefs?.energy_sources ?? []) {
    if (s.type === "solar") {
      if (s.stat_energy_from) out.solar.push(s.stat_energy_from);
      for (const id of s.config_entry_solar_forecast ?? []) out.forecast.push(id);
    } else if (s.type === "grid") {
      for (const f of s.flow_to ?? []) if (f.stat_energy_to) out.export.push(f.stat_energy_to);
      if (s.stat_energy_to) out.export.push(s.stat_energy_to);
    }
  }
  return { solar: [...new Set(out.solar)], export: [...new Set(out.export)], forecast: [...new Set(out.forecast)] };
}

/** `energy/solar_forecast`: per config entry the forecast energy (Wh) per period, keyed by the period's start. */
export type SolarForecast = Record<string, { wh_hours?: Record<string, number> } | undefined>;

/** The forecast split up for the card: kWh for the rest of today and for tomorrow, and today's hourly mean power (W). */
export interface ForecastSplit {
  /** null when the forecast has no hours of today (only tomorrow's). */
  rest: number | null;
  tomorrow: number | null;
  /** 24 hourly means (W) of today, for the sparkline. */
  hours: number[];
}

/** The chosen forecasts added up per local hour, split into the rest of today and tomorrow (null without any data). */
export function forecastSplit(fc: SolarForecast | null, ids: readonly string[], now: Date): ForecastSplit | null {
  if (!fc || !ids.length) return null;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const t0 = today.getTime();
  const tomorrow = new Date(t0);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const t1 = tomorrow.getTime();
  const after = new Date(t1);
  after.setDate(after.getDate() + 1);
  const t2 = after.getTime();
  const hours = new Array<number>(24).fill(0);
  let seenToday = false;
  let tomorrowWh: number | null = null;
  for (const id of ids) {
    for (const [at, wh] of Object.entries(fc[id]?.wh_hours ?? {})) {
      const t = Date.parse(at);
      if (!Number.isFinite(t) || typeof wh !== "number" || !Number.isFinite(wh)) continue;
      if (t >= t0 && t < t1) {
        hours[new Date(t).getHours()] += Math.max(0, wh);
        seenToday = true;
      } else if (t >= t1 && t < t2) tomorrowWh = (tomorrowWh ?? 0) + Math.max(0, wh);
    }
  }
  if (!seenToday && tomorrowWh === null) return null;
  // what is still to come today: the hours ahead, and the current hour's remaining share
  const hour = now.getHours();
  const left = 1 - (now.getMinutes() * 60 + now.getSeconds()) / 3600;
  let restWh = hours[hour] * left;
  for (let h = hour + 1; h < 24; h++) restWh += hours[h];
  return { rest: seenToday ? restWh / 1000 : null, tomorrow: tomorrowWh === null ? null : tomorrowWh / 1000, hours };
}

/** The forecast's day curve as an SVG path in the hologram's 220 × 44 box (hourly points at the middle of each hour). */
export function forecastCurvePath(hours: readonly number[], peak: number): string {
  const y = (w: number) => 42 - (peak > 0 ? (Math.min(w, peak) / peak) * 36 : 0);
  return hours.map((w, h) => `${h ? "L" : "M"}${(((h + 0.5) / 24) * 220).toFixed(1)} ${y(w).toFixed(1)}`).join(" ");
}

/** The extra figures for the grown card; every one null when it is not known. */
export interface SolarMoreInput {
  forecast: ForecastSplit | null;
  /** Today's production (kWh) from the solar statistics or the day curve. */
  produced: number | null;
  /** Today's export (kWh); null without an export statistic. */
  exported: number | null;
}

export type SolarMoreRow =
  | { key: "forecast_rest"; kwh: number }
  | { key: "forecast_tomorrow"; kwh: number }
  | { key: "self_use"; self: number; exported: number; share: number };

/** The rows of the grown card, in order: only what is known (no placeholders). */
export function solarMoreRows(input: SolarMoreInput): SolarMoreRow[] {
  const rows: SolarMoreRow[] = [];
  if (input.forecast) {
    if (input.forecast.rest !== null) rows.push({ key: "forecast_rest", kwh: input.forecast.rest });
    if (input.forecast.tomorrow !== null) rows.push({ key: "forecast_tomorrow", kwh: input.forecast.tomorrow });
  }
  if (input.produced !== null && input.exported !== null && input.produced > 0) {
    // the counters are read at different moments: export never exceeds what was produced
    const exported = Math.min(Math.max(0, input.exported), input.produced);
    const self = input.produced - exported;
    rows.push({ key: "self_use", self, exported, share: Math.round((self / input.produced) * 100) });
  }
  return rows;
}
