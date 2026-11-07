import assert from "node:assert/strict";
import { test } from "node:test";
import { BuildingController, compareVersions } from "./building-controller.ts";
import type { Building } from "./model.ts";
import { packItem, setPlanRecipes } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";

test("versions compare numerically, so 1.10.1 is newer than 1.9.2", () => {
  assert.ok(compareVersions("1.10.1", "1.9.2") > 0);
  assert.ok(compareVersions("1.9.2", "1.10.0") < 0);
  assert.equal(compareVersions("1.10.0", "1.10.0"), 0);
  assert.ok(compareVersions("2.0.0", "1.99.99") > 0);
});

/** A controller on a fake host, loaded from a backend that answers `home_3d/building/get` with `extra`. */
async function loaded(isAdmin: boolean, extra: Record<string, unknown>): Promise<BuildingController> {
  const host = { addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) };
  const c = new BuildingController(host);
  const hass = {
    user: { is_admin: isAdmin },
    callWS: async (msg: { type: string }) => {
      if (msg.type === "home_3d/building/get") return { building: { version: 1, settings: {}, floors: [] }, revision: 3, ...extra };
      if (msg.type === "home_3d/packs/list") return { packs: [] };
      throw new Error(`unexpected ${msg.type}`);
    },
    connection: { subscribeMessage: async () => async () => undefined },
  } as unknown as HomeAssistant;
  c.setHass(hass);
  c.hostConnected();
  await new Promise((r) => setTimeout(r, 0));
  c.hostDisconnected();
  return c;
}

test("the backend's editors list decides who edits, not the admin flag", async () => {
  assert.equal((await loaded(false, { can_edit: true })).canEdit, true);
  assert.equal((await loaded(true, { can_edit: false })).canEdit, false);
});

test("an older backend without the editors list lets admins edit, as before", async () => {
  assert.equal((await loaded(true, {})).canEdit, true);
  assert.equal((await loaded(false, {})).canEdit, false);
});

test("a stored plan the backend cannot read comes with its problem and read-only (#165)", async () => {
  const problem = { code: "plan_too_new", message: "the plan is of version 3" };
  const c = await loaded(true, { can_edit: false, problem });
  assert.deepEqual(c.planProblem, problem);
  assert.equal(c.canEdit, false);
  // an older backend says nothing about it; a version-1 plan from it keeps its version (the backend migrates it)
  const old = await loaded(true, {});
  assert.equal(old.planProblem, null);
  assert.equal(old.building?.version, 1);
});

test("nobody edits before the building is loaded", () => {
  const host = { addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) };
  assert.equal(new BuildingController(host).canEdit, false);
});

// Plans keep a copy of each placed item's recipe (#2)

const chairCopy = (size: [number, number, number]) => ({
  pack: "demo.pack",
  item: "chair",
  release: 1,
  hash: `sha256:${size.join("x")}`,
  recipe: { id: "chair", name: { en: "Chair" }, size, parts: [{ shape: "box", x: 0, z: 0, w: 1, d: 1, y: 0, h: 1, color: "wood" }] },
});
const CHAIR = "pack:demo.pack:chair";
const chairAt = (id: string) => ({ id, type: CHAIR, x: 0, z: 0, rotation: 0, w: 0.5, d: 0.5, h: 0.9, variant: null, entity: null, power: null });
const plan = (furniture: unknown[], recipes?: Record<string, unknown>) => ({
  version: 1,
  settings: {},
  floors: [{ id: "f", name: "F", elevation: 0, height: 2.5, rooms: [], walls: [], openings: [], placements: [], furniture, outdoor: [] }],
  ...(recipes ? { recipes } : {}),
});

/** A controller on a backend whose plan and packs the test sets; saves answer with `saved` recipes. */
async function withPlan(building: unknown, packs: unknown[], saved: Record<string, unknown> = {}) {
  const host = { addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) };
  const c = new BuildingController(host);
  const backend = { packs };
  const hass = {
    user: { is_admin: true },
    callWS: async (msg: { type: string }) => {
      if (msg.type === "home_3d/building/get") return { building: structuredClone(building), revision: 3, can_edit: true };
      if (msg.type === "home_3d/packs/list") return { packs: backend.packs };
      if (msg.type === "home_3d/building/save") return { revision: 4, recipes: saved };
      throw new Error(`unexpected ${msg.type}`);
    },
    connection: { subscribeMessage: async () => async () => undefined },
  } as unknown as HomeAssistant;
  c.setHass(hass);
  c.hostConnected();
  await new Promise((r) => setTimeout(r, 0));
  return { c, backend };
}

