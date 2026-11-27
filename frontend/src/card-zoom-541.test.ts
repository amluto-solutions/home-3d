// The zoom view's own parts (#541): how much a card grows, and the optional auto close this device sets (off by default).

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { CARD_TIME_MAX, ZOOM_CLOSE_KEY, zoomCloseMs } from "./card-times.ts";
import { SETTINGS } from "./settings/registry.ts";

test("the auto close is off unless this device sets a time (#541)", () => {
  assert.equal(zoomCloseMs(null), 0, "default: off");
  assert.equal(zoomCloseMs(""), 0);
  assert.equal(zoomCloseMs("0"), 0);
  assert.equal(zoomCloseMs("abc"), 0);
  assert.equal(zoomCloseMs("45"), 45000);
  assert.equal(zoomCloseMs(String(CARD_TIME_MAX * 10)), CARD_TIME_MAX * 1000, "at most an hour");
});

test("the auto close is a Settings row of this device, nothing hard coded (#541)", () => {
  const row = SETTINGS.find((s) => s.id === "card_zoom_close")!;
  assert.ok(row, "a row in Settings");
  assert.equal(row.scope, "device");
  assert.equal(row.default, null, "off by default");
  const prefs = new Map<string, string | null>();
  const env = { prefs: { get: (k: string) => prefs.get(k) ?? null, set: (k: string, v: string | null) => void prefs.set(k, v) } } as never;
  row.write!(env, 20 as never);
  assert.equal(prefs.get(ZOOM_CLOSE_KEY), "20");
  assert.equal(row.read(env), 20);
  row.write!(env, null as never);
  assert.equal(row.read(env), null);
  const zoom = readFileSync(new URL("./components/card-zoom.ts", import.meta.url), "utf8");
  assert.ok(zoom.includes("zoomCloseMs(devicePref(ZOOM_CLOSE_KEY))"), "the view reads the setting each time it starts the timer");
});

test("a card grows to fill the space, never under its own size, at most four times (#541)", async () => {
  const g = globalThis as Record<string, unknown>;
  // the element's module defines a Lit element: a stand-in HTMLElement is enough to read its pure functions
  g.HTMLElement ??= class {};
  g.customElements ??= { get: () => undefined, define: () => undefined };
  const { zoomScale } = await import("./components/card-zoom.ts");
  assert.equal(zoomScale(260, 200, 374, 700), 374 / 260, "a phone: the width decides");
  assert.equal(zoomScale(260, 300, 1360, 780), 2.6, "a desktop: the height decides");
  assert.equal(zoomScale(260, 100, 4000, 4000), 4, "at most four times");
  assert.equal(zoomScale(260, 300, 200, 200), 1, "never smaller than the card");
  assert.equal(zoomScale(0, 0, 500, 500), 1, "not measured yet");
});
