// Rates and costs from Home Assistant's own sensors (#323): what the energy dashboard's grid setup says about prices
// and costs (`energy/get_prefs`, `energy/info`), and today's cost from the chosen cost sensors or statistics. The 3D
// view loads this file only when a plan uses existing sensors with costs.

import type { EnergySettings } from "./model.ts";
import type { HomeAssistant } from "./types.ts";

/** A grid flow of the energy dashboard with its price and cost fields (all optional: Home Assistant's versions differ). */
export interface GridFlowPrefs {
  stat_energy_from?: string;
  stat_energy_to?: string;
  /** "Use an entity tracking the total costs": a cost statistic. */
  stat_cost?: string | null;
  /** The same for export earnings. */
  stat_compensation?: string | null;
  /** "Use an entity with the current price": a price sensor (e.g. GBP/kWh). */
  entity_energy_price?: string | null;
  /** "Use a static price". */
  number_energy_price?: number | null;
}

/** Home Assistant's energy dashboard settings, as far as rates and costs go. */
export interface RatePrefs {
  energy_sources?: ({ type: string; flow_from?: GridFlowPrefs[]; flow_to?: GridFlowPrefs[] } & GridFlowPrefs)[];
}

/** `energy/info`: the cost sensors Home Assistant made itself for flows with a price (energy statistic → cost entity). */
export interface EnergyInfo {
  cost_sensors?: Record<string, string>;
}

/** What the energy dashboard gives Home 3D's existing-sensor settings. */
export interface PrefsRates {
  tariff: string | null;
  price_fixed: number | null;
  cost_sensors: string[];
  earning_sensors: string[];
}

/**
 * The price and cost sources of the energy dashboard's grid: each import flow's cost (its cost statistic, or the
 * cost sensor Home Assistant made from its price), each export flow's earnings, and the first price sensor (else the
 * first fixed price). Flows may be listed (`flow_from`, `flow_to`) or be the source itself.
 */
export function prefsRates(prefs: RatePrefs | null | undefined, info: EnergyInfo | null | undefined): PrefsRates {
  const out: PrefsRates = { tariff: null, price_fixed: null, cost_sensors: [], earning_sensors: [] };
  const made = info?.cost_sensors ?? {};
  const add = (list: string[], id: string | null | undefined) => {
    if (id && !list.includes(id)) list.push(id);
  };
  for (const source of prefs?.energy_sources ?? []) {
    if (source?.type !== "grid") continue;
    const from = Array.isArray(source.flow_from) ? source.flow_from : source.stat_energy_from ? [source] : [];
    const to = Array.isArray(source.flow_to) ? source.flow_to : source.stat_energy_to ? [source] : [];
    for (const f of from) {
      add(out.cost_sensors, f.stat_cost || (f.stat_energy_from ? made[f.stat_energy_from] : null));
      if (!out.tariff && f.entity_energy_price) out.tariff = f.entity_energy_price;
      if (out.price_fixed === null && typeof f.number_energy_price === "number" && Number.isFinite(f.number_energy_price)) out.price_fixed = f.number_energy_price;
    }
    for (const f of to) add(out.earning_sensors, f.stat_compensation || (f.stat_energy_to ? made[f.stat_energy_to] : null));
  }
  if (out.tariff) out.price_fixed = null;
  return out;
}

/** A cost sensor that starts again every day ("cost today", "daily cost"), by its id or name. */
const DAILY = /today|daily|(^|[._\s-])day($|[._\s-])/i;

/**
 * Whether today's amount of a cost source is its state: a sensor that starts again every day (named so, or with a
 * `last_reset`), or one that is no counter. A counter (state class total or total_increasing) and a statistic without
 * an entity go by their statistics.
 */
export function readsState(hass: HomeAssistant, id: string): boolean {
  const s = hass.states[id];
  if (!s) return false;
  if (s.attributes.last_reset != null) return true;
  if (DAILY.test(id) || DAILY.test(String(s.attributes.friendly_name ?? ""))) return true;
  const cls = s.attributes.state_class;
  return cls !== "total" && cls !== "total_increasing";
}