test("a loaded plan draws its items from its own recipe copies, also when their pack is gone", async () => {
  const { c } = await withPlan(plan([chairAt("a")], { [CHAIR]: chairCopy([0.5, 0.5, 0.9]) }), []);
  assert.deepEqual(packItem(CHAIR)?.size, [0.5, 0.5, 0.9]);
  c.hostDisconnected();
  setPlanRecipes(undefined);
});

test("an item placed in this session keeps the copy the backend stored, when its pack is removed afterwards", async () => {
  const pack = { id: "demo.pack", name: "Demo", publisher: "Demo", release: 1, items: [chairCopy([0.5, 0.5, 0.9]).recipe] };
  const { c, backend } = await withPlan(plan([]), [pack], { [CHAIR]: chairCopy([0.5, 0.5, 0.9]) });
  const placed = plan([chairAt("a")]) as unknown as Building;
  c.edit(placed);
  await c.flush();
  assert.deepEqual(Object.keys(c.building?.recipes ?? {}), [CHAIR]);
  backend.packs = [];
  await c.reloadPacks();
  assert.deepEqual(packItem(CHAIR)?.size, [0.5, 0.5, 0.9]);
  c.hostDisconnected();
  setPlanRecipes(undefined);
});

// The library is loaded only where it is used (#44): showing the plan needs none of it

test("showing the plan never loads the library; opening the editor loads it once", async () => {
  const asked: string[] = [];
  const host = { addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) };
  const c = new BuildingController(host);
  const hass = {
    user: { is_admin: true },
    callWS: async (msg: { type: string }) => {
      asked.push(msg.type);
      if (msg.type === "home_3d/building/get") return { building: plan([chairAt("a")], { [CHAIR]: chairCopy([0.5, 0.5, 0.9]) }), revision: 3, can_edit: true };
      if (msg.type === "home_3d/packs/list") return { packs: [] };
      throw new Error(`unexpected ${msg.type}`);
    },
    connection: { subscribeMessage: async () => async () => undefined },
  } as unknown as HomeAssistant;
  c.setHass(hass);
  c.hostConnected();
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(asked, ["home_3d/building/get"]);
  assert.equal(c.packsLoaded, false);
  // the plan draws from its own copies
  assert.deepEqual(packItem(CHAIR)?.size, [0.5, 0.5, 0.9]);

  await Promise.all([c.loadLibrary(), c.loadLibrary()]);
  await c.loadLibrary();
  assert.deepEqual(asked.filter((t) => t === "home_3d/packs/list").length, 1);
  assert.equal(c.packsLoaded, true);
  // after an import the list comes again
  await c.reloadPacks();
  assert.deepEqual(asked.filter((t) => t === "home_3d/packs/list").length, 2);
  c.hostDisconnected();
  setPlanRecipes(undefined);
});

// An update made on the server while an editor has the plan open is not undone by its next save (#45)

test("a save sends the recipe hashes it started from and takes the server's newer copy", async () => {
  const older = chairCopy([0.5, 0.5, 0.9]);
  const newer = { ...chairCopy([1.2, 0.9, 0.8]), release: 2 };
  const sent: Record<string, unknown>[] = [];
  const host = { addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) };
  const c = new BuildingController(host);
  const hass = {
    user: { is_admin: true },
    callWS: async (msg: Record<string, unknown> & { type: string }) => {
      if (msg.type === "home_3d/building/get") return { building: plan([chairAt("a")], { [CHAIR]: structuredClone(older) }), revision: 3, can_edit: true };
      // meanwhile the server updated the chair (packs/update_items): it keeps its copy and answers with it
      if (msg.type === "home_3d/building/save") {
        sent.push(structuredClone(msg));
        return { revision: 5, recipes: { [CHAIR]: newer } };
      }
      throw new Error(`unexpected ${msg.type}`);
    },
    connection: { subscribeMessage: async () => async () => undefined },
  } as unknown as HomeAssistant;
  c.setHass(hass);
  c.hostConnected();
  await new Promise((r) => setTimeout(r, 0));

  const moved = structuredClone(c.building!);
  moved.floors[0].furniture[0].x = 2;
  c.edit(moved);
  await c.flush();
  assert.deepEqual(sent[0].recipe_bases, { [CHAIR]: older.hash });
  assert.equal(c.building?.recipes?.[CHAIR]?.release, 2);
  assert.deepEqual(packItem(CHAIR)?.size, [1.2, 0.9, 0.8]);

  // the next save starts from the newer copy
  c.edit(structuredClone(c.building!));
  await c.flush();
  assert.deepEqual(sent[1].recipe_bases, { [CHAIR]: newer.hash });
  c.hostDisconnected();
  setPlanRecipes(undefined);
});
