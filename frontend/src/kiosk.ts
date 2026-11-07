// Kiosk helpers of the dashboard card (wall tablets): when the night dimming is active.

import type { HomeAssistant } from "./types.ts";

/**
 * Whether the card is dimmed for the night: "sun" follows sun.sun, "HH:MM-HH:MM" is a daily time
 * range (it may cross midnight), anything else is off.
 */
export function nightActive(night: string | undefined, hass: HomeAssistant | undefined, now = new Date()): boolean {
  if (!night || night === "off") return false;
  if (night === "sun") return hass?.states["sun.sun"]?.state === "below_horizon";
  const m = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(night.trim());
  if (!m) return false;
  const from = Number(m[1]) * 60 + Number(m[2]);
  const to = Number(m[3]) * 60 + Number(m[4]);
  const t = now.getHours() * 60 + now.getMinutes();
  return from <= to ? t >= from && t < to : t >= from || t < to;
}

/** Address values that switch tablet mode off for this page even when the user has it ticked. */
const OFF = new Set(["0", "off", "false", "no"]);

/**
 * Locked tablet mode of the panel (#92, wall displays): "?tablet" in the address (one device, e.g. the start URL of a
 * kiosk browser) or a tick for the signed-in Home Assistant user (`settings.tablet_users`). "?tablet=0" switches it
 * off on this page again, the way back for an admin on a ticked account.
 */
export function tabletMode(search: string, userId: string | undefined, tabletUsers: readonly string[] | undefined): boolean {
  const asked = new URLSearchParams(search).get("tablet");
  if (asked !== null) return !OFF.has(asked.trim().toLowerCase());
  return !!userId && !!tabletUsers?.includes(userId);
}

/** Seconds without a touch before a tablet goes back to the whole house when nothing else is set (#92). */
export const TABLET_IDLE_DEFAULT = 120;

/** The tablet's idle return in seconds (0 = never): "?idle=" in the address, else the plan's `tablet_idle`. */
export function tabletIdleSeconds(search: string, setting: number | null | undefined): number {
  const valid = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v) && v >= 0;
  const asked = new URLSearchParams(search).get("idle");
  const fromUrl = asked !== null && asked.trim() !== "" ? Number(asked) : null;
  if (valid(fromUrl)) return fromUrl;
  return valid(setting) ? setting : TABLET_IDLE_DEFAULT;
}

/** Calls `onIdle` once after `seconds` without a touch (0 = never); every touch starts the wait again. */
export class IdleClock {
  private timer: ReturnType<typeof setTimeout> | undefined;
  private seconds = 0;
  private readonly onIdle: () => void;

  constructor(onIdle: () => void) {
    this.onIdle = onIdle;
  }

  /** Sets the quiet spell and starts waiting. */
  arm(seconds: number): void {
    this.seconds = seconds > 0 ? seconds : 0;
    this.touch();
  }

  /** Someone used the screen: wait the whole spell again. */
  touch(): void {
    clearTimeout(this.timer);
    this.timer = this.seconds > 0 ? setTimeout(this.onIdle, this.seconds * 1000) : undefined;
  }

  /** No more waiting until the next touch or arm. */
  stop(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
  }
}
