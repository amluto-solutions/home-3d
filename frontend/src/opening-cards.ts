// The Type cards of a door, window or garage door (#417, MANY-5, ORDER-6): one card per kind and style, so the
// opening panel needs no separate kind chips, Style select or "Cellar window" button. Plain data and small functions
// (which card an opening shows, what a card changes), so tests can hold them.

import type { I18nKey } from "./i18n.ts";
import { OPENING_PRESETS, type Opening, type OpeningPreset, type OpeningStyle, type OpeningType } from "./model.ts";

export interface OpeningCard {
  /** "door", "front_glass", "window_bars", "cellar" … */
  id: string;
  /** The heading the card sits under. */
  group: OpeningType;
  name: I18nKey;
  /** The kind it starts from: type, leaves, size and whether it reaches the floor. */
  preset: OpeningPreset;
  /** Its look; null = automatic (a plain door: a room door inside, a front door in an outer wall). */
  style: OpeningStyle | null;
}

const card = (id: string, group: OpeningType, name: string, preset: OpeningPreset, style: OpeningStyle | null): OpeningCard => ({ id, group, name: name as I18nKey, preset, style });

/** Every card, in the order the panel shows them. Every door, window and garage style has one (tested). */
export const OPENING_CARDS: readonly OpeningCard[] = [
  card("door", "door", "preset_door", "door", null),
  card("interior", "door", "style_interior", "door", "interior"),
  card("door_double", "door", "preset_door_double", "door_double", null),
  card("front", "door", "style_front", "front", "front"),
  card("front_glass", "door", "style_front_glass", "front", "front_glass"),
  card("sidelight", "door", "style_sidelight", "front", "sidelight"),
  card("sidelights", "door", "style_sidelights", "front", "sidelights"),
  card("glass", "door", "style_glass", "door", "glass"),
  card("sliding", "door", "style_sliding", "door", "sliding"),
  card("passage", "door", "style_passage", "door", "passage"),
  card("window", "window", "preset_window", "window", null),
  card("window_double", "window", "preset_window_double", "window_double", null),
  card("window_bars", "window", "ocard_window_bars", "window", "bars"),
  card("cellar", "window", "cellar_window", "window", null),
  card("terrace", "window", "preset_terrace", "terrace", null),
  card("terrace_double", "window", "preset_terrace_double", "terrace_double", null),
  card("glass_wall", "window", "preset_glass_wall", "glass_wall", "glass_wall"),
  card("garage", "garage", "style_sectional", "garage", null),
  card("up_and_over", "garage", "style_up_and_over", "garage", "up_and_over"),
];

/** The card groups in their order, with their heading. */
export const OPENING_CARD_GROUPS: readonly { group: OpeningType; name: I18nKey }[] = [
  { group: "door", name: "ocard_doors" as I18nKey },
  { group: "window", name: "ocard_windows" as I18nKey },
  { group: "garage", name: "ocard_garage" as I18nKey },
];

/** A cellar window: small, high up in the wall (1.0 × 0.5 m, its top 25 cm under the ceiling). */
export function isCellarWindow(o: Pick<Opening, "type" | "leaves" | "height" | "sill" | "style">): boolean {
  return o.type === "window" && o.leaves !== 2 && o.height <= 0.6 && o.sill >= 0.1 && o.style !== "glass_wall" && o.style !== "bars";
}

/** The card an opening shows as its type. */
export function openingCardOf(o: Pick<Opening, "type" | "leaves" | "sill" | "height" | "style">): OpeningCard {
  const by = (id: string) => OPENING_CARDS.find((c) => c.id === id)!;
  const two = o.leaves === 2;
  if (o.type === "garage") return by(o.style === "up_and_over" ? "up_and_over" : "garage");
  if (o.type === "door") {
    if (two) return by("door_double");
    const own = o.style ? OPENING_CARDS.find((c) => c.group === "door" && c.style === o.style && c.preset !== "door_double") : undefined;
    return own ?? by("door");
  }
  if (o.style === "glass_wall") return by("glass_wall");
  if (o.sill < 0.1) return by(two ? "terrace_double" : "terrace");
  if (two) return by("window_double");
  if (o.style === "bars") return by("window_bars");
  return by(isCellarWindow(o) ? "cellar" : "window");
}

/**
 * What picking a card changes on an opening: its type, leaves and look; the size of the card's kind only when the
 * shape changes (another type, number of leaves, or to / from the floor), so a sliding door stays as wide as the room
 * door it was. A cellar window always takes its own size. `ceiling`: the floor's height. Sidelight widths and the
 * hinge stay as they are.
 */
export function openingCardPatch(o: Pick<Opening, "type" | "leaves" | "sill" | "height" | "width">, c: OpeningCard, ceiling: number): Partial<Opening> {
  const d = OPENING_PRESETS[c.preset];
  const same = o.type === d.type && (o.leaves === 2) === (d.leaves === 2) && o.sill < 0.1 === d.sill < 0.1;
  const look = { type: d.type, leaves: d.leaves, style: c.style } as Partial<Opening>;
  if (c.id === "cellar") return { ...look, width: 1, height: 0.5, sill: Math.max(0, Math.round((ceiling - 0.75) * 100) / 100) };
  // from a cellar window back to a plain window: its usual size again
  if (same && !(isCellarWindow({ ...o, style: null }) && c.id !== "cellar" && o.type === "window")) return look;
  return { ...look, width: d.width, sill: d.sill, height: d.height };
}
