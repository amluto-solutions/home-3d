// Furniture from imported packs (format: docs/packs.md, checked by custom_components/home_3d/packs.py). A pack id
// is "publisher.pack", an item's full id "publisher.pack/item_id"; in a plan, pack furniture has the type
// "pack:<pack id>:<item id>". Every bundle (main, editor, 3D) keeps its own
// registry, filled with setPacks() from the packs the backend returns.

import { builtinBase, techBase, ELECTRIC_FURNITURE, type Building, FURNITURE_SIZE, LIFT_SPOTS, outdoorGround, pointInPolygon, spotDepth, surfaceHeight, WALL_LAMP_Y, type Floor, type Furniture } from "./model.ts";
import type { LampModel } from "./viewer/viewer3d.ts";
import type { RackFrameSpec } from "./rack-frame.ts";
import type { RackGearSpec } from "./rack.ts";

/** A cooking zone of a pack cooktop: a thin disc lying on the item's top. */
export function isCooktopZone(p: Pick<PackPart, "shape" | "y" | "h" | "axis">): boolean {
  return p.shape === "cyl" && (p.axis ?? "y") === "y" && p.y > 0.9 && p.h < 0.02;
}

/** A pack item with a cooktop (a hob unit, a cooker, an island with a hob): its zones glow while it cooks. */
export function isPackCooktop(type: string): boolean {
  const item = packItem(type);
  return !!item && /(hob|cooker|stove)/.test(type) && item.parts.filter(isCooktopZone).length >= 2;
}

export interface PackPart {
  /**
   * A box, a cylinder, a loft (a box whose top face is another rectangle: sloped sides), a sphere filling the part's
   * box, a lathe (`profile` turned around the upright axis), a box with rounded edges (`round`) or a curved shell
   * lofted through side and plan stations (`side`, `plan`, #252).
   */
  shape: "box" | "cyl" | "loft" | "sphere" | "lathe" | "rbox" | "shell";
  /** Centre across and in depth (fractions -0.5..0.5 of the item's width and depth, front at +z). */
  x: number;
  z: number;
  /** Extent in fractions of the item's width and depth; a cylinder's diameter is the smaller one. */
  w: number;
  d: number;
  /** Bottom and height in fractions of the item's height. */
  y: number;
  h: number;
  /** "#rrggbb" or a palette role ("body", "fabric", "wood", …). */
  color: string;
  top?: string;
  /** Outline: true (soft blue), "glow" (cyan like the walls) or "faint". */
  edges?: boolean | "glow" | "faint";
  /** Lamps: shines in the colour and brightness of the linked light. */
  glow?: boolean;
  /** A screen: shows the linked media player's app colour and picture on its front (+z). */
  screen?: boolean;
  /** The measures that stay when the item is resized: "w", "d", "h" or several ("wdh"). */
  fix?: string;
  /** Loft: centre and extent of the top rectangle (defaults: the same as the bottom). */
  tx?: number;
  tz?: number;
  tw?: number;
  td?: number;
  /** Cylinder axis: upright (y, default) or lying along x or z (wheels, pipes, rollers). */
  axis?: "x" | "y" | "z";
  /** Turn of the part around its own centre (degrees around the vertical axis). */
  rot?: number;
  /** Lathe: [radius, height] points, the radius a fraction of the part's half width and depth, the height of its height. */
  profile?: [number, number][];
  /**
   * Rounded box: the radius of its edges as a fraction of the part's shortest side (0.01 to 0.5, default 0.2). Shell:
   * the corner radius of its cross-sections as a fraction of their shorter side (default 0.25).
   */
  round?: number;
  /** Shell (#252): side-view stations [z, bottom, top] from the part's back (z 0) to its front (z 1), 2 to 16. */
  side?: [number, number, number][];
  /** Shell: plan-view widths [z, width] along it (default: the part's whole width). */
  plan?: [number, number][];
  /** Shell: the width at the top of its cross-sections against their bottom (0.1 to 1.5, default 1). */
  taper?: number;
}

