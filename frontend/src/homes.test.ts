// Several homes per install (#53): a view loads one home and saves back to it, whichever home is active by then.

import assert from "node:assert/strict";
import { test } from "node:test";
import { BuildingController } from "./building-controller.ts";
import type { Building } from "./model.ts";
import { setPlanRecipes } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";

const empty = (room: string) => ({
  version: 1,
  settings: {},
  floors: [{ id: "f", name: room, elevation: 0, height: 2.5, rooms: [], walls: [], openings: [], placements: [], furniture: [], outdoor: [] }],
});

/** A backend with two homes; `active` can change while the controller is open, `push` sends a subscription event. */
function backend() {
  const homes: Record<string, { building: unknown; revision: number }> = {
    home: { building: empty("Own"), revision: 7 },
    flat: { building: empty("Flat"), revision: 2 },
  };
  const state = { active: "home", sent: [] as Record<string, unknown>[], push: (_e: unknown) => {} };
  const hass = {
    user: { is_admin: true },
    callWS: async (msg: Record<string, unknown> & { type: string }) => {
      state.sent.push(structuredClone(msg));
      const id = (msg.home_id as string | undefined) ?? state.active;
      if (msg.type === "home_3d/building/get") return { ...structuredClone(homes[id]), home_id: id, can_edit: true };
      if (msg.type === "home_3d/building/save") {
        homes[id] = { building: msg.building, revision: homes[id].revision + 1 };
        return { revision: homes[id].revision, home_id: id, recipes: {} };
      }
      throw new Error(`unexpected ${msg.type}`);
    },
    connection: {
      subscribeMessage: async (cb: (e: unknown) => void, msg: Record<string, unknown>) => {
        state.sent.push(structuredClone(msg));
        state.push = cb;
        return async () => undefined;
      },
    },
  } as unknown as HomeAssistant;
  return { hass, state, homes };
}

async function open(hass: HomeAssistant, home?: string): Promise<BuildingController> {
  const host = { addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) };
  const c = new BuildingController(host);
  c.home = home;
  c.setHass(hass);
  c.hostConnected();
  await new Promise((r) => setTimeout(r, 0));
  return c;
}

const tick = () => new Promise((r) => setTimeout(r, 0));

test("a card's named home is loaded, followed and saved, whichever home is active", async () => {
  const { hass, state, homes } = backend();
  const c = await open(hass, "flat");
  assert.equal(c.homeId, "flat");
  assert.equal(c.building?.floors[0].name, "Flat");
  assert.deepEqual(
    state.sent.filter((m) => m.type !== "home_3d/building/save").map((m) => [m.type, m.home_id]),
    [
      ["home_3d/building/get", "flat"],
      ["home_3d/building/subscribe", "flat"],
    ],
  );
  c.edit(empty("Flat changed") as unknown as Building);
  await c.flush();
  assert.equal(homes.flat.revision, 3);
  assert.equal(homes.home.revision, 7);
  c.hostDisconnected();
  setPlanRecipes(undefined);
});

test("the panel saves to the home it loaded even after another home became active", async () => {
  const { hass, state, homes } = backend();
  const c = await open(hass);
  assert.equal(c.homeId, "home");
  state.active = "flat";
  c.edit(empty("Own changed") as unknown as Building);
  await c.flush();
  assert.equal(homes.home.revision, 8);
  assert.equal(homes.flat.revision, 2);
  c.hostDisconnected();
  setPlanRecipes(undefined);
});

test("a view following the active home loads the new one when it is switched", async () => {
  const { hass, state } = backend();
  const c = await open(hass);
  state.active = "flat";
  // the same revision number in another home is still news
  state.push({ revision: 7, home_id: "flat" });
  await tick();
  assert.equal(c.homeId, "flat");
  assert.equal(c.building?.floors[0].name, "Flat");
  c.hostDisconnected();
  setPlanRecipes(undefined);
});

test("reopening the shown home loads it afresh from the backend (#57)", async () => {
  const { hass, state, homes } = backend();
  const c = await open(hass, "flat");
  homes.flat = { building: empty("Flat elsewhere"), revision: 2 };
  const gets = () => state.sent.filter((m) => m.type === "home_3d/building/get").length;
  const before = gets();
  await c.reopen();
  assert.equal(gets(), before + 1);
  assert.equal(c.homeId, "flat");
  assert.equal(c.building?.floors[0].name, "Flat elsewhere");
  c.hostDisconnected();
  setPlanRecipes(undefined);
});

test("a view opens another home for itself only and then follows the active home again (#58)", async () => {
  const { hass, state, homes } = backend();
  const c = await open(hass);
  c.setHome("flat");
  await tick();
  await tick();
  assert.equal(c.homeId, "flat");
  assert.equal(state.active, "home");
  c.edit(empty("Flat changed") as unknown as Building);
  await c.flush();
  assert.equal(homes.flat.revision, 3);
  assert.equal(homes.home.revision, 7);
  c.setHome(undefined);
  await tick();
  await tick();
  assert.equal(c.homeId, "home");
  assert.equal(c.building?.floors[0].name, "Own");
  c.hostDisconnected();
  setPlanRecipes(undefined);
});
