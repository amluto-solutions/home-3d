// Camera models (#9): a placed camera can wear the real shape of the camera, chosen by hand or found from the
// model Home Assistant's device registry reports (UniFi Protect names it "G4 Pro" or "UVC G4 Pro").

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { detectCameraModel, isCameraModel, matchCameraModel, setCameraLook } from "./camera-models.ts";
import { newFloor, type Floor } from "./model.ts";
import { setPacks } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";
import type { FurniturePack, PackItem } from "./packs.ts";

const part = { shape: "box" as const, x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "white" };

function cam(id: string, tags: string[], mount: PackItem["mount"] = "wall"): PackItem {
  return { id, name: { en: id }, size: [0.1, 0.1, 0.1], electric: true, mount, tags: ["security camera", "camera", "unifi", ...tags], parts: [part] };
}

const PACK: FurniturePack = {
  id: "test.cams",
  name: "Cameras",
  publisher: "test",
  items: [
    cam("g4_pro", ["g4 pro"]),
    cam("g5_turret", ["g5 turret"], "ceiling"),
    cam("g4_dome", ["g4 dome"], "ceiling"),
    cam("ai_dslr", ["ai dslr"]),
    cam("ai_dslr_long", ["ai dslr long distance"]),
    // a speaker with a model-like tag is no camera
    { id: "speaker", name: { en: "Speaker" }, size: [0.1, 0.1, 0.1], tags: ["g4 instant"], parts: [part] },
  ],
};

test("a device model finds the camera model tagged with it, with or without UniFi's UVC prefix", () => {
  assert.equal(matchCameraModel("G4 Pro", [PACK]), "pack:test.cams:g4_pro");
  assert.equal(matchCameraModel("UVC G4 Dome", [PACK]), "pack:test.cams:g4_dome");
  assert.equal(matchCameraModel("  uvc   g4   pro ", [PACK]), "pack:test.cams:g4_pro");
});

test("a longer model name of the same camera finds it; an unknown one or a non-camera item finds nothing", () => {
  assert.equal(matchCameraModel("G5 Turret Ultra", [PACK]), "pack:test.cams:g5_turret");
  assert.equal(matchCameraModel("G4 Doorbell Pro", [PACK]), null);
  assert.equal(matchCameraModel("G4 Instant", [PACK]), null);
  assert.equal(matchCameraModel("", [PACK]), null);
  // words every camera item carries are no model
  assert.equal(matchCameraModel("UniFi Camera", [PACK]), null);
  assert.equal(matchCameraModel("Camera", [PACK]), null);
  assert.equal(matchCameraModel(null, [PACK]), null);
});

test("a placed camera's model is found from its device in Home Assistant's device registry", () => {
  const hass = {
    states: {},
    entities: { "camera.drive": { entity_id: "camera.drive", device_id: "d1" }, "camera.usb": { entity_id: "camera.usb" } },
    devices: { d1: { id: "d1", manufacturer: "Ubiquiti", model: "UVC G4 Pro" } },
  } as unknown as HomeAssistant;
  assert.equal(detectCameraModel(hass, "camera.drive", [PACK]), "pack:test.cams:g4_pro");
  // no device (a camera set up in YAML) or no registry: nothing found
  assert.equal(detectCameraModel(hass, "camera.usb", [PACK]), null);
  assert.equal(detectCameraModel({ states: {} } as unknown as HomeAssistant, "camera.drive", [PACK]), null);
});

function floorWithCamera(): Floor {
  const floor = newFloor("f", "Ground", 0);
  floor.placements.push({ entity_id: "camera.drive", x: 2, z: 3, y: null, rotation: 45, fov: 80 });
  return floor;
}