export type PackSymbol =
  | { shape: "rect"; x: number; z: number; w: number; d: number; fill?: boolean }
  | { shape: "circle"; x: number; z: number; r: number }
  | { shape: "line"; x1: number; z1: number; x2: number; z2: number };

export interface PackItem {
  id: string;
  /** Names by language code. */
  name: Record<string, string>;
  /** Default width, depth, height (metres). */
  size: [number, number, number];
  electric?: boolean;
  /** On the floor, on the furniture below, on a wall (bottom at wall_y) or hanging from the ceiling. */
  mount?: "floor" | "surface" | "wall" | "ceiling";
  wall_y?: number;
  /** Its top carries other items. */
  surface?: boolean;
  /** A vehicle: offered for parking spots. */
  vehicle?: boolean;
  /** Its own colour per role (#404, role → "#rrggbb"): what the role shows while the placed item has none of its own. */
  colors?: Partial<Record<string, string>>;
  /** What its part in a role is called (#411, role → a PART_NAMES name): the item panel's name of that colour row. */
  role_names?: Partial<Record<string, string>>;
  /** Stairs: cuts a stairwell opening into the floor above when it reaches it. */
  hole?: boolean;
  /** A lamp: how its light spreads. */
  light?: LampModel;
  /** Parts (fractions of the size); a part's `fix` ("w", "d", "h" or several) keeps that measure when the item is resized. */
  parts: PackPart[];
  symbol?: PackSymbol[];
  /** Library (pack format since 1.23): what it is, the rooms it is made for, words that find it. */
  group?: string;
  room?: string[];
  tags?: string[];
  /** Variants of one thing (a table in three lengths) share a family; the variant names the chip, by language. */
  family?: string;
  variant?: Record<string, string>;
  /** The IKEA product name (such as "KALLAX"): the library finds the item by it as well as by its readable name. */
  ikea?: string;
  /** An empty rack that gear can be fitted into (#112; rules in rack-frame.ts). */
  rack_frame?: RackFrameSpec;
  /** Rack-mount gear that fits into a rack (#113; rules in rack.ts). */
  rack?: RackGearSpec;
  /** Estimated typical power draw in watts (#114): a rack's total adds up its gear's. */
  watts?: number;
}

/**
 * An item as the library lists it (#44): everything but its recipe, enough to browse, search, filter and size it. The
 * recipe (`parts`, `symbol`) comes on demand (pack-recipes.ts) and is then filled into this very object, so every
 * bundle handed the same packs has it.
 */
export type PackItemInfo = Omit<PackItem, "parts" | "symbol"> & Partial<Pick<PackItem, "parts" | "symbol">>;

export interface FurniturePack {
  /** "home3d-pack" (v2, a folder) or "fp3dpack" (an old single file). */
  format?: string;
  version?: number;
  /** "publisher.pack". */
  id: string;
  /** What the pack holds (#196): furniture (missing) or the texts of a language. */
  kind?: "furniture" | "language";
  /** A language pack's language, a base code such as "de". */
  language?: string;
  /** How many texts a language pack has (the texts themselves come with languages/get). */
  texts?: number;
  name: string;
  publisher: string;
  /** The licence the pack declares (an SPDX id such as "MIT"); null or missing for old single-file packs. */
  licence?: string | null;
  description?: string;
  /** Release number; a newer release of the same id replaces the installed one. */
  release?: number;
  /** One line on what this release changed (#288). */
  release_note?: string;
  /** Feature names the pack lists (compatibility only; see features.ts). */
  features?: string[];
  /** "sha256:…" of the pack's items (#44): fetched recipes are kept while it stays. */
  hash?: string;
  /** The library's index of the items; an item has its recipe once fetched (or always, for the household's own). */
  items: PackItemInfo[];
  imported_at?: number;
  /** Ships with Home 3D (custom_components/home_3d/bundled_packs): there offline, cannot be removed. */
  bundled?: boolean;
  /** The household's own items, made in the item editor (#13; see custom-items.ts). */
  custom?: boolean;
  /** What was imported: the files of a v2 folder (or an old pack's payload), and where it came from (#25). */
  source?: { files?: Record<string, string>; origin?: PackOrigin };
  /**
   * The old ids of items that moved into this pack from another (#110, the backend's moved_items.json): old type
   * ("pack:<old pack>:<old item>") -> the item's id here. An old id still resolves to the item.
   */
  aliases?: Record<string, string>;
}

