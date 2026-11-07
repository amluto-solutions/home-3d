// A reload reopens the home this device and user had open last (#160), not the real house on the displays.
import assert from "node:assert/strict";
import { test } from "node:test";
import { BuildingController } from "./building-controller.ts";
import { setPlanRecipes } from "./packs.ts";
import type { HomeAssistant } from "./types.ts";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener() {}, removeEventListener() {} });
const at = (search: string) => (g.location = { search, hash: "" });
at("");
const store = new Map<string, string>();
g.localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
};

const { Floorplan3dPanel } = await import("./panel.ts");

const plan = (name: string) => ({
  version: 1,
  settings: {},
  floors: [{ id: "f", name, elevation: 0, height: 2.5, rooms: [], walls: [], openings: [], placements: [], furniture: [], outdoor: [] }],
});

const tick = () => new Promise((r) => setTimeout(r, 0));
const ticks = async (n = 6) => {
  for (let i = 0; i < n; i++) await tick();
};

/** Two homes, "home" active; a home id the backend does not know is answered like Home Assistant does. */
function backend(canEdit = true) {
  const homes: Record<string, string> = { home: "Own", test: "Test" };
  const hass = {
    language: "en",
    user: { id: "u1", is_admin: true, name: "x" },
    states: {},
    themes: { darkMode: true },
    callWS: async (msg: Record<string, unknown> & { type: string }) => {
      const id = (msg.home_id as string | undefined) ?? "home";
      if (msg.type === "home_3d/building/get") {
        if (!homes[id]) throw { code: "home_not_found", message: "There is no such home" };
        return { building: plan(homes[id]), revision: 1, home_id: id, home_name: homes[id], can_edit: canEdit };
      }
      return { homes: [], active: "home" };
    },
    connection: { subscribeMessage: async () => async () => undefined },
  } as unknown as HomeAssistant;
  return { hass, homes };
}

function controller(hass: HomeAssistant): BuildingController {
  const host = { addController() {}, removeController() {}, requestUpdate() {}, updateComplete: Promise.resolve(true) };
  const c = new BuildingController(host);
  c.setHass(hass);
  return c;
}

test("a remembered home is opened on the first load; one deleted meanwhile falls back to the active home (#160)", async () => {
  const { hass, homes } = backend();
  const c = controller(hass);
  c.openRemembered("test");
  c.hostConnected();
  await ticks();
  assert.equal(c.homeId, "test");
  c.hostDisconnected();

  delete homes.test;
  const gone: string[] = [];
  const d = controller(hass);
  d.onHomeGone = () => gone.push("told");
  d.openRemembered("test");
  d.hostConnected();
  await ticks();
  assert.equal(d.homeId, "home");
  assert.equal(d.home, undefined);
  assert.equal(d.error, null);
  assert.deepEqual(gone, ["told"]);
  d.hostDisconnected();
  setPlanRecipes(undefined);
});

test("a card's own home that is gone stays an error: only a remembered home falls back (#160)", async () => {
  const { hass } = backend();
  const c = controller(hass);
  c.home = "missing";
  c.hostConnected();
  await ticks();
  assert.equal(c.homeId, null);
  assert.match(c.error ?? "", /no such home/);
  c.hostDisconnected();
  setPlanRecipes(undefined);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function panel(hass: HomeAssistant): Promise<any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (Floorplan3dPanel as any)();
  p.hass = hass;
  p.data.hostConnected();
  p.willUpdate(new Map([["hass", undefined]]));
  await ticks();
  p.willUpdate(new Map());
  return p;
}

test("the panel reopens the home its user last opened here, and forgets it on going back to the active home (#160)", async () => {
  store.clear();
  const { hass } = backend();
  const first = await panel(hass);
  assert.equal(first.data.homeId, "home");
  first.openHome("test");
  await ticks();
  assert.equal(first.data.homeId, "test");
  first.data.hostDisconnected();
  // the page is reloaded
  const again = await panel(hass);
  assert.equal(again.data.homeId, "test");
  // another user on this browser starts on the active home
  const other = await panel({ ...hass, user: { id: "u2", is_admin: true, name: "y" } } as HomeAssistant);
  assert.equal(other.data.homeId, "home");
  other.data.hostDisconnected();
  // following the active home again is remembered too
  again.openHome(undefined);
  await ticks();
  again.data.hostDisconnected();
  const third = await panel(hass);
  assert.equal(third.data.homeId, "home");
  third.data.hostDisconnected();
  setPlanRecipes(undefined);
});

test("a deleted remembered home is forgotten, a tablet and a non-editor show the active home (#160)", async () => {
  store.clear();
  const { hass, homes } = backend();
  store.set("home3d.home.u1", "test");
  delete homes.test;
  const p = await panel(hass);
  assert.equal(p.data.homeId, "home");
  assert.equal(store.get("home3d.home.u1"), "");
  p.data.hostDisconnected();

  homes.test = "Test";
  store.set("home3d.home.u1", "test");
  at("?tablet=1");
  const tablet = await panel(hass);
  assert.equal(tablet.data.homeId, "home");
  tablet.data.hostDisconnected();
  at("");
  // out of tablet mode again: its idle clock stops
  tablet.willUpdate(new Map());

  const viewer = await panel(backend(false).hass);
  await ticks();
  viewer.willUpdate(new Map());
  await ticks();
  assert.equal(viewer.data.homeId, "home");
  viewer.data.hostDisconnected();
  setPlanRecipes(undefined);
});
