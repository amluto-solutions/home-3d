// Nothing chosen in one home stays chosen in another (#150): the panel, the editor and the card let go of the room,
// item and device picked before the home changed. Built in plain Node like panel-tablet.test.ts.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Building } from "./model.ts";

const g = globalThis as Record<string, unknown>;
for (const k of ["VIEWER", "EDITOR", "LOCATE", "ITEMS", "LANG", "PLAN2D", "FUN", "VOICE", "TIMETRAVEL", "CARD_EDITOR"]) g[`__FP3D_${k}_HASH__`] = "test";
g.__FP3D_VERSION__ = "0";
g.window ??= {};
Object.assign(g.window as object, { addEventListener() {}, removeEventListener() {} });
g.location = { search: "", hash: "" };

const { Floorplan3dPanel } = await import("./panel.ts");
const { makeEditor, square } = await import("./components/editor-harness.ts");

const room = (id: string) => ({ id, name: id, points: [[0, 0], [4, 0], [4, 3], [0, 3]], area_id: null });
const item = (id: string) => ({ id, type: "sofa", x: 1, z: 1, rotation: 0, w: 1, d: 1, h: 1, variant: null, entity: null, power: null });

/** A single-floor home (the floor id "f" in every home, as plans made from the sample have). */
function home(rooms: string[], furniture: string[] = []): Building {
  return {
    floors: [{ id: "f", name: "Ground", rooms: rooms.map(room), furniture: furniture.map(item), placements: [], openings: [], walls: [], outdoor: [], height: 2.5, elevation: 0 }],
    settings: { roof: { type: "none" } },
  } as unknown as Building;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function panel(b: Building, homeId: string): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = new (Floorplan3dPanel as any)();
  p.hass = { language: "en", user: { id: "admin", is_admin: true, name: "x" }, states: {}, themes: { darkMode: true } };
  p.data.building = b;
  p.data.homeId = homeId;
  p.willUpdate(new Map());
  return p;
}

test("the panel lets go of the room, item and device of a single-floor home when another home loads (#150)", () => {
  const p = panel(home(["lounge"], ["sofa1"]), "h1");
  p._roomId = "lounge";
  p._selFurniture = "sofa1";
  p._selDevice = "light.sample_lounge";
  p.willUpdate(new Map());
  assert.equal(p._roomId, "lounge");
  // the other home happens to use the same room and item ids: still nothing stays chosen
  p.data.building = home(["lounge"], ["sofa1"]);
  p.data.homeId = "h2";
  p.willUpdate(new Map());
  assert.equal(p._roomId, null);
  assert.equal(p._selFurniture, null);
  assert.equal(p._selDevice, null);
  assert.equal(p._floorId, null);
});

test("in the same home a room or item that is gone is let go of, one that is still there stays (#150)", () => {
  const p = panel(home(["lounge", "hall"], ["sofa1", "lamp1"]), "h1");
  p._roomId = "hall";
  p._selFurniture = "lamp1";
  p.data.building = home(["lounge", "hall"], ["sofa1", "lamp1"]);
  p.willUpdate(new Map());
  assert.equal(p._roomId, "hall");
  assert.equal(p._selFurniture, "lamp1");
  p.data.building = home(["lounge"], ["sofa1"]);
  p.willUpdate(new Map());
  assert.equal(p._roomId, null);
  assert.equal(p._selFurniture, null);
});

test("the editor starts another home with nothing chosen and on that home's start floor (#150)", async () => {
  const ed = await makeEditor([square("lounge", 0, 0, 4, 3)]);
  ed.hass.callWS = async () => ({ updates: [] });
  ed.home = "h1";
  ed._furnitureId = "sofa1";
  ed._roomId = "lounge";
  const other = home(["lounge"], ["sofa1"]);
  other.floors.push({ ...other.floors[0], id: "up", rooms: [], furniture: [] });
  other.settings.editor_floor = "up";
  ed.building = other;
  ed.home = "h2";
  ed.willUpdate(
    new Map<string, unknown>([
      ["home", "h1"],
      ["building", undefined],
    ]),
  );
  assert.equal(ed._roomId, null);
  assert.equal(ed._furnitureId, null);
  assert.equal(ed._floorId, "up");
});

test("the card closes the room of the old home: a new home or start room in its options, or a room not in the plan (#150)", async () => {
  const { Floorplan3dCard } = await import("./card.ts");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const card = new (Floorplan3dCard as any)();
  card.setConfig({ type: "custom:home-3d-card", home: "h1", room: "lounge" });
  card.data.building = home(["lounge", "hall"]);
  card.render();
  assert.equal(card._roomId, "lounge");
  // the dashboard editor points the card at another home: the room opens again there (if it has one)
  card.setConfig({ type: "custom:home-3d-card", home: "h2", room: "lounge" });
  assert.equal(card._roomId, null);
  card.data.building = home(["lounge"]);
  card.render();
  assert.equal(card._roomId, "lounge");
  // the active home changed under a card that follows it: a room the new plan lacks closes
  card._roomId = "hall";
  card.data.building = home(["lounge"]);
  card.willUpdate(new Map());
  assert.equal(card._roomId, null);
});

test("the HA-areas import says the areas are this Home Assistant's and names the home its rooms go into (#160)", async () => {
  const ed = await makeEditor([]);
  ed.hass.areas = { kitchen: { area_id: "kitchen", name: "Kitchen", floor_id: "ground" } };
  ed._doc.floors[0].ha_floor = "ground";
  ed.homeName = "Test home";
  const flatten = (v: unknown): string => {
    if (v == null || typeof v === "symbol" || typeof v === "function" || typeof v === "boolean") return "";
    if (Array.isArray(v)) return v.map(flatten).join("");
    if (typeof v === "object" && "strings" in (v as object)) {
      const t = v as { strings: readonly string[]; values: unknown[] };
      return t.strings.map((s, i) => s + (i < t.values.length ? flatten(t.values[i]) : "")).join("");
    }
    return String(v);
  };
  const side = flatten(ed.renderSide(ed._doc.floors[0]));
  assert.match(side, /Add rooms from HA areas \(1\)/);
  assert.match(side, /Uses this Home Assistant's areas; the rooms are added to "Test home"/);
});
