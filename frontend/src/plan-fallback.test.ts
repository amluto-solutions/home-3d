import assert from "node:assert/strict";
import { test } from "node:test";
import type { Building } from "./model.ts";
import { FallbackPlanSaver } from "./plan-fallback.ts";
import type { HomeAssistant } from "./types.ts";

// The 3D view saves a plan change itself when no host takes it (#363): from the revision it started from, and after
// a refused save on the newer plan, as the panel and card do.

const plan = (room: string, grid = 0.05) => ({
  version: 1,
  settings: { grid },
  floors: [{ id: "f", name: "F", elevation: 0, height: 2.5, rooms: [{ id: "r", name: room, area_id: null, points: [[0, 0], [4, 0], [4, 3], [0, 3]] }], walls: [], openings: [], placements: [], furniture: [], outdoor: [] }],
});

function backend(start: unknown) {
  const state = { building: structuredClone(start) as Building, revision: 3, saves: [] as Record<string, unknown>[] };
  const hass = {
    user: { is_admin: true },
    callWS: async (msg: Record<string, unknown> & { type: string }) => {
      if (msg.type === "home_3d/building/get") return { building: structuredClone(state.building), revision: state.revision, can_edit: true, home_id: "home" };
      if (msg.type === "home_3d/history/snapshot") return null;
      if (msg.type === "home_3d/building/save") {
        state.saves.push(structuredClone(msg));
        if (msg.base_revision !== undefined && msg.base_revision !== state.revision) throw { code: "conflict", message: "stale" };
        state.building = structuredClone(msg.building) as Building;
        state.revision++;
        return { revision: state.revision, recipes: {} };
      }
      throw new Error(`unexpected ${msg.type}`);
    },
    connection: { subscribeMessage: async () => async () => undefined },
  } as unknown as HomeAssistant;
  return { state, hass };
}

test("the fallback save sends the base revision and takes the new one", async () => {
  const { state, hass } = backend(plan("Living"));
  let shown: Building | null = null;
  const saver = new FallbackPlanSaver((b) => (shown = b), () => assert.fail("no failure expected"));
  await saver.change(hass, undefined, (b) => void (b.settings.grid = 0.1));
  assert.equal(state.saves[0].base_revision, 3);
  assert.equal(shown!.settings.grid, 0.1);
  await saver.change(hass, undefined, (b) => void (b.settings.grid = 0.2));
  assert.equal(state.saves[1].base_revision, 4, "the next save starts from the revision the first made");
  assert.equal(state.building.settings.grid, 0.2);
});

test("a conflict is made again on the newer plan", async () => {
  const { state, hass } = backend(plan("Living"));
  const saver = new FallbackPlanSaver(() => {}, () => assert.fail("no failure expected"));
  await saver.change(hass, undefined, (b) => void (b.settings.grid = 0.1));
  // someone else saves meanwhile
  state.building = structuredClone(plan("Phone", 0.1)) as unknown as Building;
  state.revision++;
  await saver.change(hass, undefined, (b) => void (b.settings.grid = 0.5));
  assert.equal(state.building.floors[0].rooms[0].name, "Phone", "their work is kept");
  assert.equal(state.building.settings.grid, 0.5, "the change is applied on their plan");
  assert.equal(state.saves.at(-1)!.base_revision, state.revision - 1);
});