/** Where a pack installed from a GitHub URL came from (#25); an update check compares `commit` (#26). */
export interface PackOrigin {
  type: "github";
  /** The pasted URL in its plain form. */
  url: string;
  owner: string;
  repo: string;
  /** The branch, tag or commit the URL named, or the default branch. */
  ref: string;
  /** True when the URL named no ref, so the pack follows the repository's default branch. */
  default_branch: boolean;
  /** The pack folder inside the repository; "" for the repository root. */
  folder: string;
  /** The commit the files were fetched at. */
  commit: string;
  /** The pack's release number when it was fetched. */
  release?: number;
  fetched_at?: number;
}

/** Where an installed pack came from, for the pack list: null for a pack imported from files. */
export function packOrigin(pack: FurniturePack): { label: string; url: string } | null {
  const origin = pack.source?.origin;
  if (origin?.type !== "github") return null;
  const path = [origin.owner, origin.repo, origin.folder].filter(Boolean).join("/");
  // the commit the files came from stays visible (#189): a branch moves, a commit does not
  const commit = origin.commit ? ` · ${origin.commit.slice(0, 7)}` : "";
  return { label: `${origin.default_branch ? path : `${path} @ ${origin.ref}`}${commit}`, url: origin.url };
}

/**
 * The plan's copy of a placed pack item's recipe (#2), in `Building.recipes` by furniture type. One copy per type,
 * however often it is placed; the views draw the copy, so removing a pack or installing a newer release never changes
 * a placed item. The backend fills it in (custom_components/home_3d/recipes.py); an update replaces it (#26).
 */
export interface PlanRecipe {
  /** Pack id and item id the copy was taken from. */
  pack: string;
  item: string;
  /** The pack's release then. */
  release: number;
  /** "sha256:…" of the recipe, to compare with the installed item. */
  hash: string;
  /** The commit its files came from, for a pack installed from GitHub. */
  commit?: string | null;
  recipe: PackItem;
}

let registry: FurniturePack[] = [];
let items = new Map<string, PackItemInfo>();
/** Old type -> new type of the items that moved between packs (#110). */
let moved = new Map<string, string>();
let planItems = new Map<string, PackItem>();
let planRecipes: Record<string, PlanRecipe> | undefined;
let planKey = "";
let version = 0;

/**
 * Lets a thumbnail draw from `packs` without telling the 3D view anything changed (#175): the registry is brought up to
 * date but the version stays, so the scene is not rebuilt for a picture. The same list again does nothing.
 */
export function usePacksQuietly(packs: FurniturePack[]): void {
  if (packs === registry) return;
  setPacks(packs, true);
}

export function setPacks(packs: FurniturePack[], quiet = false): void {
  // recipes fetched for a pack that is still the same (its hash) stay with the new list
  for (const pack of packs) {
    const before = pack.hash ? registry.find((p) => p.id === pack.id && p.hash === pack.hash) : undefined;
    if (!before || before === pack) continue;
    for (const it of pack.items) {
      const had = !hasRecipe(it) ? items.get(packType(pack.id, it.id)) : undefined;
      if (had && hasRecipe(had)) addRecipe(it, had);
    }
  }
  registry = packs;
  items = new Map(packs.flatMap((p) => p.items.map((it) => [packType(p.id, it.id), it] as const)));
  moved = new Map(packs.flatMap((p) => Object.entries(p.aliases ?? {}).map(([old, id]) => [old, packType(p.id, id)] as const)));
  // an old id finds the moved item, unless a pack still offers an item under it
  for (const [old, type] of moved) {
    const entry = items.get(type);
    if (entry && !items.has(old)) items.set(old, entry);
  }
  if (!quiet) version++;
}

