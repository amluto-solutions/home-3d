import assert from "node:assert/strict";
import { test } from "node:test";
import { BuildingController } from "./building-controller.ts";
import type { Building } from "./model.ts";
import type { HomeAssistant } from "./types.ts";

// Saves refuse stale writes (#149): the controller sends the revision its plan started from; a refused save never
// loses the edits made here and never overwrites the other editor's work unasked.

const plan = (room: string, grid = 0.05) => ({
  version: 1,
  settings: { grid },
  floors: [
    {
      id: "f",
      name: "F",
      elevation: 0,
      height: 2.5,
      rooms: [{ id: "r", name: room, area_id: null, points: [[0, 0], [4, 0], [4, 3], [0, 3]] }],
      walls: [],
      openings: [],
      placements: [],
      furniture: [],
      outdoor: [],
    },
  ],
});

const roomOf = (b: Building | null | undefined) => b?.floors[0].rooms[0].name;

/** A backend holding one plan: a save whose base revision is not the current one is refused with "conflict". */
function backend(start: unknown) {
  const state = { building: structuredClone(start) as Building, revision: 3, saves: [] as Record<string, unknown>[], asked: [] as string[] };
  let onEvent: ((msg: { revision: number; home_id?: string }) => void) | null = null;
  const hass = {
    user: { is_admin: true },
    callWS: async (msg: Record<string, unknown> & { type: string }) => {
      state.asked.push(msg.type);
      if (msg.type === "home_3d/building/get") return { building: structuredClone(state.building), revision: state.revision, can_edit: true, home_id: "home" };
      if (msg.type === "home_3d/history/snapshot") return null;
      if (msg.type === "home_3d/building/save") {
        state.saves.push(structuredClone(msg));
        if (msg.base_revision !== undefined && msg.base_revision !== state.revision) {
          throw { code: "conflict", message: `The plan changed since revision ${msg.base_revision as number}` };
        }
        state.building = structuredClone(msg.building) as Building;
        state.revision++;
        return { revision: state.revision, recipes: {} };
      }
      throw new Error(`unexpected ${msg.type}`);
    },
    connection: {
      subscribeMessage: async (cb: (msg: { revision: number; home_id?: string }) => void) => {
        onEvent = cb;
        return async () => undefined;
      },
    },
  } as unknown as HomeAssistant;
  /** Someone else saves (another device): the plan changes and the subscription hears of it. */
  const otherSaves = (building: unknown, announce = true) => {
    state.building = structuredClone(building) as Building;
    state.revision++;
    if (announce) onEvent?.({ revision: state.revision, home_id: "home" });
  };
  return { state, hass, otherSaves };
}

async function opened(start: unknown) {
  const b = backend(start);
  const host = { addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) };
  const c = new BuildingController(host);
  c.setHass(b.hass);
  c.hostConnected();
  await new Promise((r) => setTimeout(r, 0));
  return { c, ...b };
}

const edited = (c: BuildingController, room: string): Building => {
  const next = structuredClone(c.building!);
  next.floors[0].rooms[0].name = room;
  return next;
};

test("a save carries the revision its plan started from", async () => {
  const { c, state } = await opened(plan("Living"));
  c.edit(edited(c, "Lounge"));
  await c.flush();
  assert.equal(state.saves[0].base_revision, 3);
  c.edit(edited(c, "Den"));
  await c.flush();
  // the next one starts from the revision the first save made
  assert.equal(state.saves[1].base_revision, 4);
  assert.equal(roomOf(state.building), "Den");
  c.hostDisconnected();
});

test("a refused save shows the other editor's plan and keeps the edits made here as a draft", async () => {
  const { c, state, otherSaves } = await opened(plan("Living"));
  const mine = edited(c, "Mine");
  c.edit(mine);
  // the phone saves while this edit waits for its pause: the event is heard but the edit is on its way
  otherSaves(plan("Phone"));
  await c.flush();

  assert.equal(roomOf(state.building), "Phone", "the phone's work is not overwritten");
  assert.equal(roomOf(c.building), "Phone", "the plan shows their version");
  assert.equal(c.conflict, true);
  assert.equal(roomOf(c.draft?.building), "Mine", "the edit made here is kept");
  assert.equal(c.saveState, "error");

  // "use mine": their plan becomes a restore point first, then mine is saved from their revision
  await c.restoreDraft();
  await c.flush();
  assert.ok(state.asked.includes("home_3d/history/snapshot"));
  assert.equal(roomOf(state.building), "Mine");
  assert.equal(c.conflict, false);
  assert.equal(c.draft, null);
  c.hostDisconnected();
});

