import assert from "node:assert/strict";
import { test } from "node:test";
import { clearModules, loadedModules, MODULE_API, moduleFurnitureFields, moduleMenuSheets, moduleRoomFields, moduleRoomSheets, moduleSettings, modulesWithSettings, moduleVoice, registerModule, syncModules, type ModuleHost } from "./modules.ts";

const host = {
  api: MODULE_API,
  hass: () => ({}) as never,
  building: () => null,
  language: () => "en",
  devices: () => [],
  findDevice: () => null,
  openings: () => [],
  energy: () => null,
  consumers: () => [{ id: "switch.a", entity: "sensor.a_w", name: "Washing machine", watts: 430 }],
} as ModuleHost;

test("voice modules are asked in turn; the first answer wins, a failing one is skipped", async () => {
  clearModules();
  registerModule({ api: MODULE_API, id: "broken", voice: () => { throw new Error("boom"); } });
  registerModule({ api: MODULE_API, id: "quiet", voice: () => null });
  registerModule({ api: MODULE_API, id: "answers", voice: (s, h) => (s.includes("power") ? { text: `${h.consumers()[0].name}: ${h.consumers()[0].watts} W`, highlight: ["switch.a"] } : null) });
  assert.deepEqual(loadedModules().map((m) => m.id), ["broken", "quiet", "answers"]);
  const a = await moduleVoice("what is using power", host);
  assert.equal(a?.text, "Washing machine: 430 W");
  assert.deepEqual(a?.highlight, ["switch.a"]);
  assert.equal(await moduleVoice("what time is it", host), null);
  clearModules();
  assert.equal(loadedModules().length, 0);
});

test("a module's fields on a piece of furniture and its own settings; a failing module adds none", () => {
  clearModules();
  registerModule({ api: MODULE_API, id: "broken", furnitureFields: () => { throw new Error("boom"); }, settings: () => { throw new Error("boom"); } });
  registerModule({ api: MODULE_API, id: "setup", furnitureFields: (_h, f) => (f.type === "radiator" ? [{ kind: "heading", text: "Radiator" }] : []), settings: () => [{ kind: "text", text: "Demo" }] });
  const radiator = { id: "r1", type: "radiator", x: 0, z: 0, rotation: 0, w: 1, d: 0.1, h: 0.6, variant: null };
  assert.deepEqual(moduleFurnitureFields(host, radiator), [{ kind: "heading", text: "Radiator" }]);
  assert.deepEqual(moduleFurnitureFields(host, { ...radiator, type: "sofa" }), []);
  assert.deepEqual(moduleSettings("setup", host), [{ kind: "text", text: "Demo" }]);
  assert.deepEqual(moduleSettings("broken", host), []);
  assert.deepEqual(moduleSettings("missing", host), []);
  clearModules();
});

test("modules offer sheets in a room and in the ⭐ menu, fields in a room's form, settings for the ⚙ menu", () => {
  clearModules();
  registerModule({
    api: MODULE_API,
    id: "test.sheets",
    roomSheets: (_h, place) => [{ id: "a", icon: "📢", title: place.roomId }],
    menuSheets: () => [{ id: "a", icon: "📢", title: "menu" }],
    roomFields: (_h, room) => [{ kind: "text", text: room.name }],
    settings: () => [{ kind: "lines", label: "Sentences", value: ["x"], set: () => {} }],
  });
  registerModule({ api: MODULE_API, id: "test.broken", roomSheets: () => { throw new Error("no"); } });
  const host = {} as ModuleHost;
  assert.deepEqual(moduleRoomSheets(host, { floorId: "ground", roomId: "kids" }).map((s) => s.title), ["kids"]);
  assert.deepEqual(moduleMenuSheets(host).map((s) => s.title), ["menu"]);
  assert.deepEqual(moduleRoomFields(host, { id: "r", name: "Bathroom", points: [] } as never, {} as never), [{ kind: "text", text: "Bathroom" }]);
  assert.deepEqual(modulesWithSettings(), ["test.sheets"]);
  clearModules();
});

test("module code is never fetched from packs: syncing asks the backend for nothing", async () => {
  clearModules();
  const asked: unknown[] = [];
  const hass = { callWS: async (msg: unknown) => (asked.push(msg), null) } as never;
  await syncModules(hass, [{ id: "a" }, { id: "b" }]);
  assert.deepEqual(asked, []);
  assert.equal(loadedModules().length, 0);
});
