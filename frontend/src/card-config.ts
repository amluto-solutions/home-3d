// Configuration of the dashboard card, shared by the card and its visual editor (a bundle of its own).

import type { Building, CardTemplate, StartView } from "./model.ts";
import type { Quality, WallMode } from "./viewer/viewer3d.ts";

/** Where the clock sits: a corner, or none. */
export type ClockPos = "off" | "tl" | "tr" | "bl" | "br";

export interface CardConfig {
  type: string;
  /** A card template set up in Settings (#495, its id): its options apply, the ones written here win over them. */
  template?: string;
  /** Show this home (#53: its id) instead of the active one. */
  home?: string;
  floor?: string;
  /** Start in this room (its id from the editor): a display for one room, e.g. for the kids. */
  room?: string;
  /**
   * Show only these rooms (and outdoor areas, by id, #500): the others, their furniture and devices are left out, and so
   * are the roof, the map and the other floors' pictures. One room opens with its panel beside the 3D view.
   */
  rooms?: string[];
  /** Start as the read-only 2D plan (#41) instead of the 3D view (default "3d"). */
  view?: "3d" | "2d";
  /** A start view of this card's own (theta, phi, radius and target as the editor shows them); default: the plan's. */
  start_view?: StartView;
  /** A start view for while the screen is held upright (a tablet turned to portrait); default: `start_view` (idea: bpaludo, #520). */
  start_view_portrait?: StartView;
  height?: number;
  walls?: WallMode;
  /** The floor pictures, star, search and eye on the right instead of the left (#285). */
  controls_side?: "left" | "right";
  /** Switching floors keeps the camera (#191). */
  keep_view?: boolean;
  /** 3D lock: the angle stays fixed, a drag moves the view (a wall tablet with children around). */
  angle_lock?: boolean;
  /** Pull floors apart in the house view (default true). */
  explode?: boolean;
  /** A "Cameras" button that opens the camera wall, every camera's live picture (Pro: camera cockpit). */
  camera_wall?: boolean;
  /** The roof lifts and fades while zooming in (default true); false keeps it on the house. */
  roof_fade?: boolean;
  /** Show the roof (default true); false leaves it out altogether, as if the house had none (D601). */
  roof?: boolean;
  quality?: Quality;
  /** Show the performance display (frames per second, draw calls). */
  stats?: boolean;
  /** HTML markers: none | important (default) | all. */
  markers?: "none" | "important" | "all" | "room";
  /** How large the device symbols are (default normal). */
  marker_size?: "small" | "normal" | "large";
  /** Every device with an own name shows it under its marker (#156). */
  marker_names?: boolean;
  /** Only look (#553): the card shows everything but switches nothing, so a touch on a wall tablet changes nothing. */
  view_only?: boolean;
  /** The star with the central menu: all lights / blinds of the floor or house and the favourites (default true, #145). */
  central?: boolean;
  /** The walk through the house at eye height (default on). */
  walk?: boolean;
  /** Fun pack "pets": the animals set up in the extensions show in this card (default on). */
  pets?: boolean;
  /** Fun pack "Halloween": the ghost floats through this card's house too (default on). */
  ghost?: boolean;
  /** Own buttons in the central menu (replace the ones set in the editor): label, icon, action, target, data (D143). */
  buttons?: { label: string; icon?: string; action: "navigate" | "more_info" | "service" | "fire_dom_event"; target?: string; data?: Record<string, unknown> }[];
  /** Heatmap of the rooms: none | temperature | humidity | co2. */
  heatmap?: "none" | "temperature" | "humidity" | "co2";
  /**
   * The look (#439): a style id (neon, blueprint, day, realistic, focus, synthwave, cozy, evening, winter, model, pastel,
   * warm, or an own `my_*` one), "auto" (Day while the sun is up, Neon at night), "house" (the house's style plan) or
   * "theme" (the default: follows the HA theme). With `theme_evening` / `theme_night` it is the day style.
   */
  theme?: string;
  /** The style from sunset (or the plan's evening time) on, and the one at night; empty keeps the day style. */
  theme_evening?: string;
  theme_night?: string;
  /** An input_select or input_text whose state names a style (id or name): it wins while it names one. */
  style_entity?: string;
  /**
   * The zoom style (#456): the style the house blends into when zoomed in (any style but realistic, an own `my_*` one or
   * "house" for the house's plan); leave out for none. `zoom_late`: when it sets in, 0 (early) … 100 (late, default 70);
   * `zoom_scope`: "all" rooms (default) or only the "room" zoomed into.
   */
  zoom_style?: string;
  zoom_late?: number;
  zoom_scope?: "all" | "room";
  /** Date and time in a corner of the view (default off). */
  clock?: ClockPos;
  /** Accent colour for the neon look and the card's chips ("#rrggbb"); leave out for the stock cyan. */
  accent?: string;
  /** Energy values at the top (default true). */
  energy?: boolean;
  /** Power flow lines always on or off; without it the card has its own switch. */
  flows?: boolean;
  /** Energy holograms always on or off; without it the card has its own switch. */
  holograms?: boolean;
  /** Tapping a room opens its details (lights, blinds, cameras); default true. */
  room_panel?: boolean;
  /** Fill the screen below the dashboard header instead of a fixed height. */
  fill?: boolean;
  /**
   * The phone view (#493): a bar at the bottom (Now, the rooms by floor, the blinds, More) with the list "What's going on?"
   * and the house check; the card's own switches and buttons make way. Best with `fill: true` on a view of its own.
   */
  phone?: boolean;
  /** Phone view (#494): parts left out – the rooms and the blinds in the bar, the favourites on top of the list. */
  phone_hide?: PhonePart[];
  /** Phone view (#494): "now" opens with the list "What's going on?" instead of the house. */
  phone_start?: "house" | "now";
  /** Phone view (#494): up to two places of one's own in the bar (a group of devices, a scene or script, a dashboard page). */
  phone_places?: PhonePlace[];
  /** Phone view (#500): a room one jumps into stands alone in the picture; each device can change it under "More". */
  phone_solo?: boolean;
  /** Switches in the card: all (true) or a list of walls, floors, temperature, humidity, co2. */
  controls?: boolean | CardControl[];
  /** Start with every bar and overlay hidden (the eye button brings them back); false shows the eye, hidden by default. */
  controls_hidden?: boolean;
  /** Hide every bar and overlay after this many seconds without a touch; a touch shows them again. */
  controls_hide_after?: number;
  /** Room names in 3D (default true). */
  room_names?: boolean;
  /** Draw the surroundings from the map (default true); false leaves them out on this card (#492). */
  surroundings?: boolean;
  /** An opened floor with the floors below it dimmed (default), stacked, or on its own. */
  floor_stack?: "dim" | "stacked" | "single";
  /** A button for full screen (hides the dashboard around the card). */
  fullscreen_button?: boolean;
  /** A button that opens another dashboard or view (its path, e.g. "/lovelace/home"), with an optional label. */
  dashboard?: string;
  dashboard_label?: string;
  /** A floor switcher, small pictures of the floors or tabs (default: on without a start floor). */
  floor_thumbs?: boolean;
  /**
   * The floor switcher as tabs at the top left, in place of the pictures and the floors' name boxes over the house
   * (#548): true always, false never (the pictures), unset on a phone-sized card only.
   */
  floor_tabs?: boolean;
  /** Warnings (smoke, water, alarm, window in the rain) as pulsing rooms and a banner (default true). */
  alerts?: boolean;
  /** Jump to the room of a new warning (default false). */
  alert_jump?: boolean;
  /** Kamera-Cockpit: the live director – the card shows by itself what happens (events chosen in the settings; default off). */
  director?: boolean;
  /** Voice control: a microphone button – "Show the living room" shows it, other sentences go to Assist (default off). */
  voice?: boolean;
  /** This card's screen name for Assist and the service `home_3d.ask`: a sentence that names a screen is only for it. */
  screen?: string;
  /** Scene and script chips of the selected room (default true). */
  scenes?: boolean;
  /** Motion trail: where motion was reported in the last half hour, with times (default off). */
  motion_trail?: boolean;
  /** Weather outside the house: rain, snow, fog, clouds, sun and moon (default on). */
  weather?: boolean;
  /** The weather entity to use (default: the first one). */
  weather_entity?: string;
  /** Household: the glass card "Today in the household" (bins, post, appliances, plants …; default on). */
  household_card?: boolean;
  /** Racks: a glass card over every rack with linked gear, its chosen live values (#120; default on). */
  rack_cards?: boolean;
  /** Pro: a "Time travel" button replays the last 24 hours in the card (read-only). */
  time_travel?: boolean;
  /** How far back the time travel starts: 24 hours (default) or the week ("7d" also on a wall tablet, which else holds two days). */
  time_travel_range?: "24h" | "7d";
  /** Replay speed: one hour in a minute (60), 10 s (360, default), 4 s (900), 1 s (3600) or, over the week, a day in 6 s (14400). */
  time_travel_speed?: 60 | 360 | 900 | 3600 | 14400;
  /** Kiosk: seconds without a touch after which the card returns to its start view (0 = never). */
  idle_return?: number;
  /** Kiosk: dim at night – "off", "sun" (sun.sun below the horizon) or a time range "22:00-06:00". */
  night?: string;
  /** Kiosk: after the idle return, turn the view slowly by itself until the next touch. */
  idle_orbit?: boolean;
}

