// Editor drafts (#378): one per home, kept until restored or discarded, with the revision they were made on; a draft
// is offered before any automatic save, a page going away keeps its last edit, a failed save is made again when the
// connection is back, and own-revision tracking survives revisions going backwards.

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

// the page's own events (pagehide), as the browser would send them
const pageListeners = new Map<string, Set<(e: Event) => void>>();
const g = globalThis as Record<string, unknown>;
g.addEventListener = (type: string, cb: (e: Event) => void) => void (pageListeners.get(type) ?? pageListeners.set(type, new Set()).get(type)!).add(cb);
g.removeEventListener = (type: string, cb: (e: Event) => void) => void pageListeners.get(type)?.delete(cb);
const pageHides = () => {
  for (const cb of pageListeners.get("pagehide") ?? []) cb({ type: "pagehide" } as Event);
};

const plan = (name: string) =>
  ({
    version: 1,
    settings: {},
    floors: [{ id: "f", name, elevation: 0, height: 2.5, rooms: [], walls: [], openings: [], placements: [], furniture: [], outdoor: [] }],
  }) as unknown as Building;
const nameOf = (b: Building | null | undefined) => b?.floors[0].name;

const tick = () => new Promise((r) => setTimeout(r, 0));
const ticks = async (n = 8) => {
  for (let i = 0; i < n; i++) await tick();
};

/** A backend with two homes ("home" active, "flat"), shared by every controller (tab) of a test. */
function backend() {
  const homes: Record<string, { building: Building; revision: number }> = {
    home: { building: plan("Own"), revision: 7 },
    flat: { building: plan("Flat"), revision: 2 },
  };
  const state = {
    failSaves: false,
    failSnapshots: false,
    saves: [] as { home: string; name: string; base: unknown }[],
    refused: [] as { home: string; base: unknown }[],
    snapshots: [] as string[],
    hold: null as { opened: Promise<void>; open: () => void } | null,
    push: [] as ((e: { revision: number; home_id?: string }) => void)[],
    ready: new Set<() => void>(),
    states: {} as Record<string, unknown>,
  };
  const hass = {
    user: { is_admin: true },
    get states() {
      return state.states;
    },
    callWS: async (msg: Record<string, unknown> & { type: string }) => {
      const id = (msg.home_id as string | undefined) ?? "home";
      if (msg.type === "home_3d/building/get") {
        return { building: structuredClone(homes[id].building), revision: homes[id].revision, home_id: id, home_name: id, can_edit: true };
      }
      if (msg.type === "home_3d/building/save") {
        const held = state.hold;
        state.hold = null;
        if (held) await held.opened;
        if (state.failSaves) throw new Error("connection lost");
        if (msg.base_revision !== undefined && msg.base_revision !== homes[id].revision) {
          state.refused.push({ home: id, base: msg.base_revision });
          throw { code: "conflict", message: "The plan changed" };
        }
        const b = msg.building as Building;
        state.saves.push({ home: id, name: nameOf(b)!, base: msg.base_revision });
        homes[id] = { building: structuredClone(b), revision: homes[id].revision + 1 };
        return { revision: homes[id].revision, recipes: {} };
      }
      if (msg.type === "home_3d/history/snapshot") {
        if (state.failSnapshots) throw new Error("connection lost");
        state.snapshots.push(id);
        return null;
      }
      throw new Error(`unexpected ${msg.type}`);
    },
    connection: {
      subscribeMessage: async (cb: (e: { revision: number; home_id?: string }) => void) => {
        state.push.push(cb);
        return async () => void state.push.splice(state.push.indexOf(cb), 1);
      },
      addEventListener: (event: string, cb: () => void) => event === "ready" && state.ready.add(cb),
      removeEventListener: (event: string, cb: () => void) => event === "ready" && state.ready.delete(cb),
    },
  } as unknown as HomeAssistant;
  /** Someone else saves `home` (another device); `announce`: the subscriptions hear of it. */
  const otherSaves = (home: string, name: string, announce = true, revision = homes[home].revision + 1) => {
    homes[home] = { building: plan(name), revision };
    if (announce) for (const cb of [...state.push]) cb({ revision, home_id: home });
  };
  const reconnect = async () => {
    for (const cb of [...state.ready]) cb();
    await ticks();
  };
  return { hass, state, homes, otherSaves, reconnect };
}

