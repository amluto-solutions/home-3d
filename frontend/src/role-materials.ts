// Materials per colour role (#40): each role a placed item is drawn in can take a material, so one sofa is grey
// fabric and the conservatory chairs are rattan. Only the realistic look shows them (lit, procedural, no images);
// neon and the other looks ignore them. Pure data and helpers, no three.js: the editor and the 3D bundle share them.

import type { ColourRole } from "./colour-roles.ts";

/** The materials, in the order the item panel offers them; the index is the number the shader reads (matt = 0). */
export const MATERIALS = ["matt", "gloss", "fabric", "glass", "metal", "rattan"] as const;

export type Material = (typeof MATERIALS)[number];

/** A placed item's own materials: role → material. Missing roles take their usual one. */
export type RoleMaterials = Partial<Record<ColourRole, Material>>;

/** The usual material of a role when the item has none of its own. */
const USUAL: Partial<Record<ColourRole, Material>> = {
  fabric: "fabric",
  cushion: "fabric",
  metal: "metal",
  glass: "glass",
  white: "gloss",
  paint: "gloss",
};

const isMaterial = (m: unknown): m is Material => typeof m === "string" && (MATERIALS as readonly string[]).includes(m);

/** The material a role is drawn in: the item's own or the role's usual one. */
export function roleMaterial(materials: RoleMaterials | null | undefined, role: ColourRole): Material {
  const own = materials?.[role];
  return isMaterial(own) ? own : usualMaterial(role);
}

/** The material a role takes when the item has none of its own. */
export function usualMaterial(role: ColourRole): Material {
  return USUAL[role] ?? "matt";
}

/** The item's own material for a role, or null when it takes the usual one. */
export function ownMaterial(materials: RoleMaterials | null | undefined, role: ColourRole): Material | null {
  const own = materials?.[role];
  return isMaterial(own) ? own : null;
}

/** The materials with `role` set to `material`, or cleared when it is null or not a material; null when none are left. */
export function setRoleMaterial(materials: RoleMaterials | null | undefined, role: ColourRole, material: Material | null): RoleMaterials | null {
  const next: RoleMaterials = { ...materials };
  if (isMaterial(material)) next[role] = material;
  else delete next[role];
  return Object.keys(next).length ? next : null;
}

/** The number the realistic look's shader reads per vertex (0 = matt, also for surfaces drawn without materials). */
export function materialId(material: Material): number {
  return MATERIALS.indexOf(material);
}
