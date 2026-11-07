// The item panel's colour rows (#410, #411): one row per part, named after what the part is ("Paint", "Legs"), not
// after the role's colour word ("White", "Dark"). Each part belongs to a family (wood, metal, fabric, paint, glass …)
// that gives its swatch popover the preset colours and the 2-3 finishes that fit it. Pure data and helpers, no DOM;
// only the editor imports it (its texts are in the editor's table, i18n-late.ts).

import { COLOUR_PRESETS, PAINT_COLOURS, type ColourPreset, type ColourRole } from "./colour-roles.ts";
import { PART_NAMES } from "./item-format.ts";
import { packInfo, packRoleNames } from "./packs.ts";
import { usualMaterial, type Material } from "./role-materials.ts";

export type PartName = (typeof PART_NAMES)[number];

/** The kinds of part, each with its own presets and finishes. */
export type PartFamily = "paint" | "wood" | "metal" | "fabric" | "glass" | "plant" | "plain";

/** Roles that name a material or a thing: their row keeps that name when the item gives none. */
const NAMED_ROLES: Partial<Record<ColourRole, PartName>> = {
  paint: "paint",
  fabric: "fabric",
  cushion: "cushion",
  wood: "wood",
  metal: "metal",
  glass: "glass",
  plant: "plant",
  pot: "pot",
};

/** Roles named after a colour or nothing (body, white, dark): "Main colour", "Second colour", "Third colour" in turn. */
const PLAIN_ROLES: readonly ColourRole[] = ["body", "white", "dark"];
const PLAIN_NAMES: readonly PartName[] = ["main", "second", "third"];

/** A vehicle's parts, when its pack names none: the body is paint (#129), the dark parts tyres and trim. */
const VEHICLE_PARTS: Partial<Record<ColourRole, PartName>> = {
  paint: "paint",
  dark: "tyres_trim",
  metal: "wheels",
  glass: "windows",
  white: "details",
  accent: "details",
  fabric: "seat",
  cushion: "seat",
};

const isPartName = (v: unknown): v is PartName => typeof v === "string" && (PART_NAMES as readonly string[]).includes(v);

/**
 * What the panel calls the part of `type` drawn in `role` (its text is `part_<name>`): the pack item's own name, a
 * vehicle's part, the role's material ("Fabric", "Wood"), else "Main colour", "Second colour", "Third colour" for
 * the colour-word roles in the order the item lists them (`roles`), and "Details" for its accent.
 */
export function partName(type: string, role: ColourRole, roles: readonly ColourRole[]): PartName {
  const own = packRoleNames(type)?.[role];
  if (isPartName(own)) return own;
  if (packInfo(type)?.vehicle) {
    const part = VEHICLE_PARTS[role];
    if (part) return part;
  }
  const named = NAMED_ROLES[role];
  if (named) return named;
  if (role === "accent") return "details";
  const plain = roles.filter((r) => PLAIN_ROLES.includes(r));
  return PLAIN_NAMES[Math.max(0, plain.indexOf(role))] ?? "details";
}

/** The rows in panel order: the paint first (a vehicle's body, #411), then the item's other roles as they come. */
export function partOrder(roles: readonly ColourRole[]): ColourRole[] {
  return [...roles.filter((r) => r === "paint"), ...roles.filter((r) => r !== "paint")];
}

/** The family of a role: what kind of thing it is drawn as. */
export function partFamily(role: ColourRole): PartFamily {
  switch (role) {
    case "paint":
      return "paint";
    case "wood":
      return "wood";
    case "metal":
      return "metal";
    case "fabric":
    case "cushion":
      return "fabric";
    case "glass":
      return "glass";
    case "plant":
      return "plant";
    default:
      return "plain";
  }
}

/** The presets of each family by id (COLOUR_PRESETS; the paint's are PAINT_COLOURS). */
const FAMILY_PRESETS: Record<Exclude<PartFamily, "paint">, readonly string[]> = {
  wood: ["oak", "walnut", "birch", "pine", "acacia", "white_stained_oak", "black_brown", "rattan"],
  metal: ["chrome", "steel", "brass", "copper", "anthracite", "black", "white_gloss"],
  fabric: ["grey_fabric", "beige_fabric", "navy_fabric", "green_velvet", "terracotta", "anthracite", "black"],
  glass: ["clear_glass", "frosted_glass", "smoked_glass", "black"],
  plant: ["leaf_green", "dark_green", "olive"],
  plain: ["white_gloss", "black", "anthracite", "chrome", "oak", "walnut", "birch", "white_stained_oak", "black_brown", "terracotta"],
};

/** A preset tile: its colour and the key of its name. */
export interface PartPreset extends ColourPreset {
  key: string;
}

/** The preset tiles of a family's popover (#410, MANY-2): wood tones for wood, metals for metal, the ten car paints for paint. */
export function familyPresets(family: PartFamily): PartPreset[] {
  if (family === "paint") return PAINT_COLOURS.map((c) => ({ ...c, key: `paint_${c.id}` }));
  return FAMILY_PRESETS[family].flatMap((id) => {
    const p = COLOUR_PRESETS.find((x) => x.id === id);
    return p ? [{ ...p, key: `colour_preset_${p.id}` }] : [];
  });
}

/** The key of a colour's name when it is a preset or a car paint, else null (the fold's summary names them). */
export function presetKey(hex: string): string | null {
  const paint = PAINT_COLOURS.find((c) => c.hex === hex);
  if (paint) return `paint_${paint.id}`;
  const preset = COLOUR_PRESETS.find((p) => p.hex === hex);
  return preset ? `colour_preset_${preset.id}` : null;
}

/** The finishes that fit a family, the usual one among them. */
const FAMILY_FINISHES: Record<PartFamily, readonly Material[]> = {
  paint: ["gloss", "matt", "metal"],
  wood: ["matt", "gloss", "rattan"],
  metal: ["metal", "matt", "gloss"],
  fabric: ["fabric", "matt", "rattan"],
  glass: ["glass", "matt", "gloss"],
  plant: ["matt", "gloss"],
  plain: ["matt", "gloss", "metal"],
};

/**
 * The finishes the popover offers a role (#410: 2-3 that fit the part, not all six): its family's, with the role's
 * usual one first and the item's own one kept when it is another (a saved finish is never hidden).
 */
export function partFinishes(role: ColourRole, own: Material | null): Material[] {
  const usual = usualMaterial(role);
  const list = [usual, ...FAMILY_FINISHES[partFamily(role)].filter((m) => m !== usual)];
  return own && !list.includes(own) ? [...list, own] : list;
}