/** The type an item has now: its new type when it moved to another pack (#110), else itself. */
export function resolvePackType(type: string): string {
  return moved.get(type) ?? type;
}

/**
 * A plan with every moved item under its new type (#110): placed items, parking spots' vehicles, rack gear and the plan's
 * recipe copies with their keys (the backend checks a copy again and gives it its hash). The same object when
 * nothing moved; the backend migrates whatever reaches it as well.
 */
export function migratePlanTypes(building: Building): Building {
  const had = (t: string | null | undefined): t is string => !!t && resolvePackType(t) !== t;
  // gear in a rack is placed by slot type (#113)
  const itemMoved = (f: Furniture): boolean => had(f.type) || had(f.vehicle) || (f.types ?? []).some((t) => had(t.vehicle)) || (f.rack?.slots ?? []).some((s) => had(s.type));
  const furnitureMoved = building.floors.some((fl) => fl.furniture.some(itemMoved));
  const recipes = building.recipes ?? {};
  const recipesMoved = Object.keys(recipes).some(had);
  if (!furnitureMoved && !recipesMoved) return building;
  const to = resolvePackType;
  const floors = building.floors.map((fl) => ({
    ...fl,
    furniture: fl.furniture.map((f) =>
      itemMoved(f)
        ? {
            ...f,
            type: to(f.type),
            ...(f.vehicle ? { vehicle: to(f.vehicle) } : {}),
            ...(f.types ? { types: f.types.map((t) => ({ ...t, vehicle: to(t.vehicle) })) } : {}),
            ...(f.rack ? { rack: { ...f.rack, slots: f.rack.slots.map((s) => (had(s.type) ? { ...s, type: to(s.type) } : s)) } } : {}),
          }
        : f,
    ),
  }));
  const next: Record<string, PlanRecipe> = {};
  for (const [type, copy] of Object.entries(recipes)) {
    const target = to(type);
    if (target === type) {
      next[type] ??= copy;
      continue;
    }
    // a plan that already has a copy under the new type keeps that one
    if (recipes[target]) continue;
    const [, pack, item] = target.split(":");
    // the release named the old pack's
    next[target] = { ...copy, pack, item, release: 1, recipe: { ...copy.recipe, id: item } };
  }
  return { ...building, floors, ...(building.recipes ? { recipes: next } : {}) };
}

/** Whether a listed item has its recipe (fetched, or sent whole). */
export function hasRecipe(item: PackItemInfo): item is PackItem {
  return Array.isArray(item.parts);
}

function addRecipe(entry: PackItemInfo, recipe: PackItem): void {
  entry.parts = recipe.parts;
  if (recipe.symbol) entry.symbol = recipe.symbol;
}

/** The ids of the listed items of `types` that have no recipe yet, by pack id; other types are left out. */
export function missingRecipes(types: readonly string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const type of new Set(types)) {
    const entry = items.get(type) ?? items.get(resolvePackType(type));
    if (!entry || hasRecipe(entry)) continue;
    // an old id (#110) asks the pack its item moved into
    const at = items.get(resolvePackType(type)) === entry ? resolvePackType(type) : type;
    const pack = registry.find((p) => at === packType(p.id, entry.id));
    if (pack) out.set(pack.id, [...(out.get(pack.id) ?? []), entry.id]);
  }
  return out;
}

/**
 * Recipes fetched for a pack (`packs/items`): they go into the listed items, when the pack is still the one listed
 * (`hash`). The version stays: what was drawn before had no recipe and asked for it.
 */
