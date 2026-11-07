// The rack card (#120): a glass card over a rack, like the energy cards, with a few live values of the gear linked to
// Home Assistant (#119): UPS load, battery and runtime, PoE watts, the hottest temperature, how many devices are
// online, a NAS volume, one throughput figure. The editor picks the values (`rack.card.metrics`, at most
// RACK_CARD_MAX); without a pick the card shows `defaultRackMetrics`. A value is an entity id or a figure over the
// whole rack ("@hottest", "@online"). Pure: the viewer reads the values on Home Assistant updates (not per frame),
// voice (#122) answers from the same functions.

import { slotEntities, slotStatus } from "./rack-links.ts";
import { entityKind, RACK_KIND_ORDER, type RackMetricKind } from "./rack-suggest.ts";
import type { RackSlot } from "./rack.ts";
import type { StatRow } from "./energy.ts";
import type { HomeAssistant } from "./types.ts";

/** At most this many values on a rack card. */
export const RACK_CARD_MAX = 8;

/** Figures over the whole rack: the hottest temperature of its gear, and how many of its linked devices are online. */
export const RACK_HOTTEST = "@hottest";
export const RACK_ONLINE = "@online";

type Hass = Pick<HomeAssistant, "states" | "entities">;
type Slot = Partial<RackSlot>;

/** A linked entity of the rack with its kind and the slot it belongs to. */
interface Linked {
  id: string;
  kind: RackMetricKind;
  slot: Slot;
}

/** Every entity the rack's slots link (status entities and links), in slot order, each once, with its kind. */
function linkedOf(hass: Hass, slots: readonly Slot[]): Linked[] {
  const seen = new Set<string>();
  const out: Linked[] = [];
  for (const slot of slots)
    for (const id of slotEntities(slot)) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({ id, kind: entityKind(hass, id), slot });
    }
  return out;
}

const unitOf = (hass: Hass, id: string): string => String(hass.states[id]?.attributes?.unit_of_measurement ?? "");
const percent = (hass: Hass, id: string): boolean => unitOf(hass, id) === "%";

/** A slot that is a UPS: it links a battery or a runtime. */
const isUps = (all: readonly Linked[], slot: Slot): boolean => all.some((l) => l.slot === slot && (l.kind === "battery" || l.kind === "runtime"));

/**
 * The card's values when the editor picked none: never "everything", at most `max`, in this order: the UPS's load
 * (%), battery (%) and runtime; the PoE watts (else the UPS's output power); the hottest temperature; devices online;
 * a NAS volume's used %; one throughput figure (WAN / uplink first). Values the rack has nothing for are left out.
 */
export function defaultRackMetrics(hass: Hass, slots: readonly Slot[], max = RACK_CARD_MAX): string[] {
  const all = linkedOf(hass, slots);
  const of = (kind: RackMetricKind) => all.filter((l) => l.kind === kind);
  const ups = (l: Linked) => isUps(all, l.slot);
  const first = (list: Linked[], ...prefs: ((l: Linked) => boolean)[]): string | null => {
    for (const p of prefs) {
      const hit = list.find(p);
      if (hit) return hit.id;
    }
    return null;
  };
  const out: (string | null)[] = [
    first(of("load"), (l) => ups(l) && percent(hass, l.id), (l) => percent(hass, l.id)),
    first(of("battery"), ups, () => true),
    first(of("runtime"), () => true),
    first(of("power"), (l) => /poe/.test(l.id), ups),
    of("temperature").length ? RACK_HOTTEST : null,
    slots.some((s) => slotStatus(hass, s) !== null) ? RACK_ONLINE : null,
    first(of("disk"), (l) => percent(hass, l.id) && !/free/.test(l.id)),
    first(of("throughput"), (l) => /wan|uplink|internet|external/.test(l.id), () => true),
  ];
  return out.filter((id): id is string => !!id).slice(0, max);
}


/** One value on the card. */
export interface RackCardValue {
  /** The entity id, or "@hottest" / "@online". */
  key: string;
  kind: RackMetricKind;
  /** The slot it comes from (the hottest one's for "@hottest"); null for "@online". */
  slot: string | null;
  /** Its number now; null when it is no number or unavailable. */
  value: number | null;
  /** "@online": of how many devices with a status. */
  of?: number;
  unit: string;
  /** The state as Home Assistant has it ("2/3" for "@online"). */
  text: string;
  /** The statistics behind its sparkline (numbers only), and how they combine ("max": the hottest at each time). */
  ids: string[];
  agg: "one" | "max";
}

const numberOf = (hass: Hass, id: string): number | null => {
  const st = hass.states[id];
  if (!st || st.state === "" || st.state === "unavailable" || st.state === "unknown") return null;
  const n = Number(st.state);
  return Number.isFinite(n) ? n : null;
};

/**
 * What the card shows: the editor's pick (null / missing: the default set; empty: nothing), in its order, each once, at
 * most RACK_CARD_MAX. Entities the rack no longer links and figures it has nothing for are left out.
 */
