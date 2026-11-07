// Unsaved edits, drafts and subscriptions belong to the home they were made on (#150): switching home never applies
// them to another home, and a load on its way never puts an older plan over an edit.

import assert from "node:assert/strict";
import { test } from "node:test";
import { BuildingController, type Draft } from "./building-controller.ts";
import type { Building } from "./model.ts";
import { setPlanRecipes } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";

const store = new Map<string, string>();
(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const plan = (name: string) =>
  ({
    version: 1,
    settings: {},
    floors: [{ id: "f", name, elevation: 0, height: 2.5, rooms: [], walls: [], openings: [], placements: [], furniture: [], outdoor: [] }],
  }) as unknown as Building;

const tick = () => new Promise((r) => setTimeout(r, 0));
const ticks = async (n = 6) => {
  for (let i = 0; i < n; i++) await tick();
};

/** A promise the test resolves itself. */
function gate() {
  let open!: () => void;
  const opened = new Promise<void>((r) => (open = r));
  return { opened, open };
}

/**
 * A backend with two homes ("home" active, "flat"). `hold.get` / `hold.subscribe` make the next such call wait until
 * the test opens the gate; `failSaves` refuses saves. `subs` counts the subscriptions still running per home. A save
 * from a revision the home is no longer at is refused with "conflict" (#149); `refused` lists those.
 */
function backend() {
  const homes: Record<string, { building: Building; revision: number }> = {
    home: { building: plan("Own"), revision: 7 },
    flat: { building: plan("Flat"), revision: 2 },
  };
  const state = {
    active: "home",
    failSaves: false,
    gets: 0,
    saves: [] as { home: string; name: string }[],
    refused: [] as { home: string; base: unknown }[],
    snapshots: [] as string[],
    hold: { get: null as ReturnType<typeof gate> | null, save: null as ReturnType<typeof gate> | null, subscribe: null as ReturnType<typeof gate> | null },
    subs: new Map<string, number>(),
    push: new Map<string, (e: unknown) => void>(),
  };
  const hass = {
    user: { is_admin: true },
    callWS: async (msg: Record<string, unknown> & { type: string }) => {
      const id = (msg.home_id as string | undefined) ?? state.active;
      if (msg.type === "home_3d/building/get") {
        state.gets++;
        const held = state.hold.get;
        state.hold.get = null;
        // the plan as it stands when the request arrives, answered when the gate opens
        const answer = { building: structuredClone(homes[id].building), revision: homes[id].revision, home_id: id, home_name: id, can_edit: true };
        if (held) await held.opened;
        return answer;
      }
      if (msg.type === "home_3d/building/save") {
        const held = state.hold.save;
        state.hold.save = null;
        if (held) await held.opened;
        if (state.failSaves) throw new Error("connection lost");
        if (msg.base_revision !== undefined && msg.base_revision !== homes[id].revision) {
          state.refused.push({ home: id, base: msg.base_revision });
          throw { code: "conflict", message: `The plan changed since revision ${msg.base_revision as number}` };
        }
        const b = msg.building as Building;
        state.saves.push({ home: id, name: b.floors[0].name });
        homes[id] = { building: structuredClone(b), revision: homes[id].revision + 1 };
        return { revision: homes[id].revision, recipes: {} };
      }
      if (msg.type === "home_3d/history/snapshot") {
        state.snapshots.push(id);
        return null;
      }
      throw new Error(`unexpected ${msg.type}`);
    },
    connection: {
      subscribeMessage: async (cb: (e: unknown) => void, msg: Record<string, unknown>) => {
        const held = state.hold.subscribe;
        state.hold.subscribe = null;
        if (held) await held.opened;
        const key = (msg.home_id as string | undefined) ?? "(active)";
        state.subs.set(key, (state.subs.get(key) ?? 0) + 1);
        state.push.set(key, cb);
        return async () => void state.subs.set(key, (state.subs.get(key) ?? 1) - 1);
      },
    },
  } as unknown as HomeAssistant;
  return { hass, state, homes };
}

function controller(hass: HomeAssistant, home?: string): BuildingController {
  const host = { addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) };
  const c = new BuildingController(host);
  c.home = home;
  c.setHass(hass);
  return c;
}