export function addRecipes(packId: string, hash: string | undefined, recipes: readonly PackItem[]): void {
  const pack = registry.find((p) => p.id === packId);
  if (!pack || (pack.hash && hash && pack.hash !== hash)) return;
  for (const recipe of recipes) {
    const entry = items.get(packType(packId, recipe.id));
    if (entry && !hasRecipe(entry) && Array.isArray(recipe.parts)) addRecipe(entry, recipe);
  }
}

export function getPacks(): readonly FurniturePack[] {
  return registry;
}

/**
 * The plan's recipe copies (#2): a placed item is drawn from its copy before the installed packs. Hand over the plan's
 * `recipes` whenever the plan arrives; the same copies again change nothing.
 */
export function setPlanRecipes(recipes: Record<string, PlanRecipe> | undefined): void {
  if (recipes === planRecipes) return;
  planRecipes = recipes;
  const entries = Object.entries(recipes ?? {});
  const key = entries.map(([type, r]) => `${type}=${r.hash}`).sort().join("|");
  if (key === planKey) return;
  planKey = key;
  planItems = new Map(entries.map(([type, r]) => [type, r.recipe] as const));
  version++;
}

/** The hash of each recipe copy by type: sent with a save that changes no copy, so the backend keeps newer ones (#45). */
export function recipeHashes(recipes: Record<string, PlanRecipe> | undefined): Record<string, string> {
  return Object.fromEntries(Object.entries(recipes ?? {}).map(([type, copy]) => [type, copy.hash]));
}

/** The plan recipes last handed over (for another bundle's registry). */
export function getPlanRecipes(): Record<string, PlanRecipe> | undefined {
  return planRecipes;
}

/** Changes with every setPacks() and every new set of plan recipes, to notice new packs. */
export function packsVersion(): number {
  return version;
}

/** The furniture type the item editor (#13) draws the item being edited as; no plan holds it. */
export const DRAFT_TYPE = "pack:household.draft:item";

/**
 * Run `fn` while `type` stands for `item` (the item editor's live picture): the installed packs and their version
 * stay as they are, so no view rebuilds for it.
 */
export function withPackItem<T>(type: string, item: PackItem, fn: () => T): T {
  const before = items.get(type);
  items.set(type, item);
  try {
    return fn();
  } finally {
    if (before) items.set(type, before);
    else items.delete(type);
  }
}

export function packType(packId: string, itemId: string): string {
  return `pack:${packId}:${itemId}`;
}

export function isPackType(type: string): boolean {
  return type.startsWith("pack:");
}

/**
 * Pack items with parts that move with a cover (#511): a motorised curtain opens to both sides, a roll-down projection
 * screen comes down from its roller, a roof window's blind runs down the slope from its top edge (#24:
 * `roof_window_…_blind`). The packs stay as they are; Home 3D knows these items by their id.
 */
export type PackMotion = "curtain" | "screen" | "blind";

export function packMotion(type: string): PackMotion | null {
  if (!isPackType(type)) return null;
  if (type.endsWith(":curtain_motor")) return "curtain";
  if (type.endsWith(":screen_roll")) return "screen";
  if (/:roof_window[\w.-]*_blind$/.test(type)) return "blind";
  return null;
}

/**
 * The parts that move: the curtain's fabric; the screen's cloth and bottom bar (everything but its roller); the roof
 * window blind's fabric (not its roller box).
 */
export function packMovingPart(kind: PackMotion, p: PackPart): boolean {
  if (kind === "curtain") return p.color === "fabric";
  if (kind === "blind") return p.color === "fabric" && p.shape !== "cyl";
  return p.shape !== "cyl";
}

/** Families of pack items that report through sensors: sensor models, smart water meters, smoke / CO / heat alarms (#79). */
const PACK_SENSOR_FAMILIES = new Set(["sensor", "water_meter", "smoke_alarm"]);