async function open(hass: HomeAssistant, home?: string): Promise<BuildingController> {
  const host = { addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) };
  const c = new BuildingController(host);
  c.home = home;
  c.setHass(hass);
  c.hostConnected();
  await ticks();
  return c;
}

function done(...cs: BuildingController[]): void {
  for (const c of cs) c.hostDisconnected();
  setPlanRecipes(undefined);
  store.clear();
}

const stored = (home?: string) => JSON.parse(store.get(home ? `home3d.unsaved.${home}` : "home3d.unsaved") ?? "null") as Draft | null;

test("a failed save on one home never replaces another home's draft (#378)", async () => {
  const { hass, state } = backend();
  const c = await open(hass);
  state.failSaves = true;
  c.edit(plan("Home edit"));
  await c.flush();
  c.setHome("flat");
  await ticks();
  c.edit(plan("Flat edit"));
  await c.flush();
  assert.equal(nameOf(stored("home")?.building), "Home edit");
  assert.equal(nameOf(stored("flat")?.building), "Flat edit");
  assert.equal(store.has("home3d.unsaved"), false);
  done(c);
});

test("another tab saving the same home does not erase this tab's draft (#378)", async () => {
  const { hass, state } = backend();
  const a = await open(hass);
  const b = await open(hass);
  state.failSaves = true;
  a.edit(plan("Tab A"));
  await a.flush();
  assert.equal(nameOf(stored("home")?.building), "Tab A");
  state.failSaves = false;
  b.edit(plan("Tab B"));
  await b.flush();
  assert.deepEqual(state.saves.map((s) => s.name), ["Tab B"]);
  assert.equal(nameOf(stored("home")?.building), "Tab A", "kept until it is restored or discarded");
  // a later save from tab A itself holds those edits: its own draft goes then
  a.edit(plan("Tab A again"));
  // (tab A was refused: tab B saved meanwhile; its edit is kept as a refused save's draft, not lost)
  await a.flush();
  assert.equal(nameOf(stored("home")?.building), "Tab A again");
  assert.equal(stored("home")?.conflict, true);
  done(a, b);
});

test("a draft saved from here goes once the view saves the same home again (#378)", async () => {
  const { hass, state } = backend();
  const c = await open(hass);
  state.failSaves = true;
  c.edit(plan("First"));
  await c.flush();
  assert.equal(nameOf(stored("home")?.building), "First");
  assert.equal(c.draft, null, "the edit is on screen, not offered");
  state.failSaves = false;
  c.edit(plan("Second"));
  await c.flush();
  assert.equal(stored("home"), null);
  done(c);
});

test("old single-key drafts move to their home's key on first read (#378)", async () => {
  const { hass } = backend();
  store.set("home3d.unsaved", JSON.stringify({ building: plan("Old home draft"), savedAt: 5, home: "home" }));
  store.set("floorplan-3d.unsaved", JSON.stringify({ building: plan("Older still"), savedAt: 1 }));
  const c = await open(hass);
  assert.equal(nameOf(stored("home")?.building), "Old home draft");
  // the one without a home keeps the old key, for the view following the active home
  assert.equal(nameOf(stored()?.building), "Older still");
  assert.equal(store.has("floorplan-3d.unsaved"), false);
  // the home's own draft comes first
  assert.equal(nameOf(c.draft?.building), "Old home draft");
  done(c);
});

test("a draft keeps its base revision; restoring it onto a newer plan says so and takes a restore point first (#378)", async () => {
  const { hass, state, homes, otherSaves } = backend();
  const c = await open(hass);
  state.failSaves = true;
  c.edit(plan("Mine"));
  await c.flush();
  assert.equal(stored("home")?.base, 7);
  done(c);
  // restored in a new session on the plan it was made on: nothing newer to keep
  store.set("home3d.unsaved.home", JSON.stringify({ building: plan("Mine"), savedAt: 2, home: "home", base: 7, id: "x" }));
  state.failSaves = false;
  const same = await open(hass);
  assert.equal(same.draftNewer, false);
  await same.restoreDraft();
  await same.flush();
  assert.deepEqual(state.snapshots, []);
  assert.deepEqual(state.saves.at(-1), { home: "home", name: "Mine", base: 7 });
  assert.equal(stored("home"), null);
  done(same);
  // someone saved since: the notice says the plan may be newer, and restoring keeps it as a restore point first
  store.set("home3d.unsaved.home", JSON.stringify({ building: plan("Mine, older"), savedAt: 3, home: "home", base: 5, id: "y" }));
  otherSaves("home", "Twenty minutes of theirs", false);
  const newer = await open(hass);
  assert.equal(newer.draftNewer, true);
  await newer.restoreDraft();
  await newer.flush();
  assert.deepEqual(state.snapshots, ["home"]);
  assert.equal(nameOf(homes.home.building), "Mine, older");
  done(newer);
});