/** The phone bar's parts a card can leave out (`phone_hide`, #494). */
export const PHONE_PARTS = ["rooms", "covers", "favorites"] as const;
export type PhonePart = (typeof PHONE_PARTS)[number];

/**
 * A place of one's own in the phone bar (card option `phone_places`, #494; ported from NeonPlan 3D 4.0.0, MIT,
 * Mastershort): "lights" and "climate" open a page of the house's lamps or thermostats by floor, "action" runs a scene
 * or script, "link" opens a page inside Home Assistant.
 */
export interface PhonePlace {
  kind: "lights" | "climate" | "action" | "link";
  /** The word under the symbol (empty: the kind's own, or the scene's name). */
  name?: string;
  /** An emoji or a short sign (empty: the kind's own). */
  icon?: string;
  /** action: the scene, script, button or automation. */
  entity?: string;
  /** link: a path inside Home Assistant ("/lovelace/energy"). */
  path?: string;
}

export const PHONE_PLACE_KINDS = ["lights", "climate", "action", "link"] as const;
export const MAX_PHONE_PLACES = 2;

/** A path inside Home Assistant: one leading slash, never "//host" or a scheme. */
export function isHaPath(path: unknown): path is string {
  return typeof path === "string" && /^\/[^/\\]/.test(path);
}

