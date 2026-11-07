// Colour roles (#12): every part of a furniture model is drawn in one of these roles, and the theme gives each role
// its colour. A placed item can override any of its roles with a colour of its own ("#rrggbb", picked freely or
// from a named preset); a role without an override follows the theme. Pure data and helpers, no three.js: the
// editor, the 3D bundle and later looks and materials (#39, #40) share this list.

import { COLOUR_ROLES } from "./item-format.ts";
import { isPackType, packItem } from "./packs.ts";

/** The colour roles, in the order the item panel lists them (item-format.ts holds them, as the backend does). */
export { COLOUR_ROLES };

export type ColourRole = (typeof COLOUR_ROLES)[number];

/** A placed item's overrides: role → "#rrggbb". Missing roles follow the theme. */
export type RoleColours = Partial<Record<ColourRole, string>>;

const HEX = /^#[0-9a-f]{6}$/i;

/** A car's paint: ten base colours (#129) for the `paint` role; the i18n key is `paint_<id>`. */
export const PAINT_COLOURS: readonly ColourPreset[] = [
  { id: "white", hex: "#f2f2ee" },
  { id: "black", hex: "#1b1c1f" },
  { id: "silver", hex: "#b9bdc3" },
  { id: "grey", hex: "#6c7075" },
  { id: "blue", hex: "#2f63b5" },
  { id: "red", hex: "#b3262d" },
  { id: "green", hex: "#2f6b45" },
  { id: "orange", hex: "#e08a1e" },
  { id: "bronze", hex: "#7d5a3a" },
  { id: "dark_blue", hex: "#17274a" },
];

