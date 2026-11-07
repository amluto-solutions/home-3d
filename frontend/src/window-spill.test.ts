// The light out of lit windows is a setting of each device and off unless it is switched on (#274).

import assert from "node:assert/strict";
import { test } from "node:test";
import { settingById } from "./settings/registry.ts";

test("window light spill: off by default, kept per device, read back (#274)", () => {
  const s = settingById("window_glow")!;
  assert.equal(s.scope, "device");
  assert.equal(s.default, false);
  const store = new Map<string, string>();
  const env = { building: null, hass: undefined, prefs: { get: (k: string) => store.get(k) ?? null, set: (k: string, v: string | null) => void (v === null ? store.delete(k) : store.set(k, v)) } };
  assert.equal(s.read(env), false);
  s.write!(env, true as never);
  assert.equal(store.get("window_spill"), "1");
  assert.equal(s.read(env), true);
});
