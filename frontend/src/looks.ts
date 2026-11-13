// Styles of the 3D view (#435): the four classic looks (Neon, High contrast, Day, Realistic) and the styles ported from
// NeonPlan 3D 3.1 (MIT, (c) 2026 Mastershort): colour palettes and homely styles with natural materials and cheap
// realism. Shared by the main bundle (menus, card, schedule) and the 3D bundle (shader, palette). Plain data and pure
// functions: no three.js, no Lit. Nothing here costs frames: a palette is a colour mapping in the shader, natural
// materials are chosen when the house is built.
//
// Exported API (kept close to upstream frontend/src/looks.ts so the later style tickets port onto it):
//   StylePalette, StyleDef        a style's settings; `base` is the classic look underneath (themes.ts Theme)
//   StyleId, STYLES, STYLE_IDS    the built-in styles, their ids in menu order
//   CustomStyle                   an own style as kept in the plan's settings (`styles_custom`, ids `my_*`)
//   setCustomStyles(list)         the plan's own styles; every place that lists or resolves styles sets them
//   allStyles()                   built-in styles, then the own ones
//   styleById(id)                 a style by id (built-in or own), undefined for anything else
//   baseOf(id)                    the classic look under a style id or a classic look ("neon" for anything unknown)
//   isOwnStyleId(v), newStyleId() an own style's id: `my_` and letters/digits; a fresh random one
//   StyleChoice, StylePlan, Phase what a screen chose; the house's plan by time of day; "day" | "evening" | "night"
//   clockMinutes("HH:MM")         minutes after midnight, null for anything else
//   phaseOf(plan, now, sunUp)     the time of day the plan is in, by the sun or by the clock
//   styleFromText(text, names)    the style a word or an entity state names (id, English alias, localised name)
//   StyleInputs, resolveStyle(i)  the style a screen shows now: override > helper entity > choice
//
// Choices a screen can store (themes.ts `Look`): a style id, an own style id, "auto" (Day while the sun is up, else
// Neon), "theme" (follow Home Assistant's theme, #38) and "house" (the house's plan). Only English aliases live here;
// other languages name styles through `names` (the `style_<id>` texts).

import type { Theme } from "./themes.ts";

export interface StylePalette {
  /** Edges and outlines. */
  line: string;
  /** Surfaces from dark … */
  dark: string;
  /** … to light, spread by the neon colours' brightness. */
  light: string;
  /** How much of the original hue stays (0 = none). */
  hue: number;
  /** Brightness every surface starts from. */
  lift: number;
  /** How far the neon brightness spreads between dark and light. */
  contrast: number;
}

export interface StyleDef {
  id: string;
  /** The classic look underneath: line blending, pins and menus, the ground, the chrome (light under Day). */
  base: Theme;
  /** A colour palette instead of the base look's own colours. */
  palette?: StylePalette | null;
  /** Natural materials (wood, tiles, fabric, the rooms' wall colours) instead of a palette. */
  natural?: boolean;
  /** Lit lamps, open windows and screens keep their colour (palettes). */
  signal?: boolean;
  /** Light by direction: faces turned away from the light are darker (0–0.7). */
  sun?: number;
  /** Darker feet of walls and cabinets (0–0.7). */
  ao?: number;
  /** Soft shadows under furniture. */
  shadows?: boolean;
  /** Floor structure: planks, tile joints, grain (0–1, natural materials). */
  floors?: number;
  /** Dark cut wall tops, like an architect's section model (natural materials). */
  cutDark?: boolean;
  /** Evening: the house dims warm, lit lamps keep their glow (0–0.9, natural materials). */
  dim?: number;
  /** The stage behind the house: top and bottom of a gradient. */
  bg?: [string, string] | null;
  /** The menu group. */
  group: "neon" | "homely" | "designed" | "custom";
  /** An own style's name (the built-in ones are named by their `style_<id>` texts). */
  name?: string;
  /** English words that name it (a helper entity, voice); the id and the localised names always count. */
  aliases: string[];
}

export type StyleId = "neon" | "blueprint" | "day" | "realistic" | "focus" | "synthwave" | "cozy" | "evening" | "winter" | "model" | "pastel" | "warm";

const NATURAL = { natural: true, signal: true, shadows: true, floors: 1, cutDark: true, sun: 0.45, ao: 0.45 } as const;

