import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyBuilding, newFloor, type Room } from "../model.ts";
import { showTarget, SYNONYMS, type Shown } from "./targets.ts";

const room = (id: string, name: string): Room => ({ id, name, area_id: null, points: [], floor_material: "wood" });
const building = {
  ...emptyBuilding(),
  floors: [{ ...newFloor("ground", "Ground floor", 0), rooms: [room("lr", "Living room"), room("hl", "Hall"), room("ga", "Garden"), room("ut", "Utility")] }],
};
const dev = (entity: string, name: string, room: string, camera = false): Shown => ({ id: entity, entity, name, room, camera });
const devices: Shown[] = [
  dev("camera.front_door", "Front door camera", "Hall", true),
  dev("camera.garden", "Garden Cam", "Garden", true),
  dev("switch.washing_machine", "Washing machine", "", false),
  dev("light.floor_lamp", "Floor lamp", "Living room"),
  dev("light.hall", "Hall light", "Hall"),
  dev("light.lr", "Living room ceiling", "Living room"),
];

const t = (s: string, d: readonly Shown[] = devices) => showTarget(s, building, d);
const id = (r: ReturnType<typeof t>) => (r as { id: string } | null)?.id;

test("devices by name, with a word that asks to see them", () => {
  assert.deepEqual(t("Show the washing machine"), { kind: "device", id: "switch.washing_machine", entity: "switch.washing_machine", name: "Washing machine", camera: false });
  assert.equal(id(t("Where is the floor lamp")), "light.floor_lamp");
  // naming a device without asking to see it is for Assist
  assert.equal(t("Hall light on"), null);
});

test("cameras: by name, by 'camera' and their room, or all of them", () => {
  assert.equal(id(t("Show the front door camera")), "camera.front_door");
  // a name written as one word: "gardencam" is "garden" and "cam"
  assert.equal(id(t("show me the gardencam")), "camera.garden");
  assert.equal(id(t("show the camera in the garden")), "camera.garden");
  assert.equal(t("Show me the cameras")?.kind, "cameras");
});

test("own aliases: a device by its further names, a room by its own", () => {
  const items: Shown[] = [{ id: "media_player.tv", entity: "media_player.tv", name: "Smart TV Pro", names: ["Smart TV Pro", "Lounge telly", "Goggle box"], room: "Living room", camera: false }];
  assert.equal(id(t("Show the lounge telly", items)), "media_player.tv");
  assert.equal(id(t("where is the goggle box", items)), "media_player.tv");
  const b = { ...building, floors: [{ ...building.floors[0], rooms: [{ ...room("lr", "Living room"), aliases: ["Lounge"] }] }] };
  assert.equal(showTarget("Show the lounge", b, [])?.kind, "room");
});

test("rooms stay rooms when a device only shares their name", () => {
  assert.deepEqual(t("Show the living room"), { kind: "room", floorId: "ground", roomId: "lr", name: "Living room" });
  assert.equal(id(t("Show the living room ceiling")), "light.lr");
  assert.equal(t("Garden")?.kind, "room");
});