async function open(hass: HomeAssistant, home?: string): Promise<BuildingController> {
  const c = controller(hass, home);
  c.hostConnected();
  await ticks();
  return c;
}

function done(c: BuildingController): void {
  c.hostDisconnected();
  setPlanRecipes(undefined);
  store.clear();
}

const draftOf = (home: string | undefined, name: string): Draft => ({ building: plan(name), savedAt: 1, ...(home ? { home } : {}) });

test("a draft for one home is not offered on another, and Restore never saves it there (#150)", async () => {
  const { hass, state, homes } = backend();
  store.set("home3d.unsaved", JSON.stringify(draftOf("home", "Own unsaved")));
  const c = await open(hass);
  assert.equal(c.draft?.home, "home");
  // the banner is up; the user switches to the flat without answering it
  c.setHome("flat");
  await ticks();
  assert.equal(c.homeId, "flat");
  assert.equal(c.draft, null);
  await c.restoreDraft();
  await c.flush();
  assert.deepEqual(state.saves, []);
  assert.equal(homes.flat.building.floors[0].name, "Flat");
  // back on its own home it is offered again and restores there
  c.setHome(undefined);
  await ticks();
  assert.equal(c.homeId, "home");
  assert.equal((c.draft as Draft | null)?.home, "home");
  // the draft names no revision (kept before #378): the plan shown becomes a restore point first
  await c.restoreDraft();
  await c.flush();
  assert.deepEqual(state.snapshots, ["home"]);
  assert.deepEqual(state.saves, [{ home: "home", name: "Own unsaved" }]);
  done(c);
});

test("a draft held over from before homes had ids is offered only while the view follows the active home (#150)", async () => {
  const { hass } = backend();
  store.set("home3d.unsaved", JSON.stringify(draftOf(undefined, "Old session")));
  const named = await open(hass, "flat");
  assert.equal(named.draft, null);
  done(named);
  store.set("home3d.unsaved", JSON.stringify(draftOf(undefined, "Old session")));
  const following = await open(hass);
  assert.equal(following.draft?.building.floors[0].name, "Old session");
  done(following);
});

test("a debounced edit still waiting when the home is switched is saved to the home it was made on (#150)", async () => {
  const { hass, state, homes } = backend();
  const c = await open(hass);
  c.edit(plan("Own moved"));
  // the 700 ms save has not run yet
  c.setHome("flat");
  await ticks();
  assert.equal(c.homeId, "flat");
  assert.deepEqual(state.saves, [{ home: "home", name: "Own moved" }]);
  assert.equal(homes.flat.building.floors[0].name, "Flat");
  assert.equal(c.building?.floors[0].name, "Flat");
  done(c);
});

test("an edit made while the other home is still loading goes to the home on screen, not the new one (#150)", async () => {
  const { hass, state, homes } = backend();
  const c = await open(hass);
  state.hold.get = gate();
  const held = state.hold.get;
  c.setHome("flat");
  await ticks();
  // the old home is still shown while the flat is on its way: the user moves something in it
  assert.equal(c.homeId, "home");
  c.edit(plan("Own late edit"));
  held.open();
  await ticks();
  assert.equal(c.homeId, "flat");
  assert.equal(c.building?.floors[0].name, "Flat");
  await c.flush();
  assert.deepEqual(state.saves, [{ home: "home", name: "Own late edit" }]);
  assert.equal(homes.flat.building.floors[0].name, "Flat");
  done(c);
});

test("a save of the old home that lands after the switch does not touch the new home's state (#150)", async () => {
  const { hass, state } = backend();
  const c = await open(hass);
  state.hold.save = gate();
  const held = state.hold.save;
  c.edit(plan("Own saved late"));
  const saving = c.flush();
  await ticks();
  // the flat gets loaded while that save is still on its way (every public path waits for it; this is the backstop)
  c.home = "flat";
  await (c as unknown as { reload(): Promise<void> }).reload();
  assert.equal(c.homeId, "flat");
  held.open();
  await saving;
  assert.deepEqual(state.saves, [{ home: "home", name: "Own saved late" }]);
  assert.equal(c.building?.floors[0].name, "Flat");
  // the old home's new revision (8) is not taken for one of the flat's: a change to the flat with that number is news
  const gets = state.gets;
  state.push.get("(active)")?.({ revision: 8, home_id: "flat" });
  await ticks();
  assert.equal(state.gets, gets + 1);
  done(c);
});