export const STYLES: readonly (StyleDef & { id: StyleId })[] = [
  { id: "neon", base: "neon", group: "neon", aliases: ["neon", "standard"] },
  // offered as "High contrast" (#88, #216); the id stays for stored choices
  { id: "blueprint", base: "blueprint", group: "neon", aliases: ["blueprint", "high contrast", "contrast"] },
  { id: "day", base: "day", group: "neon", aliases: ["day", "light"] },
  {
    id: "focus",
    base: "neon",
    group: "neon",
    palette: { line: "#394150", dark: "#07090d", light: "#2c313a", hue: 0, lift: 0.05, contrast: 2.5 },
    signal: true,
    sun: 0.2,
    bg: ["#030407", "#0b0e14"],
    aliases: ["focus", "night", "dark"],
  },
  {
    id: "synthwave",
    base: "neon",
    group: "neon",
    palette: { line: "#ff3fd2", dark: "#12051f", light: "#3a1460", hue: 0.2, lift: 0.05, contrast: 2.5 },
    signal: true,
    sun: 0.2,
    bg: ["#08010f", "#2a0838"],
    aliases: ["synthwave", "synth", "retro", "party"],
  },
  // Home 3D's own Realistic look (#39) beside the homely styles: lit by realism.ts, not by the cheap style terms
  { id: "realistic", base: "realistic", group: "homely", aliases: ["realistic", "real", "photo"] },
  { id: "cozy", base: "day", group: "homely", ...NATURAL, palette: null, bg: ["#f1efeb", "#d9d5ce"], aliases: ["cozy", "cosy", "homely"] },
  { id: "evening", base: "neon", group: "homely", ...NATURAL, sun: 0.4, dim: 0.75, bg: ["#14161c", "#272630"], aliases: ["evening", "cozy evening", "cosy evening", "homely evening"] },
  { id: "winter", base: "neon", group: "homely", ...NATURAL, sun: 0.4, dim: 0.8, bg: ["#0b1322", "#1d2a40"], aliases: ["winter", "winter evening", "christmas"] },
  {
    id: "model",
    base: "day",
    group: "designed",
    palette: { line: "#8a8f98", dark: "#cfcac2", light: "#fbfaf7", hue: 0.08, lift: 0.35, contrast: 3.2 },
    signal: true,
    sun: 0.3,
    ao: 0.3,
    shadows: true,
    bg: ["#eeece8", "#d6d2cb"],
    aliases: ["model", "architectural model", "architect", "white"],
  },
  {
    id: "pastel",
    base: "day",
    group: "designed",
    palette: { line: "#3b3f5c", dark: "#b7c4e6", light: "#fff4ea", hue: 0.55, lift: 0.3, contrast: 3 },
    signal: true,
    sun: 0.25,
    ao: 0.2,
    shadows: true,
    bg: ["#f4efe8", "#e3e7f2"],
    aliases: ["pastel", "colourful", "colorful", "kids"],
  },
  {
    id: "warm",
    base: "day",
    group: "designed",
    palette: { line: "#5a4632", dark: "#b0906c", light: "#f4ead9", hue: 0.15, lift: 0.3, contrast: 3 },
    signal: true,
    sun: 0.3,
    ao: 0.3,
    shadows: true,
    bg: ["#f0e7d7", "#d9cbb3"],
    aliases: ["warm", "wood", "paper", "wood and paper"],
  },
];

// pure: a bundle that only needs a type or two of this file leaves the table out
export const STYLE_IDS: readonly StyleId[] = /* @__PURE__ */ STYLES.map((s) => s.id);
const BY_ID = /* @__PURE__ */ new Map<string, StyleDef>(STYLES.map((s) => [s.id, s]));

/** An own style, kept in the plan's settings (`styles_custom`): a built-in one adjusted and named. */
export interface CustomStyle extends Omit<StyleDef, "group" | "aliases"> {
  name: string;
}

/** Whether a value has the form of an own style's id (`my_` and letters or digits). */
export function isOwnStyleId(v: unknown): v is `my_${string}` {
  return typeof v === "string" && /^my_[a-z0-9]{1,24}$/i.test(v);
}

let custom: StyleDef[] = [];

/** How many own styles a plan keeps. */
export const MAX_OWN_STYLES = 40;

const HEX = /^#[0-9a-f]{6}$/i;
const num = (v: unknown, lo: number, hi: number, def: number): number => (typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);
const colour = (v: unknown, def: string): string => (typeof v === "string" && HEX.test(v) ? v : def);

/**
 * An own style as stored, made safe: unknown keys dropped, numbers clamped, colours checked. Stored data is never
 * trusted (a hand-edited plan, a newer version): null when it cannot be a style at all.
 */