test("furniture answers to its kind, its own name, everyday words and its sensor's name without the measuring word", () => {
  const items: Shown[] = [
    { id: "sensor.washing_machine_power", entity: "sensor.washing_machine_power", name: "Washing machine", names: ["Washing machine", "Washing machine power", ...SYNONYMS.washer], room: "Utility", camera: false },
    { id: "furniture:t1", entity: null, name: "Dryer", names: ["Dryer", ...SYNONYMS.dryer], room: "Utility", camera: false },
    { id: "media_player.tv", entity: "media_player.tv", name: "Television", names: ["Samsung TV", "Television", ...SYNONYMS.tv_board], room: "Living room", camera: false },
    { id: "furniture:p1", entity: null, name: "Pool pump", names: ["Pool pump", ...SYNONYMS.pool_pump], room: "Garden", camera: false },
    { id: "furniture:h1", entity: null, name: "Radiator", names: ["Radiator", ...SYNONYMS.radiator], room: "Hall", camera: false },
    { id: "furniture:h2", entity: null, name: "Radiator", names: ["Radiator", ...SYNONYMS.radiator], room: "Living room", camera: false },
  ];
  // the sensor is "Washing machine power", asked for as the machine
  assert.equal(id(t("Show the washing machine", items)), "sensor.washing_machine_power");
  assert.equal(id(t("Is the laundry done? show me", items)), "sensor.washing_machine_power");
  // without any entity, by its kind
  assert.equal(id(t("Where is the dryer", items)), "furniture:t1");
  // everyday words
  assert.equal(id(t("Show the TV", items)), "media_player.tv");
  assert.equal(id(t("show me the telly", items)), "media_player.tv");
  assert.equal(id(t("where is the pool pump", items)), "furniture:p1");
  assert.equal(id(t("show the pump", items)), "furniture:p1");
  // two of a kind: the one in the room named, else the first
  assert.equal(id(t("Show the radiator in the living room", items)), "furniture:h2");
  assert.equal(id(t("Show the radiator", items)), "furniture:h1");
  // the room still wins over a device that only shares its name
  assert.equal(t("Show the living room", items)?.kind, "room");
});

test("a room's own name wins over an outdoor area answering to the same name (#668)", () => {
  // the driveway on the ground floor is linked to the Home Assistant area "Garage"; the room "Garage" is in the cellar
  const square: [number, number][] = [
    [0, 0],
    [4, 0],
    [4, 4],
    [0, 4],
  ];
  const drive = { id: "drive", type: "driveway" as const, points: square, area_id: "garage", name: "" };
  const ground = { ...newFloor("ground", "Ground floor", 0), rooms: [room("lr", "Living room")], outdoor: [drive] };
  const cellar = { ...newFloor("cellar", "Cellar", -2.5), rooms: [room("st", "Storeroom"), { ...room("ga", "Garage"), area_id: "garage" }] };
  const b = { ...emptyBuilding(), floors: [ground, cellar] };
  const areas: Record<string, string> = { garage: "Garage" };
  const alias = (r: Room) => (r.area_id ? areas[r.area_id] : null);
  assert.deepEqual(showTarget("Show me Garage", b, [], alias), { kind: "room", floorId: "cellar", roomId: "ga", name: "Garage" });
  assert.deepEqual(showTarget("Show me Storeroom", b, [], alias), { kind: "room", floorId: "cellar", roomId: "st", name: "Storeroom" });
  // a device in the driveway called "Garage" (the door's drive) does not take the room's place either
  const opener: Shown[] = [{ id: "cover.garage", entity: "cover.garage", name: "Garage", room: "", camera: false }];
  assert.equal(showTarget("Show me Garage", b, opener, alias)?.kind, "room");
  // the room's own name only, without Home Assistant's area name: the same
  const b2 = { ...b, floors: [ground, { ...cellar, rooms: [room("st", "Storeroom"), room("ga", "Garage")] }] };
  assert.equal((showTarget("Show me Garage", b2, [], alias) as { roomId: string }).roomId, "ga");
  // an outdoor area's own name still beats a further name (alias) of a room
  const b3 = { ...b, floors: [{ ...ground, outdoor: [{ ...drive, name: "Driveway" }] }, { ...cellar, rooms: [{ ...room("ga", "Garage"), aliases: ["Driveway"] }] }] };
  assert.equal((showTarget("Show the driveway", b3, [], alias) as { roomId: string }).roomId, "drive");
});

test("switch and open do not hijack Assist commands (#161)", () => {
  for (const s of ["switch off the floor lamp", "switch the hall light off", "open the washing machine", "switch off all cameras", "open the front door camera shutter", "switch off the lights in the living room"]) {
    assert.equal(t(s), null, s);
  }
  // a camera or a place named alone is shown, a lamp or cover is Assist's to operate
  assert.equal(t("switch to the floor lamp"), null);
  assert.equal(id(t("open front door camera")), "camera.front_door");
  assert.equal(t("open all cameras")?.kind, "cameras");
  assert.equal(id(t("Show the floor lamp")), "light.floor_lamp");
});