export function rackCardValues(hass: Hass, slots: readonly Slot[], chosen?: readonly string[] | null): RackCardValue[] {
  const all = linkedOf(hass, slots);
  const keys = [...new Set(chosen ?? defaultRackMetrics(hass, slots))];
  const out: RackCardValue[] = [];
  for (const key of keys) {
    if (out.length >= RACK_CARD_MAX) break;
    if (key === RACK_HOTTEST) {
      const temps = all.filter((l) => l.kind === "temperature");
      let best: Linked | null = null;
      for (const l of temps) {
        const n = numberOf(hass, l.id);
        if (n !== null && (!best || n > numberOf(hass, best.id)!)) best = l;
      }
      if (!temps.length) continue;
      const v = best ? numberOf(hass, best.id) : null;
      out.push({ key, kind: "temperature", slot: best?.slot.id ?? null, value: v, unit: best ? unitOf(hass, best.id) : "", text: v === null ? "unavailable" : String(hass.states[best!.id]!.state), ids: temps.map((l) => l.id), agg: "max" });
    } else if (key === RACK_ONLINE) {
      const states = slots.map((s) => slotStatus(hass, s)).filter((s) => s !== null);
      if (!states.length) continue;
      const on = states.filter((s) => s === "online").length;
      out.push({ key, kind: "status", slot: null, value: on, of: states.length, unit: "", text: `${on}/${states.length}`, ids: [], agg: "one" });
    } else {
      const l = all.find((x) => x.id === key);
      if (!l) continue;
      const v = numberOf(hass, key);
      out.push({ key, kind: l.kind, slot: l.slot.id ?? null, value: v, unit: unitOf(hass, key), text: String(hass.states[key]?.state ?? "unavailable"), ids: v === null ? [] : [key], agg: "one" });
    }
  }
  return out;
}

/** A value's sparkline: the recorder's means in time order, one sensor as it is, "max" the highest at each time. */
export function rackSpark(rows: Record<string, readonly StatRow[]> | null, v: Pick<RackCardValue, "ids" | "agg">): number[] {
  const at = new Map<number, number>();
  for (const id of v.ids)
    for (const r of rows?.[id] ?? []) {
      if (typeof r.mean !== "number") continue;
      const t = typeof r.start === "number" ? r.start : Date.parse(r.start);
      const was = at.get(t);
      at.set(t, was === undefined ? r.mean : Math.max(was, r.mean));
    }
  return [...at].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
}

/** Kinds that are no value to read (they act or nag): never offered on the card. */
const NO_VALUE = new Set<RackMetricKind>(["update", "switch", "button"]);
const byKind = (a: { kind: RackMetricKind }, b: { kind: RackMetricKind }) => RACK_KIND_ORDER.indexOf(a.kind) - RACK_KIND_ORDER.indexOf(b.kind);

/** A group of values the editor can put on the card: the rack's own figures (slot null), then one per device. */
export interface RackMetricGroup {
  slot: string | null;
  name: string | null;
  options: { key: string; kind: RackMetricKind }[];
}

/** What the editor can put on the card, grouped by device (slot order) and ordered by kind within each group. */
export function rackMetricOptions(hass: Hass, slots: readonly Slot[], nameOf: (slot: Slot) => string): RackMetricGroup[] {
  const all = linkedOf(hass, slots);
  const rack: RackMetricGroup["options"] = [];
  if (slots.some((s) => slotStatus(hass, s) !== null)) rack.push({ key: RACK_ONLINE, kind: "status" });
  if (all.some((l) => l.kind === "temperature")) rack.push({ key: RACK_HOTTEST, kind: "temperature" });
  const groups: RackMetricGroup[] = rack.length ? [{ slot: null, name: null, options: rack }] : [];
  for (const slot of slots) {
    const options = all.filter((l) => l.slot === slot && !NO_VALUE.has(l.kind)).map(({ id, kind }) => ({ key: id, kind }));
    if (options.length) groups.push({ slot: slot.id ?? null, name: nameOf(slot), options: options.sort(byKind) });
  }
  return groups;
}

/** The pick after ticking or unticking a value: without a pick yet it starts from the default set; full stays full. */
export function toggleRackMetric(chosen: readonly string[] | null | undefined, defaults: readonly string[], key: string, max = RACK_CARD_MAX): string[] {
  const now = [...(chosen ?? defaults)];
  if (now.includes(key)) return now.filter((k) => k !== key);
  return now.length >= max ? now : [...now, key];
}

/** The recorder's five-minute means of these sensors over the last `ms` (null when the recorder cannot be asked). */
export async function fetchRackSpark(hass: Pick<HomeAssistant, "callWS">, ids: readonly string[], ms: number, now = Date.now()): Promise<Record<string, StatRow[]> | null> {
  try {
    const rows = await hass.callWS<Record<string, StatRow[]>>({
      type: "recorder/statistics_during_period",
      start_time: new Date(now - ms).toISOString(),
      statistic_ids: [...ids],
      period: "5minute",
      types: ["mean"],
    });
    return rows ?? {};
  } catch {
    return null;
  }
}
