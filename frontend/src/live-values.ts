// What the live parts of the plan's pack items show now (#466): each group's value from its slot's entity, read from
// Home Assistant's states. The view hands the values to the viewer (setLiveValues), which moves the parts towards them.
// Kept out of live-parts.ts, which the 3D bundle imports, so the viewer carries no state reading.
// Ported from NeonPlan 3D 3.4.0 (MIT, Mastershort).

import { fanSpeed, isActive } from "./devices.ts";
import type { Floor } from "./model.ts";
import { packItem } from "./packs.ts";
import { FAN_SLOT, hasLiveParts, liveGroups, slotDomains, slotEntity, type BindKind } from "./live-parts.ts";
import type { HassEntity } from "./types.ts";

const ON = /^(on|open|opening|true|home|playing|heat|cool|heat_cool|auto|dry|fan_only|cleaning|printing|running|charging|active|ok|online|connected|detected|washing|drying|rinsing|spinning)$/i;
const BAD = /^(unavailable|unknown|problem|error|fault|failed|offline|disconnected|alarm|triggered|jammed|low)$/i;
/** Binary sensors whose "on" is a fault for a status light: a problem, a leak, smoke, gas, tampering. */
const ALARM_CLASSES = new Set(["problem", "moisture", "smoke", "gas", "carbon_monoxide", "safety", "tamper"]);

/** A number of a state: its share (0–1) when it reads like a percent, else as it is (clamped to 0–1). */
function share(st: HassEntity): number | null {
  const pos = st.attributes?.current_position ?? st.attributes?.percentage ?? st.attributes?.progress;
  if (typeof pos === "number" && Number.isFinite(pos)) return Math.max(0, Math.min(1, pos / 100));
  const n = Number(st.state);
  if (!Number.isFinite(n) || st.state === "") return null;
  if (st.attributes?.unit_of_measurement === "%" || n > 1) return Math.max(0, Math.min(1, n / 100));
  return Math.max(0, Math.min(1, n));
}

/**
 * The value a part shows for its entity's state: 0–1 for moving, turning, filling and glowing parts; for a status
 * light 1 (fine, on), 0 (off) or -1 (a fault, unavailable). Without a state: rest (0).
 */
export function bindValue(kind: BindKind, st: HassEntity | undefined): number {
  if (!st) return 0;
  const state = String(st.state ?? "");
  if (kind === "blink") {
    if (BAD.test(state)) return -1;
    // a problem, leak or smoke sensor: a fault while it reports one, fine while it does not
    if (ALARM_CLASSES.has(String(st.attributes?.device_class ?? "")) && (state === "on" || state === "off")) return state === "on" ? -1 : 1;
    if (ON.test(state)) return 1;
    const n = Number(state);
    return Number.isFinite(n) && state !== "" ? (n > 0 ? 1 : 0) : 0;
  }
  if (kind === "level") return share(st) ?? (ON.test(state) ? 1 : 0);
  const domain = st.entity_id.split(".")[0];
  const p = domain === "cover" || domain === "fan" || domain === "valve" ? share(st) : null;
  if (p !== null && state !== "closed" && state !== "off") return Math.max(p, kind === "spin" ? 0.3 : 0);
  if (BAD.test(state)) return 0;
  if (ON.test(state)) return 1;
  const n = Number(state);
  // a power or speed reading: running while above a few watts
  if (Number.isFinite(n) && state !== "") return st.attributes?.unit_of_measurement === "%" ? Math.max(0, Math.min(1, n / 100)) : n > 5 ? 1 : 0;
  return 0;
}

/**
 * How fast an item's fan blades turn (#1084, 0–1): the fan entity of a lamp with a fan, else the item's own entity – a
 * fan at its speed, anything else that is on at a middle pace; a light alone drives no blades.
 */
export function spinValue(fan: string | null | undefined, own: string | null, states: Record<string, HassEntity>): number {
  const src = fan && fan !== "none" ? fan : own && own !== "none" ? own : null;
  if (!src) return NaN;
  const st = states[src];
  const domain = src.split(".")[0];
  if (domain === "fan") return fanSpeed(st);
  if (domain === "light" || !st) return 0;
  return isActive(st) ? 0.6 : bindValue("spin", st) > 0 ? 0.6 : 0;
}

/**
 * The values of the plan's live parts, by "<furniture id>|<group key>" (live-parts.ts liveKey): 0–1, -1 for a status
 * light's fault, NaN where no entity is linked (the part stands as drawn). Empty when nothing in the plan lives.
 */
export function liveValues(floors: readonly Floor[], states: Record<string, HassEntity>, own: (furnitureId: string) => string | null): Map<string, number> {
  const out = new Map<string, number>();
  for (const floor of floors) {
    for (const f of floor.furniture) {
      if (!f.type.startsWith("pack:")) continue;
      const item = packItem(f.type);
      if (!item || !hasLiveParts(item)) continue;
      const mine = own(f.id);
      for (const [key, g] of liveGroups(item.parts)) {
        if (g.bind.slot === FAN_SLOT) {
          out.set(`${f.id}|${key}`, spinValue(f.fan, mine, states));
          continue;
        }
        const slot = item.slots?.find((s) => s.id === g.bind.slot);
        const ent = slotEntity(f.binds, g.bind.slot, item.slots?.length ?? 1, mine, slotDomains(slot));
        out.set(`${f.id}|${key}`, ent ? bindValue(g.bind.kind, states[ent]) : NaN);
      }
    }
  }
  return out;
}