/** A source's statistics since midnight: how much it went up, and whether it fell to under half on the way (it started again). */
interface StatToday {
  change: number;
  dropped: boolean;
}

async function fetchStatsToday(hass: HomeAssistant, ids: string[]): Promise<Map<string, StatToday> | null> {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  try {
    const rows = await hass.callWS<Record<string, { change?: number | null; state?: number | null }[]>>({
      type: "recorder/statistics_during_period",
      start_time: midnight.toISOString(),
      statistic_ids: ids,
      period: "5minute",
      types: ["change", "state"],
    });
    const out = new Map<string, StatToday>();
    for (const id of ids) {
      let change = 0;
      let dropped = false;
      let last: number | null = null;
      for (const r of rows?.[id] ?? []) {
        if (typeof r.change === "number") change += r.change;
        if (typeof r.state === "number") {
          if (last !== null && last > 0 && r.state < last / 2) dropped = true;
          last = r.state;
        }
      }
      out.set(id, { change, dropped: dropped || change < 0 });
    }
    return out;
  } catch {
    return null;
  }
}

/** Today's cost and earnings (null: none readable) and their currency. */
export interface CostsToday {
  cost: number | null;
  earned: number | null;
  unit: string;
}

/**
 * Today's cost and earnings from the plan's cost sensors (#323): a daily sensor by its state; a counter (or a
 * statistic without an entity) by how much it went up since midnight, from the short-term statistics, unless those
 * show it falling to under half (it started again: then its state). Missing, unavailable or unrecorded sources are
 * left out; null when nothing is chosen or nothing can be read.
 */
export async function fetchCostsToday(hass: HomeAssistant, energy: Pick<EnergySettings, "cost_sensors" | "earning_sensors">): Promise<CostsToday | null> {
  const costs = energy.cost_sensors ?? [];
  const earnings = energy.earning_sensors ?? [];
  const ids = [...new Set([...costs, ...earnings])];
  if (!ids.length) return null;
  const stats = ids.filter((id) => !readsState(hass, id));
  const got = stats.length ? await fetchStatsToday(hass, stats) : null;
  const stateOf = (id: string): number | null => {
    const state = hass.states[id]?.state;
    const v = Number(state);
    return state && Number.isFinite(v) ? v : null;
  };
  const value = (id: string): number | null => {
    if (!stats.includes(id)) return stateOf(id);
    const st = got?.get(id);
    if (!st) return null;
    return st.dropped ? stateOf(id) : st.change;
  };
  const sum = (list: string[]): number | null =>
    list.reduce<number | null>((t, id) => {
      const v = value(id);
      return v === null ? t : (t ?? 0) + v;
    }, null);
  const cost = sum(costs);
  const earned = sum(earnings);
  if (cost === null && earned === null) return null;
  const unit = ids.map((id) => hass.states[id]?.attributes.unit_of_measurement).find((u): u is string => typeof u === "string" && !!u) ?? hass.config?.currency ?? "";
  return { cost, earned, unit };
}

/** An amount of money in the user's language: a currency code as the language writes it, a symbol in front, else after. */
export function formatMoney(hass: HomeAssistant | undefined, value: number, unit: string): string {
  const lang = hass?.language || undefined;
  if (/^[A-Z]{3}$/.test(unit)) {
    try {
      return value.toLocaleString(lang, { style: "currency", currency: unit });
    } catch {
      // an unknown code: written after the number below
    }
  }
  const n = value.toLocaleString(lang, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (unit && unit.length <= 2 && !/[a-z]/i.test(unit)) return value < 0 ? `-${unit}${n.replace(/^-/, "")}` : `${unit}${n}`;
  return `${n} ${unit}`.trim();
}

/** What the cost tile shows: today's net cost (earnings taken off), or the earnings alone, formatted. */
export function costTile(hass: HomeAssistant | undefined, c: CostsToday): { net: boolean; value: string } {
  const net = (c.cost ?? 0) - (c.earned ?? 0);
  return { net: c.earned !== null, value: formatMoney(hass, Math.round(net * 100) / 100 || 0, c.unit) };
}
