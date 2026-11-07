// The sample home (#54, #101): one call adds it as a home of its own, the switcher offers it, and on a Home
// Assistant without its (placeholder) devices every device shows a demo state (#100) and the energy flows.

import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadSampleHome } from "./api.ts";
import { demoStates, withDemo } from "./demo.ts";
import { deviceSensors, energySummary } from "./energy.ts";
import { translate } from "./i18n.ts";
import { normalizeBuilding, type Building } from "./model.ts";
import { setPacks, type FurniturePack, type PackItem } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";

const SAMPLE = new URL("../../custom_components/home_3d/sample/sample-home.json", import.meta.url);
const BUNDLED = fileURLToPath(new URL("../../custom_components/home_3d/bundled_packs", import.meta.url));

function filesIn(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => (statSync(join(dir, name)).isDirectory() ? filesIn(join(dir, name)) : [join(dir, name)]));
}

/** The bundled packs as the backend sends them. */
function bundledPacks(): FurniturePack[] {
  return readdirSync(BUNDLED)
    .map((name) => join(BUNDLED, name))
    .filter((dir) => statSync(dir).isDirectory())
    .map((dir) => {
      const meta = JSON.parse(readFileSync(join(dir, "pack.json"), "utf8"));
      const items = filesIn(dir)
        .filter((p) => p.endsWith(".json") && !p.endsWith(`${join(dir, "pack.json")}`))
        .map((p) => JSON.parse(readFileSync(p, "utf8")) as PackItem);
      return { ...meta, bundled: true, items } as FurniturePack;
    });
}

const sample = (): Building => normalizeBuilding(JSON.parse(readFileSync(SAMPLE, "utf8")) as Building);

/** Every entity id the sample names (a dotted `domain.object` string in any field). */
function entityIds(b: Building): Set<string> {
  const text = JSON.stringify({ ...b, recipes: undefined });
  return new Set([...text.matchAll(/"([a-z_]+\.[a-z0-9_]+)"/g)].map((m) => m[1]).filter((id) => /^[a-z_]+\.sample_/.test(id)));
}

const emptyHass = (): HomeAssistant => ({ language: "en", connection: {} as HomeAssistant["connection"], callWS: async () => undefined as never, callService: async () => undefined, entities: {}, states: {} });

test("loading the sample asks the backend for a new sample home", async () => {
  const sent: unknown[] = [];
  const hass = { callWS: async (msg: unknown) => (sent.push(msg), { homes: [], active: "h1", home: { id: "s1" } }) } as unknown as HomeAssistant;
  const res = await loadSampleHome(hass);
  assert.deepEqual(sent, [{ type: "home_3d/homes/load_sample" }]);
  assert.equal(res.home.id, "s1");
});

test("the switcher entry reads 'Load the sample home'", () => {
  assert.equal(translate({ language: "en" } as unknown as HomeAssistant, "home_sample"), "Load the sample home");
});

test("the shipped sample is a demo home whose entity ids are all placeholders (#101)", () => {
  const b = sample();
  assert.equal(b.settings.demo, true);
  assert.equal(b.settings.area_import, false);
  const raw = JSON.stringify(JSON.parse(readFileSync(SAMPLE, "utf8")));
  const all = new Set([...raw.matchAll(/"((?:light|switch|sensor|binary_sensor|climate|media_player|camera|input_boolean|cover|lock|fan|vacuum)\.[a-z0-9_]+)"/g)].map((m) => m[1]));
  assert.ok(all.size >= 40);
  assert.deepEqual([...all].filter((id) => !/^[a-z_]+\.sample_[a-z0-9_]+$/.test(id)), []);
});

test("every entity the sample links gets a demo state, and the energy summary has solar, battery and grid (#100, #101)", () => {
  setPacks(bundledPacks());
  try {
    const b = sample();
    const ids = entityIds(b);
    const demo = demoStates(b);
    assert.deepEqual([...ids].filter((id) => !demo.has(id)), []);
    const hass = withDemo(emptyHass(), b);
    for (const id of ids) assert.ok(hass.states[id], id);
    const sum = energySummary(hass, b, [], deviceSensors(b));
    assert.ok(sum.solar! > 0, `solar ${sum.solar}`);
    assert.ok(sum.battery! < 0, `battery ${sum.battery} (negative = charging)`);
    assert.ok(sum.grid! < 0, `grid ${sum.grid} (negative = export)`);
    assert.ok(sum.consumption! > 0, `consumption ${sum.consumption}`);
    assert.ok(sum.soc! > 0, `soc ${sum.soc}`);
  } finally {
    setPacks([]);
  }
});
