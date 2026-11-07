// The editor's hint bar (#96): one line under the plan that says what the current tool does, what can be done with
// the selection, and on a fresh install what to do first. It carries the first-run guidance instead of a tour.

import type { I18nKey } from "./i18n.ts";

export type Tool = "select" | "rect" | "polygon" | "measure" | "opening" | "furniture" | "outdoor" | "hole" | "wall" | "roof" | "energy" | "pool";

export interface HintState {
  tool: Tool;
  hasFloor: boolean;
  /** Rooms on the shown floor. */
  rooms: number;
  /** What is selected in the plan. */
  selected: "room" | "opening" | "furniture" | "device" | null;
  /** A library card is armed: the next click places it (#76). */
  placing?: boolean;
  wallPick?: boolean;
  /** A bin's kerb spot is being picked (#142). */
  kerbPick?: boolean;
  /** A drag on a fixed item just became a pan. */
  fixedHint?: boolean;
  outdoorFree?: boolean;
  jointPlace?: boolean;
  pipeMode?: boolean;
  /** A pool is chosen for the pipes. */
  poolArea?: boolean;
  pipeDraft?: boolean;
  /** Pool technology (ports, devices, pipes) is available. */
  poolTech?: boolean;
}

export function hintKey(s: HintState): I18nKey {
  if (!s.hasFloor) return "hint_empty";
  if (s.placing) return "hint_place";
  if (s.wallPick) return "hint_wall_pick";
  if (s.kerbPick) return "hint_kerb_pick";
  if (s.fixedHint) return "fixed_drag_hint";
  if (s.tool === "outdoor" && s.outdoorFree) return "hint_outdoor_free";
  if (s.tool === "pool") {
    if (s.jointPlace) return "hint_joint_place";
    if (s.pipeMode) return !s.poolArea ? "hint_pipe_pool" : s.pipeDraft ? "hint_pipe_next" : "hint_pipe_start";
    return s.poolTech ? "hint_pool_tech" : "hint_pool";
  }
  if (s.tool === "select") {
    if (!s.rooms) return "hint_first_room";
    if (s.selected === "furniture") return "hint_sel_furniture";
    if (s.selected === "opening") return "hint_sel_opening";
    if (s.selected === "device") return "hint_sel_device";
  }
  return `hint_${s.tool}`;
}

/**
 * A touch-only device (#228): a finger is the only pointer. A laptop with a touch screen has a fine pointer as well and
 * keeps the keyboard hints. Without matchMedia (tests, old browsers) the answer is no.
 */
export function touchOnly(mm: ((q: string) => { matches: boolean }) | undefined = typeof matchMedia === "function" ? (q) => matchMedia(q) : undefined): boolean {
  if (!mm) return false;
  return mm("(any-pointer: coarse)").matches && !mm("(any-pointer: fine)").matches;
}

/** Hint strings that are reworded for touch, not just trimmed (the click / Enter / right-click sentences). */
export const TOUCH_HINTS: Partial<Record<I18nKey, I18nKey>> = {
  hint_place: "hint_place_touch",
  hint_polygon: "hint_polygon_touch",
  hint_outdoor_free: "hint_outdoor_free_touch",
  hint_wall_pick: "hint_wall_pick_touch",
  hint_kerb_pick: "hint_kerb_pick_touch",
  fixed_drag_hint: "fixed_drag_hint_touch",
  multi_hint: "multi_hint_touch",
  hint_furniture: "hint_furniture_touch",
  hint_opening: "hint_opening_touch",
};

/** A hint for the device in hand: reworded for touch where there is a text for it, else without its key parts. */
export function touchWording(touch: boolean, key: I18nKey, t: (k: I18nKey, p?: Record<string, string | number>) => string, params?: Record<string, string | number>): string {
  if (!touch) return t(key, params);
  const own = TOUCH_HINTS[key];
  return own ? t(own, params) : withoutKeyboard(t(key, params));
}

/** A part of a hint that names a key (Shift, Ctrl, Alt, Esc, Enter, Del, arrow keys, "R turns", "L fixes"). */
const KEY_PART = /\b(?:Shift|Ctrl|Strg|Alt|Esc|Enter|Del|Entf|Supr|Backspace)\b|arrow keys|Pfeiltasten|^[RL]\s/;

/** A hint without the parts that need a keyboard: the " · " separated parts naming a key are dropped. */
export function withoutKeyboard(text: string): string {
  const parts = text.split(" · ");
  const kept = parts.filter((p) => !KEY_PART.test(p.trim()));
  return kept.length && kept.length < parts.length ? kept.join(" · ") : text;
}