/**
 * A generic marker (#79): a sensor or switch placeholder that takes any entity, to stand for a device Home 3D has no
 * model for. Pack items of the family `entity_marker`.
 */
export function isEntityMarker(type: string): boolean {
  return isPackType(type) && packInfo(type)?.family === "entity_marker";
}

/**
 * A pack's sensor model (motion, mmWave presence, contact, leak, CO₂, temperature …): it follows a sensor of its own,
 * whatever class the integration gave it (Local Tuya's motion sensors have none, #810).
 */
export function isPackSensor(type: string): boolean {
  if (!isPackType(type)) return false;
  return PACK_SENSOR_FAMILIES.has(packInfo(type)?.family ?? "") || /:(\w+_sensor|door_contact|presence_mmwave)$/.test(type);
}

/** A robot vacuum: the built-in dock, or one from a pack (the smart home pack's robot with its dock, #470). */
export function isRobotVacuum(type: string): boolean {
  return type === "robot_vacuum" || (isPackType(type) && type.endsWith(":robot_vacuum"));
}

/**
 * A pack's robot vacuum model shows the dock at the back and the robot in front of it (+z). The robot's own parts
 * are left out of the static model and drive around as the viewer's robot instead (#645).
 */
export function packRobotPart(p: Pick<PackPart, "z">): boolean {
  return p.z > 0.05;
}

/** Where the pack's robot sits in its model: the centre of its largest disc (fraction of the depth; 0.227 when unknown). */
export function packRobotCentre(item: PackItem | undefined): number {
  const discs = (item?.parts ?? []).filter((p) => p.shape === "cyl" && packRobotPart(p));
  if (!discs.length) return 0.227;
  return discs.reduce((a, b) => (b.w * b.d > a.w * a.d ? b : a)).z;
}

/**
 * A pack's heater with hot water (a heat pump's indoor unit, a gas boiler, a buffer tank, a hot water tank or cylinder): besides a
 * climate entity it takes a water_heater entity like the built-in water heater (#645).
 */
export function isPackHeater(type: string): boolean {
  return isPackType(type) && /:(heat_pump_indoor|gas_boiler|combi_boiler(?:_[a-z0-9_]+)?|buffer_tank|water_heater|hot_water_cylinder(?:_[a-z0-9_]+)?)$/.test(type);
}

/** What an item is in the energy flow: where the cables meet (meter), a source (solar, inverter, battery) or a wallbox. */
export type EnergyRole = "meter" | "inverter" | "home_battery" | "wallbox" | "solar";

const ENERGY_FAMILIES: Record<string, EnergyRole> = {
  meter: "meter",
  consumer_unit: "meter",
  energy_monitor: "meter",
  inverter: "inverter",
  home_battery: "home_battery",
  power_station: "home_battery",
  ev_charger: "wallbox",
  solar_panel: "solar",
};

/**
 * The energy role of a furniture type (#22): the built-in meter, inverter, home battery and wallbox, and pack items
 * by their family: a consumer unit or CT clamp box (`energy_monitor`) is the meter, a portable power station a battery,
 * an EV charger a wallbox and a solar panel a source of its own. A pack's gas or water meter is no power meter.
 */
const roles = new Map<string, { v: number; role: EnergyRole | null }>();

/** (Kept per type while the packs stay, #393: asked for every item on every 3D sync.) */
export function energyRole(type: string): EnergyRole | null {
  const had = roles.get(type);
  if (had && had.v === version) return had.role;
  const role = energyRoleNow(type);
  roles.set(type, { v: version, role });
  return role;
}

function energyRoleNow(type: string): EnergyRole | null {
  if (type === "meter" || type === "inverter" || type === "home_battery" || type === "wallbox") return type;
  const item = packInfo(type);
  const role = item?.family ? (ENERGY_FAMILIES[item.family] ?? (/^ev_charger_/.test(item.family) ? "wallbox" : null)) : null;
  if (role === "meter" && (item!.tags ?? []).some((t) => /^(gas|water)$/i.test(t))) return null;
  return role;
}

