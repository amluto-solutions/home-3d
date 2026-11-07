// Rack gear linked to Home Assistant (#119). A slot (rack.ts RackSlot) may name a status entity (`entity`) and
// further entities of the same device (`links`: load, temperature, battery …). Its status LED shows green while
// the device is online, amber on a warning (on battery, a problem sensor on, part of it unavailable) and red when
// it is offline. Pure and small: the main bundle works the LEDs out on every Home Assistant update (view3d), so this
// file only reads states; the suggestions for linking live with the editor (rack-suggest.ts).

import type { RackSlot } from "./rack.ts";
import type { HassEntity, HomeAssistant } from "./types.ts";

export type RackStatus = "online" | "warning" | "offline";

/** At most this many further links per slot (the backend's limit too, racks.py). */
export const RACK_MAX_LINKS = 16;

/** The LED colours, the same in 3D, in the front view and in the rack sheet. */
export const RACK_STATUS_COLOURS: Record<RackStatus, string> = { online: "#2ecc71", warning: "#f5a623", offline: "#ff3b30" };

/** Binary sensor classes whose "on" means something is wrong. */
const TROUBLE = new Set(["problem", "safety", "smoke", "gas", "carbon_monoxide", "heat", "moisture", "tamper", "battery"]);
/** Words in a status text, checked in this order (NUT's raw "OB" / "LB" flags too). */
const WARN = /\b(ob|lb|on battery|low battery|discharg\w*|overload\w*|replace|error|fault\w*|degraded|warning|alarm|update)\b/;
const DOWN = /\b(off|offline|disconnected|down|stopped|not_home|away|unreachable|dead|lost|shutdown|halted|failed)\b/;
const UP = /\b(ol|on|online|connected|up|running|home|ok|normal|idle|healthy|active|charging|charged|ready)\b/;

/** The entities of a slot: its status entity first, then its links, each once. */
export function slotEntities(slot: Partial<RackSlot>): string[] {
  const out: string[] = [];
  for (const id of [slot.entity, ...(slot.links ?? [])]) if (id && !out.includes(id)) out.push(id);
  return out;
}

/** What one entity says about its device: null when it tells nothing (a number, a button, a missing link). */
export function entityStatus(st: HassEntity | undefined): RackStatus | null {
  if (!st) return null;
  const state = String(st.state ?? "").toLowerCase();
  if (state === "unavailable") return "offline";
  if (state === "unknown" || state === "") return "warning";
  const domain = st.entity_id.slice(0, st.entity_id.indexOf("."));
  if (domain === "binary_sensor") {
    const trouble = TROUBLE.has(String(st.attributes?.device_class ?? ""));
    if (state === "on") return trouble ? "warning" : "online";
    return trouble ? "online" : "offline";
  }
  if (domain === "update") return state === "on" ? "warning" : "online";
  if (domain === "device_tracker" || domain === "person") return state === "home" ? "online" : "offline";
  if (domain === "switch" || domain === "input_boolean" || domain === "light" || domain === "fan") return state === "on" ? "online" : "offline";
  // a measured value reports, so its device is up
  if (Number.isFinite(Number(state))) return "online";
  const words = state.replace(/[_-]+/g, " ");
  if (WARN.test(words)) return "warning";
  if (DOWN.test(words) || DOWN.test(state)) return "offline";
  if (UP.test(words)) return "online";
  // any other text (a mode, a firmware name): it reports
  return "online";
}

/**
 * A slot's LED: its status entity's word (a missing one is red), made amber while it is online but one of its links
 * is unavailable or reports a problem. Without a status entity the links decide: all unavailable red, some amber.
 * Null: no links, or none of them in Home Assistant (no LED).
 */
export function slotStatus(hass: Pick<HomeAssistant, "states">, slot: Partial<RackSlot>): RackStatus | null {
  const links = (slot.links ?? []).filter((id) => id && id !== slot.entity);
  const known = links.map((id) => hass.states[id]).filter((s): s is HassEntity => !!s);
  const gone = known.filter((s) => s.state === "unavailable").length;
  const trouble = known.some((s) => s.state !== "unavailable" && entityStatus(s) === "warning");
  if (slot.entity) {
    const own = entityStatus(hass.states[slot.entity]) ?? "offline";
    return own === "online" && (gone || trouble) ? "warning" : own;
  }
  if (!known.length) return null;
  if (gone === known.length) return "offline";
  return gone || trouble ? "warning" : "online";
}

/** The status of every linked slot of the plan's racks, keyed "<rack furniture id>/<slot id>" (the 3D LEDs). */
export function rackLedStates(hass: Pick<HomeAssistant, "states">, floors: readonly { furniture: readonly { id: string; rack?: { slots?: readonly RackSlot[] } | null }[] }[]): Map<string, RackStatus> {
  const out = new Map<string, RackStatus>();
  for (const floor of floors)
    for (const f of floor.furniture) {
      const slots = f.rack?.slots;
      if (!slots?.length) continue;
      for (const s of slots) {
        if (!s.entity && !s.links?.length) continue;
        const status = slotStatus(hass, s);
        if (status) out.set(`${f.id}/${s.id}`, status);
      }
    }
  return out;
}