export function cleanOwnStyle(raw: unknown): CustomStyle | null {
  const c = raw as Partial<CustomStyle> | null;
  if (!c || typeof c !== "object" || !isOwnStyleId(c.id) || typeof c.name !== "string" || !c.name.trim()) return null;
  const out: CustomStyle = { id: c.id, name: c.name.trim().slice(0, 40), base: c.base === "day" || c.base === "blueprint" || c.base === "realistic" ? c.base : "neon" };
  const p = c.palette;
  if (p && typeof p === "object" && !c.natural) out.palette = { line: colour(p.line, "#8a8f98"), dark: colour(p.dark, "#202020"), light: colour(p.light, "#f0f0f0"), hue: num(p.hue, 0, 1, 0), lift: num(p.lift, 0, 0.6, 0.2), contrast: num(p.contrast, 0.5, 4, 2.5) };
  if (c.natural) {
    out.natural = true;
    out.floors = num(c.floors, 0, 1, 1);
    out.cutDark = c.cutDark !== false;
    out.dim = num(c.dim, 0, 0.9, 0);
  }
  out.signal = c.signal !== false;
  out.shadows = c.shadows !== false;
  out.sun = num(c.sun, 0, 0.7, 0.3);
  out.ao = num(c.ao, 0, 0.7, 0);
  const bg = c.bg;
  if (Array.isArray(bg) && bg.length === 2) out.bg = [colour(bg[0], "#202020"), colour(bg[1], "#101010")];
  return out;
}

/** A new own style from any style (a built-in one, an own one): its settings, a name and a fresh id. */
export function ownStyleFrom(from: StyleDef, name: string, id: string = newStyleId()): CustomStyle {
  const { group: _group, aliases: _aliases, ...rest } = structuredClone(from);
  return cleanOwnStyle({ ...rest, id, name }) ?? { id: "my_x", name: "x", base: "neon" };
}

/** The plan's own styles: every place that lists or resolves styles sets them from the building it shows. */
export function setCustomStyles(list: readonly unknown[] | null | undefined): void {
  const seen = new Set<string>();
  custom = [];
  for (const raw of Array.isArray(list) ? list.slice(0, MAX_OWN_STYLES) : []) {
    const c = cleanOwnStyle(raw);
    if (!c || seen.has(c.id)) continue;
    seen.add(c.id);
    custom.push({ ...c, group: "custom", aliases: [c.name] });
  }
}

/** The menu groups of styles, in order. */
export const STYLE_GROUPS = ["neon", "homely", "designed", "custom"] as const;

/**
 * The choices of a style menu (#439), by group: "auto" (follow the HA theme, follow the sun, the house's plan), then the
 * styles of each group. `none` adds an empty choice (a card's evening and night styles); `theme` and `house` only where
 * a screen may follow them.
 */
export function styleChoices(opts: { auto?: boolean; theme?: boolean; house?: boolean; none?: boolean } = {}): { group: "none" | "auto" | (typeof STYLE_GROUPS)[number] | null; values: string[] }[] {
  const out: { group: "none" | "auto" | (typeof STYLE_GROUPS)[number] | null; values: string[] }[] = [];
  if (opts.none) out.push({ group: "none", values: [""] });
  const auto = [...(opts.theme ? ["theme"] : []), ...(opts.auto ? ["auto"] : []), ...(opts.house ? ["house"] : [])];
  if (auto.length) out.push({ group: "auto", values: auto });
  for (const g of STYLE_GROUPS) {
    const ids = allStyles().filter((s) => s.group === g).map((s) => s.id);
    if (ids.length) out.push({ group: g, values: ids });
  }
  return out;
}

/** The built-in styles and the plan's own ones. */
export function allStyles(): readonly StyleDef[] {
  return custom.length ? [...STYLES, ...custom] : STYLES;
}

export function styleById(id: string | null | undefined): StyleDef | undefined {
  return id ? (BY_ID.get(id) ?? custom.find((c) => c.id === id)) : undefined;
}

/** The classic look under a style (or a classic look itself); "neon" for anything unknown. */
export function baseOf(id: string | null | undefined): Theme {
  return styleById(id)?.base ?? "neon";
}

/** An id for a new own style. */
export function newStyleId(): string {
  return `my_${Math.random().toString(36).slice(2, 8)}`;
}

/** A style chosen for a screen: a style, "auto" (Day by sunlight, Neon after dark), "theme" (HA's theme) or "house". */
export type StyleChoice = string;

