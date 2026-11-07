// The browser check (#178, scripts/browser-check.mjs) loads the shipped bundles with a fake Home Assistant: CI runs it
// after every build, so a bundle that fails to load in a browser cannot ship.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { HomeAssistant } from "./types.ts";

interface Fake {
  readonly hass: HomeAssistant;
  linked: string[];
  filler: string[];
  unknown: Set<string>;
  tick(id?: string): HomeAssistant;
}
const fakeUrl = new URL("../scripts/browser-check/fake-hass.js", import.meta.url).href;
const { makeFakeHass } = (await import(fakeUrl)) as { makeFakeHass: (plan: unknown, build: { build: string; version: string }) => Fake };
const plan = JSON.parse(readFileSync(new URL("../../custom_components/home_3d/sample/sample-home.json", import.meta.url), "utf8")) as { floors: unknown[] };

test("the fake Home Assistant has the plan's entities among about 5,000 states, like a big install (#178)", () => {
  const fake = makeFakeHass(plan, { build: "b", version: "v" });
  const states = fake.hass.states;
  assert.ok(Object.keys(states).length > 4900);
  assert.ok(fake.linked.length > 50);
  for (const id of fake.linked) assert.ok(states[id], id);
  assert.ok(fake.linked.every((id) => /^[a-z_]+\.sample_[a-z0-9_]+$/.test(id)), "only the sample's placeholder ids");
});

test("a tick hands a new hass with one state changed, as Home Assistant does (#178)", () => {
  const fake = makeFakeHass(plan, { build: "b", version: "v" });
  const before = fake.hass;
  const next = fake.tick();
  assert.notEqual(next, before);
  assert.equal(next.entities, before.entities);
  const changed = Object.keys(next.states).filter((id) => next.states[id] !== before.states[id]);
  assert.equal(changed.length, 1);
  assert.ok(fake.filler.includes(changed[0]!));
  const light = fake.linked.find((id) => id.startsWith("light."))!;
  assert.notEqual(fake.tick(light).states[light], next.states[light]);
});

test("the fake backend answers the calls the panel makes on load; it keeps nothing (#178)", async () => {
  const fake = makeFakeHass(plan, { build: "b", version: "v" });
  const got = await fake.hass.callWS<{ building: { floors: unknown[] }; can_edit: boolean; build: string }>({ type: "home_3d/building/get" });
  assert.equal(got.building.floors.length, plan.floors.length);
  assert.equal(got.can_edit, true);
  assert.equal(got.build, "b");
  assert.deepEqual(await fake.hass.callWS({ type: "home_3d/packs/list" }), { packs: [] });
  await fake.hass.callWS({ type: "home_3d/something/new" });
  assert.deepEqual([...fake.unknown], ["home_3d/something/new"]);
});

test("CI loads the shipped bundles in a headless browser after the build (#178)", () => {
  const ci = readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8");
  const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as { scripts: Record<string, string> };
  assert.match(pkg.scripts.smoke ?? "", /scripts\/browser-check\.mjs/);
  assert.match(pkg.scripts.speed ?? "", /browser-check\.mjs --speed/);
  const build = ci.indexOf("npm run build");
  const smoke = ci.indexOf("npm run smoke");
  assert.ok(build > 0 && smoke > build, "the smoke check runs after the build");
});
