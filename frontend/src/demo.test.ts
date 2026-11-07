import assert from "node:assert/strict";
import { test } from "node:test";
import { demoStates, withDemo } from "./demo.ts";
import { deviceSensors, energySummary, fieldPowers } from "./energy.ts";
import { demoHome } from "./demo-home.fixture.ts";
import type { HassEntity, HomeAssistant } from "./types.ts";
import { setPacks, type PackItem } from "./packs.ts";

function hassWith(states: HassEntity[] = []): HomeAssistant {
  return {
    language: "en",
    connection: {} as HomeAssistant["connection"],
    callWS: async () => undefined as never,
    callService: async () => "live",
    entities: {},
    states: Object.fromEntries(states.map((s) => [s.entity_id, s])),
  };
}

test("a demo home gives its missing lights fixed states, some of them on (#100)", () => {
  const hass = withDemo(hassWith(), demoHome());
  const lights = ["light.sample_lounge", "light.sample_kitchen", "light.sample_hall", "light.sample_lounge_floor"].map((id) => hass.states[id]);
  assert.ok(lights.every((s) => s && (s.state === "on" || s.state === "off")));
  assert.ok(lights.some((s) => s.state === "on"));
  assert.ok(lights.some((s) => s.state === "off"));
  const on = lights.find((s) => s.state === "on")!;
  assert.ok(Number(on.attributes.brightness) > 0);
});

test("an ordinary home gets no demo states: the very same hass comes back (#100)", () => {
  const live = hassWith();
  assert.equal(withDemo(live, demoHome(false)), live);
  assert.equal(withDemo(live, null), live);
});

test("a real entity always wins; only a missing or unavailable one gets the demo state (#100)", () => {
  const real = { entity_id: "light.sample_lounge", state: "off", attributes: {} };
  const gone = { entity_id: "light.sample_kitchen", state: "unavailable", attributes: {} };
  const hass = withDemo(hassWith([real, gone]), demoHome());
  assert.equal(hass.states["light.sample_lounge"], real);
  assert.equal(hass.states["light.sample_kitchen"].state, "on");
});

test("the demo hass is made once per update: the same live hass gives the same object and the same states (#100)", () => {
  const b = demoHome();
  const live = hassWith();
  const one = withDemo(live, b);
  assert.equal(withDemo(live, b), one);
  // a new live update keeps the demo state objects, so the 3D view sees no change in them
  const next = withDemo({ ...live, states: { ...live.states } }, b);
  assert.notEqual(next, one);
  assert.equal(next.states["light.sample_lounge"], one.states["light.sample_lounge"]);
});

test("the demo home's energy flows: solar producing, the battery charging, the house using power, some exported (#100)", () => {
  const b = demoHome();
  const hass = withDemo(hassWith(), b);
  const devices = deviceSensors(b);
  const sum = energySummary(hass, b, [], devices);
  assert.ok(sum.solar! >= 2000, `solar ${sum.solar}`);
  assert.ok(sum.battery! < 0, `battery ${sum.battery} (negative = charging)`);
  assert.ok(sum.grid! < 0, `grid ${sum.grid} (negative = export)`);
  assert.ok(sum.consumption! > 500, `consumption ${sum.consumption}`);
  assert.ok(sum.soc! > 20 && sum.soc! < 100, `soc ${sum.soc}`);
  // the roof field's own sensor carries the panels' power
  assert.ok(fieldPowers(hass, b, sum.solar).get("pv1")! > 0);
});

test("inverted grid and battery sensors get the sign the plan asks for (#100)", () => {
  const b = demoHome();
  b.energy = { ...b.energy, grid_invert: true, battery_invert: true };
  const sum = energySummary(withDemo(hassWith(), b), b, [], deviceSensors(b));
  assert.ok(sum.grid! < 0 && sum.battery! < 0);
});

test("the demo home's heating is on, the TV plays, the car charges and the room shows a temperature (#100)", () => {
  const hass = withDemo(hassWith(), demoHome());
  const trv = hass.states["climate.sample_lounge_trv"];
  assert.equal(trv.state, "heat");
  assert.equal(trv.attributes.hvac_action, "heating");
  assert.ok(Number(trv.attributes.temperature) > Number(trv.attributes.current_temperature));
  assert.equal(hass.states["media_player.sample_tv"].state, "playing");
  assert.equal(hass.states["input_boolean.sample_car_charging"].state, "on");
  assert.equal(hass.states["sensor.sample_lounge_temperature"].attributes.device_class, "temperature");
  assert.ok(Number(hass.states["sensor.sample_fridge_power"].state) > 0);
});

test("switching a demo device does nothing; a call for a real entity still reaches Home Assistant (#100)", async () => {
  const calls: string[] = [];
  const live = hassWith([{ entity_id: "light.real", state: "off", attributes: {} }]);
  live.callService = async (_d, _s, data) => calls.push(String(data?.entity_id));
  const hass = withDemo(live, demoHome());
  await hass.callService("light", "toggle", { entity_id: "light.sample_lounge" });
  await hass.callService("light", "toggle", { entity_id: ["light.sample_lounge", "light.real"] });
  assert.deepEqual(calls, ["light.sample_lounge,light.real"]);
  assert.equal(hass.states["light.sample_lounge"].state, "on");
});

test("once every device is real the demo adds nothing: the live hass comes back (#100)", () => {
  const b = demoHome();
  const everything = [...demoStates(b).keys()].map((id) => ({ entity_id: id, state: "5", attributes: {} }));
  const live = hassWith(everything);
  assert.equal(withDemo(live, b), live);
});

test("pack energy devices and a pack radiator with a TRV get their demo roles too (#100)", () => {
  const pi = (id: string, family: string): PackItem => ({ id, name: { en: id }, size: [0.5, 0.2, 0.6], group: "energy", family, electric: true, parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "white" }] });
  setPacks([{ id: "test.demo", name: "Demo", publisher: "test", items: [pi("hybrid", "inverter"), pi("battery", "home_battery"), pi("cu", "consumer_unit"), pi("trv", "radiator_trv")] }] as never);
  try {
    const b = demoHome();
    const f = b.floors[0];
    f.furniture = [
      { ...f.furniture[0], id: "inv", type: "pack:test.demo:hybrid", entity: null, power: "sensor.sample_inverter_power" },
      { ...f.furniture[0], id: "bat", type: "pack:test.demo:battery", entity: null, power: "sensor.sample_battery_power", soc: "sensor.sample_battery_soc" },
      { ...f.furniture[0], id: "cu", type: "pack:test.demo:cu", entity: null, power: "sensor.sample_house_power" },
      { ...f.furniture[0], id: "trv", type: "pack:test.demo:trv", entity: "climate.sample_bedroom_trv", state_entity: "sensor.sample_bedroom_trv_reading" },
    ];
    b.settings.roof = { ...b.settings.roof, solar: [] } as never;
    const hass = withDemo(hassWith(), b);
    const sum = energySummary(hass, b, [], deviceSensors(b));
    assert.ok(sum.solar! > 0 && sum.battery! < 0 && sum.grid! < 0, JSON.stringify(sum));
    assert.equal(hass.states["climate.sample_bedroom_trv"].attributes.hvac_action, "heating");
    // the TRV's own reading is a temperature, though its id does not say so
    assert.equal(hass.states["sensor.sample_bedroom_trv_reading"].attributes.device_class, "temperature");
  } finally {
    setPacks([]);
  }
});