/** The places as the bar can use them: known kinds only, an action with its entity, a link with a path inside HA; at most two. */
export function phonePlaces(raw: unknown): PhonePlace[] {
  if (!Array.isArray(raw)) return [];
  const out: PhonePlace[] = [];
  for (const r of raw as Partial<PhonePlace>[]) {
    if (!r || typeof r !== "object" || !(PHONE_PLACE_KINDS as readonly string[]).includes(String(r.kind))) continue;
    if (r.kind === "action" && !/^[a-z_]+\.[a-z0-9_]+$/.test(String(r.entity ?? ""))) continue;
    if (r.kind === "link" && !isHaPath(r.path)) continue;
    out.push({
      kind: r.kind!,
      name: typeof r.name === "string" && r.name.trim() ? r.name.trim().slice(0, 24) : undefined,
      icon: typeof r.icon === "string" && r.icon.trim() ? [...r.icon.trim()].slice(0, 4).join("") : undefined,
      entity: r.kind === "action" ? r.entity : undefined,
      path: r.kind === "link" ? r.path : undefined,
    });
    if (out.length === MAX_PHONE_PLACES) break;
  }
  return out;
}

export const CARD_CONTROLS =["view", "walls", "floors", "temperature", "humidity", "co2"] as const;
export type CardControl = (typeof CARD_CONTROLS)[number];

/** Whether the card shows the 2D plan (#41): the card's own 2D/3D switch (`chosen`, null: not used) wins over its view option. */
export function showsPlan2d(config: CardConfig | undefined, chosen: boolean | null): boolean {
  return chosen ?? config?.view === "2d";
}

/**
 * How far from the right edge the view's walk button sits (#484): clear of the card's own buttons at the top right as
 * wide as they really are (`lefts`: their left edges in the card's body of `width` px). A dashboard button with a long
 * label reached over a fixed 104 px. Without such buttons it is in the corner, 12 px from the edge as in the panel: a
 * fixed 104 px left it a third of the way across a phone (#549). A room panel at the side (`panelLeft`: its left edge)
 * takes the corner too, or the button lay over its close button (#562); a sheet at the bottom starts at the left edge.
 */
