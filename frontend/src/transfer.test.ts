import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { emptyBuilding, newFloor, PLAN_VERSION, type Building } from "./model.ts";
import { exportFile, isEntityLink, parseExport } from "./transfer.ts";

function building() {
  const b = emptyBuilding();
  const f = newFloor("ground", "Ground", 0);
  f.rooms = [{ id: "r", name: "Living room", area_id: "living_room", points: [[0, 0], [4, 0], [4, 3], [0, 3]], floor_material: "wood" }];
  f.furniture = [{ id: "m", type: "lamp_ceiling", x: 2, z: 1.5, rotation: 0, w: 0.4, d: 0.4, h: 0.08, variant: null, entity: "light.ceiling", power: null }];
  f.placements = [{ entity_id: "sensor.temp", x: 1, z: 1, y: null }];
  f.background = { image_id: "img", x: 0, z: 0, width: 10, opacity: 0.5 };
  b.floors = [f];
  b.energy.grid = "sensor.grid";
  b.presence = [{ person: "person.mia", sensor: "sensor.mia" }];
  return b;
}

test("a shareable export has no entities, areas or images", () => {
  const file = exportFile(building(), true);
  const f = file.building.floors[0];
  assert.equal(f.rooms[0].area_id, null);
  assert.equal(f.furniture[0].entity, null);
  assert.deepEqual(f.placements, []);
  assert.equal(f.background, null);
  assert.equal(file.building.energy.grid, null);
  assert.deepEqual(file.building.presence, []);
  // the room shape and the lamp stay
  assert.equal(f.rooms[0].points.length, 4);
  assert.equal(f.furniture[0].type, "lamp_ceiling");
});

test("import reads export files and plain buildings, and rejects anything else", () => {
  const full = exportFile(building(), false);
  const back = parseExport(JSON.stringify(full));
  assert.equal(back.floors[0].furniture[0].entity, "light.ceiling");
  assert.equal(back.floors[0].background, null, "images are not imported");
  assert.equal(parseExport(JSON.stringify(building())).floors.length, 1);
  assert.throws(() => parseExport("{}"));
  assert.throws(() => parseExport("not json"));
});

/** A plan with every field that can hold a link to this Home Assistant filled (#155). */
function linked(): Building {
  const e = (n: string) => `sensor.${n}`;
  const b = emptyBuilding();
  const f = newFloor("ground", "Ground", 0);
  f.ha_floor = "ground";
  f.rooms = [
    {
      id: "r", name: "Living", area_id: "living_room", points: [[0, 0], [4, 0], [4, 3], [0, 3]], floor_material: "wood",
      climate: { temperature: e("t"), humidity: e("h"), co2: e("c") }, live: { leak: e("leak"), motion: e("motion") },
      panel: [e("p1")], hidden: [e("h1")], no_state: [e("n1")],
    },
  ];
  const common = {
    entity: "light.a", power: e("w"), awning_position: e("a"), bin_source: "calendar.waste", bin_out: "input_boolean.out", mailbox_door: e("door"),
    moisture: e("m"), remaining: e("rem"), heat_sensor: e("hs"), service: e("sv"), service2: e("sv2"), door_left: e("dl"), door_right: e("dr"),
    soc: e("soc"), charge: e("ch"), export: e("ex"), circuit: e("ci"), energy: e("en"), status: e("st"), room_sensor: e("rs"),
    state_entity: "binary_sensor.s1", state_entity2: "binary_sensor.s2", color_entity: "light.col", extra: e("ex2"), temp_sensor: e("ts"),
    fan: "fan.f", clients: e("cl"), water_temp: e("wt"), look_of: "camera.door", type_entity: e("te"),
    gangs: [{ entity: "switch.g1", power: e("gp") }, { entity: "switch.g2" }],
    pictures: [{ entity: "media_player.tv", state: "on", image: "img1" }],
    show_when: { entity: "binary_sensor.when" },
    car: { device: "device_tracker.car", soc: e("csoc"), range: e("range"), charging: "binary_sensor.chg", plugged: "binary_sensor.plug", lock: "lock.car", climate: "climate.car", tracker: "device_tracker.car2" },
    mods: { m1: { entity: "sensor.found" } },
  };
  f.furniture = [{ id: "m", type: "lamp_ceiling", x: 2, z: 1.5, rotation: 0, w: 0.4, d: 0.4, h: 0.08, variant: null, ...common }] as never;
  f.openings = [
    {
      id: "o", room_id: "r", cover: "cover.c", contact: "binary_sensor.c", tilt: e("t"), contact2: "binary_sensor.c2", tilt2: e("t2"), position: e("pos"),
      lock: "lock.door", tilt_angle: e("ta"), window: "binary_sensor.win", sensor: "contact",
    },
  ] as never;
  f.placements = [{ entity_id: "camera.door", x: 1, z: 1, y: null, circuit: e("pc"), energy: e("pe"), detect_sensors: ["binary_sensor.d1"] }] as never;
  f.outdoor = [
    {
      id: "pool", type: "pool", name: "Pool", area_id: "garden", points: [], panel: [e("op")], hidden: [e("oh")], no_state: [e("on")],
      mods: { m1: { entity: "sensor.found" } },
      pool: { temperature: e("pt"), heater: "climate.pool", pump: "switch.pump", light: "light.pool", ph: e("ph"), chlorine: e("cl"), salt: e("salt"), cover: "cover.pool", ports: [{ id: "p", kind: "skimmer", x: 0, z: 0 }] },
    },
  ] as never;
  b.floors = [f];
  Object.assign(b.settings, {
    director: { doorbell: true, doorbell_entity: "binary_sensor.bell", doorbell_camera: "camera.door", triggers: [{ entity: "binary_sensor.gar", camera: "camera.gar" }] },
    weather_entity: "weather.home", rain_entity: e("rain"), outage_entity: "binary_sensor.outage", style_entity: "input_select.house_style",
    alert_snoozed: [{ kind: "window", entity: "binary_sensor.w", at: 1 }], alert_ignored: [{ kind: "window", entity: "binary_sensor.w2" }],
    buttons: [{ id: "b", label: "Go", action: "service", target: "script.go", data: { entity_id: "script.go" } }, { id: "n", label: "Nav", action: "navigate", target: "/lovelace/x" }],
    favorites: ["scene.evening", "script.go"], unplaced_hidden: [e("u1")], household: { notes: "sensor.notes" },
  });
  Object.assign(b.energy, {
    meter: { floor_id: "ground", x: 1, z: 1 }, grid: e("g"), solar: e("s"), battery: e("b"), battery_soc: e("bs"), consumption: e("co"), tariff: e("ta"),
    gas: e("gas"), water: e("water"), cheap_rate: "binary_sensor.cheap",
    rate_entity: "select.tariff", cost_sensors: [e("cost"), "octopus:cost"], earning_sensors: [e("earn")],
  });
  b.presence = [{ person: "person.mia", sensor: e("mia") }];
  return b;
}