test("choosing a model gives the camera one look in that shape where it stands, mounted as that model is", () => {
  setPacks([{ ...PACK, items: [...PACK.items, { ...cam("g3_flex", ["g3 flex"]), size: [0.06, 0.09, 0.08], wall_y: 2.1 }] }]);
  const floor = floorWithCamera();
  setCameraLook(floor, "camera.drive", "pack:test.cams:g3_flex");
  assert.equal(floor.furniture.length, 1);
  const look = floor.furniture[0];
  assert.deepEqual([look.type, look.look_of, look.entity, look.x, look.z, look.rotation], ["pack:test.cams:g3_flex", "camera.drive", "none", 2, 3, 45]);
  assert.deepEqual([look.w, look.d, look.h], [0.06, 0.09, 0.08]);
  // on a wall: the pin (its wedge, its marker) sits in the middle of the model
  const pin = floor.placements[0];
  assert.equal(pin.mount, "wall");
  assert.ok(Math.abs((pin.y ?? 0) - 2.14) < 1e-9);
  assert.equal(pin.fov, 80, "everything set on the pin stays");

  // another model replaces it; a dome or turret hangs from the ceiling, and the pin goes up with it
  setCameraLook(floor, "camera.drive", "pack:test.cams:g4_dome");
  assert.deepEqual(floor.furniture.map((m) => m.type), ["pack:test.cams:g4_dome"]);
  assert.equal(pin.mount, "ceiling");
  assert.equal(pin.y, null);
});

test("going back to the built-in model drops the look and leaves the pin as it is", () => {
  setPacks([PACK]);
  const floor = floorWithCamera();
  floor.furniture.push({ id: "other", type: "sofa", x: 0, z: 0, rotation: 0, w: 2, d: 1, h: 0.8, variant: null });
  setCameraLook(floor, "camera.drive", "pack:test.cams:g4_dome");
  setCameraLook(floor, "camera.drive", null);
  assert.deepEqual(floor.furniture.map((m) => m.id), ["other"]);
  assert.equal(floor.placements[0].mount, "ceiling");
});