test("a failed save keeps the draft for the home it was made on (#150)", async () => {
  const { hass, state } = backend();
  const c = await open(hass);
  state.failSaves = true;
  c.edit(plan("Own unsaved"));
  c.setHome("flat");
  await ticks();
  const kept = JSON.parse(store.get("home3d.unsaved.home") ?? "null") as Draft | null;
  assert.equal(kept?.home, "home");
  assert.equal(c.draft, null);
  done(c);
});

test("a reload of the same home on its way while an edit is made does not put the older plan back (#150)", async () => {
  const { hass, state } = backend();
  const c = await open(hass, "flat");
  state.hold.get = gate();
  const held = state.hold.get;
  const reopened = c.reopen();
  await ticks();
  c.edit(plan("Flat edited during the load"));
  held.open();
  await reopened;
  assert.equal(c.building?.floors[0].name, "Flat edited during the load");
  await c.flush();
  assert.deepEqual(state.saves, [{ home: "flat", name: "Flat edited during the load" }]);
  done(c);
});

test("of two quick home switches only the last one shows, whichever load answers last (#150)", async () => {
  const { hass, state } = backend();
  const c = await open(hass);
  state.hold.get = gate();
  const slow = state.hold.get;
  c.setHome("flat");
  await ticks();
  c.setHome(undefined);
  await ticks();
  assert.equal(c.homeId, "home");
  slow.open();
  await ticks();
  assert.equal(c.homeId, "home");
  assert.equal(c.building?.floors[0].name, "Own");
  done(c);
});

test("a home switch while the subscription is being set up leaves exactly one subscription, for the new home (#150)", async () => {
  const { hass, state } = backend();
  state.hold.subscribe = gate();
  const held = state.hold.subscribe;
  const c = controller(hass);
  c.hostConnected();
  await ticks();
  c.setHome("flat");
  await ticks();
  held.open();
  await ticks(10);
  assert.equal(state.subs.get("(active)"), 0);
  assert.equal(state.subs.get("flat"), 1);
  done(c);
});

test("a subscription that is set up after the view went away is let go of at once (#150)", async () => {
  const { hass, state } = backend();
  state.hold.subscribe = gate();
  const held = state.hold.subscribe;
  const c = controller(hass);
  c.hostConnected();
  await ticks();
  c.hostDisconnected();
  held.open();
  await ticks();
  assert.equal(state.subs.get("(active)"), 0);
  // moved to another place in the page (a dashboard re-parents cards): one subscription, not two
  state.hold.subscribe = gate();
  const again = state.hold.subscribe;
  c.hostConnected();
  await ticks();
  c.hostDisconnected();
  c.hostConnected();
  again.open();
  await ticks(10);
  assert.equal(state.subs.get("(active)"), 1);
  done(c);
});

/** Someone else saves `home` (another device) without this view hearing of it yet. */
function otherSaves(homes: Record<string, { building: Building; revision: number }>, home: string, name: string): void {
  homes[home] = { building: plan(name), revision: homes[home].revision + 1 };
}

const storedDraft = (home = "home") => JSON.parse(store.get(`home3d.unsaved.${home}`) ?? "null") as Draft | null;

