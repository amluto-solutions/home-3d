// Voice (the microphone probe for now): its bundle loads only when it is asked for.

import type * as VoiceBundle from "./voice/entry.ts";
import { lazyBundle } from "./lazy-bundle.ts";

/** Content hash of the voice bundle, set by the build (see build.mjs). */
declare const __FP3D_VOICE_HASH__: string;

export const loadVoice = lazyBundle<typeof VoiceBundle>("home-3d-voice", () => __FP3D_VOICE_HASH__);

/**
 * Whether the microphone probe was asked for in the address ("?fp3d_mic=1", also after "#"). Remembered for this tab:
 * Home Assistant may drop the parameter when it forwards to a dashboard.
 */
export function micProbeAsked(): boolean {
  try {
    if (/[?&#]fp3d_mic=1\b/.test(location.href)) sessionStorage.setItem("home3d.mic", "1");
    return sessionStorage.getItem("home3d.mic") === "1";
  } catch {
    return false;
  }
}

/** Voice control on this device: the microphone button in the 3D view (the card has its option `voice`). */
export function voiceOnHere(): boolean {
  try {
    return localStorage.getItem("home3d.voice") === "1";
  } catch {
    return false;
  }
}

export function setVoiceHere(on: boolean): void {
  try {
    if (on) localStorage.setItem("home3d.voice", "1");
    else localStorage.removeItem("home3d.voice");
  } catch {
    // private mode: nothing remembered
  }
}

/** This device's screen name for Assist and the service `home_3d.ask` ("Kitchen"); empty: reacts to every sentence. */
export function screenName(): string {
  try {
    return localStorage.getItem("home3d.screen") ?? "";
  } catch {
    return "";
  }
}

export function setScreenName(name: string): void {
  try {
    if (name.trim()) localStorage.setItem("home3d.screen", name.trim());
    else localStorage.removeItem("home3d.screen");
  } catch {
    // private mode: nothing remembered
  }
}

/** The Assist pipeline chosen for this device (null: Home Assistant's preferred one). */
export function voicePipeline(): string | null {
  try {
    return localStorage.getItem("home3d.voicePipeline");
  } catch {
    return null;
  }
}

export function setVoicePipeline(id: string | null): void {
  try {
    if (id) localStorage.setItem("home3d.voicePipeline", id);
    else localStorage.removeItem("home3d.voicePipeline");
  } catch {
    // private mode: nothing remembered
  }
}

/** The probe closed: it does not open again in this tab. */
export function micProbeDone(): void {
  try {
    sessionStorage.removeItem("home3d.mic");
  } catch {
    // private mode
  }
}
