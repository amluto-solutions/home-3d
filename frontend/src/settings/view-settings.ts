// This device's look and screen rows of the settings list (#139), and the one View panel on the 3D view that shows the
// quick ones (#247, the menus redesign #219). The rows are registry.ts's own (SETTINGS takes LOOK and SCREEN from
// here), so the View panel and the Settings page read and write the very same entries and can never show different
// values. A file of its own so the View panel's lazy chunk carries these rows without the whole registry. No Lit, no
// texts table: labels are text keys.

import { ACCENT_DEFAULT } from "../colour-reset.ts";
import { shownStyle } from "../ha-theme.ts";
import { STYLE_IDS, styleById, styleChoices, type StyleId, type StylePlan } from "../looks.ts";
import { lookOf, type Look } from "../themes.ts";
import { DISPLAY_HIDDEN_KEY, hiddenText, OBJECT_TYPES, parseHidden, SHOW_FURNITURE_KEY } from "../display-pref.ts";
import { parsePinZoom, PLAN_PIN_ZOOM_DEFAULT, PLAN_PIN_ZOOM_KEY, PLAN_PIN_ZOOM_MAX } from "../plan-pins.ts";
import type { Option, SectionId, Setting, SettingsEnv, TextKey } from "./registry.ts";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A device switch kept as "home3d.<key>" = "1" / "0". */
export function deviceSwitch(id: string, section: SectionId, card: string, key: string, def: boolean, label: TextKey, hint?: TextKey, keywords?: string[]): Setting<boolean> {
  return {
    id,
    section,
    card,
    scope: "device",
    permission: "everyone",
    label,
    hint,
    keywords,
    control: { kind: "switch" },
    default: def,
    prefKeys: [key],
    read: (env) => {
      const v = env.prefs.get(key);
      return v === null ? def : v === "1";
    },
    write: (env, v) => env.prefs.set(key, v ? "1" : "0"),
  };
}

/** A device choice of a few values kept as "home3d.<key>" (anything else reads as the default). */
export function deviceChoice(id: string, section: SectionId, card: string, key: string, values: readonly string[], def: string, label: TextKey, options: Option[], hint?: TextKey, keywords?: string[], kind: "segment" | "select" = "segment"): Setting<string> {
  return {
    id,
    section,
    card,
    scope: "device",
    permission: "everyone",
    label,
    hint,
    keywords,
    control: kind === "segment" ? { kind: "segment", options } : { kind: "select", options: () => options },
    default: def,
    prefKeys: [key],
    read: (env) => {
      const v = env.prefs.get(key);
      return v !== null && values.includes(v) ? v : def;
    },
    write: (env, v) => env.prefs.set(key, v),
  };
}

const opts = (pairs: [string, TextKey][]): Option[] => pairs.map(([value, label]) => ({ value, label }));

/**
 * Appearance as one grouped drop-down (#247, #439): Automatic (follow Home Assistant's theme, follow the sun, the house's
 * plan, each naming the style it shows now), then the styles by group: neon, homely, designed and the plan's own ones.
 * The stored values are style ids or the old ones ("theme", "auto" …).
 */
export function appearanceOptions(env: Pick<SettingsEnv, "hass" | "building">): Option[] {
  const plan = env.building?.settings as StylePlan | undefined;
  const now = (value: string): TextKey | undefined => {
    const id = shownStyle(value as Look, env.hass, plan);
    return STYLE_IDS.includes(id as StyleId) ? `style_${id}` : undefined;
  };
  const out: Option[] = [];
  for (const { group, values } of styleChoices({ theme: true, auto: true, house: true })) {
    for (const value of values) {
      if (group === "auto") out.push({ value, label: value === "theme" ? "follow_ha" : value === "auto" ? "follow_sun" : "style_house", group: "style_group_auto", now: now(value) });
      else {
        const own = styleById(value);
        out.push(own?.group === "custom" ? { value, label: own.name ?? value, raw: true, group: "style_group_custom" } : { value, label: `style_${value}`, group: `style_group_${group}` });
      }
    }
  }
  return out;
}

/** What a choice reads: its label, and the look it shows now for a "follow" choice. */
export function optionText(o: Option, t: (key: TextKey, vars?: Record<string, string | number>) => string): string {
  const label = o.raw ? o.label : t(o.label);
  return o.now ? `${label} (${t("follow_now", { look: t(o.now) })})` : label;
}

/** A drop-down's choices by group heading, in order (one untitled group when no choice has a heading). */
export function optionGroups(options: Option[]): { group: TextKey | null; options: Option[] }[] {
  const out: { group: TextKey | null; options: Option[] }[] = [];
  for (const o of options) {
    const group = o.group ?? null;
    const last = out[out.length - 1];
    if (last && last.group === group) last.options.push(o);
    else out.push({ group, options: [o] });
  }
  return out;
}

