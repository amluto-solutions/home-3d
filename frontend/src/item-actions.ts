/**
 * Own tap, hold and double-tap actions of a placed device or a furniture item (#6). Whatever talks to another
 * system goes through Home Assistant (a service call), never through the browser.
 */

import type { Floor, Furniture } from "./model.ts";

/** What an editor can make a gesture do; "default" (or nothing set) keeps what the item does by its kind. */
export type ActionType = "default" | "none" | "toggle" | "more_info" | "camera" | "navigate" | "url" | "perform_action";
export const ACTION_TYPES: readonly ActionType[] = ["default", "none", "toggle", "more_info", "camera", "navigate", "url", "perform_action"];

export interface ItemAction {
  action: ActionType;
  /**
   * toggle / more_info / camera: the entity (empty = the item's own); navigate: a dashboard path; url: the address;
   * perform_action: the action as "domain.service" (script.turn_on, rest_command.x, …).
   */
  target?: string | null;
  /** perform_action: the data sent with it. */
  data?: Record<string, unknown> | null;
  /** Ask first, in the app's own dialog. */
  confirm?: boolean;
  /** The question asked (empty: the default one). */
  confirm_text?: string | null;
}

/**
 * A perform_action runs any Home Assistant action in the session of whoever taps, so the server only lets an admin
 * add or change one (#51). Whether the editor may choose this type for a gesture whose action is `current`.
 */
export function actionTypeChoosable(type: ActionType, current: ItemAction | null | undefined, isAdmin: boolean): boolean {
  return type !== "perform_action" || isAdmin || current?.action === "perform_action";
}

/** An existing perform_action a non-admin editor can only replace or keep, not change (its fields are read only). */
export function performActionLocked(action: ItemAction | null | undefined, isAdmin: boolean): boolean {
  return action?.action === "perform_action" && !isAdmin;
}

/**
 * A non-admin editor's copy of items (paste, duplicate) loses every perform_action: the server keys them by item id, so
 * on a copy one counts as new and refuses the whole save (#383). Those gestures go back to the default, in place.
 * Returns how many were dropped.
 */
export function dropAdminActions(items: readonly Furniture[]): number {
  let dropped = 0;
  for (const m of items) {
    for (const [gesture, action] of Object.entries(m.actions ?? {})) {
      if (action?.action !== "perform_action") continue;
      (m.actions as Record<string, ItemAction | null>)[gesture] = { action: "default" };
      dropped++;
    }
  }
  return dropped;
}

/** What the app lets an action do. */
export interface ActionEnv {
  callService(domain: string, service: string, data: Record<string, unknown>): Promise<unknown>;
  moreInfo(entityId: string): void;
  camera(entityId: string): void;
  navigate(path: string): void;
  openUrl(url: string): void;
  /** Ask in the app's own dialog; the text is the editor's (null: the default question). */
  confirm(text: string | null): Promise<boolean>;
  /** The host Home Assistant is served from; a link to any other host asks first (#384). */
  ownHost: string;
  /** The question for a link to another host, naming `host`. */
  externalText(host: string): string;
}

/** Run an action of an item whose own entity is `itemEntity`; false when nothing ran (nothing to do, or cancelled). */
export async function runItemAction(action: ItemAction, itemEntity: string | null, env: ActionEnv): Promise<boolean> {
  const run = plan(action, itemEntity, env);
  if (!run) return false;
  if (action.confirm && !(await env.confirm(action.confirm_text?.trim() || null))) return false;
  // a link to another host always asks, whatever the item says: an editor must not send a wall tablet to a site unasked (#384)
  const host = action.action === "url" ? otherHost(action.target?.trim() ?? "", env.ownHost) : null;
  if (host && !(await env.confirm(env.externalText(host)))) return false;
  await run();
  return true;
}

