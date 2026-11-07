// Seasonal and conditional items (#15): an item shows while an entity is available and/or inside one of its intervals.

import type { Building, Furniture, ShowInterval, ShowWhen } from "./model.ts";
import type { HassEntity } from "./types.ts";

const two = (n: number) => String(n).padStart(2, "0");

/** A time of day as plans store it: "HH:MM", 00:00 to 23:59 (the cheap rate window and the show-when times). */
export const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

/** The "HH:MM" of a moment in the browser's local time. */
export function hhmm(at: Date): string {
  return `${two(at.getHours())}:${two(at.getMinutes())}`;
}

/** "MM-DD" days compare as text; a first day after the last runs over the new year. */
function inDays(day: string, from: string, to: string): boolean {
  return from <= to ? day >= from && day <= to : day >= from || day <= to;
}

/** "HH:MM" times compare as text: from the start up to (not including) the end; a start after the end runs over midnight. */
export function inTimes(time: string, start: string, end: string): boolean {
  return start <= end ? time >= start && time < end : time >= start || time < end;
}

/** Both first and last day, and both start and end, or neither (#46): an interval with one end alone is refused. */
export function wholeInterval(iv: ShowInterval): boolean {
  return !!iv.from === !!iv.to && !!iv.start === !!iv.end;
}

/**
 * The interval with one part changed as the editor sets it, never half-open (#46): picking one end of the days or
 * times fills the other (the same day; from or up to midnight), clearing one clears both.
 */
export function setIntervalPart(iv: ShowInterval, patch: ShowInterval): ShowInterval {
  const next: ShowInterval = { ...iv, ...patch };
  for (const [a, b, fill] of [["from", "to", null], ["start", "end", "00:00"]] as const) {
    const changed = a in patch ? a : b in patch ? b : null;
    if (!changed) continue;
    const other = changed === a ? b : a;
    if (!next[changed]) {
      next[a] = null;
      next[b] = null;
    } else if (!next[other]) next[other] = fill ?? next[changed];
  }
  return next;
}

/** Whether the moment lies in the interval (the parts left empty always fit; a half-open interval never does). */
function inside(iv: ShowInterval, now: Date): boolean {
  if (!wholeInterval(iv)) return false;
  const time = hhmm(now);
  // a time window over midnight belongs to the day it started (#46): after midnight the day is the one before
  const night = !!iv.start && !!iv.end && iv.start > iv.end && time < iv.end;
  const started = night ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1) : now;
  const day = `${two(started.getMonth() + 1)}-${two(started.getDate())}`;
  if (iv.from && iv.to && !inDays(day, iv.from, iv.to)) return false;
  return !iv.start || !iv.end || inTimes(time, iv.start, iv.end);
}

const ON_STATES = ["on", "true", "home", "open", "opening"];
const OFF_STATES = ["off", "false", "not_home", "away", "closed", "closing"];

/** Whether the rule follows an entity's on/off/typed state (#338); without it the entity only has to be available. */
export function followsState(rule: ShowWhen | null | undefined): boolean {
  const e = rule?.entity;
  return !!rule?.when && !!e && e !== "none";
}

/** Whether an entity's state counts as on (true), off (false) or neither (null): a person or tracker anywhere but home is off. */
export function onOff(entityId: string, state: string): boolean | null {
  const s = state.trim().toLowerCase();
  if (ON_STATES.includes(s)) return true;
  if (OFF_STATES.includes(s)) return false;
  return /^(person|device_tracker)\./.test(entityId) ? false : null;
}

/** Whether the item's entity condition (#338) lets it show: only rules with `when` look at the state, not at availability alone. */
function stateShown(rule: ShowWhen, states: Record<string, HassEntity>): boolean {
  const e = rule.entity as string;
  const state = states[e]?.state;
  if (state === undefined || state === "unavailable" || state === "unknown") return rule.unavailable !== "hide";
  if (rule.when === "state") {
    const wanted = (rule.state ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
    return !wanted.length || wanted.includes(state.trim().toLowerCase());
  }
  return onOff(e, state) === (rule.when === "on");
}

/** Whether the item is hidden by an entity's state (#338), the cheap kind: the 3D view only collapses it, no rebuild. */
export function stateHidden(f: Furniture, states: Record<string, HassEntity>): boolean {
  const rule = f.show_when;
  return !!rule && followsState(rule) && !stateShown(rule, states);
}

/** Whether the item shows now: the entity condition and the intervals all have to pass. */
export function itemShown(f: Furniture, states: Record<string, HassEntity>, now: Date): boolean {
  return !stateHidden(f, states) && !planHidden(f, states, now);
}

/** Hidden by the calendar, the clock or a plain "only while available" entity: the 3D view leaves it out of the plan. */
function planHidden(f: Furniture, states: Record<string, HassEntity>, now: Date): boolean {
  const rule = f.show_when;
  if (!rule) return false;
  const e = rule.entity;
  if (!followsState(rule) && e && e !== "none" && (states[e]?.state ?? "unavailable") === "unavailable") return true;
  const intervals = rule.intervals ?? [];
  return !!intervals.length && !intervals.some((iv) => inside(iv, now));
}

/** The ids of the items hidden now. */
export function hiddenItems(b: Building, states: Record<string, HassEntity>, now: Date): string[] {
  return b.floors.flatMap((fl) => fl.furniture.filter((f) => !itemShown(f, states, now)).map((f) => f.id));
}

/** The ids of the items the plan leaves out (the calendar, the clock, plain availability), not the state-hidden ones. */
export function planHiddenItems(b: Building, states: Record<string, HassEntity>, now: Date): string[] {
  return b.floors.flatMap((fl) => fl.furniture.filter((f) => planHidden(f, states, now)).map((f) => f.id));
}

/** The ids of the items an entity's state hides (#338). */
export function stateHiddenItems(b: Building, states: Record<string, HassEntity>): string[] {
  return b.floors.flatMap((fl) => fl.furniture.filter((f) => stateHidden(f, states)).map((f) => f.id));
}

/** The plan as the 3D view shows it: without the items the calendar and clock hide now (the very same plan when none is). */
export function shownBuilding(b: Building, states: Record<string, HassEntity>, now: Date): Building {
  const hidden = new Set(planHiddenItems(b, states, now));
  if (!hidden.size) return b;
  return { ...b, floors: b.floors.map((fl) => ({ ...fl, furniture: fl.furniture.filter((f) => !hidden.has(f.id)) })) };
}

/** Some item shows by the calendar or the clock: the 3D view looks again every minute. */
export function hasTimedRules(b: Building): boolean {
  return b.floors.some((fl) => fl.furniture.some((f) => !!f.show_when?.intervals?.length));
}
