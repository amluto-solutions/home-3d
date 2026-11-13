// The colours the house is built with (#436, ported from NeonPlan 3D 3.1, MIT, (c) 2026 Mastershort): the neon ones,
// which every look and palette style recolours in the shader, or natural materials for the homely styles (wood floors,
// light walls, fabric and wood furniture, white window frames, a grey roof). Switching between them builds the house
// once; nothing is added per frame. Several views on a page share this module: each sets its own palette (and the
// light look, furniture.ts) before it models anything (viewer3d.ts `usePalette`).

let natural = false;
let cutTop: number | null = null;
let tints = false;
let facade: number | null = null;

/** Every colour table: the object the models read, and its two sets of colours. */
const tables: { live: object; neon: object; nat: object }[] = [];

/** Natural materials on or off, with the colour of the cut wall tops (null: light like the walls). Whether anything changed. */
export function setNaturalPalette(on: boolean, top: number | null = null): boolean {
  const t = on ? top : null;
  const changed = on !== natural || t !== cutTop;
  natural = on;
  cutTop = t;
  // the tables take the colours in place: the models read plain properties (modelling reads them very often)
  if (changed) for (const tb of tables) Object.assign(tb.live, natural ? tb.nat : tb.neon);
  return changed;
}

export function naturalPalette(): boolean {
  return natural;
}

/** What the models are built from now: a part of every cache key of modelled pieces. */
export function paletteKey(): string {
  return (natural ? `nat${cutTop ?? ""}` : "") + (tints ? `w${facade ?? ""}` : "");
}

/**
 * The mark of a wall colour in the geometry (#437): its vertex colour is stored this much too high on each channel
 * (a colour never reaches it otherwise), the themed shader takes it off and lets the colour through as it is (the
 * styles and Realistic turn the neon colours grey otherwise; floors have their exact tints for this).
 */
export const WALL_TINT = 2;

/** "#rrggbb" as a colour number, null for anything else (a wall colour, the facade colour: #437). */
export function hexColor(hex: string | null | undefined): number | null {
  return typeof hex === "string" && /^#[0-9a-fA-F]{6}$/.test(hex) ? parseInt(hex.slice(1), 16) : null;
}

/** The parts of a building whose wall colours matter here (a Building, without importing it). */
interface Tinted {
  settings?: { facade_color?: string | null };
  floors: { rooms: { wall_color?: string | null; wall_colors?: (string | null)[] | null }[] }[];
}

/** Whether a building has a wall colour or a facade colour at all. */
export function hasWallColours(b: Tinted | null | undefined): boolean {
  return !!b && (hexColor(b.settings?.facade_color) !== null || b.floors.some((f) => f.rooms.some((r) => hexColor(r.wall_color) !== null || !!r.wall_colors?.some((c) => hexColor(c) !== null))));
}

/**
 * Wall colours on or off (#437): they are built into the walls only where they show (the Homely styles and Realistic;
 * Neon and the other looks keep their own wall colour), with the facade colour (null: the outer sides stay like the
 * walls). Whether anything changed.
 */
export function setWallTints(on: boolean, facadeHex: string | null | undefined = null): boolean {
  const f = on ? hexColor(facadeHex) : null;
  const changed = on !== tints || f !== facade;
  tints = on;
  facade = f;
  return changed;
}

/** Wall colours are built into the walls now. */
export function wallTinting(): boolean {
  return tints;
}

/** The colour of the outer sides of the walls (null: like the walls). */
export function facadeColor(): number | null {
  return facade;
}

/** The colour of cut wall tops in the natural palette (null = light, like the walls). */
export function cutTopColor(): number | null {
  return cutTop;
}

/**
 * A colour table that holds its natural twin's colours while natural materials are on (a getter in the twin is read
 * each time the palette changes).
 */
export function palette<T extends object>(neon: T, nat: T): T {
  const live = { ...neon };
  tables.push({ live, neon: { ...neon }, nat });
  if (natural) Object.assign(live, nat);
  return live;
}
