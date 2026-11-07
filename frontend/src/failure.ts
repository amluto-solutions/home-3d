// A short message when something the household pressed did not work (#171): a service call that Home Assistant
// refused, a picture that was not stored. One toast per page, over everything (a card on a wall tablet may be full
// screen, so it goes into the full-screen element). The texts come from the caller (the items bundle has no room for
// i18n.ts). Tests set a sink and read what was shown.

import type { HomeAssistant } from "./types.ts";

type FailureGlobal = { __fp3dFailureSink?: ((text: string) => void) | null };
const g = globalThis as FailureGlobal;

/** Replaces the toast (tests); null brings it back. */
export function setFailureSink(sink: ((text: string) => void) | null): void {
  g.__fp3dFailureSink = sink;
}

/** Whether a picture was refused because the home holds as many as it may (#364). */
export function isImagesFull(err: unknown): boolean {
  return ((err ?? {}) as { code?: string }).code === "images_full";
}

/** What went wrong in a few words: the error's own message, else its code, else the text of whatever was thrown. */
export function errorText(err: unknown): string {
  const e = (err ?? {}) as { message?: string; code?: string | number; error?: { message?: string } };
  return String(e.message ?? e.error?.message ?? e.code ?? err);
}

let timer: ReturnType<typeof setTimeout> | undefined;

/** Longest message shown at once; a tap on a longer one shows it whole (#243). */
export const FAILURE_CHARS = 160;

/** The message as shown first: cut at a word near FAILURE_CHARS, with "…" (the whole text is in its tooltip). */
export function shortFailure(text: string): string {
  if (text.length <= FAILURE_CHARS) return text;
  const cut = text.slice(0, FAILURE_CHARS);
  const space = cut.lastIndexOf(" ");
  return `${(space > FAILURE_CHARS * 0.6 ? cut.slice(0, space) : cut).trimEnd()} …`;
}

/**
 * Shows `text` for a few seconds (a second one replaces the first). It sits at the top, clear of Home Assistant's own
 * toasts at the bottom centre (#243: the two were drawn over each other); a long one is cut short, a tap shows it whole.
 */
export function showFailure(text: string): void {
  if (g.__fp3dFailureSink) return g.__fp3dFailureSink(text);
  if (typeof document === "undefined") return;
  let fs: Element | null = document.fullscreenElement;
  while (fs?.shadowRoot?.fullscreenElement) fs = fs.shadowRoot.fullscreenElement;
  const root = fs ?? document.body;
  let el = root.querySelector<HTMLElement>(":scope > .fp3d-failure");
  if (!el) {
    el = document.createElement("div");
    el.className = "fp3d-failure";
    el.setAttribute("role", "alert");
    el.style.cssText =
      "position:fixed;left:50%;top:calc(64px + env(safe-area-inset-top, 0px));transform:translateX(-50%);cursor:pointer;z-index:2147483000;max-width:min(92vw,520px);padding:12px 16px;border-radius:12px;" +
      "background:#8a1f1f;color:#fff;font:14px/1.35 system-ui,sans-serif;box-shadow:0 6px 24px rgba(0,0,0,.45);";
    root.appendChild(el);
  }
  const box = el;
  box.textContent = shortFailure(text);
  box.title = text;
  box.onclick = () => {
    box.textContent = text;
    clearTimeout(timer);
    timer = setTimeout(() => box.remove(), 12000);
  };
  clearTimeout(timer);
  timer = setTimeout(() => box.remove(), 6000);
}

/**
 * Calls a Home Assistant service and shows `message({error})` when it is refused or never arrives. Never throws: a
 * press that does nothing used to look exactly like one that worked. Home Assistant is asked not to show its own toast
 * as well (#243: one failed press, one message).
 */
export function callServiceSafe(hass: HomeAssistant, domain: string, service: string, data: Record<string, unknown>, message: (error: string) => string): void {
  const fail = (err: unknown) => showFailure(message(errorText(err)));
  try {
    void Promise.resolve(hass.callService(domain, service, data, undefined, false)).catch(fail);
  } catch (err) {
    fail(err);
  }
}