/** The host of an http(s) address when it is not `own`; null for a path on this Home Assistant or the own host. */
export function otherHost(target: string, own: string): string | null {
  if (!/^https?:\/\//i.test(target)) return null;
  try {
    const host = new URL(target).host;
    return host && host.toLowerCase() !== own.toLowerCase() ? host : null;
  } catch {
    return null;
  }
}

/** What an action does, or null when it cannot run (no target, not a service). */
function plan(action: ItemAction, itemEntity: string | null, env: ActionEnv): (() => unknown) | null {
  const target = action.target?.trim() ?? "";
  switch (action.action) {
    case "perform_action": {
      const m = /^([a-z0-9_]+)\.([a-z0-9_]+)$/.exec(target);
      return m ? () => env.callService(m[1], m[2], { ...(action.data ?? {}) }) : null;
    }
    case "navigate":
      return target ? () => env.navigate(target) : null;
    case "url":
      // http(s) or a path on this Home Assistant only, never javascript: or another scheme (#51); "//host" and "/\host"
      // are other hosts, not paths (#384). A link to another host asks first (runItemAction).
      return /^(https?:\/\/\S+|\/(?![/\\])\S*)$/i.test(target) && (target[0] === "/" || URL.canParse(target)) ? () => env.openUrl(target) : null;
    case "toggle":
    case "more_info":
    case "camera": {
      const entity = target || itemEntity;
      if (!entity) return null;
      if (action.action === "toggle") return () => env.callService("homeassistant", "toggle", { entity_id: entity });
      return action.action === "more_info" ? () => env.moreInfo(entity) : () => env.camera(entity);
    }
    default:
      return null;
  }
}

export type Gesture = "tap" | "hold" | "double_tap";
export const GESTURES: readonly Gesture[] = ["tap", "hold", "double_tap"];

/** An item's own actions per gesture; a gesture left out keeps what the item does by its kind. */
export type ItemActions = Partial<Record<Gesture, ItemAction | null>>;

/** The actions of one item and the entity they act on by default. */
export interface ActionOwner {
  actions: ItemActions;
  entity: string | null;
}

/** Whether any gesture has an own action. */
export function hasOwnActions(actions: ItemActions | null | undefined): actions is ItemActions {
  return !!actions && GESTURES.some((g) => !!actions[g] && actions[g]!.action !== "default");
}

/**
 * Items with own actions, by the id a tap on them reports: a placed device's entity, a furniture item's pick
 * target (its entity or pin), else "item:<id>" – an item without an entity becomes tappable that way.
 */
export function actionIndex(
  floors: readonly Floor[],
  targetOf: (furnitureId: string) => string | undefined,
  entityOf: (f: Furniture) => string | null,
): Map<string, ActionOwner> {
  const out = new Map<string, ActionOwner>();
  for (const floor of floors) {
    for (const p of floor.placements) if (hasOwnActions(p.actions) && !out.has(p.entity_id)) out.set(p.entity_id, { actions: p.actions, entity: p.entity_id });
    for (const f of floor.furniture) {
      if (!hasOwnActions(f.actions)) continue;
      const id = targetOf(f.id) ?? `item:${f.id}`;
      if (!out.has(id)) out.set(id, { actions: f.actions, entity: entityOf(f) });
    }
  }
  return out;
}

/** The own action of a gesture, or null to keep the usual behaviour. */
export function gestureAction(owner: ActionOwner | undefined, gesture: Gesture): ItemAction | null {
  const a = owner?.actions[gesture];
  return a && a.action !== "default" ? a : null;
}

/**
 * Tells a tap from a double tap on items with a double-tap action: their tap waits a moment for a second one.
 * Items without one run their tap at once, as before.
 */
export class TapSequencer {
  private pending: { id: string; timer: ReturnType<typeof setTimeout>; single: () => void; double: () => void } | null = null;

  private readonly wait: number;

  constructor(wait = 320) {
    this.wait = wait;
  }

  tap(id: string, hasDouble: boolean, single: () => void, double: () => void): void {
    if (this.pending?.id === id) {
      this.doubleTap(id);
      return;
    }
    this.flush();
    if (!hasDouble) {
      single();
      return;
    }
    const timer = setTimeout(() => {
      this.pending = null;
      single();
    }, this.wait);
    this.pending = { id, timer, single, double };
  }

  /** A double tap reported for an item: true when it ended that item's waiting tap (and ran its double tap). */
  doubleTap(id: string): boolean {
    const p = this.pending;
    if (!p || p.id !== id) return false;
    clearTimeout(p.timer);
    this.pending = null;
    p.double();
    return true;
  }

  /** A waiting tap runs now (as a single tap). */
  private flush(): void {
    const p = this.pending;
    if (!p) return;
    clearTimeout(p.timer);
    this.pending = null;
    p.single();
  }

  /** Drop a waiting tap (the view goes away). */
  cancel(): void {
    if (this.pending) clearTimeout(this.pending.timer);
    this.pending = null;
  }
}

/** The actions with one gesture set (null or "default": dropped); null when no gesture is left. */
export function withGesture(actions: ItemActions | null | undefined, gesture: Gesture, action: ItemAction | null): ItemActions | null {
  const next: ItemActions = { ...(actions ?? {}) };
  if (action && action.action !== "default") next[gesture] = action;
  else delete next[gesture];
  return hasOwnActions(next) ? next : null;
}

/** Service data from the editor's text field: a JSON object, or null when empty. Throws on anything else. */
export function parseActionData(text: string): Record<string, unknown> | null {
  if (!text.trim()) return null;
  const v: unknown = JSON.parse(text);
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new TypeError("not an object");
  return v as Record<string, unknown>;
}