/** The screen part of a pack item (a TV or monitor), if it has one. */
export function packScreen(type: string): PackPart | undefined {
  return packItem(type)?.parts.find((p) => p.screen);
}

/**
 * A pack TV with Ambilight: an item with a screen whose glowing parts (strips round its back) are no lamp. They shine
 * in the screen's colour whenever the screen is lit, as Ambilight does, not only while it plays like a speaker's ring.
 */
export function packAmbilight(type: string): boolean {
  const item = packItem(type);
  return !!item && !item.light && item.parts.some((p) => p.screen) && item.parts.some((p) => p.glow);
}

/**
 * A pack item with a real display (a TV, a monitor, a smart display) rather than a small status light (a
 * printer's panel, a wallbox's LED): one of its screen parts is at least 6 cm on both sides of its face.
 */
export function packDisplay(type: string): boolean {
  const item = packItem(type);
  if (!item) return false;
  const [W, D, H] = item.size;
  return item.parts.some((p) => {
    if (!p.screen) return false;
    const [a, b] = [p.w * W, p.d * D, p.h * H].sort((x, y) => y - x);
    return a >= 0.06 && b >= 0.06;
  });
}

/**
 * The pack item of a furniture type with its recipe: the plan's copy (#2), else the installed item once its recipe is
 * there (#44: pack-recipes.ts fetches it). Undefined while neither is: nothing draws an item without its recipe.
 */
export function packItem(type: string): PackItem | undefined {
  if (!isPackType(type)) return undefined;
  const listed = items.get(type);
  return planItems.get(type) ?? (listed && hasRecipe(listed) ? listed : undefined);
}

/** What the library knows of a pack item, with or without its recipe: names, size, mount, kind (#44). */
export function packInfo(type: string): PackItemInfo | undefined {
  if (!isPackType(type)) return undefined;
  // an old id (#110, #424) finds the item it is now
  return planItems.get(type) ?? items.get(type) ?? items.get(resolvePackType(type));
}

/**
 * What a pack item calls its parts by role (#411). Names are text, not geometry: the installed pack's, so a plan's
 * older recipe copy of the item (the Sample Home's) shows them too; the copy's when the pack is gone.
 */
export function packRoleNames(type: string): Partial<Record<string, string>> | undefined {
  if (!isPackType(type)) return undefined;
  return items.get(type)?.role_names ?? planItems.get(type)?.role_names;
}

/** Default size of any furniture type. */
export function furnitureSize(type: string): [number, number, number] {
  return (FURNITURE_SIZE as Record<string, [number, number, number]>)[type] ?? packInfo(type)?.size ?? [0.6, 0.6, 0.8];
}

/** Whether a type can be linked with entities (power sensor, switch …). */
export function isElectric(type: string): boolean {
  // a pack item that only lights (a mirror with light, an aquarium) links a light like any lamp;
  // a radiator with a TRV or a smart valve links its thermostat like the built-in radiator (#81)
  const item = packInfo(type);
  return ELECTRIC_FURNITURE.has(type) || !!item?.electric || !!item?.light || isThermostatItem(type);
}

const PACK_THERMOSTAT_FAMILIES = new Set(["radiator_trv", "radiator_valve", "thermostat"]);

/**
 * A radiator run by a thermostat (#81): the built-in radiator, or a pack's radiator with a TRV, a smart radiator
 * valve or a wall thermostat (by family, or tagged "trv" / "thermostat"). Its main link is a climate entity.
 */
export function isThermostatItem(type: string): boolean {
  if (type === "radiator") return true;
  const item = isPackType(type) ? packInfo(type) : undefined;
  if (!item) return false;
  return PACK_THERMOSTAT_FAMILIES.has(item.family ?? "") || (item.tags ?? []).some((t) => /^(trv|smart trv|thermostat)$/i.test(t));
}