/** This device's Appearance (with the clock) and what its 3D view shows (the View panel shows the quick ones, #247; two Settings pages since #248). */
export const LOOK: Setting[] = [
  {
    ...deviceChoice("theme", "look", "look", "theme", [], "theme", "theme", [], "theme_hint", ["dark", "light", "day", "night", "evening", "style", "cozy", "homely", "neon", "theme", "colour scheme", "sun", "automatic"], "select"),
    // any style id (or an own one) is a valid pick: lookOf drops what this version doesn't know
    read: (env) => lookOf(env.prefs.get("theme")),
    control: { kind: "select", options: appearanceOptions },
  },
  {
    id: "accent",
    section: "look",
    card: "look",
    scope: "device",
    permission: "everyone",
    label: "accent",
    hint: "accent_hint",
    keywords: ["colour", "color", "cyan", "highlight"],
    control: { kind: "colour", fallback: ACCENT_DEFAULT, clearable: true },
    default: null,
    prefKeys: ["accent"],
    read: (env) => {
      const v = env.prefs.get("accent");
      return v && /^#[0-9a-f]{6}$/i.test(v) ? v : null;
    },
    write: (env, v) => env.prefs.set("accent", v),
  } as Setting<string | null>,
  deviceChoice("clock", "look", "clock", "clock", ["off", "tl", "tr", "bl", "br"], "off", "st_clock", opts([["off", "st_clock_off"], ["tl", "st_clock_tl"], ["tr", "st_clock_tr"], ["bl", "st_clock_bl"], ["br", "st_clock_br"]]), undefined, ["time", "clock", "corner"], "select"),
  ...[
  deviceChoice("clock_hours", "look", "clock", "clock_hours", ["auto", "12", "24"], "auto", "st_clock_hours", opts([["auto", "clock_hours_auto"], ["12", "clock_hours_12"], ["24", "clock_hours_24"]]), undefined, ["time", "clock", "12", "24", "am", "pm"]),
  deviceChoice("clock_style", "look", "clock", "clock_style", ["digital", "analogue"], "digital", "st_clock_face", opts([["digital", "clock_digital"], ["analogue", "clock_analogue"]]), undefined, ["time", "clock", "dial", "hands", "face"]),
  deviceSwitch("clock_seconds", "look", "clock", "clock_seconds", false, "st_clock_seconds", undefined, ["time", "clock", "seconds"]),
  deviceSwitch("clock_date", "look", "clock", "clock_date", true, "st_clock_date", undefined, ["time", "clock", "date", "day"]),
  deviceSwitch("clock_weather", "look", "clock", "clock_weather", true, "st_clock_weather", "st_clock_weather_hint"),
  ].map((s): Setting => ({ ...s, visible: (env) => ["tl", "tr", "bl", "br"].includes(env.prefs.get("clock") ?? "") })), // the clock's details only while it shows (#256)
  deviceChoice("markers", "view3d", "markers", "markers", ["none", "room", "important", "all"], "important", "markers", opts([["none", "markers_none"], ["room", "markers_room"], ["important", "markers_important"], ["all", "markers_all"]]), "markers_important_hint", ["pins", "icons", "symbols", "devices", "markers"], "select"),
  deviceSwitch("pulse", "view3d", "markers", "pulse", true, "st_pulse", "st_pulse_hint", ["pins", "outline", "pulse", "animation", "motion"]),
  deviceChoice("pinSize", "view3d", "markers", "pinSize", ["small", "normal", "large"], "normal", "pin_size", opts([["small", "pin_size_small"], ["normal", "pin_size_normal"], ["large", "pin_size_large"]]), undefined, ["pins", "icons", "symbols", "size"]),
  {
    id: "plan_pin_zoom",
    section: "view3d",
    card: "markers",
    scope: "device",
    permission: "everyone",
    label: "st_plan_pin_zoom",
    hint: "st_plan_pin_zoom_hint",
    keywords: ["markers", "pins", "zoom", "phone", "plan", "overlap", "hide"],
    control: { kind: "number", step: 5, min: 0, max: PLAN_PIN_ZOOM_MAX, unit: "px/m", clearable: true },
    default: PLAN_PIN_ZOOM_DEFAULT,
    prefKeys: [PLAN_PIN_ZOOM_KEY],
    read: (env) => parsePinZoom(env.prefs.get(PLAN_PIN_ZOOM_KEY)),
    write: (env, v) => env.prefs.set(PLAN_PIN_ZOOM_KEY, v === null ? null : String(Math.round(clamp(v, 0, PLAN_PIN_ZOOM_MAX)))),
  } as Setting<number | null>,
  deviceSwitch("plan2d", "view3d", "show", "plan2d", false, "st_view_2d", undefined, ["2d", "plan", "flat"]),
  deviceChoice("walls", "view3d", "show", "walls", ["auto", "cut"], "auto", "st_walls", opts([["auto", "walls_auto"], ["cut", "walls_cut"]]), undefined, ["walls", "cut", "tall"]),
  deviceChoice("explode", "view3d", "show", "explode", ["1", "0"], "1", "st_floors", opts([["1", "floors_apart"], ["0", "floors_stacked"]]), undefined, ["floors", "apart", "stacked", "explode"]),
  deviceChoice("floor_stack", "view3d", "show", "floor_stack", ["dim", "stacked", "single"], "dim", "st_floor_stack", opts([["dim", "floor_stack_short_dim"], ["stacked", "floor_stack_short_stacked"], ["single", "floor_stack_short_single"]]), undefined, ["floors", "below", "dimmed"]),
  deviceSwitch("roof", "view3d", "show", "roof", false, "st_keep_roof", "roof_keep_hint", ["roof", "zoom"]),
  deviceChoice("heat", "view3d", "show", "heat", ["none", "temperature", "humidity", "co2", "values"], "none", "st_heat", opts([["none", "heat_nothing"], ["temperature", "heat_c_temp"], ["humidity", "heat_c_hum"], ["co2", "heat_c_co2"], ["values", "heat_values"]]), "st_heat_hint", ["heatmap", "temperature", "humidity", "co2", "colour"], "select"),
  // #268: the kinds of objects the 3D view shows (what is ticked); the preference keeps the hidden ones, so a kind added later shows
  {
    id: "display",
    section: "view3d",
    card: "show",
    scope: "device",
    permission: "everyone",
    label: "st_display_what",
    hint: "st_display_what_hint",
    keywords: ["display", "show", "hide", "objects", "lights", "furniture", "room names", "cameras", "sensors", "layers"],
    control: { kind: "checks", options: OBJECT_TYPES.map((t): Option => ({ value: t, label: `ot_${t}` })) },
    default: OBJECT_TYPES.filter((t) => t !== "room_names"),
    prefKeys: [DISPLAY_HIDDEN_KEY, "room_names"],
    read: (env) => {
      const hidden = parseHidden(env.prefs.get(DISPLAY_HIDDEN_KEY), env.prefs.get("room_names"), env.prefs.get(SHOW_FURNITURE_KEY));
      return OBJECT_TYPES.filter((t) => !hidden.has(t));
    },
    write: (env, shown) => {
      env.prefs.set(DISPLAY_HIDDEN_KEY, hiddenText(new Set(OBJECT_TYPES.filter((t) => !shown.includes(t)))));
      env.prefs.set("room_names", null);
    },
  } as Setting<string[]>,
  deviceSwitch("trail", "view3d", "show", "trail", false, "st_trail", "trail_hint", ["motion", "trail", "history"]),
  deviceSwitch("weather", "view3d", "show", "weather", true, "st_weather", "st_weather_hint", ["rain", "snow", "weather"]),
  // #274: kept per device and off by default (the light pooling outside looked poor); the old home setting of the same name no longer counts
  deviceSwitch("window_glow", "view3d", "show", "window_spill", false, "window_glow", "window_glow_hint", ["night", "glow", "light", "windows", "spill"]),
  // #307: the zoom, move and turn pad on the view; off by default
  deviceSwitch("nav", "view3d", "show", "nav", false, "st_nav"),
  // #315: the two small switches that sat in the energy row of the 3D view (power flow lines, hologram cards) are View options now
  // #319: how high the sun's way is drawn; the lighting and shadows keep the real sun angle
  deviceChoice("sun_height", "view3d", "show", "sun_height", ["auto", "high", "real"], "auto", "st_sun_height", opts([["auto", "sun_height_auto"], ["high", "sun_height_high"], ["real", "sun_height_real"]]), "st_sun_height_hint"),
  ...["flows", "holos"].map((k) => deviceSwitch(k, "view3d", "show", k, k === "holos", k as TextKey, `${k}_hint` as TextKey)),
  // #349: a door or window contact shows its state on the opening; its pin only comes back with this
  deviceSwitch("door_pins", "view3d", "show", "door_pins", false, "door_pins", "door_pins_hint"),
  // #350: robot vacuum maps on the floors (offered only for a plan with maps); on by default
  { ...deviceSwitch("vacuum_maps", "view3d", "show", "vacuum_maps", true, "st_vacuum_maps", "st_vacuum_maps_hint"), visible: (env) => !!env.building?.settings.vacuum_maps?.length },
];