test("without a restore point a stale draft replaces nothing and stays on offer (#378)", async () => {
  const { hass, state, homes } = backend();
  store.set("home3d.unsaved.home", JSON.stringify({ building: plan("Mine"), savedAt: 3, home: "home", base: 5, id: "y" }));
  const c = await open(hass);
  state.failSnapshots = true;
  await c.restoreDraft();
  await c.flush();
  assert.deepEqual(state.saves, []);
  assert.equal(nameOf(homes.home.building), "Own");
  assert.equal(nameOf(c.draft?.building), "Mine");
  assert.equal(c.saveState, "error");
  assert.ok(stored("home"));
  done(c);
});

test("discarding removes only the draft on offer (#378)", async () => {
  const { hass } = backend();
  store.set("home3d.unsaved.home", JSON.stringify({ building: plan("Offered"), savedAt: 3, home: "home", id: "a" }));
  const c = await open(hass);
  // another tab keeps a newer draft of the same home meanwhile
  store.set("home3d.unsaved.home", JSON.stringify({ building: plan("Newer, other tab"), savedAt: 4, home: "home", id: "b" }));
  c.discardDraft();
  assert.equal(nameOf(stored("home")?.building), "Newer, other tab");
  done(c);
  store.set("home3d.unsaved.home", JSON.stringify({ building: plan("Offered"), savedAt: 3, home: "home", id: "a" }));
  const d = await open(hass);
  d.discardDraft();
  assert.equal(stored("home"), null);
  done(d);
});

test("a stored draft is offered before the automatic opening-links save, which waits for it (#378)", async () => {
  const { hass, state } = backend();
  // Home Assistant has told its entities: the one-off save of the door and window links runs on load (#203)
  state.states = { "binary_sensor.sample_door": { state: "off", attributes: {} } };
  store.set("home3d.unsaved.home", JSON.stringify({ building: plan("Draft"), savedAt: 3, home: "home", base: 7, id: "a" }));
  const c = await open(hass);
  await ticks(40);
  assert.equal(nameOf(c.draft?.building), "Draft", "the draft is offered");
  assert.equal(state.saves.length, 0, "no automatic save ahead of it");
  assert.ok(stored("home"), "and it is still kept");
  // discarded: the one-off save is made now
  c.discardDraft();
  await c.flush();
  assert.deepEqual(state.saves.map((s) => s.name), ["Own"]);
  done(c);
  // without a draft the one-off saves at once, as before
  const { hass: hass2, state: state2 } = backend();
  state2.states = { "binary_sensor.sample_door": { state: "off", attributes: {} } };
  const d = await open(hass2);
  await d.flush();
  assert.deepEqual(state2.saves.map((s) => s.name), ["Own"]);
  done(d);
});

test("a page going away keeps the edit still waiting for its pause as a draft, and saves it (#378)", async () => {
  const { hass, state } = backend();
  const c = await open(hass);
  let release!: () => void;
  state.hold = { opened: new Promise<void>((r) => (release = r)), open: () => release() };
  c.edit(plan("Last edit"));
  pageHides();
  // kept at once, before any answer: the page may be gone before the save lands
  assert.equal(nameOf(stored("home")?.building), "Last edit");
  assert.equal(stored("home")?.base, 7);
  release();
  await ticks();
  assert.deepEqual(state.saves.map((s) => s.name), ["Last edit"]);
  assert.equal(stored("home"), null, "saved: the draft goes");
  done(c);
  assert.equal(pageListeners.get("pagehide")?.size ?? 0, 0, "a closed view stops listening");
});