test("a refused save at a home switch is made again on its own home's newer plan and saved there (#149, #150)", async () => {
  const { hass, state, homes } = backend();
  const c = await open(hass);
  otherSaves(homes, "home", "Theirs");
  state.hold.save = gate();
  const held = state.hold.save;
  // a 3D view setting, saved at once from revision 7; the user switches to the flat while it is on its way
  c.update((b) => void (b.settings.grid = 0.1));
  await ticks();
  c.setHome("flat");
  await ticks();
  held.open();
  await ticks(12);
  // refused at the old home's revision, then made again on that home's plan (not the flat's) and saved there
  assert.deepEqual(state.refused, [{ home: "home", base: 7 }]);
  assert.deepEqual(state.saves, [{ home: "home", name: "Theirs" }]);
  assert.equal(homes.home.revision, 9);
  assert.equal(homes.home.building.settings.grid, 0.1);
  assert.equal(homes.flat.revision, 2);
  assert.equal(homes.flat.building.floors[0].name, "Flat");
  assert.equal(c.homeId, "flat");
  assert.equal(c.building?.floors[0].name, "Flat");
  assert.equal(c.conflict, false);
  assert.equal(c.draft, null);
  assert.equal(storedDraft(), null);
  // the flat's own saves start from the flat's revision
  c.edit(plan("Flat edited"));
  await c.flush();
  assert.deepEqual(state.saves.at(-1), { home: "flat", name: "Flat edited" });
  assert.equal(state.refused.length, 1);
  done(c);
});

test("an edit refused at a home switch stays a draft of its own home and is offered there again (#149, #150)", async () => {
  const { hass, state, homes } = backend();
  const c = await open(hass);
  otherSaves(homes, "home", "Theirs");
  c.edit(plan("Own edit"));
  c.setHome("flat");
  await ticks(12);
  assert.deepEqual(state.refused, [{ home: "home", base: 7 }]);
  assert.deepEqual(state.saves, []);
  // the flat shows, without the old home's conflict on offer; the edit is kept for the home it was made on
  assert.equal(c.homeId, "flat");
  assert.equal(c.building?.floors[0].name, "Flat");
  assert.equal(c.draft, null);
  assert.equal(c.conflict, false);
  assert.equal(storedDraft()?.home, "home");
  assert.equal(storedDraft()?.conflict, true);
  // a save on the flat keeps the other home's draft; restoring on the flat does nothing
  c.edit(plan("Flat edited"));
  await c.flush();
  assert.deepEqual(state.saves, [{ home: "flat", name: "Flat edited" }]);
  assert.equal(storedDraft()?.home, "home");
  await c.restoreDraft();
  await c.flush();
  assert.equal(state.saves.length, 1);
  // back on its own home: offered as a refused save, over their plan; "use mine" keeps theirs as a restore point
  c.setHome(undefined);
  await ticks(12);
  assert.equal(c.homeId, "home");
  assert.equal(c.building?.floors[0].name, "Theirs");
  assert.equal((c.draft as Draft | null)?.building.floors[0].name, "Own edit");
  assert.equal(c.conflict, true);
  await c.restoreDraft();
  await c.flush();
  assert.deepEqual(state.snapshots, ["home"]);
  assert.deepEqual(state.saves.at(-1), { home: "home", name: "Own edit" });
  assert.equal(homes.home.revision, 9);
  assert.equal(storedDraft(), null);
  done(c);
});

test("a refused save of the old home that lands after the switch is kept for that home, the new one untouched (#149, #150)", async () => {
  const { hass, state, homes } = backend();
  const c = await open(hass);
  state.hold.save = gate();
  const held = state.hold.save;
  c.edit(plan("Own saved late"));
  const saving = c.flush();
  await ticks();
  otherSaves(homes, "home", "Theirs");
  // the backstop path: the flat is loaded while that save is still on its way
  c.home = "flat";
  await (c as unknown as { reload(): Promise<boolean> }).reload();
  assert.equal(c.homeId, "flat");
  const gets = state.gets;
  held.open();
  await saving;
  assert.deepEqual(state.refused, [{ home: "home", base: 7 }]);
  // their plan of the old home is not fetched over the flat, nor anything replayed onto it
  assert.equal(state.gets, gets);
  assert.equal(c.building?.floors[0].name, "Flat");
  assert.equal(c.draft, null);
  assert.equal(c.conflict, false);
  assert.equal(c.saveState, "error");
  assert.equal(storedDraft()?.home, "home");
  assert.equal(storedDraft()?.building.floors[0].name, "Own saved late");
  assert.equal(homes.flat.building.floors[0].name, "Flat");
  done(c);
});