/**
 * Screen and controls (#246): what the old View menu's unlabelled Controls row (◧ ◨ ⌖ 🔒 FPS) and the floor bar's wrap
 * toggle set, each with its full name. Quality sits on Appearance, as drawn (#248). Same stored keys as before, so
 * nobody loses a choice.
 */
export const SCREEN: Setting[] = [
  deviceChoice("quality", "look", "look", "quality", ["auto", "low", "high"], "auto", "quality", opts([["auto", "quality_auto"], ["low", "st_quality_low"], ["high", "quality_high"]]), "card_quality_hint", ["performance", "tablet", "speed", "graphics", "slow"]),
  deviceSwitch("stats", "screen", "screen", "stats", false, "st_fps", "fps_title", ["fps", "performance", "frames", "speed"]),
  deviceChoice("controls", "screen", "controls", "controls", ["left", "right"], "left", "controls_side", opts([["left", "st_controls_left"], ["right", "st_controls_right"]]), "st_controls_side_hint", ["left", "right", "star", "search", "eye", "buttons"]),
  deviceSwitch("keep_view", "screen", "controls", "keep_view", false, "keep_view", "keep_view_hint", ["camera", "floor"]),
  deviceSwitch("angle_lock", "screen", "controls", "angle_lock", false, "angle_lock", "angle_lock_hint", ["lock", "turn", "rotate", "angle"]),
  // #250: the floor pictures beside the 3D view, a second floor picker; off by default, as the floor bar picks the floor
  deviceSwitch("floor_pictures", "screen", "controls", "floor_pictures", false, "st_floor_pictures", "st_floor_pictures_hint", ["floor", "pictures", "thumbnails"]),
  // #454: for wall tablets: a tap on a device of another room opens that room instead of switching it
  deviceSwitch("tap_in_room", "screen", "controls", "tap_in_room", false, "st_tap_in_room", "st_tap_in_room_hint"),
];