/** A pack's camera (a security camera, a doorbell camera): by family or tag. It links a camera entity (#81). */
export function isCameraItem(type: string): boolean {
  const item = isPackType(type) ? packInfo(type) : undefined;
  if (!item) return false;
  return /camera$/.test(item.family ?? "") || (item.tags ?? []).some((t) => /^(camera|security camera|cctv|doorbell|video doorbell|doorbell camera)$/i.test(t));
}

/** Name of a pack item in a language (English, then the first name as fallback). */
export function packItemName(item: Pick<PackItemInfo, "id" | "name">, language: string): string {
  const lang = language.split("-")[0];
  return item.name[lang] ?? item.name.en ?? Object.values(item.name)[0] ?? item.id;
}


/** A pack's name as the pack file gives it. */
export function packName(pack: { id: string; name: string }, _language: string): string {
  return pack.name;
}

/** Height of the bottom of a pack item, a wall light or an LED strip above the floor (0 for other built-in furniture). */
type MountItem = Pick<Furniture, "type" | "x" | "z" | "h"> & { mount_y?: number | null; variant?: string | null };

/**
 * Kept per floor and item object (#393): a 3D sync asked for every item's base several times (markers, lamps, the
 * walk), and an item on a surface looks at the whole floor. A plan change brings new floor and item objects (the
 * editor and the panel copy the plan for every change); new packs count as a change too.
 */
const bases = new WeakMap<Floor, WeakMap<object, { v: number; sig: string; y: number }>>();

export function mountBase(floor: Floor, f: MountItem): number {
  let perItem = bases.get(floor);
  if (!perItem) bases.set(floor, (perItem = new WeakMap()));
  // the item's own fields count as well: one changed in place (a lift in the wall view) is worked out again
  const sig = `${f.type}|${f.x}|${f.z}|${f.h}|${f.mount_y ?? ""}|${f.variant ?? ""}|${floor.height}`;
  const had = perItem.get(f);
  if (had && had.v === version && had.sig === sig) return had.y;
  const y = mountBaseNow(floor, f);
  perItem.set(f, { v: version, sig, y });
  return y;
}

function mountBaseNow(floor: Floor, f: MountItem): number {
  const item = packInfo(f.type);
  if (f.mount_y != null) return f.mount_y;
  // an access point under the ceiling, a slim water heater on the wall (drawn from 0 and lifted by this)
  const tech = techBase(f, floor.height);
  if (tech !== null) return tech;
  // wall lights at the usual height, LED strips just under the ceiling
  if (f.type === "lamp_wall") return WALL_LAMP_Y;
  if (LIFT_SPOTS.has(f.type)) return Math.max(0, floor.height - spotDepth(f.type, f.h));
  if (f.type === "led_strip") return Math.max(0, floor.height - 0.04 - Math.max(0.02, f.h));
  switch (item?.mount) {
    case "surface":
      return groundUnder(floor, f) + surfaceHeight(floor, f.x, f.z, f.h);
    case "wall":
      return item.wall_y ?? 1;
    case "ceiling":
      return Math.max(0, floor.height - f.h);
    default:
      // built-in models: where they are drawn by default (a wall cabinet at 1.45 m)
      if (item) return groundUnder(floor, f);
      return builtinBase(f) || groundUnder(floor, f);
  }
}

/**
 * Where an item standing on the ground stands: 0 in a room, outside on the lawn, terrace or lowered ground beneath
 * it – a bin, a mower or outdoor steps no longer float above a garden lower than the floor (#708).
 */
export function groundUnder(floor: Floor, f: Pick<Furniture, "x" | "z">): number {
  // a floor without rooms has no outside (a plan of free walls only)
  const rooms = floor.rooms.filter((r) => r.points.length >= 3);
  if (!rooms.length || rooms.some((r) => pointInPolygon([f.x, f.z], r.points))) return 0;
  return outdoorGround(floor, f.x, f.z);
}