/** The house's plan: a style per time of day, switched by the sun or by the clock, or named by a helper entity. */
export interface StylePlan {
  style_day?: string | null;
  style_evening?: string | null;
  style_night?: string | null;
  /** "sun": day while the sun is up, evening after sunset until `style_night_at`; "time": by the three times. */
  style_switch?: "sun" | "time" | null;
  style_morning_at?: string | null;
  style_evening_at?: string | null;
  style_night_at?: string | null;
  /** An input_select / input_text whose state names a style: it wins while it names one. */
  style_entity?: string | null;
}

export type Phase = "day" | "evening" | "night";

/** "HH:MM" to minutes after midnight (null for anything else). */
export function clockMinutes(s: string | null | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s?.trim() ?? "");
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h < 24 && min < 60 ? h * 60 + min : null;
}

/** The time of day the plan is in: by the sun (sunUp known) or by the clock. */
export function phaseOf(plan: StylePlan | null | undefined, now: Date, sunUp: boolean | null): Phase {
  const t = now.getHours() * 60 + now.getMinutes();
  const morning = clockMinutes(plan?.style_morning_at) ?? 7 * 60;
  const evening = clockMinutes(plan?.style_evening_at) ?? 18 * 60;
  const night = clockMinutes(plan?.style_night_at) ?? 23 * 60;
  const isNight = night > morning ? t >= night || t < morning : t >= night && t < morning;
  if ((plan?.style_switch ?? "sun") === "sun" && sunUp !== null) {
    if (sunUp) return "day";
    // after sunset: evening until the night time; before sunrise in the morning: night
    if (now.getHours() < 12) return "night";
    return isNight ? "night" : "evening";
  }
  if (isNight) return "night";
  // a night time after midnight: the evening runs on past midnight until it (upstream showed day there)
  return t >= evening || (night < morning && t < night) ? "evening" : "day";
}

/** Normalises a name for matching: lower case, umlauts folded, only letters and digits. */
function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "");
}

/** The style a word or entity state names: its id, an English alias or a localised name (null when none). */
export function styleFromText(text: string | null | undefined, names: Record<string, string[]> = {}): string | null {
  if (!text) return null;
  const n = norm(text);
  if (!n) return null;
  for (const s of allStyles()) if (norm(s.id) === n || s.aliases.some((a) => norm(a) === n) || (names[s.id] ?? []).some((a) => norm(a) === n)) return s.id;
  return null;
}

export interface StyleInputs {
  /** What the screen chose: a style id, "auto", "theme" or "house" (empty or unknown = "theme"). */
  choice?: StyleChoice | null;
  /** The card's own evening and night styles (with `choice` as its day style). */
  evening?: string | null;
  night?: string | null;
  /** The house's plan (settings). */
  plan?: StylePlan | null;
  /** State of the helper entity (the card's own, else the house's). */
  entityState?: string | null;
  /** A style set from outside for this screen (an action, a voice command) – wins. */
  override?: string | null;
  now: Date;
  sunUp: boolean | null;
  /** Home Assistant's theme is dark (true) or light (false), for "theme"; unknown counts as dark. */
  darkMode?: boolean | null;
  /** Localised names per style id, for matching an entity's state. */
  names?: Record<string, string[]>;
}

/** The style a screen shows now. */
export function resolveStyle(i: StyleInputs): string {
  const valid = (id: string | null | undefined): string | null => (styleById(id) ? id! : null);
  const over = valid(i.override);
  if (over) return over;
  const named = styleFromText(i.entityState, i.names);
  if (named) return named;
  const choice = i.choice || "theme";
  if (choice === "auto") return i.sunUp === true ? "day" : "neon";
  const byPhase = (day: string | null, evening: string | null, night: string | null, plan: StylePlan | null | undefined): string => {
    const phase = phaseOf(plan, i.now, i.sunUp);
    if (phase === "night") return night ?? evening ?? day ?? "neon";
    if (phase === "evening") return evening ?? day ?? "neon";
    return day ?? "neon";
  };
  if (choice === "house") {
    const p = i.plan;
    return byPhase(valid(p?.style_day), valid(p?.style_evening), valid(p?.style_night), p);
  }
  // "theme", and a choice this version doesn't know (an own style the plan no longer has): follow HA's theme
  const own = valid(choice) ?? (i.darkMode === false ? "day" : "neon");
  const evening = valid(i.evening);
  const night = valid(i.night);
  return evening || night ? byPhase(own, evening, night, i.plan) : own;
}