// ---------------------------------------------------------------------------------------------------- the View panel

/** Where the 3D view is: what the View panel offers depends on it (as the old Show menu did). */
export interface ViewContext {
  /** Floors with rooms. */
  floors: number;
  /** One floor is open (not the whole house). */
  floorOpen: boolean;
  /** The house has a roof. */
  roof: boolean;
  /** The 2D plan shows instead of the 3D view. */
  plan2d: boolean;
  /** A locked wall tablet (#92): only what the 3D shows (and 3D or 2D) is offered, as before. */
  kiosk: boolean;
  /** The plan has robot vacuum maps (#350): their switch is offered. */
  vacuums?: boolean;
}

/** A row of the View panel: a setting of LOOK or SCREEN by its id. */
export interface ViewRow {
  id: string;
  /** Shown but not usable here (a whole-house row while one floor is open). */
  disabled?: boolean;
}

export type ViewSectionId = "look" | "show" | "markers" | "clock";

export interface ViewSection {
  id: ViewSectionId;
  title: TextKey;
  rows: ViewRow[];
  /** A sentence under the rows. */
  hint?: TextKey;
  /** Open when the panel opens as a phone's bottom sheet; the others start folded with a one-line summary. */
  openOnPhone: boolean;
}

/** The View panel's sections and rows for where the 3D view is (#247). */
export function viewSections(ctx: ViewContext): ViewSection[] {
  const several = ctx.floors > 1;
  const show: ViewRow[] = [];
  if (!ctx.plan2d) show.push({ id: "walls" });
  if (several && !ctx.plan2d) show.push({ id: "explode", disabled: ctx.floorOpen });
  if (several && ctx.floorOpen && !ctx.plan2d) show.push({ id: "floor_stack" });
  show.push({ id: "heat" }, { id: "display" });
  if (ctx.roof && !ctx.plan2d) show.push({ id: "roof", disabled: ctx.floorOpen });
  show.push({ id: "trail" }, { id: "weather" }, { id: "nav" }, ...["flows", "holos", "door_pins"].map((id) => ({ id })));
  if (ctx.vacuums && !ctx.plan2d) show.push({ id: "vacuum_maps" });
  const shows: ViewSection = { id: "show", title: "st_card_show", rows: show, hint: show.some((r) => r.disabled) ? "pick_all_floors" : undefined, openOnPhone: false };
  if (ctx.kiosk) return [{ ...shows, openOnPhone: true }];
  return [
    { id: "look", title: "theme", rows: [{ id: "theme" }, { id: "accent" }], openOnPhone: true },
    shows,
    { id: "markers", title: "markers", rows: [{ id: "markers" }, { id: "pinSize" }, { id: "pulse" }], hint: "markers_important_hint", openOnPhone: true },
    { id: "clock", title: "st_clock", rows: [{ id: "clock" }, { id: "clock_weather" }], openOnPhone: false },
  ];
}

/** A LOOK or SCREEN row by its id. */
export function viewSetting(id: string): Setting | undefined {
  return LOOK.find((s) => s.id === id) ?? SCREEN.find((s) => s.id === id);
}
