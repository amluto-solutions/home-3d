// Live parts of pack items (#466): a part tied to a slot of its item moves or lights with the slot's entity – a door
// opens with its contact, a drawer slides out, a drum turns, a tank fills with its level, a status light shows ok, off
// or a fault, a part glows while on. Parts marked `spin` (fan blades) turn while the item's fan runs. The placed item
// links each slot to an entity (`Furniture.binds`); an item with one slot takes the item's own entity when none is set
// and that entity is of a kind the slot takes (an oven's power switch does not open its door). Pure logic, no DOM and no
// Home Assistant: which parts, which groups, which entity (live-values.ts reads the states; the viewer moves the parts).
// The pack format is in docs/packs.md ("Live parts"); custom_components/home_3d/packs.py checks the same lists.
// Ported from NeonPlan 3D 3.4.0 (MIT, Mastershort); slot kinds and the spin group are Home 3D's own.

/** What a live part does: turn open about an edge, slide out, turn, fill, show a status light, glow. */
export type BindKind = "open" | "slide" | "spin" | "level" | "blink" | "glow";
export const BIND_KINDS: readonly BindKind[] = ["open", "slide", "spin", "level", "blink", "glow"];

/**
 * What a slot is, so a pack item need not list names and domains: the item panel names the picker after it and offers
 * the entities of its domains first. `packs.py` has the same list.
 */
export type SlotKind = "contact" | "drawer" | "fan" | "level" | "progress" | "status" | "power" | "glow";
export const SLOT_KINDS: readonly SlotKind[] = ["contact", "drawer", "fan", "level", "progress", "status", "power", "glow"];

/** The entity domains a slot of a kind takes (an item's own entity fills its only slot only when its domain is here). */
export const SLOT_DOMAINS: Record<SlotKind, readonly string[]> = {
  contact: ["binary_sensor", "cover", "input_boolean", "lock"],
  drawer: ["binary_sensor", "cover", "input_boolean"],
  fan: ["fan", "switch", "input_boolean", "binary_sensor", "sensor"],
  level: ["sensor", "number", "input_number", "cover", "valve"],
  progress: ["sensor", "number", "input_number"],
  status: ["binary_sensor", "sensor", "switch", "device_tracker", "input_boolean", "update", "vacuum", "lawn_mower"],
  power: ["switch", "sensor", "binary_sensor", "input_boolean", "media_player", "climate", "water_heater"],
  glow: ["light", "switch", "binary_sensor", "input_boolean", "media_player"],
};

/** A part's tie to its item's slot: what it does and how far. */
export interface PartBind {
  slot: string;
  kind: BindKind;
  /** "open": the edge it turns about (default left, seen from the front). */
  hinge?: "left" | "right" | "top" | "bottom";
  /** "spin": the axis it turns about (default upright, y). */
  axis?: "x" | "y" | "z";
  /** "open": degrees (default 95); "slide": a share of the item's depth (default 0.45); "spin": turns a minute at full (default 60). */
  amount?: number;
}

/** A slot of a pack item: what the item panel asks an entity for. */
export interface PackSlot {
  id: string;
  kind?: SlotKind;
  /** Its name by language; without one the panel names it after its kind. */
  name?: Record<string, string>;
  /** The entity domains it takes; without them its kind's. */
  domains?: string[];
}

/** The parts the house model leaves out for the viewer to draw on their own (live and turning parts). */
export function isLivePart(p: { bind?: PartBind; spin?: "y" | "z" }): boolean {
  return !!p.bind || p.spin === "y" || p.spin === "z";
}

/** The tie a turning part (fan blades, #1084) counts as: the item's fan, about its axis. */
export const FAN_SLOT = "~fan";

/** The tie a part stands for: its own bind, or the item's fan for a `spin` part; null for a part that does not move. */
export function partBind(p: { bind?: PartBind; spin?: "y" | "z" }): PartBind | null {
  if (p.bind) return p.bind;
  if (p.spin === "y" || p.spin === "z") return { slot: FAN_SLOT, kind: "spin", axis: p.spin };
  return null;
}

/** The parts of an item that live, by group (one moving model each): same slot, kind, edge, axis and amount. */
export function liveGroups<P extends { bind?: PartBind; spin?: "y" | "z" }>(parts: readonly P[]): Map<string, { bind: PartBind; parts: P[] }> {
  const out = new Map<string, { bind: PartBind; parts: P[] }>();
  for (const p of parts) {
    const bind = partBind(p);
    if (!bind) continue;
    const key = liveKey(bind);
    const g = out.get(key);
    if (g) g.parts.push(p);
    else out.set(key, { bind, parts: [p] });
  }
  return out;
}

export function liveKey(b: PartBind): string {
  return `${b.slot}|${b.kind}|${b.hinge ?? ""}|${b.axis ?? ""}|${b.amount ?? ""}`;
}

/** An item with parts that move or light with Home Assistant (bound parts or fan blades). */
export function hasLiveParts(item: { parts?: readonly { bind?: PartBind; spin?: "y" | "z" }[] } | null | undefined): boolean {
  return !!item?.parts?.some(isLivePart);
}

/**
 * An item the library marks ✨ Live: one with slots (the library's index carries no parts, and a bound part always
 * names a slot of its item) or, once its recipe is here, one with live parts.
 */
export function isLiveItem(item: { slots?: readonly unknown[]; parts?: readonly { bind?: PartBind; spin?: "y" | "z" }[] } | null | undefined): boolean {
  return !!item && (!!item.slots?.length || hasLiveParts(item));
}

/** The axis an item's fan blades turn about, null without such parts. */
export function packSpinAxis(item: { parts?: readonly { spin?: "y" | "z" }[] } | null | undefined): "y" | "z" | null {
  const p = item?.parts?.find((x) => x.spin === "y" || x.spin === "z");
  return p ? (p.spin as "y" | "z") : null;
}

/** The domains a slot takes: its own, else its kind's; empty means any. */
export function slotDomains(slot: PackSlot | undefined): readonly string[] {
  if (slot?.domains?.length) return slot.domains;
  return slot?.kind ? SLOT_DOMAINS[slot.kind] : [];
}

/**
 * The entity a slot of a placed item shows: its own link, else the item's entity when the item has one slot only and
 * that entity is of a kind the slot takes (an oven's power switch does not open its door).
 */
export function slotEntity(binds: Record<string, string> | null | undefined, slot: string, slots: number, own: string | null, domains?: readonly string[]): string | null {
  const e = binds?.[slot];
  // "none": linked to nothing on purpose, so not even the item's own entity
  if (e === "none") return null;
  if (e) return e;
  if (slots > 1 || !own || own === "none") return null;
  return !domains?.length || domains.includes(own.split(".")[0]) ? own : null;
}

/** The slots the item panel asks an entity for: the item's, else one per slot its parts name (an older recipe). */
export function itemSlots(item: { slots?: PackSlot[]; parts?: readonly { bind?: PartBind }[] } | null | undefined): PackSlot[] {
  if (!item) return [];
  if (item.slots?.length) return item.slots;
  return [...new Set((item.parts ?? []).flatMap((p) => (p.bind ? [p.bind.slot] : [])))].map((id) => ({ id }));
}
