import assert from "node:assert/strict";
import { test } from "node:test";
import { packsVersion } from "../packs.ts";
import type { HomeAssistant } from "../types.ts";

// the view's 3D bundle and lazy chunks read their hashes from build-time constants
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = await import("./view3d.ts");

const hass = (darkMode: boolean) => ({ language: "en", themes: { darkMode, theme: "default" }, states: {} }) as unknown as HomeAssistant;

/** A view with a stand-in 3D viewer that records the looks it is given. */
function view(theme: string, h: HomeAssistant) {
  const looks: string[] = [];
  const viewer = new Proxy({} as Record<string, unknown>, { get: (_, key) => (key === "setTheme" ? (t: string) => looks.push(t) : () => undefined) });
  const el = new Fp3dView3d() as unknown as Record<string, unknown> & { updated(c: Map<string, unknown>): void };
  Object.assign(el, { viewer, theme, hass: h, shownPacks: packsVersion() });
  return { el, looks };
}

test("switching HA to a light theme turns the whole 3D scene to Day, not only the sky and ground (#85)", () => {
  const before = hass(true);
  const { el, looks } = view("theme", hass(false));
  // only the theme changed in this hass: no entity the view watches moved
  el.updated(new Map([["hass", before]]));
  assert.equal(looks.at(-1), "day");
});

test("the view's chrome turns light with the Day look and dark again with Neon (#85)", () => {
  const { el } = view("theme", hass(false));
  const host = el as unknown as HTMLElement;
  el.updated(new Map([["hass", hass(true)]]));
  assert.equal(host.hasAttribute("light"), true);
  el.hass = hass(true);
  el.updated(new Map([["hass", hass(false)]]));
  assert.equal(host.hasAttribute("light"), false);
  el.theme = "day";
  el.updated(new Map([["theme", "neon"]]));
  assert.equal(host.hasAttribute("light"), true);
});

test("a look chosen by hand is not touched by a change of HA theme (#85)", () => {
  const { el, looks } = view("neon", hass(false));
  el.updated(new Map([["hass", hass(true)]]));
  assert.ok(!looks.includes("day"));
});
