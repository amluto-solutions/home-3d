/**
 * The order of the fields in the item panel (#70, #71).
 *
 * Position first: the next click after choosing an item goes to X, Y or the rotation, so they sit at the top, and
 * the Name box no longer sits where the library's search box was (a search typed there renamed the item).
 */

import { furnitureSize } from "./packs.ts";

export type FurnitureField = "x" | "z" | "w" | "d" | "h" | "rotation" | "mirror" | "strip" | "mount" | "name" | "show_name" | "aliases" | "type" | "floor";

export interface FurnitureFieldNeeds {
  /** It can be mirrored (lamps can't). */
  mirror: boolean;
  /** An LED strip: tilt, rise and upright. */
  strip: boolean;
  /** It can hang higher up (a height above the floor). */
  lift: boolean;
  /** The home has more than one floor: a dropdown moves the item to another one (#73). */
  floors?: boolean;
}

const ORDER: readonly FurnitureField[] = ["x", "z", "rotation", "w", "d", "h", "mount", "mirror", "strip", "name", "show_name", "aliases", "type", "floor"];

/** The position fields, pinned in a header at the top of the panel while it scrolls (#71). */
export const FURNITURE_HEAD: readonly FurnitureField[] = ["x", "z", "rotation"];

/**
 * The item panel of an item: the pinned header and the fields below it. Every kind of item keeps the same order
 * (only fields it hasn't got are left out) and the show-name row is always there, so the rows never move (#71).
 */
export function furniturePanel(needs: FurnitureFieldNeeds): { head: FurnitureField[]; body: FurnitureField[] } {
  const all = furnitureFields(needs);
  return { head: all.filter((f) => FURNITURE_HEAD.includes(f)), body: all.filter((f) => !FURNITURE_HEAD.includes(f)) };
}

/** The item panel's fields for an item, top to bottom. */
export function furnitureFields(needs: FurnitureFieldNeeds): FurnitureField[] {
  return ORDER.filter((f) => (f === "mirror" ? needs.mirror : f === "strip" ? needs.strip : f === "mount" ? needs.lift : f === "floor" ? !!needs.floors : true));
}

/** What the Type list needs of a pack item (a PackItemInfo fits). */
export interface TypeOptionItem {
  id: string;
  name: Record<string, string>;
  size: readonly [number, number, number] | readonly number[];
  variant?: Record<string, string>;
}

/**
 * The Type list's labels for one pack's items (#132): an item's name, and where another item of the pack has the same
 * name (three "GivEnergy battery" sizes) also its variant ("9.5 kWh"), or its size in cm when the variant is missing
 * or the same too.
 */
export function typeOptionLabels(items: readonly TypeOptionItem[], language: string): string[] {
  const lang = language.split("-")[0];
  const text = (t: Record<string, string> | undefined) => (t ? (t[lang] ?? t.en ?? Object.values(t)[0] ?? "") : "");
  const names = items.map((it) => text(it.name) || it.id);
  const variants = items.map((it, i) => `${names[i]}|${text(it.variant)}`);
  const tally = (list: string[]) => list.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map<string, number>());
  const byName = tally(names);
  const byVariant = tally(variants);
  return items.map((it, i) => {
    if (byName.get(names[i])! < 2) return names[i];
    const variant = text(it.variant);
    if (variant && byVariant.get(variants[i])! < 2) return `${names[i]} · ${variant}`;
    return `${names[i]} · ${it.size.map((m) => Math.round(m * 100)).join(" × ")} cm`;
  });
}

/** The size an item still has from its type (within 5 mm), i.e. nobody resized it. */
function hasTypeSize(f: { type: string; w: number; d: number; h: number }): boolean {
  const [w, d, h] = furnitureSize(f.type);
  return Math.abs(f.w - w) < 0.005 && Math.abs(f.d - d) < 0.005 && Math.abs(f.h - h) < 0.005;
}

/**
 * What picking another type in the item panel changes (#132): the type, and the new type's size unless the item was
 * resized by hand (its size is no longer its old type's), so a sofa turned into a bed is bed-sized.
 */
export function retypePatch(f: { type: string; w: number; d: number; h: number }, type: string): { type: string; w?: number; d?: number; h?: number } {
  if (type === f.type || !hasTypeSize(f)) return { type };
  const [w, d, h] = furnitureSize(type);
  return { type, w, d, h };
}