/** A typed colour: "#rrggbb", "rrggbb" or "#rgb" (any case, spaces round it) as lower-case "#rrggbb"; null when it is none. */
export function parseHex(text: string): string | null {
  const t = text.trim().replace(/^#/, "").toLowerCase();
  if (/^[0-9a-f]{3}$/.test(t)) return `#${t[0]}${t[0]}${t[1]}${t[1]}${t[2]}${t[2]}`;
  return /^[0-9a-f]{6}$/.test(t) ? `#${t}` : null;
}

/** An item's own colour for a role ("#rrggbb"), or null when the role follows the theme. */
export function roleColour(colors: RoleColours | null | undefined, role: ColourRole): string | null {
  const hex = colors?.[role];
  return typeof hex === "string" && HEX.test(hex) ? hex : null;
}

/** A pack item's own colour for a role (#404), as its recipe gives it: what the role shows while the placed item has none. */
export function itemRoleColour(type: string, role: ColourRole): string | null {
  return roleColour(packItem(type)?.colors as RoleColours | undefined, role);
}

/**
 * The role colours an item is drawn in (#404): the placed item's own over its pack item's (a car's colourway), so
 * clearing a colour goes back to the item's own one, and a role with neither follows the look.
 */
export function drawnColours(type: string | undefined, colors: RoleColours | null | undefined): RoleColours | null | undefined {
  const defaults = type ? (packItem(type)?.colors as RoleColours | undefined) : undefined;
  return defaults ? { ...defaults, ...colors } : colors;
}

/** A named colour to pick from. */
export interface ColourPreset {
  id: string;
  hex: string;
}

/** Named presets for the item panel; the i18n key is `colour_preset_<id>`. */
export const COLOUR_PRESETS: readonly ColourPreset[] = [
  { id: "oak", hex: "#c09a6b" },
  { id: "walnut", hex: "#5c4033" },
  { id: "rattan", hex: "#c8a46e" },
  { id: "white_gloss", hex: "#f4f4f1" },
  { id: "black", hex: "#222326" },
  { id: "grey_fabric", hex: "#8a8c8f" },
  { id: "beige_fabric", hex: "#d6c8ae" },
  { id: "navy_fabric", hex: "#2e3f66" },
  { id: "green_velvet", hex: "#3f6b4f" },
  { id: "brass", hex: "#b5a14a" },
  { id: "chrome", hex: "#c8ccd2" },
  { id: "terracotta", hex: "#c0643f" },
  // IKEA finishes, for the IKEA UK pack's colourways (#30)
  { id: "black_brown", hex: "#3a2f2a" },
  { id: "white_stained_oak", hex: "#dccfb8" },
  { id: "birch", hex: "#dcc39a" },
  { id: "pine", hex: "#d8b27a" },
  { id: "acacia", hex: "#8a5a36" },
  { id: "anthracite", hex: "#45484c" },
  // metals, glass and leaves, so each part family has colours of its own (#410)
  { id: "steel", hex: "#9aa1a8" },
  { id: "copper", hex: "#b0643a" },
  { id: "clear_glass", hex: "#cfe3ea" },
  { id: "frosted_glass", hex: "#e8eef1" },
  { id: "smoked_glass", hex: "#4b5359" },
  { id: "leaf_green", hex: "#4f7a3a" },
  { id: "dark_green", hex: "#2c4a2e" },
  { id: "olive", hex: "#7a7d3c" },
];

/** The roles a built-in model is drawn in (the furniture tests check this against the models). Lamps have none. */
const BUILTIN_ROLES: Record<string, string> = {
  radiator: "white metal",
  ac_unit: "white dark",
  sofa: "fabric cushion wood",
  sofa_l: "fabric cushion wood",
  sofa_u: "fabric cushion wood",
  armchair: "fabric cushion wood",
  stool: "fabric cushion wood",
  coffee_table: "body wood",
  tv_board: "body metal dark",
  tv_wall: "metal dark",
  sideboard: "wood metal",
  shelf: "body fabric cushion wood",
  plant: "wood plant pot",
  rug: "fabric",
  table: "body wood",
  table_round: "wood metal",
  chair: "cushion wood",
  bench: "cushion wood",
  corner_bench: "cushion wood",
  bar_stool: "fabric cushion metal",
  kitchen: "body white dark",
  kitchen_wall: "body",
  kitchen_tall: "body dark",
  island: "body white dark",
  worktop: "white",
  sink: "body white metal dark",
  stove: "body dark",
  dishwasher: "body white dark",
  fridge: "white",
  bed: "fabric cushion wood white",
  bunk_bed: "wood white",
  nightstand: "body dark",
  wardrobe: "body dark",
  dresser: "wood dark",
  bathtub: "white metal glass",
  shower: "white metal",
  wc: "white",
  washbasin: "body white metal dark glass",
  washer: "white",
  dryer: "white",
  desk: "body wood metal dark",
  office_chair: "fabric cushion metal dark",
  tall_cabinet: "body dark",
  coat_rack: "body wood metal",
  stairs: "wood",
  stairs_u: "wood",
  robot_vacuum: "white accent",
  inverter: "white dark",
  home_battery: "white dark",
  wallbox: "body dark",
  meter: "white dark",
  grid_point: "body dark",
  pool_pump: "body metal dark glass",
  pool_filter: "body metal dark",
  pool_heat_pump: "white dark",
  pool_dosing: "white glass",
  pool_valve: "metal dark accent",
  fridge_smart: "body dark accent",
  loft_ladder: "white metal",
  awning: "body fabric accent",
  waste_bin: "metal dark",
  mailbox: "metal dark",
  wall_switch: "white",
  wall_socket: "white dark",
  wifi_ap: "white metal",
  water_heater: "white dark",
};

/** The roles an item is drawn in, in panel order: a pack item's from its parts, a built-in's from its model. */
export function itemColourRoles(type: string): ColourRole[] {
  const item = packItem(type);
  if (item) {
    const used = new Set(item.parts.flatMap((p) => [p.color, p.top]));
    return COLOUR_ROLES.filter((r) => used.has(r));
  }
  // a pack item whose pack is gone is drawn as a plain body box
  if (isPackType(type)) return ["body"];
  const roles = BUILTIN_ROLES[type];
  return roles ? (roles.split(" ") as ColourRole[]) : [];
}

/** The overrides with `role` set to `hex` (lower case), or cleared when `hex` is null or not a colour; null when none are left. */
export function setRoleColour(colors: RoleColours | null | undefined, role: ColourRole, hex: string | null): RoleColours | null {
  const next: RoleColours = { ...colors };
  if (hex && HEX.test(hex)) next[role] = hex.toLowerCase();
  else delete next[role];
  return Object.keys(next).length ? next : null;
}