test("an edit kept at pagehide whose save never lands is offered in the next session (#378)", async () => {
  const { hass, state } = backend();
  const c = await open(hass);
  state.hold = { opened: new Promise<void>(() => undefined), open: () => undefined };
  c.edit(plan("Closed too soon"));
  pageHides();
  c.hostDisconnected();
  const next = await open(hass);
  assert.equal(nameOf(next.draft?.building), "Closed too soon");
  assert.equal(next.draftNewer, false);
  done(next);
});

test("a failed save is made again when the connection is back (#378)", async () => {
  const { hass, state, reconnect } = backend();
  const c = await open(hass);
  state.failSaves = true;
  c.edit(plan("Offline edit"));
  await c.flush();
  assert.equal(c.saveState, "error");
  state.failSaves = false;
  await reconnect();
  assert.deepEqual(state.saves, [{ home: "home", name: "Offline edit", base: 7 }]);
  assert.equal(c.saveState, "saved");
  assert.equal(stored("home"), null);
  done(c);
});

test("a failed save made again after someone else saved takes the conflict path, not over their plan (#378, #149)", async () => {
  const { hass, state, homes, otherSaves, reconnect } = backend();
  const c = await open(hass);
  state.failSaves = true;
  c.edit(plan("Offline edit"));
  await c.flush();
  state.failSaves = false;
  otherSaves("home", "Theirs", false);
  await reconnect();
  assert.deepEqual(state.refused, [{ home: "home", base: 7 }]);
  assert.equal(nameOf(homes.home.building), "Theirs");
  assert.equal(nameOf(c.building), "Theirs");
  assert.equal(c.conflict, true);
  assert.equal(nameOf(c.draft?.building), "Offline edit");
  done(c);
});

test("a remote save heard after a failed one makes it again instead of hiding the edit under theirs (#378)", async () => {
  const { hass, state, otherSaves } = backend();
  const c = await open(hass);
  state.failSaves = true;
  c.update((b) => void (b.settings.grid = 0.1));
  await c.flush();
  state.failSaves = false;
  otherSaves("home", "Theirs");
  await ticks(20);
  // refused (their plan is newer), then the 3D view's change is made again on their plan and saved (#149)
  assert.deepEqual(state.refused, [{ home: "home", base: 7 }]);
  assert.equal(nameOf(c.building), "Theirs");
  assert.equal(c.building?.settings.grid, 0.1);
  assert.equal(state.saves.at(-1)?.name, "Theirs");
  assert.equal(c.saveState, "saved");
  done(c);
});

test("others' saves are not taken for own ones after the revisions went backwards (#378)", async () => {
  const { hass, homes, otherSaves } = backend();
  const c = await open(hass);
  c.edit(plan("Mine at 8"));
  await c.flush();
  c.edit(plan("Mine at 9"));
  await c.flush();
  assert.equal(homes.home.revision, 9);
  // the home was made again with the same id (or put back from a backup): revisions start low again
  otherSaves("home", "Theirs at 3", true, 3);
  await ticks();
  assert.equal(nameOf(c.building), "Theirs at 3");
  for (const r of [4, 5, 6, 7, 8]) {
    otherSaves("home", `Theirs at ${r}`, true, r);
    await ticks();
  }
  // 8 was a revision this view saved before: theirs now, shown
  assert.equal(nameOf(c.building), "Theirs at 8");
  done(c);
});

test("a backup put back while disconnected (a lower revision) shows after the reconnect (#378)", async () => {
  const { hass, homes, otherSaves, reconnect } = backend();
  const c = await open(hass);
  c.edit(plan("Mine at 8"));
  await c.flush();
  // Home Assistant restored from a backup and restarted: the plan is at revision 6, nobody announced it
  otherSaves("home", "From the backup", false, 6);
  await reconnect();
  assert.equal(nameOf(c.building), "From the backup");
  // and someone's next save, revision 8 again, is not taken for the one made here before
  otherSaves("home", "Theirs at 7", true, 7);
  await ticks();
  otherSaves("home", "Theirs at 8", true, 8);
  await ticks();
  assert.equal(nameOf(c.building), "Theirs at 8");
  assert.equal(homes.home.revision, 8);
  done(c);
});
