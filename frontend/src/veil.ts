/**
 * Dialog veils: a click on the veil closes its dialog only when the press began on the veil too. Marking a name with
 * the mouse and letting go outside the dialog is a click on the veil as well, and used to close it.
 */
let pressedOn: EventTarget | null = null;
if (typeof document !== "undefined") document.addEventListener("pointerdown", (e) => (pressedOn = e.composedPath()[0] ?? null), true);

/** Pure: is this click one that closes? `pressed` is where the press began (null: unknown, as before). */
export function veilClick(target: EventTarget | null, veil: EventTarget | null, pressed: EventTarget | null): boolean {
  return target === veil && (pressed === null || pressed === veil);
}

export const onVeil = (e: Event): boolean => veilClick(e.target, e.currentTarget, pressedOn);