test("discarding the kept edits leaves the other editor's plan", async () => {
  const { c, state, otherSaves } = await opened(plan("Living"));
  c.edit(edited(c, "Mine"));
  otherSaves(plan("Phone"), false);
  await c.flush();
  assert.equal(c.conflict, true);
  c.discardDraft();
  assert.equal(c.conflict, false);
  assert.equal(c.draft, null);
  assert.equal(roomOf(state.building), "Phone");
  assert.equal(state.saves.filter((s) => s.base_revision === 4).length, 0, "nothing more was saved");
  c.hostDisconnected();
});

test("a change from the 3D view is made again on the newer plan, so both changes stay", async () => {
  const { c, state, otherSaves } = await opened(plan("Living"));
  // the other device's save is not heard yet (a tablet that just woke up)
  otherSaves(plan("Phone"), false);
  c.update((b) => (b.settings.grid = 0.1));
  await c.flush();
  assert.equal(roomOf(state.building), "Phone");
  assert.equal(state.building.settings.grid, 0.1);
  assert.equal(c.conflict, false);
  assert.equal(c.draft, null);
  assert.equal(state.saves.length, 2);
  assert.equal(state.saves[1].base_revision, 4);
  c.hostDisconnected();
});

test("an editor edit after a 3D view change makes a refused save a choice again", async () => {
  const { c, state, otherSaves } = await opened(plan("Living"));
  otherSaves(plan("Phone"), false);
  c.edit(edited(c, "Mine"));
  c.update((b) => (b.settings.grid = 0.1));
  await c.flush();
  assert.equal(roomOf(state.building), "Phone");
  assert.equal(c.conflict, true);
  assert.equal(roomOf(c.draft?.building), "Mine");
  assert.equal(c.draft?.building.settings.grid, 0.1);
  c.hostDisconnected();
});

test("edits made while the newer plan loads are kept with the refused ones", async () => {
  const b = backend(plan("Living"));
  const call = b.hass.callWS.bind(b.hass);
  let c: BuildingController;
  let late = false;
  (b.hass as { callWS: unknown }).callWS = async (msg: Record<string, unknown> & { type: string }) => {
    const res = await call(msg as never);
    // the user goes on editing while their plan is fetched after the refusal
    if (msg.type === "home_3d/building/get" && b.state.saves.length && !late) {
      late = true;
      c.edit(edited(c, "Mine, then more"));
    }
    return res;
  };
  const host = { addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) };
  c = new BuildingController(host);
  c.setHass(b.hass);
  c.hostConnected();
  await new Promise((r) => setTimeout(r, 0));
  c.edit(edited(c, "Mine"));
  b.otherSaves(plan("Phone"), false);
  await c.flush();
  await c.flush();
  assert.equal(roomOf(b.state.building), "Phone");
  assert.equal(roomOf(c.draft?.building), "Mine, then more");
  assert.equal(b.state.saves.length, 1, "the later edit made on the older plan was not saved over theirs");
  c.hostDisconnected();
});

test("a change heard while saving is shown once the save is done", async () => {
  const { c, state, otherSaves } = await opened(plan("Living"));
  const call = (c as unknown as { hass: HomeAssistant }).hass.callWS;
  let gets = 0;
  (c as unknown as { hass: { callWS: unknown } }).hass.callWS = async (msg: Record<string, unknown> & { type: string }) => {
    if (msg.type === "home_3d/building/get") gets++;
    const res = await call(msg as never);
    // a server-side change (a pack update) lands right after this save, while its answer is on the way
    if (msg.type === "home_3d/building/save") otherSaves(plan("Updated by the server"));
    return res;
  };
  c.edit(edited(c, "Mine"));
  await c.flush();
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(gets, 1, "the plan was fetched again");
  assert.equal(roomOf(c.building), "Updated by the server");
  assert.equal(state.revision, 5);
  c.hostDisconnected();
});

test("a refused save of the very plan the server has now is no conflict (an editor showing a restored backup)", async () => {
  const { c, state, otherSaves } = await opened(plan("Living"));
  otherSaves(plan("Restored"), false);
  c.edit(edited(c, "Restored"));
  await c.flush();
  assert.equal(c.conflict, false);
  assert.equal(c.draft, null);
  assert.equal(c.saveState, "saved");
  assert.equal(state.revision, 4);
  c.hostDisconnected();
});