function strings(node: unknown, out: string[] = []): string[] {
  if (typeof node === "string") out.push(node);
  else if (Array.isArray(node)) for (const v of node) strings(v, out);
  else if (node && typeof node === "object") for (const v of Object.values(node)) strings(v, out);
  return out;
}

test("import reads every plan version this frontend knows and refuses a newer one (#165)", () => {
  const b = building();
  assert.equal(b.version, PLAN_VERSION, "a new plan is of the current version");
  // an old export (version 1) is read, its version kept: the backend migrates it on save
  const old = parseExport(JSON.stringify({ ...b, version: 1 }));
  assert.equal(old.version, 1);
  assert.equal(parseExport(JSON.stringify(exportFile(b, false))).version, PLAN_VERSION);
  assert.throws(() => parseExport(JSON.stringify({ ...b, version: PLAN_VERSION + 1 })), /plan_too_new/);
  assert.throws(() => parseExport(JSON.stringify(exportFile({ ...b, version: PLAN_VERSION + 1 }, false))), /plan_too_new/);
  for (const version of [0, "2", null, 1.5]) assert.throws(() => parseExport(JSON.stringify({ ...b, version })), /not_plan/);
});

test("a shareable export keeps no entity id, area or floor link anywhere", () => {
  const full = linked();
  assert.ok(strings(full).filter(isEntityLink).length > 50, "the fixture is full of links");
  const shared = exportFile(full, true).building;
  assert.deepEqual(strings(shared).filter(isEntityLink), []);
  const f = shared.floors[0];
  assert.equal(f.ha_floor, null);
  assert.equal(f.rooms[0].area_id, null);
  assert.equal(f.outdoor?.[0].area_id, null);
  assert.equal(shared.settings.buttons, undefined);
  assert.equal(shared.settings.director?.triggers?.length, 0);
  assert.deepEqual(shared.settings.alert_snoozed, []);
  assert.deepEqual(shared.settings.favorites, []);
  // what is not a link stays: the shape, the item, its gangs and the plain settings
  assert.equal(f.rooms[0].points.length, 4);
  assert.equal(f.furniture[0].type, "lamp_ceiling");
  assert.equal(f.furniture[0].gangs?.length, 2);
  assert.equal(shared.settings.director?.doorbell, true);
  assert.equal(shared.energy.meter?.floor_id, "ground");
  // existing rate sensors (#323): statistics of this Home Assistant go too
  assert.deepEqual([shared.energy.cost_sensors, shared.energy.earning_sensors], [[], []]);
  // the full backup keeps everything
  assert.equal(JSON.stringify(exportFile(full, false).building), JSON.stringify(full));
});

test("every link field of the model is covered by the shareable-export test", () => {
  const src = readFileSync(new URL("./model.ts", import.meta.url), "utf8");
  const names = new Set<string>();
  for (const m of src.matchAll(/([a-z_0-9]+)\??:\s*EntityRef/g)) names.add(m[1]);
  for (const m of src.matchAll(/^\s+([a-z_0-9]*(?:entity|entities|sensor|sensors|area_id|ha_floor)[a-z_0-9]*)\??:\s*([^;\n]*);/gm)) {
    if (!m[2].includes('"')) names.add(m[1]);
  }
  const fixture = JSON.stringify(linked());
  const missing = [...names].filter((n) => !fixture.includes(`"${n}":`));
  assert.deepEqual(missing, [], "a new link field: add it to linked() so the shareable export is proven to strip it");
});
