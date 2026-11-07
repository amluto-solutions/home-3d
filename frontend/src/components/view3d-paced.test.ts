// The 3D view beside the editor's plan (#389, round 2): a new hass reaches it at most once a pace, whichever path set
// it, and a sync there never hands the plan over again (that rebuilt the scene on every power reading).
import assert from "node:assert/strict";
import { test } from "node:test";
import type { HomeAssistant } from "../types.ts";
import { cameraOwnSensors } from "../markers.ts";

for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) (globalThis as Record<string, unknown>)[`__FP3D_${k}_HASH__`] = "test";
(globalThis as Record<string, unknown>).__FP3D_VERSION__ = "test";
const { Fp3dView3d } = await import("./view3d.ts");

const st = (id: string, state: string) => ({ entity_id: id, state, attributes: {} });
const hassWith = (states: Record<string, string>) =>
  ({ language: "en", themes: { darkMode: true }, entities: {}, states: Object.fromEntries(Object.entries(states).map(([id, s]) => [id, st(id, s)])) }) as unknown as HomeAssistant;
const changed = (h: HomeAssistant, id: string, state: string) => ({ ...h, states: { ...h.states, [id]: st(id, state) } }) as HomeAssistant;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type View = Record<string, any>;

function view(hass: HomeAssistant, pace: number): View {
  const v = new Fp3dView3d() as unknown as View;
  Object.assign(v, { theme: "neon", hass, watched: ["sensor.sample_plug_power"], syncPace: pace });
  v.renderRoot = { querySelectorAll: () => [] };
  v.hassWatch.begin();
  v.hassWatch.end();
  return v;
}

function updatesFor(v: View, next: HomeAssistant): boolean {
  const old = v.hass;
  v.hass = next;
  return v.shouldUpdate(new Map([["hass", old]]));
}

test("beside the editor a watched power reading updates once a pace; the readings in between wait for one update", async () => {
  const v = view(hassWith({ "sensor.sample_plug_power": "1" }), 40);
  const first = v.hass;
  assert.equal(updatesFor(v, changed(v.hass, "sensor.sample_plug_power", "2")), true);
  const held = v.hass;
  assert.equal(updatesFor(v, changed(v.hass, "sensor.sample_plug_power", "3")), false);
  assert.equal(updatesFor(v, changed(v.hass, "sensor.sample_plug_power", "4")), false);
  // the held update comes from the pace's timer (the setter's own requests are Lit's)
  const requests: [string, unknown][] = [];
  v.requestUpdate = (name: string, old: unknown) => requests.push([name, old]);
  await new Promise((r) => setTimeout(r, 60));
  // one update follows, compared with the oldest hass it had not shown
  assert.deepEqual(requests, [["hass", held]]);
  assert.notEqual(held, first);
  clearTimeout(v.pacedTimer);
});

test("the House view (no pace) updates for every watched reading, as before", () => {
  const v = view(hassWith({ "sensor.sample_plug_power": "1" }), 0);
  assert.equal(updatesFor(v, changed(v.hass, "sensor.sample_plug_power", "2")), true);
  assert.equal(updatesFor(v, changed(v.hass, "sensor.sample_plug_power", "3")), true);
});

test("the editor's 3D keeps the plan it shows: the next sync does not hand it over again", () => {
  const v = view(hassWith({}), 1000);
  v.furnish = true;
  const b = { floors: [], settings: {} };
  const first = v.viewPlan(b);
  assert.equal(first, b);
  assert.equal(v.shownPlan.plan, b);
  // what syncDevices compares: the plan shown before and the plan now
  assert.equal(v.viewPlan(b), v.shownPlan.plan);
});

test("a camera's own motion sensors are found from one pass over the registry, kept while it stays", () => {
  const entities = {
    "camera.sample_drive": { entity_id: "camera.sample_drive", device_id: "d1" },
    "binary_sensor.sample_drive_motion": { entity_id: "binary_sensor.sample_drive_motion", device_id: "d1" },
    "binary_sensor.sample_drive_person": { entity_id: "binary_sensor.sample_drive_person", device_id: "d1" },
    "sensor.sample_drive_fps": { entity_id: "sensor.sample_drive_fps", device_id: "d1" },
    "binary_sensor.sample_other": { entity_id: "binary_sensor.sample_other", device_id: "d2" },
  };
  const states = {
    "binary_sensor.sample_drive_motion": { attributes: { device_class: "motion" } },
    "binary_sensor.sample_drive_person": { attributes: { device_class: "occupancy" } },
    "binary_sensor.sample_other": { attributes: { device_class: "motion" } },
  };
  const hass = { entities, states } as unknown as HomeAssistant;
  assert.deepEqual(cameraOwnSensors(hass, "camera.sample_drive"), ["binary_sensor.sample_drive_motion", "binary_sensor.sample_drive_person"]);
  // a device class read from the states of now (not kept)
  const later = { entities, states: { ...states, "binary_sensor.sample_drive_person": { attributes: { device_class: "sound" } } } } as unknown as HomeAssistant;
  assert.deepEqual(cameraOwnSensors(later, "camera.sample_drive"), ["binary_sensor.sample_drive_motion"]);
  assert.deepEqual(cameraOwnSensors(hass, "camera.sample_none"), []);
});
