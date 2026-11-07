// A UniFi Protect camera of a known model is drawn with the matching pack model (#273); others keep the built-in one.
import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMarkers } from "./markers.ts";
import { emptyBuilding, newFloor } from "./model.ts";
import { setPacks } from "./packs.ts";

test("only a Protect camera with a known model gets a camPack", () => {
  setPacks([{ id: "p", name: "p", publisher: "t", items: [{ id: "g4", name: { en: "g4" }, size: [0.1, 0.1, 0.1], mount: "wall", tags: ["security camera", "g4 bullet"], parts: [] }] }]);
  const b = emptyBuilding();
  b.floors.push(newFloor("f", "F", 0));
  b.floors[0].placements.push({ entity_id: "camera.a", x: 1, z: 1, y: null, mount: null }, { entity_id: "camera.b", x: 2, z: 2, y: null, mount: null });
  const st = (id: string) => ({ entity_id: id, state: "idle", attributes: {} });
  const hass = {
    states: { "camera.a": st("camera.a"), "camera.b": st("camera.b") },
    entities: { "camera.a": { entity_id: "camera.a", platform: "unifiprotect", device_id: "d" }, "camera.b": { entity_id: "camera.b", platform: "generic", device_id: "d" } },
    devices: { d: { model: "G4 Bullet" } },
  } as never;
  const m = buildMarkers(hass, b);
  assert.equal(m.find((x) => x.id === "camera.a")?.camPack, "pack:p:g4");
  assert.equal(m.find((x) => x.id === "camera.b")?.camPack, undefined);
});
