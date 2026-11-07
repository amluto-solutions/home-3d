/**
 * Letting go of the keyboard when the plan selection changes (#56).
 *
 * A number or name box that keeps the cursor after a new item is chosen swallows the editor's shortcuts (Ctrl+D,
 * R, Delete, arrows return early while typing) and catches the next search typed (it renamed the item). So a
 * selection change releases a box that has the cursor. Buttons keep their focus: they don't take typing.
 */

/** The editor's properties that make up the plan selection. */
export const SELECTION_KEYS: ReadonlySet<string> = new Set(["_floorId", "_roomId", "_openingId", "_furnitureId", "_deviceId", "_outdoorId", "_wallId", "_multi"]);

/** Something with a focused element: a document or a shadow root. */
export interface FocusRoot {
  activeElement: unknown;
}

interface Focusable {
  tagName?: string;
  isContentEditable?: boolean;
  shadowRoot?: FocusRoot | null;
  blur?: () => void;
}

const TYPING_TAGS = new Set(["INPUT", "SELECT", "TEXTAREA"]);

/** The element with the cursor under `root`, followed into the shadow roots of components. */
export function deepActive(root: FocusRoot | null | undefined): Focusable | null {
  let el = (root?.activeElement ?? null) as Focusable | null;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement as Focusable;
  return el;
}

/** Whether keys typed here go into the element (and not to the editor's shortcuts). */
export function takesTyping(el: Focusable | null): boolean {
  return !!el && (TYPING_TAGS.has(el.tagName ?? "") || !!el.isContentEditable);
}

/** Blur the box with the cursor under `root` (its change event commits what was typed); true when one let go. */
export function releaseTyping(root: FocusRoot | null | undefined): boolean {
  const el = deepActive(root);
  if (!takesTyping(el) || !el?.blur) return false;
  el.blur();
  return true;
}

/** Hosts in the middle of a release (setting the old value back is a change of its own). */
const releasing = new WeakSet<object>();

/** Two values of a selection property mean the same choice (a fresh empty multi selection is no change). */
function same(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => x === b[i]);
  return a === b;
}

/** Whether a render's changed properties (old values) moved the selection of `host` (#71: the panel starts at the top). */
export function selectionMoved(changed: ReadonlyMap<PropertyKey, unknown>, host: object): boolean {
  for (const [key, old] of changed) {
    if (typeof key === "string" && SELECTION_KEYS.has(key) && !same(old, (host as Record<string, unknown>)[key])) return true;
  }
  return false;
}

/**
 * Called as a property of `host` has just changed from `oldValue`: when it is part of the selection, the box with
 * the cursor lets go. Its change handler still sees the OLD selection, so a value typed for the previous item is
 * saved on that item (and not on the new one, or dropped).
 */
export function beforeSelectionChange(host: object, key: string, oldValue: unknown, root: FocusRoot | null | undefined): void {
  if (!SELECTION_KEYS.has(key) || releasing.has(host)) return;
  const h = host as Record<string, unknown>;
  const now = h[key];
  if (same(now, oldValue) || !takesTyping(deepActive(root))) return;
  // the old value goes back for a moment (and the change is heard again while it does: that is ignored)
  releasing.add(host);
  try {
    h[key] = oldValue;
    releaseTyping(root);
  } finally {
    h[key] = now;
    releasing.delete(host);
  }
}
