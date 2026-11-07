// "Reset this device's preferences" (#254-#256): a chunk of its own, loaded when the button is pressed, so the Settings page's
// first open stays in budget. It asks first, then removes every device preference.
import { askConfirm } from "../ask.ts";
import type { DevicePrefs } from "./registry.ts";

/**
 * What "Reset this device's preferences" leaves alone: the lab and projection unlocks, unsaved edits of the editor
 * and the remembered home. Every other `home3d.*` key (the rows' own, and the toggles several parts of the view and
 * editor write straight to the browser) and every `fp3d-tt-*` time-travel choice goes.
 */
export const KEEP_ON_RESET: readonly string[] = ["home3d.lab", "home3d.projection", "home3d.unsaved", "home3d.unsaved.", "home3d.home."];

/** Whether the browser key is a device preference that a reset removes. */
export function isDevicePrefKey(key: string): boolean {
  if (KEEP_ON_RESET.some((k) => (k.endsWith(".") ? key.startsWith(k) : key === k))) return false;
  return key.startsWith("home3d.") || key.startsWith("fp3d-tt-");
}

/** The slice of Storage the reset needs. */
export interface KeyStore {
  readonly length: number;
  key(index: number): string | null;
  removeItem(key: string): void;
}

/** Removes every device preference from a store (the browser's local and session storage). Storage that throws is skipped. */
export function resetDevicePrefs(...stores: KeyStore[]): void {
  for (const store of stores) {
    try {
      const doomed: string[] = [];
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        if (k !== null && isDevicePrefKey(k)) doomed.push(k);
      }
      for (const k of doomed) store.removeItem(k);
    } catch {
      // storage blocked: nothing to reset
    }
  }
}

/** The browser's storages a reset looks through (blocked storage is skipped). */
function browserStores(): KeyStore[] {
  const out: KeyStore[] = [];
  for (const name of ["localStorage", "sessionStorage"] as const) {
    try {
      out.push(globalThis[name]);
    } catch {
      // blocked
    }
  }
  return out.filter(Boolean);
}

/** Asks, then resets this device's preferences; false when it was cancelled. */
export async function resetDevice(prefs: DevicePrefs, keys: string[], text: { ask: string; ok: string; cancel: string }): Promise<boolean> {
  if (!(await askConfirm(text.ask, { ok: text.ok, cancel: text.cancel, danger: true }))) return false;
  for (const key of keys) prefs.set(key, null);
  // and the toggles the view, editor and time travel keep in the browser outside the rows
  resetDevicePrefs(...browserStores());
  return true;
}