export const WALK_CORNER = 12;
export function walkRightFor(lefts: readonly number[], width: number, panelLeft: number | null = null): number {
  const side = panelLeft !== null && panelLeft > width / 3 ? panelLeft : Infinity;
  const left = Math.min(...lefts, side);
  return Number.isFinite(left) ? Math.max(WALK_CORNER, Math.round(width - left + 8)) : WALK_CORNER;
}

// ---------------------------------------------------------------------------------------------------- card templates
// #495, ported from NeonPlan 3D 4.0.0 (MIT, Mastershort): a card set up once in Settings, picked by a tablet or phone.

/** Options a template never holds: the card's type, the template itself and the home (a template belongs to its home's plan). */
const NOT_IN_TEMPLATE = ["type", "template", "home"] as const;

/**
 * Whether the screen itself is held upright - what the device tells, else the screen's own shape. Not the window's or
 * the card's: a keyboard pushing the page up or a split screen must not turn the house (#520).
 */
export function screenUpright(screen: { orientation?: { type?: string } | null; width?: number; height?: number } | null | undefined): boolean {
  const type = screen?.orientation?.type;
  if (typeof type === "string" && type) return type.startsWith("portrait");
  return (screen?.height ?? 0) > (screen?.width ?? 0);
}

/** The card's own start view: the upright one while the screen is held upright (if set), else `start_view`; null = the plan's. */
export function cardStartView(c: Pick<CardConfig, "start_view" | "start_view_portrait"> | null | undefined, upright: boolean): StartView | null {
  return (upright ? c?.start_view_portrait : undefined) ?? c?.start_view ?? null;
}

/** The template a card names (by its id or an earlier one), if the plan has it. */
export function cardTemplate(b: Building | null | undefined, id: string | undefined): CardTemplate | undefined {
  const key = id?.trim();
  if (!key) return undefined;
  const list = b?.card_templates ?? [];
  return list.find((t) => t.id === key) ?? list.find((t) => t.aliases?.includes(key));
}

/** A card's options as a template keeps them: without its type, template and home. */
export function templateOptions(config: Partial<CardConfig>): Partial<CardConfig> {
  const out: Partial<CardConfig> = { ...config };
  for (const k of NOT_IN_TEMPLATE) delete out[k];
  return out;
}

/**
 * The options a card works with: its template's (from the plan), then the ones in its own YAML on top. A template's
 * name is the card's screen name unless one is set. A card without a template, or with one the plan lacks, keeps its YAML.
 */
export function effectiveConfig(yaml: CardConfig, b: Building | null | undefined): CardConfig {
  const tpl = cardTemplate(b, yaml.template);
  if (!tpl) return yaml;
  const { type, template, ...own } = yaml;
  const base = templateOptions(tpl.config);
  return { ...base, screen: base.screen || tpl.name, ...own, type, template } as CardConfig;
}

/** An id for a template from its name: lower case, plain letters, words joined by "_", not one of `taken`. */
export function templateId(name: string, taken: readonly string[]): string {
  const base =
    name
      .toLowerCase()
      .replace(/ß/g, "ss")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40) || "template";
  let id = base;
  for (let n = 2; taken.includes(id); n++) id = `${base}_${n}`;
  return id;
}

/** Every id a template answers to: its own and the earlier ones. */
export function templateIds(t: CardTemplate): string[] {
  return [t.id, ...(t.aliases ?? [])];
}

/**
 * A template renamed: its id follows the new name, and the old id stays as an alias so a card that names it keeps
 * working. Returns the renamed template (undefined when there is none with `id`).
 */
export function renameTemplate(list: CardTemplate[], id: string, name: string): CardTemplate | undefined {
  const tpl = list.find((t) => t.id === id);
  if (!tpl) return undefined;
  tpl.name = name;
  const taken = list.filter((t) => t !== tpl).flatMap(templateIds);
  const next = templateId(name, taken);
  if (next !== tpl.id) {
    const aliases = new Set([...(tpl.aliases ?? []), tpl.id]);
    aliases.delete(next);
    tpl.id = next;
    if (aliases.size) tpl.aliases = [...aliases].slice(-10);
    else delete tpl.aliases;
  }
  return tpl;
}