/** The UniFi pack's camera models, as the backend sends them (one file per item in its group's folder). */
function unifiCameras(): FurniturePack {
  const dir = fileURLToPath(new URL("../../custom_components/home_3d/bundled_packs/amluto.unifi", import.meta.url));
  const items = readdirSync(dir, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .flatMap((e) => readdirSync(join(dir, e.name)).map((f) => JSON.parse(readFileSync(join(dir, e.name, f), "utf8")) as PackItem));
  return { id: "amluto.unifi", name: "UniFi", publisher: "Amluto Solutions", items: items.filter(isCameraModel) };
}

test("the UniFi pack has every UniFi camera of the ticket, found by its name; domes and turrets hang from the ceiling", () => {
  const core = unifiCameras();
  const ceiling = ["G4 Dome", "G5 Turret", "AI 360"];
  for (const model of ["G3 Flex", "G4 Instant", "G4 Pro", "G4 Dome", "AI 360", "G5 Turret", "G5 PTZ", "G6 Entry"]) {
    const type = matchCameraModel(`UVC ${model}`, [core]);
    // each model finds its own item (#145 added many more cameras beside these)
    assert.equal(type, `pack:amluto.unifi:unifi_${model.toLowerCase().replace(/ /g, "_")}`, `${model} is in the UniFi pack`);
    const item = core.items.find((it) => type!.endsWith(`:${it.id}`))!;
    assert.equal(item.mount, ceiling.includes(model) ? "ceiling" : "wall", `${model} mount`);
    assert.ok(item.electric, `${model} is electric`);
  }
});

test("any other item as a camera's look (#779) leaves the pin's mount and height alone", () => {
  setPacks([PACK]);
  const floor = floorWithCamera();
  floor.placements[0].y = 1.8;
  setCameraLook(floor, "camera.drive", "pack:test.cams:speaker");
  assert.equal(floor.furniture[0].look_of, "camera.drive");
  assert.equal(floor.placements[0].mount, undefined);
  assert.equal(floor.placements[0].y, 1.8);
});

test("the wedge stays as it was when a model moves the camera to the ceiling or the wall", () => {
  setPacks([PACK]);
  const floor = floorWithCamera();
  const pin = floor.placements[0];
  // a wall camera with the wall defaults (90°, 4.5 m, 20° down) and its own field of view
  setCameraLook(floor, "camera.drive", "pack:test.cams:g4_dome");
  assert.deepEqual([pin.fov, pin.reach, pin.tilt], [80, 4.5, 20]);
  // back on a wall: what is now set stays
  setCameraLook(floor, "camera.drive", "pack:test.cams:g4_pro");
  assert.deepEqual([pin.fov, pin.reach, pin.tilt], [80, 4.5, 20]);
  // a ceiling camera keeps the dome defaults (all round, 3 m, 65° down) when it goes on a wall
  const dome = floorWithCamera();
  Object.assign(dome.placements[0], { mount: "ceiling", fov: null });
  setCameraLook(dome, "camera.drive", "pack:test.cams:g4_pro");
  assert.deepEqual([dome.placements[0].fov, dome.placements[0].reach, dome.placements[0].tilt], [360, 3, 65]);
  // the same mount changes nothing
  const same = floorWithCamera();
  setCameraLook(same, "camera.drive", "pack:test.cams:g4_pro");
  assert.deepEqual([same.placements[0].reach, same.placements[0].tilt], [undefined, undefined]);
});

test("UniFi's AI cameras match without a number in their model name (#145)", () => {
  assert.equal(matchCameraModel("AI DSLR", [PACK]), "pack:test.cams:ai_dslr");
  assert.equal(matchCameraModel("AI DSLR Long Distance", [PACK]), "pack:test.cams:ai_dslr_long");
  // a bare "ai" is no model name
  assert.equal(matchCameraModel("AI", [PACK]), null);
});

test("the devices pack ships G4 Doorbell and G4 Bullet, found by their device models (#273)", () => {
  const dir = fileURLToPath(new URL("../../custom_components/home_3d/bundled_packs/amluto.devices/tech/", import.meta.url));
  const items = ["unifi_g4_doorbell", "unifi_g4_bullet"].map((id) => JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8")));
  const pack: FurniturePack = { id: "d", name: "d", publisher: "t", items };
  assert.equal(matchCameraModel("G4 Doorbell", [pack]), "pack:d:unifi_g4_doorbell");
  assert.equal(matchCameraModel("UVC G4 Bullet", [pack]), "pack:d:unifi_g4_bullet");
  assert.deepEqual(items[0].size, [0.0468, 0.0258, 0.1183]);
});

test("the UniFi pack ships G5 Instant and G5 Doorbell Pro with approximate sizes taken from the G6 Instant and G4 Doorbell Pro (#303)", () => {
  const dir = fileURLToPath(new URL("../../custom_components/home_3d/bundled_packs/amluto.unifi/tech/", import.meta.url));
  const read = (id: string) => JSON.parse(readFileSync(join(dir, `${id}.json`), "utf8"));
  const items = ["unifi_g5_instant", "unifi_g5_doorbell_pro", "unifi_g6_instant", "unifi_g4_doorbell_pro"].map(read);
  const pack: FurniturePack = { id: "u", name: "u", publisher: "t", items };
  assert.equal(matchCameraModel("G5 Instant", [pack]), "pack:u:unifi_g5_instant");
  assert.equal(matchCameraModel("UVC G5 Doorbell Pro", [pack]), "pack:u:unifi_g5_doorbell_pro");
  assert.equal(matchCameraModel("G5 Doorbell Pro PoE", [pack]), "pack:u:unifi_g5_doorbell_pro");
  assert.equal(matchCameraModel("G6 Instant", [pack]), "pack:u:unifi_g6_instant");
  assert.deepEqual(items[0].size, items[2].size);
  assert.deepEqual(items[1].size, [0.0517, 0.0287, 0.1606]);
  for (const it of items.slice(0, 2)) assert.match(it.name.en, /approximate size/);
});
