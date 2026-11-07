// Keyboard focus in modal dialogs (#196): a dialog takes the focus when it opens, keeps Tab and Shift+Tab inside
// itself while it is open and gives the focus back to where it was when it closes. Used as an element directive on
// the dialog box: `<div role="dialog" aria-modal="true" ${modalFocus()}>`.

import { nothing } from "lit";
import { AsyncDirective, directive, PartType, type ElementPart, type PartInfo } from "lit/async-directive.js";

/** What can take the focus with Tab (disabled and hidden controls are left out when the list is made). */
export const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]:not([tabindex="-1"]), [contenteditable="true"]';

/** Something that can hold the focus: a document or a shadow root. */
interface FocusRoot {
  activeElement: Element | null;
}

/**
 * Where Tab should go instead of the browser's next stop, or null to let the browser move on: from the last control
 * Tab goes to the first, from the first Shift+Tab to the last, and from outside the dialog (or the dialog box
 * itself) to the first or last. A focus inside a control of the dialog that is not in the list (inside a component's
 * own shadow root) is left to the browser.
 */
export function wrapTab<T>(list: readonly T[], current: T | null, back: boolean, inside: boolean): T | null {
  if (!list.length) return null;
  const first = list[0]!;
  const last = list[list.length - 1]!;
  const at = current === null ? -1 : list.indexOf(current);
  if (at < 0) return inside ? null : back ? last : first;
  if (back && at === 0) return last;
  if (!back && at === list.length - 1) return first;
  return null;
}

/** The controls in a dialog box that Tab stops at, in document order. */
export function focusables(box: HTMLElement): HTMLElement[] {
  return [...box.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
    (el) => !(el as HTMLButtonElement).disabled && el.tabIndex >= 0 && el.getClientRects().length > 0 && !el.closest("[inert]"),
  );
}

/** The element with the focus in the box's own root (a shadow root or the document). */
function activeIn(box: HTMLElement): HTMLElement | null {
  return ((box.getRootNode() as unknown as FocusRoot).activeElement as HTMLElement | null) ?? null;
}

/** Keeps a Tab key press inside the box (call it from the box's keydown). */
export function trapTab(e: KeyboardEvent, box: HTMLElement): void {
  if (e.key !== "Tab" || e.altKey || e.ctrlKey || e.metaKey) return;
  const list = focusables(box);
  const active = activeIn(box);
  const inside = !!active && active !== box && box.contains(active);
  const to = list.length ? wrapTab(list, inside ? active : null, e.shiftKey, inside) : box;
  if (!to) return;
  e.preventDefault();
  to.focus();
}

/** The element with the focus on the page, looking into shadow roots. */
export function pageFocus(doc: FocusRoot = document): HTMLElement | null {
  let el = doc.activeElement as HTMLElement | null;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement as HTMLElement;
  return el;
}

/** The control a dialog focuses when it opens: the box itself when it can take the focus (its keys work there and a
 * screen reader reads its name), else its first control. */
function openingFocus(box: HTMLElement): HTMLElement | null {
  return box.hasAttribute("tabindex") ? box : (focusables(box)[0] ?? null);
}

class ModalFocus extends AsyncDirective {
  private box: HTMLElement | null = null;
  private back: HTMLElement | null = null;
  private readonly onKey = (e: KeyboardEvent) => {
    if (this.box) trapTab(e, this.box);
  };

  constructor(part: PartInfo) {
    super(part);
    if (part.type !== PartType.ELEMENT) throw new Error("modalFocus() goes on the dialog element");
  }

  render(): typeof nothing {
    return nothing;
  }

  update(part: ElementPart): typeof nothing {
    const box = part.element as HTMLElement;
    if (box !== this.box) {
      this.release(false);
      this.box = box;
      this.back = pageFocus();
      box.addEventListener("keydown", this.onKey);
      // after the dialog is drawn: a control that took the focus itself meanwhile keeps it
      requestAnimationFrame(() => {
        if (this.box !== box || !box.isConnected) return;
        const active = activeIn(box);
        if (!active || active === box || !box.contains(active)) openingFocus(box)?.focus();
      });
    }
    return nothing;
  }

  /** The dialog went: the focus goes back to where it was before (when that is still on the page). */
  private release(restore: boolean): void {
    this.box?.removeEventListener("keydown", this.onKey);
    const back = this.back;
    this.box = null;
    this.back = null;
    if (restore && back?.isConnected) back.focus();
  }

  protected disconnected(): void {
    this.release(true);
  }

  protected reconnected(): void {
    // a dialog drawn again takes the focus as on its first opening (update follows)
  }
}

/** Element directive for a modal dialog box: focus in on open, Tab kept inside, focus back on close (#196). */
export const modalFocus = directive(ModalFocus);
